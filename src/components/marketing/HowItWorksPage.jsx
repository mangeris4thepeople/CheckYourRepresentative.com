import React from "react";
import MarketingPage, { PageHeading } from "./MarketingPage.jsx";
import { C, bebas, serif } from "./theme.js";
import { HOW_IT_WORKS } from "../../content/siteCopy.js";

export default function HowItWorksPage({ onNavigate, onEnter }) {
  return (
    <MarketingPage active="howitworks" onNavigate={onNavigate} onEnter={onEnter}>
      <PageHeading>{HOW_IT_WORKS.heading}</PageHeading>
      {HOW_IT_WORKS.steps.map((s, i) => (
        <div key={i} style={{ display: "flex", gap: 18, marginBottom: 26, alignItems: "flex-start" }}>
          <div style={{ fontFamily: bebas, fontSize: 40, lineHeight: 1, color: C.gold, flexShrink: 0, width: 40, textAlign: "center" }}>
            {s.n}
          </div>
          <div>
            <div style={{ fontFamily: serif, fontSize: 19, fontWeight: 700, color: C.navy, marginBottom: 6 }}>{s.title}</div>
            <div style={{ fontFamily: serif, fontSize: 16, lineHeight: 1.7, color: "#333" }}>{s.body}</div>
          </div>
        </div>
      ))}
    </MarketingPage>
  );
}
