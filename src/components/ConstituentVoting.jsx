// =============================================================================
// ConstituentVoting - the Vote on Bills page container.
//
// With 17,000+ active bills, the full set can never be loaded into the
// browser. Every navigation action (a tab click, Next, Previous) asks the
// database for exactly one bill via /api/vote-queue-item, which is the only
// place "which bill and vote status is currently shown" is decided. There is
// no separate client-side filtering step and no second "last voted" value
// anywhere else in this file, so the bill card and the vote-status banner
// can never disagree with each other.
//
// This container owns the protections that live outside that single query:
// sign-in gating, the honeypot and render-timing anti-bot fields, the actual
// /api/vote call, already-voted enforcement, and the Contact-Your-Rep flow.
// =============================================================================
import React, { useState, useEffect, useCallback, useRef } from "react";
import ContactRep from "./ContactRep.jsx";
import BillVotingQueue from "./BillVotingQueue.jsx";
import { getStoredSession } from "../lib/session.js";
import { PageHero, ErrorBox } from "./ui/Kit.jsx";

const C = {
  navy: "#0E2A6B", red: "#E0313F", ink: "#0F172A", muted: "#5B6578", line: "#E2E8F0",
};
const sans = "var(--cyr-sans)";
const VOTED_MODES = new Set(["voted", "previous_history"]);

async function fetchCounts(token) {
  const r = await fetch(`/api/vote-queue-counts?token=${encodeURIComponent(token || "")}`);
  if (!r.ok) throw new Error("counts_unavailable");
  return r.json();
}
async function fetchQueueItem({ mode, direction, token, cursor }) {
  const params = new URLSearchParams({ mode, direction, token: token || "" });
  if (cursor?.cursorId) { params.set("cursorId", cursor.cursorId); params.set("cursorDate", cursor.cursorDate); }
  if (cursor?.cursorVoteId) { params.set("cursorVoteId", cursor.cursorVoteId); params.set("cursorVotedAt", cursor.cursorVotedAt); }
  const r = await fetch(`/api/vote-queue-item?${params}`);
  if (!r.ok) throw new Error("queue_item_unavailable");
  return r.json();
}
async function fetchDetail(billId) {
  const r = await fetch(`/api/bill-detail?billId=${encodeURIComponent(billId)}`);
  if (!r.ok) throw new Error("detail_failed");
  return r.json();
}
async function fetchTally(billId) {
  const r = await fetch(`/api/tally?billId=${encodeURIComponent(billId)}`);
  if (!r.ok) throw new Error("tally_failed");
  return r.json();
}
async function castVoteApi(payload) {
  const r = await fetch("/api/vote", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error("vote_api_error");
  return r.json();
}

function tallyToVoteTally(t) {
  if (!t) return null;
  const verified = t.verified || {};
  const open = t.open || {};
  return {
    yes: (verified.support || 0) + (open.support || 0),
    no: (verified.oppose || 0) + (open.oppose || 0),
    total: t.sampleSize || 0,
  };
}

function cursorFor(mode, item) {
  if (!item) return null;
  if (VOTED_MODES.has(mode)) return { cursorVoteId: item.voteRowId, cursorVotedAt: item.votedAt };
  return { cursorId: item.id, cursorDate: item.actionDate };
}

export default function ConstituentVoting({ district, location, session, onNeedSignIn }) {
  // Opens on the freshest active bill the visitor has not voted on yet,
  // rather than "All bills" which could show something already voted on.
  const [mode, setMode] = useState("next_queue");
  const [counts, setCounts] = useState(null);
  const [queueItem, setQueueItem] = useState(null);
  const [detail, setDetail] = useState(null);
  const [tally, setTally] = useState(null);
  const [itemLoading, setItemLoading] = useState(true);
  const [honeypot, setHoneypot] = useState("");
  const renderedAtRef = useRef(Date.now());
  const [lastAction, setLastAction] = useState(null); // { billId, phase: signin|submitting|done|already|error, position, error, tier }
  const [contactOpenFor, setContactOpenFor] = useState(null);

  // Fall back to localStorage directly if no session prop was passed in
  // (defensive - App.jsx normally supplies this).
  const activeSession = session ?? getStoredSession();

  const loadItem = useCallback(async (targetMode, direction, cursor) => {
    setItemLoading(true);
    setLastAction(null);
    try {
      const data = await fetchQueueItem({ mode: targetMode, direction, token: activeSession?.token, cursor });
      setMode(targetMode);
      setQueueItem(data.item || null);
      if (data.item) {
        const [d, t] = await Promise.allSettled([fetchDetail(data.item.id), fetchTally(data.item.id)]);
        setDetail(d.status === "fulfilled" ? d.value : null);
        setTally(t.status === "fulfilled" ? tallyToVoteTally(t.value) : null);
      } else {
        setDetail(null);
        setTally(null);
      }
    } catch {
      setQueueItem(null); setDetail(null); setTally(null);
    } finally {
      setItemLoading(false);
    }
  }, [activeSession?.token]);

  // Runs on mount, and again whenever sign-in state changes (a bill's vote
  // status and the header counts both depend on who is signed in).
  useEffect(() => {
    fetchCounts(activeSession?.token).then(setCounts).catch(() => {});
    loadItem(mode, "forward", null);
    // Only the token should restart this - re-running on every mode change
    // would fight with handleNavigate's own explicit loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSession?.token]);

  function handleNavigate(action) {
    if (action === "step_forward") { loadItem(mode, "forward", cursorFor(mode, queueItem)); return; }
    if (action === "step_backward") { loadItem(mode, "backward", cursorFor(mode, queueItem)); return; }

    // Re-clicking the Next bill / Previous bills tab while already in that
    // mode advances the queue one more step, per the spec. Any other tab
    // click (including re-clicking All bills / Voted on / Not voted on)
    // resets to the start of that filtered set.
    const isQueueAdvance = (action === "next_queue" || action === "previous_history") && action === mode;
    loadItem(action, "forward", isQueueAdvance ? cursorFor(mode, queueItem) : null);
  }

  const activeBillView = queueItem ? {
    id: queueItem.id,
    billNumber: (queueItem.id || "").replace(/-119$/, "").toUpperCase(),
    policyArea: queueItem.policyArea,
    title: detail?.summary?.headline || detail?.title || queueItem.title,
    summary: detail?.summary?.plain || "",
    sponsor: detail?.summary?.sponsor || "",
    whoBenefits: detail?.summary?.who_benefits || "",
    whoWorseOff: detail?.summary?.who_loses || "",
    pacMoney: detail?.summary?.pac_money || "",
    industries: detail?.summary?.industries || "",
    impact: detail?.summary?.vote_impact || "",
    voteTally: tally,
    userPosition: queueItem.userPosition || null,
  } : null;

  async function castVote(billId, position) {
    if (lastAction?.billId === billId && lastAction.phase === "submitting") return;
    if (!activeSession?.token) {
      setLastAction({ billId, phase: "signin" });
      // Anonymous counter: a signed-out visitor tried to vote, the moment
      // of intent the sign-in funnel exists to capture. See /privacy.
      fetch("/api/metric?m=vote_intent", { method: "POST" }).catch(() => {});
      return;
    }

    setLastAction({ billId, phase: "submitting", position });
    try {
      const res = await castVoteApi({
        billId, position, district,
        honeypot, renderedAt: renderedAtRef.current,
        sessionToken: activeSession.token,
      });
      if (res.status === "already_voted") {
        const finalPosition = res.position || position;
        setQueueItem(q => (q && q.id === billId) ? { ...q, userPosition: finalPosition } : q);
        setLastAction({ billId, phase: "already", position: finalPosition });
        fetchCounts(activeSession.token).then(setCounts).catch(() => {});
        return;
      }
      if (res.status === "rejected") {
        if (res.reason === "signin_required") {
          setLastAction({ billId, phase: "signin" });
          fetch("/api/metric?m=vote_intent", { method: "POST" }).catch(() => {});
          return;
        }
        setLastAction({ billId, phase: "error", error: humanize(res.reason) });
        return;
      }

      setQueueItem(q => (q && q.id === billId) ? { ...q, userPosition: position } : q);
      setLastAction({ billId, phase: "done", position, tier: res.tier });
      setContactOpenFor(billId);
      fetchCounts(activeSession.token).then(setCounts).catch(() => {});
      fetchTally(billId).then(t => setTally(tallyToVoteTally(t))).catch(() => {});

      try {
        const history = JSON.parse(localStorage.getItem("cyr_votes") || "[]");
        const entry = {
          billId, billTitle: activeBillView?.id === billId ? activeBillView.title : billId,
          position, district, tier: res.tier || "open", ts: Date.now(),
        };
        const filtered = history.filter(v => v.billId !== billId);
        filtered.unshift(entry);
        localStorage.setItem("cyr_votes", JSON.stringify(filtered.slice(0, 200)));
      } catch {}
    } catch {
      setLastAction({ billId, phase: "error", error: "Could not reach the server. Try again." });
    }
  }

  const bannerBillTitle = (lastAction && activeBillView && lastAction.billId === activeBillView.id)
    ? activeBillView.title : "this bill";

  const posWord = p => p === "support" ? "Support" : p === "oppose" ? "Oppose" : "Undecided";
  const posColor = p => p === "support" ? "#16A34A" : p === "oppose" ? "#DC2626" : "#64748B";
  const posIcon = p => p === "support" ? "✓" : p === "oppose" ? "✕" : "?";

  return (
    <div style={{ fontFamily: sans, maxWidth: 820, margin: "0 auto" }}>
      <PageHero
        compact
        eyebrow="Vote on bills"
        title="Put your position on the record"
        lede="Every active bill, explained in plain language with the money trail behind it. Read it, then cast your position."
        chips={[
          counts ? { value: counts.totalActive, label: "active bills" } : null,
          counts && activeSession ? { value: counts.votedCount, label: "voted on by you" } : null,
        ]}>
        {(district || !activeSession) && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 16 }}>
            {district && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#fff", color: C.navy,
                             borderRadius: 18, padding: "8px 14px", fontSize: 13.5, fontWeight: 600, maxWidth: "100%" }}>
                <span aria-hidden>📍</span>
                <span style={{ minWidth: 0 }}>
                  Voting as <strong style={{ color: C.red }}>District {district}</strong>
                  {location?.city && <span style={{ color: C.muted }}> · {location.city}, {location.state}</span>}
                </span>
              </span>
            )}
            {!activeSession && (
              <button type="button" className="cyr-btn cyr-btn-gold" onClick={() => onNeedSignIn?.()} style={{ minHeight: 42 }}>
                <span aria-hidden>🔒</span> Sign in to vote
              </button>
            )}
          </div>
        )}
      </PageHero>

      <BillVotingQueue
        activeBill={activeBillView}
        counts={counts}
        currentMode={mode}
        loading={itemLoading}
        onNavigate={handleNavigate}
        onCastVote={castVote}
      />

      {/* Honeypot - hidden from real voters, bots that fill every field trip it */}
      <input tabIndex={-1} autoComplete="off" value={honeypot}
        onChange={e => setHoneypot(e.target.value)} aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }} />

      {lastAction?.phase === "signin" && (
        <div className="cyr-card cyr-rise" style={{ margin: "16px 0", padding: "28px 22px", textAlign: "center", borderRadius: 24,
                                                    background: "linear-gradient(180deg,#FFFFFF 0%,#F3F7FF 100%)", borderColor: "#C9D7F2" }}>
          <div aria-hidden style={{ width: 64, height: 64, borderRadius: 99, margin: "0 auto 12px", background: "#E8F0FF",
                                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>🔒</div>
          <div className="cyr-h2" style={{ fontSize: 24, marginBottom: 8 }}>Sign in to vote</div>
          <div style={{ fontSize: 15, color: C.muted, margin: "0 auto 20px", lineHeight: 1.65, maxWidth: 460 }}>
            Every position is tied to one account, so votes stay honest, no anonymous
            ballots, no repeat voting. Sign-in takes 10 seconds. No password, ever.
          </div>
          <button onClick={() => onNeedSignIn?.()} className="cyr-btn cyr-btn-primary"
            style={{ fontSize: 16, padding: "14px 28px", minHeight: 50 }}>
            Sign in to vote <span aria-hidden>→</span>
          </button>
        </div>
      )}

      {lastAction?.phase === "submitting" && (
        <div className="cyr-card" style={{ margin: "16px 0", padding: "14px 16px", display: "flex", alignItems: "center", gap: 12,
                                           color: C.muted, fontSize: 14 }}>
          <span aria-hidden className="cyr-skeleton" style={{ width: 22, height: 22, borderRadius: 99, flexShrink: 0 }} />
          <span style={{ minWidth: 0 }}>Recording your vote on {bannerBillTitle}...</span>
        </div>
      )}

      {lastAction?.phase === "error" && (
        <div style={{ margin: "16px 0" }}>
          <ErrorBox>{lastAction.error}</ErrorBox>
        </div>
      )}

      {lastAction?.phase === "done" && (
        <div className="cyr-card cyr-rise" style={{ margin: "16px 0", padding: "18px 18px", borderRadius: 20, background: "#ECFDF3",
                                                    borderColor: "#BBF7D0", display: "flex", alignItems: "center", gap: 14 }}>
          <span aria-hidden style={{ width: 48, height: 48, borderRadius: 99, background: posColor(lastAction.position), color: "#fff",
                                     flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center",
                                     fontSize: 22, fontWeight: 900 }}>
            {posIcon(lastAction.position)}
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#14532D" }}>
              {lastAction.position === "support" ? "Yes recorded" : lastAction.position === "oppose" ? "No recorded" : "Undecided recorded"}
            </div>
            <div style={{ fontSize: 13.5, marginTop: 2, color: "#166534" }}>
              {lastAction.tier === "verified" ? "Network location matches your district" : "Vote counted"}
            </div>
          </div>
        </div>
      )}

      {lastAction?.phase === "already" && (
        <div className="cyr-card cyr-rise" style={{ margin: "16px 0", padding: "18px 18px", borderRadius: 20, background: "#EEF4FF",
                                                    borderColor: "#C9D7F2", display: "flex", alignItems: "center", gap: 14 }}>
          <span aria-hidden style={{ width: 48, height: 48, borderRadius: 99, background: posColor(lastAction.position), color: "#fff",
                                     flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center",
                                     fontSize: 22, fontWeight: 900 }}>
            {posIcon(lastAction.position)}
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16.5, fontWeight: 800, color: C.navy, overflowWrap: "anywhere" }}>
              You already voted {posWord(lastAction.position)} on {bannerBillTitle}
            </div>
            <div style={{ fontSize: 13.5, marginTop: 2, color: C.muted }}>
              One position per bill, per account. Votes can't be changed or resubmitted.
            </div>
          </div>
        </div>
      )}

      {lastAction && (lastAction.phase === "done" || lastAction.phase === "already") && (
        <div style={{ margin: "0 0 24px" }}>
          {contactOpenFor !== lastAction.billId && (
            <button onClick={() => setContactOpenFor(lastAction.billId)} className="cyr-btn cyr-btn-ghost"
              style={{ width: "100%", justifyContent: "center", minHeight: 50, fontSize: 15, whiteSpace: "normal", textAlign: "center" }}>
              <span aria-hidden>✉️</span> Contact Your Representative About This Bill
            </button>
          )}
          {contactOpenFor === lastAction.billId && (
            <ContactRep district={district} billId={lastAction.billId} billTitle={bannerBillTitle}
              position={lastAction.position} onClose={() => setContactOpenFor(null)} />
          )}
        </div>
      )}
    </div>
  );
}

function humanize(reason) {
  const m = {
    honeypot_tripped: "This submission looked automated.",
    too_fast: "Submitted too quickly. Please review the bill first.",
    rate_ip: "Too many votes from your connection. Try later.",
    rate_subnet: "Too many votes from your network. Try later.",
    missing_fields: "Please select a position.",
    signin_required: "Please sign in to vote.",
  };
  return m[reason] || "Could not record your vote. Please try again.";
}
