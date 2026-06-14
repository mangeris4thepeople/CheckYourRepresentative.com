// =============================================================================
// Check Your Representative — site shell / homepage
// Address-first: the congressional district comes from the voter's street
// address (Census geocoder), NOT from city/county, so assigned bills are right.
// =============================================================================
import React, { useState } from "react";
import AddressLookup from "./components/AddressLookup.jsx";
import ConstituentMap from "./components/ConstituentMap.jsx";
import ConstituentOnboarding from "./components/ConstituentOnboarding.jsx";
import ConstituentVoting from "./components/ConstituentVoting.jsx";

const C = { crimson:"#8B0000", crimsonBright:"#B22234", navy:"#0A1A3F", gold:"#C9A227",
  parchment:"#EFE7D2", panel:"#FBF7EC", ink:"#1A1A1A", muted:"#5C5347", line:"#D8C9A0" };
const serif = "Georgia, 'Times New Roman', serif";

const TABS = [
  { key: "district", label: "Find Your District" },
  { key: "vote", label: "Vote on Bills" },
];

export default function App() {
  const [tab, setTab] = useState("district");
  const [resolved, setResolved] = useState(null); // accurate district from address

  return (
    <div style={{ fontFamily: serif, color: C.ink, background: C.parchment, minHeight: "100vh" }}>
      <header style={{ background: C.navy, color: "#fff", borderBottom: `4px solid ${C.gold}` }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "18px 20px",
                      display: "flex", alignItems: "center", gap: 14 }}>
          <Seal />
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: 0.5 }}>Check Your Representative</div>
            <div style={{ fontSize: 12.5, color: C.gold, letterSpacing: 1 }}>
              KNOW THE BILLS · KNOW YOUR VOTE · HOLD THE LINE
            </div>
          </div>
        </div>
        <StarStrip />
      </header>

      <nav style={{ background: C.panel, borderBottom: `1px solid ${C.line}` }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 20px", display: "flex", gap: 4 }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ fontFamily: serif, fontSize: 15, padding: "13px 18px", cursor: "pointer",
                       border: "none", background: "transparent", fontWeight: 700,
                       color: tab === t.key ? C.crimson : C.muted,
                       borderBottom: `3px solid ${tab === t.key ? C.crimson : "transparent"}` }}>
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "24px 20px 60px" }}>
        {tab === "district" && (
          <>
            {/* Step 1: address -> accurate district */}
            <AddressLookup onResolved={setResolved} />

            {/* Step 2: only appears once the real district is confirmed */}
            {resolved ? (
              <div style={{ marginTop: 28 }}>
                <ConstituentOnboarding
                  location={resolved.location}
                  district={resolved.district}
                />
              </div>
            ) : (
              <p style={{ textAlign: "center", color: C.muted, fontStyle: "italic",
                          maxWidth: 680, margin: "18px auto 0", fontSize: 13.5 }}>
                Enter your address above to confirm your district — then choose the topics you want
                summaries for.
              </p>
            )}

            {/* Optional: browse the map (exploration only; does not set your district) */}
            <div style={{ marginTop: 40 }}>
              <div style={{ maxWidth: 1040, margin: "0 auto 10px", fontSize: 12, fontWeight: 700,
                            letterSpacing: 1, color: C.muted, textAlign: "center" }}>
                — OR EXPLORE THE MAP —
              </div>
              <ConstituentMap />
            </div>
          </>
        )}

        {tab === "vote" && (
          <ConstituentVoting
            district={resolved?.district}
            location={resolved?.location}
            onNeedDistrict={() => setTab("district")}
          />
        )}
      </main>

      <footer style={{ background: C.navy, color: "#cfd6e4", borderTop: `4px solid ${C.gold}` }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "22px 20px", fontSize: 12.5 }}>
          <div style={{ fontStyle: "italic", color: C.gold, marginBottom: 8 }}>
            "We the People..." — a tool for an informed electorate.
          </div>
          Check Your Representative · Non-partisan voter education · Bill data from Congress.gov.
          <div style={{ marginTop: 6, color: "#8b94a8" }}>
            Add your organization's mailing address here before sending any email digests.
          </div>
        </div>
      </footer>
    </div>
  );
}

function Seal() {
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" aria-hidden="true">
      <circle cx="26" cy="26" r="24" fill="#fff" stroke={C.gold} strokeWidth="2" />
      <circle cx="26" cy="26" r="19" fill={C.crimson} />
      <text x="26" y="33" textAnchor="middle" fontFamily={serif} fontSize="20" fontWeight="700" fill="#fff">CYR</text>
    </svg>
  );
}
function StarStrip() {
  return (
    <div style={{ background: C.crimson, padding: "5px 0", display: "flex", justifyContent: "center", gap: 10 }}>
      {Array.from({ length: 13 }).map((_, i) => <span key={i} style={{ color: C.gold, fontSize: 11 }}>★</span>)}
    </div>
  );
}
