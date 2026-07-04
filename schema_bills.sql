-- =============================================================================
-- Check Your Representative -- bills cache (Neon / Postgres)
-- Run this ONCE in the Neon SQL editor, same as schema.sql.
--
-- Congress.gov has no "exclude bills this account already voted on" query of
-- its own, and paging through 17,000+ bills live on every click does not
-- scale. This table is our own local copy of the active bill list, synced
-- daily by api/sync-bills.js, so the vote queue endpoints can do a real
-- NOT EXISTS join against votes instead of filtering in application code.
-- =============================================================================

CREATE TABLE IF NOT EXISTS bills (
  id            TEXT PRIMARY KEY,        -- e.g. "hr-1234-119"
  type          TEXT NOT NULL,
  number        TEXT NOT NULL,
  congress      INT NOT NULL,
  title         TEXT,
  policy_area   TEXT,
  latest_action TEXT,
  action_date   DATE,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  synced_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Keyset pagination on the active set, newest activity first.
CREATE INDEX IF NOT EXISTS idx_bills_active_action
  ON bills (is_active, action_date DESC, id DESC);
