import React from "react";
import MarketingPage, { PageHeading } from "./MarketingPage.jsx";
import { serif } from "./theme.js";
import { BENEFITS } from "../../content/siteCopy.js";

export default function BenefitsPage({ onNavigate, onEnter }) {
  return (
    <MarketingPage active="benefits" onNavigate={onNavigate} onEnter={onEnter}>
      <PageHeading>{BENEFITS.heading}</PageHeading>
      {BENEFITS.paragraphs.map((p, i) => (
        <p key={i} style={{ fontFamily: serif, fontSize: 17, lineHeight: 1.8, color: "#222", marginBottom: 22 }}>
          {p}
        </p>
      ))}
    </MarketingPage>
  );
}
