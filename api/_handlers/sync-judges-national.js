// =============================================================================
// GET /api/cron?op=sync-judges-national - the National Judge Directory sync.
//
// Covers what CourtListener actually covers well nationwide: the federal
// judiciary (Supreme Court, circuit courts of appeals, district courts, and
// the standing specialty courts) plus every state's supreme and intermediate
// appellate courts. State trial courts are deliberately excluded for the same
// reason sync-judges.js excludes Colorado's: CourtListener's trial-court
// coverage is too thin to trust as a directory source. Colorado's trial
// judges keep arriving through the OJPE import instead.
//
// Two phases, one op:
//   1. Court refresh: when nat_courts is empty (or ?courts=1 forces it) the
//      full CourtListener court list is paged through and the in-use courts
//      in the jurisdictions above are upserted, with a US state derived from
//      the court name. No server-side filters beyond page_size: the courts
//      endpoint's filter whitelist is unverified and CourtListener hard-fails
//      unknown filter params (verified live on /positions/), so filtering
//      happens client side.
//   2. Judge batch: there are ~300 covered courts and a 60s function cap, so
//      each run syncs only the stalest courts (judges_synced_at ASC, never-
//      synced first) and stops starting new courts once the time budget is
//      spent. The daily cron therefore works through the whole directory in
//      rolling passes; manual runs with ?key=&batch=40 backfill faster.
//
// Schema: ensureSchema() below creates everything idempotently on every run,
// same self-healing pattern as sync-judges.js. sql/national_judge_schema.sql
// mirrors this DDL for local use. Keep the two in sync.
//
// Requires: COURTLISTENER_API_TOKEN. Reached only through api/cron.js, so
// CRON_SECRET already gates this.
// =============================================================================
import { sql, hasDb } from "../_db.js";

const CL_TOKEN = process.env.COURTLISTENER_API_TOKEN;
const CL_BASE = "https://www.courtlistener.com/api/rest/v4";
const PAGE_SIZE = 50;
const MAX_PAGES_PER_COURT = 4;
const TIME_BUDGET_MS = 42_000; // maxDuration is 60s; leave room for the court in flight
const DEFAULT_BATCH = 10;

// CourtListener jurisdiction codes this directory includes.
const JURISDICTIONS = {
  F: "Federal Appellate",
  FD: "Federal District",
  FS: "Federal Specialty",
  S: "State Supreme",
  SA: "State Appellate",
  TS: "Territory Supreme",
  TA: "Territory Appellate",
};

export default async function handler(req, res) {
  if (!hasDb) return res.status(500).json({ error: "no database configured" });
  if (!CL_TOKEN) return res.status(500).json({ error: "COURTLISTENER_API_TOKEN not set" });

  const startedAt = Date.now();
  try {
    await ensureSchema();

    const [{ n: courtCount }] = await sql`SELECT count(*)::int AS n FROM nat_courts`;
    let courtsRefreshed = false;
    let unmatchedCourts = [];
    if (courtCount === 0 || req.query.courts === "1") {
      unmatchedCourts = await refreshCourts();
      courtsRefreshed = true;
    }

    const batchSize = Math.min(40, Math.max(1, parseInt(req.query.batch, 10) || DEFAULT_BATCH));
    const courts = await sql`
      SELECT id, courtlistener_id, name FROM nat_courts
      ORDER BY judges_synced_at ASC NULLS FIRST, id ASC
      LIMIT ${batchSize}`;

    let synced = 0;
    const perCourt = [];
    for (const court of courts) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) break;
      const result = await syncCourt(court);
      await sql`UPDATE nat_courts SET judges_synced_at = now() WHERE id = ${court.id}`;
      synced += result.synced;
      perCourt.push({ court: court.name, ...result });
    }

    const [{ n: totalCourts }] = await sql`SELECT count(*)::int AS n FROM nat_courts`;
    const [{ n: pending }] = await sql`
      SELECT count(*)::int AS n FROM nat_courts WHERE judges_synced_at IS NULL`;

    return res.status(200).json({
      ok: true, courtsRefreshed, totalCourts, courtsNeverSynced: pending,
      courtsThisRun: perCourt.length, synced, perCourt,
      ...(unmatchedCourts.length ? { unmatchedCourts } : {}),
    });
  } catch (err) {
    return res.status(500).json({ error: "sync_judges_national_failed", detail: String(err.message || err) });
  }
}

// ---- phase 1: the court list ----

async function refreshCourts() {
  const unmatched = [];
  let url = `${CL_BASE}/courts/?page_size=${PAGE_SIZE}`;
  while (url) {
    const data = await cl(url);
    for (const c of data.results || []) {
      if (!c.in_use || !JURISDICTIONS[c.jurisdiction]) continue;
      const name = c.full_name || c.short_name || c.id;
      const state = stateOf(name);
      // A state-level court whose name matches no state would be unreachable
      // in the state-scoped UI; surface it in the run report instead of
      // silently filing it nowhere.
      if (!state && /^(S|SA|TS|TA)$/.test(c.jurisdiction)) unmatched.push(name);
      await sql`
        INSERT INTO nat_courts (courtlistener_id, name, jurisdiction, state)
        VALUES (${c.id}, ${name}, ${c.jurisdiction}, ${state})
        ON CONFLICT (courtlistener_id) DO UPDATE SET
          name = EXCLUDED.name, jurisdiction = EXCLUDED.jurisdiction, state = EXCLUDED.state`;
    }
    url = data.next || null;
  }
  return unmatched;
}

// Longest, most specific names first so "West Virginia" never resolves as
// Virginia. Matching is case sensitive on purpose: it keeps "Kansas" from
// matching inside "Arkansas". "Hawai" covers both the Hawaii and Hawaiʻi
// spellings CourtListener uses. Nationwide federal courts (circuits, the
// Supreme Court, the specialty courts) match nothing and stay NULL, which is
// what the API's state='US' scope selects on.
const STATE_PATTERNS = [
  ["District of Columbia", "DC"], ["West Virginia", "WV"], ["North Carolina", "NC"],
  ["South Carolina", "SC"], ["North Dakota", "ND"], ["South Dakota", "SD"],
  ["New Hampshire", "NH"], ["New Jersey", "NJ"], ["New Mexico", "NM"],
  ["New York", "NY"], ["Rhode Island", "RI"], ["Puerto Rico", "PR"],
  ["Virgin Islands", "VI"], ["American Samoa", "AS"], ["Northern Mariana", "MP"],
  ["Guam", "GU"],
  ["Alabama", "AL"], ["Alaska", "AK"], ["Arizona", "AZ"], ["Arkansas", "AR"],
  ["California", "CA"], ["Colorado", "CO"], ["Connecticut", "CT"], ["Delaware", "DE"],
  ["Florida", "FL"], ["Georgia", "GA"], ["Hawai", "HI"], ["Idaho", "ID"],
  ["Illinois", "IL"], ["Indiana", "IN"], ["Iowa", "IA"], ["Kansas", "KS"],
  ["Kentucky", "KY"], ["Louisiana", "LA"], ["Maine", "ME"], ["Maryland", "MD"],
  ["Massachusetts", "MA"], ["Michigan", "MI"], ["Minnesota", "MN"], ["Mississippi", "MS"],
  ["Missouri", "MO"], ["Montana", "MT"], ["Nebraska", "NE"], ["Nevada", "NV"],
  ["Ohio", "OH"], ["Oklahoma", "OK"], ["Oregon", "OR"], ["Pennsylvania", "PA"],
  ["Tennessee", "TN"], ["Texas", "TX"], ["Utah", "UT"], ["Vermont", "VT"],
  ["Virginia", "VA"], ["Washington", "WA"], ["Wisconsin", "WI"], ["Wyoming", "WY"],
];

function stateOf(name) {
  for (const [pattern, code] of STATE_PATTERNS) {
    if (name.includes(pattern)) return code;
  }
  return null;
}

// ---- phase 2: judges, court by court ----

// Same verified access pattern as sync-judges.js: date_termination__isnull is
// not an allowed filter on /positions/, so everything is fetched newest first
// and filtered client side, which also keeps sitting judges on the first
// pages ahead of the historical record.
async function syncCourt(court) {
  let synced = 0;
  const errors = [];
  const personCache = new Map();

  let url = `${CL_BASE}/positions/?court=${encodeURIComponent(court.courtlistener_id)}` +
    `&page_size=${PAGE_SIZE}&order_by=-id`;

  for (let page = 0; page < MAX_PAGES_PER_COURT && url; page++) {
    const data = await cl(url);
    for (const pos of data.results || []) {
      try {
        if (pos.date_termination) {
          // A judge who left this court shows up here as a terminated
          // position, newest first, before their old active row is ever
          // touched again. Retire the stored row without paying a person
          // fetch: the person id is recoverable from the reference itself.
          const pid = personIdOf(pos.person);
          if (pid) {
            await sql`
              UPDATE nat_judges SET active = FALSE, date_termination = ${pos.date_termination}, synced_at = now()
              WHERE courtlistener_person_id = ${pid} AND court_id = ${court.id} AND active`;
          }
          continue;
        }
        const person = await resolvePerson(pos.person, personCache);
        if (!person) continue;
        const name = personName(person);
        if (!name) continue;

        await sql`
          INSERT INTO nat_judges
            (courtlistener_person_id, full_name, court_id, position_title,
             appointed_by, date_start, date_termination, active, synced_at)
          VALUES
            (${person.id}, ${name}, ${court.id}, ${positionTitle(pos)},
             ${pos.appointer_str || null}, ${pos.date_start || null}, ${pos.date_termination || null},
             ${!pos.date_termination}, now())
          ON CONFLICT (courtlistener_person_id) DO UPDATE SET
            full_name = EXCLUDED.full_name, court_id = EXCLUDED.court_id,
            position_title = EXCLUDED.position_title, appointed_by = EXCLUDED.appointed_by,
            date_start = EXCLUDED.date_start, date_termination = EXCLUDED.date_termination,
            active = EXCLUDED.active, synced_at = now()`;
        synced++;
      } catch (err) {
        errors.push(String(err.message || err).slice(0, 120));
      }
    }
    url = data.next || null;
  }

  return { synced, errors };
}

// A position's person field can arrive as a nested object or as an API URL
// depending on endpoint version and query params. Handle both, and cache
// fetches within a run: senior-plus-active double positions are common.
async function resolvePerson(person, cache) {
  if (!person) return null;
  if (typeof person === "object" && person.id) return person;
  if (typeof person === "string") {
    if (cache.has(person)) return cache.get(person);
    const data = await cl(person.startsWith("http") ? person : `${CL_BASE}${person}`);
    const resolved = data && data.id ? data : null;
    cache.set(person, resolved);
    return resolved;
  }
  return null;
}

function personIdOf(person) {
  if (!person) return null;
  if (typeof person === "object" && person.id) return person.id;
  if (typeof person === "string") {
    const m = person.match(/\/people\/(\d+)\//);
    if (m) return parseInt(m[1], 10);
  }
  return null;
}

function personName(p) {
  const parts = [p.name_first, p.name_middle, p.name_last].filter(Boolean).join(" ").trim();
  const suffix = p.name_suffix ? ` ${p.name_suffix}` : "";
  return (parts + suffix).trim() || null;
}

// CourtListener position_type is a short code (verified live: "jud"), with
// job_title usually empty for state judges. Map the common codes to plain
// English and fall back to whatever the API sent.
const POSITION_TITLES = {
  "jud": "Judge", "c-jud": "Chief Judge", "act-jud": "Acting Judge",
  "jus": "Justice", "c-jus": "Chief Justice", "act-jus": "Acting Justice",
  "ret-jus": "Retired Justice", "ret-act-jus": "Retired Acting Justice",
  "mag": "Magistrate Judge", "c-mag": "Chief Magistrate Judge",
  "pres-jud": "Presiding Judge", "sen-jud": "Senior Judge",
};

function positionTitle(pos) {
  if (pos.job_title) return pos.job_title;
  if (pos.position_type) return POSITION_TITLES[pos.position_type] || pos.position_type;
  return null;
}

async function cl(url) {
  const r = await fetch(url, { headers: { Authorization: `Token ${CL_TOKEN}` } });
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(`CourtListener ${r.status} on ${url.slice(0, 120)}: ${body.slice(0, 160)}`);
  }
  return r.json();
}

// ---- schema, mirrored in sql/national_judge_schema.sql ----
async function ensureSchema() {
  // Same legacy-drift guard as sync-judges.js: a pre-existing table with a
  // different shape silently defeats CREATE TABLE IF NOT EXISTS and then
  // breaks every ON CONFLICT. Anything not exactly this shape gets rebuilt;
  // both tables are pure sync mirrors, so a rebuild costs one backfill pass.
  const EXPECTED = {
    nat_courts: ["id", "courtlistener_id", "name", "jurisdiction", "state", "judges_synced_at"],
    nat_judges: ["id", "courtlistener_person_id", "full_name", "court_id", "position_title",
      "appointed_by", "date_start", "date_termination", "active", "synced_at"],
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
    CREATE TABLE IF NOT EXISTS nat_courts (
      id                 SERIAL PRIMARY KEY,
      courtlistener_id   TEXT NOT NULL UNIQUE,
      name               TEXT NOT NULL,
      jurisdiction       TEXT NOT NULL,
      state              TEXT,
      judges_synced_at   TIMESTAMPTZ
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS nat_judges (
      id                        SERIAL PRIMARY KEY,
      courtlistener_person_id   INT UNIQUE,
      full_name                 TEXT NOT NULL,
      court_id                  INT REFERENCES nat_courts(id),
      position_title            TEXT,
      appointed_by              TEXT,
      date_start                DATE,
      date_termination          DATE,
      active                    BOOLEAN NOT NULL DEFAULT TRUE,
      synced_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;

  await sql`CREATE UNIQUE INDEX IF NOT EXISTS nat_courts_cl_uq ON nat_courts (courtlistener_id)`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS nat_judges_person_uq ON nat_judges (courtlistener_person_id)`;
  await sql`CREATE INDEX IF NOT EXISTS nat_judges_court_idx ON nat_judges (court_id)`;
  await sql`CREATE INDEX IF NOT EXISTS nat_judges_name_idx ON nat_judges (full_name)`;
  await sql`CREATE INDEX IF NOT EXISTS nat_courts_state_idx ON nat_courts (state)`;
}
