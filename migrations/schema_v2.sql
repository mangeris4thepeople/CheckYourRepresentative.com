-- Comprehensive NGO Funding Database Schema
-- For CheckYourRepresentative.com | Neon Postgres
-- Tracks every dollar that is legally disclosed; aggregates what is not.

CREATE TABLE IF NOT EXISTS organizations (
    id              SERIAL PRIMARY KEY,
    uei             VARCHAR(12) UNIQUE,          -- SAM.gov Unique Entity ID
    ein             VARCHAR(10) UNIQUE,          -- IRS EIN
    name            TEXT NOT NULL,
    legal_name      TEXT,
    address_line1   TEXT,
    city            TEXT,
    state           VARCHAR(2),
    zip             VARCHAR(10),
    subsection_code VARCHAR(10),                  -- 501c3, 501c4, etc
    ruling_date     DATE,
    sam_status      VARCHAR(20),
    created_at      TIMESTAMP DEFAULT now(),
    updated_at      TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_org_ein ON organizations(ein);
CREATE INDEX IF NOT EXISTS idx_org_state ON organizations(state);

-- Dollar-level disclosed funding events, from any source type
CREATE TABLE IF NOT EXISTS funding_events (
    id                  SERIAL PRIMARY KEY,
    org_id              INTEGER REFERENCES organizations(id),
    source_type         VARCHAR(30) NOT NULL,     -- federal_award, state_grant, foreign_principal,
                                                    -- foundation_grant, pac_contribution
    source_name         TEXT,                      -- agency, foreign principal, foundation, PAC name
    external_ref_id     VARCHAR(100),              -- USASpending award_id / FARA doc id / FEC transaction id
    amount              NUMERIC(15,2),
    description          TEXT,                      -- stated purpose
    period_start        DATE,
    period_end          DATE,
    fiscal_year         INTEGER,
    disclosure_source   VARCHAR(30) NOT NULL,      -- usaspending, fara, irs_990_schedule_i, fec, state_portal
    created_at          TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_funding_org ON funding_events(org_id);
CREATE INDEX IF NOT EXISTS idx_funding_type ON funding_events(source_type);
CREATE INDEX IF NOT EXISTS idx_funding_fy ON funding_events(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_funding_amount ON funding_events(amount DESC);

-- Grants this org MADE to other orgs (990 Schedule I), the outbound side
CREATE TABLE IF NOT EXISTS grants_made (
    id              SERIAL PRIMARY KEY,
    grantor_org_id  INTEGER REFERENCES organizations(id),
    recipient_org_id INTEGER REFERENCES organizations(id),  -- NULL if recipient not in our org table
    recipient_name  TEXT,
    amount          NUMERIC(15,2),
    purpose         TEXT,
    fiscal_year     INTEGER,
    source          VARCHAR(30) DEFAULT 'irs_990_schedule_i',
    created_at      TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_grants_grantor ON grants_made(grantor_org_id);
CREATE INDEX IF NOT EXISTS idx_grants_recipient ON grants_made(recipient_org_id);

-- Annual revenue picture per org, from 990 Part VIII, captures the
-- undisclosed/aggregate portion honestly instead of omitting it
CREATE TABLE IF NOT EXISTS revenue_summary (
    id                          SERIAL PRIMARY KEY,
    org_id                      INTEGER REFERENCES organizations(id),
    fiscal_year                 INTEGER,
    total_revenue               NUMERIC(15,2),
    contributions_grants_total  NUMERIC(15,2),     -- Part VIII line 1h, lump sum
    program_service_revenue     NUMERIC(15,2),
    investment_income           NUMERIC(15,2),
    disclosed_dollar_level      NUMERIC(15,2),     -- SUM of matched funding_events for this org/year
    undisclosed_amount          NUMERIC(15,2),     -- contributions_grants_total - disclosed_dollar_level
    source                      VARCHAR(30) DEFAULT 'irs_990',
    created_at                  TIMESTAMP DEFAULT now(),
    UNIQUE(org_id, fiscal_year)
);
CREATE INDEX IF NOT EXISTS idx_revenue_org ON revenue_summary(org_id);

-- Dashboard view: full funding picture per org per year
CREATE OR REPLACE VIEW org_funding_transparency AS
SELECT
    o.id,
    o.name,
    o.state,
    o.subsection_code,
    rs.fiscal_year,
    rs.total_revenue,
    rs.disclosed_dollar_level,
    rs.undisclosed_amount,
    CASE WHEN rs.total_revenue > 0
         THEN ROUND(100.0 * rs.disclosed_dollar_level / rs.total_revenue, 1)
         ELSE NULL END AS pct_transparent
FROM organizations o
JOIN revenue_summary rs ON rs.org_id = o.id;
