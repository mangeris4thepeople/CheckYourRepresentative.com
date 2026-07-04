// =============================================================================
// GET /api/sync-bills - daily cache refresh of every active bill in the
// 119th Congress into our own `bills` table.
//
// Congress.gov has no way to ask "give me bills this account has not voted
// on yet" since it knows nothing about our votes table. Walking its live,
// paginated list on every click and skipping voted ones in application code
// does not scale once someone has voted on a few hundred bills. So instead
// we mirror the whole active bill list into Postgres once a day (this
// function, wired up as a cron in vercel.json), and the vote queue endpoints
// do a real NOT EXISTS join against votes at the database level.
//
// Bulk upserts one page (250 bills) at a time via unnest(), not one row at a
// time, so a full sync stays well under the function's time limit.
// =============================================================================
import { sql, hasDb } from "./_db.js";

const CONGRESS = 119;
const CONGRESS_API_KEY = process.env.CONGRESS_API_KEY;
const BILL_TYPES = ["hr", "s", "hjres", "sjres", "hres", "sres"];
const PAGE_SIZE = 250; // Congress.gov's max limit per request
const CONCURRENCY = 8; // parallel Congress.gov requests per batch
const ACTIVE_SINCE = "2025-01-01"; // start of the 119th Congress, matches bills-list.js and digest.js
const MAX_PAGES = 150; // safety cap, comfortably above one Congress's real page count

export default async function handler(req, res) {
  if (!CONGRESS_API_KEY) return res.status(500).json({ error: "CONGRESS_API_KEY not set" });
  if (!hasDb) return res.status(500).json({ error: "no database configured" });

  try {
    await ensureTable();

    const first = await cg("/bill/" + CONGRESS, { sort: "latestAction", direction: "desc", limit: PAGE_SIZE, offset: 0 });
    const apiTotal = first.pagination?.count || 0;
    const total = Math.min(apiTotal, MAX_PAGES * PAGE_SIZE);

    let scanned = 0, stored = 0;

    const storePage = async (data) => {
      const rows = [];
      for (const b of (data.bills || [])) {
        const type = String(b.type || "").toLowerCase();
        if (!BILL_TYPES.includes(type) || !b.number) continue;
        const actionDate = b.latestAction?.actionDate || null;
        if (!actionDate || actionDate < ACTIVE_SINCE) continue;
        rows.push({
          id: `${type}-${b.number}-${CONGRESS}`,
          type, number: String(b.number), congress: CONGRESS,
          title: b.title || `${b.type} ${b.number}`,
          policyArea: b.policyArea?.name || "",
          latestAction: b.latestAction?.text || "",
          actionDate,
          isActive: true,
        });
      }
      scanned += (data.bills || []).length;
      stored += await upsertBills(rows);
    };

    await storePage(first);

    const remainingOffsets = [];
    for (let o = PAGE_SIZE; o < total; o += PAGE_SIZE) remainingOffsets.push(o);

    for (let i = 0; i < remainingOffsets.length; i += CONCURRENCY) {
      const batch = remainingOffsets.slice(i, i + CONCURRENCY);
      const pages = await Promise.allSettled(
        batch.map(offset => cg("/bill/" + CONGRESS, { sort: "latestAction", direction: "desc", limit: PAGE_SIZE, offset }))
      );
      for (const p of pages) {
        if (p.status === "fulfilled") await storePage(p.value);
      }
    }

    return res.status(200).json({ ok: true, totalFromApi: apiTotal, scanned, stored });
  } catch (err) {
    return res.status(500).json({ error: "sync_failed", detail: String(err.message || err) });
  }
}

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS bills (
      id            TEXT PRIMARY KEY,
      type          TEXT NOT NULL,
      number        TEXT NOT NULL,
      congress      INT NOT NULL,
      title         TEXT,
      policy_area   TEXT,
      latest_action TEXT,
      action_date   DATE,
      is_active     BOOLEAN NOT NULL DEFAULT TRUE,
      synced_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_bills_active_action ON bills (is_active, action_date DESC, id DESC)`;
}

async function upsertBills(rows) {
  if (!rows.length) return 0;
  await sql.query(
    `INSERT INTO bills (id, type, number, congress, title, policy_area, latest_action, action_date, is_active, synced_at)
     SELECT *, now() FROM unnest(
       $1::text[], $2::text[], $3::text[], $4::int[],
       $5::text[], $6::text[], $7::text[], $8::date[], $9::bool[]
     ) AS t(id, type, number, congress, title, policy_area, latest_action, action_date, is_active)
     ON CONFLICT (id) DO UPDATE SET
       title = EXCLUDED.title,
       policy_area = EXCLUDED.policy_area,
       latest_action = EXCLUDED.latest_action,
       action_date = EXCLUDED.action_date,
       is_active = EXCLUDED.is_active,
       synced_at = now()`,
    [
      rows.map(r => r.id),
      rows.map(r => r.type),
      rows.map(r => r.number),
      rows.map(r => r.congress),
      rows.map(r => r.title),
      rows.map(r => r.policyArea),
      rows.map(r => r.latestAction),
      rows.map(r => r.actionDate),
      rows.map(r => r.isActive),
    ]
  );
  return rows.length;
}

async function cg(path, params = {}) {
  const qs = new URLSearchParams({ format: "json", api_key: CONGRESS_API_KEY, ...params });
  const r = await fetch(`https://api.congress.gov/v3${path}?${qs}`);
  if (!r.ok) throw new Error(`congress ${r.status} on ${path}`);
  return r.json();
}
