/**
 * ETL: IRS Form 990 revenue via ProPublica Nonprofit Explorer -> revenue_summary
 * Source: https://projects.propublica.org/nonprofits/api/v2/organizations/{EIN}.json
 * Run: npm run etl:990
 *
 * Requires: DATABASE_URL env var. No API key needed (public).
 *
 * Depends on etl_irs_bmf having crosswalked EINs onto organizations first, since
 * this looks up revenue by EIN. Orgs without an EIN are skipped, so their
 * transparency percentage stays NULL (unknown), which is the honest result:
 * we do not fabricate a revenue figure we cannot source.
 *
 * Captures the full revenue picture from 990 Part VIII, including the aggregate
 * contributions/grants line, so the undisclosed portion can be shown honestly
 * rather than omitted.
 */
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function fetchOrg(ein) {
  const clean = String(ein).replace(/\D/g, '');
  const res = await fetch(`https://projects.propublica.org/nonprofits/api/v2/organizations/${clean}.json`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`ProPublica error ${res.status} for EIN ${ein}`);
  return res.json();
}

async function run() {
  const client = await pool.connect();
  try {
    const { rows: orgs } = await client.query('SELECT id, ein FROM organizations WHERE ein IS NOT NULL');
    let wrote = 0;
    for (const org of orgs) {
      let data;
      try { data = await fetchOrg(org.ein); }
      catch (e) { console.warn(`skip EIN ${org.ein}: ${e.message}`); continue; }
      if (!data) continue;

      for (const f of (data.filings_with_data || [])) {
        const fy = f.tax_prd_yr;
        if (!fy) continue;
        await client.query(
          `INSERT INTO revenue_summary
             (org_id, fiscal_year, total_revenue, contributions_grants_total,
              program_service_revenue, investment_income)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (org_id, fiscal_year) DO UPDATE SET
             total_revenue = EXCLUDED.total_revenue,
             contributions_grants_total = EXCLUDED.contributions_grants_total,
             program_service_revenue = EXCLUDED.program_service_revenue,
             investment_income = EXCLUDED.investment_income`,
          [org.id, fy, f.totrevenue, f.totcntrbgfts, f.totprgmrevnue, f.invstmntinc]
        );
        wrote++;
      }
      // Be polite to the public ProPublica endpoint.
      await new Promise((r) => setTimeout(r, 150));
    }
    console.log(`Done. Wrote ${wrote} revenue_summary rows from 990 filings.`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => { console.error('990 revenue ETL failed:', err); process.exit(1); });
