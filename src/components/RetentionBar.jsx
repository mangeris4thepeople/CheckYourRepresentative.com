// =============================================================================
// RetentionBar.jsx - one retention election result as a yes/no vote bar,
// visually consistent with the site's tally bars. Green fill is the yes
// share, red the no share, with the retained/not retained outcome labeled.
// =============================================================================
import React from "react";

const C = {
  navy: "#0A1A3F", muted: "#5C5347", line: "#D8C9A0",
  green: "#1B5E20", red: "#B71C1C", track: "#EDE6D0",
};
const serif = "Georgia, 'Times New Roman', serif";

const num = (n) => n == null ? "?" : new Intl.NumberFormat("en-US").format(Number(n));

export default function RetentionBar({ electionYear, yesVotes, noVotes, retained }) {
  const yes = Number(yesVotes) || 0;
  const no = Number(noVotes) || 0;
  const total = yes + no;
  const yesPct = total > 0 ? Math.round((yes / total) * 100) : null;

  return (
    <div style={{ fontFamily: serif, padding: "10px 14px", borderBottom: "1px solid #f0ead8" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: C.navy }}>{electionYear} retention election</span>
        <span style={{ fontSize: 13, fontWeight: 900, color: retained === false ? C.red : C.green }}>
          {retained === false ? "Not retained" : retained === true ? "Retained" : "Result unknown"}
          {yesPct !== null ? ` · ${yesPct}% yes` : ""}
        </span>
      </div>
      {total > 0 && (
        <div style={{ height: 8, width: "100%", borderRadius: 999, background: C.track, overflow: "hidden", display: "flex" }}>
          <div style={{ height: "100%", width: `${(yes / total) * 100}%`, background: C.green }} />
          <div style={{ height: "100%", width: `${(no / total) * 100}%`, background: C.red }} />
        </div>
      )}
      <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>
        {num(yes)} yes · {num(no)} no
      </div>
    </div>
  );
}
