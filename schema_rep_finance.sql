-- =============================================================================
-- Check Your Representative -- Know Your Rep financial profile (Neon / Postgres)
-- Run this ONCE in the Neon SQL editor, same as schema.sql and schema_bills.sql.
--
-- api/sync-rep-finances.js matches each row in the representatives table to its
-- FEC candidate_id, then mirrors that candidate's per-cycle totals, FEC
-- filings, and a bounded Schedule A donor breakdown into the tables below, so
-- the Know Your Rep tab can show a full financial profile without hitting the
-- FEC API on every page load.
-- =============================================================================

ALTER TABLE representatives ADD COLUMN IF NOT EXISTS fec_candidate_id TEXT;

-- One row per candidate per two-year cycle, from GET /candidate/{id}/totals/.
CREATE TABLE IF NOT EXISTS rep_finance_totals (
  fec_candidate_id          TEXT NOT NULL,
  cycle                     INT NOT NULL,
  receipts                  NUMERIC,
  disbursements             NUMERIC,
  individual_contributions  NUMERIC,
  pac_contributions         NUMERIC,   -- other_political_committee_contributions
  party_contributions       NUMERIC,   -- political_party_committee_contributions
  cash_on_hand_end          NUMERIC,   -- last_cash_on_hand_end_period
  synced_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (fec_candidate_id, cycle)
);

-- One row per FEC filing on record, from GET /candidate/{id}/filings/. Capped
-- to the most recent filings per candidate (see PER_CANDIDATE_FILINGS_LIMIT in
-- sync-rep-finances.js), the same bounded approach etl_fec.js uses for
-- Schedule B, since a decades-long incumbent can have well over a hundred.
CREATE TABLE IF NOT EXISTS rep_filings (
  fec_candidate_id     TEXT NOT NULL,
  file_number          BIGINT NOT NULL,
  report_type          TEXT,
  coverage_start       DATE,
  coverage_end         DATE,
  total_receipts       NUMERIC,
  total_disbursements  NUMERIC,
  cash_on_hand_end     NUMERIC,
  filed_date           DATE,
  pdf_url              TEXT,
  synced_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (fec_candidate_id, file_number)
);
CREATE INDEX IF NOT EXISTS idx_rep_filings_candidate_coverage
  ON rep_filings (fec_candidate_id, coverage_end DESC);

-- Bounded donor breakdown from the Schedule A aggregate endpoints
-- (by_size and by_state), one row per bucket per candidate per cycle. This is
-- not itemized, named contributions, it is FEC's own pre-aggregated buckets,
-- which is what keeps this within FEC's rate limits (see etl_fec.js for the
-- same rate-limit-driven bounding on Schedule B).
CREATE TABLE IF NOT EXISTS rep_top_donors (
  fec_candidate_id  TEXT NOT NULL,
  committee_id      TEXT NOT NULL,
  cycle             INT NOT NULL,
  bucket_type       TEXT NOT NULL, -- 'size' or 'state'
  bucket_label      TEXT NOT NULL, -- e.g. "$2,000+" or "CA"
  total_amount      NUMERIC NOT NULL,
  donor_count       INT,
  synced_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (fec_candidate_id, cycle, bucket_type, bucket_label)
);
CREATE INDEX IF NOT EXISTS idx_rep_top_donors_amount
  ON rep_top_donors (fec_candidate_id, total_amount DESC);
