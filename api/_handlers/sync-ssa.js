// =============================================================================
// GET /api/cron?op=sync-ssa - Social Security (OASDI) state data sync.
//
// Fetches SSA's OASDI Beneficiaries by State dataset (2015 vintage, the most
// recent state-level breakdown SSA publishes in this form) from their public
// ArcGIS feature service and loads it into ssa_oasdi_state. Field names
// verified live against the service: ORDER1_NAM / ORDER1_ABB for the state,
// Total_Beneficiaries and the retirement/survivors/disability breakdowns as
// doubles. total_monthly_benefits stays NULL for now, the payments layer is
// a separate feature layer not yet wired.
//
// Creates and heals its own schema on every run, the same pattern as
// sync-judges, so one authenticated trigger fully provisions this feature
// against whatever database the deployment actually uses.
// =============================================================================
import { sql, hasDb } from "../_db.js";

const SSA_URL =
  "https://services6.arcgis.com/zFiipv75rloRP5N4/ArcGIS/rest/services/OASDI_2015/FeatureServer/0/query" +
  "?where=1%3D1&outFields=*&returnGeometry=false&f=json";
const DATA_YEAR = 2015;

export default async function handler(req, res) {
  if (!hasDb) return res.status(500).json({ error: "no database configured" });

  try {
    await ensureSchema();

    let offset = 0;
    let synced = 0;
    const errors = [];

    for (let page = 0; page < 10; page++) {
      const r = await fetch(`${SSA_URL}&resultOffset=${offset}`);
      if (!r.ok) {
        const body = await r.text().catch(() => "");
        throw new Error(`SSA ArcGIS ${r.status}: ${body.slice(0, 160)}`);
      }
      const data = await r.json();
      if (data.error) throw new Error(`SSA ArcGIS error: ${JSON.stringify(data.error).slice(0, 160)}`);
      const features = data.features || [];
      if (!features.length) break;

      for (const f of features) {
        const a = f.attributes || {};
        const state = a.State_Territory || a.ORDER1_NAM || a.NAME_LAT;
        if (!state) continue;
        // Some territories appear as two map features, one carrying the real
        // values and one zeroed. Never let a zero row overwrite real data.
        if (!toInt(a.Total_Beneficiaries)) continue;
        try {
          await sql`
            INSERT INTO ssa_oasdi_state
              (state, state_abbr, data_year, total_beneficiaries,
               retirement_workers, retirement_spouses, retirement_children,
               survivors_widowers_parents, survivors_children,
               disability_workers, disability_spouses, disability_children,
               men_65_older, women_65_older)
            VALUES
              (${state}, ${a.ORDER1_ABB || null}, ${DATA_YEAR}, ${toInt(a.Total_Beneficiaries)},
               ${toInt(a.Retirement_Workers)}, ${toInt(a.Retirement_Spouses)}, ${toInt(a.Retirement_Children)},
               ${toInt(a.Survivors_Widowers_Parents)}, ${toInt(a.Survivors_Children)},
               ${toInt(a.Disability_Workers)}, ${toInt(a.Disability_Spouses)}, ${toInt(a.Disability_Children)},
               ${toInt(a.Men65_Older)}, ${toInt(a.Women65_Older)})
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
          errors.push(`${state}: ${String(err.message || err).slice(0, 100)}`);
        }
      }

      offset += features.length;
      if (!data.exceededTransferLimit) break;
    }

    return res.status(200).json({ ok: true, synced, errors });
  } catch (err) {
    return res.status(500).json({ error: "sync_ssa_failed", detail: String(err.message || err) });
  }
}

function toInt(v) {
  const n = Number(v);
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
      disability_children         INTEGER,
      men_65_older                INTEGER,
      women_65_older              INTEGER,
      total_monthly_benefits      NUMERIC(16,2),
      created_at                  TIMESTAMPTZ DEFAULT now()
    )`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS ssa_state_year_uq ON ssa_oasdi_state (state, data_year)`;
}
