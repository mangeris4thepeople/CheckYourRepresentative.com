// =============================================================================
// GET /api/matrix?district=CO-04 — accountability matrix for a district
// Returns raw vote counts + how many contacted their rep per bill
// =============================================================================
import { sql } from "./_db.js";

export default async function handler(req, res) {
  try {
    const { district, billId } = req.query;

    let rows;
    if (billId) {
      // Single bill breakdown
      rows = await sql`
        SELECT
          v.bill_id,
          v.district,
          COUNT(DISTINCT v.identity) FILTER (WHERE v.position = 'support')   AS support_votes,
          COUNT(DISTINCT v.identity) FILTER (WHERE v.position = 'oppose')    AS oppose_votes,
          COUNT(DISTINCT v.identity) FILTER (WHERE v.position = 'undecided') AS undecided_votes,
          COUNT(DISTINCT v.identity)                                          AS total_votes,
          COUNT(DISTINCT c.identity)                                          AS contacted_rep,
          ROUND(
            COUNT(DISTINCT c.identity)::numeric /
            NULLIF(COUNT(DISTINCT v.identity), 0) * 100, 1
          ) AS contact_rate_pct
        FROM votes v
        LEFT JOIN contact_actions c
          ON c.bill_id = v.bill_id AND c.district = v.district AND c.identity = v.identity
        WHERE v.quarantined = FALSE AND v.bill_id = ${billId}
        GROUP BY v.bill_id, v.district
        ORDER BY total_votes DESC
        LIMIT 50
      `;
    } else if (district) {
      // All bills for a district
      rows = await sql`
        SELECT
          v.bill_id,
          v.district,
          COUNT(DISTINCT v.identity) FILTER (WHERE v.position = 'support')   AS support_votes,
          COUNT(DISTINCT v.identity) FILTER (WHERE v.position = 'oppose')    AS oppose_votes,
          COUNT(DISTINCT v.identity) FILTER (WHERE v.position = 'undecided') AS undecided_votes,
          COUNT(DISTINCT v.identity)                                          AS total_votes,
          COUNT(DISTINCT c.identity)                                          AS contacted_rep,
          ROUND(
            COUNT(DISTINCT c.identity)::numeric /
            NULLIF(COUNT(DISTINCT v.identity), 0) * 100, 1
          ) AS contact_rate_pct
        FROM votes v
        LEFT JOIN contact_actions c
          ON c.bill_id = v.bill_id AND c.district = v.district AND c.identity = v.identity
        WHERE v.quarantined = FALSE AND v.district = ${district}
        GROUP BY v.bill_id, v.district
        ORDER BY total_votes DESC
        LIMIT 50
      `;
    } else {
      // Full national matrix — top 100 most active
      rows = await sql`
        SELECT
          v.bill_id,
          v.district,
          COUNT(DISTINCT v.identity) FILTER (WHERE v.position = 'support')   AS support_votes,
          COUNT(DISTINCT v.identity) FILTER (WHERE v.position = 'oppose')    AS oppose_votes,
          COUNT(DISTINCT v.identity) FILTER (WHERE v.position = 'undecided') AS undecided_votes,
          COUNT(DISTINCT v.identity)                                          AS total_votes,
          COUNT(DISTINCT c.identity)                                          AS contacted_rep,
          ROUND(
            COUNT(DISTINCT c.identity)::numeric /
            NULLIF(COUNT(DISTINCT v.identity), 0) * 100, 1
          ) AS contact_rate_pct
        FROM votes v
        LEFT JOIN contact_actions c
          ON c.bill_id = v.bill_id AND c.district = v.district AND c.identity = v.identity
        WHERE v.quarantined = FALSE
        GROUP BY v.bill_id, v.district
        ORDER BY total_votes DESC
        LIMIT 100
      `;
    }

    return res.status(200).json({ ok: true, rows, count: rows.length });
  } catch (err) {
    return res.status(500).json({ error: String(err.message || err) });
  }
}
