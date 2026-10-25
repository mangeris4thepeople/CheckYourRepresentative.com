// =============================================================================
// FollowTheMoney.jsx - the consolidated "Follow the Money" tab.
// Four sub-sections: Know Your Rep, NGO Funding, Medicare and Medicaid, and
// Social Security. Know Your Rep renders the existing KnowYourRepTabs.jsx
// unchanged; NGO Funding renders NgoFundingTabs.jsx, a toggle between the
// transparency directory and the NGO Money Loop table. This app
// has no router, so the active sub-section is plain state, synced to a
// ?ftm= query param via history.replaceState for shareable links.
// =============================================================================
import React, { useState, useEffect, useCallback } from "react";
import { PageHero, Seg } from "./ui/Kit.jsx";
import KnowYourRepTabs from "./KnowYourRepTabs.jsx";
import NgoFundingTabs from "./NgoFundingTabs.jsx";
import SocialSecurityPanel from "./SocialSecurityPanel.jsx";
import SnapMap from "./SnapMap.jsx";
import MedicaidMap from "./MedicaidMap.jsx";
import MoneyMap from "./MoneyMap.jsx";

const SECTIONS = [
  { key: "know-your-rep", label: "Know Your Rep" },
  { key: "ngo-funding", label: "NGO Funding" },
  { key: "medicare-medicaid", label: "Medicaid" },
  { key: "social-security", label: "Social Security" },
  { key: "snap", label: "SNAP / Food Stamps" },
  { key: "money-map", label: "Money Map" },
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

export default function FollowTheMoney({ district }) {
  const [section, setSection] = useState(readSectionFromUrl);

  useEffect(() => {
    writeSectionToUrl(section);
  }, [section]);

  const selectSection = useCallback((key) => setSection(key), []);

  // October 2026 redesign: gradient PageHero up top, Seg pills for the six
  // sub-sections (scrolls sideways on phones instead of wrapping into rows).
  return (
    <div style={{ minWidth: 0 }}>
      <PageHero compact eyebrow="Follow the money" title="Who pays, and who gets paid"
        lede="FEC filings and top donor buckets for every member of Congress, NGO funding, Medicaid, SNAP, Social Security, and the six layer Money Map. Every figure traces to a named public record." />

      <div style={{ display: "flex", margin: "-4px 0 14px" }}>
        <Seg options={SECTIONS.map(s => ({ value: s.key, label: s.label }))} value={section} onChange={selectSection} />
      </div>

      {section === "know-your-rep" && <KnowYourRepTabs />}
      {section === "ngo-funding" && <NgoFundingTabs />}
      {section === "medicare-medicaid" && <MedicaidMap />}
      {section === "social-security" && <SocialSecurityPanel district={district} />}
      {section === "snap" && <SnapMap />}
      {section === "money-map" && <MoneyMap onGoSection={selectSection} />}
    </div>
  );
}
