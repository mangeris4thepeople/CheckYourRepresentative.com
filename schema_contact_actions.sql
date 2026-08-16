
-- Add to existing schema, run in Neon SQL editor
-- Tracks when constituents click "Contact My Rep" after voting

CREATE TABLE IF NOT EXISTS contact_actions (
  id          BIGSERIAL PRIMARY KEY,
  bill_id     TEXT NOT NULL,
  district    TEXT NOT NULL,
  position    TEXT NOT NULL,           -- what they voted before contacting
  identity    TEXT,                    -- sess:{email}:{billId}, set server-side
  ip          TEXT,                    -- for the spam throttle
  contacted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contact_bill_district ON contact_actions (bill_id, district);
ALTER TABLE contact_actions ADD COLUMN IF NOT EXISTS ip TEXT;
-- One tracked contact per account per bill. Existing duplicates (from the era
-- when the endpoint had no dedup) are collapsed to the earliest row first,
-- then the constraint keeps it that way.
DELETE FROM contact_actions a USING contact_actions b
  WHERE a.bill_id = b.bill_id
    AND a.identity IS NOT DISTINCT FROM b.identity
    AND a.id > b.id;
CREATE UNIQUE INDEX IF NOT EXISTS uq_contact_bill_identity ON contact_actions (bill_id, identity);

-- View: accountability matrix, votes vs contacts per bill per district
CREATE OR REPLACE VIEW accountability_matrix AS
SELECT
  v.bill_id,
  v.district,
  COUNT(DISTINCT v.identity) FILTER (WHERE v.position = 'support')   AS support_votes,
  COUNT(DISTINCT v.identity) FILTER (WHERE v.position = 'oppose')    AS oppose_votes,
  COUNT(DISTINCT v.identity) FILTER (WHERE v.position = 'undecided') AS undecided_votes,
  COUNT(DISTINCT v.identity)                                          AS total_votes,
  COUNT(DISTINCT c.identity)                                          AS contacted_rep,
  ROUND(
    COUNT(DISTINCT c.identity)::numeric /
    NULLIF(COUNT(DISTINCT v.identity), 0) * 100, 1
  ) AS contact_rate_pct
FROM votes v
LEFT JOIN contact_actions c
  ON c.bill_id = v.bill_id
  AND c.district = v.district
  AND c.identity = v.identity
WHERE v.quarantined = FALSE
GROUP BY v.bill_id, v.district
ORDER BY total_votes DESC;
