// =============================================================================
// GET /api/money-map - everything the Money Map view needs in one payload:
// the county rollup (compact rows), the correlation table for every scope,
// per program data years, and the campaign contributions state layer from
// the tracked delegation's FEC donor buckets (the FEC publishes itemized
// contributions by contributor city and state, never by county, which is
// why that layer has no county rows anywhere).
// =============================================================================
import { sql, hasDb } from "../_db.js";

const YEARS = {
  medicare: "2023 ACS 5-year (Census estimate)",
  medicaid: "2023 ACS 5-year (Census estimate)",
  snap: "2023 ACS 5-year (Census estimate)",
  ss_income: "2023 ACS 5-year (Census estimate)",
  ngo: "Federal FY2025 (USASpending)",
  contributions: "Latest FEC cycle on file",
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=7200");
  if (!hasDb) return res.status(200).json({ ready: false, reason: "no_database" });

  try {
    const counties = await sql`
      SELECT county_fips AS f, state_abbr AS s, county_name AS n, population AS p,
             medicare_covered AS medicare, medicaid_covered AS medicaid,
             snap_households AS snap, ss_dollars AS ss_income, ngo_dollars AS ngo,
             pc_medicare, pc_medicaid, pc_snap, pc_ss_income, pc_ngo
      FROM money_map_county_rollup`;
    if (!counties.length) return res.status(200).json({ ready: false, reason: "not_computed_yet" });

    const correlations = await sql`
      SELECT scope, program_a, program_b, r, n FROM money_map_correlations`;

    // Contributions by contributor state, summed over the tracked
    // delegation's principal committees, most recent cycle per candidate.
    let contribStates = [];
    try {
      contribStates = await sql`
        SELECT bucket_label AS state_abbr, SUM(total_amount)::numeric AS dollars
        FROM (
          SELECT DISTINCT ON (fec_candidate_id, bucket_label)
                 fec_candidate_id, bucket_label, total_amount
          FROM rep_fec_donor_buckets WHERE bucket_type = 'state'
          ORDER BY fec_candidate_id, bucket_label, cycle DESC
        ) latest
        GROUP BY bucket_label`;
    } catch { contribStates = []; }
    try {
      const sen = await sql`
        SELECT bucket_label AS state_abbr, SUM(total_amount)::numeric AS dollars
        FROM (
          SELECT DISTINCT ON (fec_candidate_id, bucket_label)
                 fec_candidate_id, bucket_label, total_amount
          FROM senator_top_donors WHERE bucket_type = 'state'
          ORDER BY fec_candidate_id, bucket_label, cycle DESC
        ) latest
        GROUP BY bucket_label`;
      const byState = new Map(contribStates.map(r => [r.state_abbr, Number(r.dollars)]));
      for (const r of sen) byState.set(r.state_abbr, (byState.get(r.state_abbr) || 0) + Number(r.dollars));
      contribStates = [...byState.entries()].map(([state_abbr, dollars]) => ({ state_abbr, dollars }));
    } catch { /* senator buckets table absent: rep buckets alone stand */ }

    return res.status(200).json({ ready: true, years: YEARS, counties, correlations, contribStates });
  } catch (err) {
    const msg = String(err.message || err);
    if (/relation .* does not exist/i.test(msg)) {
      return res.status(200).json({ ready: false, reason: "not_computed_yet" });
    }
    return res.status(500).json({ error: "money_map_failed", detail: msg });
  }
}
