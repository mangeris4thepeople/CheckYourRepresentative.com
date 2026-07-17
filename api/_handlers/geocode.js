// Resolves a street address to a congressional district: a few Census
// onelineaddress attempts, then a Google Maps fallback with a Census
// reverse-geocode step, so any caller (this endpoint's own GET handler, or
// api/representatives-list.js's address-search fallback) gets the same
// resolution logic and the same result shape instead of a second copy of it.
export async function resolveAddressToDistrict({ street, city, state, zip } = {}) {
  if (!street) return { ok: false, reason: "no_match" };

  // Sanitize state: the form's placeholder "-" and anything that is not a
  // real 2-letter code must never enter a lookup string.
  const rawState = (state || "").trim().toUpperCase();
  const st = /^[A-Z]{2}$/.test(rawState) ? rawState : "";

  const clean = street.replace(/\.$/,"").replace(/\b(apt|unit|ste|suite|#)\s*[\w-]+/gi,"").trim();

  // Strategy 1-4: Census onelineaddress with variations
  const tries = [
    [clean, city, st, zip].filter(Boolean).join(", "),
    [expand(clean), city, st, zip].filter(Boolean).join(", "),
    [clean, st, zip].filter(Boolean).join(", "),
    [expand(clean), st, zip].filter(Boolean).join(", "),
  ];

  for (const address of tries) {
    const r = await tryCensus(address);
    if (r) {
      // Sanity check: if the visitor told us their state, a result from a
      // different state is a mis-geocode. Skip it and keep trying.
      if (st && r.state && r.state !== st) continue;
      return { ok: true, source: "census", ...r };
    }
  }

  // Strategy 5: Google Maps Geocoding API - finds every address in America
  const googleKey = process.env.GOOGLE_MAPS_API_KEY;
  if (googleKey) {
    const fullAddress = [clean, city, st, zip].filter(Boolean).join(", ") + ", USA";
    const coords = await tryGoogle(fullAddress, googleKey);
    if (coords) {
      // Got coordinates from Google - now reverse geocode via Census for district
      const district = await censusReverse(coords.lat, coords.lng);
      if (district) {
        if (st && district.state && district.state !== st) {
          return { ok: false, reason: "state_mismatch",
            expected: st, got: district.district };
        }
        return {
          ok: true,
          source: "google_geocode",
          ...district,
          matchedAddress: fullAddress,
        };
      }
    }
  }

  return { ok: false, reason: "no_match" };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  const { street, city, zip, state } = req.query;
  if (!street) return res.status(400).json({ error: "street required" });

  const result = await resolveAddressToDistrict({ street, city, state, zip });
  return res.json(result);
}

async function tryCensus(address) {
  try {
    const p = new URLSearchParams({
      address,
      benchmark: "Public_AR_Current",
      vintage: "Current_Current",
      layers: "all",
      format: "json",
    });
    const r = await fetch(
      "https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress?" + p.toString(),
      { signal: AbortSignal.timeout(10000) }
    );
    if (!r.ok) return null;
    const data = await r.json();
    const match = data?.result?.addressMatches?.[0];
    if (!match) return null;
    return parseMatch(match);
  } catch { return null; }
}

async function tryGoogle(address, key) {
  try {
    const p = new URLSearchParams({ address, key });
    const r = await fetch(
      "https://maps.googleapis.com/maps/api/geocode/json?" + p.toString(),
      { signal: AbortSignal.timeout(8000) }
    );
    if (!r.ok) return null;
    const data = await r.json();
    if (data.status !== "OK" || !data.results?.length) return null;
    const loc = data.results[0].geometry.location;
    return { lat: loc.lat, lng: loc.lng };
  } catch { return null; }
}

async function censusReverse(lat, lng) {
  try {
    const p = new URLSearchParams({
      x: lng, y: lat,
      benchmark: "Public_AR_Current",
      vintage: "Current_Current",
      layers: "all",
      format: "json",
    });
    const r = await fetch(
      "https://geocoding.geo.census.gov/geocoder/geographies/coordinates?" + p.toString(),
      { signal: AbortSignal.timeout(8000) }
    );
    if (!r.ok) return null;
    const data = await r.json();
    const geos = data?.result?.geographies || {};
    const cdKey = Object.keys(geos).find(k => /Congressional District/i.test(k));
    const cd = cdKey && geos[cdKey]?.[0];
    if (!cd) return null;
    const FIPS = {"01":"AL","02":"AK","04":"AZ","05":"AR","06":"CA","08":"CO","09":"CT","10":"DE","11":"DC","12":"FL","13":"GA","15":"HI","16":"ID","17":"IL","18":"IN","19":"IA","20":"KS","21":"KY","22":"LA","23":"ME","24":"MD","25":"MA","26":"MI","27":"MN","28":"MS","29":"MO","30":"MT","31":"NE","32":"NV","33":"NH","34":"NJ","35":"NM","36":"NY","37":"NC","38":"ND","39":"OH","40":"OK","41":"OR","42":"PA","44":"RI","45":"SC","46":"SD","47":"TN","48":"TX","49":"UT","50":"VT","51":"VA","53":"WA","54":"WV","55":"WI","56":"WY"};
    const abbr = FIPS[cd.STATE] || "";
    let num = cd.BASENAME;
    const cdField = Object.keys(cd).find(k => /^CD\d+$/.test(k));
    if (cdField && cd[cdField]) num = cd[cdField];
    const atLarge = ["00","98","Zero"].includes(String(num)) || /at.?large/i.test(cd.NAME || "");
    const districtCode = atLarge ? abbr+"-AL" : abbr+"-"+String(num).padStart(2,"0");
    return {
      district: districtCode, districtCode, state: abbr, atLarge,
      location: { state: abbr, city: "", zip: "", street: "" },
      coords: { lat, lng },
    };
  } catch { return null; }
}

function parseMatch(match) {
  const FIPS = {"01":"AL","02":"AK","04":"AZ","05":"AR","06":"CA","08":"CO","09":"CT","10":"DE","11":"DC","12":"FL","13":"GA","15":"HI","16":"ID","17":"IL","18":"IN","19":"IA","20":"KS","21":"KY","22":"LA","23":"ME","24":"MD","25":"MA","26":"MI","27":"MN","28":"MS","29":"MO","30":"MT","31":"NE","32":"NV","33":"NH","34":"NJ","35":"NM","36":"NY","37":"NC","38":"ND","39":"OH","40":"OK","41":"OR","42":"PA","44":"RI","45":"SC","46":"SD","47":"TN","48":"TX","49":"UT","50":"VT","51":"VA","53":"WA","54":"WV","55":"WI","56":"WY"};
  const geos = match.geographies || {};
  const cdKey = Object.keys(geos).find(k => /Congressional District/i.test(k));
  const cd = cdKey && geos[cdKey]?.[0];
  if (!cd) return null;
  const abbr = FIPS[cd.STATE] || "";
  let num = cd.BASENAME;
  const cdField = Object.keys(cd).find(k => /^CD\d+$/.test(k));
  if (cdField && cd[cdField]) num = cd[cdField];
  const atLarge = ["00","98","Zero"].includes(String(num)) || /at.?large/i.test(cd.NAME || "");
  const districtCode = atLarge ? abbr+"-AL" : abbr+"-"+String(num).padStart(2,"0");
  const a = match.addressComponents || {};
  return {
    district: districtCode, districtCode, state: abbr, atLarge,
    location: { state: abbr, city: a.city||"", zip: a.zip||"",
      street: [a.fromAddress,a.streetName,a.suffixType].filter(Boolean).join(" ").trim() },
    matchedAddress: match.matchedAddress,
    coords: match.coordinates ? { lng: match.coordinates.x, lat: match.coordinates.y } : null,
  };
}

function expand(s) {
  return s
    .replace(/\bdr\.?\b/gi,"Drive").replace(/\bst\.?\b/gi,"Street")
    .replace(/\bave\.?\b/gi,"Avenue").replace(/\bblvd\.?\b/gi,"Boulevard")
    .replace(/\bln\.?\b/gi,"Lane").replace(/\bct\.?\b/gi,"Court")
    .replace(/\bpl\.?\b/gi,"Place").replace(/\brd\.?\b/gi,"Road")
    .replace(/\bwy\.?\b/gi,"Way").replace(/\bcir\.?\b/gi,"Circle")
    .replace(/\bpkwy\.?\b/gi,"Parkway").replace(/\bhwy\.?\b/gi,"Highway");
}
