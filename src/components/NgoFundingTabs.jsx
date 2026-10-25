// =============================================================================
// NgoFundingTabs.jsx - toggle inside the NGO Funding sub-section, mirroring
// the House / Senate toggle in KnowYourRepTabs.jsx. Transparency renders the
// existing NgosDirectory.jsx unchanged; Money Loop renders the new Colorado
// TRACER to IRS identity table.
// =============================================================================
import React, { useState } from "react";
import NgosDirectory from "./NgosDirectory.jsx";
import NgoMoneyLoop from "./NgoMoneyLoop.jsx";

const C = { navy: "#0E2A6B", gold: "#F5B82E", muted: "#5B6578", line: "#E2E8F0" };
const serif = "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export default function NgoFundingTabs() {
  const [section, setSection] = useState("transparency");

  const btn = (key, label) => (
    <button onClick={() => setSection(key)}
      style={{ flex: 1, fontFamily: serif, fontWeight: 700, fontSize: 13, padding: "10px 16px",
               borderRadius: 12, cursor: "pointer", border: `2px solid ${C.navy}`,
               background: section === key ? C.navy : "#fff",
               color: section === key ? "#fff" : C.navy }}>
      {label}
    </button>
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, maxWidth: 1000, margin: "0 auto 16px" }}>
        {btn("transparency", "🔍 Funding Transparency")}
        {btn("moneyloop", "🔁 NGO Money Loop")}
      </div>

      {section === "transparency" ? <NgosDirectory /> : <NgoMoneyLoop />}
    </div>
  );
}
