import React from "react";
import MarketingPage, { PageHeading } from "./MarketingPage.jsx";
import { C, serif } from "./theme.js";
import { ABOUT } from "../../content/siteCopy.js";

export default function AboutPage({ onNavigate, onEnter }) {
  return (
    <MarketingPage active="about" onNavigate={onNavigate} onEnter={onEnter}>
      <PageHeading>{ABOUT.heading}</PageHeading>
      {ABOUT.paragraphs.map((p, i) => (
        <p key={i} style={{ fontFamily: serif, fontSize: 17, lineHeight: 1.8, color: "#222", marginBottom: 22 }}>
          {p}
        </p>
      ))}
    </MarketingPage>
  );
}
