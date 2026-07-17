// =============================================================================
// GET /api/vote-queue-item - one bill at a time, driven entirely by the
// database so "which bill and vote status is currently shown" has exactly
// one source of truth: whatever row this query returns. The frontend never
// filters an already-loaded list in application code, so there is no way for
// a stale "already voted" banner to disagree with what the list above it
// says (the bug this feature was built to fix).
//
// Query params:
//   mode      - "all" | "not_voted" | "next_queue" | "voted" | "previous_history"
//               (not_voted and next_queue are the same underlying query,
//               voted and previous_history are the same underlying query -
//               the distinction is purely how the frontend framed the tab)
//   direction - "forward" (default) or "backward"
//   token     - session token, optional (anonymous visitors can browse "all"
//               and "not_voted", which for a signed-out visitor is every bill,
//               but "voted" / "previous_history" require sign-in)
//   cursorId, cursorDate       - for all / not_voted / next_queue
//   cursorVoteId, cursorVotedAt - for voted / previous_history
//
// No cursor + direction=forward means "start from the top of this set."
// No cursor + direction=backward is a no-op (nothing to go back from yet).
// =============================================================================
import { sql, hasDb } from "../_db.js";
import { resolveEmail } from "../_auth.js";

const VOTED_MODES = new Set(["voted", "previous_history"]);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");

  if (!hasDb) return res.status(500).json({ error: "no database configured" });

  try {
    const mode = String(req.query.mode || "all");
    const direction = req.query.direction === "backward" ? "backward" : "forward";
    const token = String(req.query.token || "").trim();
    const email = await resolveEmail(token);

    if (VOTED_MODES.has(mode) && !email) {
      return res.status(200).json({ item: null, signedIn: false });
    }

    if (direction === "backward" && !req.query.cursorId && !req.query.cursorVoteId) {
      return res.status(200).json({ item: null, signedIn: !!email });
    }

    let row;
    if (VOTED_MODES.has(mode)) {
      row = await fetchVotedItem({
        email, direction,
        cursorVotedAt: req.query.cursorVotedAt || null,
        cursorVoteId: req.query.cursorVoteId || null,
      });
    } else {
      row = await fetchActiveItem({
        email, direction,
        requireNotVoted: mode === "not_voted" || mode === "next_queue",
        cursorDate: req.query.cursorDate || null,
        cursorId: req.query.cursorId || null,
      });
    }

    return res.status(200).json({ item: row || null, signedIn: !!email });
  } catch (err) {
    return res.status(500).json({ error: "vote_queue_item_failed", detail: String(err.message || err) });
  }
}

async function fetchActiveItem({ email, direction, requireNotVoted, cursorDate, cursorId }) {
  const hasCursor = !!(cursorDate && cursorId);
  const notVotedClause = requireNotVoted
    ? `AND NOT EXISTS (SELECT 1 FROM votes v2 WHERE v2.bill_id = b.id AND v2.identity = ('sess:' || $1 || ':' || b.id))`
    : "";

  let text, params;
  if (direction === "forward" && !hasCursor) {
    text = `
      SELECT b.id, b.title, b.policy_area AS "policyArea", b.action_date AS "actionDate",
             v.position AS "userPosition", v.created_at AS "votedAt"
      FROM bills b
      LEFT JOIN votes v ON v.bill_id = b.id AND v.identity = ('sess:' || $1 || ':' || b.id)
      WHERE b.is_active ${notVotedClause}
      ORDER BY b.action_date DESC, b.id DESC
      LIMIT 1`;
    params = [email];
  } else if (direction === "forward") {
    text = `
      SELECT b.id, b.title, b.policy_area AS "policyArea", b.action_date AS "actionDate",
             v.position AS "userPosition", v.created_at AS "votedAt"
      FROM bills b
      LEFT JOIN votes v ON v.bill_id = b.id AND v.identity = ('sess:' || $1 || ':' || b.id)
      WHERE b.is_active ${notVotedClause}
        AND (b.action_date, b.id) < ($2::date, $3)
      ORDER BY b.action_date DESC, b.id DESC
      LIMIT 1`;
    params = [email, cursorDate, cursorId];
  } else {
    text = `
      SELECT b.id, b.title, b.policy_area AS "policyArea", b.action_date AS "actionDate",
             v.position AS "userPosition", v.created_at AS "votedAt"
      FROM bills b
      LEFT JOIN votes v ON v.bill_id = b.id AND v.identity = ('sess:' || $1 || ':' || b.id)
      WHERE b.is_active ${notVotedClause}
        AND (b.action_date, b.id) > ($2::date, $3)
      ORDER BY b.action_date ASC, b.id ASC
      LIMIT 1`;
    params = [email, cursorDate, cursorId];
  }

  const rows = await sql.query(text, params);
  return rows[0] || null;
}

async function fetchVotedItem({ email, direction, cursorVotedAt, cursorVoteId }) {
  const hasCursor = !!(cursorVotedAt && cursorVoteId);

  let text, params;
  if (direction === "forward" && !hasCursor) {
    text = `
      SELECT b.id, b.title, b.policy_area AS "policyArea", b.action_date AS "actionDate",
             v.position AS "userPosition", v.created_at AS "votedAt", v.id AS "voteRowId"
      FROM votes v
      JOIN bills b ON b.id = v.bill_id
      WHERE v.identity = ('sess:' || $1 || ':' || v.bill_id)
      ORDER BY v.created_at DESC, v.id DESC
      LIMIT 1`;
    params = [email];
  } else if (direction === "forward") {
    text = `
      SELECT b.id, b.title, b.policy_area AS "policyArea", b.action_date AS "actionDate",
             v.position AS "userPosition", v.created_at AS "votedAt", v.id AS "voteRowId"
      FROM votes v
      JOIN bills b ON b.id = v.bill_id
      WHERE v.identity = ('sess:' || $1 || ':' || v.bill_id)
        AND (v.created_at, v.id) < ($2::timestamptz, $3::bigint)
      ORDER BY v.created_at DESC, v.id DESC
      LIMIT 1`;
    params = [email, cursorVotedAt, cursorVoteId];
  } else {
    text = `
      SELECT b.id, b.title, b.policy_area AS "policyArea", b.action_date AS "actionDate",
             v.position AS "userPosition", v.created_at AS "votedAt", v.id AS "voteRowId"
      FROM votes v
      JOIN bills b ON b.id = v.bill_id
      WHERE v.identity = ('sess:' || $1 || ':' || v.bill_id)
        AND (v.created_at, v.id) > ($2::timestamptz, $3::bigint)
      ORDER BY v.created_at ASC, v.id ASC
      LIMIT 1`;
    params = [email, cursorVotedAt, cursorVoteId];
  }

  const rows = await sql.query(text, params);
  return rows[0] || null;
}
