// =============================================================================
// MedicaidMap.jsx - the Medicaid section of Follow the Money. A thin wrapper
// around the shared BenefitMap: Medicaid/means-tested public coverage from
// Census ACS table S2704, for every state, county, and city.
// =============================================================================
import React from "react";
import BenefitMap from "./BenefitMap.jsx";

const CONFIG = {
  title: "Medicaid",
  tagline: "Where Medicaid reaches Americans. The map colors every state by the share of its " +
    "civilian population covered by Medicaid or other means-tested public health coverage.",
  nationalUrl: "/api/medicaid-national",
  detailUrl: "/api/medicaid-state-detail",
  legendLow: "Fewest people on Medicaid",
  legendLabel: "(percent of population)",
  rankTitle: "Every state, ranked by share of population covered by Medicaid",
  countLabel: "People on Medicaid",
  universeLabel: "Population",
  summaryUnits: "people are covered by Medicaid or other means-tested public coverage",
  sourceNote: "Source: US Census Bureau, American Community Survey 5-year estimates, table S2704. " +
    "Figures count civilian noninstitutionalized people with Medicaid or means-tested public " +
    "coverage, alone or in combination with other insurance, the only measure published for " +
    "every city and county in the country. Dollar spending totals are published by CMS at the " +
    "state level only.",
};

export default function MedicaidMap() {
  return <BenefitMap config={CONFIG} />;
}
