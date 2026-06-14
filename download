// =============================================================================
// GET /api/tally?billId=...  —  two-tier tally from the persisted votes
// =============================================================================
import { sql } from "./_db.js";

export default async function handler(req, res) {
  try {
    const billId = req.query.billId;
    if (!billId) return res.status(400).json({ error: "missing billId" });

    const rows = await sql`
      SELECT tier, quarantined, position, count(*)::int AS n
      FROM votes WHERE bill_id = ${billId}
      GROUP BY tier, quarantined, position`;

    const t = { verified: {}, open: {}, quarantined: {}, counts: { verified: 0, open: 0, quarantined: 0 } };
    for (const r of rows) {
      const bucket = r.quarantined ? "quarantined" : r.tier;
      t[bucket][r.position] = (t[bucket][r.position] || 0) + r.n;
      t.counts[bucket] += r.n;
    }
    const sampleSize = t.counts.verified + t.counts.open;
    return res.status(200).json({
      ...t, sampleSize,
      qualityScore: sampleSize ? t.counts.verified / sampleSize : 0,
    });
  } catch (err) {
    return res.status(500).json({ error: String(err.message || err) });
  }
}
