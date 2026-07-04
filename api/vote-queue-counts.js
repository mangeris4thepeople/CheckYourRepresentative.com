// =============================================================================
// GET /api/vote-queue-counts?token=X - "X of Y active bills left to vote on"
// for the header bar on the Vote on Bills page. Real counts from the bills
// cache (synced by sync-bills.js) joined against votes, not an estimate.
// =============================================================================
import { sql, hasDb } from "./_db.js";
import { resolveEmail } from "./_auth.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");

  if (!hasDb) return res.status(500).json({ error: "no database configured" });

  try {
    const token = String(req.query.token || "").trim();
    const email = await resolveEmail(token);

    const totalRow = await sql`SELECT count(*)::int AS n FROM bills WHERE is_active`;
    const totalActive = totalRow[0]?.n || 0;

    if (!email) {
      return res.status(200).json({ signedIn: false, totalActive, votedCount: 0, notVotedCount: totalActive });
    }

    const prefix = `sess:${email}:`;
    const votedRow = await sql`
      SELECT count(*)::int AS n FROM bills b
      WHERE b.is_active
        AND EXISTS (SELECT 1 FROM votes v WHERE v.bill_id = b.id AND v.identity LIKE ${prefix + "%"})`;
    const votedCount = votedRow[0]?.n || 0;

    return res.status(200).json({
      signedIn: true,
      totalActive,
      votedCount,
      notVotedCount: Math.max(0, totalActive - votedCount),
    });
  } catch (err) {
    return res.status(500).json({ error: "counts_failed", detail: String(err.message || err) });
  }
}
