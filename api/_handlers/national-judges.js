// =============================================================================
// National judge registry read endpoints, backed by the CourtListener mirror
// that sync-national-judges maintains. One handler serves both ops:
//   GET /api/national-judges-list                  -> first 20, by name
//   GET /api/national-judges-list?q=smith          -> filter by judge or court
//   GET /api/national-judges-list?state=TX         -> one state's judges
//   GET /api/national-judges-list?limit=20&offset=20
//   GET /api/national-courts                       -> states with judge counts
// Same ready:false contract as judges-list, so the UI can show a clean
// "still loading" state before the first crawl pass lands.
// =============================================================================
import { sql, hasDb } from "../_db.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=1800");
  if (!hasDb) return res.status(200).json({ ready: false, reason: "no_database", judges: [], states: [] });

  try {
    if (req.query.op === "national-courts") return await statesList(res);
    return await judgesList(req, res);
  } catch (err) {
    const msg = String(err.message || err);
    if (/relation .* does not exist/i.test(msg)) {
      return res.status(200).json({ ready: false, reason: "schema_not_migrated", judges: [], states: [] });
    }
    return res.status(500).json({ error: "national_judges_failed", detail: msg });
  }
}

async function judgesList(req, res) {
  const q = String(req.query.q || "").trim();
  const state = String(req.query.state || "").trim().toUpperCase();
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
  const like = `%${q}%`;

  const judges = state && q
    ? await sql`
        SELECT j.id, j.cl_person_id, j.full_name, j.slug, j.position_title, j.date_start,
               c.full_name AS court_name, c.state_abbr, c.jurisdiction
        FROM national_judges j LEFT JOIN national_courts c ON c.cl_id = j.court_cl_id
        WHERE j.active AND c.state_abbr = ${state}
          AND (j.full_name ILIKE ${like} OR c.full_name ILIKE ${like})
        ORDER BY j.full_name ASC LIMIT ${limit} OFFSET ${offset}`
    : state
    ? await sql`
        SELECT j.id, j.cl_person_id, j.full_name, j.slug, j.position_title, j.date_start,
               c.full_name AS court_name, c.state_abbr, c.jurisdiction
        FROM national_judges j LEFT JOIN national_courts c ON c.cl_id = j.court_cl_id
        WHERE j.active AND c.state_abbr = ${state}
        ORDER BY j.full_name ASC LIMIT ${limit} OFFSET ${offset}`
    : q
    ? await sql`
        SELECT j.id, j.cl_person_id, j.full_name, j.slug, j.position_title, j.date_start,
               c.full_name AS court_name, c.state_abbr, c.jurisdiction
        FROM national_judges j LEFT JOIN national_courts c ON c.cl_id = j.court_cl_id
        WHERE j.active AND (j.full_name ILIKE ${like} OR c.full_name ILIKE ${like})
        ORDER BY j.full_name ASC LIMIT ${limit} OFFSET ${offset}`
    : await sql`
        SELECT j.id, j.cl_person_id, j.full_name, j.slug, j.position_title, j.date_start,
               c.full_name AS court_name, c.state_abbr, c.jurisdiction
        FROM national_judges j LEFT JOIN national_courts c ON c.cl_id = j.court_cl_id
        WHERE j.active
        ORDER BY j.full_name ASC LIMIT ${limit} OFFSET ${offset}`;

  return res.status(200).json({
    ready: true, judges, offset, hasMore: judges.length === limit, count: judges.length,
  });
}

async function statesList(res) {
  const states = await sql`
    SELECT c.state_abbr, count(*)::int AS judge_count
    FROM national_judges j JOIN national_courts c ON c.cl_id = j.court_cl_id
    WHERE j.active AND c.state_abbr IS NOT NULL
    GROUP BY c.state_abbr ORDER BY c.state_abbr ASC`;
  const total = (await sql`SELECT count(*)::int AS n FROM national_judges WHERE active`)[0];
  return res.status(200).json({ ready: true, states, totalJudges: total.n });
}
