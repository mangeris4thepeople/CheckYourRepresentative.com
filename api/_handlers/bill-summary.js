// =============================================================================
// GET /api/bill-summary?billId=hr-5622-119
// Returns { headline, plain } for a bill. Reads the same bill_summaries cache
// the Vote tab and Roll Calls fill. On a miss it generates one short summary
// via the official title and caches it, so every viewer after is instant.
// =============================================================================
import { sql } from "../_db.js";

const CONGRESS_API_KEY = process.env.CONGRESS_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");

  const billId = String(req.query.billId || "").toLowerCase().trim();
  const m = billId.match(/^(hr|hres|hjres|hconres|s|sres|sjres|sconres)-(\d+)-(\d+)$/);
  if (!m) return res.status(400).json({ error: "billId must look like hr-5622-119" });
  const [, type, number, congress] = m;

  try {
    // Cache first
    const hit = await sql`
      SELECT headline, plain FROM bill_summaries
      WHERE bill_id = ${billId}
      ORDER BY generated_at DESC LIMIT 1`;
    if (hit.length) {
      let headline = hit[0].headline, plain = hit[0].plain;
      try { const j = JSON.parse(hit[0].plain); if (j && j.plain) { plain = j.plain; headline = j.headline || headline; } } catch {}
      return res.status(200).json({ billId, headline, plain, cached: true });
    }

    if (!CONGRESS_API_KEY) return res.status(200).json({ billId, headline: null, plain: null });

    const br = await fetch(`https://api.congress.gov/v3/bill/${congress}/${type}/${number}?format=json&api_key=${CONGRESS_API_KEY}`);
    if (!br.ok) return res.status(200).json({ billId, headline: null, plain: null });
    const bdata = await br.json();
    const title = bdata.bill?.title || billId.toUpperCase();
    const latest = bdata.bill?.latestAction?.text || "";

    if (!ANTHROPIC_API_KEY) return res.status(200).json({ billId, headline: title, plain: "" });

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

Bill: ${type.toUpperCase()} ${number}
Official title: ${title}
Latest action: ${latest}

Return: {"headline": "plain-English title in 12 words or less", "plain": "2-3 sentences: what this bill actually does in plain English"}`,
        }],
      }),
    });
    if (!ar.ok) return res.status(200).json({ billId, headline: title, plain: "" });
    const adata = await ar.json();
    const text = (adata.content || []).map(c => c.text || "").join("").replace(/```json|```/g, "").trim();
    let out;
    try { out = JSON.parse(text); } catch { return res.status(200).json({ billId, headline: title, plain: "" }); }
    const headline = out.headline || title;
    const plain = out.plain || "";

    await sql`
      INSERT INTO bill_summaries (cache_key, bill_id, headline, plain, affects, status)
      VALUES (${billId + ":synopsis"}, ${billId}, ${headline}, ${plain}, NULL, NULL)
      ON CONFLICT (cache_key) DO NOTHING`;

    return res.status(200).json({ billId, headline, plain, cached: false });
  } catch (err) {
    console.error("bill-summary error:", err);
    return res.status(500).json({ error: String(err.message || err) });
  }
}
