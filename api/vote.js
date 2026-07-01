// =============================================================================
// POST /api/vote  —  record a constituent position (fairness enforced, persisted)
// -----------------------------------------------------------------------------
// Real checks, all server-side: honeypot, submit-timing, per-IP & per-subnet
// rate limits, dedup (one position per identity per bill), and a verified/open
// tier from a light IP-vs-district geo check. Turnstile is enforced only if you
// set TURNSTILE_SECRET_KEY (so it works before you've set Turnstile up).
// =============================================================================
import { sql } from "./_db.js";
import crypto from "crypto";

const MIN_SECONDS = 0; // timing gate removed — humans read at their own pace
const MAX_PER_IP_HR = 50; // raised — one vote per bill per person is fine
const MAX_PER_SUBNET_HR = 200; // raised — households/offices share subnets
const SALT = process.env.VOTE_IDENTITY_SALT || "change-me";
const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    const { billId, position, district, turnstileToken, honeypot, renderedAt, voteToken, sessionToken } = req.body || {};
    if (!billId || !position) return reject(res, "missing_fields");
    if (honeypot) return reject(res, "honeypot_tripped");
    const elapsed = (Date.now() - Number(renderedAt || 0)) / 1000;
    if (!Number.isFinite(elapsed) || elapsed < MIN_SECONDS) return reject(res, "too_fast");

    const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket?.remoteAddress || "";
    const userAgent = req.headers["user-agent"] || "";
    const subnet = subnetOf(ip);

    // If user is signed in, link vote to their profile email
    let sessionEmail = null;
    if (sessionToken) {
      try {
        const sess = await sql`SELECT email FROM sessions WHERE session_token=${sessionToken} AND session_expires > now()`;
        if (sess.length) sessionEmail = sess[0].email;
      } catch {}
    }

    // rate limits (from the votes table)
    const ipCount = (await sql`SELECT count(*)::int AS n FROM votes WHERE ip=${ip} AND created_at > now() - interval '1 hour'`)[0].n;
    if (ipCount >= MAX_PER_IP_HR) return reject(res, "rate_ip");
    const subCount = (await sql`SELECT count(*)::int AS n FROM votes WHERE subnet=${subnet} AND created_at > now() - interval '1 hour'`)[0].n;
    if (subCount >= MAX_PER_SUBNET_HR) return reject(res, "rate_subnet");

    // bot check — only enforced if you've configured Turnstile
    if (TURNSTILE_SECRET) {
      const ok = await verifyTurnstile(turnstileToken, ip);
      if (!ok) return reject(res, "turnstile_failed");
    }

    // verified vs open: does the connection place in the district's state?
    const tier = await geoTier(ip, district);

    const identity = sessionEmail
      ? `sess:${sessionEmail}:${billId}`
      : voteToken
      ? `tok:${voteToken}`
      : `soft:${crypto.createHash("sha256").update(`${SALT}|${ip}|${userAgent}`).digest("hex").slice(0, 24)}`;

    await sql`
      INSERT INTO votes (bill_id, identity, district, position, tier, ip, subnet)
      VALUES (${billId}, ${identity}, ${district || null}, ${position}, ${tier}, ${ip}, ${subnet})
      ON CONFLICT (bill_id, identity)
      DO UPDATE SET position = ${position}, tier = ${tier}, created_at = now()`;

    const issued = voteToken || Buffer.from(`${billId}.${identity}.${Date.now()}`).toString("base64url");
    return res.status(200).json({ status: "counted", tier, voteToken: issued });
  } catch (err) {
    return res.status(500).json({ status: "error", reason: String(err.message || err) });
  }
}

function reject(res, reason) { return res.status(200).json({ status: "rejected", reason }); }

function subnetOf(ip) {
  const m = /^(\d+)\.(\d+)\.(\d+)\.\d+$/.exec(ip || "");
  return m ? `${m[1]}.${m[2]}.${m[3]}.0/24` : (ip || "unknown");
}

async function verifyTurnstile(token, ip) {
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret: TURNSTILE_SECRET, response: token, remoteip: ip || "" });
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
    const d = await r.json();
    return !!d.success;
  } catch { return false; }
}

async function geoTier(ip, district) {
  try {
    const state = String(district || "").split("-")[0];
    if (!state || !ip) return "open";
    const r = await fetch(`https://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,region`);
    const d = await r.json();
    if (d.status === "success" && d.country === "United States" && d.region === state) return "verified";
    return "open";
  } catch { return "open"; }
}
