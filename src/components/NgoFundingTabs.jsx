// =============================================================================
// NgoFundingTabs.jsx - toggle inside the NGO Funding sub-section, mirroring
// the House / Senate toggle in KnowYourRepTabs.jsx. Transparency renders the
// existing NgosDirectory.jsx unchanged; Money Loop renders the new Colorado
// TRACER to IRS identity table.
// =============================================================================
import React, { useState } from "react";
import NgosDirectory from "./NgosDirectory.jsx";
import NgoMoneyLoop from "./NgoMoneyLoop.jsx";
import { Seg } from "./ui/Kit.jsx";

export default function NgoFundingTabs() {
  const [section, setSection] = useState("transparency");

  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 16 }}>
        <Seg size="sm" value={section} onChange={setSection} options={[
          { value: "transparency", label: "🔍 Funding transparency" },
          { value: "moneyloop", label: "🔁 NGO money loop" },
        ]} />
      </div>

      {section === "transparency" ? <NgosDirectory /> : <NgoMoneyLoop />}
    </div>
  );
}
