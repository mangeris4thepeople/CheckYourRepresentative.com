// =============================================================================
// GET /api/ngo-money-loop - rows from the ngo_money_loop view.
//
// The view joins Colorado TRACER contributions to their IRS organization
// (via the human-reviewed ngo_name_crosswalk) plus the org's latest 990
// revenue, revocation status, and any federal award dollars from the
// existing USASpending pipeline. Rejected matches never appear; candidate
// matches carry match_status = 'candidate' so the UI can label them.
//
// Optional params:
//   ?committee=<exact committee name>
//   ?subsection=501(c)(3)
//   ?sort=amount|date       default amount
//   ?dir=asc|desc           default desc
//   ?limit=25&offset=0
//
// Follows the same { ready:false } convention as /api/ngos while the schema
// or data is not loaded yet.
// =============================================================================
import { sql, hasDb } from "../_db.js";

const SORTS = { amount: "amount", date: "contribution_date" };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  if (!hasDb) return res.status(200).json({ ready: false, reason: "no_database", rows: [] });

  try {
    const committee = String(req.query.committee || "").trim();
    const subsection = String(req.query.subsection || "").trim();
    const sortCol = SORTS[String(req.query.sort || "").trim()] || "amount";
    const dir = String(req.query.dir || "").toLowerCase() === "asc" ? "ASC" : "DESC";
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

    const where = [];
    const params = [];
    let i = 1;
    if (committee) { where.push(`committee_name = $${i++}`); params.push(committee); }
    if (subsection) { where.push(`subsection = $${i++}`); params.push(subsection); }
    const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";

    const rows = await sql.query(
      `SELECT contribution_id, contributor_name, legal_name, ein, subsection,
              committee_name, committee_type, candidate_name, amount,
              contribution_date, election_year, total_revenue,
              revenue_fiscal_year, propublica_url, exemption_revoked,
              revocation_date, match_status, federal_funds_received
       FROM ngo_money_loop
       ${whereSql}
       ORDER BY ${sortCol} ${dir} NULLS LAST, contribution_id
       LIMIT $${i++} OFFSET $${i++}`,
      [...params, limit, offset]
    );

    const committees = await sql`
      SELECT DISTINCT committee_name FROM ngo_money_loop
      WHERE committee_name IS NOT NULL ORDER BY committee_name`;
    const subsections = await sql`
      SELECT DISTINCT subsection FROM ngo_money_loop
      WHERE subsection IS NOT NULL ORDER BY subsection`;

    return res.status(200).json({
      ready: true,
      rows,
      offset,
      hasMore: rows.length === limit,
      committees: committees.map(r => r.committee_name),
      subsections: subsections.map(r => r.subsection),
    });
  } catch (err) {
    const msg = String(err.message || err);
    if (/relation .* does not exist/i.test(msg)) {
      return res.status(200).json({ ready: false, reason: "schema_not_migrated", rows: [] });
    }
    return res.status(500).json({ error: "ngo_money_loop_failed", detail: msg });
  }
}
