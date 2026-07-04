import React from "react";
import MarketingPage, { PageHeading } from "./MarketingPage.jsx";
import { C, bebas, serif } from "./theme.js";
import { PRIVACY_POLICY } from "../../content/siteCopy.js";

export default function PrivacyCommitment({ onNavigate, onEnter }) {
  return (
    <MarketingPage active="privacy" onNavigate={onNavigate} onEnter={onEnter}>
      <PageHeading>{PRIVACY_POLICY.title}</PageHeading>

      <div style={{ fontFamily: serif, fontSize: 14, color: C.gray, marginBottom: 28 }}>
        Effective date: {PRIVACY_POLICY.effectiveDate}
      </div>

      {PRIVACY_POLICY.sections.map((section, i) => (
        <div key={i} style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: bebas, fontSize: 24, letterSpacing: 1, color: C.navy,
                        borderBottom: `2px solid ${C.gold}`, paddingBottom: 6, marginBottom: 14 }}>
            {section.heading}
          </div>
          {section.body.map((p, j) => (
            <p key={j} style={{ fontFamily: serif, fontSize: 16, lineHeight: 1.75, color: "#222", margin: "0 0 14px" }}>
              {p}
            </p>
          ))}
        </div>
      ))}
    </MarketingPage>
  );
}
