// =============================================================================
// KnowYourRepTabs.jsx - House / Senate toggle for the Know Your Rep tab.
// House is the default and renders KnowYourRep.jsx exactly as it already
// is, unchanged. Senate renders SenateDirectory.jsx, its structural mirror.
// =============================================================================
import React, { useState } from "react";
import KnowYourRep from "./KnowYourRep.jsx";
import SenateDirectory from "./SenateDirectory.jsx";

const C = { navy: "#0A1A3F", gold: "#C9A227", muted: "#5C5347", line: "#D8C9A0" };
const serif = "Georgia, 'Times New Roman', serif";

export default function KnowYourRepTabs() {
  const [chamber, setChamber] = useState("house");

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, maxWidth: 1000, margin: "0 auto 16px" }}>
        <button onClick={() => setChamber("house")}
          style={{ flex: 1, fontFamily: serif, fontWeight: 700, fontSize: 13, padding: "10px 16px",
                   borderRadius: 6, cursor: "pointer", border: `2px solid ${C.navy}`,
                   background: chamber === "house" ? C.navy : "#fff",
                   color: chamber === "house" ? "#fff" : C.navy }}>
          🏛️ House
        </button>
        <button onClick={() => setChamber("senate")}
          style={{ flex: 1, fontFamily: serif, fontWeight: 700, fontSize: 13, padding: "10px 16px",
                   borderRadius: 6, cursor: "pointer", border: `2px solid ${C.navy}`,
                   background: chamber === "senate" ? C.navy : "#fff",
                   color: chamber === "senate" ? "#fff" : C.navy }}>
          ⚖️ Senate
        </button>
      </div>

      {chamber === "house" ? <KnowYourRep /> : <SenateDirectory />}
    </div>
  );
}
