/**
 * ETL: IRS Exempt Organizations Business Master File (EO BMF) -> crosswalk EINs
 * and subsection codes onto organizations already loaded from other sources.
 * Run: npm run etl:irs-bmf
 *
 * Requires: DATABASE_URL env var. No API key needed (public).
 *
 * VERIFY the four regional filenames below against the current IRS EO BMF page
 * before running. The IRS occasionally renames these extract files between
 * releases:
 * https://www.irs.gov/charities-non-profits/exempt-organizations-business-master-file-extract-eo-bmf
 * If they changed, update BMF_REGION_URLS. The download helper accepts either a
 * plain .csv or a .zip (extracted with adm-zip).
 *
 * KNOWN LIMITATION (do not silently paper over): matching is EXACT NAME MATCH
 * only. An org whose BMF legal name differs from the funder-reported name will
 * not be crosswalked, so many orgs stay without an EIN. Fuzzy matching is a
 * deliberately deferred v2 improvement, not a bug being hidden here.
 */
import pg from 'pg';
import { parse } from 'csv-parse';
import AdmZip from 'adm-zip';
import { Readable } from 'node:stream';

const BMF_REGION_URLS = [
  'https://www.irs.gov/pub/irs-soi/eo1.csv',
  'https://www.irs.gov/pub/irs-soi/eo2.csv',
  'https://www.irs.gov/pub/irs-soi/eo3.csv',
  'https://www.irs.gov/pub/irs-soi/eo4.csv',
];

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function* csvRecords(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`BMF download error ${res.status} for ${url}`);
  const parserOpts = { columns: true, skip_empty_lines: true, relax_column_count: true };
  if (url.toLowerCase().endsWith('.zip')) {
    const buf = Buffer.from(await res.arrayBuffer());
    const entry = new AdmZip(buf).getEntries().find(e => e.entryName.toLowerCase().endsWith('.csv'));
    if (!entry) throw new Error(`No CSV inside ${url}`);
    const parser = parse(entry.getData(), parserOpts);
    for await (const rec of parser) yield rec;
  } else {
    const parser = Readable.fromWeb(res.body).pipe(parse(parserOpts));
    for await (const rec of parser) yield rec;
  }
}

// BMF RULING is a YYYYMM string. Return an ISO date on the first of that month.
function parseRuling(r) {
  const s = String(r || "");
  if (s.length < 6) return null;
  const year = s.slice(0, 4);
  const month = parseInt(s.slice(4, 6), 10);
  // Verified live: the BMF uses "000000" (and similar all-zero values) as its
  // placeholder for "no ruling date on file", which is not a valid date.
  // Postgres correctly rejects it, so filter it here instead of crashing.
  if (year === '0000' || !Number.isFinite(month) || month < 1 || month > 12) return null;
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

// PERFORMANCE FIX (verified necessary, not theoretical): the original version
// of this function ran one UPDATE per BMF row against the remote database.
// The BMF is roughly 1.8 million rows across the four regional files, so that
// was one to two million round trips to Neon, tens of hours for a scheduled
// job that needs to finish in minutes. Since we only ever need to match BMF
// rows against organizations we already have (a few thousand, not millions),
// we load our organization names into memory once, do the 1.8 million-row
// comparison in memory as we stream each CSV (fast, no network), and only
// issue a database write for an actual match. Exact-name-match semantics are
// unchanged, this is a performance fix, not a behavior change.
// Verified live: connecting to the pooled Neon endpoint intermittently fails
// with a DNS resolution error under repeated back-to-back attempts, then
// succeeds moments later with no change to the connection string. That points
// to transient resolver or pooler flakiness rather than a bad credential, so
// this retries with backoff instead of failing the whole run on one hiccup.
async function connectWithRetry(tries = 5) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try { return await pool.connect(); }
    catch (e) { lastErr = e; console.warn(`connect attempt ${i + 1} failed (${e.code || e.message}), retrying...`); await new Promise((r) => setTimeout(r, 2000 * (i + 1))); }
  }
  throw lastErr;
}

async function run() {
  const client = await connectWithRetry();
  try {
    const { rows: existing } = await client.query('SELECT id, name FROM organizations WHERE ein IS NULL');
    const byLowerName = new Map();
    for (const o of existing) {
      const key = o.name.toLowerCase();
      if (!byLowerName.has(key)) byLowerName.set(key, []);
      byLowerName.get(key).push(o.id);
    }
    console.log(`Loaded ${existing.length} organizations without an EIN to match against.`);

    // organizations.ein is UNIQUE. The BMF itself is not: the same EIN can
    // legitimately appear on more than one row for affiliated or group
    // exemption entries. Track EINs already claimed in this run so a second
    // BMF row for the same EIN is skipped instead of hitting the constraint.
    const einsUsed = new Set();

    let scanned = 0, matched = 0, skippedDuplicateEin = 0;
    for (const url of BMF_REGION_URLS) {
      console.log(`Reading ${url}`);
      for await (const rec of csvRecords(url)) {
        scanned++;
        const name = rec.NAME || rec.Name;
        const ein = rec.EIN || rec.Ein;
        if (!name || !ein) continue;
        if (einsUsed.has(ein)) { skippedDuplicateEin++; continue; }
        const ids = byLowerName.get(String(name).toLowerCase());
        if (!ids || !ids.length) continue;

        // organizations.ein is UNIQUE, so if more than one of our org rows
        // shares this exact name (the same real nonprofit loaded separately
        // by two sources, for example matched by UEI from one source and by
        // name from another), only the first can take this EIN. The rest
        // stay unmatched rather than crash the run on a constraint violation.
        {
          const id = ids[0];
          const upd = await client.query(
            `UPDATE organizations
               SET ein = $1,
                   subsection_code = COALESCE(subsection_code, $2),
                   city = COALESCE(city, $3),
                   state = COALESCE(state, $4),
                   zip = COALESCE(zip, $5),
                   ruling_date = COALESCE(ruling_date, $6),
                   updated_at = now()
             WHERE id = $7 AND ein IS NULL
               AND NOT EXISTS (SELECT 1 FROM organizations o2 WHERE o2.ein = $1)`,
            [ein, rec.SUBSECTION || null, rec.CITY || null, rec.STATE || null, rec.ZIP || null, parseRuling(rec.RULING), id]
          );
          matched += upd.rowCount || 0;
          if (upd.rowCount) einsUsed.add(ein);
        }
        byLowerName.delete(String(name).toLowerCase()); // one EIN per org, stop matching this name again
      }
    }
    console.log(`Done. Scanned ${scanned} BMF rows, crosswalked EINs onto ${matched} organizations (exact name match). Skipped ${skippedDuplicateEin} rows with an EIN already claimed this run.`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => { console.error('IRS BMF ETL failed:', err); process.exit(1); });
