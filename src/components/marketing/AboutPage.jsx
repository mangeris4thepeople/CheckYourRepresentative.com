import React from "react";
import MarketingPage, { PageHeading } from "./MarketingPage.jsx";
import { C, serif } from "./theme.js";
import { ABOUT } from "../../content/siteCopy.js";

export default function AboutPage({ onNavigate, onEnter }) {
  return (
    <MarketingPage active="about" onNavigate={onNavigate} onEnter={onEnter}>
      <PageHeading>{ABOUT.heading}</PageHeading>

      {/* Emphasized mission line, near the top of the page. */}
      <p style={{ fontFamily: serif, fontSize: 20, fontWeight: 700, fontStyle: "italic",
                  lineHeight: 1.55, color: C.navy, borderLeft: `4px solid ${C.gold}`,
                  paddingLeft: 16, margin: "0 0 28px" }}>
        {ABOUT.missionLine}
      </p>

      {ABOUT.paragraphs.map((p, i) => (
        <p key={i} style={{ fontFamily: serif, fontSize: 17, lineHeight: 1.8, color: "#222", marginBottom: 22 }}>
          {p}
        </p>
      ))}

      {/* Data sources list, kept in siteCopy.js with the rest of the copy. */}
      <h2 style={{ fontFamily: serif, fontSize: 22, fontWeight: 700, color: C.navy,
                   borderBottom: `2px solid ${C.gold}`, paddingBottom: 6, margin: "36px 0 14px" }}>
        {ABOUT.dataSourcesHeading}
      </h2>
      <p style={{ fontFamily: serif, fontSize: 16, lineHeight: 1.7, color: "#222", marginBottom: 12 }}>
        {ABOUT.dataSourcesIntro}
      </p>
      <ul style={{ fontFamily: serif, fontSize: 16, lineHeight: 1.9, color: "#222", paddingLeft: 24, margin: 0 }}>
        {ABOUT.dataSources.map((s, i) => <li key={i}>{s}</li>)}
      </ul>
    </MarketingPage>
  );
}
