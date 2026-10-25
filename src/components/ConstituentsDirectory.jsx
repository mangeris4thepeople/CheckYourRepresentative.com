// =============================================================================
// ConstituentsDirectory.jsx - browse constituents who chose a public profile.
// District-first with a National toggle. Click any card to open their full
// public voter card. Only is_public profiles ever appear (enforced server-side).
//
// October 2026 redesign: PageHero, segmented scope switch, card rows in a
// Panel. Data flow is unchanged.
// =============================================================================
import React, { useState, useEffect } from "react";
import PublicVoterCard from "./PublicVoterCard.jsx";
import { PageHero, Panel, Loading, Empty, ErrorBox } from "./ui/Kit.jsx";

const C = { navy:"#0E2A6B", blue:"#2563EB", ink:"#0F172A", muted:"#5B6578", line:"#E2E8F0" };

// Avatar tints, picked from the first letter so a person keeps one color.
const AVATAR = [
  ["#0E2A6B", "#2563EB"], ["#0891B2", "#22D3EE"], ["#7C3AED", "#A78BFA"],
  ["#15803D", "#22C55E"], ["#B7791F", "#F5B82E"], ["#E0313F", "#F43F5E"],
];
function avatarFor(name) {
  const code = String(name || "A").toUpperCase().charCodeAt(0) || 65;
  const [a, b] = AVATAR[code % AVATAR.length];
  return `linear-gradient(135deg, ${a}, ${b})`;
}

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
    <div style={{ fontFamily: "var(--cyr-sans)", maxWidth: 940, margin: "0 auto", color: C.ink }}>
      <PageHero
        eyebrow="The public record"
        title="Constituents"
        lede="Voters who chose to stand publicly behind their positions."
        chips={[
          state === "ready" ? { value: list.length, label: list.length === 1 ? "public profile" : "public profiles" } : null,
          district ? { value: district, label: "your district" } : null,
        ]}
      />

      {/* Scope toggle */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div className="cyr-seg" role="tablist" aria-label="Directory scope">
          <ScopeBtn active={scope === "district"} disabled={!district}
            onClick={() => district && setScope("district")}>
            My district{district ? ` (${district})` : ""}
          </ScopeBtn>
          <ScopeBtn active={scope === "national"} onClick={() => setScope("national")}>
            National
          </ScopeBtn>
        </div>
        {scope === "district" && !district && (
          <span style={{ fontSize: 13, color: C.muted }}>
            Set your district (My Profile) to see your neighbors here.
          </span>
        )}
      </div>

      <Panel
        eyebrow={scope === "district" && district ? `District ${district}` : "Nationwide"}
        title="Public voter cards"
        pad={14}
        action={state === "ready" && list.length > 0
          ? <span className="cyr-chip" style={{ flexShrink: 0 }}>{list.length} {list.length === 1 ? "person" : "people"}</span>
          : null}
      >
        {state === "loading" && <Loading rows={4} height={76} />}
        {state === "error" && <ErrorBox>Couldn't load the directory. Try again shortly.</ErrorBox>}

        {state === "ready" && list.length === 0 && (
          <Empty icon="🗳️" title="No public profiles here yet">
            Be the first: open My Profile and switch your profile to Public.
          </Empty>
        )}

        {state === "ready" && list.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 380px), 1fr))", gap: 10 }}>
            {list.map((p, i) => (
              <button key={p.id} type="button" onClick={() => setViewing(p.id)}
                className={district && p.district === district ? "cyr-row cyr-row-mine cyr-rise" : "cyr-row cyr-rise"}
                style={{ width: "100%", textAlign: "left", cursor: "pointer", fontFamily: "inherit",
                         alignItems: "flex-start", gap: 14, padding: "14px 16px", animationDelay: `${Math.min(i, 12) * 30}ms` }}>
                <span aria-hidden style={{ width: 46, height: 46, borderRadius: 16, background: avatarFor(p.display_name),
                               color: "#fff", display: "grid", placeItems: "center", fontFamily: "var(--cyr-display)",
                               fontWeight: 800, fontSize: 19, flexShrink: 0, boxShadow: "0 6px 14px rgba(14,42,107,.18)" }}>
                  {(p.display_name || "A").slice(0, 1).toUpperCase()}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 15.5, fontWeight: 700, color: C.navy,
                                 overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.display_name}
                  </span>
                  <span style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 5 }}>
                    {p.district && (
                      <span className="cyr-chip" style={{ fontSize: 11, padding: "2px 8px", fontFamily: "var(--cyr-mono)" }}>
                        {p.district}
                      </span>
                    )}
                    {p.city && <span style={{ fontSize: 12.5, color: C.muted }}>{p.city}</span>}
                  </span>
                  {p.bio && (
                    <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                                   fontSize: 13, color: "#475569", lineHeight: 1.5, marginTop: 6 }}>
                      {p.bio}
                    </span>
                  )}
                </span>
                <span style={{ textAlign: "center", flexShrink: 0, alignSelf: "center", minWidth: 52 }}>
                  <span className="cyr-num" style={{ display: "block", fontSize: 22, color: C.blue, lineHeight: 1 }}>{p.vote_count}</span>
                  <span style={{ display: "block", fontSize: 11.5, color: C.muted, fontWeight: 700, marginTop: 3 }}>
                    {Number(p.vote_count) === 1 ? "vote" : "votes"}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </Panel>

      <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.6, textAlign: "center", maxWidth: 640, margin: "4px auto 0" }}>
        Every profile here opted in. Anyone can switch back to private at any time
        from their profile page, which removes them from this directory immediately.
      </div>
    </div>
  );
}

function ScopeBtn({ active, disabled, onClick, children }) {
  return (
    <button type="button" role="tab" onClick={onClick} disabled={disabled}
      aria-pressed={active} aria-selected={active}
      style={{ minHeight: 40, opacity: disabled ? 0.45 : 1 }}>
      {children}
    </button>
  );
}
