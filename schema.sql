-- =============================================================================
-- Check Your Representative, database schema (Neon / Postgres)
-- Run this ONCE in the Neon SQL editor after creating the database in Vercel.
-- (Vercel: Storage -> Create Database -> Neon. Then open the database's SQL
--  editor, paste this whole file, Run.)
-- =============================================================================

-- Anonymous constituent positions, with the fairness fields.
CREATE TABLE IF NOT EXISTS votes (
  id          BIGSERIAL PRIMARY KEY,
  bill_id     TEXT NOT NULL,
  identity    TEXT NOT NULL,           -- signed vote token, or salted hash of ip+ua
  district    TEXT,
  position    TEXT NOT NULL,           -- 'support' | 'oppose' | 'undecided'
  tier        TEXT NOT NULL,           -- 'verified' | 'open'
  quarantined BOOLEAN NOT NULL DEFAULT FALSE,
  ip          TEXT,
  subnet      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bill_id, identity)           -- one position per identity per bill (dedup)
);
CREATE INDEX IF NOT EXISTS idx_votes_bill        ON votes (bill_id);
CREATE INDEX IF NOT EXISTS idx_votes_ip_time     ON votes (ip, created_at);
CREATE INDEX IF NOT EXISTS idx_votes_subnet_time ON votes (subnet, created_at);

-- Consent-based constituent profiles (email-keyed, no password needed).
CREATE TABLE IF NOT EXISTS profiles (
  id              BIGSERIAL PRIMARY KEY,
  email           TEXT UNIQUE,
  district        TEXT,
  location        JSONB,
  topics          JSONB,
  consent_version TEXT,
  consent_at      TIMESTAMPTZ,
  email_channel   TEXT NOT NULL DEFAULT 'off',  -- 'off' | 'pending' | 'on'
  confirm_token   TEXT,
  unsub_token     TEXT,
  display_name    TEXT,
  bio             TEXT,
  city            TEXT,
  is_public       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_profiles_confirm ON profiles (confirm_token);
CREATE INDEX IF NOT EXISTS idx_profiles_unsub   ON profiles (unsub_token);
-- Databases created before the public-profile fields existed self-heal here.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio          TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS city         TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_public    BOOLEAN NOT NULL DEFAULT FALSE;

-- Magic-link sign-in sessions (see api/auth/*). One row per email; the magic
-- token is short-lived, the session token lives ~90 days. These tables were
-- previously created only by hand in production - a database provisioned from
-- this file alone had broken sign-in (documented outage in auth-send.js).
CREATE TABLE IF NOT EXISTS sessions (
  email           TEXT PRIMARY KEY,
  magic_token     TEXT,
  magic_expires   TIMESTAMPTZ,
  session_token   TEXT,
  session_expires TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sessions_magic   ON sessions (magic_token);
CREATE INDEX IF NOT EXISTS idx_sessions_session ON sessions (session_token);

-- Sign-in request throttle log (per IP + per email, checked by auth-send.js).
CREATE TABLE IF NOT EXISTS auth_requests (
  id           BIGSERIAL PRIMARY KEY,
  ip           TEXT,
  email        TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_auth_requests_ip_time    ON auth_requests (ip, requested_at);
CREATE INDEX IF NOT EXISTS idx_auth_requests_email_time ON auth_requests (email, requested_at);

-- Shared cache of AI bill summaries (summarize each bill ONCE, reuse for all).
CREATE TABLE IF NOT EXISTS bill_summaries (
  cache_key    TEXT PRIMARY KEY,        -- "billId:latestActionDate"
  bill_id      TEXT NOT NULL,
  headline     TEXT,
  plain        TEXT,
  affects      TEXT,
  status       TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
