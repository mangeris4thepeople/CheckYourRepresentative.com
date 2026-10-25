import React, { useState } from "react";

// District finder card (October 2026 look): soft card, sentence case labels,
// roomy fields, gradient primary button, friendly success and error states.
const C = { red:"#E0313F", navy:"#0E2A6B", blue:"#2563EB", ink:"#0F172A", muted:"#5B6578", line:"#E2E8F0" };
const sans = "var(--cyr-sans)";
const STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND",
  "OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

const SCOPED_CSS = `
  .cyr-al-row { display: grid; grid-template-columns: minmax(0, 1fr) 96px 116px; gap: 10px; }
  @media (max-width: 560px) {
    .cyr-al-row { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
    .cyr-al-row > :first-child { grid-column: 1 / -1; }
    .cyr-al-pad { padding: 18px 16px 18px !important; }
  }
`;

export default function AddressLookup({ onResolved }) {
  const [street, setStreet] = useState("");
  const [city, setCity]     = useState("");
  const [state, setState]   = useState("");
  const [zip, setZip]       = useState("");
  const [phase, setPhase]   = useState("idle");
  const [result, setResult] = useState(null);
  const [error, setError]   = useState(null);

  const canGo = street.trim() && ((city.trim() && state) || zip.trim()) && phase !== "looking";

  async function lookup() {
    if (!canGo) return;
    setPhase("looking"); setError(null); setResult(null);
    try {
      const p = new URLSearchParams({ street: street.replace(/\.$/,"").trim() });
      if (city)  p.set("city", city.trim());
      if (state) p.set("state", state);
      if (zip)   p.set("zip", zip.trim());
      const r = await fetch("/api/geocode?" + p.toString());
      if (!r.ok) throw new Error("server");
      const data = await r.json();
      if (!data.ok) {
        setError("not_found");
        setPhase("error");
        return;
      }
      setResult(data);
      setPhase("done");
      onResolved && onResolved(data);
    } catch {
      setError("connection");
      setPhase("error");
    }
  }

  function onKey(e) { if (e.key === "Enter" && canGo) lookup(); }

  return (
    <div className="cyr-card" style={{ fontFamily:sans, color:C.ink,
                  borderRadius:20, overflow:"hidden", maxWidth:"100%", margin:"0 auto" }}>
      <style>{SCOPED_CSS}</style>
      <div className="cyr-al-pad" style={{ padding:"20px 22px 22px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <span aria-hidden style={{ width:42, height:42, borderRadius:14, background:"#E8F0FF", color:C.blue, flexShrink:0,
                                     display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>📍</span>
          <div style={{ minWidth:0 }}>
            <div className="cyr-eyebrow" style={{ fontSize:11 }}>Step 1: Confirm your district</div>
            <h2 className="cyr-h2" style={{ margin:"2px 0 0", fontSize:21 }}>Enter your home address</h2>
          </div>
        </div>
        <p style={{ margin:"10px 0 0", fontSize:14, color:C.muted, lineHeight:1.6 }}>
          Your congressional district is determined by your exact street address.
          We look up the district only and never store your address.
        </p>
        <div style={{ marginTop:16, display:"grid", gap:10 }}>
          <div>
            <label style={lbl}>Street address</label>
            <input value={street} onChange={e=>setStreet(e.target.value)} onKeyDown={onKey}
              placeholder="123 Main Street" autoComplete="street-address" style={inp} />
          </div>
          <div className="cyr-al-row">
            <div style={{ minWidth:0 }}>
              <label style={lbl}>City</label>
              <input value={city} onChange={e=>setCity(e.target.value)} onKeyDown={onKey}
                placeholder="Your city" autoComplete="address-level2" style={inp} />
            </div>
            <div style={{ minWidth:0 }}>
              <label style={lbl}>State</label>
              <select value={state} onChange={e=>setState(e.target.value)} style={inp}>
                <option value="">-</option>
                {STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ minWidth:0 }}>
              <label style={lbl}>ZIP</label>
              <input value={zip} onChange={e=>setZip(e.target.value.replace(/\D/g,"").slice(0,5))}
                onKeyDown={onKey} placeholder="ZIP" inputMode="numeric"
                autoComplete="postal-code" style={inp} />
            </div>
          </div>
        </div>
        <button onClick={lookup} disabled={!canGo} className="cyr-btn cyr-btn-primary"
          style={{ marginTop:16, width:"100%", justifyContent:"center", minHeight:50, fontSize:16,
                   opacity: canGo ? 1 : 0.55, cursor: canGo ? "pointer" : "not-allowed" }}>
          {phase === "looking" ? "Looking up your district..." : <>Find my district <span aria-hidden>→</span></>}
        </button>
        {phase === "looking" && (
          <p style={{ margin:"8px 0 0", fontSize:13, color:C.muted, textAlign:"center" }}>
            Trying multiple address formats...
          </p>
        )}
        {phase === "error" && (
          <div style={{ marginTop:12, padding:"12px 14px", borderRadius:14,
                        background:"#FEF2F2", color:"#991B1B", fontSize:14,
                        border:"1px solid #FECACA", lineHeight:1.6 }}>
            {error === "not_found" ? (
              <>
                <strong>Address not found in the Census database.</strong><br/>
                Try spelling out the full street type: <em>Drive</em> instead of Dr,
                <em> Street</em> instead of St. Make sure your ZIP is included.
                If it still fails, use the map below to find your state and county.
              </>
            ) : (
              <strong>Connection error. Please try again.</strong>
            )}
          </div>
        )}
        {phase === "done" && result && (
          <div className="cyr-rise" style={{ marginTop:14, padding:"14px 16px", background:"#fff",
                        border:"1px solid #BBF7D0", borderRadius:16, display:"flex", gap:12, alignItems:"center" }}>
            <span aria-hidden style={{ width:44, height:44, borderRadius:99, background:"#16A34A", color:"#fff", flexShrink:0,
                                       display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:20, fontWeight:900 }}>✓</span>
            <div style={{ minWidth:0 }}>
              <div style={{ fontSize:12.5, color:C.muted, overflowWrap:"anywhere" }}>{result.matchedAddress}</div>
              <div className="cyr-num" style={{ fontSize:24, color:C.red, marginTop:2 }}>
                {result.atLarge ? result.state+" - At-Large District" : "District "+result.district}
              </div>
              <div style={{ fontSize:13, color:C.muted, marginTop:2 }}>
                Confirmed by the U.S. Census Bureau.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const inp = { padding:"11px 13px", width:"100%", boxSizing:"border-box", minHeight:46,
  fontFamily:sans, fontSize:15, border:"1px solid #D5DDEA", borderRadius:12, background:"#fff" };
const lbl = { fontSize:13, fontWeight:700, color:"#0F172A", display:"block", marginBottom:5 };
