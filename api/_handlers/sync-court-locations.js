// =============================================================================
// GET /api/cron?op=sync-court-locations - map every tracked court to a place.
//
// The mapping pass runs over national_courts, which is itself a mirror of
// CourtListener's courts data (embedded in the positions sync), and writes
// judicial_court_locations. Three confidence levels, and nothing is guessed:
//   county_parsed   the court's own name contains one of its state's real
//                   county, parish, or borough names (verified against the
//                   Census county list), so it maps to that county's FIPS
//   statewide_seat  a supreme or appellate court, attached to the state's
//                   seat city (the capital, with known exceptions like the
//                   Alaska Supreme Court in Anchorage and the Louisiana
//                   Supreme Court in New Orleans)
//   unlocated       everything else, flagged for display as unmapped rather
//                   than pinned to a wrong place
// Pure database computation, no external requests, safe to rerun anytime.
// =============================================================================
import { sql, hasDb } from "../_db.js";
import COUNTY_FIPS from "./_county-fips.js";

const SEAT_CITIES = {
  AL: "Montgomery", AK: "Anchorage", AZ: "Phoenix", AR: "Little Rock", CA: "Sacramento",
  CO: "Denver", CT: "Hartford", DE: "Dover", FL: "Tallahassee", GA: "Atlanta",
  HI: "Honolulu", ID: "Boise", IL: "Springfield", IN: "Indianapolis", IA: "Des Moines",
  KS: "Topeka", KY: "Frankfort", LA: "New Orleans", ME: "Augusta", MD: "Annapolis",
  MA: "Boston", MI: "Lansing", MN: "St. Paul", MS: "Jackson", MO: "Jefferson City",
  MT: "Helena", NE: "Lincoln", NV: "Carson City", NH: "Concord", NJ: "Trenton",
  NM: "Santa Fe", NY: "Albany", NC: "Raleigh", ND: "Bismarck", OH: "Columbus",
  OK: "Oklahoma City", OR: "Salem", PA: "Harrisburg", RI: "Providence", SC: "Columbia",
  SD: "Pierre", TN: "Nashville", TX: "Austin", UT: "Salt Lake City", VT: "Montpelier",
  VA: "Richmond", WA: "Olympia", WV: "Charleston", WI: "Madison", WY: "Cheyenne",
  DC: "Washington", PR: "San Juan",
};

const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();

// Find a county of this state whose name appears in the court name as a
// whole-word phrase, longest names first so "Box Elder" wins over "Elder".
function parseCounty(courtName, stateAbbr) {
  const counties = COUNTY_FIPS[stateAbbr];
  if (!counties) return null;
  const hay = ` ${norm(courtName)} `;
  let best = null;
  for (const [name, fips] of Object.entries(counties)) {
    const needle = ` ${norm(name)} `;
    if (hay.includes(needle)) {
      if (!best || name.length > best.name.length) best = { name, fips };
    }
  }
  return best;
}

export default async function handler(req, res) {
  if (!hasDb) return res.status(500).json({ error: "no database configured" });

  try {
    await ensureSchema();

    const courts = await sql`SELECT cl_id, full_name, jurisdiction, state_abbr FROM national_courts`;
    let countyParsed = 0, statewideSeat = 0, unlocated = 0;

    for (const c of courts) {
      let countyFips = null, countyName = null, city = null, confidence = "unlocated";

      const county = c.state_abbr ? parseCounty(c.full_name, c.state_abbr) : null;
      if (county) {
        countyFips = county.fips;
        countyName = county.name;
        confidence = "county_parsed";
        countyParsed++;
      } else if ((c.jurisdiction === "S" || c.jurisdiction === "SA") && c.state_abbr && SEAT_CITIES[c.state_abbr]) {
        city = SEAT_CITIES[c.state_abbr];
        confidence = "statewide_seat";
        statewideSeat++;
      } else {
        unlocated++;
      }

      await sql`
        INSERT INTO judicial_court_locations (court_cl_id, state_abbr, county_fips, county_name, city, confidence, synced_at)
        VALUES (${c.cl_id}, ${c.state_abbr}, ${countyFips}, ${countyName}, ${city}, ${confidence}, now())
        ON CONFLICT (court_cl_id) DO UPDATE SET
          state_abbr = EXCLUDED.state_abbr, county_fips = EXCLUDED.county_fips,
          county_name = EXCLUDED.county_name, city = EXCLUDED.city,
          confidence = EXCLUDED.confidence, synced_at = now()`;
    }

    return res.status(200).json({
      ok: true, courts: courts.length, countyParsed, statewideSeat, unlocated,
    });
  } catch (err) {
    return res.status(500).json({ error: "sync_court_locations_failed", detail: String(err.message || err) });
  }
}

async function ensureSchema() {
  const EXPECTED = ["court_cl_id", "state_abbr", "county_fips", "county_name", "city", "confidence", "synced_at"];
  const table = await sql`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'judicial_court_locations'`;
  if (table.length) {
    const cols = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'judicial_court_locations'`;
    const have = new Set(cols.map(c => c.column_name));
    const mismatch = EXPECTED.some(c => !have.has(c)) || have.size !== EXPECTED.length;
    if (mismatch) await sql`DROP TABLE judicial_court_locations CASCADE`;
  }
  await sql`
    CREATE TABLE IF NOT EXISTS judicial_court_locations (
      court_cl_id  TEXT PRIMARY KEY REFERENCES national_courts(cl_id) ON DELETE CASCADE,
      state_abbr   TEXT,
      county_fips  TEXT,
      county_name  TEXT,
      city         TEXT,
      confidence   TEXT NOT NULL,
      synced_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_court_loc_state ON judicial_court_locations (state_abbr, county_fips)`;
}
