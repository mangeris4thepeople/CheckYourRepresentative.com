// =============================================================================
// LandingNav.jsx - the header for the /welcome campaign page. October 2026
// revamp: the same light glass top bar as the app shell and content pages
// (flag line, seal, display wordmark, pill links, gradient call to action).
// On phones the links sit in a swipeable pill row under the wordmark.
// House style: no em dashes.
// =============================================================================
import React from "react";

const ITEMS = [
  { key: "about",    label: "What We Stand For" },
  { key: "benefits", label: "How This Benefits You And The Country" },
  { key: "tutorial", label: "Site Tutorial" },
];

export default function LandingNav({ active, onNavigate, onEnter }) {
  return (
    <header className="cyr-topbar" style={{ zIndex: 100 }}>
      <div className="cyr-flagline" />
      <div className="cyr-header-inner">
        <button className="cyr-brand" onClick={() => onNavigate?.("landing")} aria-label="Check Your Representative, campaign home">
          <img className="cyr-seal" src="/icons/mark-96.png" alt="" />
          <span style={{ minWidth: 0 }}>
            <span className="cyr-site-title" style={{ display: "block" }}>Check Your Representative</span>
            <span className="cyr-tagline"><span className="cyr-live-dot" />Non-partisan. Not for sale.</span>
          </span>
        </button>
        <nav className="cyr-hide-sm" style={{ display: "flex", gap: 4, minWidth: 0, overflowX: "auto", scrollbarWidth: "none" }}>
          {ITEMS.map(item => (
            <button key={item.key} className="cyr-tab" aria-current={active === item.key ? "page" : undefined}
              onClick={() => onNavigate?.(item.key)}>{item.label}</button>
          ))}
        </nav>
        <button className="cyr-btn cyr-btn-primary" onClick={onEnter} style={{ flexShrink: 0 }}>
          Enter the tool <span aria-hidden>→</span>
        </button>
      </div>
      <nav className="cyr-nav cyr-landing-nav-sm" aria-label="Site pages">
        {ITEMS.map(item => (
          <button key={item.key} className="cyr-tab" aria-current={active === item.key ? "page" : undefined}
            onClick={() => onNavigate?.(item.key)}>{item.label}</button>
        ))}
      </nav>
      <style>{`
        .cyr-landing-nav-sm { display: none; }
        @media (max-width: 640px) { .cyr-landing-nav-sm { display: flex; } }
      `}</style>
    </header>
  );
}
