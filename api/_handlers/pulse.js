// =============================================================================
// GET /api/pulse - the live "state of the record" feed for the Home tab.
//
// Everything here is a COUNT or a MAX(timestamp) straight out of Neon, so the
// homepage numbers are real by construction: no estimates, no padding, no
// hardcoded figures. Each query is isolated so one missing table can never
// take the whole panel down; a failed metric is simply omitted.
//
// Response:
//   counts:    { bills, activeBills, votes, voters, publicProfiles, reps,
//                senators, ngos, fecFilings, alertsSent }
//   freshness: [{ key, label, source, syncedAt }]   newest first
//   moving:    [{ id, type, number, title, latestAction, actionDate }]
//   generatedAt
// =============================================================================
import { sql, hasDb } from "../_db.js";

async function one(q) {
  try { const r = await q; return r?.[0] ?? null; } catch { return null; }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  // Cheap to compute, but there is no reason to hit Neon on every visit.
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
  if (!hasDb) return res.status(500).json({ error: "no database configured" });

  const [
    bills, votes, profiles, reps, senators,
    ngos, fecFilings, senFilings, alerts,
  ] = await Promise.all([
    one(sql`SELECT count(*)::int AS n, count(*) FILTER (WHERE is_active)::int AS active,
                   max(synced_at) AS synced FROM bills`),
    one(sql`SELECT count(*)::int AS n, count(DISTINCT identity)::int AS voters,
                   count(DISTINCT district)::int AS districts, max(created_at) AS latest
            FROM votes WHERE quarantined = false`),
    one(sql`SELECT count(*) FILTER (WHERE is_public)::int AS public FROM profiles`),
    one(sql`SELECT count(*)::int AS n, max(updated_at) AS synced FROM representatives`),
    one(sql`SELECT count(*)::int AS n, max(updated_at) AS synced FROM senators`),
    one(sql`SELECT count(*)::int AS n, max(updated_at) AS synced FROM ngo_orgs`),
    one(sql`SELECT count(*)::int AS n, max(synced_at) AS synced FROM rep_fec_filings`),
    one(sql`SELECT count(*)::int AS n, max(synced_at) AS synced FROM senator_filings`),
    one(sql`SELECT count(*)::int AS n FROM floor_alerts_sent`),
  ]);

  const repspace = await one(sql`SELECT max(updated_at) AS synced FROM rs_stats`);
  const moneyMap = await one(sql`SELECT max(computed_at) AS synced FROM money_map_county_rollup`);

  let moving = [];
  try {
    moving = await sql`
      SELECT id, type, number, title, latest_action AS "latestAction", action_date AS "actionDate"
      FROM bills
      WHERE is_active AND action_date IS NOT NULL
      ORDER BY action_date DESC, synced_at DESC
      LIMIT 8`;
  } catch {}

  const counts = {
    bills: bills?.n ?? null,
    activeBills: bills?.active ?? null,
    votes: votes?.n ?? null,
    voters: votes?.voters ?? null,
    votingDistricts: votes?.districts ?? null,
    publicProfiles: profiles?.public ?? null,
    reps: reps?.n ?? null,
    senators: senators?.n ?? null,
    ngos: ngos?.n ?? null,
    fecFilings: (fecFilings?.n ?? 0) + (senFilings?.n ?? 0) || null,
    alertsSent: alerts?.n ?? null,
  };

  const freshness = [
    { key: "bills",    label: "Bills and actions",        source: "Congress.gov",              syncedAt: bills?.synced },
    { key: "housefec", label: "House campaign finance",   source: "FEC",                       syncedAt: fecFilings?.synced },
    { key: "senfec",   label: "Senate campaign finance",  source: "FEC",                       syncedAt: senFilings?.synced },
    { key: "repspace", label: "RepSpace activity",        source: "House and Senate clerks",   syncedAt: repspace?.synced },
    { key: "reps",     label: "House roster",             source: "Congress.gov",              syncedAt: reps?.synced },
    { key: "senators", label: "Senate roster",            source: "Congress.gov",              syncedAt: senators?.synced },
    { key: "ngos",     label: "NGO identities",           source: "IRS / ProPublica",          syncedAt: ngos?.synced },
    { key: "moneymap", label: "Money Map rollup",         source: "Census / USASpending",      syncedAt: moneyMap?.synced },
  ].filter(f => f.syncedAt)
   .sort((a, b) => new Date(b.syncedAt) - new Date(a.syncedAt));

  return res.status(200).json({
    counts,
    freshness,
    moving,
    lastVoteAt: votes?.latest ?? null,
    generatedAt: new Date().toISOString(),
  });
}
