// =============================================================================
// Medicaid coverage read endpoints, backed by the Census ACS mirror that
// sync-medicaid maintains. One handler serves both ops:
//   GET /api/medicaid-national                -> every state's totals
//   GET /api/medicaid-state-detail?state=CO   -> one state's counties/places
// Returns the same generic row shape as the SNAP endpoints (universe_total,
// benefit_count, benefit_percent) so the shared BenefitMap UI reads both.
// =============================================================================
import { sql, hasDb } from "../_db.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=7200");
  if (!hasDb) return res.status(200).json({ ready: false, reason: "no_database" });

  try {
    if (req.query.op === "medicaid-state-detail") return await stateDetail(req, res);
    return await national(res);
  } catch (err) {
    const msg = String(err.message || err);
    if (/relation .* does not exist/i.test(msg)) {
      return res.status(200).json({ ready: false, reason: "schema_not_migrated" });
    }
    return res.status(500).json({ error: "medicaid_failed", detail: msg });
  }
}

async function national(res) {
  const states = await sql`
    SELECT geoid, name, state_abbr, total_population AS universe_total,
           medicaid_covered AS benefit_count, medicaid_percent AS benefit_percent, data_year
    FROM medicaid_acs WHERE geo_level = 'state' ORDER BY state_abbr ASC`;
  if (!states.length) return res.status(200).json({ ready: false, reason: "not_synced_yet" });
  return res.status(200).json({ ready: true, dataYear: states[0].data_year, states });
}

async function stateDetail(req, res) {
  const state = String(req.query.state || "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(state)) return res.status(400).json({ error: "state required" });
  const q = String(req.query.q || "").trim();
  const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 100));
  const like = `%${q}%`;

  const summary = (await sql`
    SELECT name, state_abbr, total_population AS universe_total,
           medicaid_covered AS benefit_count, medicaid_percent AS benefit_percent, data_year
    FROM medicaid_acs WHERE geo_level = 'state' AND state_abbr = ${state}`)[0];
  if (!summary) return res.status(200).json({ ready: false, reason: "not_synced_yet" });

  const counties = await sql`
    SELECT geoid, name, total_population AS universe_total,
           medicaid_covered AS benefit_count, medicaid_percent AS benefit_percent
    FROM medicaid_acs WHERE geo_level = 'county' AND state_abbr = ${state}
    ORDER BY medicaid_covered DESC NULLS LAST`;

  const places = q
    ? await sql`
        SELECT geoid, name, total_population AS universe_total,
               medicaid_covered AS benefit_count, medicaid_percent AS benefit_percent
        FROM medicaid_acs WHERE geo_level = 'place' AND state_abbr = ${state} AND name ILIKE ${like}
        ORDER BY medicaid_covered DESC NULLS LAST LIMIT ${limit}`
    : await sql`
        SELECT geoid, name, total_population AS universe_total,
               medicaid_covered AS benefit_count, medicaid_percent AS benefit_percent
        FROM medicaid_acs WHERE geo_level = 'place' AND state_abbr = ${state}
        ORDER BY medicaid_covered DESC NULLS LAST LIMIT ${limit}`;

  const placeCount = (await sql`
    SELECT count(*)::int AS n FROM medicaid_acs
    WHERE geo_level = 'place' AND state_abbr = ${state}`)[0];

  return res.status(200).json({
    ready: true, dataYear: summary.data_year, summary, counties, places,
    totalPlaces: placeCount.n,
  });
}
