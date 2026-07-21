// =============================================================================
// api/judges.js - consolidated router for the Know Your Judge read endpoints.
// See api/bills.js for why this router pattern exists. judge-courts shares
// judge-detail's handler, which branches on the op internally.
// =============================================================================
import judgesList from "./_handlers/judges-list.js";
import judgeDetail from "./_handlers/judge-detail.js";
import judgesNationalList from "./_handlers/judges-national-list.js";
import judgeNationalDetail from "./_handlers/judge-national-detail.js";

const OPS = {
  "judges-list": judgesList,
  "judge-detail": judgeDetail,
  "judge-courts": judgeDetail,
  "judges-national-list": judgesNationalList,
  "judge-national-detail": judgeNationalDetail,
  "judge-national-courts": judgeNationalDetail,
};

export default async function handler(req, res) {
  const fn = OPS[req.query.op];
  if (!fn) return res.status(404).json({ error: "unknown operation" });
  return fn(req, res);
}
