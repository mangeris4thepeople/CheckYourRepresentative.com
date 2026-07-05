/**
 * ETL: FEC committee disbursements (Schedule B) -> organizations + funding_events
 * Source: https://api.open.fec.gov/v1/schedules/schedule_b/
 * Run: npm run etl:fec -- --fy 2026
 *
 * Requires: DATABASE_URL and FEC_API_KEY env vars.
 *
 * KNOWN LIMITATION (do not silently paper over): FEC disbursement records carry
 * no EIN or UEI for the recipient, only a name. Organizations are matched and
 * created by recipient name only, so the same organization can appear under
 * name variants as duplicate rows. Deduplicating those is a v2 fuzzy-matching
 * task, not something this script hides.
 *
 * Schedule B also contains every kind of committee disbursement (operating
 * costs, salaries, transfers), not only grants to nonprofits. This v1 applies a
 * minimum-amount filter and a page cap to stay bounded. Classifying a recipient
 * as a nonprofit versus a vendor is a v2 improvement.
 */
import pg from 'pg';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: { fy: { type: 'string', default: String(new Date().getFullYear()) } } });
const FISCAL_YEAR = parseInt(values.fy, 10);
// FEC groups filings into two-year transaction periods that end in even years.
const TWO_YEAR_PERIOD = FISCAL_YEAR % 2 === 0 ? FISCAL_YEAR : FISCAL_YEAR + 1;

const FEC_API_KEY = process.env.FEC_API_KEY;
// Verified live: schedule_b with a broad two-year period and a low minimum
// amount is an expensive sort for FEC's backend, 70 to 90 seconds per page at
// min_amount 5000 or 100000. At 1,000,000 the same query returns in about 2
// seconds. This keeps the run fast and still surfaces the largest, most
// consequential disbursements. Lowering it further is a v2 tradeoff against
// runtime, best done with keyset pagination (see MAX_PAGES note) rather than
// just raising the page cap on this offset-based endpoint.
const MIN_AMOUNT = 1000000;
const PER_PAGE = 100;
const MAX_PAGES = 200;     // the page-based API caps out; deep history needs keyset paging (v2)

if (!FEC_API_KEY) { console.error('FEC_API_KEY is not set'); process.exit(1); }
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function fetchPage(page) {
  const url = new URL('https://api.open.fec.gov/v1/schedules/schedule_b/');
  url.searchParams.set('api_key', FEC_API_KEY);
  url.searchParams.set('two_year_transaction_period', String(TWO_YEAR_PERIOD));
  url.searchParams.set('min_amount', String(MIN_AMOUNT));
  url.searchParams.set('per_page', String(PER_PAGE));
  url.searchParams.set('page', String(page));
  url.searchParams.set('sort', '-disbursement_amount');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FEC API error: ${res.status}`);
  return res.json();
}

// No EIN/UEI is available from FEC, so we can only match on name.
async function upsertOrgByName(client, name, state) {
  const found = await client.query('SELECT id FROM organizations WHERE lower(name) = lower($1) LIMIT 1', [name]);
  if (found.rows.length) return found.rows[0].id;
  const ins = await client.query('INSERT INTO organizations (name, state) VALUES ($1, $2) RETURNING id', [name, state || null]);
  return ins.rows[0].id;
}

async function insertEvent(client, orgId, d) {
  const ref = d.sub_id || d.transaction_id;
  if (!ref) return;
  await client.query(
    `INSERT INTO funding_events
       (org_id, source_type, source_name, external_ref_id, amount, description,
        period_start, period_end, fiscal_year, disclosure_source)
     VALUES ($1, 'pac_contribution', $2, $3, $4, $5, $6, $6, $7, 'fec')
     ON CONFLICT (external_ref_id) DO NOTHING`,
    [
      orgId,
      // Verified live: the nested committee object is frequently null on this
      // endpoint even though committee_id is always present, so fall back to
      // the id rather than a placeholder string that would hide which
      // committee actually made the disbursement.
      (d.committee && d.committee.name) || d.committee_name || (d.committee_id ? `Committee ${d.committee_id}` : 'Unknown committee'),
      String(ref),
      d.disbursement_amount,
      d.disbursement_description || null,
      d.disbursement_date || null,
      FISCAL_YEAR,
    ]
  );
}

async function run() {
  const client = await pool.connect();
  try {
    let page = 1, count = 0;
    while (page <= MAX_PAGES) {
      const data = await fetchPage(page);
      const results = data.results || [];
      if (!results.length) break;
      for (const d of results) {
        if (!d.recipient_name) continue;
        const orgId = await upsertOrgByName(client, d.recipient_name, d.recipient_state);
        await insertEvent(client, orgId, d);
        count++;
      }
      const pages = (data.pagination && data.pagination.pages) || 0;
      console.log(`FEC page ${page} of ${pages}, running total ${count}`);
      if (page >= pages) break;
      page++;
    }
    console.log(`Done. Inserted/updated ${count} FEC disbursement records for FY${FISCAL_YEAR}.`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => { console.error('FEC ETL failed:', err); process.exit(1); });
