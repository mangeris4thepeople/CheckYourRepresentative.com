// =============================================================================
// SiteTutorial.jsx - the full walkthrough. Fully rerendered for the October
// 2026 revamp (new Home tab, new visual system).
//
// Exports:
//   TutorialBody       the walkthrough content, chrome free, so it can be
//                      dropped into either the standalone page or the first
//                      run modal.
//   SiteTutorialPage   the standalone page (default export), wrapped in the
//                      shared marketing chrome.
//   FirstRunTutorial   the dismissible modal shown on a visitor's first visit.
//
// All copy lives in src/content/siteCopy.js. House style: no em dashes.
// =============================================================================
import React from "react";
import MarketingPage, { SectionTitle } from "./MarketingPage.jsx";
import {
  TUTORIAL_GETTING_STARTED as GS,
  TUTORIAL_HOME as HOME,
  TUTORIAL_PAGES as PAGES,
  TUTORIAL_OTHER as OTHER,
} from "../../content/siteCopy.js";

const SECTIONS = [
  { key: "home", icon: "✨", page: HOME },
  { key: "profile", icon: "👤", page: PAGES.profile },
  { key: "vote", icon: "🗳️", page: PAGES.vote },
  { key: "followthemoney", icon: "💰", page: PAGES.followthemoney },
];

function ControlList({ items }) {
  return (
    <div className="cyr-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10 }}>
      {items.map((it, i) => (
        <div key={i} style={{ padding: "12px 14px", borderRadius: 14, background: "#F8FAFE", border: "1px solid #E2E8F0" }}>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: "var(--cyr-navy)" }}>{it.label}</div>
          <div style={{ fontSize: 14, lineHeight: 1.6, color: "#334155", marginTop: 3 }}>{it.desc}</div>
        </div>
      ))}
    </div>
  );
}

export function TutorialBody({ compact }) {
  return (
    <div>
      {/* Jump links */}
      {!compact && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
          {[["start", "🚀", "Getting started"], ...SECTIONS.map(s => [s.key, s.icon, s.page.title]), ["more", "🧭", "Everything else"]].map(([k, ic, label]) => (
            <a key={k} href={`#tut-${k}`} className="cyr-chip" style={{ textDecoration: "none", padding: "7px 12px", fontSize: 13 }}>
              <span aria-hidden>{ic}</span>{label}
            </a>
          ))}
        </div>
      )}

      {/* Getting started */}
      <SectionTitle id="tut-start">{GS.heading}</SectionTitle>
      <div className="cyr-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        {GS.steps.map((s, i) => (
          <div key={i} className="cyr-card" style={{ padding: 18, boxShadow: "none" }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, display: "grid", placeItems: "center",
                          background: "var(--cyr-grad)", color: "#fff", fontFamily: "var(--cyr-display)",
                          fontWeight: 800, fontSize: 19 }}>{s.n}</div>
            <div style={{ fontSize: 15.5, fontWeight: 800, color: "var(--cyr-navy)", margin: "12px 0 4px" }}>{s.title}</div>
            <div style={{ fontSize: 14, lineHeight: 1.6, color: "#334155" }}>{s.body}</div>
          </div>
        ))}
      </div>

      {/* Per page control breakdowns */}
      {SECTIONS.map(({ key, icon, page }) => (
        <div key={key}>
          <SectionTitle id={`tut-${key}`}><span aria-hidden>{icon}</span> {page.title}</SectionTitle>
          <p style={{ fontSize: 15.5, lineHeight: 1.7, color: "#334155", marginTop: 0, marginBottom: 16 }}>{page.intro}</p>
          <ControlList items={page.items} />
        </div>
      ))}

      {/* Remaining areas */}
      <SectionTitle id="tut-more">Everything else</SectionTitle>
      <div className="cyr-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
        {OTHER.map((o, i) => (
          <div key={i} className="cyr-card" style={{ padding: 16, boxShadow: "none" }}>
            <div style={{ fontSize: 15.5, fontWeight: 800, color: "var(--cyr-navy)" }}>{o.title}</div>
            <div style={{ fontSize: 14, lineHeight: 1.6, color: "#334155", marginTop: 4 }}>{o.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SiteTutorialPage({ onNavigate, onEnter }) {
  return (
    <MarketingPage active="tutorial" onNavigate={onNavigate} onEnter={onEnter} wide
      kicker={GS.kicker} title="Site Tutorial" lede={GS.lede}>
      <TutorialBody />
    </MarketingPage>
  );
}

// Dismissible modal shown automatically on a visitor's first arrival. The
// optional onNavigate prop links out to the full intro pages; each of those
// pages routes back into the tool.
export function FirstRunTutorial({ onDismiss, onNavigate }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(11,27,68,0.55)",
                  backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
                  display: "flex", alignItems: "flex-start", justifyContent: "center",
                  padding: "24px 16px", overflowY: "auto", animation: "cyr-fade .25s ease both" }}
         onClick={onDismiss}>
      <div onClick={e => e.stopPropagation()} className="cyr-rise"
        style={{ background: "#fff", maxWidth: 760, width: "100%", borderRadius: 24, overflow: "hidden",
                 margin: "12px 0", boxShadow: "0 40px 80px rgba(11,27,68,.35)" }}>
        <div style={{ background: "var(--cyr-grad)", color: "#fff", padding: "22px 24px",
                      display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <div className="cyr-eyebrow" style={{ color: "#FFE29A" }}>Welcome</div>
            <div className="cyr-h1" style={{ fontSize: 28, marginTop: 6 }}>Here is how this works</div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,.85)", marginTop: 6 }}>
              A quick walkthrough. You can reopen it anytime from How it works.
            </div>
          </div>
          <button onClick={onDismiss} aria-label="Close walkthrough"
            style={{ background: "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.35)", color: "#fff",
                     borderRadius: 12, width: 36, height: 36, cursor: "pointer", fontSize: 20, lineHeight: 1, flexShrink: 0 }}>
            ×
          </button>
        </div>
        <div style={{ padding: "6px 24px 24px", maxHeight: "68vh", overflowY: "auto" }}>
          {onNavigate && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "16px 0 0" }}>
              {[
                ["about", "What We Stand For"],
                ["benefits", "How This Benefits You"],
                ["tutorial", "Full Site Tutorial"],
              ].map(([v, label]) => (
                <button key={v} onClick={() => onNavigate(v)} className="cyr-btn cyr-btn-ghost" style={{ flex: "1 1 180px", justifyContent: "center" }}>
                  {label} →
                </button>
              ))}
            </div>
          )}
          <TutorialBody compact />
          <button onClick={onDismiss} className="cyr-btn cyr-btn-primary"
            style={{ width: "100%", marginTop: 24, justifyContent: "center", fontSize: 16, padding: "14px 18px" }}>
            Got it, let me in →
          </button>
        </div>
      </div>
    </div>
  );
}
