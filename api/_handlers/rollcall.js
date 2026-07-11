// =============================================================================
// /api/rollcall - historical roll call votes, both chambers
//   GET /api/rollcall?chamber=house                    -> recent House roll calls
//   GET /api/rollcall?chamber=house&vote=123           -> every member's vote
//   GET /api/rollcall?chamber=senate                   -> recent Senate roll calls
//   GET /api/rollcall?chamber=senate&vote=123          -> every senator's vote
// Optional: &congress=119&session=2 (defaults to current)
//
// Sources: House via the Congress.gov API (same CONGRESS_API_KEY the digest
// uses). Senate publishes official XML on senate.gov, no key needed.
// Votes never change once cast, so responses cache hard at the edge.
// =============================================================================
import { sql } from "../_db.js";

const CONGRESS_API_KEY = process.env.CONGRESS_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const DEFAULT_CONGRESS = 119;
const DEFAULT_SESSION = 2; // 2026

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=3600");

  const chamber = (req.query.chamber || "house").toLowerCase();
  const congress = parseInt(req.query.congress || DEFAULT_CONGRESS, 10);
  const session = parseInt(req.query.session || DEFAULT_SESSION, 10);
  const vote = req.query.vote;

  try {
    if (chamber === "house") {
      if (!CONGRESS_API_KEY) return res.status(500).json({ error: "CONGRESS_API_KEY not set" });
      return vote
        ? res.status(200).json(await houseDetail(congress, session, vote))
        : res.status(200).json(await houseList(congress, session));
    }
    if (chamber === "senate") {
      return vote
        ? res.status(200).json(await senateDetail(congress, session, vote))
        : res.status(200).json(await senateList(congress, session));
    }
    return res.status(400).json({ error: "chamber must be house or senate" });
  } catch (err) {
    console.error("rollcall error:", err);
    return res.status(502).json({ error: String(err.message || err) });
  }
}

// ---------------- House (Congress.gov API) ----------------
async function houseList(congress, session) {
  const url = `https://api.congress.gov/v3/house-vote/${congress}/${session}?format=json&limit=100&api_key=${CONGRESS_API_KEY}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`congress.gov ${r.status}`);
  const data = await r.json();
  const items = (data.houseRollCallVotes || []).map(v => ({
    vote: v.rollCallNumber,
    date: v.startDate,
    question: v.voteQuestion || "",
    result: v.result || "",
    bill: v.legislationType && v.legislationNumber ? `${v.legislationType} ${v.legislationNumber}` : null,
    description: v.amendmentAuthor || "",
  })).sort((a, b) => b.vote - a.vote);
  return { chamber: "house", congress, session, votes: items };
}

async function houseDetail(congress, session, voteNumber) {
  const url = `https://api.congress.gov/v3/house-vote/${congress}/${session}/${voteNumber}/members?format=json&limit=450&api_key=${CONGRESS_API_KEY}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`congress.gov ${r.status}`);
  const data = await r.json();
  const meta = data.houseRollCallVoteMemberVotes || {};
  const members = (meta.results || []).map(m => ({
    name: `${m.lastName}, ${m.firstName}`,
    party: m.voteParty || "",
    state: m.voteState || "",
    position: normalize(m.voteCast),
  }));
  const billLabel = meta.legislationType && meta.legislationNumber ? `${meta.legislationType} ${meta.legislationNumber}` : null;
  return {
    chamber: "house", congress, session, vote: Number(voteNumber),
    question: meta.voteQuestion || "",
    result: meta.result || "",
    bill: billLabel,
    summary: await billSummary(billLabel, congress),
    tally: tallyUp(members),
    members,
  };
}

// ---------------- Senate (senate.gov official XML) ----------------
const SENATE_HEADERS = { "User-Agent": "CheckYourRepresentative.com civic education (info@checkyourrepresentative.com)" };

async function senateList(congress, session) {
  const url = `https://www.senate.gov/legislative/LIS/roll_call_lists/vote_menu_${congress}_${session}.xml`;
  const r = await fetch(url, { headers: SENATE_HEADERS });
  if (!r.ok) throw new Error(`senate.gov ${r.status}`);
  const xml = await r.text();
  const votes = [];
  const blocks = xml.match(/<vote>[\s\S]*?<\/vote>/g) || [];
  for (const b of blocks) {
    votes.push({
      vote: parseInt(tag(b, "vote_number"), 10),
      date: tag(b, "vote_date"),
      question: decode(tag(b, "question")),
      result: decode(tag(b, "result")),
      bill: decode(tag(b, "issue")) || null,
      description: decode(tag(b, "title")),
    });
  }
  votes.sort((a, b) => b.vote - a.vote);
  return { chamber: "senate", congress, session, votes };
}

async function senateDetail(congress, session, voteNumber) {
  const padded = String(voteNumber).padStart(5, "0");
  const url = `https://www.senate.gov/legislative/LIS/roll_call_votes/vote${congress}${session}/vote_${congress}_${session}_${padded}.xml`;
  const r = await fetch(url, { headers: SENATE_HEADERS });
  if (!r.ok) throw new Error(`senate.gov ${r.status}`);
  const xml = await r.text();
  const members = [];
  const blocks = xml.match(/<member>[\s\S]*?<\/member>/g) || [];
  for (const b of blocks) {
    members.push({
      name: `${decode(tag(b, "last_name"))}, ${decode(tag(b, "first_name"))}`,
      party: tag(b, "party"),
      state: tag(b, "state"),
      position: normalize(tag(b, "vote_cast")),
    });
  }
  const billLabel = decode(tag(xml, "document_name")) || null;
  return {
    chamber: "senate", congress, session, vote: Number(voteNumber),
    question: decode(tag(xml, "question")) || decode(tag(xml, "vote_question_text")),
    result: decode(tag(xml, "vote_result")),
    bill: billLabel,
    summary: await billSummary(billLabel, congress),
    tally: tallyUp(members),
    members,
  };
}

// ---------------- helpers ----------------
function tag(src, name) {
  const m = src.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return m ? m[1].trim() : "";
}
function decode(s) {
  return (s || "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'");
}
function normalize(v) {
  const s = (v || "").toLowerCase();
  if (s.startsWith("yea") || s.startsWith("aye") || s === "yes" || s.startsWith("guilty")) return "yea";
  if (s.startsWith("nay") || s === "no" || s.startsWith("not guilty")) return "nay";
  if (s.startsWith("present")) return "present";
  return "not_voting";
}
function tallyUp(members) {
  const t = { yea: 0, nay: 0, present: 0, not_voting: 0, byParty: {} };
  for (const m of members) {
    t[m.position] = (t[m.position] || 0) + 1;
    const p = m.party || "?";
    t.byParty[p] = t.byParty[p] || { yea: 0, nay: 0, present: 0, not_voting: 0 };
    t.byParty[p][m.position]++;
  }
  return t;
}

// ---------------- plain-English bill summary ----------------
// Reuses the same bill_summaries cache the Vote tab fills. On a miss it
// generates a short summary once and caches it for every future viewer.
async function billSummary(billLabel, congress) {
  try {
    const parsed = parseBillLabel(billLabel, congress);
    if (!parsed) return null;
    const { billId, type, number } = parsed;

    const hit = await sql`
      SELECT headline, plain FROM bill_summaries
      WHERE bill_id = ${billId}
      ORDER BY generated_at DESC LIMIT 1`;
    if (hit.length) {
      let headline = hit[0].headline, plain = hit[0].plain;
      try { const j = JSON.parse(hit[0].plain); if (j && j.plain) { plain = j.plain; headline = j.headline || headline; } } catch {}
      return { headline, plain };
    }

    // Cache miss: pull the official title, then write a short plain summary.
    if (!CONGRESS_API_KEY) return null;
    const br = await fetch(`https://api.congress.gov/v3/bill/${congress}/${type}/${number}?format=json&api_key=${CONGRESS_API_KEY}`);
    if (!br.ok) return null;
    const bdata = await br.json();
    const title = bdata.bill?.title || billLabel;
    const latest = bdata.bill?.latestAction?.text || "";

    if (!ANTHROPIC_API_KEY) return { headline: title, plain: "" };

    const ar = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 400,
        messages: [{
          role: "user",
          content: `You are a nonpartisan civic research tool. Return ONLY valid JSON, no markdown fences.

WRITING STYLE RULES (strict): Never use em dashes or en dashes anywhere. Use commas, periods, or colons instead. Write like a sharp newspaper reporter, not a chatbot. No hedging filler. Short direct sentences.

Bill: ${billLabel}
Official title: ${title}
Latest action: ${latest}

Return: {"headline": "plain-English title in 12 words or less", "plain": "2-3 sentences: what this bill actually does in plain English"}`,
        }],
      }),
    });
    if (!ar.ok) return { headline: title, plain: "" };
    const adata = await ar.json();
    const text = (adata.content || []).map(c => c.text || "").join("").replace(/```json|```/g, "").trim();
    let out;
    try { out = JSON.parse(text); } catch { return { headline: title, plain: "" }; }
    const headline = out.headline || title;
    const plain = out.plain || "";

    await sql`
      INSERT INTO bill_summaries (cache_key, bill_id, headline, plain, affects, status)
      VALUES (${billId + ":rollcall"}, ${billId}, ${headline}, ${plain}, NULL, NULL)
      ON CONFLICT (cache_key) DO NOTHING`;

    return { headline, plain };
  } catch (err) {
    console.error("billSummary error:", err);
    return null;
  }
}

function parseBillLabel(label, congress) {
  if (!label) return null;
  const m = String(label).toUpperCase().replace(/\./g, "").match(/^(HR|HRES|HJRES|HCONRES|S|SRES|SJRES|SCONRES)\s*(\d+)$/);
  if (!m) return null;
  const typeMap = { HR: "hr", HRES: "hres", HJRES: "hjres", HCONRES: "hconres",
                    S: "s", SRES: "sres", SJRES: "sjres", SCONRES: "sconres" };
  const type = typeMap[m[1]];
  return { type, number: m[2], billId: `${type}-${m[2]}-${congress}` };
}
