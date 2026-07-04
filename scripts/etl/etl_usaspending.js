/**
 * ETL: USASpending.gov federal awards -> organizations + funding_events
 * Source: https://api.usaspending.gov/api/v2/search/spending_by_award/
 * Run: npm run etl:usaspending -- --fy 2026
 *
 * No API key required (USASpending.gov is fully open).
 * Requires: DATABASE_URL env var (Neon Postgres connection string).
 */

import pg from 'pg';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: { fy: { type: 'string', default: String(new Date().getFullYear()) } }
});
const FISCAL_YEAR = parseInt(values.fy, 10);

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const NONPROFIT_RECIPIENT_TYPES = [
  'nonprofit_organization',
  'nonprofit_with_501c3',
  'nonprofit_without_501c3'
];

async function fetchAwardsPage(page) {
  const res = await fetch('https://api.usaspending.gov/api/v2/search/spending_by_award/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filters: {
        award_type_codes: ['02', '03', '04', '05'], // grants + cooperative agreements
        recipient_type_names: NONPROFIT_RECIPIENT_TYPES,
        time_period: [{ start_date: `${FISCAL_YEAR - 1}-10-01`, end_date: `${FISCAL_YEAR}-09-30` }]
      },
      fields: [
        'Award ID', 'Recipient Name', 'Recipient UEI', 'Awarding Agency',
        'Awarding Sub Agency', 'Award Amount', 'Description', 'Start Date',
        'End Date', 'Assistance Listings', 'Place of Performance State Code'
      ],
      page,
      limit: 100,
      sort: 'Award Amount',
      order: 'desc'
    })
  });
  if (!res.ok) throw new Error(`USASpending API error: ${res.status}`);
  return res.json();
}

async function upsertOrg(client, uei, name) {
  const { rows } = await client.query(
    `INSERT INTO organizations (uei, name)
     VALUES ($1, $2)
     ON CONFLICT (uei) DO UPDATE SET name = EXCLUDED.name, updated_at = now()
     RETURNING id`,
    [uei, name]
  );
  return rows[0].id;
}

async function insertFundingEvent(client, orgId, award) {
  await client.query(
    `INSERT INTO funding_events
       (org_id, source_type, source_name, external_ref_id, amount, description,
        period_start, period_end, fiscal_year, disclosure_source)
     VALUES ($1, 'federal_award', $2, $3, $4, $5, $6, $7, $8, 'usaspending')
     ON CONFLICT (external_ref_id) DO NOTHING`,
    [
      orgId,
      `${award['Awarding Agency']} / ${award['Awarding Sub Agency'] || ''}`,
      award['Award ID'],
      award['Award Amount'],
      award['Description'],
      award['Start Date'],
      award['End Date'],
      FISCAL_YEAR
    ]
  );
}

async function run() {
  const client = await pool.connect();
  try {
    let page = 1;
    let hasNext = true;
    let count = 0;

    while (hasNext) {
      const data = await fetchAwardsPage(page);
      for (const award of data.results) {
        if (!award['Recipient UEI']) continue;
        const orgId = await upsertOrg(client, award['Recipient UEI'], award['Recipient Name']);
        await insertFundingEvent(client, orgId, award);
        count++;
      }
      hasNext = data.page_metadata?.hasNext ?? false;
      page++;
      console.log(`Processed page ${page - 1}, running total: ${count} awards`);
    }

    console.log(`Done. Inserted/updated ${count} federal award records for FY${FISCAL_YEAR}.`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('ETL failed:', err);
  process.exit(1);
});
