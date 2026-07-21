// =============================================================================
// GET /api/judges-list - search and paginate Colorado judges.
//   GET /api/judges-list                     -> first 20, by name
//   GET /api/judges-list?q=garcia            -> filter by judge or court name
//   GET /api/judges-list?courtId=3           -> one court's judges
//   GET /api/judges-list?limit=20&offset=20  -> next batch
// Same pattern as representatives-list. Returns ready:false until the
// sync-judges cron has created the schema.
// =============================================================================
import { sql, hasDb } from "../_db.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=1800");
  if (!hasDb) return res.status(200).json({ ready: false, reason: "no_database", judges: [] });

  try {
    const q = String(req.query.q || "").trim();
    const courtId = parseInt(req.query.courtId, 10);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const like = `%${q}%`;

    const judges = Number.isFinite(courtId)
      ? await sql`
          SELECT j.id, j.full_name, j.position_title, j.appointed_by, j.date_start, j.active,
                 c.id AS court_id, c.name AS court_name, c.court_type, c.judicial_district
          FROM co_judges j LEFT JOIN co_courts c ON c.id = j.court_id
          WHERE j.active AND j.court_id = ${courtId}
          ORDER BY j.full_name ASC LIMIT ${limit} OFFSET ${offset}`
      : q
      ? await sql`
          SELECT j.id, j.full_name, j.position_title, j.appointed_by, j.date_start, j.active,
                 c.id AS court_id, c.name AS court_name, c.court_type, c.judicial_district
          FROM co_judges j LEFT JOIN co_courts c ON c.id = j.court_id
          WHERE j.active AND (j.full_name ILIKE ${like} OR c.name ILIKE ${like})
          ORDER BY j.full_name ASC LIMIT ${limit} OFFSET ${offset}`
      : await sql`
          SELECT j.id, j.full_name, j.position_title, j.appointed_by, j.date_start, j.active,
                 c.id AS court_id, c.name AS court_name, c.court_type, c.judicial_district
          FROM co_judges j LEFT JOIN co_courts c ON c.id = j.court_id
          WHERE j.active
          ORDER BY j.full_name ASC LIMIT ${limit} OFFSET ${offset}`;

    return res.status(200).json({
      ready: true, judges, offset, hasMore: judges.length === limit, count: judges.length,
    });
  } catch (err) {
    const msg = String(err.message || err);
    if (/relation .* does not exist/i.test(msg)) {
      return res.status(200).json({ ready: false, reason: "schema_not_migrated", judges: [] });
    }
    return res.status(500).json({ error: "judges_list_failed", detail: msg });
  }
}
