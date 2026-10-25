// =============================================================================
// AboutPage.jsx - "What We Stand For". Fully rerendered for the October 2026
// revamp: gradient hero, mission pull quote, four pillars, the full mission
// text, a map of the site, and the named data sources. All copy lives in
// src/content/siteCopy.js. House style: no em dashes.
// =============================================================================
import React from "react";
import MarketingPage, { SectionTitle } from "./MarketingPage.jsx";
import { ABOUT } from "../../content/siteCopy.js";

const SITE_MAP = [
  ["✨", "Home", "Live counts, bills moving now, and when every source last refreshed."],
  ["🗳️", "Vote on Bills", "Plain language breakdowns, then your position on the record."],
  ["📄", "All Active Bills", "Every active bill in the 119th Congress, searchable."],
  ["📊", "Accountability", "Your district's positions against your representative's votes."],
  ["📋", "Roll Calls", "Every recorded vote, every name attached."],
  ["💰", "Follow the Money", "FEC money, RepSpace, NGO funding, Medicaid, SNAP, Social Security, Money Map."],
  ["🌐", "Constituents", "Public voter cards, so districts can see what neighbors think."],
];

export default function AboutPage({ onNavigate, onEnter }) {
  return (
    <MarketingPage active="about" onNavigate={onNavigate} onEnter={onEnter}
      kicker={ABOUT.kicker} title={ABOUT.heading} lede={ABOUT.lede}>

      <blockquote style={{ margin: "0 0 30px", padding: "22px 24px", borderRadius: 18,
                           background: "linear-gradient(120deg,#FFF6DD,#FFFFFF)", border: "1px solid #F5D27A" }}>
        <div style={{ fontFamily: "var(--cyr-display)", fontSize: "clamp(20px, 2.6vw, 26px)", fontWeight: 700,
                      lineHeight: 1.4, color: "var(--cyr-navy)" }}>
          "{ABOUT.missionLine}"
        </div>
      </blockquote>

      <div className="cyr-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", marginBottom: 34 }}>
        {(ABOUT.pillars || []).map((p, i) => (
          <div key={p.title} className="cyr-card cyr-card-hover cyr-rise" style={{ padding: 18, animationDelay: `${i * 70}ms` }}>
            <div style={{ fontSize: 26 }} aria-hidden>{p.icon}</div>
            <div style={{ fontWeight: 800, fontSize: 16, color: "var(--cyr-navy)", margin: "8px 0 4px" }}>{p.title}</div>
            <div style={{ fontSize: 14, lineHeight: 1.55, color: "#475569" }}>{p.body}</div>
          </div>
        ))}
      </div>

      <div className="cyr-prose">
        {ABOUT.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
      </div>

      <SectionTitle>What is on the site</SectionTitle>
      <div className="cyr-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
        {SITE_MAP.map(([icon, name, desc]) => (
          <div key={name} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 14px",
                                   borderRadius: 14, background: "#F8FAFE", border: "1px solid #E2E8F0" }}>
            <span style={{ fontSize: 20, lineHeight: 1.2 }} aria-hidden>{icon}</span>
            <span>
              <span style={{ display: "block", fontWeight: 800, fontSize: 15, color: "var(--cyr-navy)" }}>{name}</span>
              <span style={{ display: "block", fontSize: 13.5, lineHeight: 1.5, color: "#475569", marginTop: 2 }}>{desc}</span>
            </span>
          </div>
        ))}
      </div>

      <SectionTitle>{ABOUT.dataSourcesHeading}</SectionTitle>
      <p style={{ fontSize: 16, lineHeight: 1.7, color: "#1F2937", margin: "0 0 14px" }}>{ABOUT.dataSourcesIntro}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {ABOUT.dataSources.map((s, i) => {
          const [name, ...rest] = s.split(", ");
          return (
            <div key={i} style={{ flex: "1 1 260px", padding: "12px 14px", borderRadius: 14, border: "1px solid #DCE6F7",
                                  background: "#fff" }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: "var(--cyr-navy)" }}>{name}</div>
              {rest.length > 0 && <div style={{ fontSize: 13, color: "#5B6578", marginTop: 2 }}>{rest.join(", ")}</div>}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 30, padding: "14px 16px", borderRadius: 14, background: "#F1F5FB", fontSize: 13.5, color: "#475569", lineHeight: 1.6 }}>
        Paid for by We The People Inc. Not affiliated with any political party.
      </div>
    </MarketingPage>
  );
}
