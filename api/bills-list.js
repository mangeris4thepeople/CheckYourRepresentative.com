// =============================================================================
// GET /api/bills-list - EVERY active bill, lightweight, no AI summarization.
// This is the browsing layer: fast and cheap so it can show hundreds of bills
// at once. Full money-trail analysis only happens per-bill, on demand, via
// /api/bill-detail when a voter actually opens one. That split is deliberate:
// digest.js pre-summarizes a curated top 8 for the homepage Vote tab, this
// endpoint lets a voter reach every other bill on the floor too.
//
//   GET /api/bills-list                  -> first batch, most recent activity first
//   GET /api/bills-list?offset=250       -> next batch (Congress.gov max page size)
//   GET /api/bills-list?q=health         -> filter current corpus by title/policy area
// =============================================================================
const CONGRESS = 119;
const CONGRESS_API_KEY = process.env.CONGRESS_API_KEY;
const BILL_TYPES = ["hr", "s", "hjres", "sjres", "hres", "sres"];
const PAGE_SIZE = 250; // Congress.gov's max limit per request

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=1800");

  if (!CONGRESS_API_KEY) return res.status(500).json({ error: "CONGRESS_API_KEY not set" });

  try {
    const offset = Math.max(0, parseInt(req.query.offset || "0", 10) || 0);
    const q = String(req.query.q || "").trim().toLowerCase();

    const data = await cg(`/bill/${CONGRESS}`, {
      sort: "latestAction", direction: "desc", limit: PAGE_SIZE, offset,
    });

    const bills = [];
    for (const b of (data.bills || [])) {
      const type = String(b.type || "").toLowerCase();
      if (!BILL_TYPES.includes(type) || !b.number) continue;
      if ((b.latestAction?.actionDate || "") < "2025-01-01") continue;

      const title = b.title || `${b.type} ${b.number}`;
      const policyArea = b.policyArea?.name || "";
      if (q && !title.toLowerCase().includes(q) && !policyArea.toLowerCase().includes(q)) continue;

      bills.push({
        id: `${type}-${b.number}-${CONGRESS}`,
        type, number: b.number,
        title,
        latestAction: b.latestAction?.text || "",
        actionDate: b.latestAction?.actionDate || "",
        policyArea,
      });
    }

    const totalCount = data.pagination?.count ?? null;

    return res.status(200).json({
      bills,
      offset,
      pageSize: PAGE_SIZE,
      totalCount,
      hasMore: totalCount != null ? offset + PAGE_SIZE < totalCount : bills.length === PAGE_SIZE,
    });
  } catch (err) {
    return res.status(500).json({ error: "bills_list_failed", detail: String(err.message || err) });
  }
}

async function cg(path, params = {}) {
  const qs = new URLSearchParams({ format: "json", api_key: CONGRESS_API_KEY, ...params });
  const r = await fetch(`https://api.congress.gov/v3${path}?${qs}`);
  if (!r.ok) throw new Error(`congress ${r.status} on ${path}`);
  return r.json();
}
