// =============================================================================
// /api/geocode.js — server-side Census geocoder proxy + ZIP fallback
// Runs on Vercel's IPs (not blocked by Census). Tries multiple strategies.
// =============================================================================
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  const { street, city, state, zip } = req.query;
  if (!street) return res.status(400).json({ error: "street required" });

  // Strategy 1: onelineaddress (most forgiving — handles abbreviations)
  const oneline1 = [street, city, state, zip].filter(Boolean).join(", ");
  const result1 = await tryCensusOneline(oneline1);
  if (result1) return res.json({ ok: true, source: "census_oneline", ...result1 });

  // Strategy 2: expand street abbreviations and retry
  const expandedStreet = expandAbbreviations(street);
  if (expandedStreet !== street) {
    const oneline2 = [expandedStreet, city, state, zip].filter(Boolean).join(", ");
    const result2 = await tryCensusOneline(oneline2);
    if (result2) return res.json({ ok: true, source: "census_expanded", ...result2 });
  }

  // Strategy 3: ZIP + street only (drop city — avoids misspelling issues)
  if (zip) {
    const oneline3 = [street, state, zip].filter(Boolean).join(", ");
    const result3 = await tryCensusOneline(oneline3);
    if (result3) return res.json({ ok: true, source: "census_zip_only", ...result3 });

    // Strategy 4: expanded + ZIP only
    if (expandedStreet !== street) {
      const oneline4 = [expandedStreet, state, zip].filter(Boolean).join(", ");
      const result4 = await tryCensusOneline(oneline4);
      if (result4) return res.json({ ok: true, source: "census_expanded_zip", ...result4 });
    }

    // Strategy 5: ZIP-to-district fallback via Congress.gov
    const zipResult = await tryZipFallback(zip, state);
    if (zipResult) return res.json({ ok: true, source: "zip_fallback", approximate: true, ...zipResult });
  }

  return res.json({ ok: false, reason: "no_match" });
}

async function tryCensusOneline(oneline) {
  try {
    const params = new URLSearchParams({
      address: oneline,
      benchmark: "Public_AR_Current",
      vintage: "Current_Current",
      layers: "all",
      format: "json",
    });
    const url = `https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress?${params}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const data = await res.json();
    const match = data?.result?.addressMatches?.[0];
    if (!match) return null;
    return parseMatch(match);
  } catch { return null; }
}

async function tryZipFallback(zip, state) {
  try {
    // Use Congress.gov member lookup by ZIP to find district
    const apiKey = process.env.CONGRESS_API_KEY;
    if (!apiKey) return null;
    const url = `https://api.congress.gov/v3/member?zip=${zip}&currentMember=true&limit=5&api_key=${apiKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    const members = data.members || [];
    // Find House member (has district number)
    const houseMember = members.find(m => {
      const terms = m.terms?.item || [];
      const latest = terms[terms.length - 1] || {};
      return latest.chamber === "House of Representatives";
    });
    if (!houseMember) return null;
    const stateAbbr = houseMember.state;
    const district = houseMember.district;
    if (!stateAbbr || district === undefined) return null;
    const districtCode = district === 0
      ? `${stateAbbr}-AL`
      : `${stateAbbr}-${String(district).padStart(2, "0")}`;
    return {
      district: districtCode,
      districtCode,
      state: stateAbbr,
      atLarge: district === 0,
      location: { state: stateAbbr, city: "", zip },
      matchedAddress: `ZIP ${zip} area`,
      coords: null,
    };
  } catch { return null; }
}

function parseMatch(match) {
  const FIPS_ABBR = {"01":"AL","02":"AK","04":"AZ","05":"AR","06":"CA","08":"CO","09":"CT","10":"DE","11":"DC","12":"FL","13":"GA","15":"HI","16":"ID","17":"IL","18":"IN","19":"IA","20":"KS","21":"KY","22":"LA","23":"ME","24":"MD","25":"MA","26":"MI","27":"MN","28":"MS","29":"MO","30":"MT","31":"NE","32":"NV","33":"NH","34":"NJ","35":"NM","36":"NY","37":"NC","38":"ND","39":"OH","40":"OK","41":"OR","42":"PA","44":"RI","45":"SC","46":"SD","47":"TN","48":"TX","49":"UT","50":"VT","51":"VA","53":"WA","54":"WV","55":"WI","56":"WY"};
  const geos = match.geographies || {};
  const cdKey = Object.keys(geos).find(k => /Congressional District/i.test(k));
  const cd = cdKey && geos[cdKey]?.[0];
  if (!cd) return null;
  const abbr = FIPS_ABBR[cd.STATE] || "";
  let num = cd.BASENAME;
  const cdField = Object.keys(cd).find(k => /^CD\d+$/.test(k));
  if (cdField && cd[cdField]) num = cd[cdField];
  const atLarge = ["00","98","Zero"].includes(String(num)) || /at.?large/i.test(cd.NAME || "");
  const districtCode = atLarge ? `${abbr}-AL` : `${abbr}-${String(num).padStart(2,"0")}`;
  const a = match.addressComponents || {};
  return {
    district: districtCode,
    districtCode,
    state: abbr,
    atLarge,
    location: {
      state: abbr,
      city: a.city || "",
      zip: a.zip || "",
      street: [a.fromAddress, a.streetName, a.suffixType].filter(Boolean).join(" ").trim(),
    },
    matchedAddress: match.matchedAddress,
    coords: match.coordinates ? { lng: match.coordinates.x, lat: match.coordinates.y } : null,
  };
}

function expandAbbreviations(street) {
  const map = {
    "\\bdr\\.?\\b": "Drive",
    "\\bst\\.?\\b": "Street",
    "\\bave\\.?\\b": "Avenue",
    "\\bblvd\\.?\\b": "Boulevard",
    "\\bln\\.?\\b": "Lane",
    "\\bct\\.?\\b": "Court",
    "\\bpl\\.?\\b": "Place",
    "\\brd\\.?\\b": "Road",
    "\\bwy\\.?\\b": "Way",
    "\\bcir\\.?\\b": "Circle",
    "\\bpkwy\\.?\\b": "Parkway",
    "\\bsq\\.?\\b": "Square",
    "\\bter\\.?\\b": "Terrace",
    "\\btrce\\.?\\b": "Trace",
    "\\bhwy\\.?\\b": "Highway",
    "\\bfwy\\.?\\b": "Freeway",
    "\\bexpy\\.?\\b": "Expressway",
  };
  let result = street;
  for (const [pattern, replacement] of Object.entries(map)) {
    result = result.replace(new RegExp(pattern, "gi"), replacement);
  }
  return result;
}
