-- =============================================================================
-- RepSpace schema: satirical 2006 profile pages for all 535 members of
-- Congress, backed entirely by real, sourced public records. Everything here
-- is idempotent and additive, safe to run repeatedly.
--
-- NOTE: api/_handlers/sync-repspace.js runs this same DDL in its
-- ensureSchema() on every invocation, so production gets this schema
-- automatically the first time the sync is triggered. This file exists for
-- local databases and as the single readable reference for the shape. Keep
-- the two in sync.
--
-- Sourcing rules enforced at the schema level:
--   rs_wall_posts.source_url NOT NULL: every wall post is a verbatim item
--     from the official record with a link to that record. No source, no row.
--   rs_top_donors.source_url NOT NULL: every donor row links to the FEC
--     receipts page it came from.
--   rs_headline_rules holds no headline text at all, only rule keys that
--     must match a template implemented in code (see buildHeadline in
--     api/_handlers/repspace-profile.js). A database row can never inject
--     freeform text that could read as a quote from a member.
-- =============================================================================

CREATE TABLE IF NOT EXISTS rs_members (
  bioguide_id       TEXT PRIMARY KEY,
  first_name        TEXT,
  last_name         TEXT,
  full_name         TEXT NOT NULL,
  chamber           TEXT NOT NULL,        -- house | senate
  state             TEXT NOT NULL,        -- USPS code
  district          TEXT,                 -- e.g. CO-04 or CO-AL, NULL for senators
  party             TEXT,
  birthday          DATE,
  first_term_start  DATE,                 -- start of their first term ever
  term_start        DATE,                 -- start of the current term
  term_end          DATE,
  phone             TEXT,
  website           TEXT,
  contact_form      TEXT,
  photo_url         TEXT,                 -- unitedstates project congress-images
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  wall_synced_at    TIMESTAMPTZ,          -- batch cursor for the wall-post crawl
  synced_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-member roll call counters, accumulated incrementally by
-- sync-repspace-activity from the same Congress.gov and senate.gov sources
-- the Roll Calls tab reads.
CREATE TABLE IF NOT EXISTS rs_stats (
  bioguide_id    TEXT PRIMARY KEY REFERENCES rs_members(bioguide_id),
  congress       INT,
  votes_total    INT NOT NULL DEFAULT 0,  -- roll calls held while counted
  votes_cast     INT NOT NULL DEFAULT 0,
  votes_missed   INT NOT NULL DEFAULT 0,
  yes_votes      INT NOT NULL DEFAULT 0,
  no_votes       INT NOT NULL DEFAULT 0,
  present_votes  INT NOT NULL DEFAULT 0,
  last_vote_date DATE,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rs_top_donors (
  id           SERIAL PRIMARY KEY,
  bioguide_id  TEXT NOT NULL REFERENCES rs_members(bioguide_id),
  cycle        INT NOT NULL,
  bucket_type  TEXT NOT NULL,             -- 'size' or 'state', FEC's own aggregates
  bucket_label TEXT NOT NULL,             -- e.g. "$2,000+" or "CA"
  total_amount NUMERIC NOT NULL,
  donor_count  INT,
  source_url   TEXT NOT NULL,             -- FEC receipts page this row came from
  UNIQUE (bioguide_id, cycle, bucket_type, bucket_label)
);

-- Verbatim items from the official record only. kind says which record.
CREATE TABLE IF NOT EXISTS rs_wall_posts (
  id           SERIAL PRIMARY KEY,
  bioguide_id  TEXT NOT NULL REFERENCES rs_members(bioguide_id),
  posted_at    DATE,
  kind         TEXT NOT NULL,             -- sponsored-bill | floor-statement | press-release
  title        TEXT NOT NULL,             -- verbatim from the source
  body         TEXT,                      -- verbatim excerpt only, optional
  source_url   TEXT NOT NULL,
  UNIQUE (bioguide_id, kind, source_url)
);

CREATE TABLE IF NOT EXISTS rs_committees (
  id              SERIAL PRIMARY KEY,
  bioguide_id     TEXT NOT NULL REFERENCES rs_members(bioguide_id),
  committee_code  TEXT NOT NULL,
  committee_name  TEXT NOT NULL,
  subcommittee    TEXT NOT NULL DEFAULT '',
  role            TEXT,                   -- e.g. Chair, Ranking Member
  rank            INT,
  UNIQUE (bioguide_id, committee_code, subcommittee)
);

-- Enables, disables, and prioritizes headline rules. rule_key must match a
-- template implemented in buildHeadline; unknown keys are ignored by the
-- code, so this table cannot introduce new headline text.
CREATE TABLE IF NOT EXISTS rs_headline_rules (
  rule_key  TEXT PRIMARY KEY,
  enabled   BOOLEAN NOT NULL DEFAULT TRUE,
  priority  INT NOT NULL DEFAULT 100     -- lower runs first
);

INSERT INTO rs_headline_rules (rule_key, enabled, priority) VALUES
  ('perfect-attendance', TRUE, 10),
  ('missed-votes',       TRUE, 20),
  ('high-attendance',    TRUE, 30),
  ('freshman',           TRUE, 40),
  ('long-timer',         TRUE, 50),
  ('default',            TRUE, 1000)
ON CONFLICT (rule_key) DO NOTHING;

-- Cursor storage for the incremental activity crawl.
CREATE TABLE IF NOT EXISTS rs_state (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rs_members_district_idx ON rs_members (state, district);
CREATE INDEX IF NOT EXISTS rs_wall_posts_member_idx ON rs_wall_posts (bioguide_id, posted_at DESC);
CREATE INDEX IF NOT EXISTS rs_top_donors_member_idx ON rs_top_donors (bioguide_id, total_amount DESC);
CREATE INDEX IF NOT EXISTS rs_committees_member_idx ON rs_committees (bioguide_id, rank);
