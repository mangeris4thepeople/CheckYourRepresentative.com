-- =============================================================================
-- Check Your Representative -- Know Your Rep Senate financial profile
-- (Neon / Postgres). Run this ONCE in the Neon SQL editor, same as
-- schema_rep_finance.sql. Mirrors that file exactly for the Senate side.
--
-- api/sync-senator-finances.js matches each row in the senators table to its
-- FEC candidate_id, then mirrors that candidate's per-cycle totals, FEC
-- filings, and a bounded Schedule A donor breakdown into the tables below, so
-- the Know Your Rep tab's Senate view can show a full financial profile
-- without hitting the FEC API on every page load.
--
-- FILINGS SOURCE: filings come from GET /committee/{committeeId}/filings/
-- (the candidate's principal committee), filtered to form_category=REPORT,
-- not GET /candidate/{id}/filings/, which only ever returns that candidate's
-- own statement-of-candidacy paperwork with null financials. This was
-- verified live against production FEC data on the House side (see
-- schema_rep_finance.sql / api/sync-rep-finances.js) and built correctly
-- here from the start.
-- =============================================================================

ALTER TABLE senators ADD COLUMN IF NOT EXISTS fec_candidate_id TEXT;

-- One row per candidate per two-year cycle, from GET /candidate/{id}/totals/.
CREATE TABLE IF NOT EXISTS senator_finance_totals (
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

-- One row per FEC financial report on record, from
-- GET /committee/{committeeId}/filings/ filtered to form_category=REPORT.
-- Capped to the most recent filings per candidate (see FILINGS_LIMIT in
-- sync-senator-finances.js).
CREATE TABLE IF NOT EXISTS senator_filings (
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
CREATE INDEX IF NOT EXISTS idx_senator_filings_candidate_coverage
  ON senator_filings (fec_candidate_id, coverage_end DESC);

-- Bounded donor breakdown from the Schedule A aggregate endpoints
-- (by_size and by_state), one row per bucket per candidate per cycle.
CREATE TABLE IF NOT EXISTS senator_top_donors (
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
CREATE INDEX IF NOT EXISTS idx_senator_top_donors_amount
  ON senator_top_donors (fec_candidate_id, total_amount DESC);
