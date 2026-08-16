// =============================================================================
// POST /api/contact-us - general site contact form (Name, Email, Comment).
//
// This is site feedback and questions, separate from /api/contact which
// messages a constituent's members of Congress. Submissions are emailed to
// info@checkyourrepresentative.com, the inbox that already receives site mail,
// with the sender's address set as reply-to so replies go straight back.
// =============================================================================
import { sql, hasDb } from "../_db.js";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const TO = "info@checkyourrepresentative.com";
const MAX_PER_IP_HR = 5; // an outbound email per request deserves a real throttle

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "POST only" });

  try {
    const { name, email, comment, website } = req.body || {};

    // Honeypot: real users never fill this hidden field.
    if (website) return res.status(200).json({ ok: true });

    // Rate limit per IP - this endpoint sends real email, so a honeypot alone
    // is not enough (a script that omits the field would flood the inbox).
    const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket?.remoteAddress || "";
    if (hasDb && ip) {
      try {
        await sql`CREATE TABLE IF NOT EXISTS contact_us_log (
          ip TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
        const n = (await sql`
          SELECT count(*)::int AS n FROM contact_us_log
          WHERE ip = ${ip} AND created_at > now() - interval '1 hour'`)[0].n;
        if (n >= MAX_PER_IP_HR) {
          return res.status(429).json({ ok: false, error: "Too many messages - please try again in an hour." });
        }
        await sql`INSERT INTO contact_us_log (ip) VALUES (${ip})`;
      } catch { /* throttle is best-effort; never block a real message on it */ }
    }

    if (!name || !String(name).trim()) return res.status(400).json({ ok: false, error: "Please enter your name." });
    if (!email || !String(email).includes("@")) return res.status(400).json({ ok: false, error: "Please enter a valid email." });
    if (!comment || !String(comment).trim()) return res.status(400).json({ ok: false, error: "Please enter a comment." });

    const nm = String(name).trim().slice(0, 200);
    const em = String(email).trim().slice(0, 200);
    const cm = String(comment).trim().slice(0, 5000);

    if (!RESEND_API_KEY) {
      // No email provider configured. Log it and be honest rather than pretend.
      console.log("CONTACT US (no RESEND_API_KEY, not sent):", { name: nm, email: em, comment: cm });
      return res.status(200).json({ ok: true, sent: false });
    }

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "CheckYourRepresentative <noreply@checkyourrepresentative.com>",
        to: [TO],
        reply_to: em,
        subject: `Site contact from ${nm}`,
        text: `New message from the site Contact Us form.\n\nName: ${nm}\nEmail: ${em}\n\nComment:\n${cm}`,
      }),
    });

    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      console.error("contact-us resend failed:", r.status, detail);
      return res.status(502).json({ ok: false, error: "Could not send your message right now. Please try again shortly." });
    }

    return res.status(200).json({ ok: true, sent: true });
  } catch (err) {
    console.error("contact-us fatal:", err);
    return res.status(500).json({ ok: false, error: String(err.message || err) });
  }
}
