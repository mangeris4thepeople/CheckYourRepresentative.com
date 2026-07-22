// =============================================================================
// GET /api/cron?op=sync-money-map - build the Money Map rollup and
// correlations.
//
// Aggregates every program's county level figures into
// money_map_county_rollup with per capita columns (population is the ACS
// civilian noninstitutionalized population from the Medicaid mirror), then
// computes Pearson correlations between every program pair across
// counties, nationally and per state, into money_map_correlations.
//
// Campaign contributions have no county columns anywhere in this table:
// the FEC publishes itemized contributions by contributor city and state,
// not by county, so that layer exists at state level only (from the
// tracked delegation's donor buckets) and joins no county correlations.
// Pure database computation, safe to rerun anytime.
// =============================================================================
import { sql, hasDb } from "../_db.js";

// Program keys and where their county values come from.
const PROGRAMS = ["medicare", "medicaid", "snap", "ss_income", "ngo"];
const MIN_N = 5;

export default async function handler(req, res) {
  if (!hasDb) return res.status(500).json({ error: "no database configured" });

  try {
    await ensureSchema();

    // County frame: population and names from the Medicaid ACS mirror.
    const base = await sql`
      SELECT geoid, name, state_abbr, total_population
      FROM medicaid_acs WHERE geo_level = 'county'`;
    if (!base.length) {
      return res.status(200).json({ ok: false, reason: "medicaid_acs county rows missing, run sync-medicaid first" });
    }

    const counties = new Map();
    for (const b of base) {
      counties.set(b.geoid, {
        fips: b.geoid, name: b.name, state: b.state_abbr,
        pop: Number(b.total_population) || null,
        medicare: null, medicaid: null, snap: null, ss_income: null, ngo: null,
      });
    }

    const put = (geoid, key, value) => {
      const c = counties.get(geoid);
      if (c && value != null) c[key] = Number(value);
    };
    for (const r of await sql`SELECT geoid, medicare_covered FROM medicare_acs WHERE geo_level = 'county'`) {
      put(r.geoid, "medicare", r.medicare_covered);
    }
    for (const r of await sql`SELECT geoid, medicaid_covered FROM medicaid_acs WHERE geo_level = 'county'`) {
      put(r.geoid, "medicaid", r.medicaid_covered);
    }
    for (const r of await sql`SELECT geoid, snap_households FROM snap_acs WHERE geo_level = 'county'`) {
      put(r.geoid, "snap", r.snap_households);
    }
    for (const r of await sql`SELECT geoid, ss_aggregate_dollars FROM ss_income_acs WHERE geo_level = 'county'`) {
      put(r.geoid, "ss_income", r.ss_aggregate_dollars);
    }
    for (const r of await sql`SELECT geoid, dollars FROM ngo_geo WHERE geo_level = 'county'`) {
      put(r.geoid, "ngo", r.dollars);
    }

    // Rollup upsert, batched.
    const rows = [...counties.values()];
    const pc = (v, pop) => (v != null && pop > 0 ? Math.round((v / pop) * 10000) / 10000 : null);
    let upserted = 0;
    for (let i = 0; i < rows.length; i += 400) {
      const batch = rows.slice(i, i + 400);
      const values = [];
      const params = [];
      batch.forEach((c, j) => {
        const o = j * 14;
        values.push(`(${Array.from({ length: 14 }, (_, k) => `$${o + k + 1}`).join(",")})`);
        params.push(
          c.fips, c.state, c.name, c.pop,
          c.medicare, c.medicaid, c.snap, c.ss_income, c.ngo,
          pc(c.medicare, c.pop), pc(c.medicaid, c.pop), pc(c.snap, c.pop),
          pc(c.ss_income, c.pop), pc(c.ngo, c.pop)
        );
      });
      await sql.query(
        `INSERT INTO money_map_county_rollup
           (county_fips, state_abbr, county_name, population,
            medicare_covered, medicaid_covered, snap_households, ss_dollars, ngo_dollars,
            pc_medicare, pc_medicaid, pc_snap, pc_ss_income, pc_ngo)
         VALUES ${values.join(",")}
         ON CONFLICT (county_fips) DO UPDATE SET
           state_abbr = EXCLUDED.state_abbr, county_name = EXCLUDED.county_name,
           population = EXCLUDED.population,
           medicare_covered = EXCLUDED.medicare_covered, medicaid_covered = EXCLUDED.medicaid_covered,
           snap_households = EXCLUDED.snap_households, ss_dollars = EXCLUDED.ss_dollars,
           ngo_dollars = EXCLUDED.ngo_dollars,
           pc_medicare = EXCLUDED.pc_medicare, pc_medicaid = EXCLUDED.pc_medicaid,
           pc_snap = EXCLUDED.pc_snap, pc_ss_income = EXCLUDED.pc_ss_income,
           pc_ngo = EXCLUDED.pc_ngo, computed_at = now()`,
        params
      );
      upserted += batch.length;
    }

    // Correlations over per capita values, national and per state.
    const scopes = new Map([["US", rows]]);
    for (const c of rows) {
      if (!scopes.has(c.state)) scopes.set(c.state, []);
      scopes.get(c.state).push(c);
    }
    const corrRows = [];
    for (const [scope, list] of scopes) {
      for (let a = 0; a < PROGRAMS.length; a++) {
        for (let b = a + 1; b < PROGRAMS.length; b++) {
          const ka = PROGRAMS[a], kb = PROGRAMS[b];
          const pairs = list
            .map(c => [pcv(c, ka), pcv(c, kb)])
            .filter(([x, y]) => x != null && y != null);
          if (pairs.length < MIN_N) continue;
          const r = pearson(pairs);
          if (r == null) continue;
          corrRows.push([scope, ka, kb, Math.round(r * 1000) / 1000, pairs.length]);
        }
      }
    }
    for (let i = 0; i < corrRows.length; i += 300) {
      const batch = corrRows.slice(i, i + 300);
      const values = [];
      const params = [];
      batch.forEach((row, j) => {
        const o = j * 5;
        values.push(`($${o + 1},$${o + 2},$${o + 3},$${o + 4},$${o + 5})`);
        params.push(...row);
      });
      await sql.query(
        `INSERT INTO money_map_correlations (scope, program_a, program_b, r, n)
         VALUES ${values.join(",")}
         ON CONFLICT (scope, program_a, program_b) DO UPDATE SET
           r = EXCLUDED.r, n = EXCLUDED.n, computed_at = now()`,
        params
      );
    }

    return res.status(200).json({ ok: true, counties: upserted, correlations: corrRows.length });
  } catch (err) {
    return res.status(500).json({ error: "sync_money_map_failed", detail: String(err.message || err) });
  }
}

function pcv(c, key) {
  const v = c[key];
  return v != null && c.pop > 0 ? v / c.pop : null;
}

function pearson(pairs) {
  const n = pairs.length;
  let sx = 0, sy = 0;
  for (const [x, y] of pairs) { sx += x; sy += y; }
  const mx = sx / n, my = sy / n;
  let num = 0, dx = 0, dy = 0;
  for (const [x, y] of pairs) {
    num += (x - mx) * (y - my);
    dx += (x - mx) ** 2;
    dy += (y - my) ** 2;
  }
  if (dx === 0 || dy === 0) return null;
  return num / Math.sqrt(dx * dy);
}

async function ensureSchema() {
  const TABLES = {
    money_map_county_rollup: {
      cols: ["county_fips", "state_abbr", "county_name", "population",
        "medicare_covered", "medicaid_covered", "snap_households", "ss_dollars", "ngo_dollars",
        "pc_medicare", "pc_medicaid", "pc_snap", "pc_ss_income", "pc_ngo", "computed_at"],
      create: () => sql`
        CREATE TABLE IF NOT EXISTS money_map_county_rollup (
          county_fips TEXT PRIMARY KEY, state_abbr TEXT, county_name TEXT, population INTEGER,
          medicare_covered INTEGER, medicaid_covered INTEGER, snap_households INTEGER,
          ss_dollars NUMERIC(16,0), ngo_dollars NUMERIC(16,2),
          pc_medicare NUMERIC(12,4), pc_medicaid NUMERIC(12,4), pc_snap NUMERIC(12,4),
          pc_ss_income NUMERIC(14,4), pc_ngo NUMERIC(14,4),
          computed_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
      index: () => sql`CREATE INDEX IF NOT EXISTS idx_money_rollup_state ON money_map_county_rollup (state_abbr)`,
    },
    money_map_correlations: {
      cols: ["scope", "program_a", "program_b", "r", "n", "computed_at"],
      create: () => sql`
        CREATE TABLE IF NOT EXISTS money_map_correlations (
          scope TEXT NOT NULL, program_a TEXT NOT NULL, program_b TEXT NOT NULL,
          r NUMERIC(6,3), n INTEGER, computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          PRIMARY KEY (scope, program_a, program_b))`,
      index: () => Promise.resolve(),
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
}
