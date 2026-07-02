// POST /api/auth/send — send magic link email via Resend
// Rate-limited per IP so someone can't script up dozens of throwaway
// accounts just to get around the one-vote-per-profile rule in api/vote.js.
import { sql } from "../_db.js";
import crypto from "crypto";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const BASE_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "https://checkyourrepresentative.com";

const MAX_SIGNUP_REQUESTS_PER_IP_HR = 8; // generous — covers a whole household signing up

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { email } = req.body || {};
  if (!email || !email.includes("@")) return res.status(400).json({ error: "valid email required" });

  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket?.remoteAddress || "";

  const recent = (await sql`
    SELECT count(*)::int AS n FROM auth_requests
    WHERE ip = ${ip} AND requested_at > now() - interval '1 hour'`)[0]?.n || 0;
  if (recent >= MAX_SIGNUP_REQUESTS_PER_IP_HR) {
    return res.status(429).json({ error: "too_many_requests" });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 min

  await sql`INSERT INTO auth_requests (ip, email) VALUES (${ip}, ${email.toLowerCase()})`;

  // Upsert profile + store magic token
  await sql`
    INSERT INTO profiles (email, email_channel, unsub_token)
    VALUES (${email.toLowerCase()}, 'off', ${crypto.randomBytes(16).toString("hex")})
    ON CONFLICT (email) DO NOTHING`;

  await sql`
    INSERT INTO sessions (email, magic_token, magic_expires, session_token)
    VALUES (${email.toLowerCase()}, ${token}, ${expires}, NULL)
    ON CONFLICT (email) DO UPDATE SET
      magic_token = ${token},
      magic_expires = ${expires},
      session_token = NULL`;

  const link = `${BASE_URL}/api/auth/verify?token=${token}`;

  if (RESEND_API_KEY) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "CheckYourRepresentative <noreply@checkyourrepresentative.com>",
        to: email,
        subject: "Your sign-in link — CheckYourRepresentative.com",
        html: `
          <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#FBF7EC;border:1px solid #D8C9A0;border-radius:8px">
            <div style="text-align:center;margin-bottom:24px">
              <div style="font-size:28px;font-weight:900;color:#0A1A3F">Check Your Representative</div>
              <div style="font-size:13px;color:#5C5347;letter-spacing:1px">CIVIC ACCOUNTABILITY PLATFORM</div>
            </div>
            <p style="font-size:16px;color:#1A1A1A;line-height:1.6">
              Click the button below to sign in. This link expires in <strong>15 minutes</strong> and can only be used once.
            </p>
            <div style="text-align:center;margin:28px 0">
              <a href="${link}" style="display:inline-block;background:#8B0000;color:#fff;font-family:Georgia,serif;font-size:16px;font-weight:700;padding:14px 40px;border-radius:6px;text-decoration:none">
                Sign In to My Profile →
              </a>
            </div>
            <p style="font-size:12px;color:#5C5347;text-align:center;line-height:1.5">
              If you didn't request this, you can safely ignore this email.<br/>
              Your vote record is private unless you choose to make it public.
            </p>
            <div style="border-top:1px solid #D8C9A0;margin-top:24px;padding-top:16px;text-align:center;font-size:11px;color:#9B8C75">
              CheckYourRepresentative.com · Paid for by We The People Inc.
            </div>
          </div>`,
      }),
    });
  } else {
    // Dev fallback — log the link
    console.log("MAGIC LINK:", link);
  }

  return res.status(200).json({ ok: true, dev_link: RESEND_API_KEY ? undefined : link });
}
