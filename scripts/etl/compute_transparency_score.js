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

// PERFORMANCE FIX (verified necessary, not theoretical): this used to issue
// one UPDATE per revenue_summary row. At the scale this project actually
// loads (tens of thousands of org/year records once every source ETL has
// run), that was tens of thousands of sequential round trips to Neon. This
// batches every row into one bulk UPDATE ... FROM unnest(...) statement,
// which is the same pattern already used elsewhere in this codebase for
// bulk writes (see scripts/etl's upsert helpers).
async function run() {
  const client = await connectWithRetry();
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

    if (rows.length) {
      const ids = [], disclosedVals = [], undisclosedVals = [];
      for (const row of rows) {
        const disclosed = Math.min(Number(row.disclosed_sum) || 0, Number(row.contributions_grants_total) || 0);
        const undisclosed = Math.max((Number(row.contributions_grants_total) || 0) - disclosed, 0);
        ids.push(row.id);
        disclosedVals.push(disclosed);
        undisclosedVals.push(undisclosed);
      }
      const BATCH = 2000;
      for (let i = 0; i < ids.length; i += BATCH) {
        await client.query(
          `UPDATE revenue_summary rs
             SET disclosed_dollar_level = u.disclosed,
                 undisclosed_amount = u.undisclosed
           FROM unnest($1::int[], $2::numeric[], $3::numeric[]) AS u(id, disclosed, undisclosed)
           WHERE rs.id = u.id`,
          [ids.slice(i, i + BATCH), disclosedVals.slice(i, i + BATCH), undisclosedVals.slice(i, i + BATCH)]
        );
      }
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
