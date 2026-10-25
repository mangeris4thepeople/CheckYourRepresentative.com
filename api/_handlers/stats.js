// =============================================================================
// GET /api/stats - real platform stats from the database + Congress API
// Returns: { totalVotes, totalBills, totalReps, lastUpdated }
// Called by the homepage to show live numbers
// =============================================================================
import { sql, hasDb } from "../_db.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");

  try {
    let totalVotes = 0;
    let totalBills = 0;
    let totalReps = 0;

    if (hasDb) {
      try {
        const voteRow = await sql`SELECT count(*)::int AS n FROM votes WHERE quarantined = false`;
        totalVotes = voteRow[0]?.n || 0;
      } catch {}

      // Every bill tracked from Congress.gov, not just the ones that have a
      // plain language summary yet (bill_summaries is a much smaller table).
      try {
        const billRow = await sql`SELECT count(*)::int AS n FROM bills`;
        totalBills = billRow[0]?.n || 0;
      } catch {}

      try {
        const r = await sql`SELECT (SELECT count(*) FROM representatives)::int
                                 + (SELECT count(*) FROM senators)::int AS n`;
        totalReps = r[0]?.n || 0;
      } catch {}
    }

    return res.status(200).json({
      totalVotes,
      totalBills,
      totalReps,
      lastUpdated: Date.now(),
    });
  } catch (err) {
    return res.status(500).json({ error: String(err.message || err) });
  }
}
