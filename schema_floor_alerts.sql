-- Run once in Neon SQL editor.
-- Tracks which bills have already triggered a floor alert email,
-- so each bill alerts every subscriber exactly once.
CREATE TABLE IF NOT EXISTS floor_alerts_sent (
  bill_id TEXT PRIMARY KEY,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recipients INT NOT NULL DEFAULT 0
);
