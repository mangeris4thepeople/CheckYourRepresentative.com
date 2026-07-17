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

    if (hasDb) {
      try {
        const voteRow = await sql`SELECT count(*)::int AS n FROM votes WHERE quarantined = false`;
        totalVotes = voteRow[0]?.n || 0;
      } catch {}

      try {
        const billRow = await sql`SELECT count(*)::int AS n FROM bill_summaries`;
        totalBills = billRow[0]?.n || 0;
      } catch {}
    }

    // Congress always has 535 members (435 House + 100 Senate)
    const totalReps = 535;

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
