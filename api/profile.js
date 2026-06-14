// =============================================================================
// /api/profile  —  consent-based constituent profiles (persisted, email-keyed)
//   POST  /api/profile                 body: { consent:true, email, district, location, topics, wantsEmail }
//   GET   /api/profile?action=confirm&token=...
//   GET   /api/profile?action=unsubscribe&token=...
// Email is double opt-in: starts 'pending', becomes 'on' only after confirm.
// (Sending the confirmation email itself is the next piece — see /api/digest
//  + an email provider. This endpoint stores everything and issues the tokens.)
// =============================================================================
import { sql } from "./_db.js";
import crypto from "crypto";

const CONSENT_VERSION = "2026-06-13";
const token = () => crypto.randomBytes(24).toString("base64url");

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const { action, token: tok } = req.query;
      if (action === "confirm") {
        const r = await sql`UPDATE profiles SET email_channel='on', confirm_token=NULL WHERE confirm_token=${tok} RETURNING id`;
        return res.status(200).json({ ok: r.length > 0 });
      }
      if (action === "unsubscribe") {
        const r = await sql`UPDATE profiles SET email_channel='off' WHERE unsub_token=${tok} RETURNING id`;
        return res.status(200).json({ ok: r.length > 0 });
      }
      return res.status(400).json({ error: "unknown action" });
    }

    if (req.method === "POST") {
      const { consent, email, district, location, topics, wantsEmail } = req.body || {};
      if (consent !== true) return res.status(400).json({ error: "explicit consent required" });

      const confirmToken = wantsEmail && email ? token() : null;
      const unsubToken = token();
      const channel = wantsEmail && email ? "pending" : "off";

      // upsert by email (or insert anonymous dashboard-only profile with no email)
      const rows = await sql`
        INSERT INTO profiles (email, district, location, topics, consent_version, consent_at, email_channel, confirm_token, unsub_token)
        VALUES (${email || null}, ${district || null}, ${JSON.stringify(location || null)}, ${JSON.stringify(topics || [])},
                ${CONSENT_VERSION}, now(), ${channel}, ${confirmToken}, ${unsubToken})
        ON CONFLICT (email) DO UPDATE SET
          district = EXCLUDED.district, location = EXCLUDED.location, topics = EXCLUDED.topics,
          consent_version = EXCLUDED.consent_version, consent_at = now(),
          email_channel = EXCLUDED.email_channel, confirm_token = EXCLUDED.confirm_token
        RETURNING id, unsub_token`;

      return res.status(200).json({ ok: true, profileId: rows[0]?.id, confirmToken });
    }

    return res.status(405).json({ error: "method not allowed" });
  } catch (err) {
    return res.status(500).json({ error: String(err.message || err) });
  }
}
