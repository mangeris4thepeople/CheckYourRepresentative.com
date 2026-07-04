// =============================================================================
// MarketingPage.jsx - shared chrome for the pre-tool content pages (About,
// How This Benefits, Site Tutorial, How It Works, Privacy Commitment).
//
// The app has no router, so these are state-driven views. This component gives
// each one the same top nav (the four landing items plus Home) and the same
// footer (with the Privacy link), so navigation between them is consistent.
// =============================================================================
import React from "react";
import { C, bebas, serif, mono } from "./theme.js";

const NAV_ITEMS = [
  { key: "about",      label: "What We Are About" },
  { key: "benefits",   label: "How This Benefits You And The Country" },
  { key: "tutorial",   label: "Site Tutorial" },
];

function Seal({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 52 52" aria-hidden="true">
      <circle cx="26" cy="26" r="24" fill="none" stroke={C.gold} strokeWidth="1.5" />
      <circle cx="26" cy="26" r="19" fill={C.crimson} opacity="0.15" />
      <text x="26" y="32" textAnchor="middle" fontFamily={bebas} fontSize="16" fontWeight="700" fill={C.gold} letterSpacing="1">CYR</text>
    </svg>
  );
}

export default function MarketingPage({ active, onNavigate, onEnter, children }) {
  return (
    <div style={{ fontFamily: serif, background: C.white, color: C.black, minHeight: "100vh" }}>

      {/* Top nav */}
      <div style={{ background: C.black, borderBottom: `3px solid ${C.gold}` }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", padding: "12px 20px",
                      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <button onClick={() => onNavigate("landing")}
            style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer" }}>
            <Seal size={30} />
            <span style={{ fontFamily: bebas, fontSize: 18, letterSpacing: 2, color: C.gold }}>CheckYourRepresentative.com</span>
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {NAV_ITEMS.map(item => (
              <button key={item.key} onClick={() => onNavigate(item.key)}
                style={{ fontFamily: mono, fontSize: 11, letterSpacing: 1, textTransform: "uppercase",
                         background: "none", border: "none", cursor: "pointer",
                         padding: "6px 8px", borderBottom: `2px solid ${active === item.key ? C.gold : "transparent"}`,
                         color: active === item.key ? C.gold : "#bbb" }}>
                {item.label}
              </button>
            ))}
            <button onClick={onEnter}
              style={{ fontFamily: bebas, fontSize: 14, letterSpacing: 2, background: C.crimson, color: C.white,
                       border: "none", padding: "8px 18px", borderRadius: 2, cursor: "pointer" }}>
              ENTER THE TOOL →
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px 64px" }}>
        {children}

        <div style={{ marginTop: 48, textAlign: "center" }}>
          <button onClick={onEnter}
            style={{ fontFamily: bebas, fontSize: 20, letterSpacing: 3, background: C.black, color: C.gold,
                     border: `2px solid ${C.gold}`, padding: "14px 40px", borderRadius: 2, cursor: "pointer" }}>
            ENTER THE TOOL →
          </button>
        </div>
      </div>

      {/* Footer */}
      <div style={{ background: C.black, borderTop: `3px solid ${C.gold}`, padding: "28px 20px", textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", gap: 18, flexWrap: "wrap", marginBottom: 14 }}>
          {NAV_ITEMS.map(item => (
            <button key={item.key} onClick={() => onNavigate(item.key)}
              style={{ fontFamily: mono, fontSize: 11, color: "#888", background: "none", border: "none", cursor: "pointer", letterSpacing: 1 }}>
              {item.label}
            </button>
          ))}
          <button onClick={() => onNavigate("howitworks")}
            style={{ fontFamily: mono, fontSize: 11, color: "#888", background: "none", border: "none", cursor: "pointer", letterSpacing: 1 }}>
            How It Works
          </button>
          <button onClick={() => onNavigate("privacy")}
            style={{ fontFamily: mono, fontSize: 11, color: "#888", background: "none", border: "none", cursor: "pointer", letterSpacing: 1 }}>
            Privacy
          </button>
        </div>
        <div style={{ fontFamily: mono, fontSize: 10, color: "#444", lineHeight: 1.8 }}>
          Non-partisan voter education · Bill data from Congress.gov · 119th Congress<br />
          Paid for by We The People Inc. · Not affiliated with any political party
        </div>
      </div>
    </div>
  );
}

// Shared heading used by the content pages.
export function PageHeading({ children }) {
  return (
    <h1 style={{ fontFamily: bebas, fontSize: "clamp(36px, 6vw, 56px)", letterSpacing: 2,
                 color: C.navy, lineHeight: 1.05, margin: "0 0 28px" }}>
      {children}
    </h1>
  );
}
