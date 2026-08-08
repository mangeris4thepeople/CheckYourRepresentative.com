// =============================================================================
// GET /api/repspace/address-lookup?address=... - address to delegation.
//
// Geocodes a free-form US address with the Census Bureau's public geocoder
// (no key required) and returns the House member for that congressional
// district plus both senators for the state, straight from rs_members.
//
// Layer name caution, verified against the geocoder's documented behavior:
// the geographies object keys its congressional district layer with the
// Congress ordinal ("119th Congressional Districts" in the current vintage)
// and that ordinal rolls over every two years. The parsing below therefore
// matches any key containing "Congressional District" instead of hardcoding
// the ordinal, and reads the district number from whichever CD field the
// vintage carries (CD119, CD, and so on) with GEOID as the fallback.
// =============================================================================
import { sql, hasDb } from "../_db.js";

const GEOCODER = "https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress";

const FIPS_TO_USPS = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT",
  "10": "DE", "11": "DC", "12": "FL", "13": "GA", "15": "HI", "16": "ID", "17": "IL",
  "18": "IN", "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME", "24": "MD",
  "25": "MA", "26": "MI", "27": "MN", "28": "MS", "29": "MO", "30": "MT", "31": "NE",
  "32": "NV", "33": "NH", "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND",
  "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD",
  "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA", "54": "WV",
  "55": "WI", "56": "WY", "72": "PR",
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  // Address strings are personal; never edge-cache lookups.
  res.setHeader("Cache-Control", "no-store");

  try {
    const address = String(req.query.address || "").trim();
    if (address.length < 8) return res.status(400).json({ error: "address required" });

    const url = `${GEOCODER}?address=${encodeURIComponent(address)}` +
      `&benchmark=Public_AR_Current&vintage=Current_Current&format=json`;
    const r = await fetch(url, { headers: { "User-Agent": "CheckYourRepresentative.com civic education" } });
    if (!r.ok) return res.status(502).json({ error: `census geocoder ${r.status}` });
    const data = await r.json();

    const match = data?.result?.addressMatches?.[0];
    if (!match) return res.status(200).json({ found: false, reason: "no_address_match" });

    const geos = match.geographies || {};
    const cdKey = Object.keys(geos).find(k => /congressional district/i.test(k));
    const cd = cdKey && geos[cdKey] && geos[cdKey][0];
    if (!cd) return res.status(200).json({ found: false, reason: "no_district_layer", layers: Object.keys(geos) });

    const stateFips = String(cd.STATE || (cd.GEOID || "").slice(0, 2));
    const state = FIPS_TO_USPS[stateFips];
    const cdField = Object.keys(cd).find(k => /^CD\d*$/.test(k));
    const rawDistrict = String(cdField ? cd[cdField] : (cd.GEOID || "").slice(2)).trim();
    if (!state || !rawDistrict) {
      return res.status(200).json({ found: false, reason: "unparsed_geography", geography: cd });
    }

    // 00 and 98 are the geocoder's at-large codes; rs_members stores AL.
    const districtNumber = parseInt(rawDistrict, 10);
    const districtCode = state + "-" +
      (districtNumber === 0 || districtNumber === 98 ? "AL" : String(districtNumber).padStart(2, "0"));

    let representative = null;
    let senators = [];
    if (hasDb) {
      try {
        representative = (await sql`
          SELECT bioguide_id, full_name, chamber, state, district, party, photo_url
          FROM rs_members WHERE active AND chamber = 'house' AND district = ${districtCode}`)[0] || null;
        senators = await sql`
          SELECT bioguide_id, full_name, chamber, state, district, party, photo_url
          FROM rs_members WHERE active AND chamber = 'senate' AND state = ${state}
          ORDER BY last_name`;
      } catch (err) {
        if (!/relation .* does not exist/i.test(String(err.message || err))) throw err;
      }
    }

    return res.status(200).json({
      found: true,
      matchedAddress: match.matchedAddress || null,
      state,
      district: districtCode,
      districtLayer: cdKey,
      representative,
      senators,
    });
  } catch (err) {
    return res.status(500).json({ error: "repspace_address_failed", detail: String(err.message || err) });
  }
}
