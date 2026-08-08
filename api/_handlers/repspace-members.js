// =============================================================================
// GET /api/repspace/members - the RepSpace roster, for all three search modes.
//   GET /api/repspace/members              -> every active member (dropdown mode)
//   GET /api/repspace/members?q=degette    -> filter by name, state, or district
//   GET /api/repspace/members?state=CO     -> one state's delegation
// 535 rows is small enough to ship whole; the dropdown search mode needs the
// full roster anyway. Returns ready:false until sync-repspace has run.
// =============================================================================
import { sql, hasDb } from "../_db.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=7200");
  if (!hasDb) return res.status(200).json({ ready: false, reason: "no_database", members: [] });

  try {
    const q = String(req.query.q || "").trim();
    const state = String(req.query.state || "").trim().toUpperCase();
    const like = `%${q}%`;

    const members = q
      ? await sql`
          SELECT bioguide_id, full_name, chamber, state, district, party, photo_url
          FROM rs_members WHERE active
            AND (full_name ILIKE ${like} OR state ILIKE ${like} OR district ILIKE ${like})
          ORDER BY last_name, first_name`
      : state
      ? await sql`
          SELECT bioguide_id, full_name, chamber, state, district, party, photo_url
          FROM rs_members WHERE active AND state = ${state}
          ORDER BY chamber DESC, district NULLS FIRST, last_name`
      : await sql`
          SELECT bioguide_id, full_name, chamber, state, district, party, photo_url
          FROM rs_members WHERE active
          ORDER BY state, chamber DESC, district NULLS FIRST, last_name`;

    return res.status(200).json({ ready: true, members, count: members.length });
  } catch (err) {
    const msg = String(err.message || err);
    if (/relation .* does not exist/i.test(msg)) {
      return res.status(200).json({ ready: false, reason: "schema_not_migrated", members: [] });
    }
    return res.status(500).json({ error: "repspace_members_failed", detail: msg });
  }
}
