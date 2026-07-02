// =============================================================================
// ConstituentsDirectory.jsx — browse constituents who chose a public profile.
// District-first with a National toggle. Click any card to open their full
// public voter card. Only is_public profiles ever appear (enforced server-side).
// =============================================================================
import React, { useState, useEffect } from "react";
import PublicVoterCard from "./PublicVoterCard.jsx";

const C = {
  navy:"#0A1A3F", gold:"#C9A227", crimson:"#8B0000",
  parchment:"#FBF7EC", muted:"#5C5347", line:"#D8C9A0",
};
const serif = "Georgia,'Times New Roman',serif";

export default function ConstituentsDirectory({ district, initialVoterId }) {
  const [scope, setScope] = useState(district ? "district" : "national");
  const [state, setState] = useState("loading");
  const [list, setList] = useState([]);
  const [viewing, setViewing] = useState(initialVoterId || null);

  useEffect(() => {
    if (viewing) return; // don't refetch the list behind an open card
    let cancelled = false;
    setState("loading");
    const url = scope === "district" && district
      ? `/api/constituents?district=${encodeURIComponent(district)}`
      : `/api/constituents`;
    fetch(url)
      .then(r => { if (!r.ok) throw new Error("bad"); return r.json(); })
      .then(data => { if (!cancelled) { setList(data.constituents || []); setState("ready"); } })
      .catch(() => { if (!cancelled) setState("error"); });
    return () => { cancelled = true; };
  }, [scope, district, viewing]);

  if (viewing) {
    return <PublicVoterCard voterId={viewing} onBack={() => setViewing(null)} />;
  }

  return (
    <div style={{ fontFamily: serif, maxWidth: 760, margin: "0 auto" }}>
      <div style={{ background: C.navy, color: "#fff", padding: "20px 24px",
                    borderRadius: "8px 8px 0 0", borderBottom: `3px solid ${C.gold}` }}>
        <div style={{ fontSize: 10, color: C.gold, fontWeight: 700, letterSpacing: 1 }}>
          THE PUBLIC RECORD
        </div>
        <div style={{ fontSize: 20, fontWeight: 700 }}>Constituents</div>
        <div style={{ fontSize: 12.5, color: "#cfd6e4", marginTop: 4 }}>
          Voters who chose to stand publicly behind their positions.
        </div>
      </div>

      <div style={{ background: C.parchment, border: `1px solid ${C.line}`, borderTop: "none",
                    borderRadius: "0 0 8px 8px", padding: "18px 24px" }}>

        {/* Scope toggle */}
        <div style={{ display: "flex", gap: 0, marginBottom: 16, border: `1px solid ${C.navy}`,
                      borderRadius: 6, overflow: "hidden", width: "fit-content" }}>
          <ScopeBtn active={scope === "district"} disabled={!district}
            onClick={() => district && setScope("district")}>
            My District{district ? ` (${district})` : ""}
          </ScopeBtn>
          <ScopeBtn active={scope === "national"} onClick={() => setScope("national")}>
            National
          </ScopeBtn>
        </div>

        {scope === "district" && !district && (
          <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 12 }}>
            Set your district (Find District tab) to see your neighbors here.
          </div>
        )}

        {state === "loading" && <div style={{ color: C.muted, padding: "24px 0", textAlign: "center" }}>Loading constituents…</div>}
        {state === "error" && <div style={{ color: C.crimson, padding: "24px 0", textAlign: "center" }}>Couldn't load the directory. Try again shortly.</div>}

        {state === "ready" && list.length === 0 && (
          <div style={{ textAlign: "center", padding: "36px 16px", color: C.muted }}>
            <div style={{ fontSize: 30, marginBottom: 10 }}>🗳️</div>
            <div style={{ fontWeight: 700, color: C.navy, marginBottom: 6 }}>
              No public profiles here yet
            </div>
            <div style={{ fontSize: 13 }}>
              Be the first — open My Profile and switch your profile to Public.
            </div>
          </div>
        )}

        {state === "ready" && list.map(p => (
          <button key={p.id} onClick={() => setViewing(p.id)}
            style={{ display: "flex", alignItems: "center", gap: 14, width: "100%",
                     textAlign: "left", background: "#fff", border: `1px solid ${C.line}`,
                     borderRadius: 6, padding: "14px 16px", marginBottom: 8,
                     cursor: "pointer", fontFamily: serif }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: C.navy,
                          color: C.gold, display: "flex", alignItems: "center",
                          justifyContent: "center", fontWeight: 900, fontSize: 16, flexShrink: 0 }}>
              {(p.display_name || "A").slice(0, 1).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.navy }}>
                {p.display_name}
              </div>
              <div style={{ fontSize: 12, color: C.muted, overflow: "hidden",
                            textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {p.district ? `${p.district}` : "—"}
                {p.city ? ` · ${p.city}` : ""}
                {p.bio ? ` · ${p.bio}` : ""}
              </div>
            </div>
            <div style={{ textAlign: "center", flexShrink: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: C.crimson }}>{p.vote_count}</div>
              <div style={{ fontSize: 9.5, color: C.muted, fontWeight: 700, letterSpacing: 0.5 }}>VOTES</div>
            </div>
          </button>
        ))}

        <div style={{ fontSize: 11, color: C.muted, marginTop: 12, lineHeight: 1.5 }}>
          Every profile here opted in. Anyone can switch back to private at any time
          from their profile page, which removes them from this directory immediately.
        </div>
      </div>
    </div>
  );
}

function ScopeBtn({ active, disabled, onClick, children }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ fontFamily: serif, fontSize: 13, fontWeight: 700, padding: "9px 16px",
               border: "none", cursor: disabled ? "not-allowed" : "pointer",
               background: active ? "#0A1A3F" : "#fff",
               color: active ? "#fff" : disabled ? "#bbb" : "#0A1A3F" }}>
      {children}
    </button>
  );
}
