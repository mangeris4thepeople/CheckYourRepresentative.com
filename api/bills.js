// =============================================================================
// api/bills.js - consolidated router for bill and vote-record read endpoints.
//
// Vercel's Hobby plan caps a deployment at 12 serverless functions, and this
// project has 39 route handlers, so related routes are grouped behind one
// physical function per group (see api/_handlers/ for the actual logic,
// unchanged from when each lived at its own /api/<name> file). vercel.json
// rewrites the old URLs straight here with an ?op= param, so nothing calling
// these endpoints, frontend or otherwise, had to change.
// =============================================================================
import billDetail from "./_handlers/bill-detail.js";
import billSummary from "./_handlers/bill-summary.js";
import billsList from "./_handlers/bills-list.js";
import rollcall from "./_handlers/rollcall.js";
import matrix from "./_handlers/matrix.js";
import tally from "./_handlers/tally.js";
import stats from "./_handlers/stats.js";

const OPS = {
  "bill-detail": billDetail,
  "bill-summary": billSummary,
  "bills-list": billsList,
  "rollcall": rollcall,
  "matrix": matrix,
  "tally": tally,
  "stats": stats,
};

export default async function handler(req, res) {
  const fn = OPS[req.query.op];
  if (!fn) return res.status(404).json({ error: "unknown operation" });
  return fn(req, res);
}
