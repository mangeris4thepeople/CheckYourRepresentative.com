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
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-01`;
}

async function run() {
  const client = await pool.connect();
  try {
    let scanned = 0, matched = 0;
    for (const url of BMF_REGION_URLS) {
      console.log(`Reading ${url}`);
      for await (const rec of csvRecords(url)) {
        scanned++;
        const name = rec.NAME || rec.Name;
        const ein = rec.EIN || rec.Ein;
        if (!name || !ein) continue;
        const upd = await client.query(
          `UPDATE organizations
             SET ein = $1,
                 subsection_code = COALESCE(subsection_code, $2),
                 city = COALESCE(city, $3),
                 state = COALESCE(state, $4),
                 zip = COALESCE(zip, $5),
                 ruling_date = COALESCE(ruling_date, $6),
                 updated_at = now()
           WHERE lower(name) = lower($7) AND ein IS NULL`,
          [ein, rec.SUBSECTION || null, rec.CITY || null, rec.STATE || null, rec.ZIP || null, parseRuling(rec.RULING), name]
        );
        matched += upd.rowCount || 0;
      }
    }
    console.log(`Done. Scanned ${scanned} BMF rows, crosswalked EINs onto ${matched} organizations (exact name match).`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => { console.error('IRS BMF ETL failed:', err); process.exit(1); });
