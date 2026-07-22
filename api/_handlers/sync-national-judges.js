// =============================================================================
// GET /api/cron?op=sync-national-judges - national judge registry crawler.
//
// Crawls CourtListener's positions API across every state court jurisdiction
// (S supreme, SA appellate, ST trial, SS special) and mirrors sitting judges
// into national_judges with their court in national_courts. Positions arrive
// with the person and court embedded (verified live), so one page of results
// is one request. Terminated positions are skipped client side because the
// API rejects the date_termination__isnull filter (verified live).
//
// Entirely additive: separate tables from the Colorado directory, which
// keeps its own richer pipeline (OJPE evaluations, certified retention).
//
// The full crawl is far larger than one function invocation, so this is
// resumable exactly like sync-senator-finances: a cursor in sync_state
// stores the next page URL and jurisdiction index, each run consumes its
// time budget and reports resume state, and a daily cron entry keeps
// chipping away until passComplete, then refreshes continuously.
//
// If the API ever rejects court__jurisdiction as a filter, the crawler
// flips itself to one unfiltered pass and filters by the embedded court's
// jurisdiction client side.
// =============================================================================
import { sql, hasDb } from "../_db.js";

const CL_TOKEN = process.env.COURTLISTENER_API_TOKEN;
const CL_BASE = "https://www.courtlistener.com/api/rest/v4";
const JURISDICTIONS = ["S", "SA", "ST", "SS"];
const STATE_JURIS = new Set(JURISDICTIONS);
const TIME_BUDGET_MS = 40000;
const CURSOR_KEY = "natjudges_cursor";

const STATES = {
  "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR", "California": "CA",
  "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE", "Florida": "FL", "Georgia": "GA",
  "Hawaii": "HI", "Idaho": "ID", "Illinois": "IL", "Indiana": "IN", "Iowa": "IA",
  "Kansas": "KS", "Kentucky": "KY", "Louisiana": "LA", "Maine": "ME", "Maryland": "MD",
  "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN", "Mississippi": "MS", "Missouri": "MO",
  "Montana": "MT", "Nebraska": "NE", "Nevada": "NV", "New Hampshire": "NH", "New Jersey": "NJ",
  "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "North Dakota": "ND", "Ohio": "OH",
  "Oklahoma": "OK", "Oregon": "OR", "Pennsylvania": "PA", "Rhode Island": "RI", "South Carolina": "SC",
  "South Dakota": "SD", "Tennessee": "TN", "Texas": "TX", "Utah": "UT", "Vermont": "VT",
  "Virginia": "VA", "Washington": "WA", "West Virginia": "WV", "Wisconsin": "WI", "Wyoming": "WY",
  "District of Columbia": "DC", "Puerto Rico": "PR", "Guam": "GU", "Virgin Islands": "VI",
  "American Samoa": "AS", "Northern Mariana": "MP",
};

function stateFromCourtName(name) {
  const s = String(name || "");
  for (const [full, abbr] of Object.entries(STATES)) {
    if (s.includes(full)) return abbr;
  }
  return null;
}

const POSITION_TITLES = {
  "jud": "Judge", "c-jud": "Chief Judge", "act-jud": "Acting Judge",
  "jus": "Justice", "c-jus": "Chief Justice", "act-jus": "Acting Justice",
  "ret-jus": "Retired Justice", "ret-act-jus": "Retired Acting Justice",
  "mag": "Magistrate", "pres-jud": "Presiding Judge",
};

function positionTitle(pos) {
  if (pos.job_title) return pos.job_title;
  if (pos.position_type) return POSITION_TITLES[pos.position_type] || pos.position_type;
  return null;
}

function personName(p) {
  const parts = [p.name_first, p.name_middle, p.name_last].filter(Boolean).join(" ").trim();
  const suffix = p.name_suffix ? ` ${p.name_suffix}` : "";
  return (parts + suffix).trim() || null;
}

export default async function handler(req, res) {
  if (!hasDb) return res.status(500).json({ error: "no database configured" });
  if (!CL_TOKEN) return res.status(500).json({ error: "COURTLISTENER_API_TOKEN not set" });

  const startedAt = Date.now();
  const outOfTime = () => Date.now() - startedAt > TIME_BUDGET_MS;

  try {
    await ensureSchema();

    let cursor = await getCursor();
    if (!cursor) cursor = { mode: "filtered", ji: 0, url: null };

    let processed = 0;
    let skippedTerminated = 0;
    const errors = [];

    while (!outOfTime()) {
      if (cursor.mode === "filtered" && cursor.ji >= JURISDICTIONS.length) break;

      let url = cursor.url;
      if (!url) {
        url = cursor.mode === "filtered"
          ? `${CL_BASE}/positions/?court__jurisdiction=${JURISDICTIONS[cursor.ji]}&page_size=100&order_by=-id`
          : `${CL_BASE}/positions/?page_size=100&order_by=-id`;
      }

      const r = await fetch(url, { headers: { Authorization: `Token ${CL_TOKEN}` } });
      if (r.status === 400 && cursor.mode === "filtered") {
        // Filter rejected: flip to one unfiltered pass and filter client side.
        cursor = { mode: "unfiltered", ji: 0, url: null };
        await setCursor(cursor);
        continue;
      }
      if (!r.ok) {
        const body = await r.text().catch(() => "");
        throw new Error(`CourtListener ${r.status}: ${body.slice(0, 140)}`);
      }
      const data = await r.json();

      for (const pos of data.results || []) {
        try {
          if (pos.date_termination) { skippedTerminated++; continue; }
          const court = pos.court;
          const person = pos.person;
          if (!court || !court.id || !person || !person.id) continue;
          if (cursor.mode === "unfiltered" && !STATE_JURIS.has(court.jurisdiction)) continue;

          await sql`
            INSERT INTO national_courts (cl_id, full_name, jurisdiction, state_abbr)
            VALUES (${court.id}, ${court.full_name || court.short_name || court.id},
                    ${court.jurisdiction || null}, ${stateFromCourtName(court.full_name)})
            ON CONFLICT (cl_id) DO UPDATE SET
              full_name = EXCLUDED.full_name, jurisdiction = EXCLUDED.jurisdiction,
              state_abbr = EXCLUDED.state_abbr`;

          const name = personName(person);
          if (!name) continue;
          await sql`
            INSERT INTO national_judges
              (cl_person_id, full_name, slug, court_cl_id, position_title, date_start, active, synced_at)
            VALUES
              (${person.id}, ${name}, ${person.slug || null}, ${court.id},
               ${positionTitle(pos)}, ${pos.date_start || null}, TRUE, now())
            ON CONFLICT (cl_person_id) DO UPDATE SET
              full_name = EXCLUDED.full_name, slug = EXCLUDED.slug,
              court_cl_id = EXCLUDED.court_cl_id, position_title = EXCLUDED.position_title,
              date_start = EXCLUDED.date_start, active = TRUE, synced_at = now()`;
          processed++;
        } catch (err) {
          errors.push(String(err.message || err).slice(0, 100));
        }
      }

      if (data.next) {
        cursor.url = data.next;
      } else if (cursor.mode === "filtered") {
        cursor.ji += 1;
        cursor.url = null;
        if (cursor.ji >= JURISDICTIONS.length) break;
      } else {
        cursor = null;
        break;
      }
      await setCursor(cursor);
    }

    const passComplete =
      !cursor || (cursor.mode === "filtered" && cursor.ji >= JURISDICTIONS.length);
    if (passComplete) await setCursor(null);
    else await setCursor(cursor);

    const totals = (await sql`
      SELECT count(*)::int AS judges, count(DISTINCT court_cl_id)::int AS courts
      FROM national_judges WHERE active`)[0];

    return res.status(200).json({
      ok: true, processed, skippedTerminated, passComplete,
      totalJudges: totals.judges, totalCourts: totals.courts,
      errors: errors.slice(0, 10),
    });
  } catch (err) {
    return res.status(500).json({ error: "sync_national_judges_failed", detail: String(err.message || err) });
  }
}

async function ensureSchema() {
  const EXPECTED = {
    national_courts: ["cl_id", "full_name", "jurisdiction", "state_abbr"],
    national_judges: ["id", "cl_person_id", "full_name", "slug", "court_cl_id",
      "position_title", "date_start", "active", "synced_at"],
  };
  for (const [t, wanted] of Object.entries(EXPECTED)) {
    const table = await sql`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ${t}`;
    if (!table.length) continue;
    const cols = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${t}`;
    const have = new Set(cols.map(c => c.column_name));
    const mismatch = wanted.some(c => !have.has(c)) || have.size !== wanted.length;
    if (mismatch) await sql.query(`DROP TABLE "${t}" CASCADE`);
  }

  await sql`
    CREATE TABLE IF NOT EXISTS national_courts (
      cl_id         TEXT PRIMARY KEY,
      full_name     TEXT NOT NULL,
      jurisdiction  TEXT,
      state_abbr    TEXT
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS national_judges (
      id              SERIAL PRIMARY KEY,
      cl_person_id    INT NOT NULL UNIQUE,
      full_name       TEXT NOT NULL,
      slug            TEXT,
      court_cl_id     TEXT REFERENCES national_courts(cl_id),
      position_title  TEXT,
      date_start      DATE,
      active          BOOLEAN NOT NULL DEFAULT TRUE,
      synced_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_national_judges_court ON national_judges (court_cl_id)`;
  await sql`
    CREATE TABLE IF NOT EXISTS sync_state (
      key        TEXT PRIMARY KEY,
      value      TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
}

async function getCursor() {
  const rows = await sql`SELECT value FROM sync_state WHERE key = ${CURSOR_KEY}`;
  if (!rows.length || !rows[0].value) return null;
  try { return JSON.parse(rows[0].value); } catch { return null; }
}

async function setCursor(cursor) {
  await sql`
    INSERT INTO sync_state (key, value, updated_at)
    VALUES (${CURSOR_KEY}, ${cursor ? JSON.stringify(cursor) : null}, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
}
