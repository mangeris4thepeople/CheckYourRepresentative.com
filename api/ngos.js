// =============================================================================
// GET /api/ngos - list NGOs from the funding transparency view.
//
// Reads org_funding_transparency (created by schema_v2.sql). Optional filters:
//   ?state=CO           two-letter state
//   ?sourceType=federal_award   only orgs with a funding event of this type
//   ?fiscalYear=2026
//   ?limit=50&offset=0
//
// Until the v2 schema is migrated in Neon and the ETLs have loaded data, the
// tables do not exist yet, so this returns { ready:false } rather than a 500,
// and the UI shows a "not loaded yet" state.
// =============================================================================
import { sql, hasDb } from "./_db.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  if (!hasDb) return res.status(200).json({ ready: false, reason: "no_database", orgs: [] });

  try {
    const state = String(req.query.state || "").trim().toUpperCase();
    const sourceType = String(req.query.sourceType || "").trim();
    const fiscalYear = parseInt(req.query.fiscalYear, 10);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

    const where = [];
    const params = [];
    let i = 1;
    if (state) { where.push(`t.state = $${i++}`); params.push(state); }
    if (Number.isFinite(fiscalYear)) { where.push(`t.fiscal_year = $${i++}`); params.push(fiscalYear); }
    if (sourceType) {
      where.push(`EXISTS (SELECT 1 FROM funding_events fe WHERE fe.org_id = t.id AND fe.source_type = $${i++})`);
      params.push(sourceType);
    }
    const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";

    const orgs = await sql.query(
      `SELECT t.id, t.name, t.state, t.subsection_code, t.fiscal_year,
              t.total_revenue, t.disclosed_dollar_level, t.undisclosed_amount, t.pct_transparent
       FROM org_funding_transparency t
       ${whereSql}
       ORDER BY t.total_revenue DESC NULLS LAST
       LIMIT $${i++} OFFSET $${i++}`,
      [...params, limit, offset]
    );

    const years = await sql`SELECT DISTINCT fiscal_year FROM org_funding_transparency WHERE fiscal_year IS NOT NULL ORDER BY fiscal_year DESC`;
    const states = await sql`SELECT DISTINCT state FROM org_funding_transparency WHERE state IS NOT NULL ORDER BY state`;
    const sourceTypes = await sql`SELECT DISTINCT source_type FROM funding_events ORDER BY source_type`;

    return res.status(200).json({
      ready: true,
      orgs,
      fiscalYears: years.map(r => r.fiscal_year),
      states: states.map(r => r.state),
      sourceTypes: sourceTypes.map(r => r.source_type),
      count: orgs.length,
    });
  } catch (err) {
    const msg = String(err.message || err);
    if (/relation .* does not exist/i.test(msg)) {
      return res.status(200).json({ ready: false, reason: "schema_not_migrated", orgs: [] });
    }
    return res.status(500).json({ error: "ngos_failed", detail: msg });
  }
}
