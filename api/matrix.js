// =============================================================================
// GET /api/matrix?district=CO-04 - accountability matrix for a district
// Returns raw vote counts + how many contacted their rep per bill
//
//   GET /api/matrix?mode=prefixes  -> every bill type with any votes, and how
//                                     many distinct bills of that type, no cap.
//                                     Powers the sidebar's prefix tabs.
//   GET /api/matrix?mode=byPrefix&prefix=hr&limit=20&offset=0
//                                  -> that bill type's bills, paginated, so
//                                     every voted-on bill is reachable, not
//                                     just the top 100 nationally.
// =============================================================================
import { sql } from "./_db.js";

export default async function handler(req, res) {
  try {
    const { district, billId, mode } = req.query;

    if (mode === "prefixes") {
      const prefixes = await sql`
        SELECT split_part(bill_id, '-', 1) AS bill_type, COUNT(DISTINCT bill_id) AS bill_count
        FROM votes WHERE quarantined = FALSE
        GROUP BY 1 ORDER BY bill_count DESC`;
      return res.status(200).json({ ok: true, prefixes });
    }

    if (mode === "byPrefix") {
      const prefix = String(req.query.prefix || "").trim().toLowerCase();
      if (!prefix) return res.status(400).json({ error: "prefix required" });
      const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 20));
      const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

      const rows = await sql`
        SELECT v.bill_id,
               COUNT(DISTINCT v.identity)                                        AS total_votes,
               COUNT(DISTINCT v.identity) FILTER (WHERE v.position = 'support')  AS support_votes,
               COUNT(DISTINCT v.identity) FILTER (WHERE v.position = 'oppose')   AS oppose_votes
        FROM votes v
        WHERE v.quarantined = FALSE AND split_part(v.bill_id, '-', 1) = ${prefix}
        GROUP BY v.bill_id
        ORDER BY total_votes DESC
        LIMIT ${limit} OFFSET ${offset}`;

      return res.status(200).json({
        ok: true, rows, offset,
        hasMore: rows.length === limit,
        count: rows.length,
      });
    }

    let rows;
    let totals = null;
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
      // Full national matrix - top 100 most active
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

      // The LIMIT 100 above is a bill-by-bill breakdown list (top 100 most
      // active bill/district pairs), not a site-wide count, so it undercounts
      // if used to sum a national total. This second, unlimited aggregate is
      // the real site-wide total.
      const totalsRows = await sql`
        SELECT
          COUNT(DISTINCT v.identity)                                          AS total_votes,
          COUNT(DISTINCT v.identity) FILTER (WHERE v.position = 'support')    AS support_votes,
          COUNT(DISTINCT v.identity) FILTER (WHERE v.position = 'oppose')     AS oppose_votes,
          COUNT(DISTINCT v.identity) FILTER (WHERE v.position = 'undecided') AS undecided_votes,
          COUNT(DISTINCT c.identity)                                          AS contacted_rep,
          COUNT(DISTINCT v.bill_id)                                           AS bills_tracked
        FROM votes v
        LEFT JOIN contact_actions c
          ON c.bill_id = v.bill_id AND c.district = v.district AND c.identity = v.identity
        WHERE v.quarantined = FALSE
      `;
      totals = totalsRows[0];
    }

    return res.status(200).json({ ok: true, rows, totals, count: rows.length });
  } catch (err) {
    return res.status(500).json({ error: String(err.message || err) });
  }
}
