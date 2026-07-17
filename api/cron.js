// =============================================================================
// api/cron.js - consolidated router for every scheduled job plus the manual
// test-email utility. None of these are called by the frontend, only by
// vercel.json's cron schedules (each cron's path now points directly at
// /api/cron?op=<name>) or by hand for test-email.
// See api/bills.js for why this router pattern exists.
// =============================================================================
import dailyReport from "./_handlers/daily-report.js";
import floorAlerts from "./_handlers/floor-alerts.js";
import syncBills from "./_handlers/sync-bills.js";
import verifyCongress from "./_handlers/verify-congress.js";
import syncReps from "./_handlers/sync-reps.js";
import syncRepFinances from "./_handlers/sync-rep-finances.js";
import syncSenators from "./_handlers/sync-senators.js";
import syncSenatorFinances from "./_handlers/sync-senator-finances.js";
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
  "test-email": testEmail,
};

export default async function handler(req, res) {
  const fn = OPS[req.query.op];
  if (!fn) return res.status(404).json({ error: "unknown operation" });
  return fn(req, res);
}
