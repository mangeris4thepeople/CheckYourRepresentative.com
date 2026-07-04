// =============================================================================
// ExplainerBanner.jsx - the dismissible "What is this?" strip above the hero.
//
// Dismissal is per browser session (sessionStorage), so it comes back on a
// fresh visit but stays hidden while the visitor is looking around. Kept
// compact so it does not push the hero down more than about one line on mobile.
// =============================================================================
import React, { useState, useEffect } from "react";
import { C, bebas, serif, mono } from "./theme.js";
import { BANNER } from "../../content/siteCopy.js";

const KEY = "cyr_banner_dismissed";

export default function ExplainerBanner({ onLearnMore }) {
  const [hidden, setHidden] = useState(() => {
    try { return sessionStorage.getItem(KEY) === "1"; } catch { return false; }
  });
  // On phones the full body would push the hero down several lines, so there
  // we show just the headline and the learn-more link (which opens the full
  // explanation), keeping the strip to about one line.
  const [isNarrow, setIsNarrow] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false);

  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (hidden) return null;

  function dismiss() {
    try { sessionStorage.setItem(KEY, "1"); } catch {}
    setHidden(true);
  }

  return (
    <div style={{ background: C.navy, color: "#fff", borderBottom: `2px solid ${C.gold}`,
                  padding: "10px 44px 10px 20px", position: "relative" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", alignItems: "baseline",
                    gap: 10, flexWrap: "wrap", justifyContent: "center", textAlign: "center" }}>
        <span style={{ fontFamily: bebas, fontSize: 16, letterSpacing: 1.5, color: C.gold, flexShrink: 0 }}>
          {BANNER.headline}
        </span>
        {!isNarrow && (
          <span style={{ fontFamily: serif, fontSize: 13.5, lineHeight: 1.5, color: "#e8ecf5" }}>
            {BANNER.body}
          </span>
        )}
        <button onClick={onLearnMore}
          style={{ fontFamily: mono, fontSize: 11, letterSpacing: 1, textTransform: "uppercase",
                   background: "none", border: "none", color: C.gold, cursor: "pointer",
                   textDecoration: "underline", flexShrink: 0, padding: 0 }}>
          {BANNER.learnMore} →
        </button>
      </div>
      <button onClick={dismiss} aria-label="Dismiss"
        style={{ position: "absolute", top: 8, right: 12, background: "none", border: "none",
                 color: "#cfd6e4", cursor: "pointer", fontSize: 20, lineHeight: 1, padding: 4 }}>
        ×
      </button>
    </div>
  );
}
