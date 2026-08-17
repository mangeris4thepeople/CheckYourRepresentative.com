// =============================================================================
// ETL: Colorado TRACER contribution bulk data -> tracer_contributions
//
// Source: the Secretary of State's yearly bulk export,
//   https://tracer.sos.colorado.gov/PublicSite/Docs/BulkDataDownloads/{YEAR}_ContributionData.csv.zip
// Run:    node etl/tracer_etl.mjs 2024 2025 2026
//
// Loads NON-INDIVIDUAL contributors only (corporations, committees, labor
// organizations, nonprofits, and so on). Individual donors are out of scope
// for the NGO Money Loop and are skipped. Re-running a year is a no-op for
// rows already loaded: every row carries a stable tracer_record_id.
//
// Requires: DATABASE_URL env var (Neon Postgres connection string).
// =============================================================================
import AdmZip from 'adm-zip';
import { parse } from 'csv-parse/sync';
import { createHash } from 'node:crypto';
import { makePool, normalizeName, politeFetch } from './lib.mjs';

const years = process.argv.slice(2).filter((a) => /^\d{4}$/.test(a));
if (years.length === 0) {
  console.error('Usage: node etl/tracer_etl.mjs <year> [year...]   e.g. 2024 2025 2026');
  process.exit(1);
}

const BULK_URL = (year) =>
  `https://tracer.sos.colorado.gov/PublicSite/Docs/BulkDataDownloads/${year}_ContributionData.csv.zip`;

// TRACER header names have varied over the years in casing and spacing, so
// every lookup goes through a squashed-key index of the row.
function fieldGetter(row) {
  const idx = {};
  for (const key of Object.keys(row)) {
    idx[key.toLowerCase().replace(/[^a-z0-9]/g, '')] = key;
  }
  return (...names) => {
    for (const n of names) {
      const k = idx[n.toLowerCase().replace(/[^a-z0-9]/g, '')];
      if (k != null && row[k] != null && String(row[k]).trim() !== '') return String(row[k]).trim();
    }
    return '';
  };
}

function parseAmount(raw) {
  const n = parseFloat(String(raw).replace(/[$,()]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function parseDate(raw) {
  if (!raw) return null;
  const m = String(raw).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  const iso = String(raw).match(/(\d{4})-(\d{2})-(\d{2})/);
  return iso ? iso[0] : null;
}

function decodeCsv(buf) {
  // TRACER exports have shipped as UTF-8 and as UTF-16LE with a BOM.
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return buf.toString('utf16le');
  return buf.toString('utf8');
}

async function loadYear(client, year) {
  console.log(`[${year}] downloading ${BULK_URL(year)}`);
  const res = await politeFetch(BULK_URL(year));
  if (res.status === 404) {
    console.warn(`[${year}] no bulk file published for this year yet, skipping`);
    return 0;
  }
  if (!res.ok) throw new Error(`TRACER download failed: HTTP ${res.status}`);
  const zip = new AdmZip(Buffer.from(await res.arrayBuffer()));
  const entry = zip.getEntries().find((e) => !e.isDirectory);
  if (!entry) throw new Error(`[${year}] zip contained no file`);
  const text = decodeCsv(entry.getData());

  // NO `trim: true` here: with trim enabled, csv-parse hard-fails on TRACER's
  // malformed rows (stray text after a closing quote, e.g. `"Smith" for
  // Colorado`) with CSV_NON_TRIMABLE_CHAR_AFTER_CLOSING_QUOTE - even with
  // relax_quotes. Without trim, relax_quotes degrades those fields to literal
  // text and properly-quoted comma fields still parse. Values are trimmed
  // in JS below instead.
  const rows = parse(text, {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
  }).map((row) => {
    for (const k of Object.keys(row)) {
      if (typeof row[k] === "string") row[k] = row[k].trim();
    }
    return row;
  });
  console.log(`[${year}] ${rows.length} raw rows`);

  let inserted = 0;
  let batch = [];
  const flush = async () => {
    if (batch.length === 0) return;
    const cols = 12;
    const values = batch
      .map((_, i) => `(${Array.from({ length: cols }, (_, j) => `$${i * cols + j + 1}`).join(',')})`)
      .join(',');
    const r = await client.query(
      `INSERT INTO tracer_contributions
         (tracer_record_id, contributor_name, contributor_normalized, contributor_type,
          contributor_city, contributor_state, committee_name, committee_type,
          candidate_name, amount, contribution_date, election_year)
       VALUES ${values}
       ON CONFLICT (tracer_record_id) DO NOTHING`,
      batch.flat()
    );
    inserted += r.rowCount;
    batch = [];
  };

  for (const row of rows) {
    const f = fieldGetter(row);
    const contributorType = f('ContributorType', 'Contributor Type');
    const firstName = f('FirstName', 'First Name');
    const lastName = f('LastName', 'Last Name', 'ContributorName', 'Contributor Name');
    if (!lastName) continue;

    // Individuals are out of scope. When the type column is blank, a present
    // first name is treated as an individual filing.
    const type = contributorType.toLowerCase();
    if (type === 'individual' || (!type && firstName)) continue;

    const contributorName = firstName ? `${firstName} ${lastName}` : lastName;
    const normalized = normalizeName(contributorName);
    if (!normalized) continue;

    const amount = parseAmount(f('ContributionAmount', 'Contribution Amount', 'Amount'));
    const date = parseDate(f('ContributionDate', 'Contribution Date'));
    let recordId = f('RecordID', 'Record ID');
    if (recordId) {
      recordId = `tracer:${recordId}`;
    } else {
      // Stable fallback so re-runs stay idempotent even without a RecordID.
      const h = createHash('sha1')
        .update([year, contributorName, f('CommitteeName', 'Committee Name'), amount, date].join('|'))
        .digest('hex')
        .slice(0, 20);
      recordId = `hash:${year}:${h}`;
    }

    batch.push([
      recordId,
      contributorName,
      normalized,
      contributorType || null,
      f('City') || null,
      (f('State') || '').slice(0, 2) || null,
      f('CommitteeName', 'Committee Name') || null,
      f('CommitteeType', 'Committee Type') || null,
      f('CandidateName', 'Candidate Name') || null,
      amount,
      date,
      Number(year),
    ]);
    if (batch.length >= 500) await flush();
  }
  await flush();
  console.log(`[${year}] inserted ${inserted} new non-individual contribution rows`);
  return inserted;
}

async function run() {
  const pool = makePool();
  const client = await pool.connect();
  let total = 0;
  try {
    for (const year of years) {
      total += await loadYear(client, year);
    }
    console.log(`Done. ${total} new rows across ${years.join(', ')}.`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('TRACER ETL failed:', err);
  process.exit(1);
});
