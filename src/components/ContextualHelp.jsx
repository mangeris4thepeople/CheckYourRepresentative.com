// =============================================================================
// ContextualHelp.jsx - the "About this page" help card shown beside several
// tabs (My Profile, Vote on Bills, Follow the Money). Explains every
// control on the page in plain language, using the same copy as the Site
// Tutorial (trimmed to short lines), so someone landing here understands the
// page without leaving to read a separate tutorial.
//
// October 2026 revamp: a clean light card with a soft header row. On narrow
// screens it collapses to a single tappable header so it never pushes the
// actual page content down. House style: no em dashes.
// =============================================================================
import React, { useState, useEffect } from "react";
import { TUTORIAL_PAGES } from "../content/siteCopy.js";

const C = { navy: "#0E2A6B", blue: "#2563EB", muted: "#5B6578", line: "#E2E8F0", ink: "#0F172A" };
const sans = "var(--cyr-sans)";

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
    <aside style={{ flex: isNarrow ? "1 1 100%" : "0 0 248px", width: isNarrow ? "100%" : 248,
                    alignSelf: "flex-start", minWidth: 0 }}>
      <div className="cyr-card" style={{ overflow: "hidden", borderRadius: 18 }}>
        <button onClick={() => isNarrow && setOpen(o => !o)}
          aria-expanded={isNarrow ? open : undefined}
          style={{ width: "100%", textAlign: "left", border: "none", fontFamily: sans,
                   padding: isNarrow ? "12px 14px" : "14px 16px", minHeight: 48,
                   cursor: isNarrow ? "pointer" : "default",
                   display: "flex", alignItems: "center", gap: 10,
                   background: "linear-gradient(180deg,#FFFFFF,#F5F8FE)",
                   borderBottom: collapsed ? "none" : `1px solid ${C.line}` }}>
          <span aria-hidden style={{ width: 30, height: 30, borderRadius: 10, flexShrink: 0, display: "grid", placeItems: "center",
                                     background: "#E8F0FF", color: C.blue, fontWeight: 800, fontSize: 15, fontFamily: "var(--cyr-display)" }}>i</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="cyr-eyebrow" style={{ display: "block", fontSize: 10.5 }}>About this page</span>
            {data.title && (
              <span style={{ display: "block", fontFamily: "var(--cyr-display)", fontWeight: 750, fontSize: 16, color: C.navy, marginTop: 2,
                             overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{data.title}</span>
            )}
          </span>
          {isNarrow && (
            <span aria-hidden style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 700, color: C.blue, display: "inline-flex", alignItems: "center", gap: 4 }}>
              {open ? "Hide" : "Show"}
              <span style={{ display: "inline-block", transition: "transform .2s ease", transform: open ? "rotate(180deg)" : "none" }}>▾</span>
            </span>
          )}
        </button>

        {!collapsed && (
          <div style={{ padding: "14px 16px 16px" }}>
            <div style={{ fontFamily: sans, fontSize: 13.5, lineHeight: 1.6, color: "#475569", marginBottom: 12 }}>
              {data.intro}
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {data.items.map((it, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span aria-hidden style={{ width: 6, height: 6, borderRadius: 99, background: C.blue, flexShrink: 0, marginTop: 7 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: sans, fontSize: 13, fontWeight: 700, color: C.navy }}>{it.label}</div>
                    <div style={{ fontFamily: sans, fontSize: 13, lineHeight: 1.55, color: C.muted, marginTop: 1 }}>{it.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
