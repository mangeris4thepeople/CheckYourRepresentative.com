// =============================================================================
// GET /api/judge-detail?judgeId=12
//
// One judge's full record: court, position, every OJPE evaluation on file,
// and every retention election result. Also serves op=judge-courts through
// api/judges.js: the full 26-court list with active judge counts, used by
// the frontend's court filter and by deploy verification.
// =============================================================================
import { sql, hasDb } from "../_db.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=1800");
  if (!hasDb) return res.status(200).json({ ready: false, reason: "no_database" });

  try {
    if (req.query.op === "judge-courts") {
      const courts = await sql`
        SELECT c.id, c.name, c.court_type, c.judicial_district,
               count(j.id) FILTER (WHERE j.active) AS judge_count
        FROM co_courts c LEFT JOIN co_judges j ON j.court_id = c.id
        GROUP BY c.id ORDER BY c.id`;
      return res.status(200).json({ ready: true, courts, count: courts.length });
    }

    const judgeId = parseInt(req.query.judgeId, 10);
    if (!Number.isFinite(judgeId)) return res.status(400).json({ error: "judgeId required" });

    const judge = (await sql`
      SELECT j.id, j.full_name, j.position_title, j.appointed_by, j.date_start,
             j.date_termination, j.active,
             c.id AS court_id, c.name AS court_name, c.court_type, c.judicial_district
      FROM co_judges j LEFT JOIN co_courts c ON c.id = j.court_id
      WHERE j.id = ${judgeId}`)[0];
    if (!judge) return res.status(404).json({ error: "judge not found" });

    const evaluations = await sql`
      SELECT eval_year, recommendation, retention_score, narrative_url
      FROM ojpe_evaluations WHERE judge_id = ${judgeId} ORDER BY eval_year DESC`;

    const retention = await sql`
      SELECT election_year, yes_votes, no_votes, retained
      FROM judicial_retention_results WHERE judge_id = ${judgeId} ORDER BY election_year DESC`;

    return res.status(200).json({ ready: true, judge, evaluations, retention });
  } catch (err) {
    const msg = String(err.message || err);
    if (/relation .* does not exist/i.test(msg)) {
      return res.status(200).json({ ready: false, reason: "schema_not_migrated" });
    }
    return res.status(500).json({ error: "judge_detail_failed", detail: msg });
  }
}
