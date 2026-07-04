// =============================================================================
// GET /api/ngo-detail?orgId=123&fiscalYear=2026
//
// Full funding picture for one org: its transparency figures for the chosen
// (or latest) fiscal year, the dollar-level funding events behind them, its
// reported revenue by year, and grants it made to others. Returns ready:false
// if the v2 schema has not been migrated yet.
// =============================================================================
import { sql, hasDb } from "./_db.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  if (!hasDb) return res.status(200).json({ ready: false, reason: "no_database" });

  const orgId = parseInt(req.query.orgId, 10);
  if (!orgId) return res.status(400).json({ error: "orgId required" });
  const fy = parseInt(req.query.fiscalYear, 10);

  try {
    const org = (await sql`SELECT * FROM organizations WHERE id = ${orgId}`)[0];
    if (!org) return res.status(404).json({ error: "org not found" });

    const transparency = Number.isFinite(fy)
      ? (await sql`SELECT * FROM org_funding_transparency WHERE id = ${orgId} AND fiscal_year = ${fy}`)[0]
      : (await sql`SELECT * FROM org_funding_transparency WHERE id = ${orgId} ORDER BY fiscal_year DESC LIMIT 1`)[0];

    const events = await sql`
      SELECT source_type, source_name, external_ref_id, amount, description, fiscal_year, disclosure_source
      FROM funding_events WHERE org_id = ${orgId}
      ORDER BY amount DESC NULLS LAST LIMIT 100`;

    const revenue = await sql`
      SELECT fiscal_year, total_revenue, contributions_grants_total, program_service_revenue,
             investment_income, disclosed_dollar_level, undisclosed_amount
      FROM revenue_summary WHERE org_id = ${orgId} ORDER BY fiscal_year DESC`;

    const grants = await sql`
      SELECT recipient_name, amount, purpose, fiscal_year
      FROM grants_made WHERE grantor_org_id = ${orgId}
      ORDER BY amount DESC NULLS LAST LIMIT 100`;

    return res.status(200).json({ ready: true, org, transparency: transparency || null, events, revenue, grants });
  } catch (err) {
    const msg = String(err.message || err);
    if (/relation .* does not exist/i.test(msg)) {
      return res.status(200).json({ ready: false, reason: "schema_not_migrated" });
    }
    return res.status(500).json({ error: "ngo_detail_failed", detail: msg });
  }
}
