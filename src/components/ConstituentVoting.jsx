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

const C = {
  yes: "#1B5E20", no: "#B71C1C",
  navy: "#0A1A3F", gold: "#C9A227", crimson: "#8B0000",
  parchment: "#FBF7EC", ink: "#1A1A1A", muted: "#5C5347", line: "#D8C9A0",
};
const serif = "Georgia, 'Times New Roman', serif";
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
  const [mode, setMode] = useState("all");
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
    if (!activeSession?.token) { setLastAction({ billId, phase: "signin" }); return; }

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
        if (res.reason === "signin_required") { setLastAction({ billId, phase: "signin" }); return; }
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

  return (
    <div style={{ fontFamily: serif, maxWidth: 760, margin: "0 auto" }}>
      {district && (
        <div style={{ margin: "0 0 12px", padding: "10px 14px", background: "#fff",
                      border: "1px solid " + C.line, borderRadius: 4, fontSize: 13 }}>
          Voting as <strong style={{ color: C.crimson }}>District {district}</strong>
          {location?.city && <span style={{ color: C.muted }}> · {location.city}, {location.state}</span>}
        </div>
      )}

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
        <div style={{ margin: "16px 0", padding: 24, background: "#fff",
                      border: "2px solid " + C.crimson, borderRadius: 8, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🔒</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: C.navy, marginBottom: 8 }}>
            Sign in to vote
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 18, lineHeight: 1.6 }}>
            Every position is tied to one account, so votes stay honest, no anonymous
            ballots, no repeat voting. Sign-in takes 10 seconds. No password, ever.
          </div>
          <button onClick={() => onNeedSignIn?.()}
            style={{ fontFamily: serif, fontSize: 15, fontWeight: 700, padding: "12px 28px",
                     background: C.crimson, color: "#fff", border: "none", borderRadius: 6,
                     cursor: "pointer" }}>
            Sign In to Vote →
          </button>
        </div>
      )}

      {lastAction?.phase === "submitting" && (
        <div style={{ textAlign: "center", color: C.muted, fontSize: 13, margin: "16px 0" }}>
          Recording your vote on {bannerBillTitle}...
        </div>
      )}

      {lastAction?.phase === "error" && (
        <div style={{ margin: "16px 0", padding: "10px 12px", borderRadius: 4,
                      background: "#FBE9E7", color: C.crimson, fontSize: 13,
                      border: "1px solid " + C.crimson }}>
          {lastAction.error}
        </div>
      )}

      {lastAction?.phase === "done" && (
        <div style={{ margin: "16px 0", padding: "14px 16px", background: C.yes, color: "#fff",
                      borderRadius: 6, textAlign: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 900 }}>
            {lastAction.position === "support" ? "✓ YES recorded" : lastAction.position === "oppose" ? "✗ NO recorded" : "Undecided recorded"}
          </div>
          <div style={{ fontSize: 12, marginTop: 4, opacity: 0.9 }}>
            {lastAction.tier === "verified" ? "Network location matches your district" : "Vote counted"}
          </div>
        </div>
      )}

      {lastAction?.phase === "already" && (
        <div style={{ margin: "16px 0", padding: "14px 16px", background: C.navy, color: "#fff",
                      borderRadius: 6, textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 900 }}>
            You already voted {lastAction.position === "support" ? "YES" : lastAction.position === "oppose" ? "NO" : "Undecided"} on {bannerBillTitle}
          </div>
          <div style={{ fontSize: 12, marginTop: 4, color: C.gold }}>
            One position per bill, per account. Votes can't be changed or resubmitted.
          </div>
        </div>
      )}

      {lastAction && (lastAction.phase === "done" || lastAction.phase === "already") && (
        <div style={{ margin: "0 0 24px" }}>
          {contactOpenFor !== lastAction.billId && (
            <button onClick={() => setContactOpenFor(lastAction.billId)}
              style={{ width: "100%", padding: "10px", fontFamily: serif, fontSize: 14,
                       fontWeight: 700, borderRadius: 4, border: "1px solid " + C.line,
                       background: "#fff", color: C.navy, cursor: "pointer" }}>
              Contact Your Representative About This Bill
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
