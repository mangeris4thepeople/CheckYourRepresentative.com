// =============================================================================
// GET /api/vote-status?billId=X&token=Y — has THIS SIGNED-IN PROFILE already
// voted on this bill? Checked by account (session token), not IP — so the
// frontend can lock the ballot per-person without punishing shared networks.
// =============================================================================
import { sql } from "./_db.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");

  try {
    const { billId, token } = req.query;
    if (!billId) return res.status(400).json({ error: "missing_billId" });
    if (!token) return res.status(200).json({ voted: false, signedIn: false });

    const sess = await sql`
      SELECT email FROM sessions
      WHERE session_token = ${token} AND session_expires > now()`;
    if (!sess.length) return res.status(200).json({ voted: false, signedIn: false });

    const identity = `sess:${sess[0].email}:${billId}`;
    const rows = await sql`SELECT position FROM votes WHERE bill_id=${billId} AND identity=${identity} LIMIT 1`;

    if (rows.length) {
      return res.status(200).json({ voted: true, signedIn: true, position: rows[0].position });
    }
    return res.status(200).json({ voted: false, signedIn: true });
  } catch (err) {
    return res.status(500).json({ error: String(err.message || err) });
  }
}
