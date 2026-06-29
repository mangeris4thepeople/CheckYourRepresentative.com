export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  const { street, city, state, zip } = req.query;
  if (!street) return res.status(400).json({ error: "street required" });

  const clean = (street || "").replace(/\.$/,"").replace(/\b(apt|unit|ste|suite|#)\s*[\w-]+/gi,"").trim();

  // Try 1: exact as entered (onelineaddress is more forgiving than parsed)
  const t1 = [clean, city, state, zip].filter(Boolean).join(", ");
  const r1 = await census(t1);
  if (r1) return res.json({ ok: true, source: "census", ...r1 });

  // Try 2: expand abbreviations (dr->Drive, st->Street, etc.)
  const expanded = expand(clean);
  if (expanded !== clean) {
    const t2 = [expanded, city, state, zip].filter(Boolean).join(", ");
    const r2 = await census(t2);
    if (r2) return res.json({ ok: true, source: "census_expanded", ...r2 });
  }

  // Try 3: drop city, keep ZIP (eliminates city misspelling)
  if (zip) {
    const t3 = [clean, state, zip].filter(Boolean).join(", ");
    const r3 = await census(t3);
    if (r3) return res.json({ ok: true, source: "census_zip_only", ...r3 });

    // Try 4: expanded + ZIP only
    if (expanded !== clean) {
      const t4 = [expanded, state, zip].filter(Boolean).join(", ");
      const r4 = await census(t4);
      if (r4) return res.json({ ok: true, source: "census_expanded_zip", ...r4 });
    }
  }

  // All Census attempts failed — return honest failure, NO guessing
  return res.json({ ok: false, reason: "no_match" });
}

async function census(address) {
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
    return parse(match);
  } catch { return null; }
}

function parse(match) {
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
  const map = [
    [/\bdr\.?\b/gi,"Drive"],[/\bst\.?\b/gi,"Street"],[/\bave\.?\b/gi,"Avenue"],
    [/\bblvd\.?\b/gi,"Boulevard"],[/\bln\.?\b/gi,"Lane"],[/\bct\.?\b/gi,"Court"],
    [/\bpl\.?\b/gi,"Place"],[/\brd\.?\b/gi,"Road"],[/\bwy\.?\b/gi,"Way"],
    [/\bcir\.?\b/gi,"Circle"],[/\bpkwy\.?\b/gi,"Parkway"],[/\bhwy\.?\b/gi,"Highway"],
  ];
  let r = s;
  for (const [pat, rep] of map) r = r.replace(pat, rep);
  return r;
}
