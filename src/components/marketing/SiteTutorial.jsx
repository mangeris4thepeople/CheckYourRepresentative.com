// =============================================================================
// SiteTutorial.jsx - the full walkthrough.
//
// Exports:
//   TutorialBody       the walkthrough content, chrome-free, so it can be
//                      dropped into either the standalone page or the first
//                      run modal.
//   SiteTutorialPage   the standalone page (default export), wrapped in the
//                      shared marketing chrome.
//   FirstRunTutorial   the dismissible modal shown the first time someone
//                      clicks Enter The Tool.
// =============================================================================
import React from "react";
import MarketingPage, { PageHeading } from "./MarketingPage.jsx";
import { C, bebas, serif } from "./theme.js";
import {
  TUTORIAL_GETTING_STARTED as GS,
  TUTORIAL_PAGES as PAGES,
  TUTORIAL_OTHER as OTHER,
} from "../../content/siteCopy.js";

function SectionTitle({ children }) {
  return (
    <div style={{ fontFamily: bebas, fontSize: 26, letterSpacing: 1.5, color: C.navy,
                  borderBottom: `2px solid ${C.gold}`, paddingBottom: 6, margin: "36px 0 18px" }}>
      {children}
    </div>
  );
}

function ControlList({ items }) {
  return (
    <div>
      {items.map((it, i) => (
        <div key={i} style={{ marginBottom: 14 }}>
          <div style={{ fontFamily: serif, fontSize: 15, fontWeight: 700, color: C.navy }}>{it.label}</div>
          <div style={{ fontFamily: serif, fontSize: 14.5, lineHeight: 1.65, color: "#333" }}>{it.desc}</div>
        </div>
      ))}
    </div>
  );
}

export function TutorialBody() {
  return (
    <div>
      {/* Getting started */}
      <SectionTitle>{GS.heading}</SectionTitle>
      {GS.steps.map((s, i) => (
        <div key={i} style={{ display: "flex", gap: 16, marginBottom: 18, alignItems: "flex-start" }}>
          <div style={{ fontFamily: bebas, fontSize: 34, lineHeight: 1, color: C.gold, width: 32, textAlign: "center", flexShrink: 0 }}>{s.n}</div>
          <div>
            <div style={{ fontFamily: serif, fontSize: 16, fontWeight: 700, color: C.navy, marginBottom: 4 }}>{s.title}</div>
            <div style={{ fontFamily: serif, fontSize: 15, lineHeight: 1.65, color: "#333" }}>{s.body}</div>
          </div>
        </div>
      ))}

      {/* Per-page control breakdowns */}
      {["profile", "vote", "followthemoney", "judges"].map(key => {
        const page = PAGES[key];
        return (
          <div key={key}>
            <SectionTitle>{page.title}, what everything does</SectionTitle>
            <p style={{ fontFamily: serif, fontSize: 15, lineHeight: 1.7, color: "#444", marginTop: 0, marginBottom: 16 }}>{page.intro}</p>
            <ControlList items={page.items} />
          </div>
        );
      })}

      {/* Remaining areas */}
      {OTHER.map((o, i) => (
        <div key={i}>
          <SectionTitle>{o.title}</SectionTitle>
          <p style={{ fontFamily: serif, fontSize: 15, lineHeight: 1.7, color: "#333", marginTop: 0 }}>{o.body}</p>
        </div>
      ))}
    </div>
  );
}

export default function SiteTutorialPage({ onNavigate, onEnter }) {
  return (
    <MarketingPage active="tutorial" onNavigate={onNavigate} onEnter={onEnter}>
      <PageHeading>Site Tutorial</PageHeading>
      <TutorialBody />
    </MarketingPage>
  );
}

// Dismissible modal shown automatically on the first Enter The Tool click.
export function FirstRunTutorial({ onDismiss }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(13,13,13,0.72)",
                  display: "flex", alignItems: "flex-start", justifyContent: "center",
                  padding: "24px 16px", overflowY: "auto" }}
         onClick={onDismiss}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: C.white, maxWidth: 720, width: "100%", borderRadius: 8, overflow: "hidden",
                 border: `3px solid ${C.gold}`, margin: "12px 0" }}>
        <div style={{ background: C.navy, color: "#fff", padding: "18px 24px",
                      display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
                      position: "sticky", top: 0, zIndex: 2, borderBottom: `2px solid ${C.gold}` }}>
          <div>
            <div style={{ fontFamily: bebas, fontSize: 22, letterSpacing: 1.5, color: C.gold }}>Welcome, here is how this works</div>
            <div style={{ fontFamily: serif, fontSize: 12.5, color: "#cfd6e4", marginTop: 2 }}>
              A quick walkthrough. You can reopen it anytime from My Profile.
            </div>
          </div>
          <button onClick={onDismiss} aria-label="Close walkthrough"
            style={{ background: "none", border: "1px solid rgba(255,255,255,0.35)", color: "#fff",
                     borderRadius: 6, width: 32, height: 32, cursor: "pointer", fontSize: 18, lineHeight: 1, flexShrink: 0 }}>
            ×
          </button>
        </div>
        <div style={{ padding: "8px 24px 24px", maxHeight: "70vh", overflowY: "auto" }}>
          <TutorialBody />
          <button onClick={onDismiss}
            style={{ width: "100%", marginTop: 20, padding: "14px", fontFamily: bebas, fontSize: 18, letterSpacing: 2,
                     background: C.crimson, color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>
            GOT IT, LET ME IN →
          </button>
        </div>
      </div>
    </div>
  );
}
