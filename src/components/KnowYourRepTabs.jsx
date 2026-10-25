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
import { Seg } from "./ui/Kit.jsx";

function initialChamber() {
  try {
    if (window.location.pathname.startsWith("/know-your-rep/repspace")) return "repspace";
  } catch {}
  return "house";
}

export default function KnowYourRepTabs() {
  const [chamber, setChamber] = useState(initialChamber);

  // Chamber switch as small Seg pills; RepSpace keeps its own retro look
  // inside, only this surrounding control is part of the redesign.
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 16 }}>
        <Seg size="sm" value={chamber} onChange={setChamber} options={[
          { value: "house", label: "🏛️ House" },
          { value: "senate", label: "⚖️ Senate" },
          { value: "repspace", label: "🪩 RepSpace" },
        ]} />
      </div>

      {chamber === "house" && <KnowYourRep />}
      {chamber === "senate" && <SenateDirectory />}
      {chamber === "repspace" && <RepSpaceTab />}
    </div>
  );
}
