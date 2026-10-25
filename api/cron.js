// =============================================================================
// api/cron.js - consolidated router for every scheduled job plus the manual
// test-email utility. None of these are called by the frontend, only by
// vercel.json's cron schedules (each cron's path now points directly at
// /api/cron?op=<name>) or by hand for test-email.
// See api/bills.js for why this router pattern exists.
//
// Authentication: every op requires CRON_SECRET, since this route would
// otherwise be a publicly guessable, unauthenticated way to trigger data
// syncs and outbound email on demand. Vercel's own scheduled cron requests
// send "Authorization: Bearer <CRON_SECRET>" automatically whenever that env
// var is set, which is why that header is the primary path. The ?key=
// query param exists only for manual runs (a human hitting the URL by hand).
// If CRON_SECRET itself is not set, every request is rejected: there is no
// secret to check a request against, so the safe default is to allow
// nothing rather than fall open to allowing everything.
// =============================================================================
import dailyReport from "./_handlers/daily-report.js";
import floorAlerts from "./_handlers/floor-alerts.js";
import syncBills from "./_handlers/sync-bills.js";
import verifyCongress from "./_handlers/verify-congress.js";
import syncReps from "./_handlers/sync-reps.js";
import syncRepFinances from "./_handlers/sync-rep-finances.js";
import syncSenators from "./_handlers/sync-senators.js";
import syncSenatorFinances from "./_handlers/sync-senator-finances.js";
import syncSsa from "./_handlers/sync-ssa.js";
import syncSnap from "./_handlers/sync-snap.js";
import syncMedicaid from "./_handlers/sync-medicaid.js";
import syncMoneySources from "./_handlers/sync-money-sources.js";
import syncMoneyMap from "./_handlers/sync-money-map.js";
import syncRepspace from "./_handlers/sync-repspace.js";
import syncRepspaceActivity from "./_handlers/sync-repspace-activity.js";
import testEmail from "./_handlers/test-email.js";

const OPS = {
  "daily-report": dailyReport,
  "floor-alerts": floorAlerts,
  "sync-bills": syncBills,
  "verify-congress": verifyCongress,
  "sync-reps": syncReps,
  "sync-rep-finances": syncRepFinances,
  "sync-senators": syncSenators,
  "sync-senator-finances": syncSenatorFinances,
  "sync-ssa": syncSsa,
  "sync-snap": syncSnap,
  "sync-medicaid": syncMedicaid,
  "sync-money-sources": syncMoneySources,
  "sync-money-map": syncMoneyMap,
  "sync-repspace": syncRepspace,
  "sync-repspace-activity": syncRepspaceActivity,
  "test-email": testEmail,
};

function isAuthorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authHeader = req.headers.authorization || "";
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  const fromHeader = bearerMatch ? bearerMatch[1] : null;
  const fromQuery = req.query.key || null;
  const provided = fromHeader || fromQuery;

  return provided === secret;
}

export default async function handler(req, res) {
  if (!isAuthorized(req)) return res.status(401).json({ error: "unauthorized" });

  const fn = OPS[req.query.op];
  if (!fn) return res.status(404).json({ error: "unknown operation" });

  // Log every failed cron response body so the reason shows up in Vercel
  // runtime logs (the dashboard only shows the status code otherwise).
  let code = 200;
  const origStatus = res.status.bind(res);
  const origJson = res.json.bind(res);
  res.status = (c) => { code = c; return origStatus(c); };
  res.json = (body) => {
    if (code >= 400) console.error(`[cron ${req.query.op}] ${code}`, JSON.stringify(body).slice(0, 800));
    else console.log(`[cron ${req.query.op}] ${code}`, JSON.stringify(body).slice(0, 300));
    return origJson(body);
  };
  return fn(req, res);
}
