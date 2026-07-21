-- =============================================================================
-- National Judge Directory schema. Everything here is idempotent and additive,
-- safe to run repeatedly.
--
-- NOTE: api/_handlers/sync-judges-national.js runs this same DDL in its
-- ensureSchema() on every invocation, so production gets this schema
-- automatically the first time the sync is triggered. This file exists for
-- local databases and as the single readable reference for the shape. Keep
-- the two in sync.
--
-- Unlike the Colorado schema (sql/know_your_judge_schema.sql) there is no
-- seed data: the court list itself is synced from CourtListener's courts
-- endpoint. Coverage is the federal judiciary (Supreme Court, circuit and
-- district courts, standing specialty courts) plus every state's supreme and
-- intermediate appellate courts - CourtListener jurisdiction codes F, FD,
-- FS, S, SA, TS, TA, in-use courts only.
--
-- state is the USPS code derived from the court name; NULL means a
-- nationwide federal court (the circuits, the Supreme Court, the specialty
-- courts), which the API exposes as the state='US' scope. judges_synced_at
-- is the batch cursor: each sync run takes the stalest courts first, so the
-- daily cron works through the whole directory in rolling passes.
-- =============================================================================

CREATE TABLE IF NOT EXISTS nat_courts (
  id                 SERIAL PRIMARY KEY,
  courtlistener_id   TEXT NOT NULL UNIQUE,
  name               TEXT NOT NULL,
  jurisdiction       TEXT NOT NULL,  -- F | FD | FS | S | SA | TS | TA
  state              TEXT,           -- USPS code, NULL for nationwide federal courts
  judges_synced_at   TIMESTAMPTZ     -- batch-sync cursor, stalest court syncs first
);

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
);

CREATE UNIQUE INDEX IF NOT EXISTS nat_courts_cl_uq ON nat_courts (courtlistener_id);
CREATE UNIQUE INDEX IF NOT EXISTS nat_judges_person_uq ON nat_judges (courtlistener_person_id);
CREATE INDEX IF NOT EXISTS nat_judges_court_idx ON nat_judges (court_id);
CREATE INDEX IF NOT EXISTS nat_judges_name_idx ON nat_judges (full_name);
CREATE INDEX IF NOT EXISTS nat_courts_state_idx ON nat_courts (state);
