// =============================================================================
// GET /api/sync-bills - cache refresh of every active bill in the 119th
// Congress into our own `bills` table.
//
// Congress.gov has no way to ask "give me bills this account has not voted
// on yet" since it knows nothing about our votes table. Walking its live,
// paginated list on every click and skipping voted ones in application code
// does not scale once someone has voted on a few hundred bills. So instead
// we mirror the whole active bill list into Postgres (this function, wired
// up as a daily cron in vercel.json), and the vote queue endpoints do a real
// NOT EXISTS join against votes at the database level.
//
// A full pass is thousands of bills across dozens of Congress.gov pages,
// which does not fit inside one serverless invocation's time limit. So this
// resumes from a persisted offset each call: process pages until close to
// the time budget, save how far it got, and the next invocation continues
// from there. Reaching the end resets the offset to 0, so the next call
// starts a fresh pass instead of needing a separate reset step.
//
// The Vercel plan this project runs on only allows a cron to fire once a
// day, so if a full pass needs more than one invocation's worth of time
// (it usually will, the first time), call this endpoint by hand a few more
// times to finish the initial catch up. After that, one daily cron call
// keeps advancing the same resumable cursor.
// =============================================================================
import { sql, hasDb } from "../_db.js";

const CONGRESS = 119;
const CONGRESS_API_KEY = process.env.CONGRESS_API_KEY;
const BILL_TYPES = ["hr", "s", "hjres", "sjres", "hres", "sres"];
const PAGE_SIZE = 250; // Congress.gov's max limit per request
const CONCURRENCY = 8; // parallel Congress.gov requests per batch
const ACTIVE_SINCE = "2025-01-01"; // start of the 119th Congress, matches bills-list.js and digest.js
const MAX_PAGES = 150; // safety cap, comfortably above one Congress's real page count
const TIME_BUDGET_MS = 45000; // leaves margin below the platform's hard invocation limit

export default async function handler(req, res) {
  if (!CONGRESS_API_KEY) return res.status(500).json({ error: "CONGRESS_API_KEY not set" });
  if (!hasDb) return res.status(500).json({ error: "no database configured" });

  const startedAt = Date.now();
  const outOfTime = () => Date.now() - startedAt > TIME_BUDGET_MS;

  try {
    await ensureTables();

    const startOffset = await getOffset();
    const first = await cg("/bill/" + CONGRESS, { sort: "latestAction", direction: "desc", limit: PAGE_SIZE, offset: startOffset });
    const apiTotal = first.pagination?.count || 0;
    const total = Math.min(apiTotal, MAX_PAGES * PAGE_SIZE);

    let scanned = 0, stored = 0, lastOffsetDone = startOffset;

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
    lastOffsetDone = startOffset + PAGE_SIZE;

    const remainingOffsets = [];
    for (let o = startOffset + PAGE_SIZE; o < total; o += PAGE_SIZE) remainingOffsets.push(o);

    let reachedEnd = lastOffsetDone >= total;

    for (let i = 0; i < remainingOffsets.length && !outOfTime(); i += CONCURRENCY) {
      const batch = remainingOffsets.slice(i, i + CONCURRENCY);
      const pages = await Promise.allSettled(
        batch.map(offset => cg("/bill/" + CONGRESS, { sort: "latestAction", direction: "desc", limit: PAGE_SIZE, offset }))
      );
      for (const p of pages) {
        if (p.status === "fulfilled") await storePage(p.value);
      }
      lastOffsetDone = batch[batch.length - 1] + PAGE_SIZE;
      reachedEnd = lastOffsetDone >= total;
    }

    await setOffset(reachedEnd ? 0 : lastOffsetDone);

    return res.status(200).json({
      ok: true,
      totalFromApi: apiTotal,
      startedAtOffset: startOffset,
      resumeAtOffset: reachedEnd ? 0 : lastOffsetDone,
      passComplete: reachedEnd,
      scanned,
      stored,
    });
  } catch (err) {
    return res.status(500).json({ error: "sync_failed", detail: String(err.message || err) });
  }
}

async function ensureTables() {
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
  await sql`
    CREATE TABLE IF NOT EXISTS sync_state (
      key        TEXT PRIMARY KEY,
      value      TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
}

async function getOffset() {
  const rows = await sql`SELECT value FROM sync_state WHERE key = 'bills_sync_offset'`;
  const n = rows.length ? parseInt(rows[0].value, 10) : 0;
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

async function setOffset(offset) {
  await sql`
    INSERT INTO sync_state (key, value, updated_at)
    VALUES ('bills_sync_offset', ${String(offset)}, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
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
