// =============================================================================
// GET /api/cron?op=sync-repspace - RepSpace roster sync.
//
// Seeds and refreshes the RepSpace member roster for all 535 members of
// Congress from the unitedstates/congress-legislators public dataset
// (legislators-current.json plus the committee files), then refreshes
// rs_top_donors from the FEC donor tables the Know Your Rep and Senate
// finance pipelines already maintain, so every donor row carries a receipts
// link back to FEC.gov.
//
// Weekly cron. scripts/seed_members.mjs is the local mirror for dev
// databases. Schema: ensureSchema() below creates everything idempotently,
// mirrored in sql/repspace_schema.sql. Keep the two in sync.
//
// Reached only through api/cron.js, so CRON_SECRET already gates this.
// =============================================================================
import { sql, hasDb } from "../_db.js";

const LEGISLATORS_URL = "https://unitedstates.github.io/congress-legislators/legislators-current.json";
const COMMITTEES_URL = "https://unitedstates.github.io/congress-legislators/committees-current.json";
const MEMBERSHIP_URL = "https://unitedstates.github.io/congress-legislators/committee-membership-current.json";
const PHOTO_BASE = "https://unitedstates.github.io/images/congress/225x275";

export default async function handler(req, res) {
  if (!hasDb) return res.status(500).json({ error: "no database configured" });

  try {
    await ensureSchema();

    const legislators = await getJson(LEGISLATORS_URL);
    const members = legislators.map(toMemberRow).filter(Boolean);
    await upsertMembers(members);

    const committees = await syncCommittees(new Set(members.map(m => m.bioguide_id)));
    const donors = await refreshDonors();

    return res.status(200).json({
      ok: true, members: members.length, committeeRows: committees, donorRows: donors,
    });
  } catch (err) {
    return res.status(500).json({ error: "sync_repspace_failed", detail: String(err.message || err) });
  }
}

// ---- members ----

function toMemberRow(l) {
  const id = l.id && l.id.bioguide;
  const name = l.name || {};
  const terms = l.terms || [];
  const current = terms[terms.length - 1];
  if (!id || !current) return null;

  const chamber = current.type === "sen" ? "senate" : "house";
  let district = null;
  if (chamber === "house") {
    const d = Number(current.district);
    // Same district format the representatives table uses: CO-04, AK-AL.
    district = current.state + "-" + (d === 0 ? "AL" : String(d).padStart(2, "0"));
  }

  return {
    bioguide_id: id,
    first_name: name.first || null,
    last_name: name.last || null,
    full_name: name.official_full || [name.first, name.last].filter(Boolean).join(" "),
    chamber,
    state: current.state,
    district,
    party: current.party || null,
    birthday: (l.bio && l.bio.birthday) || null,
    first_term_start: terms[0].start || null,
    term_start: current.start || null,
    term_end: current.end || null,
    phone: current.phone || null,
    website: current.url || null,
    contact_form: current.contact_form || null,
    photo_url: `${PHOTO_BASE}/${id}.jpg`,
  };
}

const MEMBER_COLS = ["bioguide_id", "first_name", "last_name", "full_name", "chamber", "state",
  "district", "party", "birthday", "first_term_start", "term_start", "term_end",
  "phone", "website", "contact_form", "photo_url"];

// The Neon HTTP client pays a round trip per statement, and 535 single-row
// upserts blow the function time cap, so rows go in batches of 100 per
// statement.
async function upsertMembers(members) {
  await sql`UPDATE rs_members SET active = FALSE`;
  for (let i = 0; i < members.length; i += 100) {
    const batch = members.slice(i, i + 100);
    const params = [];
    const tuples = batch.map(m => {
      const ph = MEMBER_COLS.map(c => {
        params.push(m[c]);
        return `$${params.length}`;
      });
      return `(${ph.join(",")}, TRUE, now())`;
    });
    await sql.query(
      `INSERT INTO rs_members (${MEMBER_COLS.join(",")}, active, synced_at)
       VALUES ${tuples.join(",")}
       ON CONFLICT (bioguide_id) DO UPDATE SET
         first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name,
         full_name = EXCLUDED.full_name, chamber = EXCLUDED.chamber,
         state = EXCLUDED.state, district = EXCLUDED.district, party = EXCLUDED.party,
         birthday = EXCLUDED.birthday, first_term_start = EXCLUDED.first_term_start,
         term_start = EXCLUDED.term_start, term_end = EXCLUDED.term_end,
         phone = EXCLUDED.phone, website = EXCLUDED.website,
         contact_form = EXCLUDED.contact_form, photo_url = EXCLUDED.photo_url,
         active = TRUE, synced_at = now()`,
      params,
    );
  }
}

// ---- committees ----

async function syncCommittees(knownIds) {
  const [committees, membership] = await Promise.all([
    getJson(COMMITTEES_URL), getJson(MEMBERSHIP_URL),
  ]);

  // thomas_id -> name, for both parents and subcommittees (whose membership
  // keys are parent id + two digit suffix).
  const parentName = {};
  const subName = {};
  for (const c of committees) {
    parentName[c.thomas_id] = c.name;
    for (const s of c.subcommittees || []) {
      subName[c.thomas_id + s.thomas_id] = { parent: c.thomas_id, name: s.name };
    }
  }

  const rows = [];
  for (const [code, roster] of Object.entries(membership)) {
    const sub = subName[code];
    const parentCode = sub ? sub.parent : code;
    const committeeName = parentName[parentCode];
    if (!committeeName) continue;
    for (const m of roster) {
      if (!m.bioguide || !knownIds.has(m.bioguide)) continue;
      rows.push([m.bioguide, parentCode, committeeName, sub ? sub.name : "",
        m.title || null, Number.isFinite(m.rank) ? m.rank : null]);
    }
  }

  // Full refresh: membership shifts between publishes and stale rows have no
  // value, so replace rather than reconcile.
  await sql`DELETE FROM rs_committees`;
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const params = [];
    const tuples = batch.map(r => {
      const ph = r.map(v => {
        params.push(v);
        return `$${params.length}`;
      });
      return `(${ph.join(",")})`;
    });
    await sql.query(
      `INSERT INTO rs_committees (bioguide_id, committee_code, committee_name, subcommittee, role, rank)
       VALUES ${tuples.join(",")}
       ON CONFLICT (bioguide_id, committee_code, subcommittee) DO NOTHING`,
      params,
    );
  }
  return rows.length;
}

// ---- donors ----
// rs_top_donors mirrors the FEC aggregate donor buckets the finance syncs
// already store (rep_fec_donor_buckets for the House, senator_top_donors for
// the Senate), re-keyed by bioguide id. source_url points at FEC's receipts
// browser scoped to the exact committee and cycle each bucket came from, so
// every row is one click from the underlying receipts. Either source table
// may not exist yet in a given database; each copy fails soft.
async function refreshDonors() {
  let copied = 0;
  await sql`DELETE FROM rs_top_donors`;

  try {
    const r = await sql`
      INSERT INTO rs_top_donors (bioguide_id, cycle, bucket_type, bucket_label, total_amount, donor_count, source_url)
      SELECT m.bioguide_id, b.cycle, b.bucket_type, b.bucket_label, b.total_amount, b.donor_count,
             'https://www.fec.gov/data/receipts/?data_type=processed&committee_id=' || b.committee_id ||
             '&two_year_transaction_period=' || b.cycle
      FROM rep_fec_donor_buckets b
      JOIN representatives r ON r.fec_candidate_id = b.fec_candidate_id
      JOIN rs_members m ON m.chamber = 'house' AND m.district = r.district
      ON CONFLICT (bioguide_id, cycle, bucket_type, bucket_label) DO NOTHING`;
    copied += r.length ?? 0;
  } catch (err) {
    if (!/relation .* does not exist|column .* does not exist/i.test(String(err.message || err))) throw err;
  }

  try {
    await sql`
      INSERT INTO rs_top_donors (bioguide_id, cycle, bucket_type, bucket_label, total_amount, donor_count, source_url)
      SELECT s.bioguide_id, b.cycle, b.bucket_type, b.bucket_label, b.total_amount, b.donor_count,
             'https://www.fec.gov/data/receipts/?data_type=processed&committee_id=' || b.committee_id ||
             '&two_year_transaction_period=' || b.cycle
      FROM senator_top_donors b
      JOIN senators s ON s.fec_candidate_id = b.fec_candidate_id
      JOIN rs_members m ON m.bioguide_id = s.bioguide_id
      ON CONFLICT (bioguide_id, cycle, bucket_type, bucket_label) DO NOTHING`;
  } catch (err) {
    if (!/relation .* does not exist|column .* does not exist/i.test(String(err.message || err))) throw err;
  }

  const [{ n }] = await sql`SELECT count(*)::int AS n FROM rs_top_donors`;
  return n;
}

async function getJson(url) {
  const r = await fetch(url, { headers: { "User-Agent": "CheckYourRepresentative.com civic education" } });
  if (!r.ok) throw new Error(`${url.slice(0, 80)}: HTTP ${r.status}`);
  return r.json();
}

// ---- schema, mirrored in sql/repspace_schema.sql ----
export async function ensureSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS rs_members (
      bioguide_id       TEXT PRIMARY KEY,
      first_name        TEXT,
      last_name         TEXT,
      full_name         TEXT NOT NULL,
      chamber           TEXT NOT NULL,
      state             TEXT NOT NULL,
      district          TEXT,
      party             TEXT,
      birthday          DATE,
      first_term_start  DATE,
      term_start        DATE,
      term_end          DATE,
      phone             TEXT,
      website           TEXT,
      contact_form      TEXT,
      photo_url         TEXT,
      active            BOOLEAN NOT NULL DEFAULT TRUE,
      wall_synced_at    TIMESTAMPTZ,
      synced_at         TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS rs_stats (
      bioguide_id    TEXT PRIMARY KEY REFERENCES rs_members(bioguide_id),
      congress       INT,
      votes_total    INT NOT NULL DEFAULT 0,
      votes_cast     INT NOT NULL DEFAULT 0,
      votes_missed   INT NOT NULL DEFAULT 0,
      yes_votes      INT NOT NULL DEFAULT 0,
      no_votes       INT NOT NULL DEFAULT 0,
      present_votes  INT NOT NULL DEFAULT 0,
      last_vote_date DATE,
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS rs_top_donors (
      id           SERIAL PRIMARY KEY,
      bioguide_id  TEXT NOT NULL REFERENCES rs_members(bioguide_id),
      cycle        INT NOT NULL,
      bucket_type  TEXT NOT NULL,
      bucket_label TEXT NOT NULL,
      total_amount NUMERIC NOT NULL,
      donor_count  INT,
      source_url   TEXT NOT NULL,
      UNIQUE (bioguide_id, cycle, bucket_type, bucket_label)
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS rs_wall_posts (
      id           SERIAL PRIMARY KEY,
      bioguide_id  TEXT NOT NULL REFERENCES rs_members(bioguide_id),
      posted_at    DATE,
      kind         TEXT NOT NULL,
      title        TEXT NOT NULL,
      body         TEXT,
      source_url   TEXT NOT NULL,
      UNIQUE (bioguide_id, kind, source_url)
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS rs_committees (
      id              SERIAL PRIMARY KEY,
      bioguide_id     TEXT NOT NULL REFERENCES rs_members(bioguide_id),
      committee_code  TEXT NOT NULL,
      committee_name  TEXT NOT NULL,
      subcommittee    TEXT NOT NULL DEFAULT '',
      role            TEXT,
      rank            INT,
      UNIQUE (bioguide_id, committee_code, subcommittee)
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS rs_headline_rules (
      rule_key  TEXT PRIMARY KEY,
      enabled   BOOLEAN NOT NULL DEFAULT TRUE,
      priority  INT NOT NULL DEFAULT 100
    )`;
  await sql`
    INSERT INTO rs_headline_rules (rule_key, enabled, priority) VALUES
      ('perfect-attendance', TRUE, 10),
      ('missed-votes',       TRUE, 20),
      ('high-attendance',    TRUE, 30),
      ('freshman',           TRUE, 40),
      ('long-timer',         TRUE, 50),
      ('default',            TRUE, 1000)
    ON CONFLICT (rule_key) DO NOTHING`;
  await sql`
    CREATE TABLE IF NOT EXISTS rs_state (
      key        TEXT PRIMARY KEY,
      value      TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`CREATE INDEX IF NOT EXISTS rs_members_district_idx ON rs_members (state, district)`;
  await sql`CREATE INDEX IF NOT EXISTS rs_wall_posts_member_idx ON rs_wall_posts (bioguide_id, posted_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS rs_top_donors_member_idx ON rs_top_donors (bioguide_id, total_amount DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS rs_committees_member_idx ON rs_committees (bioguide_id, rank)`;
}
