// =============================================================================
// SnapMap.jsx - the SNAP / Food Stamps section of Follow the Money. A thin
// wrapper around the shared BenefitMap: SNAP household participation from
// Census ACS table S2201, for every state, county, and city.
//
// The ?v=2 on the API URLs skips CDN-cached responses from before the API
// switched to the generic benefit_count field names.
// =============================================================================
import React from "react";
import BenefitMap from "./BenefitMap.jsx";

const CONFIG = {
  title: "SNAP / Food Stamps",
  tagline: "Where food assistance reaches American households. The map colors every state by the " +
    "share of households receiving SNAP benefits.",
  nationalUrl: "/api/snap-national?v=2",
  detailUrl: "/api/snap-state-detail?v=2",
  legendLow: "Fewest households on SNAP",
  legendLabel: "(percent of households)",
  rankTitle: "Every state, ranked by share of households receiving SNAP",
  countLabel: "Households on SNAP",
  universeLabel: "Total households",
  summaryUnits: "households receive SNAP benefits",
  sourceNote: "Source: US Census Bureau, American Community Survey 5-year estimates, table S2201 " +
    "(Food Stamps/SNAP). Figures are households receiving benefits, the only measure published " +
    "for every city and county in the country. Dollar payout totals are published by USDA at " +
    "the state level only.",
};

export default function SnapMap() {
  return <BenefitMap config={CONFIG} />;
}
