// =============================================================================
// GET /api/my-votes?token=X - the signed-in account's own vote history,
// paginated, most recent first. Read-only: never writes to the votes table.
//
//   GET /api/my-votes?token=X                     -> first 20, all bill types
//   GET /api/my-votes?token=X&billType=hr&offset=20 -> next batch, filtered to
//                                                       one bill type (hr, s,
//                                                       hres, sres, hjres, sjres)
// =============================================================================
import { sql, hasDb } from "../_db.js";
import { resolveEmail } from "../_auth.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  if (!hasDb) return res.status(500).json({ error: "no database configured" });

  try {
    const token = String(req.query.token || "").trim();
    const email = await resolveEmail(token);
    if (!email) return res.status(401).json({ error: "invalid or expired session" });

    const billType = String(req.query.billType || "").trim().toLowerCase();
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

    const identity = `sess:${email}:%`;
    const votes = billType
      ? await sql`
          SELECT bill_id, position, tier, district, created_at
          FROM votes
          WHERE identity LIKE ${identity} AND split_part(bill_id, '-', 1) = ${billType}
          ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`
      : await sql`
          SELECT bill_id, position, tier, district, created_at
          FROM votes WHERE identity LIKE ${identity}
          ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;

    return res.status(200).json({
      ready: true,
      votes,
      offset,
      hasMore: votes.length === limit,
      count: votes.length,
    });
  } catch (err) {
    return res.status(500).json({ error: "my_votes_failed", detail: String(err.message || err) });
  }
}
