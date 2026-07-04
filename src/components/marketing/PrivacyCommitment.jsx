import React from "react";
import MarketingPage, { PageHeading } from "./MarketingPage.jsx";
import { C, serif, mono } from "./theme.js";
import { PRIVACY_COMMITMENT } from "../../content/siteCopy.js";

export default function PrivacyCommitment({ onNavigate, onEnter }) {
  return (
    <MarketingPage active="privacy" onNavigate={onNavigate} onEnter={onEnter}>
      <PageHeading>{PRIVACY_COMMITMENT.heading}</PageHeading>
      {PRIVACY_COMMITMENT.paragraphs.map((p, i) => (
        <p key={i} style={{ fontFamily: serif, fontSize: 17, lineHeight: 1.8, color: "#222", marginBottom: 22 }}>
          {p}
        </p>
      ))}
      <div style={{ marginTop: 8, padding: "16px 18px", background: C.parchment, border: `1px solid ${C.grayLight}`,
                    borderLeft: `3px solid ${C.gold}`, borderRadius: 3 }}>
        <div style={{ fontFamily: mono, fontSize: 13, color: C.gray, lineHeight: 1.7 }}>
          {PRIVACY_COMMITMENT.footnote}
        </div>
      </div>
    </MarketingPage>
  );
}
