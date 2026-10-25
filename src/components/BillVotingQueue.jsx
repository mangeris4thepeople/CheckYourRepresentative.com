// =============================================================================
// BillVotingQueue - the real "select a bill to vote on" panel, in the October
// 2026 "Bright Republic" look: a filter card with segmented pills, a hero
// style bill card, four expandable money and benefit sections, the national
// tally, and big color coded Support / Oppose / Undecided pills.
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
import { Seg, TallyBar, Loading, Empty } from "./ui/Kit.jsx";

const C = {
  navy: "#0E2A6B", blue: "#2563EB", gold: "#F5B82E",
  green: "#16A34A", red: "#DC2626",
  ink: "#0F172A", muted: "#5B6578", line: "#E2E8F0", soft: "#F6F8FC",
};
const sans = "var(--cyr-sans)";
const mono = "var(--cyr-mono)";

const TABS = [
  { key: "all", label: "All bills" },
  { key: "next_queue", label: "Next bill" },
  { key: "previous_history", label: "Previous bills" },
  { key: "voted", label: "Voted on" },
  { key: "not_voted", label: "Not voted on" },
];

// Big friendly vote pills. Colors match the tally bar: green, red, slate.
const VOTE_PILLS = [
  { key: "support", label: "Support", icon: "✓", bg: "linear-gradient(135deg,#16A34A,#22C55E)", fg: "#fff", shadow: "rgba(22,163,74,.32)" },
  { key: "oppose", label: "Oppose", icon: "✕", bg: "linear-gradient(135deg,#DC2626,#F43F5E)", fg: "#fff", shadow: "rgba(220,38,38,.30)" },
  { key: "undecided", label: "Undecided", icon: "?", bg: "#fff", fg: "#334155", shadow: "rgba(15,23,42,.08)", border: "#CBD5E1" },
];

const POSITION_STYLE = {
  support: { label: "Support", color: "#15803D", soft: "#ECFDF3", border: "#BBF7D0", icon: "✓" },
  oppose: { label: "Oppose", color: "#B91C1C", soft: "#FEF2F2", border: "#FECACA", icon: "✕" },
  undecided: { label: "Undecided", color: "#475569", soft: "#F1F5F9", border: "#E2E8F0", icon: "?" },
};

const SCOPED_CSS = `
  .cyr-vq-pill { transition: transform .15s ease, box-shadow .2s ease, filter .2s ease; }
  .cyr-vq-pill:not(:disabled):hover { transform: translateY(-2px); filter: saturate(1.08); }
  .cyr-vq-sec:hover { background: #F8FAFE !important; }
  .cyr-vq-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
  @media (max-width: 560px) {
    .cyr-vq-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .cyr-vq-grid > :last-child { grid-column: 1 / -1; }
    .cyr-vq-filters .cyr-seg { flex-wrap: wrap; border-radius: 18px; }
    .cyr-vq-hero { padding: 22px 18px 20px !important; }
    .cyr-vq-body { padding: 18px 16px 20px !important; }
  }
`;

function RemainingCounter({ counts }) {
  if (!counts) return null;
  return (
    <div style={{ fontSize: 13, color: C.muted, display: "inline-flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
      <strong className="cyr-num" style={{ fontSize: 17, color: C.navy }}>{counts.notVotedCount.toLocaleString()}</strong>
      <span>of {counts.totalActive.toLocaleString()} active bills left to vote on</span>
    </div>
  );
}

function MoneyRow({ label, tone, icon, children }) {
  const [open, setOpen] = useState(false);
  const tones = {
    success: { color: "#15803D", soft: "#ECFDF3", ring: "#BBF7D0" },
    danger: { color: "#B91C1C", soft: "#FEF2F2", ring: "#FECACA" },
    warning: { color: "#B45309", soft: "#FFF7E6", ring: "#FDE3A7" },
    accent: { color: "#1D4ED8", soft: "#EEF4FF", ring: "#C7D7FE" },
  };
  const t = tones[tone] || tones.accent;
  return (
    <div style={{ border: `1px solid ${open ? t.ring : C.line}`, borderRadius: 16, overflow: "hidden", background: "#fff",
                  transition: "border-color .2s ease" }}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="cyr-vq-sec"
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, background: "#fff", border: 0,
                 padding: "12px 14px", minHeight: 56, cursor: "pointer", textAlign: "left", fontFamily: sans }}>
        <span aria-hidden style={{ width: 36, height: 36, borderRadius: 12, background: t.soft, color: t.color, flexShrink: 0,
                                   display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>
          {icon}
        </span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700, color: C.ink, lineHeight: 1.3 }}>{label}</span>
        <span aria-hidden style={{ width: 28, height: 28, borderRadius: 99, background: open ? t.soft : "#F1F5F9", color: open ? t.color : C.muted,
                                   display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                                   fontSize: 12, transform: open ? "rotate(180deg)" : "none", transition: "transform .2s ease" }}>
          ▼
        </span>
      </button>
      {open && (
        <div className="cyr-rise" style={{ padding: "2px 16px 16px 62px", fontSize: 14.5, color: "#1F2937", lineHeight: 1.65,
                                           animationDuration: ".3s" }}>
          <div style={{ borderLeft: `3px solid ${t.ring}`, paddingLeft: 12 }}>{children}</div>
        </div>
      )}
    </div>
  );
}

function VoteTallyBar({ voteTally }) {
  if (!voteTally || !voteTally.total) return null;
  const yesPct = Math.round((voteTally.yes / voteTally.total) * 100);
  const noPct = Math.round((voteTally.no / voteTally.total) * 100);
  const other = Math.max(0, voteTally.total - voteTally.yes - voteTally.no);
  return (
    <div style={{ marginTop: 18, padding: "16px 16px 14px", borderRadius: 16, background: C.soft, border: `1px solid ${C.line}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: C.navy }}>What the country has voted</div>
        <div style={{ fontSize: 13, color: C.muted }}>
          <strong className="cyr-num" style={{ color: C.ink, fontSize: 15 }}>{voteTally.total.toLocaleString()}</strong> votes
        </div>
      </div>
      <TallyBar support={voteTally.yes} oppose={voteTally.no} other={other} height={14} />
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 10, fontSize: 13, color: C.muted }}>
        <Legend color="#16A34A" label={`${yesPct}% yes`} />
        <Legend color="#DC2626" label={`${noPct}% no`} />
        {other > 0 && <Legend color="#CBD5E1" label={`${other.toLocaleString()} undecided`} />}
      </div>
    </div>
  );
}

function Legend({ color, label }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
      <span aria-hidden style={{ width: 10, height: 10, borderRadius: 99, background: color }} />{label}
    </span>
  );
}

export default function BillVotingQueue({ activeBill, counts, currentMode, loading, onNavigate, onCastVote }) {
  const pos = activeBill?.userPosition ? (POSITION_STYLE[activeBill.userPosition] || POSITION_STYLE.undecided) : null;
  return (
    <div style={{ fontFamily: sans, maxWidth: 820, margin: "0 auto" }}>
      <style>{SCOPED_CSS}</style>

      {/* Filter card */}
      <div className="cyr-card cyr-vq-filters" style={{ padding: "16px 18px", marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <div className="cyr-h2" style={{ fontSize: 19 }}>Select a bill to vote on</div>
          <RemainingCounter counts={counts} />
        </div>
        <Seg options={TABS.map(t => ({ value: t.key, label: t.label }))} value={currentMode} onChange={onNavigate} />
      </div>

      {loading && (
        <div className="cyr-card" style={{ padding: 18 }}>
          <div className="cyr-skeleton" style={{ height: 150, borderRadius: 18, marginBottom: 14 }} />
          <Loading rows={4} height={56} />
        </div>
      )}

      {!loading && !activeBill && (
        <div className="cyr-card">
          <Empty icon={currentMode === "not_voted" && counts && counts.notVotedCount === 0 ? "🎉" : "🗳️"}
            title={currentMode === "not_voted" && counts && counts.notVotedCount === 0 ? "All caught up" : "Nothing here yet"}>
            {currentMode === "not_voted" && counts && counts.notVotedCount === 0
              ? "You are caught up. No active bills left to vote on."
              : currentMode === "voted" && counts && counts.votedCount === 0
              ? "You have not voted on any bills yet."
              : "No bills match this filter yet."}
          </Empty>
        </div>
      )}

      {!loading && activeBill && (
        <article className="cyr-card cyr-rise" style={{ overflow: "hidden", borderRadius: 24, boxShadow: "var(--cyr-shadow-lg)" }}>
          {/* Hero header */}
          <div className="cyr-hero cyr-vq-hero" style={{ padding: "28px 28px 26px", borderRadius: 0, boxShadow: "none" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {activeBill.billNumber && (
                <span style={{ fontFamily: mono, fontSize: 12.5, fontWeight: 700, background: "rgba(255,255,255,.16)",
                               border: "1px solid rgba(255,255,255,.3)", borderRadius: 999, padding: "4px 11px" }}>
                  {activeBill.billNumber}
                </span>
              )}
              {activeBill.policyArea && (
                <span style={{ fontSize: 12.5, fontWeight: 700, background: "rgba(245,184,46,.22)", color: "#FFE29A",
                               borderRadius: 999, padding: "4px 11px" }}>
                  {activeBill.policyArea}
                </span>
              )}
              {pos && (
                <span style={{ fontSize: 12.5, fontWeight: 800, background: "#fff", color: pos.color, borderRadius: 999, padding: "4px 11px" }}>
                  {pos.icon} You voted {pos.label.toLowerCase()}
                </span>
              )}
            </div>
            <h2 className="cyr-h1" style={{ fontSize: "clamp(23px, 3.4vw, 32px)", margin: "14px 0 0", lineHeight: 1.15, overflowWrap: "anywhere" }}>
              {activeBill.title}
            </h2>
          </div>

          <div className="cyr-vq-body" style={{ padding: "22px 26px 24px" }}>
            {activeBill.summary && (
              <p style={{ margin: "0 0 18px", fontSize: 16, color: "#1F2937", lineHeight: 1.7 }}>{activeBill.summary}</p>
            )}

            {activeBill.sponsor && (
              <div className="cyr-row" style={{ marginBottom: 18, background: C.soft }}>
                <span aria-hidden style={{ width: 40, height: 40, borderRadius: 99, background: "#E8F0FF", color: C.blue, flexShrink: 0,
                                           display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🏛️</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: C.muted }}>Introduced by</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.ink, overflowWrap: "anywhere" }}>{activeBill.sponsor}</div>
                </div>
              </div>
            )}

            {(activeBill.whoBenefits || activeBill.whoWorseOff || activeBill.pacMoney || activeBill.industries) && (
              <div style={{ display: "grid", gap: 8 }}>
                {activeBill.whoBenefits && (
                  <MoneyRow label="Who benefits if this passes" tone="success" icon="✅">{activeBill.whoBenefits}</MoneyRow>
                )}
                {activeBill.whoWorseOff && (
                  <MoneyRow label="Who is worse off if this passes" tone="danger" icon="❌">{activeBill.whoWorseOff}</MoneyRow>
                )}
                {activeBill.pacMoney && (
                  <MoneyRow label="PAC and donor money behind this bill" tone="warning" icon="💰">{activeBill.pacMoney}</MoneyRow>
                )}
                {activeBill.industries && (
                  <MoneyRow label="Industries with financial stake" tone="accent" icon="🏭">{activeBill.industries}</MoneyRow>
                )}
              </div>
            )}

            <VoteTallyBar voteTally={activeBill.voteTally} />

            {pos ? (
              <div style={{ marginTop: 18, padding: "18px 18px", borderRadius: 18, background: pos.soft, border: `1px solid ${pos.border}`,
                            display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                <span aria-hidden style={{ width: 46, height: 46, borderRadius: 99, background: pos.color, color: "#fff", flexShrink: 0,
                                           display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 900 }}>
                  {pos.icon}
                </span>
                <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                  <div style={{ fontSize: 16.5, fontWeight: 800, color: C.ink }}>
                    You already voted {pos.label} on this bill.
                  </div>
                  <div style={{ marginTop: 3, fontSize: 13.5, color: C.muted }}>
                    One position per bill, per account. Votes cannot be changed or resubmitted.
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.navy, marginBottom: 10 }}>Your position</div>
                <div className="cyr-vq-grid">
                  {VOTE_PILLS.map(p => (
                    <button key={p.key} type="button" onClick={() => onCastVote(activeBill.id, p.key)} className="cyr-vq-pill"
                      style={{ minHeight: 60, borderRadius: 999, border: `1.5px solid ${p.border || "transparent"}`, background: p.bg,
                               color: p.fg, fontFamily: sans, fontSize: 17, fontWeight: 800, cursor: "pointer",
                               display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "0 18px",
                               boxShadow: `0 10px 22px ${p.shadow}` }}>
                      <span aria-hidden style={{ width: 28, height: 28, borderRadius: 99, display: "inline-flex", alignItems: "center",
                                                 justifyContent: "center", fontSize: 15, fontWeight: 900,
                                                 background: p.key === "undecided" ? "#F1F5F9" : "rgba(255,255,255,.24)" }}>
                        {p.icon}
                      </span>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeBill.impact && (
              <div style={{ marginTop: 18, padding: "16px 18px", borderRadius: 18,
                            background: "linear-gradient(135deg,#EEF4FF 0%,#F5F0FF 100%)", border: "1px solid #D6E2FB" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 800, color: C.navy, marginBottom: 6 }}>
                  <span aria-hidden>💡</span> If this passes: what changes for you
                </div>
                <div style={{ fontSize: 15, lineHeight: 1.65, color: "#1F2937" }}>{activeBill.impact}</div>
              </div>
            )}

            <div style={{ marginTop: 20, display: "flex", justifyContent: "space-between", gap: 10 }}>
              <button type="button" onClick={() => onNavigate("step_backward")} className="cyr-btn cyr-btn-ghost"
                style={{ minHeight: 44, padding: "10px 18px" }}>
                <span aria-hidden>←</span> Previous
              </button>
              <button type="button" onClick={() => onNavigate("step_forward")} className="cyr-btn cyr-btn-ghost"
                style={{ minHeight: 44, padding: "10px 18px" }}>
                Next <span aria-hidden>→</span>
              </button>
            </div>
          </div>
        </article>
      )}
    </div>
  );
}
