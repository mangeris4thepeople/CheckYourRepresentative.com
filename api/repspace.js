// =============================================================================
// api/repspace.js - consolidated router for the RepSpace read endpoints.
// See api/bills.js for why this router pattern exists (Vercel's function
// count limit). The public paths /api/repspace/members, /api/repspace/profile
// and /api/repspace/address-lookup are vercel.json rewrites onto ?op= here.
// =============================================================================
import members from "./_handlers/repspace-members.js";
import profile from "./_handlers/repspace-profile.js";
import addressLookup from "./_handlers/repspace-address.js";

const OPS = {
  "members": members,
  "profile": profile,
  "address-lookup": addressLookup,
};

export default async function handler(req, res) {
  const fn = OPS[req.query.op];
  if (!fn) return res.status(404).json({ error: "unknown operation" });
  return fn(req, res);
}
