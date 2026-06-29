// =============================================================================
// AddressLookup — Census geocoder + ZIP fallback via /api/geocode
// =============================================================================
import React, { useState } from "react";

const C = { crimson:"#8B0000", navy:"#0A1A3F", gold:"#C9A227", parchment:"#FBF7EC",
  parchmentEdge:"#F0E6CE", ink:"#1A1A1A", muted:"#5C5347", line:"#D8C9A0" };
const serif = "Georgia, 'Times New Roman', serif";

const STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND",
  "OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

async function geocodeViaBackend(street, city, state, zip) {
  const clean = street.replace(/\.$/,"").replace(/\b(apt|unit|ste|suite|#)\s*[\w-]+/gi,"").trim();
  const p = new URLSearchParams({ street: clean });
  if (city) p.set("city", city.trim());
  if (state) p.set("state", state);
  if (zip) p.set("zip", zip.trim());
  const r = await fetch("/api/geocode?" + p.toString());
  if (!r.ok) throw new Error("api_error");
  return r.json();
}

export default function AddressLookup({ onResolved }) {
  const [street, setStreet] = useState("");
  const [city, setCity]     = useState("");
  const [state, setState]   = useState("");
  const [zip, setZip]       = useState("");
  const [phase, setPhase]   = useState("idle");
  const [result, setResult] = useState(null);
  const [error, setError]   = useState(null);
  const [approx, setApprox] = useState(false);

  const canGo = street.trim() && ((city.trim() && state) || zip.trim()) && phase !== "looking";

  async function lookup() {
    if (!canGo) return;
    setPhase("looking"); setError(null); setResult(null); setApprox(false);
    try {
      const data = await geocodeViaBackend(street, city, state, zip);
      if (!data.ok) {
        setError("Address not found. Try spelling out the street type (Drive not Dr) and include your ZIP.");
        setPhase("error");
        return;
      }
      setResult(data);
      setApprox(!!data.approximate);
      setPhase("done");
      onResolved && onResolved(data);
    } catch {
      setError("Connection error. Please try again.");
      setPhase("error");
    }
  }

  function onKey(e) { if (e.key === "Enter" && canGo) lookup(); }

  return (
    <div style={{ fontFamily:serif, color:C.ink, background:C.parchment,
                  border:"1px solid "+C.line, borderRadius:6, overflow:"hidden",
                  maxWidth:680, margin:"0 auto" }}>
      <Stars />
      <div style={{ padding:"20px 24px 24px" }}>
        <div style={{ textTransform:"uppercase", letterSpacing:2, fontSize:11, color:C.gold, fontWeight:700 }}>
          Step 1 - Confirm Your District
        </div>
        <h2 style={{ margin:"4px 0 2px", fontSize:22, color:C.navy }}>Enter your home address</h2>
        <p style={{ margin:0, fontSize:13, color:C.muted }}>
          Your congressional district is set by your exact address. We look up the district only — we never store your address.
        </p>
        <div style={{ marginTop:16, display:"grid", gap:10 }}>
          <div>
            <label style={lbl}>STREET ADDRESS</label>
            <input value={street} onChange={e=>setStreet(e.target.value)} onKeyDown={onKey}
              placeholder="1011 Valley Drive" autoComplete="street-address" style={inp} />
          </div>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
            <div style={{ flex:"1 1 160px" }}>
              <label style={lbl}>CITY</label>
              <input value={city} onChange={e=>setCity(e.target.value)} onKeyDown={onKey}
                placeholder="Windsor" autoComplete="address-level2" style={inp} />
            </div>
            <div style={{ flex:"0 0 auto" }}>
              <label style={lbl}>STATE</label>
              <select value={state} onChange={e=>setState(e.target.value)}
                style={{ ...inp, width:90 }}>
                <option value="">-</option>
                {STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ flex:"0 0 auto" }}>
              <label style={lbl}>ZIP</label>
              <input value={zip} onChange={e=>setZip(e.target.value.replace(/\D/g,"").slice(0,5))}
                onKeyDown={onKey} placeholder="80550" inputMode="numeric"
                autoComplete="postal-code" style={{ ...inp, width:110 }} />
            </div>
          </div>
        </div>
        <p style={{ margin:"8px 0 0", fontSize:12, color:C.muted }}>
          Tip: ZIP code gives the most reliable results.
        </p>
        <button onClick={lookup} disabled={!canGo}
          style={{ marginTop:12, width:"100%", padding:"14px", fontFamily:serif,
                   fontSize:16, fontWeight:700, borderRadius:4, border:"none",
                   cursor:canGo?"pointer":"not-allowed",
                   background:canGo?C.navy:"#9aa0ad", color:"#fff" }}>
          {phase === "looking" ? "Looking up your district..." : "Find My District"}
        </button>
        {phase === "looking" && (
          <p style={{ margin:"8px 0 0", fontSize:12.5, color:C.muted, textAlign:"center" }}>
            Trying multiple address formats automatically...
          </p>
        )}
        {error && (
          <div style={{ marginTop:12, padding:"12px 14px", borderRadius:4,
                        background:"#FBE9E7", color:C.crimson, fontSize:13.5,
                        border:"1px solid "+C.crimson, lineHeight:1.5 }}>
            <strong>Could not find that address.</strong><br/>
            Try spelling out the full street type (Drive, Street, Avenue) and make sure your ZIP is included.
          </div>
        )}
        {phase === "done" && result && (
          <div style={{ marginTop:14, padding:"14px 16px", background:"#fff",
                        border:"1px solid "+C.line, borderRadius:4 }}>
            <div style={{ fontSize:12, color:C.muted }}>{result.matchedAddress}</div>
            <div style={{ fontSize:20, fontWeight:700, color:C.crimson, marginTop:4 }}>
              {result.atLarge ? result.state+" - At-Large" : "District "+result.district}
            </div>
            {approx ? (
              <div style={{ marginTop:6, padding:"8px 10px", background:"#FFF8E1",
                            borderRadius:4, border:"1px solid #F9A825", fontSize:12.5, color:"#5C4400" }}>
                District assigned from your ZIP code. Accurate for most addresses in this ZIP.
              </div>
            ) : (
              <div style={{ fontSize:12.5, color:C.muted, marginTop:4 }}>
                Confirmed via U.S. Census Bureau.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const inp = { padding:"9px 11px", width:"100%", boxSizing:"border-box",
  fontFamily:serif, fontSize:14, border:"1px solid #D8C9A0", borderRadius:4, background:"#fff" };
const lbl = { fontSize:11, fontWeight:700, color:"#0A1A3F", display:"block", marginBottom:4 };
const Stars = () => (
  <div style={{ background:"#0A1A3F", padding:"6px 0", display:"flex", justifyContent:"center", gap:9 }}>
    {Array.from({length:13}).map((_,i) => <span key={i} style={{ color:"#C9A227", fontSize:11 }}>*</span>)}
  </div>
);
