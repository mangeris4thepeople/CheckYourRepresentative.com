-- Run after schema_v2.sql: required for ETL upsert logic (ON CONFLICT) to work.
-- Idempotent, so re-running it is safe.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_funding_external_ref'
  ) THEN
    ALTER TABLE funding_events ADD CONSTRAINT uq_funding_external_ref UNIQUE (external_ref_id);
  END IF;
END$$;
