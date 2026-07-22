// =============================================================================
// SNAP (food stamps) read endpoints, backed by the Census ACS mirror that
// sync-snap maintains. One handler serves both ops:
//   GET /api/snap-national                -> every state's totals for the map
//   GET /api/snap-state-detail?state=CO   -> one state's counties and places
//   GET /api/snap-state-detail?state=CO&q=denver&limit=50
// Same ready:false contract as the other panels, so the UI shows a clean
// "not loaded yet" state until the first sync runs.
// =============================================================================
import { sql, hasDb } from "../_db.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=7200");
  if (!hasDb) return res.status(200).json({ ready: false, reason: "no_database" });

  try {
    if (req.query.op === "snap-state-detail") return await stateDetail(req, res);
    return await national(res);
  } catch (err) {
    const msg = String(err.message || err);
    if (/relation .* does not exist/i.test(msg)) {
      return res.status(200).json({ ready: false, reason: "schema_not_migrated" });
    }
    return res.status(500).json({ error: "snap_failed", detail: msg });
  }
}

async function national(res) {
  const states = await sql`
    SELECT geoid, name, state_abbr, total_households, snap_households, snap_percent, data_year
    FROM snap_acs WHERE geo_level = 'state' ORDER BY state_abbr ASC`;
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
    SELECT name, state_abbr, total_households, snap_households, snap_percent, data_year
    FROM snap_acs WHERE geo_level = 'state' AND state_abbr = ${state}`)[0];
  if (!summary) return res.status(200).json({ ready: false, reason: "not_synced_yet" });

  const counties = await sql`
    SELECT geoid, name, total_households, snap_households, snap_percent
    FROM snap_acs WHERE geo_level = 'county' AND state_abbr = ${state}
    ORDER BY snap_households DESC NULLS LAST`;

  const places = q
    ? await sql`
        SELECT geoid, name, total_households, snap_households, snap_percent
        FROM snap_acs WHERE geo_level = 'place' AND state_abbr = ${state} AND name ILIKE ${like}
        ORDER BY snap_households DESC NULLS LAST LIMIT ${limit}`
    : await sql`
        SELECT geoid, name, total_households, snap_households, snap_percent
        FROM snap_acs WHERE geo_level = 'place' AND state_abbr = ${state}
        ORDER BY snap_households DESC NULLS LAST LIMIT ${limit}`;

  const placeCount = (await sql`
    SELECT count(*)::int AS n FROM snap_acs
    WHERE geo_level = 'place' AND state_abbr = ${state}`)[0];

  return res.status(200).json({
    ready: true, dataYear: summary.data_year, summary, counties, places,
    totalPlaces: placeCount.n,
  });
}
