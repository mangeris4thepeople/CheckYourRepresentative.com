// =============================================================================
// api/judges.js - consolidated router for the Know Your Judge read endpoints.
// See api/bills.js for why this router pattern exists. judge-courts shares
// judge-detail's handler, which branches on the op internally.
// =============================================================================
import judgesList from "./_handlers/judges-list.js";
import judgeDetail from "./_handlers/judge-detail.js";
import nationalJudges from "./_handlers/national-judges.js";
import judgesGeo from "./_handlers/judges-geo.js";

const OPS = {
  "judges-list": judgesList,
  "judge-detail": judgeDetail,
  "judge-courts": judgeDetail,
  "national-judges-list": nationalJudges,
  "national-courts": nationalJudges,
  "judges-map": judgesGeo,
  "state-judges": judgesGeo,
  "county-courts": judgesGeo,
  "national-judge-detail": judgesGeo,
};

export default async function handler(req, res) {
  const fn = OPS[req.query.op];
  if (!fn) return res.status(404).json({ error: "unknown operation" });
  return fn(req, res);
}
