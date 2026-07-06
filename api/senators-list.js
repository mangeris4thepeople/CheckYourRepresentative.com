// =============================================================================
// GET /api/senators-list - search and paginate the senators table for the
// Know Your Rep tab's Senate view. Mirrors api/representatives-list.js
// exactly, including the full-state-name match and the address-geocode
// fallback; the only real difference is an address resolves to a state
// (senators have no district), so the fallback returns that state's two
// senators instead of one district's representative.
//
//   GET /api/senators-list                  -> first 20, by state then name
//   GET /api/senators-list?limit=20&offset=20  -> next batch
//   GET /api/senators-list?q=warren          -> filter by name or state
//   GET /api/senators-list?q=123 Main St     -> falls back to address lookup
//                                                (see below) when the name/state
//                                                search comes up empty
// =============================================================================
import { sql, hasDb } from "./_db.js";
import { resolveAddressToDistrict } from "./geocode.js";

// Full state names to their two-letter code, so a search for "Colorado"
// matches the same rows a search for "CO" would.
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
  if (!hasDb) return res.status(200).json({ ready: false, reason: "no_database", senators: [] });

  try {
    const q = String(req.query.q || "").trim();
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

    const like = `%${q}%`;
    const stateCode = STATE_CODES[q.toLowerCase()];
    let senators = !q
      ? await sql`
          SELECT bioguide_id, name, party, state, class, phone, website, contact_url, fec_candidate_id
          FROM senators
          ORDER BY state ASC, name ASC LIMIT ${limit} OFFSET ${offset}`
      : stateCode
      ? await sql`
          SELECT bioguide_id, name, party, state, class, phone, website, contact_url, fec_candidate_id
          FROM senators
          WHERE name ILIKE ${like} OR state ILIKE ${like} OR state = ${stateCode}
          ORDER BY state ASC, name ASC LIMIT ${limit} OFFSET ${offset}`
      : await sql`
          SELECT bioguide_id, name, party, state, class, phone, website, contact_url, fec_candidate_id
          FROM senators
          WHERE name ILIKE ${like} OR state ILIKE ${like}
          ORDER BY state ASC, name ASC LIMIT ${limit} OFFSET ${offset}`;

    // The name/state search above already covers "a few letters, in order"
    // correctly. It only ever comes up empty on a real query string when
    // that string was not any of those, which a digit (street number, ZIP)
    // is a reasonable signal for, e.g. "123 Main St". In that case, try
    // resolving it as a street address and return that state's senators
    // instead of an empty list.
    let matchedVia = null;
    let resolvedState = null;
    if (q && senators.length === 0 && /\d/.test(q)) {
      const geo = await resolveAddressToDistrict({ street: q });
      if (geo.ok && geo.state) {
        const addrSenators = await sql`
          SELECT bioguide_id, name, party, state, class, phone, website, contact_url, fec_candidate_id
          FROM senators WHERE state = ${geo.state} ORDER BY name ASC`;
        if (addrSenators.length) {
          senators = addrSenators;
          matchedVia = "address";
          resolvedState = geo.state;
        }
      }
    }

    return res.status(200).json({
      ready: true,
      senators,
      offset,
      hasMore: matchedVia ? false : senators.length === limit,
      count: senators.length,
      matchedVia,
      resolvedState,
    });
  } catch (err) {
    const msg = String(err.message || err);
    if (/relation .* does not exist/i.test(msg)) {
      return res.status(200).json({ ready: false, reason: "schema_not_migrated", senators: [] });
    }
    return res.status(500).json({ error: "senators_list_failed", detail: msg });
  }
}
