// =============================================================================
// GET /api/cron?op=sync-snap - national SNAP (food stamps) data sync.
//
// Source: the Census Bureau's American Community Survey 5-year subject table
// S2201 (Food Stamps/SNAP), the only public dataset that reaches below the
// state level: it covers every state, every county, and every incorporated
// place (city and town) in the country. Columns used, per the published
// table shell: S2201_C01_001E total households, S2201_C03_001E households
// receiving SNAP, S2201_C04_001E percent receiving.
//
// The Census data API requires a free API key (verified live: keyless
// requests get an error page), so CENSUS_API_KEY must be set in Vercel.
// One state query, one county query, and one place query per state load
// everything, about 33,000 rows, batch-upserted within a single cron
// invocation under api/cron.js's 300 second maxDuration.
//
// Creates and heals its own schema on every run, same pattern as sync-ssa.
// =============================================================================
import { sql, hasDb } from "../_db.js";

const YEAR = 2023;
const BASE = `https://api.census.gov/data/${YEAR}/acs/acs5/subject`;
const FIELDS = "NAME,S2201_C01_001E,S2201_C03_001E,S2201_C04_001E";

const FIPS_TO_ABBR = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT",
  "10": "DE", "11": "DC", "12": "FL", "13": "GA", "15": "HI", "16": "ID", "17": "IL",
  "18": "IN", "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME", "24": "MD",
  "25": "MA", "26": "MI", "27": "MN", "28": "MS", "29": "MO", "30": "MT", "31": "NE",
  "32": "NV", "33": "NH", "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND",
  "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD",
  "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA", "54": "WV",
  "55": "WI", "56": "WY", "72": "PR",
};

export default async function handler(req, res) {
  if (!hasDb) return res.status(500).json({ error: "no database configured" });
  const key = process.env.CENSUS_API_KEY;
  if (!key) {
    return res.status(500).json({
      error: "CENSUS_API_KEY not set",
      detail: "Sign up free at https://api.census.gov/data/key_signup.html and add CENSUS_API_KEY in Vercel env vars.",
    });
  }

  try {
    await ensureSchema();

    const counts = { state: 0, county: 0, place: 0 };
    const errors = [];

    counts.state = await loadGeography(`${BASE}?get=${FIELDS}&for=state:*&key=${key}`, "state", errors);
    counts.county = await loadGeography(`${BASE}?get=${FIELDS}&for=county:*&key=${key}`, "county", errors);

    // Places (cities and towns). A single national place:* query is not
    // supported for every vintage, so this walks state by state.
    for (const fips of Object.keys(FIPS_TO_ABBR)) {
      counts.place += await loadGeography(
        `${BASE}?get=${FIELDS}&for=place:*&in=state:${fips}`, "place", errors, key
      );
    }

    return res.status(200).json({ ok: true, dataYear: YEAR, synced: counts, errors: errors.slice(0, 10) });
  } catch (err) {
    return res.status(500).json({ error: "sync_snap_failed", detail: String(err.message || err) });
  }
}

async function loadGeography(url, level, errors, appendKey) {
  const full = appendKey ? `${url}&key=${appendKey}` : url;
  const r = await fetch(full);
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(`census ${level} ${r.status}: ${body.slice(0, 140)}`);
  }
  const data = await r.json();
  const header = data[0];
  const iName = header.indexOf("NAME");
  const iTotal = header.indexOf("S2201_C01_001E");
  const iSnap = header.indexOf("S2201_C03_001E");
  const iPct = header.indexOf("S2201_C04_001E");
  const iState = header.indexOf("state");
  const iCounty = header.indexOf("county");
  const iPlace = header.indexOf("place");

  const rows = [];
  for (const rec of data.slice(1)) {
    const stateFips = rec[iState];
    const abbr = FIPS_TO_ABBR[stateFips];
    if (!abbr) continue;
    let geoid = stateFips;
    if (level === "county") geoid = stateFips + rec[iCounty];
    if (level === "place") geoid = stateFips + rec[iPlace];
    const total = toInt(rec[iTotal]);
    const snap = toInt(rec[iSnap]);
    const pct = toNum(rec[iPct]);
    if (total == null || snap == null) continue;
    // Census marks suppressed values with large negative sentinels.
    if (total < 0 || snap < 0 || (pct != null && (pct < 0 || pct > 100))) continue;
    rows.push([level, geoid, rec[iName], abbr, total, snap, pct, YEAR]);
  }

  let synced = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const values = [];
    const params = [];
    batch.forEach((row, j) => {
      const o = j * 8;
      values.push(`($${o + 1},$${o + 2},$${o + 3},$${o + 4},$${o + 5},$${o + 6},$${o + 7},$${o + 8})`);
      params.push(...row);
    });
    try {
      await sql.query(
        `INSERT INTO snap_acs
           (geo_level, geoid, name, state_abbr, total_households, snap_households, snap_percent, data_year)
         VALUES ${values.join(",")}
         ON CONFLICT (geo_level, geoid, data_year) DO UPDATE SET
           name = EXCLUDED.name, state_abbr = EXCLUDED.state_abbr,
           total_households = EXCLUDED.total_households,
           snap_households = EXCLUDED.snap_households,
           snap_percent = EXCLUDED.snap_percent`,
        params
      );
      synced += batch.length;
    } catch (err) {
      errors.push(`${level} batch ${i}: ${String(err.message || err).slice(0, 100)}`);
    }
  }
  return synced;
}

function toInt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}
function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function ensureSchema() {
  // Same healing rule as sync-ssa: this table is a pure mirror of the ACS
  // dataset, refetched in full on every run, so a shape mismatch rebuilds it.
  const wanted = ["id", "geo_level", "geoid", "name", "state_abbr",
    "total_households", "snap_households", "snap_percent", "data_year", "created_at"];
  const table = await sql`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'snap_acs'`;
  if (table.length) {
    const cols = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'snap_acs'`;
    const have = new Set(cols.map(c => c.column_name));
    const mismatch = wanted.some(c => !have.has(c)) || have.size !== wanted.length;
    if (mismatch) await sql`DROP TABLE snap_acs CASCADE`;
  }

  await sql`
    CREATE TABLE IF NOT EXISTS snap_acs (
      id                SERIAL PRIMARY KEY,
      geo_level         TEXT NOT NULL,
      geoid             TEXT NOT NULL,
      name              TEXT NOT NULL,
      state_abbr        TEXT NOT NULL,
      total_households  INTEGER,
      snap_households   INTEGER,
      snap_percent      NUMERIC(5,2),
      data_year         INTEGER NOT NULL,
      created_at        TIMESTAMPTZ DEFAULT now()
    )`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS snap_geo_uq ON snap_acs (geo_level, geoid, data_year)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_snap_state ON snap_acs (state_abbr, geo_level)`;
}
