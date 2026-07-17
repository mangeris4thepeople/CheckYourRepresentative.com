// =============================================================================
// api/reps.js - consolidated router for the Follow the Money / Know Your Rep
// read endpoints (representatives, senators, NGOs, Social Security).
// See api/bills.js for why this router pattern exists.
// =============================================================================
import representativeDetail from "./_handlers/representative-detail.js";
import representativesList from "./_handlers/representatives-list.js";
import senatorDetail from "./_handlers/senator-detail.js";
import senatorsList from "./_handlers/senators-list.js";
import ngoDetail from "./_handlers/ngo-detail.js";
import ngos from "./_handlers/ngos.js";
import socialSecurityDetail from "./_handlers/social-security-detail.js";

const OPS = {
  "representative-detail": representativeDetail,
  "representatives-list": representativesList,
  "senator-detail": senatorDetail,
  "senators-list": senatorsList,
  "ngo-detail": ngoDetail,
  "ngos": ngos,
  "social-security-detail": socialSecurityDetail,
};

export default async function handler(req, res) {
  const fn = OPS[req.query.op];
  if (!fn) return res.status(404).json({ error: "unknown operation" });
  return fn(req, res);
}
