/**
 * Computes disclosed_dollar_level and undisclosed_amount in revenue_summary
 * by summing matched funding_events per org/year against reported total revenue.
 * Run AFTER all source ETLs (usaspending, fara, fec, 990 revenue) have populated
 * their tables.
 *
 * Run: npm run compute:transparency
 *
 * Requires: DATABASE_URL env var (Neon Postgres connection string).
 */

import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      SELECT rs.id, rs.org_id, rs.fiscal_year, rs.contributions_grants_total,
             COALESCE(fe.disclosed_sum, 0) AS disclosed_sum
      FROM revenue_summary rs
      LEFT JOIN (
        SELECT org_id, fiscal_year, SUM(amount) AS disclosed_sum
        FROM funding_events
        GROUP BY org_id, fiscal_year
      ) fe ON fe.org_id = rs.org_id AND fe.fiscal_year = rs.fiscal_year
    `);

    for (const row of rows) {
      const disclosed = Math.min(row.disclosed_sum, row.contributions_grants_total || 0);
      const undisclosed = Math.max((row.contributions_grants_total || 0) - disclosed, 0);

      await client.query(
        `UPDATE revenue_summary
         SET disclosed_dollar_level = $1, undisclosed_amount = $2
         WHERE id = $3`,
        [disclosed, undisclosed, row.id]
      );
    }

    console.log(`Updated transparency figures for ${rows.length} org/year records.`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('Transparency score computation failed:', err);
  process.exit(1);
});
