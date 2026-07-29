// =============================================================================
// Know Your Judge geography and profile read endpoints. One handler, four
// ops, all backed by national_courts / national_judges plus the location
// mapping in judicial_court_locations:
//   GET /api/judges-map                          -> per state judge counts,
//       with population (from the Medicaid ACS mirror) for per capita
//   GET /api/state-judges?state=CO               -> statewide courts with
//       judges, per county judge counts, and unlocated courts, flagged
//   GET /api/county-courts?state=CO&fips=08031   -> one county's courts with
//       city and sitting judges
//   GET /api/national-judge-detail?personId=123  -> judge, ruling stats,
//       recent opinions
// Same ready:false contract as the rest of the site.
// =============================================================================
import { sql, hasDb } from "../_db.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=1800");
  if (!hasDb) return res.status(200).json({ ready: false, reason: "no_database" });

  try {
    if (req.query.op === "state-judges") return await stateJudges(req, res);
    if (req.query.op === "county-courts") return await countyCourts(req, res);
    if (req.query.op === "national-judge-detail") return await judgeDetail(req, res);
    return await judgesMap(res);
  } catch (err) {
    const msg = String(err.message || err);
    if (/relation .* does not exist/i.test(msg)) {
      return res.status(200).json({ ready: false, reason: "schema_not_migrated" });
    }
    return res.status(500).json({ error: "judges_geo_failed", detail: msg });
  }
}

async function judgesMap(res) {
  const states = await sql`
    SELECT c.state_abbr, count(*)::int AS judges
    FROM national_judges j JOIN national_courts c ON c.cl_id = j.court_cl_id
    WHERE j.active AND c.state_abbr IS NOT NULL
    GROUP BY c.state_abbr ORDER BY c.state_abbr`;
  if (!states.length) return res.status(200).json({ ready: false, reason: "not_synced_yet" });

  // Population for per capita, from the Medicaid ACS mirror when loaded.
  let pop = [];
  try {
    pop = await sql`
      SELECT state_abbr, total_population FROM medicaid_acs WHERE geo_level = 'state'`;
  } catch { pop = []; }
  const popBy = Object.fromEntries(pop.map(p => [p.state_abbr, p.total_population]));

  const out = states.map(s => ({
    state_abbr: s.state_abbr,
    judges: s.judges,
    population: popBy[s.state_abbr] || null,
    per_100k: popBy[s.state_abbr]
      ? Math.round((s.judges / popBy[s.state_abbr]) * 100000 * 100) / 100
      : null,
  }));
  const total = (await sql`SELECT count(*)::int AS n FROM national_judges WHERE active`)[0];
  return res.status(200).json({ ready: true, states: out, totalJudges: total.n });
}

async function stateJudges(req, res) {
  const state = String(req.query.state || "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(state)) return res.status(400).json({ error: "state required" });

  const statewide = await sql`
    SELECT c.cl_id, c.full_name, c.jurisdiction, l.city,
           COALESCE(json_agg(json_build_object(
             'id', j.id, 'cl_person_id', j.cl_person_id, 'full_name', j.full_name,
             'slug', j.slug, 'position_title', j.position_title, 'date_start', j.date_start
           ) ORDER BY j.full_name) FILTER (WHERE j.id IS NOT NULL), '[]') AS judges
    FROM national_courts c
    JOIN judicial_court_locations l ON l.court_cl_id = c.cl_id
    LEFT JOIN national_judges j ON j.court_cl_id = c.cl_id AND j.active
    WHERE c.state_abbr = ${state} AND l.confidence = 'statewide_seat'
    GROUP BY c.cl_id, c.full_name, c.jurisdiction, l.city
    ORDER BY CASE c.jurisdiction WHEN 'S' THEN 0 WHEN 'SA' THEN 1 ELSE 2 END, c.full_name`;

  const counties = await sql`
    SELECT l.county_fips, l.county_name,
           count(j.id)::int AS judge_count, count(DISTINCT c.cl_id)::int AS court_count
    FROM judicial_court_locations l
    JOIN national_courts c ON c.cl_id = l.court_cl_id
    LEFT JOIN national_judges j ON j.court_cl_id = c.cl_id AND j.active
    WHERE l.state_abbr = ${state} AND l.confidence = 'county_parsed' AND l.county_fips IS NOT NULL
    GROUP BY l.county_fips, l.county_name
    ORDER BY l.county_name`;

  const unlocated = await sql`
    SELECT c.cl_id, c.full_name, c.jurisdiction, count(j.id)::int AS judge_count
    FROM judicial_court_locations l
    JOIN national_courts c ON c.cl_id = l.court_cl_id
    LEFT JOIN national_judges j ON j.court_cl_id = c.cl_id AND j.active
    WHERE l.state_abbr = ${state} AND l.confidence = 'unlocated'
    GROUP BY c.cl_id, c.full_name, c.jurisdiction
    ORDER BY c.full_name`;

  const ready = statewide.length > 0 || counties.length > 0 || unlocated.length > 0;
  if (!ready) return res.status(200).json({ ready: false, reason: "not_synced_yet" });

  return res.status(200).json({ ready: true, state, statewide, counties, unlocated });
}

async function countyCourts(req, res) {
  const state = String(req.query.state || "").trim().toUpperCase();
  const fips = String(req.query.fips || "").trim();
  if (!/^[A-Z]{2}$/.test(state) || !/^\d{5}$/.test(fips)) {
    return res.status(400).json({ error: "state and fips required" });
  }

  const courts = await sql`
    SELECT c.cl_id, c.full_name, c.jurisdiction, l.city, l.county_name,
           COALESCE(json_agg(json_build_object(
             'id', j.id, 'cl_person_id', j.cl_person_id, 'full_name', j.full_name,
             'slug', j.slug, 'position_title', j.position_title, 'date_start', j.date_start
           ) ORDER BY j.full_name) FILTER (WHERE j.id IS NOT NULL), '[]') AS judges
    FROM judicial_court_locations l
    JOIN national_courts c ON c.cl_id = l.court_cl_id
    LEFT JOIN national_judges j ON j.court_cl_id = c.cl_id AND j.active
    WHERE l.state_abbr = ${state} AND l.county_fips = ${fips}
    GROUP BY c.cl_id, c.full_name, c.jurisdiction, l.city, l.county_name
    ORDER BY c.full_name`;

  return res.status(200).json({
    ready: true, state, fips,
    countyName: courts[0]?.county_name || null,
    courts,
  });
}

async function judgeDetail(req, res) {
  const personId = parseInt(req.query.personId, 10);
  if (!Number.isFinite(personId)) return res.status(400).json({ error: "personId required" });

  const judge = (await sql`
    SELECT j.id, j.cl_person_id, j.full_name, j.slug, j.position_title, j.date_start,
           c.cl_id AS court_cl_id, c.full_name AS court_name, c.jurisdiction, c.state_abbr,
           l.city, l.county_name
    FROM national_judges j
    LEFT JOIN national_courts c ON c.cl_id = j.court_cl_id
    LEFT JOIN judicial_court_locations l ON l.court_cl_id = c.cl_id
    WHERE j.cl_person_id = ${personId}`)[0];
  if (!judge) return res.status(200).json({ ready: false, reason: "judge_not_found" });

  let stats = null;
  let recentOpinions = [];
  try {
    stats = (await sql`SELECT * FROM judge_ruling_stats WHERE cl_person_id = ${personId}`)[0] || null;
    recentOpinions = await sql`
      SELECT cl_opinion_id, opinion_type, date_filed, case_name, url
      FROM judicial_opinions WHERE cl_person_id = ${personId}
      ORDER BY date_filed DESC NULLS LAST LIMIT 10`;
  } catch { /* opinion tables not provisioned yet: profile still renders */ }

  return res.status(200).json({ ready: true, judge, stats, recentOpinions });
}
