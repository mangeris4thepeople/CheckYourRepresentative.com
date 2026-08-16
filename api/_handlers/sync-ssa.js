// =============================================================================
// GET /api/cron?op=sync-ssa - Social Security (OASDI) state data sync.
//
// Pulls SSA's official "OASDI Beneficiaries by State and County" annual
// publication (Table 2: number of beneficiaries in current-payment status by
// state, type of benefit, and sex of beneficiaries aged 65 or older) straight
// from ssa.gov. The newest edition is found by probing backward from the
// current year, so each August when SSA publishes the next edition this sync
// picks it up automatically - no more hardcoded vintage. (The previous
// version of this sync mirrored a third-party ArcGIS copy of the 2015
// edition, which is why the site showed 11-year-old data.)
//
// Creates and heals its own schema on every run, the same pattern as
// sync-judges, so one authenticated trigger fully provisions this feature
// against whatever database the deployment actually uses.
// =============================================================================
import { sql, hasDb } from "../_db.js";

const EDITION_URL = (year) =>
  `https://www.ssa.gov/policy/docs/statcomps/oasdi_sc/${year}/table02.html`;
const OLDEST_EDITION = 2019;

const STATE_ABBR = {
  "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR",
  "California": "CA", "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE",
  "District of Columbia": "DC", "Florida": "FL", "Georgia": "GA",
  "Hawaii": "HI", "Idaho": "ID", "Illinois": "IL", "Indiana": "IN",
  "Iowa": "IA", "Kansas": "KS", "Kentucky": "KY", "Louisiana": "LA",
  "Maine": "ME", "Maryland": "MD", "Massachusetts": "MA", "Michigan": "MI",
  "Minnesota": "MN", "Mississippi": "MS", "Missouri": "MO", "Montana": "MT",
  "Nebraska": "NE", "Nevada": "NV", "New Hampshire": "NH", "New Jersey": "NJ",
  "New Mexico": "NM", "New York": "NY", "North Carolina": "NC",
  "North Dakota": "ND", "Ohio": "OH", "Oklahoma": "OK", "Oregon": "OR",
  "Pennsylvania": "PA", "Rhode Island": "RI", "South Carolina": "SC",
  "South Dakota": "SD", "Tennessee": "TN", "Texas": "TX", "Utah": "UT",
  "Vermont": "VT", "Virginia": "VA", "Washington": "WA",
  "West Virginia": "WV", "Wisconsin": "WI", "Wyoming": "WY",
  "American Samoa": "AS", "Guam": "GU", "Northern Mariana Islands": "MP",
  "Puerto Rico": "PR", "Virgin Islands": "VI",
};

export default async function handler(req, res) {
  if (!hasDb) return res.status(500).json({ error: "no database configured" });

  try {
    await ensureSchema();

    // Find the newest published edition. SSA posts each year's edition the
    // following August, so the current calendar year usually 404s until then.
    let year = new Date().getFullYear();
    let html = null;
    for (; year >= OLDEST_EDITION; year--) {
      const r = await fetch(EDITION_URL(year), {
        headers: { "user-agent": "checkyourrepresentative.com data sync" },
      });
      if (r.ok) { html = await r.text(); break; }
    }
    if (!html) throw new Error("no SSA edition found back to " + OLDEST_EDITION);

    const rows = parseTable2(html);
    if (rows.length < 50) {
      throw new Error(`SSA table parse produced only ${rows.length} rows - format may have changed`);
    }

    let synced = 0;
    const errors = [];
    for (const row of rows) {
      try {
        await sql`
          INSERT INTO ssa_oasdi_state
            (state, state_abbr, data_year, total_beneficiaries,
             retirement_workers, retirement_spouses, retirement_children,
             survivors_widowers_parents, survivors_children,
             disability_workers, disability_spouses, disability_children,
             men_65_older, women_65_older)
          VALUES
            (${row.state}, ${STATE_ABBR[row.state] || null}, ${year}, ${row.values[0]},
             ${row.values[1]}, ${row.values[2]}, ${row.values[3]},
             ${row.values[4]}, ${row.values[5]},
             ${row.values[6]}, ${row.values[7]}, ${row.values[8]},
             ${row.values[9]}, ${row.values[10]})
          ON CONFLICT (state, data_year) DO UPDATE SET
            state_abbr = EXCLUDED.state_abbr,
            total_beneficiaries = EXCLUDED.total_beneficiaries,
            retirement_workers = EXCLUDED.retirement_workers,
            retirement_spouses = EXCLUDED.retirement_spouses,
            retirement_children = EXCLUDED.retirement_children,
            survivors_widowers_parents = EXCLUDED.survivors_widowers_parents,
            survivors_children = EXCLUDED.survivors_children,
            disability_workers = EXCLUDED.disability_workers,
            disability_spouses = EXCLUDED.disability_spouses,
            disability_children = EXCLUDED.disability_children,
            men_65_older = EXCLUDED.men_65_older,
            women_65_older = EXCLUDED.women_65_older`;
        synced++;
      } catch (err) {
        errors.push(`${row.state}: ${String(err.message || err).slice(0, 100)}`);
      }
    }

    return res.status(200).json({ ok: true, edition: year, synced, errors });
  } catch (err) {
    return res.status(500).json({ error: "sync_ssa_failed", detail: String(err.message || err) });
  }
}

// ---------------------------------------------------------------------------
// Table 2 rows look like: a state name cell followed by 11 numeric cells
// (total; retirement workers/spouses/children; survivors widow(er)s-parents/
// children; disability workers/spouses/children; men 65+; women 65+).
// Parse defensively: work row by row, strip tags, accept only rows whose
// first cell is a known state/territory name and which carry 11 numbers.
function parseTable2(html) {
  const out = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let m;
  while ((m = rowRe.exec(html))) {
    const cells = [...m[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)]
      .map(c => c[1].replace(/<[^>]*>/g, "").replace(/&nbsp;| /g, " ").trim());
    if (cells.length < 12) continue;
    const state = cells[0].replace(/\s+/g, " ");
    if (!STATE_ABBR[state]) continue;
    const values = cells.slice(1, 12).map(toInt);
    if (values[0] === null) continue; // total must be a real number
    out.push({ state, values });
  }
  return out;
}

function toInt(v) {
  const cleaned = String(v).replace(/,/g, "").trim();
  if (!cleaned || cleaned === "..." || cleaned === "(X)" || cleaned === "--") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n) : null;
}

async function ensureSchema() {
  // Same healing rule as sync-judges: a pre-existing table that is not
  // exactly the expected shape gets rebuilt. This table is a pure mirror of
  // the SSA dataset, refetched in full on every run, so nothing is lost.
  const wanted = ["id", "state", "state_abbr", "data_year", "total_beneficiaries",
    "retirement_workers", "retirement_spouses", "retirement_children",
    "survivors_widowers_parents", "survivors_children",
    "disability_workers", "disability_spouses", "disability_children",
    "men_65_older", "women_65_older", "total_monthly_benefits", "created_at"];
  const table = await sql`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ssa_oasdi_state'`;
  if (table.length) {
    const cols = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'ssa_oasdi_state'`;
    const have = new Set(cols.map(c => c.column_name));
    const mismatch = wanted.some(c => !have.has(c)) || have.size !== wanted.length;
    if (mismatch) await sql`DROP TABLE ssa_oasdi_state CASCADE`;
  }

  await sql`
    CREATE TABLE IF NOT EXISTS ssa_oasdi_state (
      id                          SERIAL PRIMARY KEY,
      state                       TEXT NOT NULL,
      state_abbr                  TEXT,
      data_year                   INTEGER,
      total_beneficiaries         INTEGER,
      retirement_workers          INTEGER,
      retirement_spouses          INTEGER,
      retirement_children         INTEGER,
      survivors_widowers_parents  INTEGER,
      survivors_children          INTEGER,
      disability_workers          INTEGER,
      disability_spouses          INTEGER,
      disability_children        INTEGER,
      men_65_older                INTEGER,
      women_65_older              INTEGER,
      total_monthly_benefits      NUMERIC(16,2),
      created_at                  TIMESTAMPTZ DEFAULT now()
    )`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS ssa_state_year_uq ON ssa_oasdi_state (state, data_year)`;
}
