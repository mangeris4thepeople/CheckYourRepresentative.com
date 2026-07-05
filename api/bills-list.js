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
//   GET /api/bills-list?q=health         -> search our own bills table instead
//
// A search only ever needs to search bills we already know about, and
// Congress.gov's /bill list endpoint has no title search of its own, so a
// live search would mean walking every page and filtering client-side one
// page at a time. sync-bills.js already mirrors the whole active bill list
// into Postgres for the vote queue, so a search reads that table directly
// with ILIKE instead. The no-search default browse view is left reading
// live from Congress.gov, so it always reflects the latest activity even
// on days the sync cron has not run yet.
// =============================================================================
const CONGRESS = 119;
const CONGRESS_API_KEY = process.env.CONGRESS_API_KEY;
const BILL_TYPES = ["hr", "s", "hjres", "sjres", "hres", "sres"];
const PAGE_SIZE = 250; // Congress.gov's max limit per request
import { sql, hasDb } from "./_db.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=1800");

  try {
    const offset = Math.max(0, parseInt(req.query.offset || "0", 10) || 0);
    const q = String(req.query.q || "").trim();
    const token = String(req.query.token || "").trim();

    let bills, totalCount;
    if (q) {
      if (!hasDb) return res.status(500).json({ error: "no database configured" });
      ({ bills, totalCount } = await searchBills(q, offset));
    } else {
      if (!CONGRESS_API_KEY) return res.status(500).json({ error: "CONGRESS_API_KEY not set" });
      ({ bills, totalCount } = await browseBills(offset));
    }

    // If signed in, batch-check which of THIS PAGE's bills already have a
    // vote from this account, so the frontend can support "skip to next
    // unvoted bill" without a round trip per bill.
    let votedBillIds = [];
    if (token && hasDb && bills.length) {
      try {
        const sess = await sql`
          SELECT email FROM sessions WHERE session_token=${token} AND session_expires > now()`;
        if (sess.length) {
          const prefix = `sess:${sess[0].email}:`;
          const ids = bills.map(b => b.id);
          const rows = await sql`
            SELECT bill_id FROM votes
            WHERE identity LIKE ${prefix + "%"} AND bill_id = ANY(${ids})`;
          votedBillIds = rows.map(r => r.bill_id);
        }
      } catch {}
    }

    return res.status(200).json({
      bills,
      offset,
      pageSize: PAGE_SIZE,
      totalCount,
      hasMore: totalCount != null ? offset + PAGE_SIZE < totalCount : bills.length === PAGE_SIZE,
      votedBillIds,
    });
  } catch (err) {
    return res.status(500).json({ error: "bills_list_failed", detail: String(err.message || err) });
  }
}

async function browseBills(offset) {
  const data = await cg(`/bill/${CONGRESS}`, {
    sort: "latestAction", direction: "desc", limit: PAGE_SIZE, offset,
  });

  const bills = [];
  for (const b of (data.bills || [])) {
    const type = String(b.type || "").toLowerCase();
    if (!BILL_TYPES.includes(type) || !b.number) continue;
    if ((b.latestAction?.actionDate || "") < "2025-01-01") continue;

    bills.push({
      id: `${type}-${b.number}-${CONGRESS}`,
      type, number: b.number,
      title: b.title || `${b.type} ${b.number}`,
      latestAction: b.latestAction?.text || "",
      actionDate: b.latestAction?.actionDate || "",
      policyArea: b.policyArea?.name || "",
    });
  }

  return { bills, totalCount: data.pagination?.count ?? null };
}

async function searchBills(q, offset) {
  const like = `%${q}%`;
  const rows = await sql`
    SELECT id, type, number, title,
           policy_area AS "policyArea", latest_action AS "latestAction", action_date AS "actionDate",
           COUNT(*) OVER() AS "totalCount"
    FROM bills
    WHERE is_active AND (title ILIKE ${like} OR policy_area ILIKE ${like})
    ORDER BY action_date DESC, id DESC
    LIMIT ${PAGE_SIZE} OFFSET ${offset}`;

  const totalCount = rows.length ? Number(rows[0].totalCount) : null;
  const bills = rows.map(({ totalCount: _totalCount, ...b }) => b);
  return { bills, totalCount };
}

async function cg(path, params = {}) {
  const qs = new URLSearchParams({ format: "json", api_key: CONGRESS_API_KEY, ...params });
  const r = await fetch(`https://api.congress.gov/v3${path}?${qs}`);
  if (!r.ok) throw new Error(`congress ${r.status} on ${path}`);
  return r.json();
}
