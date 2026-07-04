
-- Add to existing schema, run in Neon SQL editor
-- Tracks when constituents click "Contact My Rep" after voting

CREATE TABLE IF NOT EXISTS contact_actions (
  id          BIGSERIAL PRIMARY KEY,
  bill_id     TEXT NOT NULL,
  district    TEXT NOT NULL,
  position    TEXT NOT NULL,           -- what they voted before contacting
  identity    TEXT,                    -- same salted hash as votes table
  contacted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contact_bill_district ON contact_actions (bill_id, district);

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
