// =============================================================================
// Check Your Representative — Address → Congressional District lookup
// -----------------------------------------------------------------------------
// Uses /api/geocode.js backend which:
//   1. Tries Census onelineaddress (more forgiving than parsed endpoint)
//   2. Auto-expands abbreviations (dr->Drive, st->Street, etc.) and retries
//   3. Retries with ZIP only (ignores city misspelling)
//   4. Falls back to Congress.gov ZIP-to-district if Census fails entirely
// onResolved({ district, districtCode, state, location, matchedAddress, coords })
// =============================================================================
import React, { useState } from "react";

const C = { crimson:"#8B0000", navy:"#0A1A3F", gold:"#C9A227", parchment:"#FBF7EC",
  parchmentEdge:"#F0E6CE", ink:"#1A1A1A", muted:"#5C5347", line:"#D8C9A0" };
const serif = "Georgia, 'Times New Roman', serif";

const STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND",
  "OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

// Mobile CSS
const ADDR_CSS = `
  @media (max-width: 600px) {
    .cyr-addr-pad { padding: 16px 14px 18px !important; }
    .cyr-addr-h2 { font-size: 18px !important; }
    .cyr-addr-row { flex-direction: column !important; }
    .cyr-state-field, .cyr-zip-field { flex: 1 1 100% !important; }
    .cyr-state-select { width: 100% !important; }
    .cyr-zip-input { width: 100% !important; }
  }
`;
if (typeof document !== "undefined" && !document.getElementById("cyr-addr-css")) {
  const s = document.createElement("style");
  s.id = "cyr-addr-css";
  s.textContent = ADDR_CSS;
  document.head.appendChild(s);
}

async function geocodeAddress({ street, city, state, zip }) {
  // Clean the street: strip apartment/unit info, trailing periods
  const cleanStreet = street
    .replace(/\b(apt|apartment|unit|ste|suite|#)\s*[\w-]+/gi, "")
    .replace(/\.$/, "")
    .trim();

  const params = new URLSearchParams({ street: cleanStreet });
  if (city) params.set("city", city.trim());
  if (state) params.set("state", state);
  if (zip) params.set("zip", zip.trim());

  const res = await fetch(`/api/geocode?${params}`);
  if (!res.ok) throw new Error("server_error");
  return res.json();
}

export default function AddressLookup({ onResolved }) {
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [phase, setPhase] = useState("idle"); // idle | looking | done | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [isApprox, setIsApprox] = useState(false);

  const canLookup = street.trim() && ((city.trim() && state) || zip.trim()) && phase !== "looking";

  async function lookup() {
    if (!canLookup) return;
    setPhase("looking"); setError(null); setResult(null); setIsApprox(false);
    try {
      const data = await geocodeAddress({ street, city, state, zip });

      if (!data.ok) {
        // Give specific, actionable error based on what they entered
        const tips = [];
        if (!zip) tips.push("add your ZIP code");
        tips.push("check street name spelling");
        tips.push("try abbreviating: "St" not "Street"");
        setError(`Address not found. Try: ${tips.join(" · ")}`);
        setPhase("error");
        return;
      }

      setResult(data);
      setIsApprox(!!data.approximate);
      setPhase("done");
      onResolved && onResolved(data);
    } catch {
      setError("Connection error — please try again in a moment.");
      setPhase("error");
    }
  }

  function handleKey(e) {
    if (e.key === "Enter" && canLookup) lookup();
  }

  return (
    <div style={{ fontFamily:serif, color:C.ink, background:C.parchment, border:`1px solid ${C.line}`,
                  borderRadius:6, overflow:"hidden", maxWidth:680, margin:"0 auto" }}>
      <StarStrip />
      <div className="cyr-addr-pad" style={{ padding:"20px 24px 24px" }}>
        <div style={{ textTransform:"uppercase", letterSpacing:2, fontSize:11, color:C.gold, fontWeight:700 }}>
          Step 1 · Confirm Your District
        </div>
        <h2 className="cyr-addr-h2" style={{ margin:"4px 0 2px", fontSize:22, color:C.navy }}>Enter your home address</h2>
        <p style={{ margin:0, fontSize:13, color:C.muted }}>
          Your congressional district is set by your exact address, not your city. We look up the district only — we never store your address.
        </p>

        <div style={{ marginTop:16, display:"grid", gap:10 }}>
          <Field label="STREET ADDRESS">
            <input value={street} onChange={e=>setStreet(e.target.value)} onKeyDown={handleKey}
              placeholder="1011 Valley Dr" autoComplete="street-address" style={inp} />
          </Field>
          <div className="cyr-addr-row" style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
            <Field label="CITY" grow>
              <input value={city} onChange={e=>setCity(e.target.value)} onKeyDown={handleKey}
                placeholder="Windsor" autoComplete="address-level2" style={inp} />
            </Field>
            <Field label="STATE" className="cyr-state-field">
              <select value={state} onChange={e=>setState(e.target.value)} className="cyr-state-select"
                style={{ ...inp, width:90 }}>
                <option value="">—</option>
                {STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="ZIP" className="cyr-zip-field">
              <input value={zip} onChange={e=>setZip(e.target.value.replace(/\D/g,"").slice(0,5))}
                onKeyDown={handleKey} placeholder="80550" inputMode="numeric" autoComplete="postal-code"
                className="cyr-zip-input" style={{ ...inp, width:110 }} />
            </Field>
          </div>
        </div>

        {/* Tip: ZIP is the most reliable field */}
        <p style={{ margin:"8px 0 0", fontSize:12, color:C.muted }}>
          💡 Including your ZIP code gives the best results.
        </p>

        <button onClick={lookup} disabled={!canLookup}
          style={{ marginTop:12, width:"100%", padding:"14px", fontFamily:serif, fontSize:16, fontWeight:700,
                   borderRadius:4, border:"none", cursor: canLookup ? "pointer":"not-allowed",
                   background: canLookup ? C.navy : "#9aa0ad", color:"#fff", letterSpacing:0.5,
                   touchAction:"manipulation" }}>
          {phase === "looking" ? "Looking up your district…" : "Find My District →"}
        </button>

        {phase === "looking" && (
          <div style={{ marginTop:10, fontSize:12.5, color:C.muted, textAlign:"center" }}>
            Checking address formats &amp; fallbacks automatically…
          </div>
        )}

        {error && (
          <div style={{ marginTop:12, padding:"12px 14px", borderRadius:4, background:"#FBE9E7",
                        color:C.crimson, fontSize:13.5, border:`1px solid ${C.crimson}`, lineHeight:1.5 }}>
            <strong>Couldn't find that address.</strong><br />
            Try: spell out the street type <em>(Drive not Dr)</em> · add your ZIP · double-check the street number.
          </div>
        )}

        {phase === "done" && result && (
          <div style={{ marginTop:14, padding:"14px 16px", background:"#fff", border:`1px solid ${C.line}`,
                        borderRadius:4 }}>
            <div style={{ fontSize:12, color:C.muted }}>{result.matchedAddress}</div>
            <div style={{ fontSize:20, fontWeight:700, color:C.crimson, marginTop:4 }}>
              {result.atLarge ? `${result.state} · At-Large District` : `District ${result.district}`}
            </div>
            {isApprox ? (
              <div style={{ marginTop:6, padding:"8px 10px", background:"#FFF8E1", borderRadius:4,
                            border:"1px solid #F9A825", fontSize:12.5, color:"#5C4400" }}>
                ⚠ Exact street not found — district assigned from your ZIP code. Should be correct for most addresses.
              </div>
            ) : (
              <div style={{ fontSize:12.5, color:C.muted, marginTop:4 }}>
                Confirmed by the U.S. Census Bureau.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const inp = { padding:"9px 11px", width:"100%", boxSizing:"border-box", fontFamily:serif, fontSize:14,
  border:`1px solid ${C.line}`, borderRadius:4, background:"#fff" };
const Field = ({ label, grow, className, children }) => (
  <div className={className || ""} style={{ flex: grow ? "1 1 160px" : "0 0 auto" }}>
    <label style={{ fontSize:11, fontWeight:700, color:C.navy, display:"block", marginBottom:4 }}>{label}</label>
    {children}
  </div>
);
const StarStrip = () => (
  <div style={{ background:C.navy, padding:"6px 0", display:"flex", justifyContent:"center", gap:9 }}>
    {Array.from({length:13}).map((_,i)=><span key={i} style={{color:C.gold, fontSize:11}}>★</span>)}
  </div>
);
