// =============================================================================
// api/messages.js - consolidated router for the three contact-related
// endpoints: legislator lookup + draft letter, the site contact form, and
// contact-click tracking. Named messages.js rather than contact.js so its
// own "contact" op doesn't share a name with the router file's route.
// See api/bills.js for why this router pattern exists.
// =============================================================================
import contact from "./_handlers/contact.js";
import contactUs from "./_handlers/contact-us.js";
import contactTrack from "./_handlers/contact-track.js";

const OPS = {
  "contact": contact,
  "contact-us": contactUs,
  "contact-track": contactTrack,
};

export default async function handler(req, res) {
  const fn = OPS[req.query.op];
  if (!fn) return res.status(404).json({ error: "unknown operation" });
  return fn(req, res);
}
