// =============================================================================
// POST /api/contact-track - record that a constituent clicked Contact My Rep
// Called automatically when ContactRep component is opened after voting
// =============================================================================
import { sql } from "../_db.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    const { billId, district, position, identity } = req.body || {};
    if (!billId || !district) return res.status(400).json({ error: "missing fields" });

    await sql`
      INSERT INTO contact_actions (bill_id, district, position, identity)
      VALUES (${billId}, ${district}, ${position || null}, ${identity || null})
      ON CONFLICT DO NOTHING
    `;
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: String(err.message || err) });
  }
}
