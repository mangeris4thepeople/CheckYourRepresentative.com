// =============================================================================
// /api/contact  -  look up all 3 legislators for a district + draft a letter
// -----------------------------------------------------------------------------
// GET /api/contact?district=CO-04&billId=hr-1234-119&position=support&billTitle=...
//
// Returns:
//   { legislators: [...], letter: "...", billTitle: "..." }
//
// legislators: [ { name, chamber, party, state, contactUrl, phone, bioguideId } ]
// letter: AI-drafted plain-language message the constituent can send
// =============================================================================

const CONGRESS = 119;
const CONGRESS_API_KEY = process.env.CONGRESS_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const SUMMARY_MODEL = process.env.SUMMARY_MODEL || "claude-sonnet-4-6";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const district = String(req.query.district || "").trim();
    const billId    = String(req.query.billId || "").trim();
    const position  = String(req.query.position || "").trim();
    const billTitle = String(req.query.billTitle || "").trim();

    if (!district) return res.status(400).json({ error: "missing district" });
    if (!CONGRESS_API_KEY) return res.status(500).json({ error: "CONGRESS_API_KEY not set" });

    const [state, dpart] = district.split("-");
    const distNum = (!dpart || dpart === "AL" || dpart === "00")
      ? "0" : String(parseInt(dpart, 10));

    // 1) Fetch House rep for this district
    const legislators = [];

    try {
      const houseData = await cg(`/member/congress/${CONGRESS}/${state}/${distNum}`, {
        currentMember: "true", limit: 1
      });
      const rep = (houseData.members || [])[0];
      if (rep) {
        legislators.push({
          name: rep.name,
          chamber: "House",
          party: rep.partyName || rep.party || "",
          state,
          district,
          bioguideId: rep.bioguideId,
          contactUrl: `https://www.house.gov/representatives/find-your-representative`,
          officialUrl: rep.officialWebsiteUrl || null,
          phone: null,
        });
        // Try to get their direct contact page
        try {
          const detail = await cg(`/member/${rep.bioguideId}`);
          const m = detail.member || {};
          if (m.officialWebsiteUrl) {
            legislators[0].officialUrl = m.officialWebsiteUrl;
            legislators[0].contactUrl = m.officialWebsiteUrl.replace(/\/?$/, "/contact");
          }
        } catch { /* use fallback */ }
      }
    } catch (e) {
      console.warn("House lookup failed:", e.message);
    }

    // 2) Fetch both Senators for this state.
    //
    // The base /member endpoint does NOT filter by stateCode or chamber as
    // query params, it silently ignores them and returns an unrelated default
    // member list, which is what produced wrong "senators" for every state.
    // The authoritative form is the state path /member/{state}, from which we
    // keep only the current senators (identified by their most recent term's
    // chamber, falling back to "no House district" if terms are absent).
    try {
      const senateData = await cg(`/member/${state}`, {
        currentMember: "true",
        limit: 25,
      });
      const senators = (senateData.members || []).filter(isSenator).slice(0, 2);
      for (const sen of senators) {
        const senator = {
          name: sen.name,
          chamber: "Senate",
          party: sen.partyName || sen.party || "",
          state,
          district: `${state}-Senate`,
          bioguideId: sen.bioguideId,
          contactUrl: `https://www.senate.gov/senators/contact`,
          officialUrl: sen.officialWebsiteUrl || null,
          phone: null,
        };
        // Try to get direct contact URL
        try {
          const detail = await cg(`/member/${sen.bioguideId}`);
          const m = detail.member || {};
          if (m.officialWebsiteUrl) {
            senator.officialUrl = m.officialWebsiteUrl;
            senator.contactUrl = m.officialWebsiteUrl.replace(/\/?$/, "/contact");
          }
        } catch { /* use fallback */ }
        legislators.push(senator);
      }
    } catch (e) {
      console.warn("Senate lookup failed:", e.message);
    }

    // 3) Draft the letter with AI (or fallback template)
    const letter = await draftLetter({ legislators, billTitle, billId, position, state, district, ANTHROPIC_API_KEY, SUMMARY_MODEL });

    return res.status(200).json({ legislators, letter, billTitle, district, position });

  } catch (err) {
    return res.status(500).json({ error: "contact_failed", detail: String(err.message || err) });
  }
}

// ---------------------------------------------------------------------------
async function draftLetter({ legislators, billTitle, billId, position, state, district, ANTHROPIC_API_KEY, SUMMARY_MODEL }) {
  const repNames = legislators.map(l => `${l.name} (${l.chamber})`).join(", ");
  const positionWord = position === "support" ? "support" : position === "oppose" ? "oppose" : "express my uncertainty about";

  const fallback = `Dear [Representative/Senator],

I am a constituent from ${district} writing to share my position on ${billTitle || billId}.

I am writing to ${positionWord} this legislation. As your constituent, I urge you to consider the impact this bill will have on the people of ${state} and our district.

Please keep us informed of your position and vote on this important matter. Your constituents are watching and we appreciate your service.

Respectfully,
[Your Name]
[Your Address]
[City, State, ZIP]`;

  if (!ANTHROPIC_API_KEY || !billTitle) return fallback;

  const prompt = `You are helping a U.S. constituent write a respectful, concise letter to their elected officials about a bill.

Constituent info:
- District: ${district} (${state})
- Their position: They ${positionWord} this bill
- Bill: ${billTitle}
- Legislators: ${repNames}

Write a professional 3-paragraph constituent letter (150-200 words):
1. Introduction: who they are and why they're writing
2. Their position and brief reasoning (factual, civic tone - NOT partisan attack)  
3. Call to action: ask the legislator to vote accordingly and stay in touch

Use placeholder [Your Name] and [Your Address] at the end.
Start with "Dear [Title] [Last Name]," - use generic greeting since it goes to multiple legislators.
Do NOT include any markdown formatting. Plain text only.`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: SUMMARY_MODEL,
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }]
      }),
    });
    if (!r.ok) return fallback;
    const data = await r.json();
    const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
    return text.trim() || fallback;
  } catch {
    return fallback;
  }
}

// Most recent term's chamber for a Congress.gov member list item, or null.
function latestChamber(m) {
  const items = (m && m.terms && m.terms.item) || [];
  if (!items.length) return null;
  return items[items.length - 1].chamber || null;
}

// A current senator sits in the Senate this term. Senators also have no House
// district, which is the fallback signal when term data is not present.
function isSenator(m) {
  const chamber = latestChamber(m);
  if (chamber) return chamber === "Senate";
  return m.district === null || m.district === undefined;
}

async function cg(path, params = {}) {
  const qs = new URLSearchParams({ format: "json", api_key: CONGRESS_API_KEY, ...params });
  const r = await fetch(`https://api.congress.gov/v3${path}?${qs}`);
  if (!r.ok) throw new Error(`congress ${r.status} on ${path}`);
  return r.json();
}
