// =============================================================================
// PrivacyCommitment.jsx - the Privacy Policy page (also served at /privacy).
// October 2026 revamp: gradient hero via MarketingPage, effective date
// chips, a jump list of sections, and each section as a titled block with
// readable prose. The "never" sections get a green callout so the
// commitments stand out. Copy lives in src/content/siteCopy.js.
// House style: no em dashes.
// =============================================================================
import React from "react";
import MarketingPage, { SectionTitle } from "./MarketingPage.jsx";
import { PRIVACY_POLICY, PRIVACY_SHORT } from "../../content/siteCopy.js";

const slug = (s) => "privacy-" + String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export default function PrivacyCommitment({ onNavigate, onEnter }) {
  const sections = PRIVACY_POLICY.sections || [];
  return (
    <MarketingPage active="privacy" onNavigate={onNavigate} onEnter={onEnter}
      kicker="Privacy" title={PRIVACY_POLICY.title} lede={PRIVACY_SHORT}>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 22 }}>
        <span className="cyr-chip" style={{ fontSize: 12.5, padding: "6px 12px" }}>
          Effective date: {PRIVACY_POLICY.effectiveDate}
        </span>
        {PRIVACY_POLICY.lastUpdated && (
          <span className="cyr-chip" style={{ fontSize: 12.5, padding: "6px 12px", background: "#DCFCE7", color: "#15803D" }}>
            Last updated: {PRIVACY_POLICY.lastUpdated}
          </span>
        )}
      </div>

      <nav aria-label="On this page" style={{ padding: "16px 18px", borderRadius: 16, background: "#F8FAFE", border: "1px solid #E2E8F0", marginBottom: 8 }}>
        <div className="cyr-eyebrow" style={{ fontSize: 11, marginBottom: 10 }}>On this page</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {sections.map((s, i) => (
            <a key={i} href={`#${slug(s.heading)}`} className="cyr-chip"
              style={{ textDecoration: "none", background: "#fff", border: "1px solid #DCE6F7", padding: "7px 12px", fontSize: 12.5 }}>
              {s.heading}
            </a>
          ))}
        </div>
      </nav>

      {sections.map((section, i) => {
        const never = /never/i.test(section.heading);
        return (
          <section key={i} style={{ scrollMarginTop: 90 }} id={slug(section.heading)}>
            <SectionTitle>{section.heading}</SectionTitle>
            {never ? (
              <div style={{ padding: "16px 18px", borderRadius: 16, background: "linear-gradient(120deg,#F0FDF4,#FFFFFF)", border: "1px solid #BBF7D0" }}>
                {section.body.map((p, j) => (
                  <div key={j} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: j ? 12 : 0 }}>
                    <span aria-hidden style={{ width: 22, height: 22, borderRadius: 99, background: "#16A34A", color: "#fff", flexShrink: 0,
                                               display: "grid", placeItems: "center", fontSize: 12, fontWeight: 800, marginTop: 3 }}>✓</span>
                    <p style={{ fontSize: 16, lineHeight: 1.72, color: "#14532D", margin: 0, minWidth: 0 }}>{p}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="cyr-prose">
                {section.body.map((p, j) => (
                  <p key={j} style={{ fontSize: 16, lineHeight: 1.75, margin: "0 0 14px", overflowWrap: "anywhere" }}>{p}</p>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </MarketingPage>
  );
}
