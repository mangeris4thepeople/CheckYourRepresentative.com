// =============================================================================
// GET /api/cron?op=sync-judges - Colorado judicial directory sync.
//
// Pulls sitting judges from the CourtListener REST API (v4) for the Colorado
// courts CourtListener actually covers well: the Supreme Court and the Court
// of Appeals. Trial-level judges (district, Denver Probate, Denver Juvenile)
// are loaded from the OJPE evaluation CSV import instead, because
// CourtListener's coverage of Colorado trial courts is too thin to trust as
// a directory source.
//
// Schema: ensureSchema() below creates and seeds everything idempotently on
// every run, same self-healing pattern as sync-senators and
// sync-senator-finances, so the first triggered run against a fresh database
// also applies the schema. sql/know_your_judge_schema.sql mirrors this DDL
// for local use. Keep the two in sync.
//
// Requires: COURTLISTENER_API_TOKEN (free from courtlistener.com).
// Reached only through api/cron.js, so CRON_SECRET already gates this.
// =============================================================================
import { sql, hasDb } from "../_db.js";

const CL_TOKEN = process.env.COURTLISTENER_API_TOKEN;
const CL_BASE = "https://www.courtlistener.com/api/rest/v4";
const PAGE_SIZE = 50;
const MAX_PAGES_PER_COURT = 4;

export default async function handler(req, res) {
  if (!hasDb) return res.status(500).json({ error: "no database configured" });
  if (!CL_TOKEN) return res.status(500).json({ error: "COURTLISTENER_API_TOKEN not set" });

  try {
    await ensureSchema();

    const courts = await sql`
      SELECT id, name, courtlistener_id FROM co_courts
      WHERE courtlistener_id IS NOT NULL ORDER BY id`;

    let synced = 0;
    const perCourt = [];
    for (const court of courts) {
      const result = await syncCourt(court);
      synced += result.synced;
      perCourt.push({ court: court.name, ...result });
    }

    return res.status(200).json({ ok: true, synced, perCourt });
  } catch (err) {
    return res.status(500).json({ error: "sync_judges_failed", detail: String(err.message || err) });
  }
}

async function syncCourt(court) {
  let synced = 0;
  const errors = [];

  let url = `${CL_BASE}/positions/?court=${encodeURIComponent(court.courtlistener_id)}` +
    `&date_termination__isnull=True&page_size=${PAGE_SIZE}&order_by=id`;

  for (let page = 0; page < MAX_PAGES_PER_COURT && url; page++) {
    const data = await cl(url);
    for (const pos of data.results || []) {
      try {
        const person = await resolvePerson(pos.person);
        if (!person) continue;
        const name = personName(person);
        if (!name) continue;

        await sql`
          INSERT INTO co_judges
            (courtlistener_person_id, full_name, court_id, position_title,
             appointed_by, date_start, date_termination, active, synced_at)
          VALUES
            (${person.id}, ${name}, ${court.id}, ${pos.job_title || pos.position_type || null},
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
// depending on endpoint version and query params. Handle both.
async function resolvePerson(person) {
  if (!person) return null;
  if (typeof person === "object" && person.id) return person;
  if (typeof person === "string") {
    const data = await cl(person.startsWith("http") ? person : `${CL_BASE}${person}`);
    return data && data.id ? data : null;
  }
  return null;
}

function personName(p) {
  const parts = [p.name_first, p.name_middle, p.name_last].filter(Boolean).join(" ").trim();
  const suffix = p.name_suffix ? ` ${p.name_suffix}` : "";
  return (parts + suffix).trim() || null;
}

async function cl(url) {
  const r = await fetch(url, { headers: { Authorization: `Token ${CL_TOKEN}` } });
  if (!r.ok) throw new Error(`CourtListener ${r.status} on ${url.slice(0, 120)}`);
  return r.json();
}

// ---- schema, mirrored in sql/know_your_judge_schema.sql ----
async function ensureSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS co_courts (
      id                 SERIAL PRIMARY KEY,
      name               TEXT NOT NULL UNIQUE,
      court_type         TEXT NOT NULL,
      judicial_district  INT,
      courtlistener_id   TEXT
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS co_judges (
      id                        SERIAL PRIMARY KEY,
      courtlistener_person_id   INT UNIQUE,
      full_name                 TEXT NOT NULL,
      court_id                  INT REFERENCES co_courts(id),
      position_title            TEXT,
      appointed_by              TEXT,
      date_start                DATE,
      date_termination          DATE,
      active                    BOOLEAN NOT NULL DEFAULT TRUE,
      synced_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (full_name, court_id)
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS ojpe_evaluations (
      id              SERIAL PRIMARY KEY,
      judge_id        INT NOT NULL REFERENCES co_judges(id),
      eval_year       INT NOT NULL,
      recommendation  TEXT,
      retention_score NUMERIC(5,2),
      narrative_url   TEXT,
      UNIQUE (judge_id, eval_year)
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS judicial_retention_results (
      id             SERIAL PRIMARY KEY,
      judge_id       INT NOT NULL REFERENCES co_judges(id),
      election_year  INT NOT NULL,
      yes_votes      INT,
      no_votes       INT,
      retained       BOOLEAN,
      UNIQUE (judge_id, election_year)
    )`;

  const DISTRICTS = [
    "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th", "11th",
    "12th", "13th", "14th", "15th", "16th", "17th", "18th", "19th", "20th", "21st", "22nd",
  ];
  await sql`
    INSERT INTO co_courts (name, court_type, judicial_district, courtlistener_id)
    VALUES ('Colorado Supreme Court', 'supreme', NULL, 'colo'),
           ('Colorado Court of Appeals', 'appeals', NULL, 'coloctapp'),
           ('Denver Probate Court', 'probate', NULL, NULL),
           ('Denver Juvenile Court', 'juvenile', NULL, NULL)
    ON CONFLICT (name) DO NOTHING`;
  for (let i = 0; i < DISTRICTS.length; i++) {
    await sql`
      INSERT INTO co_courts (name, court_type, judicial_district, courtlistener_id)
      VALUES (${DISTRICTS[i] + " Judicial District Court"}, 'district', ${i + 1}, NULL)
      ON CONFLICT (name) DO NOTHING`;
  }
}
