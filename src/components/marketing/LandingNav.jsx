// =============================================================================
// LandingNav.jsx - the shared pre-tool header, used by both the landing page
// and every landing-adjacent content page (What We Stand For, How This
// Benefits You, Site Tutorial, Privacy). Sharing one component keeps those
// headers identical.
//
// No icon graphic, just the wordmark. On phones the four items stack centered
// below the site name instead of wrapping awkwardly across the top.
// =============================================================================
import React, { useState, useEffect } from "react";
import { C, bebas, mono } from "./theme.js";

const ITEMS = [
  { key: "about",    label: "What We Stand For" },
  { key: "benefits", label: "How This Benefits You And The Country" },
  { key: "tutorial", label: "Site Tutorial" },
];

export default function LandingNav({ active, onNavigate, onEnter }) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const wordmark = (
    <button onClick={() => onNavigate?.("landing")}
      style={{ background: "none", border: "none", cursor: "pointer", padding: 0,
               fontFamily: bebas, fontSize: isMobile ? 18 : 20, letterSpacing: 2, color: C.gold }}>
      CheckYourRepresentative.com
    </button>
  );

  const navItems = ITEMS.map(item => (
    <button key={item.key} onClick={() => onNavigate?.(item.key)}
      style={{ fontFamily: mono, fontSize: 11, letterSpacing: 1, textTransform: "uppercase",
               background: "none", border: "none", cursor: "pointer", padding: "6px 6px",
               borderBottom: `2px solid ${active === item.key ? C.gold : "transparent"}`,
               color: active === item.key ? C.gold : "#bbb" }}>
      {item.label}
    </button>
  ));

  const enterBtn = (
    <button onClick={onEnter}
      style={{ fontFamily: bebas, fontSize: isMobile ? 14 : 15, letterSpacing: 2,
               background: C.crimson, color: C.white, border: "none",
               padding: isMobile ? "8px 22px" : "8px 22px", borderRadius: 2, cursor: "pointer" }}>
      ENTER THE TOOL →
    </button>
  );

  const shell = {
    position: "sticky", top: 0, zIndex: 100,
    background: "rgba(13,13,13,0.97)", backdropFilter: "blur(8px)",
    borderBottom: `2px solid ${C.gold}`,
  };

  if (isMobile) {
    return (
      <nav style={{ ...shell, padding: "12px 16px", display: "flex", flexDirection: "column",
                    alignItems: "center", gap: 10 }}>
        {wordmark}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          {navItems}
          {enterBtn}
        </div>
      </nav>
    );
  }

  return (
    <nav style={{ ...shell, padding: "10px 20px", display: "flex", alignItems: "center",
                  justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
      {wordmark}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
        {navItems}
        {enterBtn}
      </div>
    </nav>
  );
}
