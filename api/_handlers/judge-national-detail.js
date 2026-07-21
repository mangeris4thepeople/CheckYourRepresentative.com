// =============================================================================
// GET /api/judge-national-detail?judgeId=12
//
// One national-directory judge's full record: court, position, appointment.
// For judges CourtListener also tracks in Colorado's directory (matched on
// courtlistener_person_id), the Colorado deep-dive data rides along: OJPE
// performance evaluations and retention election results. Other states have
// no equivalent tables yet, so those arrays are simply empty.
//
// Also serves op=judge-national-courts through api/judges.js:
//   GET /api/judge-national-courts            -> scopes: federal + each state,
//                                                with active judge counts, for
//                                                the frontend's state picker
//   GET /api/judge-national-courts?state=TX   -> one scope's courts with counts
// =============================================================================
import { sql, hasDb } from "../_db.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=1800");
  if (!hasDb) return res.status(200).json({ ready: false, reason: "no_database" });

  try {
    if (req.query.op === "judge-national-courts") {
      const state = String(req.query.state || "").trim().toUpperCase();
      if (state) {
        const courts = state === "US"
          ? await sql`
              SELECT c.id, c.name, c.jurisdiction, c.state,
                     count(j.id) FILTER (WHERE j.active) AS judge_count
              FROM nat_courts c LEFT JOIN nat_judges j ON j.court_id = c.id
              WHERE c.state IS NULL GROUP BY c.id ORDER BY c.name`
          : await sql`
              SELECT c.id, c.name, c.jurisdiction, c.state,
                     count(j.id) FILTER (WHERE j.active) AS judge_count
              FROM nat_courts c LEFT JOIN nat_judges j ON j.court_id = c.id
              WHERE c.state = ${state} GROUP BY c.id ORDER BY c.name`;
        return res.status(200).json({ ready: true, courts, count: courts.length });
      }
      const scopes = await sql`
        SELECT COALESCE(c.state, 'US') AS state,
               count(DISTINCT c.id) AS court_count,
               count(j.id) FILTER (WHERE j.active) AS judge_count
        FROM nat_courts c LEFT JOIN nat_judges j ON j.court_id = c.id
        GROUP BY 1 ORDER BY 1`;
      return res.status(200).json({ ready: true, scopes, count: scopes.length });
    }

    const judgeId = parseInt(req.query.judgeId, 10);
    if (!Number.isFinite(judgeId)) return res.status(400).json({ error: "judgeId required" });

    const judge = (await sql`
      SELECT j.id, j.courtlistener_person_id, j.full_name, j.position_title, j.appointed_by,
             j.date_start, j.date_termination, j.active,
             c.id AS court_id, c.name AS court_name, c.jurisdiction, c.state
      FROM nat_judges j LEFT JOIN nat_courts c ON c.id = j.court_id
      WHERE j.id = ${judgeId}`)[0];
    if (!judge) return res.status(404).json({ error: "judge not found" });

    // Colorado enrichment. The co_* tables live behind their own sync and may
    // not exist yet in a given database; that must not break national detail,
    // so this lookup fails soft to empty.
    let evaluations = [];
    let retention = [];
    if (judge.courtlistener_person_id != null) {
      try {
        const co = (await sql`
          SELECT id FROM co_judges
          WHERE courtlistener_person_id = ${judge.courtlistener_person_id}`)[0];
        if (co) {
          evaluations = await sql`
            SELECT eval_year, recommendation, retention_score, narrative_url
            FROM ojpe_evaluations WHERE judge_id = ${co.id} ORDER BY eval_year DESC`;
          retention = await sql`
            SELECT election_year, yes_votes, no_votes, retained
            FROM judicial_retention_results WHERE judge_id = ${co.id} ORDER BY election_year DESC`;
        }
      } catch (err) {
        if (!/relation .* does not exist/i.test(String(err.message || err))) throw err;
      }
    }

    return res.status(200).json({ ready: true, judge, evaluations, retention });
  } catch (err) {
    const msg = String(err.message || err);
    if (/relation .* does not exist/i.test(msg)) {
      return res.status(200).json({ ready: false, reason: "schema_not_migrated" });
    }
    return res.status(500).json({ error: "judge_national_detail_failed", detail: msg });
  }
}
