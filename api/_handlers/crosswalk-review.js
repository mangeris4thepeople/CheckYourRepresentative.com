// =============================================================================
// /api/crosswalk-list and /api/crosswalk-review - the /admin/crosswalk queue.
//
// Every ProPublica match starts as a 'candidate' row in ngo_name_crosswalk;
// this is where a human confirms or rejects each one. Both ops are
// admin-only: the caller's session email must appear in the ADMIN_EMAILS env
// var (comma separated). With ADMIN_EMAILS unset nothing is allowed, same
// fail-closed default as CRON_SECRET in api/cron.js.
//
//   GET  /api/crosswalk-list?token=...          candidate rows with context
//   POST /api/crosswalk-review                  { token, id, action }
//        action is "confirm" or "reject"; sets status and reviewed_at.
// =============================================================================
import { sql, hasDb } from "../_db.js";
import { resolveEmail } from "../_auth.js";

async function requireAdmin(req, res) {
  const admins = String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
  if (admins.length === 0) {
    res.status(403).json({ error: "admin_not_configured" });
    return null;
  }
  const token = req.query.token || (req.body && req.body.token) || null;
  const email = await resolveEmail(token);
  if (!email || !admins.includes(email.toLowerCase())) {
    res.status(401).json({ error: "not_authorized" });
    return null;
  }
  return email;
}

export async function crosswalkList(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!hasDb) return res.status(200).json({ ready: false, reason: "no_database", rows: [] });
  try {
    if (!(await requireAdmin(req, res))) return;

    // Each candidate with enough context to judge it: the TRACER name and
    // dollar totals on one side, the IRS identity on the other.
    const rows = await sql`
      SELECT x.id, x.contributor_normalized, x.match_method, x.confidence,
             x.created_at,
             o.ein, o.legal_name, o.subsection, o.city, o.state,
             o.total_revenue, o.propublica_url, o.exemption_revoked,
             c.contributor_name, c.contribution_count, c.total_amount
      FROM ngo_name_crosswalk x
      JOIN ngo_orgs o ON o.id = x.org_id
      LEFT JOIN LATERAL (
        SELECT MIN(t.contributor_name) AS contributor_name,
               COUNT(*)::int AS contribution_count,
               SUM(t.amount) AS total_amount
        FROM tracer_contributions t
        WHERE t.contributor_normalized = x.contributor_normalized
      ) c ON TRUE
      WHERE x.status = 'candidate'
      ORDER BY c.total_amount DESC NULLS LAST, x.id`;

    return res.status(200).json({ ready: true, rows });
  } catch (err) {
    const msg = String(err.message || err);
    if (/relation .* does not exist/i.test(msg)) {
      return res.status(200).json({ ready: false, reason: "schema_not_migrated", rows: [] });
    }
    return res.status(500).json({ error: "crosswalk_list_failed", detail: msg });
  }
}

export async function crosswalkReview(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  if (!hasDb) return res.status(500).json({ error: "no_database" });
  try {
    if (!(await requireAdmin(req, res))) return;

    const id = parseInt(req.body?.id, 10);
    const action = String(req.body?.action || "");
    if (!Number.isFinite(id) || !["confirm", "reject"].includes(action)) {
      return res.status(400).json({ error: "bad_request" });
    }
    const status = action === "confirm" ? "confirmed" : "rejected";

    const updated = await sql`
      UPDATE ngo_name_crosswalk
      SET status = ${status}, reviewed_at = now()
      WHERE id = ${id} AND status = 'candidate'
      RETURNING id, status, reviewed_at`;
    if (updated.length === 0) return res.status(404).json({ error: "not_a_candidate" });

    return res.status(200).json({ ok: true, row: updated[0] });
  } catch (err) {
    return res.status(500).json({ error: "crosswalk_review_failed", detail: String(err.message || err) });
  }
}
