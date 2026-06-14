// =============================================================================
// /api/digest  —  LIVE bill digest for a constituent's district
// -----------------------------------------------------------------------------
// Runs on Vercel as a serverless function (NOT in the browser), so it can hold
// the secret API keys. Keys come from Vercel Environment Variables — never from
// code. Set these in your Vercel project settings:
//     CONGRESS_API_KEY     (free, api.congress.gov/sign-up)
//     ANTHROPIC_API_KEY    (console.anthropic.com)
//     SUMMARY_MODEL        (optional; defaults below)
//
// Flow: district -> the district's current Representative -> the bills they've
// sponsored/cosponsored -> a plain-language AI summary of each (factual, never
// "how to vote"). If the AI key is missing or a call fails, it still returns the
// real bills with their titles — it degrades, it doesn't break.
//
// Call:  GET /api/digest?district=CO-04&topics=Health,Energy
// =============================================================================

const CONGRESS = 119;
import { sql, hasDb } from "./_db.js";
const CONGRESS_API_KEY = process.env.CONGRESS_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const SUMMARY_MODEL = process.env.SUMMARY_MODEL || "claude-sonnet-4-6";
const BILL_TYPES = ["hr", "s", "hjres", "sjres", "hconres", "sconres", "hres", "sres"];
const MAX_BILLS = 6;

export default async function handler(req, res) {
  try {
    const district = String(req.query.district || "").trim();
    if (!CONGRESS_API_KEY) return res.status(500).json({ error: "CONGRESS_API_KEY not set in Vercel" });
    if (!district) return res.status(400).json({ error: "missing district (e.g. CO-04)" });

    // CO-04 -> state "CO", number "4"; CO-AL -> "0"
    const [state, dpart] = district.split("-");
    const distNum = (dpart === "AL" || dpart === "00" || dpart === undefined) ? "0" : String(parseInt(dpart, 10));

    // 1) current representative for this district
    const memberData = await cg(`/member/congress/${CONGRESS}/${state}/${distNum}`, { currentMember: "true", limit: 1 });
    const member = (memberData.members || [])[0] || null;
    const rep = member ? { name: member.name, bioguideId: member.bioguideId, party: member.partyName, state } : null;

    if (!rep?.bioguideId) {
      return res.status(200).json({ district, rep: null, items: [], note: "No current representative found for this district." });
    }

    // 2) bills they sponsored / cosponsored (most recent first)
    const refs = [];
    const sponsored = await cg(`/member/${rep.bioguideId}/sponsored-legislation`, { limit: 15 });
    pushBills(refs, sponsored.sponsoredLegislation, `Sponsored by ${rep.name}`, 4);
    const cosponsored = await cg(`/member/${rep.bioguideId}/cosponsored-legislation`, { limit: 12 });
    pushBills(refs, cosponsored.cosponsoredLegislation, `Cosponsored by ${rep.name}`, MAX_BILLS - refs.length);

    // 3) summarize each (in parallel; degrades gracefully if AI unavailable)
    const items = await Promise.all(refs.slice(0, MAX_BILLS).map(summarizeRef));

    return res.status(200).json({ district, rep, generatedAt: Date.now(), items });
  } catch (err) {
    return res.status(500).json({ error: "digest_failed", detail: String(err.message || err) });
  }
}

// ---- helpers ----------------------------------------------------------------
function pushBills(out, list, reason, max) {
  let added = 0;
  for (const b of (list || [])) {
    if (added >= max) break;
    const type = String(b.type || "").toLowerCase();
    if (!BILL_TYPES.includes(type) || !b.number) continue;
    const id = `${type}-${b.number}-${CONGRESS}`;
    if (out.find(r => r.id === id)) continue;
    out.push({ id, type, number: b.number, title: b.title || `${b.type} ${b.number}`,
               reason, latestAction: b.latestAction?.text || "", actionDate: b.latestAction?.actionDate || "" });
    added++;
  }
}

async function summarizeRef(ref) {
  const cacheKey = `${ref.id}:${ref.actionDate || ""}`;

  // shared cache: summarize each bill once, reuse for every constituent
  if (hasDb) {
    try {
      const hit = await sql`SELECT headline, plain, affects, status FROM bill_summaries WHERE cache_key=${cacheKey}`;
      if (hit.length) return { ...ref, summary: hit[0] };
    } catch { /* cache miss / table not ready */ }
  }

  // pull the official summary text if one exists
  let officialText = "";
  try {
    const s = await cg(`/bill/${CONGRESS}/${ref.type}/${ref.number}/summaries`);
    officialText = stripHtml((s.summaries || []).slice(-1)[0]?.text || "");
  } catch { /* no summary published yet */ }

  // fallback summary (used if AI is unavailable) — still real, just not plain-language
  const fallback = { headline: ref.title, plain: officialText.slice(0, 280), affects: "", status: ref.latestAction };

  let summary;
  if (!ANTHROPIC_API_KEY) {
    summary = fallback;
  } else {
    const prompt =
`You are a neutral civic explainer for a U.S. voter-education tool. In plain language a busy adult reads in 30 seconds, summarize this bill. Be factual and strictly non-partisan. Do NOT say whether it is good or bad or how to vote.
Return ONLY JSON: {"headline": string (max 12 words), "plain": string (2-3 sentences: what it would do), "affects": string (1 sentence: who is most affected), "status": string (short phrase: where it is in the process)}

BILL: ${ref.title}
LATEST ACTION: ${ref.latestAction || "n/a"}
OFFICIAL SUMMARY: ${officialText.slice(0, 3500) || "(none published yet)"}`;
    try {
      const text = await anthropic(prompt);
      const parsed = JSON.parse(stripFences(text));
      summary = { headline: parsed.headline || ref.title, plain: parsed.plain || "",
                  affects: parsed.affects || "", status: parsed.status || ref.latestAction };
    } catch {
      summary = fallback;
    }
  }

  // write to shared cache for the next constituent
  if (hasDb) {
    try {
      await sql`
        INSERT INTO bill_summaries (cache_key, bill_id, headline, plain, affects, status)
        VALUES (${cacheKey}, ${ref.id}, ${summary.headline}, ${summary.plain}, ${summary.affects}, ${summary.status})
        ON CONFLICT (cache_key) DO UPDATE SET
          headline=EXCLUDED.headline, plain=EXCLUDED.plain, affects=EXCLUDED.affects, status=EXCLUDED.status, generated_at=now()`;
    } catch { /* non-fatal */ }
  }

  return { ...ref, summary };
}

async function cg(path, params = {}) {
  const qs = new URLSearchParams({ format: "json", api_key: CONGRESS_API_KEY, ...params });
  const r = await fetch(`https://api.congress.gov/v3${path}?${qs}`);
  if (!r.ok) throw new Error(`congress ${r.status} on ${path}`);
  return r.json();
}

async function anthropic(prompt) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: SUMMARY_MODEL, max_tokens: 450, messages: [{ role: "user", content: prompt }] }),
  });
  if (!r.ok) throw new Error(`anthropic ${r.status}`);
  const data = await r.json();
  return (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
}

const stripHtml = (s) => String(s).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const stripFences = (s) => String(s).replace(/```json|```/g, "").trim();
