
-- Run in Neon SQL editor to create representatives table
CREATE TABLE IF NOT EXISTS representatives (
  district    TEXT PRIMARY KEY,
  name        TEXT,
  party       TEXT,
  state       TEXT,
  phone       TEXT,
  website     TEXT,
  contact_url TEXT,
  updated_at  TIMESTAMPTZ DEFAULT now()
);
