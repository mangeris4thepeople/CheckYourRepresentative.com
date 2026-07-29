// =============================================================================
// POST /api/vote - record a constituent position
// -----------------------------------------------------------------------------
// Honest voting: one vote per bill, per signed-in PROFILE - not per IP.
// This lets multiple real people on the same network (household, office,
// campus wifi, apartment building) each cast their own vote, while stopping
// one person from voting twice. Voting requires a session (magic-link email
// sign-in, from api/auth/send.js + api/auth/verify.js). Anonymous votes are
// no longer accepted - that's the whole point.
//
// IP/subnet limits below are a SPAM THROTTLE only (bot floods, scripted
// account abuse) - they are not how we enforce "one vote." That job now
// belongs entirely to the account (sessions.email -> votes.identity).
// =============================================================================
import { bumpMetric } from "./metrics.js";
import { sql } from "../_db.js";

const MAX_PER_IP_HR = 20;       // spam/bot throttle, NOT a one-vote-per-network rule
const MAX_PER_SUBNET_HR = 100;  // same - many honest accounts can share a subnet
const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    const { billId, position, district, turnstileToken, honeypot, renderedAt, sessionToken } = req.body || {};
    if (!billId || !position) return reject(res, "missing_fields");
    if (honeypot) return reject(res, "honeypot_tripped");

    const elapsed = (Date.now() - Number(renderedAt || 0)) / 1000;
    if (!Number.isFinite(elapsed)) return reject(res, "too_fast");

    // ---- Must be signed in to vote. No anonymous ballots, period. ----
    if (!sessionToken) return reject(res, "signin_required");

    const sess = await sql`
      SELECT email FROM sessions
      WHERE session_token = ${sessionToken} AND session_expires > now()`;
    if (!sess.length) return reject(res, "signin_required");
    const email = sess[0].email;

    const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket?.remoteAddress || "";
    const subnet = subnetOf(ip);

    // Spam/bot throttle only - deliberately loose so shared networks aren't punished.
    const ipCount = (await sql`SELECT count(*)::int AS n FROM votes WHERE ip=${ip} AND created_at > now() - interval '1 hour'`)[0].n;
    if (ipCount >= MAX_PER_IP_HR) return reject(res, "rate_ip");
    const subCount = (await sql`SELECT count(*)::int AS n FROM votes WHERE subnet=${subnet} AND created_at > now() - interval '1 hour'`)[0].n;
    if (subCount >= MAX_PER_SUBNET_HR) return reject(res, "rate_subnet");

    if (TURNSTILE_SECRET) {
      const ok = await verifyTurnstile(turnstileToken, ip);
      if (!ok) return reject(res, "turnstile_failed");
    }

    // verified vs open: does the connection place in the district's state?
    // (Kept as a signal, not a gate - accounts are the real gate now.)
    const tier = await geoTier(ip, district);

    const identity = `sess:${email}:${billId}`;

    // One vote per profile per bill. No overwriting, no re-voting from the
    // same account, no re-voting from a new IP either - the account is the key.
    const inserted = await sql`
      INSERT INTO votes (bill_id, identity, district, position, tier, ip, subnet)
      VALUES (${billId}, ${identity}, ${district || null}, ${position}, ${tier}, ${ip}, ${subnet})
      ON CONFLICT (bill_id, identity) DO NOTHING
      RETURNING id`;

    if (!inserted.length) {
      const existing = await sql`
        SELECT position FROM votes WHERE bill_id=${billId} AND identity=${identity} LIMIT 1`;
      return res.status(200).json({ status: "already_voted", position: existing[0]?.position });
    }

    await bumpMetric("vote_cast");
    return res.status(200).json({ status: "counted", tier });
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
