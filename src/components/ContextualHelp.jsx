// =============================================================================
// ContextualHelp.jsx - left-hand help sidebar for the My Profile and Vote on
// Bills tabs. Explains every control on the page in plain
// language, using the same copy as the Site Tutorial (trimmed to short lines),
// so someone landing here understands the page without leaving to read a
// separate tutorial.
//
// On narrow screens it collapses to a single tappable header so it never
// pushes the actual page content down.
// =============================================================================
import React, { useState, useEffect } from "react";
import { TUTORIAL_PAGES } from "../content/siteCopy.js";

const C = { navy: "#0A1A3F", gold: "#C9A227", parchment: "#FBF7EC", muted: "#5C5347", line: "#D8C9A0" };
const serif = "Georgia, 'Times New Roman', serif";

export default function ContextualHelp({ page }) {
  const data = TUTORIAL_PAGES[page];
  const [isNarrow, setIsNarrow] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 900 : false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < 900);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (!data) return null;

  const collapsed = isNarrow && !open;

  return (
    <aside style={{ flex: isNarrow ? "1 1 100%" : "0 0 236px", width: isNarrow ? "100%" : 236,
                    alignSelf: "flex-start" }}>
      <div style={{ background: C.parchment, border: `1px solid ${C.line}`, borderRadius: 8, overflow: "hidden" }}>
        <button onClick={() => isNarrow && setOpen(o => !o)}
          style={{ width: "100%", textAlign: "left", background: C.navy, color: "#fff", border: "none",
                   padding: "12px 14px", cursor: isNarrow ? "pointer" : "default",
                   display: "flex", justifyContent: "space-between", alignItems: "center",
                   borderBottom: `2px solid ${C.gold}` }}>
          <span style={{ fontFamily: serif, fontSize: 12, fontWeight: 700, letterSpacing: 1, color: C.gold, textTransform: "uppercase" }}>
            About this page
          </span>
          {isNarrow && <span style={{ color: "#cfd6e4", fontSize: 13 }}>{open ? "▲" : "▼"}</span>}
        </button>

        {!collapsed && (
          <div style={{ padding: "14px" }}>
            <div style={{ fontFamily: serif, fontSize: 13.5, lineHeight: 1.6, color: C.muted, marginBottom: 14 }}>
              {data.intro}
            </div>
            {data.items.map((it, i) => (
              <div key={i} style={{ marginBottom: 12 }}>
                <div style={{ fontFamily: serif, fontSize: 12.5, fontWeight: 700, color: C.navy }}>{it.label}</div>
                <div style={{ fontFamily: serif, fontSize: 12.5, lineHeight: 1.55, color: "#444" }}>{it.desc}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
