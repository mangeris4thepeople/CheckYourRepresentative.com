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
import LandingNav from "./LandingNav.jsx";
import ContactUsForm from "../ContactUsForm.jsx";

const FOOTER_LINKS = [
  { key: "about",      label: "What We Stand For" },
  { key: "benefits",   label: "How This Benefits You And The Country" },
  { key: "tutorial",   label: "Site Tutorial" },
  { key: "howitworks", label: "How It Works" },
  { key: "privacy",    label: "Privacy" },
];

export default function MarketingPage({ active, onNavigate, onEnter, children }) {
  return (
    <div style={{ fontFamily: serif, background: C.white, color: C.black, minHeight: "100vh" }}>

      {/* Shared pre-tool header, identical to the landing page */}
      <LandingNav active={active} onNavigate={onNavigate} onEnter={onEnter} />

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
      <div style={{ background: C.black, borderTop: `3px solid ${C.gold}`, padding: "32px 20px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", flexWrap: "wrap",
                      gap: 28, justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 300px", textAlign: "left" }}>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
              {FOOTER_LINKS.map(item => (
                <button key={item.key} onClick={() => onNavigate(item.key)}
                  style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: C.gold, background: "none",
                           border: "none", cursor: "pointer", letterSpacing: 1, padding: 0 }}>
                  {item.label}
                </button>
              ))}
            </div>
            <div style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: "#cfcfcf", lineHeight: 1.8 }}>
              Non-partisan voter education · Bill data from Congress.gov · 119th Congress<br />
              Paid for by We The People Inc. · Not affiliated with any political party
            </div>
          </div>
          <div style={{ flex: "1 1 340px" }}>
            <ContactUsForm />
          </div>
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
