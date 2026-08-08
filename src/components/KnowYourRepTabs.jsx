// =============================================================================
// KnowYourRepTabs.jsx - House / Senate / RepSpace toggle for the Know Your
// Rep tab. House is the default and renders KnowYourRep.jsx exactly as it
// already is, unchanged. Senate renders SenateDirectory.jsx, its structural
// mirror. RepSpace renders RepSpaceTab.jsx, the satirical 2006 profile page
// for every member, and opens directly when the page loads on a shared
// /know-your-rep/repspace/[bioguide] link.
// =============================================================================
import React, { useState } from "react";
import KnowYourRep from "./KnowYourRep.jsx";
import SenateDirectory from "./SenateDirectory.jsx";
import RepSpaceTab from "./RepSpaceTab.jsx";

const C = { navy: "#0A1A3F", gold: "#C9A227", muted: "#5C5347", line: "#D8C9A0" };
const serif = "Georgia, 'Times New Roman', serif";

function initialChamber() {
  try {
    if (window.location.pathname.startsWith("/know-your-rep/repspace")) return "repspace";
  } catch {}
  return "house";
}

export default function KnowYourRepTabs() {
  const [chamber, setChamber] = useState(initialChamber);

  const btn = (key, label) => (
    <button onClick={() => setChamber(key)}
      style={{ flex: 1, fontFamily: serif, fontWeight: 700, fontSize: 13, padding: "10px 16px",
               borderRadius: 6, cursor: "pointer", border: `2px solid ${C.navy}`,
               background: chamber === key ? C.navy : "#fff",
               color: chamber === key ? "#fff" : C.navy }}>
      {label}
    </button>
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, maxWidth: 1000, margin: "0 auto 16px" }}>
        {btn("house", "🏛️ House")}
        {btn("senate", "⚖️ Senate")}
        {btn("repspace", "🪩 RepSpace")}
      </div>

      {chamber === "house" && <KnowYourRep />}
      {chamber === "senate" && <SenateDirectory />}
      {chamber === "repspace" && <RepSpaceTab />}
    </div>
  );
}
