// =============================================================================
// RetentionBar.jsx - one retention election result as a yes/no vote bar,
// visually consistent with the site's tally bars. Green fill is the yes
// share, red the no share, with the retained/not retained outcome labeled.
// October 2026 revamp: white row card, rounded gradient bar, outcome pill.
// House style: no em dashes.
// =============================================================================
import React from "react";

const C = {
  navy: "#0E2A6B", muted: "#5B6578", line: "#E2E8F0",
  green: "#15803D", red: "#DC2626", track: "#EEF2F8",
};
const sans = "var(--cyr-sans)";

const num = (n) => n == null ? "?" : new Intl.NumberFormat("en-US").format(Number(n));

export default function RetentionBar({ electionYear, yesVotes, noVotes, retained }) {
  const yes = Number(yesVotes) || 0;
  const no = Number(noVotes) || 0;
  const total = yes + no;
  const yesPct = total > 0 ? Math.round((yes / total) * 100) : null;
  const tone = retained === false ? C.red : retained === true ? C.green : C.muted;
  const toneBg = retained === false ? "#FEE2E2" : retained === true ? "#DCFCE7" : "#F1F5F9";

  return (
    <div style={{ fontFamily: sans, padding: "12px 14px", background: "#fff", border: `1px solid ${C.line}`, borderRadius: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>{electionYear} retention election</span>
        <span className="cyr-chip" style={{ background: toneBg, color: tone, fontWeight: 800 }}>
          {retained === false ? "Not retained" : retained === true ? "Retained" : "Result unknown"}
          {yesPct !== null ? ` · ${yesPct}% yes` : ""}
        </span>
      </div>
      {total > 0 && (
        <div style={{ height: 12, width: "100%", borderRadius: 999, background: C.track, overflow: "hidden", display: "flex", gap: 2 }}>
          <div style={{ height: "100%", width: `${(yes / total) * 100}%`, background: "linear-gradient(90deg,#16A34A,#22C55E)" }} />
          <div style={{ height: "100%", width: `${(no / total) * 100}%`, background: "linear-gradient(90deg,#DC2626,#F43F5E)" }} />
        </div>
      )}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12.5, color: C.muted, marginTop: 8 }}>
        <span><span aria-hidden style={{ display: "inline-block", width: 8, height: 8, borderRadius: 99, background: "#16A34A", marginRight: 6 }} />
          <strong className="cyr-num" style={{ color: "#0F172A", fontWeight: 700 }}>{num(yes)}</strong> yes</span>
        <span><span aria-hidden style={{ display: "inline-block", width: 8, height: 8, borderRadius: 99, background: "#DC2626", marginRight: 6 }} />
          <strong className="cyr-num" style={{ color: "#0F172A", fontWeight: 700 }}>{num(no)}</strong> no</span>
      </div>
    </div>
  );
}
