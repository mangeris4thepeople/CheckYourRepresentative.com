// =============================================================================
// BillVotingQueue - the real "select a bill to vote on" panel, styled to
// match the site's existing navy and gold theme (see AllBillsBrowser.jsx and
// ConstituentVoting.jsx for the same color constants).
//
// This component only renders whatever it is given. It has exactly one
// source of truth for "which bill and vote status is currently shown":
// the activeBill prop. There is no second place that reads a leftover
// "last voted" value, so the list above and the vote status below can
// never disagree, the bug this component was built to fix.
//
// All data fetching (queue navigation, casting a vote) lives in the parent
// container (ConstituentVoting.jsx), since with 17,000+ active bills the
// full set can never be loaded into the browser at once.
//
// Props:
//   activeBill: the single bill currently displayed, or null
//     {
//       id, billNumber, title, summary, sponsor,
//       whoBenefits, whoWorseOff, pacMoney, industries, impact,
//       voteTally: { yes, no, total },
//       userPosition: "support" | "oppose" | "undecided" | null
//     }
//   counts: { totalActive, votedCount, notVotedCount }
//   currentMode: "all" | "next_queue" | "previous_history" | "voted" | "not_voted"
//   loading: true while a queue navigation request is in flight
//   onNavigate: function(action) => void
//     action is one of "all" | "next_queue" | "previous_history" | "voted" |
//     "not_voted" | "step_forward" | "step_backward"
//   onCastVote: function(billId, position) => void
// =============================================================================
import React, { useState } from "react";

const C = {
  navy: "#0A1A3F", gold: "#C9A227", crimson: "#8B0000",
  yes: "#1B5E20", yesLight: "#E8F5E9", yesBorder: "#A5D6A7",
  no: "#B71C1C", noLight: "#FFEBEE", noBorder: "#EF9A9A",
  parchment: "#FBF7EC", ink: "#1A1A1A", muted: "#5C5347", line: "#D8C9A0",
};
const serif = "Georgia, 'Times New Roman', serif";

const TABS = [
  { key: "all", label: "All bills" },
  { key: "next_queue", label: "Next bill" },
  { key: "previous_history", label: "Previous bills" },
  { key: "voted", label: "Voted on" },
  { key: "not_voted", label: "Not voted on" },
];

function RemainingCounter({ counts }) {
  if (!counts) return null;
  return (
    <div style={{ fontSize: 13, color: "#cfd6e6" }}>
      {counts.notVotedCount.toLocaleString()} of {counts.totalActive.toLocaleString()} active bills left to vote on
    </div>
  );
}

function MoneyRow({ label, tone, children }) {
  const [open, setOpen] = useState(false);
  const tones = {
    success: { bg: C.yesLight, color: C.yes },
    danger: { bg: C.noLight, color: C.no },
    warning: { bg: "#FFF8E1", color: "#5C4400" },
    accent: { bg: "#E8EAF6", color: "#1A237E" },
  };
  const t = tones[tone] || tones.accent;
  return (
    <div style={{ borderRadius: 6, marginBottom: 8, overflow: "hidden" }}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
                 background: t.bg, border: "none", padding: "10px 14px", fontSize: 12, fontWeight: 700,
                 color: t.color, letterSpacing: 0.5, textTransform: "uppercase", cursor: "pointer", textAlign: "left" }}>
        <span>{label}</span>
        <span>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ padding: "10px 14px", background: "#fff", fontSize: 13.5, color: C.ink,
                      lineHeight: 1.6, borderTop: "1px solid " + t.color + "33" }}>
          {children}
        </div>
      )}
    </div>
  );
}

function VoteTallyBar({ voteTally }) {
  if (!voteTally || !voteTally.total) return null;
  const yesPct = Math.round((voteTally.yes / voteTally.total) * 100);
  return (
    <div style={{ marginTop: 16, borderTop: "1px solid " + C.line, paddingTop: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
        What the country has voted
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, height: 10, borderRadius: 6, overflow: "hidden", display: "flex", background: "#eee9dc" }}>
          <div style={{ width: yesPct + "%", background: "#4a9d5f" }} />
          <div style={{ width: (100 - yesPct) + "%", background: "#c94f4f" }} />
        </div>
        <span style={{ fontSize: 13, color: C.muted, whiteSpace: "nowrap" }}>
          {yesPct}% yes &middot; {voteTally.total.toLocaleString()} votes
        </span>
      </div>
    </div>
  );
}

export default function BillVotingQueue({ activeBill, counts, currentMode, loading, onNavigate, onCastVote }) {
  return (
    <div style={{ fontFamily: serif, maxWidth: 760, margin: "0 auto" }}>
      <div style={{ background: C.navy, borderRadius: "8px 8px 0 0", padding: "16px 20px", borderBottom: "3px solid " + C.gold }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
          <div style={{ color: C.gold, fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>
            Select a bill to vote on
          </div>
          <RemainingCounter counts={counts} />
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {TABS.map(tab => (
            <button key={tab.key} type="button" onClick={() => onNavigate(tab.key)}
              style={{ background: currentMode === tab.key ? C.gold : "rgba(255,255,255,0.08)",
                       color: currentMode === tab.key ? "#1a1300" : "#e8ecf5",
                       border: "1px solid " + (currentMode === tab.key ? C.gold : "rgba(255,255,255,0.25)"),
                       borderRadius: 6, padding: "10px 16px", fontSize: 13.5, fontFamily: serif,
                       fontWeight: currentMode === tab.key ? 700 : 400, cursor: "pointer", whiteSpace: "nowrap" }}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div style={{ padding: "40px 24px", textAlign: "center", color: C.muted, background: C.parchment,
                      border: "1px solid " + C.line, borderTop: "none", borderRadius: "0 0 8px 8px" }}>
          Loading...
        </div>
      )}

      {!loading && !activeBill && (
        <div style={{ padding: "40px 24px", textAlign: "center", color: C.muted, background: C.parchment,
                      border: "1px solid " + C.line, borderTop: "none", borderRadius: "0 0 8px 8px" }}>
          {currentMode === "not_voted" && counts && counts.notVotedCount === 0
            ? "You are caught up. No active bills left to vote on."
            : currentMode === "voted" && counts && counts.votedCount === 0
            ? "You have not voted on any bills yet."
            : "No bills match this filter yet."}
        </div>
      )}

      {!loading && activeBill && (
        <div style={{ background: C.parchment, border: "1px solid " + C.line, borderTop: "none",
                      borderRadius: "0 0 8px 8px", padding: "20px 24px" }}>
          {activeBill.policyArea && (
            <div style={{ fontSize: 10, color: C.gold, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>
              {activeBill.policyArea} &middot; {activeBill.billNumber}
            </div>
          )}
          <h2 style={{ margin: "0 0 10px", fontSize: 20, color: C.navy, lineHeight: 1.3 }}>{activeBill.title}</h2>
          {activeBill.summary && (
            <p style={{ margin: "0 0 16px", fontSize: 14, color: C.ink, lineHeight: 1.65 }}>{activeBill.summary}</p>
          )}

          {activeBill.sponsor && (
            <div style={{ margin: "0 0 16px", padding: "10px 14px", background: "#fff",
                          border: "1px solid " + C.line, borderRadius: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.navy, letterSpacing: 1, marginBottom: 4 }}>
                INTRODUCED BY
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{activeBill.sponsor}</div>
            </div>
          )}

          {activeBill.whoBenefits && (
            <MoneyRow label="Who benefits if this passes" tone="success">{activeBill.whoBenefits}</MoneyRow>
          )}
          {activeBill.whoWorseOff && (
            <MoneyRow label="Who is worse off if this passes" tone="danger">{activeBill.whoWorseOff}</MoneyRow>
          )}
          {activeBill.pacMoney && (
            <MoneyRow label="PAC and donor money behind this bill" tone="warning">{activeBill.pacMoney}</MoneyRow>
          )}
          {activeBill.industries && (
            <MoneyRow label="Industries with financial stake" tone="accent">{activeBill.industries}</MoneyRow>
          )}

          <VoteTallyBar voteTally={activeBill.voteTally} />

          {activeBill.userPosition ? (
            <div style={{ marginTop: 16, background: C.navy, color: "#fff", borderRadius: 6, padding: "16px",
                          textAlign: "center", fontWeight: 700, fontSize: 15 }}>
              You already voted {activeBill.userPosition.toUpperCase()} on this bill.
              <div style={{ marginTop: 6, fontSize: 12, fontWeight: 400, color: C.gold }}>
                One position per bill, per account. Votes cannot be changed or resubmitted.
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 16, borderTop: "1px solid " + C.line, paddingTop: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>
                Your position
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {["support", "oppose", "undecided"].map(key => (
                  <button key={key} type="button" onClick={() => onCastVote(activeBill.id, key)}
                    style={{ flex: 1, background: "#fff", border: "1px solid " + C.line, borderRadius: 6,
                             padding: 10, fontSize: 14, fontFamily: serif, cursor: "pointer", color: C.ink }}>
                    {key.charAt(0).toUpperCase() + key.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeBill.impact && (
            <div style={{ marginTop: 16, padding: "12px 14px", background: C.navy, borderRadius: 6, color: "#fff" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.gold, letterSpacing: 1, marginBottom: 4 }}>
                IF THIS PASSES: WHAT CHANGES FOR YOU
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.6 }}>{activeBill.impact}</div>
            </div>
          )}

          <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between" }}>
            <button type="button" onClick={() => onNavigate("step_backward")}
              style={{ background: "#fff", border: "1px solid " + C.line, borderRadius: 6, padding: "8px 14px",
                       fontSize: 13, fontFamily: serif, cursor: "pointer", color: C.ink }}>
              Previous
            </button>
            <button type="button" onClick={() => onNavigate("step_forward")}
              style={{ background: "#fff", border: "1px solid " + C.line, borderRadius: 6, padding: "8px 14px",
                       fontSize: 13, fontFamily: serif, cursor: "pointer", color: C.ink }}>
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
