// =============================================================================
// HowItWorksPage.jsx - "How to Use This Site". October 2026 revamp:
// gradient hero via MarketingPage, then the steps as a numbered timeline of
// cards with gradient step badges. Copy lives in src/content/siteCopy.js.
// House style: no em dashes.
// =============================================================================
import React from "react";
import MarketingPage from "./MarketingPage.jsx";
import { HOW_IT_WORKS } from "../../content/siteCopy.js";

const ICONS = ["📍", "📖", "🗳️", "📋", "⚖️", "💰", "📱"];
const TONES = ["#2563EB", "#0891B2", "#16A34A", "#7C3AED", "#E0313F", "#B7791F", "#0E2A6B"];

export default function HowItWorksPage({ onNavigate, onEnter }) {
  const steps = HOW_IT_WORKS.steps || [];
  return (
    <MarketingPage active="howitworks" onNavigate={onNavigate} onEnter={onEnter}
      kicker="How it works" title={HOW_IT_WORKS.heading}
      lede={`${steps.length} steps from finding your representative to following the money. Everything except casting a position works without signing in.`}>

      <ol style={{ listStyle: "none", margin: 0, padding: 0, position: "relative" }}>
        {steps.map((s, i) => {
          const tone = TONES[i % TONES.length];
          const last = i === steps.length - 1;
          return (
            <li key={i} className="cyr-rise" style={{ display: "flex", gap: 16, position: "relative", paddingBottom: last ? 0 : 18,
                                                     animationDelay: `${i * 60}ms` }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                <span className="cyr-num" style={{ width: 44, height: 44, borderRadius: 14, display: "grid", placeItems: "center",
                                                   fontSize: 20, color: "#fff", background: `linear-gradient(135deg, ${tone}, #0E2A6B)`,
                                                   boxShadow: `0 8px 18px ${tone}40` }}>
                  {s.n}
                </span>
                {!last && <span aria-hidden style={{ flex: 1, width: 2, marginTop: 6, borderRadius: 2,
                                                     background: "linear-gradient(180deg,#C9D7F2,#EEF2F8)" }} />}
              </div>
              <div className="cyr-card" style={{ flex: 1, minWidth: 0, padding: "16px 18px", boxShadow: "none", background: "#FBFCFF" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <span aria-hidden style={{ fontSize: 19 }}>{ICONS[i % ICONS.length]}</span>
                  <div className="cyr-h2" style={{ fontSize: "clamp(18px, 2.2vw, 21px)" }}>{s.title}</div>
                </div>
                <div style={{ fontSize: 15.5, lineHeight: 1.72, color: "#334155" }}>{s.body}</div>
              </div>
            </li>
          );
        })}
      </ol>
    </MarketingPage>
  );
}
