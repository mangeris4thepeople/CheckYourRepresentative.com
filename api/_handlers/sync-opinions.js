// =============================================================================
// GET /api/cron?op=sync-opinions - mirror opinions authored by tracked judges.
//
// Walks every judge in national_judges and pulls their authored opinions
// from CourtListener's opinions endpoint (auth required, verified live).
// Same crawl discipline as sync-national-judges: 7 seconds between requests
// for the 10 per minute rate limit, 429s wait out their advertised cooldown,
// a cursor in sync_state resumes across invocations, and incomplete runs
// chain themselves so one trigger walks the whole pass.
//
// Stored per opinion: CourtListener id, type (lead, concurrence, dissent,
// and so on), date, case name (from the opinion's own URL slug), and the
// URL. Outcome, precedential status, and citation counts live on cluster
// records CourtListener does not embed here, so those columns stay NULL
// until a cluster pass exists; the UI says so rather than hiding it.
//
// A completed pass rests for six days before recrawling, so the daily cron
// keeps data at most a week old without hammering the source.
// =============================================================================
import { sql, hasDb } from "../_db.js";

const CL_TOKEN = process.env.COURTLISTENER_API_TOKEN;
const CL_BASE = "https://www.courtlistener.com/api/rest/v4";
const TIME_BUDGET_MS = 40000;
const REQUEST_GAP_MS = 7000;
const CURSOR_KEY = "opinions_cursor";
const DONE_KEY = "opinions_pass_done_at";
const REST_DAYS = 6;
const MAX_PAGES_PER_JUDGE = 10;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Case name from the opinion's absolute_url slug, e.g.
// /opinion/4801234/state-v-smith/ becomes "State v. Smith".
function caseNameFromUrl(absoluteUrl) {
  const m = String(absoluteUrl || "").match(/\/opinion\/\d+\/([^/]+)\//);
  if (!m) return null;
  return m[1]
    .split("-")
    .map(w => (w === "v" ? "v." : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ")
    .slice(0, 200) || null;
}

export default async function handler(req, res) {
  if (!hasDb) return res.status(500).json({ error: "no database configured" });
  if (!CL_TOKEN) return res.status(500).json({ error: "COURTLISTENER_API_TOKEN not set" });

  const startedAt = Date.now();
  const outOfTime = () => Date.now() - startedAt > TIME_BUDGET_MS;

  try {
    await ensureSchema();

    // Rest between completed passes.
    const doneAt = await getState(DONE_KEY);
    const cursorRaw = await getState(CURSOR_KEY);
    if (!cursorRaw && doneAt) {
      const ageDays = (Date.now() - new Date(doneAt).getTime()) / 86400000;
      if (ageDays < REST_DAYS) {
        return res.status(200).json({ ok: true, resting: true, lastPassAt: doneAt });
      }
    }
    let afterPersonId = cursorRaw ? parseInt(cursorRaw, 10) || 0 : 0;

    let judgesDone = 0, opinionsStored = 0;
    let lastFetchAt = 0;
    const errors = [];

    while (!outOfTime()) {
      const judge = (await sql`
        SELECT cl_person_id FROM national_judges
        WHERE active AND cl_person_id > ${afterPersonId}
        ORDER BY cl_person_id ASC LIMIT 1`)[0];
      if (!judge) {
        await setState(CURSOR_KEY, null);
        await setState(DONE_KEY, new Date().toISOString());
        const totals = (await sql`SELECT count(*)::int AS n FROM judicial_opinions`)[0];
        return res.status(200).json({
          ok: true, passComplete: true, judgesDone, opinionsStored,
          totalOpinions: totals.n, errors: errors.slice(0, 10),
        });
      }

      let url = `${CL_BASE}/opinions/?author=${judge.cl_person_id}&page_size=50`;
      let pages = 0;
      let judgeFailed = false;

      while (url && pages < MAX_PAGES_PER_JUDGE && !outOfTime()) {
        const sinceLast = Date.now() - lastFetchAt;
        if (sinceLast < REQUEST_GAP_MS) await sleep(REQUEST_GAP_MS - sinceLast);
        lastFetchAt = Date.now();

        const r = await fetch(url, { headers: { Authorization: `Token ${CL_TOKEN}` } });
        if (r.status === 429) {
          const m = (await r.text().catch(() => "")).match(/(\d+)\s*second/);
          const waitMs = (m ? parseInt(m[1], 10) + 2 : 65) * 1000;
          if (Date.now() - startedAt + waitMs < TIME_BUDGET_MS) { await sleep(waitMs); continue; }
          judgeFailed = true;
          break;
        }
        if (!r.ok) {
          const body = await r.text().catch(() => "");
          errors.push(`person ${judge.cl_person_id}: ${r.status} ${body.slice(0, 80)}`);
          judgeFailed = true;
          break;
        }
        const data = await r.json();
        for (const op of data.results || []) {
          try {
            if (!op.id) continue;
            const absUrl = op.absolute_url ? `https://www.courtlistener.com${op.absolute_url}` : null;
            const date = (op.date_created || "").slice(0, 10) || null;
            await sql`
              INSERT INTO judicial_opinions
                (cl_opinion_id, cl_person_id, opinion_type, date_filed, case_name,
                 precedential_status, outcome, citation_count, url, synced_at)
              VALUES
                (${op.id}, ${judge.cl_person_id}, ${op.type || null}, ${date},
                 ${caseNameFromUrl(op.absolute_url)}, NULL, NULL, NULL, ${absUrl}, now())
              ON CONFLICT (cl_opinion_id) DO UPDATE SET
                opinion_type = EXCLUDED.opinion_type, date_filed = EXCLUDED.date_filed,
                case_name = EXCLUDED.case_name, url = EXCLUDED.url, synced_at = now()`;
            opinionsStored++;
          } catch (err) {
            errors.push(`opinion ${op.id}: ${String(err.message || err).slice(0, 80)}`);
          }
        }
        url = data.next || null;
        pages++;
      }

      // Advance past this judge once their pages are exhausted, capped
      // (deep authors get more on the next weekly pass), or errored (skip
      // rather than stall the crawl). Running out of time mid-judge leaves
      // the cursor put, and the idempotent upserts make the redo harmless.
      const finished = !url || pages >= MAX_PAGES_PER_JUDGE || judgeFailed;
      if (finished) {
        afterPersonId = judge.cl_person_id;
        await setState(CURSOR_KEY, String(afterPersonId));
        judgesDone++;
      }
      if (judgeFailed && errors.length >= 20) break;
    }

    // Chain the next chunk, same guard as the judges crawl.
    let chained = false;
    if (errors.length < 20 && process.env.CRON_SECRET) {
      const host = req.headers["x-forwarded-host"] || req.headers.host;
      if (host) {
        const selfUrl = `https://${host}/api/cron?op=sync-opinions&key=${process.env.CRON_SECRET}`;
        await fetch(selfUrl, { signal: AbortSignal.timeout(2000) }).catch(() => {});
        chained = true;
      }
    }

    const totals = (await sql`SELECT count(*)::int AS n FROM judicial_opinions`)[0];
    return res.status(200).json({
      ok: true, passComplete: false, chained, judgesDone, opinionsStored,
      totalOpinions: totals.n, errors: errors.slice(0, 10),
    });
  } catch (err) {
    return res.status(500).json({ error: "sync_opinions_failed", detail: String(err.message || err) });
  }
}

async function getState(key) {
  const rows = await sql`SELECT value FROM sync_state WHERE key = ${key}`;
  return rows.length ? rows[0].value : null;
}

async function setState(key, value) {
  await sql`
    INSERT INTO sync_state (key, value, updated_at)
    VALUES (${key}, ${value}, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
}

async function ensureSchema() {
  const EXPECTED = ["cl_opinion_id", "cl_person_id", "opinion_type", "date_filed", "case_name",
    "precedential_status", "outcome", "citation_count", "url", "synced_at"];
  const table = await sql`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'judicial_opinions'`;
  if (table.length) {
    const cols = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'judicial_opinions'`;
    const have = new Set(cols.map(c => c.column_name));
    const mismatch = EXPECTED.some(c => !have.has(c)) || have.size !== EXPECTED.length;
    if (mismatch) await sql`DROP TABLE judicial_opinions CASCADE`;
  }
  await sql`
    CREATE TABLE IF NOT EXISTS judicial_opinions (
      cl_opinion_id        BIGINT PRIMARY KEY,
      cl_person_id         INT NOT NULL,
      opinion_type         TEXT,
      date_filed           DATE,
      case_name            TEXT,
      precedential_status  TEXT,
      outcome              TEXT,
      citation_count       INT,
      url                  TEXT,
      synced_at            TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_opinions_person ON judicial_opinions (cl_person_id)`;
  await sql`
    CREATE TABLE IF NOT EXISTS sync_state (
      key        TEXT PRIMARY KEY,
      value      TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
}
