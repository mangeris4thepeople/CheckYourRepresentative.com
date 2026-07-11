// =============================================================================
// GET /api/social-security-detail
//
// Social Security (OASDI) beneficiary and benefit figures for every state,
// territory, and DC, from ssa_oasdi_state. It is a small table (about 56
// rows), so this returns all of it in one call rather than paging.
// Returns ready:false if the table has not been migrated yet.
// =============================================================================
import { sql, hasDb } from "../_db.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  if (!hasDb) return res.status(200).json({ ready: false, reason: "no_database" });

  try {
    const rows = await sql`
      SELECT state, state_abbr, data_year, total_beneficiaries,
             retirement_workers, retirement_spouses, retirement_children,
             survivors_widowers_parents, survivors_children,
             disability_workers, disability_spouses, disability_children,
             men_65_older, women_65_older, total_monthly_benefits
      FROM ssa_oasdi_state
      ORDER BY state ASC`;

    return res.status(200).json({ ready: true, rows });
  } catch (err) {
    const msg = String(err.message || err);
    if (/relation .* does not exist/i.test(msg)) {
      return res.status(200).json({ ready: false, reason: "schema_not_migrated" });
    }
    return res.status(500).json({ error: "social_security_detail_failed", detail: msg });
  }
}
