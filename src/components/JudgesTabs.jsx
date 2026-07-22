// =============================================================================
// JudgesTabs.jsx - the Know Your Judge tab's top-level switch between the
// Colorado directory (evaluations, retention results) and the national
// CourtListener registry. Same inline toggle pattern as the Follow the
// Money sections: two pill buttons, no router.
// =============================================================================
import React, { useState } from "react";
import KnowYourJudge from "./KnowYourJudge.jsx";
import NationalJudges from "./NationalJudges.jsx";

const C = { navy: "#0A1A3F", gold: "#C9A227", line: "#D8C9A0", muted: "#5C5347" };
const serif = "Georgia, 'Times New Roman', serif";

export default function JudgesTabs() {
  const [view, setView] = useState("colorado"); // colorado | national

  const pill = (key, label) => (
    <button onClick={() => setView(key)}
      style={{
        fontFamily: serif, fontSize: 13, fontWeight: 700, padding: "8px 20px",
        borderRadius: 20, cursor: "pointer",
        border: `1px solid ${view === key ? C.navy : C.line}`,
        background: view === key ? C.navy : "#fff",
        color: view === key ? C.gold : C.muted,
      }}>
      {label}
    </button>
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 18 }}>
        {pill("colorado", "Colorado")}
        {pill("national", "All 50 States")}
      </div>
      {view === "colorado" ? <KnowYourJudge /> : <NationalJudges />}
    </div>
  );
}
