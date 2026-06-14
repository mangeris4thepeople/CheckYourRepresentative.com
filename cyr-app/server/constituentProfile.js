// =============================================================================
// Check Your Representative — Constituent Profile & Digest pipeline (server)
// -----------------------------------------------------------------------------
// CONSENT-BASED model: a profile exists only because a signed-in person opted
// in. Email delivery additionally requires double opt-in. Nothing is ever sent
// without an explicit user action + a working unsubscribe. Store only what the
// digest needs (data minimization).
//
// Flow:
//   createProfile() ──▶ assignBills() ──▶ summarizeBill() [cached, once/bill]
//                                   └──▶ buildDigest() ──▶ composeEmail()/dashboard
//
// External services (your existing keys):
//   - Congress.gov API v3   (CONGRESS_API_KEY)  — bill data, 119th Congress
//   - Anthropic Messages API (ANTHROPIC_API_KEY) — plain-language summaries
//
// `store` is your DB behind a small interface (reference impl at the bottom).
// =============================================================================

const CONGRESS_API_KEY = process.env.CONGRESS_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const SUMMARY_MODEL = process.env.SUMMARY_MODEL || "claude-sonnet-4-6";
const CONSENT_VERSION = "2026-06-13"; // bump when your consent language changes
const CONGRESS = 119;
const crypto = require("crypto");

// -----------------------------------------------------------------------------
// 1. PROFILE — created only on explicit opt-in. Email starts PENDING until the
//    user confirms via a token (double opt-in), per CAN-SPAM good practice.
// -----------------------------------------------------------------------------
async function createProfile(store, { userId, location, district, reps, topics, email, wantsEmail, ip }) {
  if (!userId) throw new Error("auth required: no userId");
  if (!consentGiven(arguments[1])) throw new Error("explicit consent required");

  const profile = {
    userId,
    location,                    // { state, county, city, zip } from the map flow
    district,                    // e.g. "CO-02"
    reps: reps || [],            // [{ name, bioguideId }]
    topics: topics || [],        // Congress.gov policy-area names the user chose
    consent: { version: CONSENT_VERSION, at: Date.now(), ip },
    channels: {
      dashboard: true,                                   // always on for a signed-in opt-in
      email: wantsEmail ? "pending" : "off",             // pending until confirmed
    },
    email: wantsEmail ? email : null,
    emailConfirmToken: wantsEmail ? token() : null,
    unsubToken: token(),
    assignedBillIds: [],
    createdAt: Date.now(),
  };
  await store.saveProfile(profile);
  // NOTE: send the confirm link yourself via your ESP — we never auto-send.
  return { profile, confirmToken: profile.emailConfirmToken };
}

function consentGiven(input) { return input && input.consent === true; }

async function confirmEmail(store, token) {
  const p = await store.findProfileByConfirmToken(token);
  if (!p) return { ok: false };
  p.channels.email = "on"; p.emailConfirmToken = null;
  await store.saveProfile(p);
  return { ok: true };
}

async function unsubscribe(store, token) {
  const p = await store.findProfileByUnsubToken(token);
  if (!p) return { ok: false };
  p.channels.email = "off";
  await store.saveProfile(p);
  return { ok: true };
}

// -----------------------------------------------------------------------------
// 2. BILL ASSIGNMENT — relevant active legislation for this constituent.
//    Two sources:
//      (a) their own reps' sponsored/cosponsored bills (clean member endpoints)
//      (b) recently-active bills whose policy area matches their chosen topics
//    NOTE: the Congress.gov API has no topic-search parameter, so (b) is a
//    bounded scan over recently-updated bills, filtered server-side by
//    policyArea — same pattern as the floor-action parsing. Cache to respect
//    the 5,000 req/hr limit.
// -----------------------------------------------------------------------------
async function assignBills(store, profile, { scanLimit = 60 } = {}) {
  const found = new Map(); // billId -> ref

  // (a) rep-sponsored / cosponsored
  for (const rep of profile.reps) {
    if (!rep.bioguideId) continue;
    for (const kind of ["sponsored-legislation", "cosponsored-legislation"]) {
      const data = await cg(`/member/${rep.bioguideId}/${kind}`, { limit: 20 });
      const list = data?.[camel(kind)] || data?.sponsoredLegislation || data?.cosponsoredLegislation || [];
      for (const b of list) {
        if (!b.type || !b.number) continue;
        const id = billId(b.type, b.number);
        found.set(id, { id, type: b.type.toLowerCase(), number: b.number, title: b.title, reason: `via ${rep.name}` });
      }
    }
  }

  // (b) topic match over recently-updated bills
  if (profile.topics.length) {
    const recent = await cg(`/bill/${CONGRESS}`, { limit: scanLimit, sort: "updateDate+desc" });
    for (const b of (recent?.bills || [])) {
      if (!b.type || !b.number) continue;
      const id = billId(b.type, b.number);
      if (found.has(id)) continue;
      const area = b.policyArea?.name;
      if (area && profile.topics.includes(area)) {
        found.set(id, { id, type: b.type.toLowerCase(), number: b.number, title: b.title, reason: `topic: ${area}` });
      }
    }
  }

  const refs = [...found.values()];
  profile.assignedBillIds = refs.map(r => r.id);
  await store.saveProfile(profile);
  await store.saveBillRefs(refs); // keep the {id,type,number,title,reason} for digest building
  return refs;
}

// -----------------------------------------------------------------------------
// 3. SUMMARIZE — ONCE PER BILL, cached and shared across every constituent it's
//    assigned to. Re-summarize only if the bill's latest action changed.
//    Summaries are factual and non-partisan: explain what it does, who it
//    affects, and its status — never how to vote.
// -----------------------------------------------------------------------------
async function summarizeBill(store, ref) {
  const detail = await cg(`/bill/${CONGRESS}/${ref.type}/${ref.number}`);
  const bill = detail?.bill || {};
  const latestActionDate = bill.latestAction?.actionDate || "";
  const cacheKey = `${ref.id}:${latestActionDate}`;

  const cached = await store.getCachedSummary(cacheKey);
  if (cached) return cached;

  // pull the official summary text if present
  const sums = await cg(`/bill/${CONGRESS}/${ref.type}/${ref.number}/summaries`);
  const officialText = sums?.summaries?.slice(-1)[0]?.text || "(no official summary published yet)";

  const prompt =
`You are a neutral civic explainer for a U.S. voter education tool. In plain language a busy adult can read in 30 seconds, summarize this bill. Be factual and non-partisan. Do NOT tell the reader how to vote or whether the bill is good or bad.

Return JSON only:
{"headline": string (max 12 words),
 "plain": string (2-3 sentences: what it would do),
 "affects": string (1 sentence: who is most affected),
 "status": string (1 short phrase: where it is in the process)}

BILL: ${bill.title || ref.title}
POLICY AREA: ${bill.policyArea?.name || "n/a"}
LATEST ACTION: ${bill.latestAction?.text || "n/a"}
OFFICIAL SUMMARY: ${stripHtml(officialText).slice(0, 4000)}`;

  const out = await anthropic(prompt);
  let parsed;
  try { parsed = JSON.parse(stripFences(out)); }
  catch { parsed = { headline: bill.title || ref.title, plain: stripHtml(officialText).slice(0, 280), affects: "", status: bill.latestAction?.text || "" }; }

  const summary = { billId: ref.id, ...parsed, latestActionDate, generatedAt: Date.now() };
  await store.setCachedSummary(cacheKey, summary);
  return summary;
}

// -----------------------------------------------------------------------------
// 4. DIGEST — assemble this constituent's bills from the SHARED summary cache.
// -----------------------------------------------------------------------------
async function buildDigest(store, profile) {
  const refs = await store.getBillRefs(profile.assignedBillIds);
  const items = [];
  for (const ref of refs) {
    const summary = await summarizeBill(store, ref); // cached after first constituent
    items.push({ ...ref, summary });
  }
  return {
    district: profile.district,
    location: profile.location,
    generatedAt: Date.now(),
    items,
  };
}

// -----------------------------------------------------------------------------
// 5. DISTRIBUTION — compose only. We DO NOT SEND. Hand the composed message to
//    your ESP behind an explicit user/admin action. Email opt-in must be "on"
//    and every message carries an unsubscribe link + physical address (CAN-SPAM).
// -----------------------------------------------------------------------------
function composeEmail(profile, digest, { siteUrl, mailingAddress }) {
  if (profile.channels.email !== "on") return { skip: true, reason: "email not confirmed/opted-in" };
  const unsub = `${siteUrl}/unsubscribe?token=${profile.unsubToken}`;
  const rows = digest.items.map(it => `
    <tr><td style="padding:12px 0;border-bottom:1px solid #e6dcc2;">
      <div style="font:700 15px Georgia;color:#0A1A3F;">${esc(it.summary.headline)}</div>
      <div style="font:14px Georgia;color:#1a1a1a;margin:4px 0;">${esc(it.summary.plain)}</div>
      <div style="font:12px Georgia;color:#5C5347;">${esc(it.summary.affects)} · ${esc(it.summary.status)}</div>
      <a href="${siteUrl}/bill/${it.id}" style="font:12px Georgia;color:#8B0000;">Read more →</a>
    </td></tr>`).join("");
  const html = `<div style="max-width:600px;margin:auto;font-family:Georgia,serif;">
    <h2 style="color:#8B0000;">Your ${esc(digest.district)} legislative digest</h2>
    <table style="width:100%;">${rows}</table>
    <p style="font:11px Georgia;color:#5C5347;margin-top:18px;">
      You receive this because you opted in at ${esc(siteUrl)}.
      <a href="${unsub}">Unsubscribe</a>. ${esc(mailingAddress)}.</p>
  </div>`;
  return { to: profile.email, subject: `Your ${digest.district} legislative digest`, html };
}

// -----------------------------------------------------------------------------
// external service helpers
// -----------------------------------------------------------------------------
async function cg(path, params = {}) {
  if (!CONGRESS_API_KEY) throw new Error("CONGRESS_API_KEY not set");
  const qs = new URLSearchParams({ format: "json", api_key: CONGRESS_API_KEY, ...params });
  const res = await fetch(`https://api.congress.gov/v3${path}?${qs}`);
  if (!res.ok) throw new Error(`congress ${res.status} on ${path}`);
  return res.json();
}

async function anthropic(prompt) {
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model: SUMMARY_MODEL, max_tokens: 500, messages: [{ role: "user", content: prompt }] }),
  });
  const data = await res.json();
  return (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
}

// utils
const token = () => crypto.randomBytes(24).toString("base64url");
const billId = (type, number) => `${String(type).toLowerCase()}-${number}-${CONGRESS}`;
const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const stripHtml = (s) => String(s).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const stripFences = (s) => String(s).replace(/```json|```/g, "").trim();
const esc = (s) => String(s || "").replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));

// -----------------------------------------------------------------------------
// REFERENCE store (dev). Implement these against your DB.
// -----------------------------------------------------------------------------
function createMemoryStore() {
  const profiles = new Map(), refs = new Map(), summaries = new Map();
  return {
    async saveProfile(p) { profiles.set(p.userId, p); },
    async getProfile(userId) { return profiles.get(userId) || null; },
    async findProfileByConfirmToken(t) { return [...profiles.values()].find(p => p.emailConfirmToken === t) || null; },
    async findProfileByUnsubToken(t) { return [...profiles.values()].find(p => p.unsubToken === t) || null; },
    async saveBillRefs(list) { for (const r of list) refs.set(r.id, r); },
    async getBillRefs(ids) { return ids.map(id => refs.get(id)).filter(Boolean); },
    async getCachedSummary(key) { return summaries.get(key) || null; },
    async setCachedSummary(key, val) { summaries.set(key, val); },
  };
}

module.exports = {
  createProfile, confirmEmail, unsubscribe,
  assignBills, summarizeBill, buildDigest, composeEmail,
  createMemoryStore, CONSENT_VERSION,
};
