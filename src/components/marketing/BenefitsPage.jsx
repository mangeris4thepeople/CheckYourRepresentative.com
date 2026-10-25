// =============================================================================
// BenefitsPage.jsx - "How This Benefits You And The Country". October 2026
// revamp: gradient hero via MarketingPage, the two benefit paragraphs as
// side by side cards (you, the country), and a short summary strip. All
// long copy lives in src/content/siteCopy.js. House style: no em dashes.
// =============================================================================
import React from "react";
import MarketingPage, { SectionTitle } from "./MarketingPage.jsx";
import { BENEFITS } from "../../content/siteCopy.js";

const CARDS = [
  { icon: "🙋", label: "For you", tone: "#2563EB" },
  { icon: "🇺🇸", label: "For the country", tone: "#E0313F" },
];

const POINTS = [
  ["⏱️", "Before the vote", "See the bill, the money behind it, and who it helps or hurts while it still matters."],
  ["📝", "On the record", "Your position is recorded, so your representative is measured against it."],
  ["📣", "At scale", "Thousands of positions from one district, in public, are hard to ignore or spin."],
];

export default function BenefitsPage({ onNavigate, onEnter }) {
  const paras = BENEFITS.paragraphs || [];
  return (
    <MarketingPage active="benefits" onNavigate={onNavigate} onEnter={onEnter}
      kicker="Why it matters" title={BENEFITS.heading}
      lede="Closing the gap between the ballot box and the floor vote, for one voter and for a whole district.">

      <div className="cyr-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: 16 }}>
        {paras.map((p, i) => {
          const card = CARDS[i] || { icon: "✨", label: "", tone: "#0E2A6B" };
          return (
            <div key={i} className="cyr-card cyr-rise" style={{ padding: "22px 22px 20px", animationDelay: `${i * 80}ms`,
                                                               borderTop: `4px solid ${card.tone}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <span aria-hidden style={{ width: 44, height: 44, borderRadius: 14, display: "grid", placeItems: "center", fontSize: 22,
                                           background: `linear-gradient(135deg, ${card.tone}1F, ${card.tone}3D)`, border: `1px solid ${card.tone}33` }}>
                  {card.icon}
                </span>
                {card.label && <div className="cyr-h2" style={{ fontSize: 22 }}>{card.label}</div>}
              </div>
              <p style={{ fontSize: 16.5, lineHeight: 1.75, color: "#1F2937", margin: 0 }}>{p}</p>
            </div>
          );
        })}
      </div>

      <SectionTitle>In short</SectionTitle>
      <div className="cyr-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: 12 }}>
        {POINTS.map(([icon, title, body]) => (
          <div key={title} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "14px 16px",
                                    borderRadius: 14, background: "#F8FAFE", border: "1px solid #E2E8F0" }}>
            <span style={{ fontSize: 20, lineHeight: 1.2 }} aria-hidden>{icon}</span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontWeight: 800, fontSize: 15, color: "var(--cyr-navy)" }}>{title}</span>
              <span style={{ display: "block", fontSize: 13.5, lineHeight: 1.55, color: "#475569", marginTop: 3 }}>{body}</span>
            </span>
          </div>
        ))}
      </div>

      <blockquote style={{ margin: "30px 0 0", padding: "20px 22px", borderRadius: 18,
                           background: "linear-gradient(120deg,#FFF6DD,#FFFFFF)", border: "1px solid #F5D27A" }}>
        <div style={{ fontFamily: "var(--cyr-display)", fontSize: "clamp(18px, 2.4vw, 23px)", fontWeight: 700,
                      lineHeight: 1.4, color: "var(--cyr-navy)" }}>
          This site does not lobby for you. It gives you the same information the lobbyists already have, at the same time they have it.
        </div>
      </blockquote>
    </MarketingPage>
  );
}
