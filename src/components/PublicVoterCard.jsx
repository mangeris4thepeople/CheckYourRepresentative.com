// =============================================================================
// PublicVoterCard.jsx - a constituent's public card: name, city, district,
// bio, and their public vote record. Rendered from the Constituents directory
// or directly via a shared /?voter=ID link.
//
// October 2026 redesign: PageHero header, vote record as cyr-row cards in a
// Panel. Data flow is unchanged.
// =============================================================================
import React, { useState, useEffect } from "react";
import { PageHero, Panel, Loading, Empty, ErrorBox } from "./ui/Kit.jsx";

const C = {
  navy:"#0E2A6B", ink:"#0F172A",
  yes:"#15803D", yesLight:"#ECFDF3",
  no:"#DC2626", noLight:"#FEF2F2",
  muted:"#5B6578", line:"#E2E8F0",
};

export default function PublicVoterCard({ voterId, onBack }) {
  const [state, setState] = useState("loading"); // loading | ready | notfound | error
  const [voter, setVoter] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    fetch(`/api/constituents?id=${encodeURIComponent(voterId)}`)
      .then(r => {
        if (r.status === 404) { if (!cancelled) setState("notfound"); return null; }
        if (!r.ok) throw new Error("bad");
        return r.json();
      })
      .then(data => { if (data && !cancelled) { setVoter(data); setState("ready"); } })
      .catch(() => { if (!cancelled) setState("error"); });
    return () => { cancelled = true; };
  }, [voterId]);

  if (state === "loading") return (
    <Shell onBack={onBack}>
      <div className="cyr-skeleton" style={{ height: 170, borderRadius: 24, marginBottom: 20 }} />
      <Panel>
        <div style={{ fontSize: 13.5, color: C.muted, marginBottom: 12 }}>Loading constituent profile…</div>
        <Loading rows={4} height={62} />
      </Panel>
    </Shell>
  );
  if (state === "notfound") return (
    <Shell onBack={onBack}>
      <Panel pad={8}>
        <Empty icon="🔒" title="This profile is private">
          The constituent either made their profile private or the link is invalid.
        </Empty>
      </Panel>
    </Shell>
  );
  if (state === "error") return (
    <Shell onBack={onBack}><ErrorBox>Couldn't load this profile. Try again shortly.</ErrorBox></Shell>
  );

  const positionColor = p => p === "support" ? C.yes : p === "oppose" ? C.no : C.muted;
  const positionBg    = p => p === "support" ? C.yesLight : p === "oppose" ? C.noLight : "#F1F5F9";
  const positionLabel = p => p === "support" ? "Yes" : p === "oppose" ? "No" : "Undecided";
  const positionIcon  = p => p === "support" ? "✓" : p === "oppose" ? "✕" : "?";

  const votes = voter.votes || [];
  const supportCount = votes.filter(v => v.position === "support").length;
  const opposeCount = votes.filter(v => v.position === "oppose").length;

  return (
    <Shell onBack={onBack}>
      <PageHero
        compact
        eyebrow="Public voter profile"
        title={voter.display_name}
        lede={`${voter.district ? `District ${voter.district}` : "District not set"}${voter.city ? ` · ${voter.city}` : ""}`}
        chips={[
          { value: votes.length, label: votes.length === 1 ? "public position" : "public positions" },
          votes.length ? { value: supportCount, label: "yes" } : null,
          votes.length ? { value: opposeCount, label: "no" } : null,
        ]}
      >
        {voter.bio && (
          <div style={{ marginTop: 16, padding: "12px 16px", borderRadius: 16, background: "rgba(255,255,255,.12)",
                        border: "1px solid rgba(255,255,255,.24)", fontSize: 15, lineHeight: 1.6, fontStyle: "italic",
                        color: "rgba(255,255,255,.94)", maxWidth: 620 }}>
            "{String(voter.bio).trim()}"
          </div>
        )}
      </PageHero>

      <Panel
        eyebrow="Vote record"
        title={`${votes.length} position${votes.length !== 1 ? "s" : ""}`}
        pad={14}
      >
        {votes.length === 0 && (
          <Empty icon="🗳️" title="No public votes yet" />
        )}

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 8 }}>
          {votes.map((v, i) => {
            const billNo = v.bill_id.replace(/-119$/, "").toUpperCase();
            return (
              <div key={i} className={i < 12 ? "cyr-row cyr-rise" : "cyr-row"}
                style={{ alignItems: "flex-start", gap: 12, padding: "12px 14px", animationDelay: `${Math.min(i, 12) * 25}ms` }}>
                <span style={{ minWidth: 72, textAlign: "center", padding: "6px 8px", borderRadius: 999, flexShrink: 0,
                               background: positionBg(v.position), color: positionColor(v.position),
                               fontWeight: 800, fontSize: 13 }}>
                  <span aria-hidden>{positionIcon(v.position)} </span>{positionLabel(v.position)}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", overflowWrap: "anywhere",
                                 fontSize: 14.5, fontWeight: 700, color: C.ink, lineHeight: 1.35 }}>
                    {v.headline || billNo}
                  </span>
                  <span style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 6 }}>
                    <span className="cyr-chip" style={{ fontSize: 11, padding: "2px 8px", fontFamily: "var(--cyr-mono)" }}>
                      {billNo.replace("-", " ")}
                    </span>
                    {v.tier === "verified" && (
                      <span className="cyr-chip" style={{ fontSize: 11, padding: "2px 8px", background: "#ECFDF3", color: C.yes }}>
                        📍 location-verified
                      </span>
                    )}
                    <span style={{ fontSize: 12.5, color: C.muted }}>{new Date(v.date).toLocaleDateString()}</span>
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      </Panel>

      <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.6, textAlign: "center", maxWidth: 620, margin: "4px auto 0" }}>
        This constituent chose to make their profile public. Positions are self-reported
        civic stances, not official ballots. 📍 means the voter's network location matched
        their district when the position was cast.
      </div>
    </Shell>
  );
}

function Shell({ children, onBack }) {
  return (
    <div style={{ fontFamily: "var(--cyr-sans)", maxWidth: 780, margin: "0 auto", color: C.ink }}>
      {onBack && (
        <button type="button" onClick={onBack} className="cyr-btn cyr-btn-ghost" style={{ marginBottom: 14, minHeight: 40 }}>
          <span aria-hidden>←</span> All constituents
        </button>
      )}
      {children}
    </div>
  );
}
