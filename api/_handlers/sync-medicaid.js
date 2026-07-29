// =============================================================================
// GET /api/cron?op=sync-medicaid - national Medicaid coverage data sync.
//
// Source: the Census Bureau's American Community Survey 5-year subject table
// S2704 (Public Health Insurance Coverage by Type). Variables verified live:
// S2704_C01_001E is the civilian noninstitutionalized population and
// S2704_C02_006E is "Medicaid/means-tested public coverage alone or in
// combination". The percent is computed here from those two, so no reliance
// on the table's percent columns. Covers every state, county, and place,
// the same reach as the SNAP sync.
//
// Identical machinery to sync-snap: staged, resumable, self-chaining, with
// the Census key from CENSUS_API_KEY or a ?censusKey= param on manual runs.
// =============================================================================
import { sql, hasDb } from "../_db.js";

const YEAR = 2023;
const BASE = `https://api.census.gov/data/${YEAR}/acs/acs5/subject`;
const FIELDS = "NAME,S2704_C01_001E,S2704_C02_006E";
const TIME_BUDGET_MS = 40000;
const CURSOR_KEY = "medicaid_cursor";

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

const STAGES = ["state", "county", ...Object.keys(FIPS_TO_ABBR)];

export default async function handler(req, res) {
  if (!hasDb) return res.status(500).json({ error: "no database configured" });
  const key = process.env.CENSUS_API_KEY || String(req.query.censusKey || "").trim();
  if (!key) {
    return res.status(500).json({
      error: "CENSUS_API_KEY not set",
      detail: "Sign up free at https://api.census.gov/data/key_signup.html and add CENSUS_API_KEY in Vercel env vars, or pass ?censusKey= on a manual run.",
    });
  }

  const startedAt = Date.now();
  const outOfTime = () => Date.now() - startedAt > TIME_BUDGET_MS;

  try {
    await ensureSchema();

    let idx = await getCursor();
    let synced = 0;
    const errors = [];

    while (idx < STAGES.length && !outOfTime()) {
      const stage = STAGES[idx];
      if (stage === "state") {
        synced += await loadGeography(`${BASE}?get=${FIELDS}&for=state:*&key=${key}`, "state", errors);
      } else if (stage === "county") {
        synced += await loadGeography(`${BASE}?get=${FIELDS}&for=county:*&key=${key}`, "county", errors);
      } else {
        synced += await loadGeography(
          `${BASE}?get=${FIELDS}&for=place:*&in=state:${stage}&key=${key}`, "place", errors
        );
      }
      idx += 1;
      await setCursor(idx);
    }

    const passComplete = idx >= STAGES.length;
    if (passComplete) await setCursor(0);

    let chained = false;
    if (!passComplete && errors.length < 10 && process.env.CRON_SECRET) {
      const host = req.headers["x-forwarded-host"] || req.headers.host;
      if (host) {
        const keyParam = process.env.CENSUS_API_KEY ? "" : `&censusKey=${encodeURIComponent(key)}`;
        const selfUrl = `https://${host}/api/cron?op=sync-medicaid&key=${process.env.CRON_SECRET}${keyParam}`;
        await fetch(selfUrl, { signal: AbortSignal.timeout(2000) }).catch(() => {});
        chained = true;
      }
    }

    return res.status(200).json({
      ok: true, dataYear: YEAR, syncedThisRun: synced,
      stagesDone: idx, totalStages: STAGES.length, passComplete, chained,
      errors: errors.slice(0, 10),
    });
  } catch (err) {
    return res.status(500).json({ error: "sync_medicaid_failed", detail: String(err.message || err) });
  }
}

async function loadGeography(url, level, errors) {
  const r = await fetch(url);
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(`census ${level} ${r.status}: ${body.slice(0, 140)}`);
  }
  const data = await r.json();
  const header = data[0];
  const iName = header.indexOf("NAME");
  const iTotal = header.indexOf("S2704_C01_001E");
  const iCovered = header.indexOf("S2704_C02_006E");
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
    const covered = toInt(rec[iCovered]);
    if (total == null || covered == null) continue;
    // Census marks suppressed values with large negative sentinels.
    if (total < 0 || covered < 0 || covered > total) continue;
    const pct = total > 0 ? Math.round((covered / total) * 1000) / 10 : null;
    rows.push([level, geoid, rec[iName], abbr, total, covered, pct, YEAR]);
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
        `INSERT INTO medicaid_acs
           (geo_level, geoid, name, state_abbr, total_population, medicaid_covered, medicaid_percent, data_year)
         VALUES ${values.join(",")}
         ON CONFLICT (geo_level, geoid, data_year) DO UPDATE SET
           name = EXCLUDED.name, state_abbr = EXCLUDED.state_abbr,
           total_population = EXCLUDED.total_population,
           medicaid_covered = EXCLUDED.medicaid_covered,
           medicaid_percent = EXCLUDED.medicaid_percent`,
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

async function getCursor() {
  const rows = await sql`SELECT value FROM sync_state WHERE key = ${CURSOR_KEY}`;
  if (!rows.length || !rows[0].value) return 0;
  const n = parseInt(rows[0].value, 10);
  return Number.isFinite(n) && n >= 0 && n < STAGES.length ? n : 0;
}

async function setCursor(idx) {
  await sql`
    INSERT INTO sync_state (key, value, updated_at)
    VALUES (${CURSOR_KEY}, ${String(idx)}, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
}

async function ensureSchema() {
  // Same healing rule as sync-snap: a pure mirror, refetched in full every
  // pass, so a shape mismatch rebuilds it.
  const wanted = ["id", "geo_level", "geoid", "name", "state_abbr",
    "total_population", "medicaid_covered", "medicaid_percent", "data_year", "created_at"];
  const table = await sql`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'medicaid_acs'`;
  if (table.length) {
    const cols = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'medicaid_acs'`;
    const have = new Set(cols.map(c => c.column_name));
    const mismatch = wanted.some(c => !have.has(c)) || have.size !== wanted.length;
    if (mismatch) await sql`DROP TABLE medicaid_acs CASCADE`;
  }

  await sql`
    CREATE TABLE IF NOT EXISTS medicaid_acs (
      id                SERIAL PRIMARY KEY,
      geo_level         TEXT NOT NULL,
      geoid             TEXT NOT NULL,
      name              TEXT NOT NULL,
      state_abbr        TEXT NOT NULL,
      total_population  INTEGER,
      medicaid_covered  INTEGER,
      medicaid_percent  NUMERIC(5,2),
      data_year         INTEGER NOT NULL,
      created_at        TIMESTAMPTZ DEFAULT now()
    )`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS medicaid_geo_uq ON medicaid_acs (geo_level, geoid, data_year)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_medicaid_state ON medicaid_acs (state_abbr, geo_level)`;
  await sql`
    CREATE TABLE IF NOT EXISTS sync_state (
      key        TEXT PRIMARY KEY,
      value      TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
}
