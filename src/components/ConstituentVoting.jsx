// =============================================================================
// ConstituentVoting - curated top-8 bill voting, rendered through BillsView.
// All the protections live here in the container: digest fetch, sign-in gate,
// honeypot + render-timing anti-bot, /api/vote call, already-voted
// enforcement, per-bill tally, and the Contact-Your-Rep flow. BillsView itself
// is presentation-only (it doesn't expose which bill it's showing internally),
// so tally and vote-status are prefetched for the whole curated set up front
// rather than fetched per "active" bill.
// =============================================================================
import React, { useState, useEffect, useCallback, useRef } from "react";
import ContactRep from "./ContactRep.jsx";
import BillsView from "./BillsView.jsx";
import { getStoredSession } from "../lib/session.js";
import "./BillsView.css";

const C = {
  yes: "#1B5E20", yesLight: "#E8F5E9", yesBorder: "#A5D6A7",
  no: "#B71C1C", noLight: "#FFEBEE", noBorder: "#EF9A9A",
  navy: "#0A1A3F", gold: "#C9A227", crimson: "#8B0000",
  parchment: "#FBF7EC", ink: "#1A1A1A", muted: "#5C5347",
  line: "#D8C9A0", panel: "#fff",
};
const serif = "Georgia, 'Times New Roman', serif";

async function fetchDigest(district) {
  const r = await fetch(`/api/digest?district=${encodeURIComponent(district)}`);
  if (!r.ok) throw new Error("digest_unavailable");
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
async function fetchTally(billId) {
  const r = await fetch(`/api/tally?billId=${encodeURIComponent(billId)}`);
  if (!r.ok) throw new Error("tally_unavailable");
  return r.json();
}
async function fetchVoteStatus(billId, token) {
  const url = `/api/vote-status?billId=${encodeURIComponent(billId)}` +
    (token ? `&token=${encodeURIComponent(token)}` : "");
  const r = await fetch(url);
  if (!r.ok) throw new Error("vote_status_unavailable");
  return r.json();
}

function tallyToVoteTally(t) {
  if (!t) return null;
  const verified = t.verified || {};
  const open = t.open || {};
  const yes = (verified.support || 0) + (open.support || 0);
  const no = (verified.oppose || 0) + (open.oppose || 0);
  return { yes, no, total: t.sampleSize || 0 };
}

function adaptBillForView(b, voteTally) {
  return {
    id: b.id,
    billNumber: (b.id || "").replace(/-119$/, "").toUpperCase(),
    title: b.summary?.headline || b.title,
    summary: b.summary?.plain || "",
    sponsor: b.summary?.sponsor || "",
    whoBenefits: b.summary?.who_benefits || "",
    whoWorseOff: b.summary?.who_loses || "",
    pacMoney: b.summary?.pac_money || "",
    industries: b.summary?.industries || "",
    impact: b.summary?.vote_impact || "",
    isActive: true,
    voteTally: voteTally || null,
  };
}

export default function ConstituentVoting({ district, location, session, onNeedDistrict, onNeedSignIn }) {
  const [phase, setPhase] = useState("idle");
  const [bills, setBills] = useState([]);
  const [myDelegate, setMyDelegate] = useState(null);
  const [tallies, setTallies] = useState({});
  const [userVotes, setUserVotes] = useState({});
  const [honeypot, setHoneypot] = useState("");
  const renderedAtRef = useRef(Date.now());
  const [lastAction, setLastAction] = useState(null); // { billId, phase: signin|submitting|done|already|error, position, error, tier }
  const [contactOpenFor, setContactOpenFor] = useState(null);

  // Fall back to localStorage directly if no session prop was passed in
  // (defensive - App.jsx normally supplies this).
  const activeSession = session ?? getStoredSession();

  useEffect(() => {
    if (!district) return;
    setPhase("loading"); setBills([]); setMyDelegate(null);
    setTallies({}); setUserVotes({}); setLastAction(null); setContactOpenFor(null);
    fetchDigest(district)
      .then(data => {
        setMyDelegate(data.rep || null);
        setBills(data.items || []);
        setPhase(data.items?.length ? "ready" : "empty");
        renderedAtRef.current = Date.now();
      })
      .catch(() => setPhase("error"));
  }, [district]);

  // Prefetch tally for every curated bill - BillsView shows a tally bar per
  // bill but doesn't tell the container which one it's currently displaying.
  useEffect(() => {
    if (!bills.length) return;
    let cancelled = false;
    Promise.allSettled(bills.map(b => fetchTally(b.id).then(t => [b.id, t]))).then(results => {
      if (cancelled) return;
      const next = {};
      for (const r of results) {
        if (r.status === "fulfilled") next[r.value[0]] = tallyToVoteTally(r.value[1]);
      }
      setTallies(prev => ({ ...prev, ...next }));
    });
    return () => { cancelled = true; };
  }, [bills]);

  // Prefetch this account's vote status for every curated bill, so the
  // "Voted on" / "Not voted on" filters and existing-position highlight work
  // without a click. Not signed in? Leave userVotes empty - server still
  // enforces sign-in on actual vote attempts.
  useEffect(() => {
    if (!bills.length || !activeSession?.token) return;
    let cancelled = false;
    Promise.allSettled(
      bills.map(b => fetchVoteStatus(b.id, activeSession.token).then(s => [b.id, s]))
    ).then(results => {
      if (cancelled) return;
      const next = {};
      for (const r of results) {
        if (r.status === "fulfilled" && r.value[1]?.voted) next[r.value[0]] = r.value[1].position;
      }
      setUserVotes(prev => ({ ...prev, ...next }));
    });
    return () => { cancelled = true; };
  }, [bills, activeSession?.token]);

  const loadTally = useCallback((billId) => {
    fetchTally(billId)
      .then(t => setTallies(prev => ({ ...prev, [billId]: tallyToVoteTally(t) })))
      .catch(() => {});
  }, []);

  async function castVote(billId, position) {
    if (userVotes[billId]) {
      setLastAction({ billId, phase: "already", position: userVotes[billId] });
      return;
    }
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
        setUserVotes(v => ({ ...v, [billId]: finalPosition }));
        setLastAction({ billId, phase: "already", position: finalPosition });
        return;
      }
      if (res.status === "rejected") {
        if (res.reason === "signin_required") { setLastAction({ billId, phase: "signin" }); return; }
        setLastAction({ billId, phase: "error", error: humanize(res.reason) });
        return;
      }
      setUserVotes(v => ({ ...v, [billId]: position }));
      setLastAction({ billId, phase: "done", position, tier: res.tier });
      setContactOpenFor(billId);
      loadTally(billId);

      // Save to local vote history for the voter profile
      try {
        const bill = bills.find(b => b.id === billId);
        const history = JSON.parse(localStorage.getItem("cyr_votes") || "[]");
        const entry = {
          billId,
          billTitle: bill?.summary?.headline || bill?.title,
          position, district,
          tier: res.tier || "open",
          ts: Date.now(),
        };
        const filtered = history.filter(v => v.billId !== billId);
        filtered.unshift(entry);
        localStorage.setItem("cyr_votes", JSON.stringify(filtered.slice(0, 200)));
      } catch {}
    } catch {
      setLastAction({ billId, phase: "error", error: "Could not reach the server. Try again." });
    }
  }

  if (!district) {
    return (
      <div style={{ fontFamily: serif, maxWidth: 720, margin: "0 auto", textAlign: "center", padding: "40px 24px" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🗳️</div>
        <h2 style={{ color: C.navy, margin: "0 0 12px" }}>Find your district first</h2>
        <p style={{ color: C.muted, marginBottom: 20 }}>We need your address to assign the right bills and record your position accurately.</p>
        <button onClick={() => onNeedDistrict?.()}
          style={{ fontFamily: serif, fontSize: 16, fontWeight: 700, padding: "14px 32px",
                   background: C.navy, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>
          Find My District
        </button>
      </div>
    );
  }

  const activeBillTitle = lastAction ? (bills.find(b => b.id === lastAction.billId)?.summary?.headline
    || bills.find(b => b.id === lastAction.billId)?.title) : null;

  return (
    <div style={{ fontFamily: serif, maxWidth: 760, margin: "0 auto" }}>

      {/* Rep banner */}
      {myDelegate && (
        <div style={{ background: C.navy, color: "#fff", padding: "10px 20px",
                      borderRadius: "8px 8px 0 0", display: "flex", justifyContent: "space-between",
                      alignItems: "center", flexWrap: "wrap", gap: 6 }}>
          <div>
            <div style={{ fontSize: 10, color: C.gold, fontWeight: 700, letterSpacing: 1 }}>YOUR REPRESENTATIVE</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{myDelegate.name}</div>
          </div>
          <div style={{ fontSize: 12, color: "#cfd6e4" }}>{district} · {myDelegate.party}</div>
        </div>
      )}

      {/* Loading / error / empty */}
      {phase === "loading" && (
        <div style={{ padding: "48px 24px", textAlign: "center", color: C.muted, background: C.parchment, borderRadius: myDelegate ? "0 0 8px 8px" : 8 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
          <div>Loading bills from Congress...</div>
        </div>
      )}
      {phase === "error" && (
        <div style={{ padding: "32px 24px", textAlign: "center", background: C.parchment, borderRadius: 8 }}>
          <div style={{ color: C.crimson, marginBottom: 12 }}>Could not load bills. Please try again.</div>
          <button onClick={() => { setPhase("loading"); fetchDigest(district).then(d => { setMyDelegate(d.rep); setBills(d.items||[]); setPhase(d.items?.length?"ready":"empty"); }).catch(()=>setPhase("error")); }}
            style={{ fontFamily: serif, padding: "10px 20px", background: C.navy, color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>
            Try Again
          </button>
        </div>
      )}
      {phase === "empty" && (
        <div style={{ padding: "32px 24px", textAlign: "center", color: C.muted, background: C.parchment, borderRadius: 8 }}>
          No active bills found right now. Check back soon.
        </div>
      )}

      {phase === "ready" && bills.length > 0 && (
        <>
          {/* District badge */}
          <div style={{ margin: "12px 0", padding: "10px 14px", background: "#fff",
                        border: "1px solid "+C.line, borderRadius: 4, fontSize: 13 }}>
            Voting as <strong style={{ color: C.crimson }}>District {district}</strong>
            {location?.city && <span style={{ color: C.muted }}> · {location.city}, {location.state}</span>}
          </div>

          <BillsView
            bills={bills.map(b => adaptBillForView(b, tallies[b.id]))}
            userVotes={userVotes}
            onCastVote={castVote}
          />

          {/* Honeypot - hidden from real voters, bots that fill every field trip it */}
          <input tabIndex={-1} autoComplete="off" value={honeypot}
            onChange={e => setHoneypot(e.target.value)} aria-hidden="true"
            style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }} />

          {/* Status for the most recent vote attempt */}
          {lastAction?.phase === "signin" && (
            <div style={{ margin: "16px 0", padding: 24, background: "#fff",
                          border: "2px solid "+C.crimson, borderRadius: 8, textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>🔒</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: C.navy, marginBottom: 8 }}>
                Sign in to vote
              </div>
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 18, lineHeight: 1.6 }}>
                Every position is tied to one account, so votes stay honest - no anonymous
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
              Recording your vote on {activeBillTitle}...
            </div>
          )}

          {lastAction?.phase === "error" && (
            <div style={{ margin: "16px 0", padding: "10px 12px", borderRadius: 4,
                          background: "#FBE9E7", color: C.crimson, fontSize: 13,
                          border: "1px solid "+C.crimson }}>
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
                You already voted {lastAction.position === "support" ? "YES" : lastAction.position === "oppose" ? "NO" : "Undecided"} on {activeBillTitle}
              </div>
              <div style={{ fontSize: 12, marginTop: 4, color: C.gold }}>
                One position per bill, per account. Votes can't be changed or resubmitted.
              </div>
            </div>
          )}

          {/* Contact rep - available once a position is recorded (this session or a past one) */}
          {lastAction && (lastAction.phase === "done" || lastAction.phase === "already") && (
            <div style={{ margin: "0 0 24px" }}>
              {contactOpenFor !== lastAction.billId && (
                <button onClick={() => setContactOpenFor(lastAction.billId)}
                  style={{ width: "100%", padding: "10px", fontFamily: serif, fontSize: 14,
                           fontWeight: 700, borderRadius: 4, border: "1px solid "+C.line,
                           background: "#fff", color: C.navy, cursor: "pointer" }}>
                  Contact Your Representative About This Bill
                </button>
              )}
              {contactOpenFor === lastAction.billId && (
                <ContactRep district={district} billId={lastAction.billId} billTitle={activeBillTitle}
                  position={lastAction.position} onClose={() => setContactOpenFor(null)} />
              )}
            </div>
          )}
        </>
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
