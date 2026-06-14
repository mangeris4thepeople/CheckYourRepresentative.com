// =============================================================================
// Check Your Representative — Address → Congressional District lookup
// -----------------------------------------------------------------------------
// Congressional districts do NOT follow city or county lines — a single town
// can sit in two districts (e.g. Loveland spans CO-02 and CO-04). The only
// accurate way to assign the right bills is to resolve the voter's STREET
// ADDRESS to its district. We use the U.S. Census Bureau geocoder: free,
// authoritative, no API key.
//
// The Census geocoder doesn't allow normal browser (CORS) calls, so we use its
// supported JSONP mode — which also means this needs no backend to work.
//
// onResolved({ district, districtCode, state, location, matchedAddress, coords })
// =============================================================================
import React, { useState } from "react";

const C = { crimson:"#8B0000", navy:"#0A1A3F", gold:"#C9A227", parchment:"#FBF7EC",
  parchmentEdge:"#F0E6CE", ink:"#1A1A1A", muted:"#5C5347", line:"#D8C9A0" };
const serif = "Georgia, 'Times New Roman', serif";

const STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND",
  "OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

const FIPS_ABBR = {"01":"AL","02":"AK","04":"AZ","05":"AR","06":"CA","08":"CO","09":"CT","10":"DE","11":"DC","12":"FL","13":"GA","15":"HI","16":"ID","17":"IL","18":"IN","19":"IA","20":"KS","21":"KY","22":"LA","23":"ME","24":"MD","25":"MA","26":"MI","27":"MN","28":"MS","29":"MO","30":"MT","31":"NE","32":"NV","33":"NH","34":"NJ","35":"NM","36":"NY","37":"NC","38":"ND","39":"OH","40":"OK","41":"OR","42":"PA","44":"RI","45":"SC","46":"SD","47":"TN","48":"TX","49":"UT","50":"VT","51":"VA","53":"WA","54":"WV","55":"WI","56":"WY"};

// JSONP call to the Census geocoder (no CORS, no key needed)
function censusGeocode({ street, city, state, zip }) {
  return new Promise((resolve, reject) => {
    const cb = "__cyr_census_" + Math.random().toString(36).slice(2);
    const script = document.createElement("script");
    const cleanup = () => { try { delete window[cb]; } catch {} script.remove(); clearTimeout(timer); };
    const timer = setTimeout(() => { cleanup(); reject(new Error("timeout")); }, 12000);
    window[cb] = (data) => { cleanup(); resolve(data); };
    const qs = new URLSearchParams({
      street: street || "", city: city || "", state: state || "", zip: zip || "",
      benchmark: "Public_AR_Current", vintage: "Current_Current",
      layers: "all", format: "jsonp", callback: cb,
    });
    script.src = `https://geocoding.geo.census.gov/geocoder/geographies/address?${qs}`;
    script.onerror = () => { cleanup(); reject(new Error("network")); };
    document.body.appendChild(script);
  });
}

function parseDistrict(data) {
  const match = data?.result?.addressMatches?.[0];
  if (!match) return null;
  const geos = match.geographies || {};
  const cdKey = Object.keys(geos).find(k => /Congressional Districts/i.test(k));
  const cd = cdKey && geos[cdKey] && geos[cdKey][0];
  if (!cd) return null;

  const stateFips = cd.STATE;
  const abbr = FIPS_ABBR[stateFips] || "";
  // district number: prefer a CDnnn field (e.g. CD119), else BASENAME ("4")
  let num = cd.BASENAME;
  const cdField = Object.keys(cd).find(k => /^CD\d+$/.test(k));
  if (cdField && cd[cdField]) num = cd[cdField];

  const atLarge = ["00", "98", "Zero"].includes(String(num)) || /at.?large/i.test(cd.NAME || "");
  const districtCode = atLarge ? `${abbr}-AL` : `${abbr}-${String(num).padStart(2, "0")}`;

  const a = match.addressComponents || {};
  const location = {
    state: abbr,
    city: a.city || "",
    zip: a.zip || "",
    street: [a.fromAddress, a.streetName, a.suffixType].filter(Boolean).join(" ").trim(),
  };
  const coords = match.coordinates ? { lng: match.coordinates.x, lat: match.coordinates.y } : null;
  return { district: districtCode, districtCode, state: abbr, atLarge,
           location, matchedAddress: match.matchedAddress, coords };
}

export default function AddressLookup({ onResolved }) {
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [phase, setPhase] = useState("idle"); // idle | looking | done | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const canLookup = street.trim() && ((city.trim() && state) || zip.trim()) && phase !== "looking";

  async function lookup() {
    if (!canLookup) return;
    setPhase("looking"); setError(null); setResult(null);
    try {
      const data = await censusGeocode({ street, city, state, zip });
      const parsed = parseDistrict(data);
      if (!parsed) {
        setError("We couldn't match that address. Double-check the street and ZIP, then try again.");
        setPhase("error");
        return;
      }
      setResult(parsed);
      setPhase("done");
      onResolved && onResolved(parsed);
    } catch {
      setError("The address lookup service didn't respond. Please try again in a moment.");
      setPhase("error");
    }
  }

  return (
    <div style={{ fontFamily:serif, color:C.ink, background:C.parchment, border:`1px solid ${C.line}`,
                  borderRadius:6, overflow:"hidden", maxWidth:680, margin:"0 auto" }}>
      <StarStrip />
      <div style={{ padding:"20px 24px 24px" }}>
        <div style={{ textTransform:"uppercase", letterSpacing:2, fontSize:11, color:C.gold, fontWeight:700 }}>
          Step 1 · Confirm Your District
        </div>
        <h2 style={{ margin:"4px 0 2px", fontSize:22, color:C.navy }}>Enter your home address</h2>
        <p style={{ margin:0, fontSize:13, color:C.muted }}>
          Your congressional district is set by your exact address, not your city — so we use it to
          assign the right bills. We look up the district only; we don't store your street address.
        </p>

        <div style={{ marginTop:16, display:"grid", gap:10 }}>
          <Field label="STREET ADDRESS">
            <input value={street} onChange={e=>setStreet(e.target.value)} placeholder="123 Main St"
              style={inp} />
          </Field>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
            <Field label="CITY" grow>
              <input value={city} onChange={e=>setCity(e.target.value)} placeholder="Loveland" style={inp} />
            </Field>
            <Field label="STATE">
              <select value={state} onChange={e=>setState(e.target.value)} style={{ ...inp, width:90 }}>
                <option value="">—</option>
                {STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="ZIP">
              <input value={zip} onChange={e=>setZip(e.target.value.replace(/\D/g,"").slice(0,5))}
                placeholder="80538" inputMode="numeric" style={{ ...inp, width:110 }} />
            </Field>
          </div>
        </div>

        <button onClick={lookup} disabled={!canLookup}
          style={{ marginTop:16, width:"100%", padding:"12px", fontFamily:serif, fontSize:16, fontWeight:700,
                   borderRadius:4, border:"none", cursor: canLookup ? "pointer":"not-allowed",
                   background: canLookup ? C.navy : "#9aa0ad", color:"#fff", letterSpacing:0.5 }}>
          {phase === "looking" ? "Looking up your district…" : "Find My District"}
        </button>

        {error && (
          <div style={{ marginTop:12, padding:"10px 12px", borderRadius:4, background:"#FBE9E7",
                        color:C.crimson, fontSize:13, border:`1px solid ${C.crimson}` }}>
            {error}
          </div>
        )}

        {phase === "done" && result && (
          <div style={{ marginTop:14, padding:"14px 16px", background:"#fff", border:`1px solid ${C.line}`,
                        borderRadius:4 }}>
            <div style={{ fontSize:12, color:C.muted }}>{result.matchedAddress}</div>
            <div style={{ fontSize:20, fontWeight:700, color:C.crimson, marginTop:4 }}>
              {result.atLarge ? `${result.state} · At-Large District` : `District ${result.district}`}
            </div>
            <div style={{ fontSize:12.5, color:C.muted, marginTop:4 }}>
              Confirmed by the U.S. Census Bureau. Bills below are assigned to this district.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const inp = { padding:"9px 11px", width:"100%", boxSizing:"border-box", fontFamily:serif, fontSize:14,
  border:`1px solid ${C.line}`, borderRadius:4, background:"#fff" };
const Field = ({ label, grow, children }) => (
  <div style={{ flex: grow ? "1 1 160px" : "0 0 auto" }}>
    <label style={{ fontSize:11, fontWeight:700, color:C.navy, display:"block", marginBottom:4 }}>{label}</label>
    {children}
  </div>
);
const StarStrip = () => (
  <div style={{ background:C.navy, padding:"6px 0", display:"flex", justifyContent:"center", gap:9 }}>
    {Array.from({length:13}).map((_,i)=><span key={i} style={{color:C.gold, fontSize:11}}>★</span>)}
  </div>
);
