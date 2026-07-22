// =============================================================================
// api/account.js - consolidated router for profile, district lookup, merch
// checkout, and the email digest.
// See api/bills.js for why this router pattern exists.
// =============================================================================
import profile from "./_handlers/profile.js";
import geocode from "./_handlers/geocode.js";
import checkout from "./_handlers/checkout.js";
import digest from "./_handlers/digest.js";
import metrics from "./_handlers/metrics.js";

const OPS = {
  "profile": profile,
  "geocode": geocode,
  "checkout": checkout,
  "digest": digest,
  "metric": metrics,
  "metrics-summary": metrics,
};

export default async function handler(req, res) {
  const fn = OPS[req.query.op];
  if (!fn) return res.status(404).json({ error: "unknown operation" });
  return fn(req, res);
}
