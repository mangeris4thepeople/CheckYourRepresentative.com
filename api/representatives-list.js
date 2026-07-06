// =============================================================================
// GET /api/representatives-list - search and paginate the representatives
// table for the Know Your Rep tab. Same pattern as api/ngos.js.
//
//   GET /api/representatives-list                  -> first 20, by district
//   GET /api/representatives-list?limit=20&offset=20  -> next batch
//   GET /api/representatives-list?q=garcia          -> filter by name, state, or district
// =============================================================================
import { sql, hasDb } from "./_db.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=1800");
  if (!hasDb) return res.status(200).json({ ready: false, reason: "no_database", reps: [] });

  try {
    const q = String(req.query.q || "").trim();
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

    const like = `%${q}%`;
    const reps = q
      ? await sql`
          SELECT district, name, party, state, phone, website, contact_url, fec_candidate_id
          FROM representatives
          WHERE name ILIKE ${like} OR state ILIKE ${like} OR district ILIKE ${like}
          ORDER BY district ASC LIMIT ${limit} OFFSET ${offset}`
      : await sql`
          SELECT district, name, party, state, phone, website, contact_url, fec_candidate_id
          FROM representatives
          ORDER BY district ASC LIMIT ${limit} OFFSET ${offset}`;

    return res.status(200).json({
      ready: true,
      reps,
      offset,
      hasMore: reps.length === limit,
      count: reps.length,
    });
  } catch (err) {
    const msg = String(err.message || err);
    if (/relation .* does not exist/i.test(msg)) {
      return res.status(200).json({ ready: false, reason: "schema_not_migrated", reps: [] });
    }
    return res.status(500).json({ error: "representatives_list_failed", detail: msg });
  }
}
