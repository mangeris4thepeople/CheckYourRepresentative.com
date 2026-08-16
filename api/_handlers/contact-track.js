// =============================================================================
// POST /api/contact-track - record that a constituent clicked Contact My Rep
// Called automatically when ContactRep component is opened after voting.
// -----------------------------------------------------------------------------
// The accountability matrix and the daily district report both treat these
// rows as "a real constituent contacted their representative", so this
// endpoint must not accept a client-supplied identity: the caller must be
// signed in, and the identity is derived server-side from their session -
// exactly the way /api/vote derives it. Rows are deduped per (bill, identity).
// =============================================================================
import { sql } from "../_db.js";
import { resolveEmail } from "../_auth.js";

const MAX_PER_IP_HR = 30; // spam throttle only

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    const { billId, district, position, sessionToken } = req.body || {};
    if (!billId || !district) return res.status(400).json({ error: "missing fields" });

    // Identity comes from the session, never from the client.
    const email = await resolveEmail(sessionToken);
    if (!email) return res.status(401).json({ error: "signin_required" });
    const identity = `sess:${email}:${billId}`;

    const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket?.remoteAddress || "";

    // Self-healing schema: older databases lack the ip column.
    await sql`ALTER TABLE contact_actions ADD COLUMN IF NOT EXISTS ip TEXT`;

    const ipCount = (await sql`
      SELECT count(*)::int AS n FROM contact_actions
      WHERE ip = ${ip} AND contacted_at > now() - interval '1 hour'`)[0].n;
    if (ipCount >= MAX_PER_IP_HR) return res.status(429).json({ error: "rate_limited" });

    // Dedup per (bill, identity) without relying on a unique constraint that
    // pre-existing production rows might violate (schema_contact_actions.sql
    // adds the real constraint after cleaning up).
    await sql`
      INSERT INTO contact_actions (bill_id, district, position, identity, ip)
      SELECT ${billId}, ${district}, ${position || null}, ${identity}, ${ip}
      WHERE NOT EXISTS (
        SELECT 1 FROM contact_actions
        WHERE bill_id = ${billId} AND identity = ${identity})
    `;
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("contact-track:", err);
    return res.status(500).json({ error: "internal_error" });
  }
}
