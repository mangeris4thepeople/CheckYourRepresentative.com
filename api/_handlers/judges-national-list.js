// =============================================================================
// GET /api/judges-national-list - search and paginate the National Judge
// Directory (federal courts plus every state's supreme and appellate courts).
//   GET /api/judges-national-list                    -> first 20, by name, all scopes
//   GET /api/judges-national-list?state=TX           -> one state's judges
//   GET /api/judges-national-list?state=US           -> nationwide federal courts
//   GET /api/judges-national-list?q=sotomayor        -> filter by judge or court name
//   GET /api/judges-national-list?courtId=7          -> one court's judges
//   GET /api/judges-national-list?limit=20&offset=20 -> next batch
// Same contract as judges-list (the Colorado directory). state='US' means the
// nationwide federal courts, whose nat_courts.state is NULL; state-seated
// federal district courts carry their state's code and list under it. The
// filters here multiply (court x state x search), so unlike judges-list this
// builds one parameterized query via sql.query instead of enumerating every
// tagged-template combination. Returns ready:false until the
// sync-judges-national cron has created the schema.
// =============================================================================
import { sql, hasDb } from "../_db.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=1800");
  if (!hasDb) return res.status(200).json({ ready: false, reason: "no_database", judges: [] });

  try {
    const q = String(req.query.q || "").trim();
    const state = String(req.query.state || "").trim().toUpperCase();
    const courtId = parseInt(req.query.courtId, 10);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

    const where = ["j.active"];
    const params = [];
    if (Number.isFinite(courtId)) {
      params.push(courtId);
      where.push(`j.court_id = $${params.length}`);
    } else if (state === "US") {
      where.push("c.state IS NULL");
    } else if (state) {
      params.push(state);
      where.push(`c.state = $${params.length}`);
    }
    if (q) {
      params.push(`%${q}%`);
      where.push(`(j.full_name ILIKE $${params.length} OR c.name ILIKE $${params.length})`);
    }
    params.push(limit, offset);

    const judges = await sql.query(
      `SELECT j.id, j.full_name, j.position_title, j.appointed_by, j.date_start, j.active,
              c.id AS court_id, c.name AS court_name, c.jurisdiction, c.state
       FROM nat_judges j LEFT JOIN nat_courts c ON c.id = j.court_id
       WHERE ${where.join(" AND ")}
       ORDER BY j.full_name ASC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    return res.status(200).json({
      ready: true, judges, offset, hasMore: judges.length === limit, count: judges.length,
    });
  } catch (err) {
    const msg = String(err.message || err);
    if (/relation .* does not exist/i.test(msg)) {
      return res.status(200).json({ ready: false, reason: "schema_not_migrated", judges: [] });
    }
    return res.status(500).json({ error: "judges_national_list_failed", detail: msg });
  }
}
