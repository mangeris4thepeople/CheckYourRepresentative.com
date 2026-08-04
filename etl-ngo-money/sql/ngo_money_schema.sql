-- =============================================================================
-- NGO Money Loop schema | CheckYourRepresentative.com | Neon Postgres
--
-- Closes the loop between three public records:
--   1. Colorado TRACER: non-individual contributions to state committees
--   2. IRS / ProPublica Nonprofit Explorer: who those contributors legally are
--   3. IRS Auto-Revocation List: whose tax exemption was revoked
--
-- Every statement is idempotent (IF NOT EXISTS / OR REPLACE), so running this
-- file against a database that already has some of it is safe.
-- =============================================================================

-- Nonprofit organizations resolved through ProPublica Nonprofit Explorer.
-- One row per EIN. total_revenue comes from the most recent 990 filing with
-- data; exemption_revoked is set by the IRS Auto-Revocation List ETL.
CREATE TABLE IF NOT EXISTS ngo_orgs (
    id                  SERIAL PRIMARY KEY,
    ein                 VARCHAR(10) UNIQUE NOT NULL,
    legal_name          TEXT NOT NULL,
    name_normalized     TEXT,
    subsection          VARCHAR(12),            -- e.g. 501(c)(3), 501(c)(4)
    ntee_code           VARCHAR(10),
    city                TEXT,
    state               VARCHAR(2),
    total_revenue       NUMERIC(15,2),          -- latest 990 total revenue
    revenue_fiscal_year INTEGER,                -- tax period year of that figure
    propublica_url      TEXT,
    exemption_revoked   BOOLEAN NOT NULL DEFAULT FALSE,
    revocation_date     DATE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ngo_orgs_name_norm ON ngo_orgs(name_normalized);
CREATE INDEX IF NOT EXISTS idx_ngo_orgs_revoked ON ngo_orgs(exemption_revoked) WHERE exemption_revoked;

-- Non-individual contributions to Colorado committees, from the Secretary of
-- State's TRACER bulk data files. One row per TRACER record; record_id makes
-- re-running a year's file a no-op for rows already loaded.
CREATE TABLE IF NOT EXISTS tracer_contributions (
    id                      SERIAL PRIMARY KEY,
    tracer_record_id        VARCHAR(40) UNIQUE,
    contributor_name        TEXT NOT NULL,
    contributor_normalized  TEXT NOT NULL,
    contributor_type        TEXT,
    contributor_city        TEXT,
    contributor_state       VARCHAR(2),
    committee_name          TEXT,
    committee_type          TEXT,
    candidate_name          TEXT,
    amount                  NUMERIC(15,2),
    contribution_date       DATE,
    contribution_type       TEXT,
    election_year           INTEGER,            -- the bulk file year it came from
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tracer_contrib_norm ON tracer_contributions(contributor_normalized);
CREATE INDEX IF NOT EXISTS idx_tracer_contrib_committee ON tracer_contributions(committee_name);
CREATE INDEX IF NOT EXISTS idx_tracer_contrib_amount ON tracer_contributions(amount DESC);
CREATE INDEX IF NOT EXISTS idx_tracer_contrib_date ON tracer_contributions(contribution_date DESC);

-- Name crosswalk: which TRACER contributor is which IRS organization.
-- The ProPublica enrichment ETL writes rows with status 'candidate' and a
-- match confidence; a human confirms or rejects each one on /admin/crosswalk.
CREATE TABLE IF NOT EXISTS ngo_name_crosswalk (
    id                      SERIAL PRIMARY KEY,
    contributor_normalized  TEXT NOT NULL,
    org_id                  INTEGER NOT NULL REFERENCES ngo_orgs(id) ON DELETE CASCADE,
    match_method            TEXT,               -- exact_name, search_best_hit
    confidence              NUMERIC(4,3),       -- 0.000 to 1.000
    status                  TEXT NOT NULL DEFAULT 'candidate'
                            CHECK (status IN ('candidate', 'confirmed', 'rejected')),
    reviewed_at             TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (contributor_normalized, org_id)
);
CREATE INDEX IF NOT EXISTS idx_crosswalk_status ON ngo_name_crosswalk(status);
CREATE INDEX IF NOT EXISTS idx_crosswalk_norm ON ngo_name_crosswalk(contributor_normalized);

-- The loop, one row per contribution matched to an IRS organization.
-- Candidate matches are included but carry match_status so the UI can label
-- them; rejected matches never appear. federal_funds_received comes from the
-- existing USASpending pipeline (organizations + funding_events), joined by
-- EIN first and normalized name as a fallback; NULL when the org is not in
-- that table.
CREATE OR REPLACE VIEW ngo_money_loop AS
SELECT
    c.id                    AS contribution_id,
    c.contributor_name,
    c.contributor_normalized,
    c.committee_name,
    c.committee_type,
    c.candidate_name,
    c.amount,
    c.contribution_date,
    c.election_year,
    o.id                    AS org_id,
    o.ein,
    o.legal_name,
    o.subsection,
    o.total_revenue,
    o.revenue_fiscal_year,
    o.propublica_url,
    o.exemption_revoked,
    o.revocation_date,
    x.status                AS match_status,
    x.confidence            AS match_confidence,
    fed.federal_funds_received
FROM tracer_contributions c
JOIN ngo_name_crosswalk x
  ON x.contributor_normalized = c.contributor_normalized
 AND x.status IN ('candidate', 'confirmed')
JOIN ngo_orgs o
  ON o.id = x.org_id
LEFT JOIN LATERAL (
    SELECT SUM(fe.amount) AS federal_funds_received
    FROM organizations usa
    JOIN funding_events fe ON fe.org_id = usa.id AND fe.source_type = 'federal_award'
    WHERE regexp_replace(usa.ein, '\D', '', 'g') = regexp_replace(o.ein, '\D', '', 'g')
       OR (o.name_normalized IS NOT NULL AND o.name_normalized <> ''
           -- Same normalization the ETL applies in JS: lowercase, strip
           -- punctuation, drop corporate suffixes and stopwords, collapse
           -- whitespace. Keep the word list in sync with etl/lib.mjs.
           AND trim(regexp_replace(regexp_replace(
                 lower(regexp_replace(usa.name, '[^a-zA-Z0-9 ]+', ' ', 'g')),
                 '\m(inc|incorporated|llc|llp|ltd|co|corp|corporation|company|the|of|a|an|and)\M', ' ', 'g'),
                 '\s+', ' ', 'g')) = o.name_normalized)
) fed ON TRUE;
