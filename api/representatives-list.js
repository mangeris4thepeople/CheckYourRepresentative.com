// =============================================================================
// GET /api/representatives-list - search and paginate the representatives
// table for the Know Your Rep tab. Same pattern as api/ngos.js.
//
//   GET /api/representatives-list                  -> first 20, by district
//   GET /api/representatives-list?limit=20&offset=20  -> next batch
//   GET /api/representatives-list?q=garcia          -> filter by name, state, or district
//   GET /api/representatives-list?q=123 Main St     -> falls back to address lookup
//                                                       (see below) when the name/state/
//                                                       district search comes up empty
// =============================================================================
import { sql, hasDb } from "./_db.js";
import { resolveAddressToDistrict } from "./geocode.js";

// Full state names to their two-letter code, so a search for "Colorado"
// matches the same rows a search for "CO" would. The existing ILIKE checks
// already cover a substring of the code itself (e.g. "co"), just not the
// full name.
const STATE_CODES = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO",
  montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH", "new jersey": "NJ",
  "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND", ohio: "OH",
  oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=1800");
  if (!hasDb) return res.status(200).json({ ready: false, reason: "no_database", reps: [] });

  try {
    const q = String(req.query.q || "").trim();
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

    const like = `%${q}%`;
    const stateCode = STATE_CODES[q.toLowerCase()];
    let reps = !q
      ? await sql`
          SELECT district, name, party, state, phone, website, contact_url, fec_candidate_id
          FROM representatives
          ORDER BY district ASC LIMIT ${limit} OFFSET ${offset}`
      : stateCode
      ? await sql`
          SELECT district, name, party, state, phone, website, contact_url, fec_candidate_id
          FROM representatives
          WHERE name ILIKE ${like} OR state ILIKE ${like} OR district ILIKE ${like} OR state = ${stateCode}
          ORDER BY district ASC LIMIT ${limit} OFFSET ${offset}`
      : await sql`
          SELECT district, name, party, state, phone, website, contact_url, fec_candidate_id
          FROM representatives
          WHERE name ILIKE ${like} OR state ILIKE ${like} OR district ILIKE ${like}
          ORDER BY district ASC LIMIT ${limit} OFFSET ${offset}`;

    // The name/state/district search above already covers "a few letters, in
    // order" correctly. It only ever comes up empty on a real query string
    // when that string was not any of those, which a digit (street number,
    // ZIP) is a reasonable signal for, e.g. "123 Main St". In that case, try
    // resolving it as a street address and return that district's rep(s)
    // instead of an empty list.
    let matchedVia = null;
    let resolvedDistrict = null;
    if (q && reps.length === 0 && /\d/.test(q)) {
      const geo = await resolveAddressToDistrict({ street: q });
      if (geo.ok && geo.district) {
        const addrReps = await sql`
          SELECT district, name, party, state, phone, website, contact_url, fec_candidate_id
          FROM representatives WHERE district = ${geo.district}`;
        if (addrReps.length) {
          reps = addrReps;
          matchedVia = "address";
          resolvedDistrict = geo.district;
        }
      }
    }

    return res.status(200).json({
      ready: true,
      reps,
      offset,
      hasMore: matchedVia ? false : reps.length === limit,
      count: reps.length,
      matchedVia,
      resolvedDistrict,
    });
  } catch (err) {
    const msg = String(err.message || err);
    if (/relation .* does not exist/i.test(msg)) {
      return res.status(200).json({ ready: false, reason: "schema_not_migrated", reps: [] });
    }
    return res.status(500).json({ error: "representatives_list_failed", detail: msg });
  }
}
