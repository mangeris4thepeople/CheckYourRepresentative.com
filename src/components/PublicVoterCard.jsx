// =============================================================================
// PublicVoterCard.jsx - a constituent's public card: name, city, district,
// bio, and their public vote record. Rendered from the Constituents directory
// or directly via a shared /?voter=ID link.
// =============================================================================
import React, { useState, useEffect } from "react";

const C = {
  navy:"#0A1A3F", gold:"#C9A227", crimson:"#8B0000",
  yes:"#1B5E20", yesLight:"#E8F5E9",
  no:"#B71C1C", noLight:"#FFEBEE",
  parchment:"#FBF7EC", muted:"#5C5347", line:"#D8C9A0",
};
const serif = "Georgia,'Times New Roman',serif";

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
    <Shell onBack={onBack}><Center>Loading constituent profile…</Center></Shell>
  );
  if (state === "notfound") return (
    <Shell onBack={onBack}>
      <Center>
        <div style={{ fontSize: 32, marginBottom: 10 }}>🔒</div>
        <div style={{ fontWeight: 700, color: C.navy, marginBottom: 6 }}>This profile is private</div>
        <div style={{ fontSize: 13, color: C.muted }}>
          The constituent either made their profile private or the link is invalid.
        </div>
      </Center>
    </Shell>
  );
  if (state === "error") return (
    <Shell onBack={onBack}><Center>Couldn't load this profile. Try again shortly.</Center></Shell>
  );

  const positionColor = p => p === "support" ? C.yes : p === "oppose" ? C.no : C.muted;
  const positionBg    = p => p === "support" ? C.yesLight : p === "oppose" ? C.noLight : "#f5f5f5";
  const positionLabel = p => p === "support" ? "YES" : p === "oppose" ? "NO" : "Undecided";

  return (
    <Shell onBack={onBack}>
      {/* Header */}
      <div style={{ background: C.navy, color: "#fff", padding: "22px 24px",
                    borderRadius: "8px 8px 0 0", borderBottom: `3px solid ${C.gold}` }}>
        <div style={{ fontSize: 10, color: C.gold, fontWeight: 700, letterSpacing: 1 }}>
          PUBLIC VOTER PROFILE
        </div>
        <div style={{ fontSize: 22, fontWeight: 700 }}>{voter.display_name}</div>
        <div style={{ fontSize: 12.5, color: "#cfd6e4", marginTop: 4 }}>
          {voter.district ? `District ${voter.district}` : "District not set"}
          {voter.city ? ` · ${voter.city}` : ""}
        </div>
      </div>

      <div style={{ background: C.parchment, border: `1px solid ${C.line}`, borderTop: "none",
                    borderRadius: "0 0 8px 8px", padding: "22px 24px" }}>
        {voter.bio && (
          <div style={{ fontSize: 14, color: "#1A1A1A", fontStyle: "italic",
                        lineHeight: 1.6, marginBottom: 18, padding: "12px 14px",
                        background: "#fff", border: `1px solid ${C.line}`, borderRadius: 6 }}>
            "{voter.bio}"
          </div>
        )}

        <div style={{ fontSize: 11, fontWeight: 700, color: C.navy, letterSpacing: 1, marginBottom: 10 }}>
          VOTE RECORD - {voter.votes.length} POSITION{voter.votes.length !== 1 ? "S" : ""}
        </div>

        {voter.votes.length === 0 && (
          <div style={{ fontSize: 13, color: C.muted, padding: "16px 0" }}>
            No public votes yet.
          </div>
        )}

        {voter.votes.map((v, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12,
                                background: "#fff", border: `1px solid ${C.line}`,
                                borderRadius: 6, padding: "12px 14px", marginBottom: 8 }}>
            <div style={{ minWidth: 70, textAlign: "center", padding: "6px 8px", borderRadius: 4,
                          background: positionBg(v.position), color: positionColor(v.position),
                          fontWeight: 900, fontSize: 13 }}>
              {positionLabel(v.position)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: C.navy,
                            overflow: "hidden", textOverflow: "ellipsis" }}>
                {v.headline || v.bill_id.replace(/-119$/, "").toUpperCase()}
              </div>
              <div style={{ fontSize: 11, color: C.muted }}>
                {v.bill_id.replace(/-119$/, "").toUpperCase()}
                {v.tier === "verified" ? " · 📍 location-verified" : ""}
                {" · "}{new Date(v.date).toLocaleDateString()}
              </div>
            </div>
          </div>
        ))}

        <div style={{ fontSize: 11, color: C.muted, marginTop: 14, lineHeight: 1.5 }}>
          This constituent chose to make their profile public. Positions are self-reported
          civic stances, not official ballots. 📍 means the voter's network location matched
          their district when the position was cast.
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children, onBack }) {
  return (
    <div style={{ fontFamily: serif, maxWidth: 680, margin: "0 auto" }}>
      {onBack && (
        <button onClick={onBack}
          style={{ fontFamily: serif, fontSize: 13, fontWeight: 700, color: C.navy,
                   background: "none", border: `1px solid ${C.line}`, borderRadius: 4,
                   padding: "8px 14px", cursor: "pointer", marginBottom: 14 }}>
          ← All Constituents
        </button>
      )}
      {children}
    </div>
  );
}

function Center({ children }) {
  return (
    <div style={{ textAlign: "center", padding: "50px 20px", color: C.muted,
                  background: C.parchment, border: `1px solid ${C.line}`, borderRadius: 8 }}>
      {children}
    </div>
  );
}
