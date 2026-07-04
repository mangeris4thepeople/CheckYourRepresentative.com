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
    </MarketingPage>
  );
}
