// =============================================================================
// api/auth/[action].js - handles /api/auth/send, /api/auth/session, and
// /api/auth/verify as one function. Vercel compiles a dynamic route file like
// this into a single serverless function regardless of how many path values
// match it, so no vercel.json rewrite is needed here, unlike the other
// consolidated routers in api/ which do need one (see api/bills.js).
// =============================================================================
import send from "../_handlers/auth-send.js";
import session from "../_handlers/auth-session.js";
import verify from "../_handlers/auth-verify.js";

const ACTIONS = {
  send,
  session,
  verify,
};

export default async function handler(req, res) {
  const fn = ACTIONS[req.query.action];
  if (!fn) return res.status(404).json({ error: "unknown auth action" });
  return fn(req, res);
}
