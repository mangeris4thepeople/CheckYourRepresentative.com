// =============================================================================
// /api/digest  —  ALL active floor bills, not just one rep's bills
// -----------------------------------------------------------------------------
// Returns every bill currently active in the 119th Congress, with AI plain-
// language summaries. Any constituent in any district can vote on any bill.
// District is still used to identify the user's rep for display only.
//
// Call:  GET /api/digest?district=CO-04&topics=Health,Energy
// =============================================================================

const CONGRESS = 119;
import { sql, hasDb } from "./_db.js";
const CONGRESS_API_KEY = process.env.CONGRESS_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const SUMMARY_MODEL = process.env.SUMMARY_MODEL || "claude-sonnet-4-6";
const BILL_TYPES = ["hr", "s", "hjres", "sjres", "hconres", "sconres", "hres", "sres"];
const MAX_BILLS = 10;

export default async function handler(req, res) {
  try {
    const district = String(req.query.district || "").trim();
    const topicsRaw = String(req.query.topics || "").trim();
    const topics = topicsRaw ? topicsRaw.split(",").map(t => t.trim().toLowerCase()) : [];

    if (!CONGRESS_API_KEY) return res.status(500).json({ error: "CONGRESS_API_KEY not set" });

    // Get the user's rep for display purposes only (not for bill filtering)
    let rep = null;
    if (district) {
      try {
        const [state, dpart] = district.split("-");
        const distNum = (dpart === "AL" || dpart === "00" || !dpart) ? "0" : String(parseInt(dpart, 10));
        const memberData = await cg(`/member/congress/${CONGRESS}/${state}/${distNum}`, { currentMember: "true", limit: 1 });
        const member = (memberData.members || [])[0] || null;
        if (member) rep = { name: member.name, bioguideId: member.bioguideId, party: member.partyName, state };
      } catch { /* non-fatal — rep display is optional */ }
    }

    // Pull ALL active bills from Congress — sorted by most recent action
    // Strategy: pull from multiple bill types to get a broad set of active legislation
    const refs = [];

    // Get bills with recent floor action (most active)
    const recentBills = await cg(`/bill/${CONGRESS}`, {
      sort: "latestAction",
      direction: "desc",
      limit: 25,
    });

    for (const b of (recentBills.bills || [])) {
      if (refs.length >= MAX_BILLS * 3) break;
      const type = String(b.type || "").toLowerCase();
      if (!BILL_TYPES.includes(type) || !b.number) continue;

      // Filter to bills with meaningful recent action (floor votes, passed, etc.)
      const action = (b.latestAction?.text || "").toLowerCase();
      const actionDate = b.latestAction?.actionDate || "";

      // Skip bills with no recent action in the last 6 months
      if (actionDate < "2025-01-01") continue;

      // Prioritize bills with floor action
      const isFloorAction = /passed|vote|agreed|floor|motion|ordered|reported|introduced|referred|signed/i.test(action);

      const id = `${type}-${b.number}-${CONGRESS}`;
      if (refs.find(r => r.id === id)) continue;

      // Filter by topic if user selected topics
      const title = (b.title || "").toLowerCase();
      const policyArea = (b.policyArea?.name || "").toLowerCase();
      if (topics.length > 0) {
        const matches = topics.some(t =>
          title.includes(t) || policyArea.includes(t) ||
          topicKeywords(t).some(kw => title.includes(kw) || policyArea.includes(kw))
        );
        if (!matches) continue;
      }

      refs.push({
        id,
        type,
        number: b.number,
        title: b.title || `${b.type} ${b.number}`,
        reason: isFloorAction ? "Active on House Floor" : "Active Legislation",
        latestAction: b.latestAction?.text || "",
        actionDate,
        policyArea: b.policyArea?.name || "",
      });
    }

    // If not enough bills after topic filter, add more without filter
    if (refs.length < 5) {
      const moreBills = await cg(`/bill/${CONGRESS}`, {
        sort: "latestAction",
        direction: "desc",
        limit: 20,
        offset: 25,
      });
      for (const b of (moreBills.bills || [])) {
        if (refs.length >= MAX_BILLS * 2) break;
        const type = String(b.type || "").toLowerCase();
        if (!BILL_TYPES.includes(type) || !b.number) continue;
        if ((b.latestAction?.actionDate || "") < "2025-01-01") continue;
        const id = `${type}-${b.number}-${CONGRESS}`;
        if (refs.find(r => r.id === id)) continue;
        refs.push({
          id, type, number: b.number,
          title: b.title || `${b.type} ${b.number}`,
          reason: "Active Legislation",
          latestAction: b.latestAction?.text || "",
          actionDate: b.latestAction?.actionDate || "",
          policyArea: b.policyArea?.name || "",
        });
      }
    }

    // Summarize top bills in parallel
    const items = await Promise.all(refs.slice(0, MAX_BILLS).map(summarizeRef));

    return res.status(200).json({
      district,
      rep,
      generatedAt: Date.now(),
      items,
      note: "Showing all active bills in the 119th Congress — not filtered by representative."
    });

  } catch (err) {
    return res.status(500).json({ error: "digest_failed", detail: String(err.message || err) });
  }
}

// Topic keyword expansion for better filtering
function topicKeywords(topic) {
  const map = {
    health: ["healthcare", "medical", "medicare", "medicaid", "hospital", "drug", "pharmaceutical"],
    energy: ["oil", "gas", "solar", "wind", "electric", "carbon", "climate", "fossil"],
    education: ["school", "university", "student", "college", "teacher", "loan"],
    immigration: ["border", "asylum", "visa", "migrant", "citizenship", "deportation"],
    economy: ["tax", "tariff", "trade", "budget", "deficit", "inflation", "spending"],
    defense: ["military", "army", "navy", "pentagon", "national security", "veteran"],
    environment: ["epa", "pollution", "conservation", "wilderness", "water", "air"],
    housing: ["rent", "mortgage", "affordable housing", "homelessness", "hud"],
    agriculture: ["farm", "food", "usda", "crop", "livestock", "rural"],
    labor: ["worker", "wage", "union", "employment", "osha", "minimum wage"],
  };
  return map[topic] || [];
}

async function summarizeRef(ref) {
  const cacheKey = `${ref.id}:${ref.actionDate || ""}`;

  if (hasDb) {
    try {
      const hit = await sql`SELECT headline, plain, affects, status FROM bill_summaries WHERE cache_key=${cacheKey}`;
      if (hit.length) return { ...ref, summary: hit[0] };
    } catch { /* cache miss */ }
  }

  let officialText = "";
  try {
    const s = await cg(`/bill/${CONGRESS}/${ref.type}/${ref.number}/summaries`);
    officialText = stripHtml((s.summaries || []).slice(-1)[0]?.text || "");
  } catch {}

  const fallback = { headline: ref.title, plain: officialText.slice(0, 280), affects: "", status: ref.latestAction };

  let summary;
  if (!ANTHROPIC_API_KEY) {
    summary = fallback;
  } else {
    const prompt =
`You are a neutral civic explainer for a U.S. voter-education tool. In plain language a busy adult reads in 30 seconds, summarize this bill. Be factual and strictly non-partisan. Do NOT say whether it is good or bad or how to vote.
Return ONLY JSON: {"headline": string (max 12 words), "plain": string (2-3 sentences: what it would do), "affects": string (1 sentence: who is most affected), "status": string (short phrase: where it is in the process)}

BILL: ${ref.title}
POLICY AREA: ${ref.policyArea || "n/a"}
LATEST ACTION: ${ref.latestAction || "n/a"}
OFFICIAL SUMMARY: ${officialText.slice(0, 3500) || "(none published yet)"}`;
    try {
      const text = await anthropic(prompt);
      const parsed = JSON.parse(stripFences(text));
      summary = {
        headline: parsed.headline || ref.title,
        plain: parsed.plain || "",
        affects: parsed.affects || "",
        status: parsed.status || ref.latestAction
      };
    } catch {
      summary = fallback;
    }
  }

  if (hasDb) {
    try {
      await sql`
        INSERT INTO bill_summaries (cache_key, bill_id, headline, plain, affects, status)
        VALUES (${cacheKey}, ${ref.id}, ${summary.headline}, ${summary.plain}, ${summary.affects}, ${summary.status})
        ON CONFLICT (cache_key) DO UPDATE SET
          headline=EXCLUDED.headline, plain=EXCLUDED.plain,
          affects=EXCLUDED.affects, status=EXCLUDED.status, generated_at=now()`;
    } catch {}
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
