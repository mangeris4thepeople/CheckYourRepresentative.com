// =============================================================================
// GET /api/cron?op=sync-money-sources - load the Money Map's source data.
//
// Three sources, each at state and county level, staged and self-chaining
// exactly like sync-snap:
//   medicare_acs   Census ACS subject table S2704, Medicare coverage alone
//                  or in combination. The table publishes age brackets
//                  (under 19, 19 to 64, 65 and over; variables verified
//                  live), which partition the population, so their sum is
//                  the all ages count. Census estimate.
//   ss_income_acs  Census ACS tables B19055 (households with Social
//                  Security income) and B19065 (aggregate Social Security
//                  income in inflation adjusted dollars; verified live).
//                  Census estimate.
//   ngo_geo        USASpending.gov spending_by_geography: federal award
//                  obligations to nonprofit recipients by place of
//                  performance, one fiscal year. Administrative totals
//                  from the government's own spending ledger.
//
// Census stages need CENSUS_API_KEY or ?censusKey=; the USASpending stages
// need no key. When the pass completes it kicks sync-money-map so the
// rollup and correlations recompute on fresh data.
// =============================================================================
import { sql, hasDb } from "../_db.js";

const YEAR = 2023;               // ACS 5-year vintage
const NGO_FY = 2025;             // federal fiscal year for USASpending
const ACS_SUBJECT = `https://api.census.gov/data/${YEAR}/acs/acs5/subject`;
const ACS_DETAIL = `https://api.census.gov/data/${YEAR}/acs/acs5`;
const USA_SPENDING = "https://api.usaspending.gov/api/v2/search/spending_by_geography/";
const TIME_BUDGET_MS = 40000;
const CURSOR_KEY = "money_sources_cursor";

const MEDICARE_FIELDS = "NAME,S2704_C01_001E,S2704_C02_003E,S2704_C02_004E,S2704_C02_005E";
const SS_FIELDS = "NAME,B19055_001E,B19055_002E,B19065_001E";

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

const STAGES = ["medicare_state", "medicare_county", "ss_state", "ss_county", "ngo_state", "ngo_county"];

export default async function handler(req, res) {
  if (!hasDb) return res.status(500).json({ error: "no database configured" });
  const censusKey = process.env.CENSUS_API_KEY || String(req.query.censusKey || "").trim();

  const startedAt = Date.now();
  const outOfTime = () => Date.now() - startedAt > TIME_BUDGET_MS;

  try {
    await ensureSchema();

    let idx = await getCursor();
    let synced = 0;
    const errors = [];

    while (idx < STAGES.length && !outOfTime()) {
      const stage = STAGES[idx];
      if (stage.startsWith("medicare") || stage.startsWith("ss")) {
        if (!censusKey) return res.status(500).json({ error: "CENSUS_API_KEY not set", detail: "Pass ?censusKey= or set the env var." });
      }
      if (stage === "medicare_state") synced += await loadMedicare("state", censusKey, errors);
      if (stage === "medicare_county") synced += await loadMedicare("county", censusKey, errors);
      if (stage === "ss_state") synced += await loadSsIncome("state", censusKey, errors);
      if (stage === "ss_county") synced += await loadSsIncome("county", censusKey, errors);
      if (stage === "ngo_state") synced += await loadNgoGeo("state", errors);
      if (stage === "ngo_county") synced += await loadNgoGeo("county", errors);
      idx += 1;
      await setCursor(idx);
    }

    const passComplete = idx >= STAGES.length;
    if (passComplete) await setCursor(0);

    // Chain: next chunk mid-pass, or the rollup job on completion.
    let chained = false;
    if (errors.length < 10 && process.env.CRON_SECRET) {
      const host = req.headers["x-forwarded-host"] || req.headers.host;
      if (host) {
        const nextOp = passComplete ? "sync-money-map" : "sync-money-sources";
        const keyParam = !passComplete && !process.env.CENSUS_API_KEY && censusKey
          ? `&censusKey=${encodeURIComponent(censusKey)}` : "";
        const selfUrl = `https://${host}/api/cron?op=${nextOp}&key=${process.env.CRON_SECRET}${keyParam}`;
        await fetch(selfUrl, { signal: AbortSignal.timeout(2000) }).catch(() => {});
        chained = true;
      }
    }

    return res.status(200).json({
      ok: true, syncedThisRun: synced, stagesDone: idx, totalStages: STAGES.length,
      passComplete, chained, errors: errors.slice(0, 10),
    });
  } catch (err) {
    return res.status(500).json({ error: "sync_money_sources_failed", detail: String(err.message || err) });
  }
}

async function censusRows(url, level) {
  const r = await fetch(url);
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(`census ${level} ${r.status}: ${body.slice(0, 140)}`);
  }
  const data = await r.json();
  const header = data[0];
  return data.slice(1).map(rec => {
    const row = {};
    header.forEach((h, i) => { row[h] = rec[i]; });
    return row;
  });
}

function geoOf(row, level) {
  const abbr = FIPS_TO_ABBR[row.state];
  if (!abbr) return null;
  const geoid = level === "county" ? row.state + row.county : row.state;
  return { abbr, geoid };
}

const toInt = (v) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.round(n) : null; };
const toBig = (v) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : null; };

async function loadMedicare(level, key, errors) {
  const rows = await censusRows(`${ACS_SUBJECT}?get=${MEDICARE_FIELDS}&for=${level}:*&key=${key}`, level);
  let synced = 0;
  for (const row of rows) {
    const geo = geoOf(row, level);
    if (!geo) continue;
    const total = toInt(row.S2704_C01_001E);
    const parts = [row.S2704_C02_003E, row.S2704_C02_004E, row.S2704_C02_005E].map(toInt);
    if (total == null || parts.some(p => p == null)) continue;
    const covered = parts[0] + parts[1] + parts[2];
    if (covered > total) continue;
    try {
      await sql`
        INSERT INTO medicare_acs (geo_level, geoid, name, state_abbr, total_population, medicare_covered, data_year)
        VALUES (${level}, ${geo.geoid}, ${row.NAME}, ${geo.abbr}, ${total}, ${covered}, ${YEAR})
        ON CONFLICT (geo_level, geoid, data_year) DO UPDATE SET
          name = EXCLUDED.name, total_population = EXCLUDED.total_population,
          medicare_covered = EXCLUDED.medicare_covered`;
      synced++;
    } catch (err) { errors.push(`medicare ${geo.geoid}: ${String(err.message || err).slice(0, 80)}`); }
  }
  return synced;
}

async function loadSsIncome(level, key, errors) {
  const rows = await censusRows(`${ACS_DETAIL}?get=${SS_FIELDS}&for=${level}:*&key=${key}`, level);
  let synced = 0;
  for (const row of rows) {
    const geo = geoOf(row, level);
    if (!geo) continue;
    const totalHh = toInt(row.B19055_001E);
    const ssHh = toInt(row.B19055_002E);
    const dollars = toBig(row.B19065_001E);
    if (totalHh == null || ssHh == null || dollars == null) continue;
    try {
      await sql`
        INSERT INTO ss_income_acs (geo_level, geoid, name, state_abbr, total_households, ss_households, ss_aggregate_dollars, data_year)
        VALUES (${level}, ${geo.geoid}, ${row.NAME}, ${geo.abbr}, ${totalHh}, ${ssHh}, ${dollars}, ${YEAR})
        ON CONFLICT (geo_level, geoid, data_year) DO UPDATE SET
          name = EXCLUDED.name, total_households = EXCLUDED.total_households,
          ss_households = EXCLUDED.ss_households, ss_aggregate_dollars = EXCLUDED.ss_aggregate_dollars`;
      synced++;
    } catch (err) { errors.push(`ss ${geo.geoid}: ${String(err.message || err).slice(0, 80)}`); }
  }
  return synced;
}

async function loadNgoGeo(level, errors) {
  const body = {
    filters: {
      recipient_type_names: ["nonprofit"],
      time_period: [{ start_date: `${NGO_FY - 1}-10-01`, end_date: `${NGO_FY}-09-30` }],
    },
    scope: "place_of_performance",
    geo_layer: level,
    subawards: false,
  };
  const r = await fetch(USA_SPENDING, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`usaspending ${level} ${r.status}: ${text.slice(0, 160)}`);
  }
  const data = await r.json();
  let synced = 0;
  for (const rec of data.results || []) {
    const shape = String(rec.shape_code || "");
    let geoid = null, abbr = null;
    if (level === "county" && /^\d{5}$/.test(shape)) {
      geoid = shape;
      abbr = FIPS_TO_ABBR[shape.slice(0, 2)];
    } else if (level === "state") {
      // State shape codes arrive as two letter abbreviations.
      abbr = /^[A-Z]{2}$/.test(shape) ? shape : FIPS_TO_ABBR[shape];
      geoid = abbr;
    }
    if (!geoid || !abbr) continue;
    const dollars = toBig(rec.aggregated_amount);
    if (dollars == null) continue;
    try {
      await sql`
        INSERT INTO ngo_geo (geo_level, geoid, name, state_abbr, dollars, fiscal_year)
        VALUES (${level}, ${geoid}, ${rec.display_name || geoid}, ${abbr}, ${dollars}, ${NGO_FY})
        ON CONFLICT (geo_level, geoid, fiscal_year) DO UPDATE SET
          name = EXCLUDED.name, dollars = EXCLUDED.dollars`;
      synced++;
    } catch (err) { errors.push(`ngo ${geoid}: ${String(err.message || err).slice(0, 80)}`); }
  }
  return synced;
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
  const TABLES = {
    medicare_acs: {
      cols: ["id", "geo_level", "geoid", "name", "state_abbr", "total_population", "medicare_covered", "data_year", "created_at"],
      create: () => sql`
        CREATE TABLE IF NOT EXISTS medicare_acs (
          id SERIAL PRIMARY KEY, geo_level TEXT NOT NULL, geoid TEXT NOT NULL, name TEXT NOT NULL,
          state_abbr TEXT NOT NULL, total_population INTEGER, medicare_covered INTEGER,
          data_year INTEGER NOT NULL, created_at TIMESTAMPTZ DEFAULT now())`,
      index: () => sql`CREATE UNIQUE INDEX IF NOT EXISTS medicare_geo_uq ON medicare_acs (geo_level, geoid, data_year)`,
    },
    ss_income_acs: {
      cols: ["id", "geo_level", "geoid", "name", "state_abbr", "total_households", "ss_households", "ss_aggregate_dollars", "data_year", "created_at"],
      create: () => sql`
        CREATE TABLE IF NOT EXISTS ss_income_acs (
          id SERIAL PRIMARY KEY, geo_level TEXT NOT NULL, geoid TEXT NOT NULL, name TEXT NOT NULL,
          state_abbr TEXT NOT NULL, total_households INTEGER, ss_households INTEGER,
          ss_aggregate_dollars NUMERIC(16,0), data_year INTEGER NOT NULL, created_at TIMESTAMPTZ DEFAULT now())`,
      index: () => sql`CREATE UNIQUE INDEX IF NOT EXISTS ss_income_geo_uq ON ss_income_acs (geo_level, geoid, data_year)`,
    },
    ngo_geo: {
      cols: ["id", "geo_level", "geoid", "name", "state_abbr", "dollars", "fiscal_year", "created_at"],
      create: () => sql`
        CREATE TABLE IF NOT EXISTS ngo_geo (
          id SERIAL PRIMARY KEY, geo_level TEXT NOT NULL, geoid TEXT NOT NULL, name TEXT NOT NULL,
          state_abbr TEXT NOT NULL, dollars NUMERIC(16,2), fiscal_year INTEGER NOT NULL,
          created_at TIMESTAMPTZ DEFAULT now())`,
      index: () => sql`CREATE UNIQUE INDEX IF NOT EXISTS ngo_geo_uq ON ngo_geo (geo_level, geoid, fiscal_year)`,
    },
  };
  for (const [t, def] of Object.entries(TABLES)) {
    const table = await sql`
      SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ${t}`;
    if (table.length) {
      const cols = await sql`
        SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ${t}`;
      const have = new Set(cols.map(c => c.column_name));
      const mismatch = def.cols.some(c => !have.has(c)) || have.size !== def.cols.length;
      if (mismatch) await sql.query(`DROP TABLE "${t}" CASCADE`);
    }
    await def.create();
    await def.index();
  }
  await sql`
    CREATE TABLE IF NOT EXISTS sync_state (
      key TEXT PRIMARY KEY, value TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
}
