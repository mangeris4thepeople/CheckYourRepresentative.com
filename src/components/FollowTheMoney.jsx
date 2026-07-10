// =============================================================================
// FollowTheMoney.jsx - the consolidated "Follow the Money" tab.
// Four sub-sections: Know Your Rep, NGO Funding, Medicare and Medicaid, and
// Social Security. Know Your Rep and NGO Funding render the existing
// KnowYourRepTabs.jsx and NgosDirectory.jsx components unchanged. This app
// has no router, so the active sub-section is plain state, synced to a
// ?ftm= query param via history.replaceState for shareable links.
// =============================================================================
import React, { useState, useEffect, useCallback } from "react";
import KnowYourRepTabs from "./KnowYourRepTabs.jsx";
import NgosDirectory from "./NgosDirectory.jsx";

const C = {
  navy: "#0A1A3F", gold: "#C9A227", crimson: "#8B0000", parchment: "#FBF7EC",
  ink: "#1A1A1A", muted: "#5C5347", line: "#D8C9A0",
};
const serif = "Georgia, 'Times New Roman', serif";

const SECTIONS = [
  { key: "know-your-rep", label: "Know Your Rep" },
  { key: "ngo-funding", label: "NGO Funding" },
  { key: "medicare-medicaid", label: "Medicare and Medicaid" },
  { key: "social-security", label: "Social Security" },
];
const DEFAULT_SECTION = "know-your-rep";
const VALID_KEYS = new Set(SECTIONS.map(s => s.key));

function readSectionFromUrl() {
  try {
    const v = new URLSearchParams(window.location.search).get("ftm");
    return VALID_KEYS.has(v) ? v : DEFAULT_SECTION;
  } catch {
    return DEFAULT_SECTION;
  }
}

function writeSectionToUrl(key) {
  try {
    const url = new URL(window.location.href);
    if (key === DEFAULT_SECTION) url.searchParams.delete("ftm");
    else url.searchParams.set("ftm", key);
    window.history.replaceState(null, "", url.toString());
  } catch {}
}

function ComingSoon({ title, body }) {
  return (
    <div style={{ fontFamily: serif, maxWidth: 700, margin: "40px auto", textAlign: "center",
                  border: `1px solid ${C.line}`, borderRadius: 8, padding: "36px 24px", background: "#fff" }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: C.navy, marginBottom: 10 }}>{title}</div>
      <div style={{ fontSize: 14, lineHeight: 1.7, color: C.muted }}>{body}</div>
      <div style={{ marginTop: 16, fontSize: 12, fontWeight: 700, color: C.gold, letterSpacing: 1, textTransform: "uppercase" }}>
        Coming soon
      </div>
    </div>
  );
}

export default function FollowTheMoney() {
  const [section, setSection] = useState(readSectionFromUrl);

  useEffect(() => {
    writeSectionToUrl(section);
  }, [section]);

  const selectSection = useCallback((key) => setSection(key), []);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, maxWidth: 1000, margin: "0 auto 16px",
                    flexWrap: "wrap" }}>
        {SECTIONS.map(s => (
          <button key={s.key} onClick={() => selectSection(s.key)}
            style={{ flex: "1 1 200px", fontFamily: serif, fontWeight: 700, fontSize: 13, padding: "10px 14px",
                     borderRadius: 6, cursor: "pointer", border: `2px solid ${C.navy}`,
                     background: section === s.key ? C.navy : "#fff",
                     color: section === s.key ? "#fff" : C.navy }}>
            {s.label}
          </button>
        ))}
      </div>

      {section === "know-your-rep" && <KnowYourRepTabs />}
      {section === "ngo-funding" && <NgosDirectory />}
      {section === "medicare-medicaid" && (
        <ComingSoon
          title="Medicare and Medicaid spending"
          body="State-level Medicare and Medicaid spending trends are on the way, sourced from the same public disclosures as the rest of this tab."
        />
      )}
      {section === "social-security" && (
        <ComingSoon
          title="Social Security"
          body="District and state-level Social Security data, including OASDI, is on the way."
        />
      )}
    </div>
  );
}
