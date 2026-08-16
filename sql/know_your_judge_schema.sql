-- =============================================================================
-- Know Your Judge schema: Colorado judicial directory.
-- Everything here is idempotent and additive, safe to run repeatedly.
--
-- NOTE: api/_handlers/sync-judges.js runs this same DDL in its ensureSchema()
-- on every invocation, so production gets this schema automatically the first
-- time the sync is triggered. This file exists for local databases and as the
-- single readable reference for the shape. Keep the two in sync.
--
-- The 26 seeded courts are Colorado's full state judicial structure:
-- the Supreme Court, the Court of Appeals, the 22 judicial district courts,
-- and Denver's two standalone specialty courts (Probate and Juvenile).
-- =============================================================================

CREATE TABLE IF NOT EXISTS co_courts (
  id                 SERIAL PRIMARY KEY,
  name               TEXT NOT NULL UNIQUE,
  court_type         TEXT NOT NULL,  -- supreme | appeals | district | probate | juvenile | county
  judicial_district  INT,            -- 1..22 for district courts, NULL otherwise
  courtlistener_id   TEXT            -- CourtListener court id where one exists
);

CREATE TABLE IF NOT EXISTS co_judges (
  id                        SERIAL PRIMARY KEY,
  courtlistener_person_id   INT UNIQUE,
  full_name                 TEXT NOT NULL,
  court_id                  INT REFERENCES co_courts(id),
  position_title            TEXT,
  appointed_by              TEXT,
  date_start                DATE,
  date_termination          DATE,
  active                    BOOLEAN NOT NULL DEFAULT TRUE,
  synced_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (full_name, court_id)
);

CREATE TABLE IF NOT EXISTS ojpe_evaluations (
  id              SERIAL PRIMARY KEY,
  judge_id        INT NOT NULL REFERENCES co_judges(id),
  eval_year       INT NOT NULL,
  recommendation  TEXT,           -- e.g. Meets Performance Standards
  retention_score NUMERIC(5,2),   -- combined survey score where published
  narrative_url   TEXT,           -- link to the published OJPE narrative
  UNIQUE (judge_id, eval_year)
);

CREATE TABLE IF NOT EXISTS judicial_retention_results (
  id             SERIAL PRIMARY KEY,
  judge_id       INT NOT NULL REFERENCES co_judges(id),
  election_year  INT NOT NULL,
  yes_votes      INT,
  no_votes       INT,
  retained       BOOLEAN,
  UNIQUE (judge_id, election_year)
);

INSERT INTO co_courts (name, court_type, judicial_district, courtlistener_id) VALUES
  ('Colorado Supreme Court', 'supreme', NULL, 'colo'),
  ('Colorado Court of Appeals', 'appeals', NULL, 'coloctapp'),
  ('1st Judicial District Court', 'district', 1, NULL),
  ('2nd Judicial District Court', 'district', 2, NULL),
  ('3rd Judicial District Court', 'district', 3, NULL),
  ('4th Judicial District Court', 'district', 4, NULL),
  ('5th Judicial District Court', 'district', 5, NULL),
  ('6th Judicial District Court', 'district', 6, NULL),
  ('7th Judicial District Court', 'district', 7, NULL),
  ('8th Judicial District Court', 'district', 8, NULL),
  ('9th Judicial District Court', 'district', 9, NULL),
  ('10th Judicial District Court', 'district', 10, NULL),
  ('11th Judicial District Court', 'district', 11, NULL),
  ('12th Judicial District Court', 'district', 12, NULL),
  ('13th Judicial District Court', 'district', 13, NULL),
  ('14th Judicial District Court', 'district', 14, NULL),
  ('15th Judicial District Court', 'district', 15, NULL),
  ('16th Judicial District Court', 'district', 16, NULL),
  ('17th Judicial District Court', 'district', 17, NULL),
  ('18th Judicial District Court', 'district', 18, NULL),
  ('19th Judicial District Court', 'district', 19, NULL),
  ('20th Judicial District Court', 'district', 20, NULL),
  ('21st Judicial District Court', 'district', 21, NULL),
  ('22nd Judicial District Court', 'district', 22, NULL),
  ('Denver Probate Court', 'probate', NULL, NULL),
  ('Denver Juvenile Court', 'juvenile', NULL, NULL)
ON CONFLICT (name) DO NOTHING;

-- Every Colorado county court, mirroring sync-judges.js exactly - the OJPE
-- and retention imports throw 'unknown court' for county judges without
-- these rows, so a database provisioned from this file alone must have them.
INSERT INTO co_courts (name, court_type, judicial_district, courtlistener_id) VALUES
  ('Adams County Court', 'county', NULL, NULL),
  ('Alamosa County Court', 'county', NULL, NULL),
  ('Arapahoe County Court', 'county', NULL, NULL),
  ('Archuleta County Court', 'county', NULL, NULL),
  ('Baca County Court', 'county', NULL, NULL),
  ('Bent County Court', 'county', NULL, NULL),
  ('Boulder County Court', 'county', NULL, NULL),
  ('Broomfield County Court', 'county', NULL, NULL),
  ('Chaffee County Court', 'county', NULL, NULL),
  ('Cheyenne County Court', 'county', NULL, NULL),
  ('Clear Creek County Court', 'county', NULL, NULL),
  ('Conejos County Court', 'county', NULL, NULL),
  ('Costilla County Court', 'county', NULL, NULL),
  ('Crowley County Court', 'county', NULL, NULL),
  ('Custer County Court', 'county', NULL, NULL),
  ('Delta County Court', 'county', NULL, NULL),
  ('Denver County Court', 'county', NULL, NULL),
  ('Dolores County Court', 'county', NULL, NULL),
  ('Douglas County Court', 'county', NULL, NULL),
  ('Eagle County Court', 'county', NULL, NULL),
  ('Elbert County Court', 'county', NULL, NULL),
  ('El Paso County Court', 'county', NULL, NULL),
  ('Fremont County Court', 'county', NULL, NULL),
  ('Garfield County Court', 'county', NULL, NULL),
  ('Gilpin County Court', 'county', NULL, NULL),
  ('Grand County Court', 'county', NULL, NULL),
  ('Gunnison County Court', 'county', NULL, NULL),
  ('Hinsdale County Court', 'county', NULL, NULL),
  ('Huerfano County Court', 'county', NULL, NULL),
  ('Jackson County Court', 'county', NULL, NULL),
  ('Jefferson County Court', 'county', NULL, NULL),
  ('Kiowa County Court', 'county', NULL, NULL),
  ('Kit Carson County Court', 'county', NULL, NULL),
  ('Lake County Court', 'county', NULL, NULL),
  ('La Plata County Court', 'county', NULL, NULL),
  ('Larimer County Court', 'county', NULL, NULL),
  ('Las Animas County Court', 'county', NULL, NULL),
  ('Lincoln County Court', 'county', NULL, NULL),
  ('Logan County Court', 'county', NULL, NULL),
  ('Mesa County Court', 'county', NULL, NULL),
  ('Mineral County Court', 'county', NULL, NULL),
  ('Moffat County Court', 'county', NULL, NULL),
  ('Montezuma County Court', 'county', NULL, NULL),
  ('Montrose County Court', 'county', NULL, NULL),
  ('Morgan County Court', 'county', NULL, NULL),
  ('Otero County Court', 'county', NULL, NULL),
  ('Ouray County Court', 'county', NULL, NULL),
  ('Park County Court', 'county', NULL, NULL),
  ('Phillips County Court', 'county', NULL, NULL),
  ('Pitkin County Court', 'county', NULL, NULL),
  ('Prowers County Court', 'county', NULL, NULL),
  ('Pueblo County Court', 'county', NULL, NULL),
  ('Rio Blanco County Court', 'county', NULL, NULL),
  ('Rio Grande County Court', 'county', NULL, NULL),
  ('Routt County Court', 'county', NULL, NULL),
  ('Saguache County Court', 'county', NULL, NULL),
  ('San Juan County Court', 'county', NULL, NULL),
  ('San Miguel County Court', 'county', NULL, NULL),
  ('Sedgwick County Court', 'county', NULL, NULL),
  ('Summit County Court', 'county', NULL, NULL),
  ('Teller County Court', 'county', NULL, NULL),
  ('Washington County Court', 'county', NULL, NULL),
  ('Weld County Court', 'county', NULL, NULL),
  ('Yuma County Court', 'county', NULL, NULL)
ON CONFLICT (name) DO NOTHING;

