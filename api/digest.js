// =============================================================================
// /api/digest v2 - All active bills + sponsor + money trail via AI research
// =============================================================================
const CONGRESS = 119;
import { sql, hasDb } from "./_db.js";
const CONGRESS_API_KEY = process.env.CONGRESS_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const SUMMARY_MODEL = process.env.SUMMARY_MODEL || "claude-sonnet-4-6";
const BILL_TYPES = ["hr", "s", "hjres", "sjres", "hres", "sres"];
const MAX_BILLS = 8;

export default async function handler(req, res) {
  try {
    const district = String(req.query.district || "").trim();
    const topicsRaw = String(req.query.topics || "").trim();
    const topics = topicsRaw ? topicsRaw.split(",").map(t => t.trim().toLowerCase()) : [];

    if (!CONGRESS_API_KEY) return res.status(500).json({ error: "CONGRESS_API_KEY not set" });

    // Get user rep for display
    let rep = null;
    if (district) {
      try {
        const [state, dpart] = district.split("-");
        const distNum = (!dpart || dpart === "AL") ? "0" : String(parseInt(dpart, 10));
        const md = await cg(`/member/congress/${CONGRESS}/${state}/${distNum}`, { currentMember: "true", limit: 1 });
        const m = (md.members || [])[0];
        if (m) rep = { name: m.name, bioguideId: m.bioguideId, party: m.partyName, state };
      } catch {}
    }

    // Pull ALL active bills - most recent action first
    const allBills = [];
    for (const offset of [0, 25]) {
      const data = await cg(`/bill/${CONGRESS}`, { sort: "latestAction", direction: "desc", limit: 25, offset });
      for (const b of (data.bills || [])) {
        const type = String(b.type || "").toLowerCase();
        if (!BILL_TYPES.includes(type) || !b.number) continue;
        if ((b.latestAction?.actionDate || "") < "2025-01-01") continue;
        const id = `${type}-${b.number}-${CONGRESS}`;
        if (allBills.find(x => x.id === id)) continue;

        const title = (b.title || "").toLowerCase();
        const policyArea = (b.policyArea?.name || "").toLowerCase();
        if (topics.length > 0) {
          const matches = topics.some(t => title.includes(t) || policyArea.includes(t));
          if (!matches) continue;
        }
        allBills.push({
          id, type, number: b.number,
          title: b.title || `${b.type} ${b.number}`,
          latestAction: b.latestAction?.text || "",
          actionDate: b.latestAction?.actionDate || "",
          policyArea: b.policyArea?.name || "",
          sponsors: b.sponsors || [],
        });
      }
      if (allBills.length >= MAX_BILLS * 2) break;
    }

    // Summarize with full money trail analysis
    const items = await Promise.all(allBills.slice(0, MAX_BILLS).map(b => summarizeFull(b)));

    return res.status(200).json({ district, rep, generatedAt: Date.now(), items });
  } catch (err) {
    return res.status(500).json({ error: "digest_failed", detail: String(err.message || err) });
  }
}

async function summarizeFull(bill) {
  const cacheKey = `v2:${bill.id}:${bill.actionDate}`;

  if (hasDb) {
    try {
      const hit = await sql`SELECT headline, plain, affects, status FROM bill_summaries WHERE cache_key=${cacheKey}`;
      if (hit.length) {
        // Parse extended fields from the plain field if stored as JSON
        let extra = {};
        try { extra = JSON.parse(hit[0].plain); } catch {}
        return { ...bill, summary: { ...hit[0], ...extra } };
      }
    } catch {}
  }

  // Get sponsor details
  let sponsorInfo = "";
  if (bill.sponsors && bill.sponsors.length > 0) {
    const s = bill.sponsors[0];
    sponsorInfo = `${s.fullName || s.name || "Unknown"} (${s.party || "?"}-${s.state || "?"})`;
  } else {
    // Fetch from Congress API
    try {
      const detail = await cg(`/bill/${CONGRESS}/${bill.type}/${bill.number}`);
      const sp = (detail.bill?.sponsors || [])[0];
      if (sp) sponsorInfo = `${sp.fullName || sp.name} (${sp.party}-${sp.state})`;
    } catch {}
  }

  // Official summary
  let officialText = "";
  try {
    const s = await cg(`/bill/${CONGRESS}/${bill.type}/${bill.number}/summaries`);
    officialText = stripHtml((s.summaries || []).slice(-1)[0]?.text || "");
  } catch {}

  const fallback = {
    headline: bill.title,
    plain: officialText.slice(0, 280),
    affects: "",
    status: bill.latestAction,
    sponsor: sponsorInfo,
    who_benefits: "",
    pac_money: "",
    industries: "",
    vote_impact: "",
  };

  if (!ANTHROPIC_API_KEY) return { ...bill, summary: fallback };

  const prompt = `You are a nonpartisan civic research tool that exposes the money trail behind legislation. Analyze this bill and return ONLY valid JSON.

WRITING STYLE RULES (strict): Never use em dashes or en dashes anywhere. Use commas, periods, or colons instead. Write like a sharp newspaper reporter, not a chatbot. No hedging filler like "it's important to note" or "delve". Short direct sentences.

BILL: ${bill.title}
BILL ID: ${bill.id}
SPONSOR: ${sponsorInfo || "unknown"}
POLICY AREA: ${bill.policyArea || "unknown"}
LATEST ACTION: ${bill.latestAction}
OFFICIAL SUMMARY: ${officialText.slice(0, 2000) || "(none)"}

Return this exact JSON structure (all fields required, be specific and factual, cite real industries/PACs where known):
{
  "headline": "Plain-English title in 12 words or less",
  "plain": "2-3 sentences: what this bill actually does in plain English",
  "affects": "Who specifically is affected - workers, patients, corporations, taxpayers, etc.",
  "status": "Where it is in the legislative process right now",
  "sponsor": "${sponsorInfo || "unknown"}",
  "who_benefits": "Specific industries, companies, or groups that benefit most if this passes",
  "who_loses": "Specific groups, workers, or taxpayers who are worse off if this passes",
  "pac_money": "Known PAC industries or donor categories that typically fund sponsors of bills like this (healthcare industry, oil & gas, defense contractors, financial sector, etc.)",
  "industries": "Top 2-3 industry sectors with financial interest in this bill passing or failing",
  "vote_impact": "If this passes, the single most important real-world change for average Americans in one sentence"
}`;

  try {
    const text = await anthropic(prompt);
    const parsed = JSON.parse(stripFences(text));
    const summary = {
      headline: parsed.headline || bill.title,
      plain: parsed.plain || "",
      affects: parsed.affects || "",
      status: parsed.status || bill.latestAction,
      sponsor: parsed.sponsor || sponsorInfo,
      who_benefits: parsed.who_benefits || "",
      who_loses: parsed.who_loses || "",
      pac_money: parsed.pac_money || "",
      industries: parsed.industries || "",
      vote_impact: parsed.vote_impact || "",
    };

    if (hasDb) {
      try {
        await sql`
          INSERT INTO bill_summaries (cache_key, bill_id, headline, plain, affects, status)
          VALUES (${cacheKey}, ${bill.id}, ${summary.headline}, ${JSON.stringify(summary)}, ${summary.affects}, ${summary.status})
          ON CONFLICT (cache_key) DO UPDATE SET
            headline=EXCLUDED.headline, plain=EXCLUDED.plain,
            affects=EXCLUDED.affects, status=EXCLUDED.status, generated_at=now()`;
      } catch {}
    }

    return { ...bill, summary };
  } catch {
    return { ...bill, summary: fallback };
  }
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
    body: JSON.stringify({ model: SUMMARY_MODEL, max_tokens: 800, messages: [{ role: "user", content: prompt }] }),
  });
  if (!r.ok) throw new Error(`anthropic ${r.status}`);
  const d = await r.json();
  return (d.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
}

const stripHtml = s => String(s).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const stripFences = s => String(s).replace(/```json|```/g, "").trim();
