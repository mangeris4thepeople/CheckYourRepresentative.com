// GET /api/auth/verify?token=xxx - verify magic link, issue session, redirect
import { sql } from "../_db.js";
import { bumpMetric } from "./metrics.js";
import crypto from "crypto";

const SITE_URL = process.env.SITE_URL || "https://checkyourrepresentative.com";

export default async function handler(req, res) {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).send("Missing token");

    const rows = await sql`
      SELECT email, magic_expires FROM sessions
      WHERE magic_token = ${token} AND magic_expires > now()`;

    if (!rows.length) {
      return res.status(400).send(`
        <html><body style="font-family:Georgia,serif;text-align:center;padding:60px">
          <h2 style="color:#8B0000">Link expired or already used</h2>
          <p>Magic links expire after 15 minutes and can only be used once.</p>
          <a href="${SITE_URL}" style="color:#0A1A3F;font-weight:700">
            ← Back to CheckYourRepresentative.com
          </a>
        </body></html>`);
    }

    const { email } = rows[0];
    const sessionToken = crypto.randomBytes(32).toString("hex");
    const sessionExpires = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days

    await sql`
      UPDATE sessions SET
        magic_token = NULL,
        magic_expires = NULL,
        session_token = ${sessionToken},
        session_expires = ${sessionExpires}
      WHERE email = ${email}`;

    await bumpMetric("signin_complete");

    // Redirect to app with session token in URL fragment (never hits server logs)
    return res.redirect(302,
      `${SITE_URL}/#session=${sessionToken}&email=${encodeURIComponent(email)}`);
  } catch (err) {
    // Without this catch a DB hiccup surfaced as an opaque platform 500 and a
    // dead magic link. Give the person a way back instead.
    console.error("auth-verify:", err);
    return res.status(500).send(`
      <html><body style="font-family:Georgia,serif;text-align:center;padding:60px">
        <h2 style="color:#8B0000">Something went wrong on our end</h2>
        <p>Your sign-in link is fine - please try clicking it again in a moment.</p>
        <a href="${SITE_URL}" style="color:#0A1A3F;font-weight:700">
          ← Back to CheckYourRepresentative.com
        </a>
      </body></html>`);
  }
}
