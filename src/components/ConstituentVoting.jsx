// =============================================================================
// ConstituentVoting — real bills from /api/digest, real voting via /api/vote
// No mock data. No Turnstile placeholder. Bot protection via honeypot + timing.
// Critical variable names preserved: myDelegate, delegateVotes, DELEGATES_DB
// =============================================================================
import React, { useState, useEffect, useCallback } from "react";
import ContactRep from "./ContactRep.jsx";

const C = {
  crimson: "#8B0000", crimsonBright: "#B22234",
  navy: "#0A1A3F", gold: "#C9A227",
  parchment: "#FBF7EC", parchmentEdge: "#F0E6CE",
  ink: "#1A1A1A", muted: "#5C5347", line: "#D8C9A0",
};
const serif = "Georgia, 'Times New Roman', serif";

const POSITIONS = [
  { key: "support",   label: "Support",   color: C.navy },
  { key: "oppose",    label: "Oppose",    color: C.crimson },
  { key: "undecided", label: "Undecided", color: C.muted },
];

// ---------------------------------------------------------------------------
// API helpers — no mocks, degrade gracefully on failure
// ---------------------------------------------------------------------------
async function fetchDigest(district) {
  const res = await fetch(`/api/digest?district=${encodeURIComponent(district)}`);
  if (!res.ok) throw new Error("digest_unavailable");
  return res.json();
}

async function castVoteApi(payload) {
  const res = await fetch("/api/vote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("vote_api_error");
  return res.json();
}

async function fetchTally(billId) {
  const res = await fetch(`/api/tally?billId=${encodeURIComponent(billId)}`);
  if (!res.ok) throw new Error("tally_unavailable");
  return res.json();
}

// ---------------------------------------------------------------------------
export default function ConstituentVoting({ district, location, onNeedDistrict }) {
  const [digestPhase, setDigestPhase] = useState("idle"); // idle|loading|ready|error
  const [bills, setBills]             = useState([]);
  const [myDelegate, setMyDelegate]   = useState(null);
  const [activeBillIdx, setActiveBillIdx] = useState(0);

  // Per-bill vote state
  const [selected, setSelected]       = useState(null);
  const [honeypot, setHoneypot]       = useState("");
  const [renderedAt]                  = useState(() => Date.now());
  const [phase, setPhase]             = useState("idle"); // idle|submitting|done|error
  const [showContact, setShowContact] = useState(false);
  const [result, setResult]           = useState(null);
  const [delegateVotes, setDelegateVotes] = useState(null);
  const [voteError, setVoteError]     = useState(null);

  const activeBill = bills[activeBillIdx] || null;

  // Load bills when district changes
  useEffect(() => {
    if (!district) return;
    setDigestPhase("loading");
    setBills([]);
    setMyDelegate(null);
    resetVoteState();
    fetchDigest(district)
      .then(data => {
        setMyDelegate(data.rep || null);
        setBills(data.items || []);
        setDigestPhase(data.items?.length ? "ready" : "empty");
      })
      .catch(() => setDigestPhase("error"));
  }, [district]);

  // Load tally when active bill changes
  const refreshTally = useCallback(async () => {
    if (!activeBill?.id) return;
    try {
      const t = await fetchTally(activeBill.id);
      setDelegateVotes(t);
    } catch { /* non-fatal */ }
  }, [activeBill?.id]);

  useEffect(() => {
    setDelegateVotes(null);
    refreshTally();
  }, [refreshTally]);

  function resetVoteState() {
    setSelected(null);
    setPhase("idle");
    setShowContact(false);
    setResult(null);
    setDelegateVotes(null);
    setVoteError(null);
  }

  function selectBill(idx) {
    setActiveBillIdx(idx);
    resetVoteState();
  }

  const canSubmit = district && selected && phase !== "submitting";

  async function submitVote() {
    if (!canSubmit || !activeBill) return;
    setPhase("submitting");
    setVoteError(null);
    try {
      const res = await castVoteApi({
        billId: activeBill.id,
        position: selected,
        district,
        honeypot,
        renderedAt,
        voteToken: null,
      });
      if (res.status === "rejected") {
        setVoteError(humanizeReason(res.reason));
        setPhase("error");
        return;
      }
      setResult(res);
      setPhase("done");
      setShowContact(true);
      refreshTally();
    } catch {
      setVoteError("Couldn't reach the server. Please try again.");
      setPhase("error");
    }
  }

  // No district yet
  if (!district) {
    return (
      <div style={{ fontFamily: serif, color: C.ink, background: C.parchment,
                    border: `1px solid ${C.line}`, borderRadius: 6, overflow: "hidden",
                    maxWidth: 720, margin: "0 auto" }}>
        <StarStrip />
        <div style={{ padding: "26px 24px", textAlign: "center" }}>
          <h2 style={{ margin: "0 0 8px", fontSize: 20, color: C.navy }}>Confirm your district first</h2>
          <p style={{ fontSize: 13.5, color: C.muted, margin: "0 auto 16px", maxWidth: 430 }}>
            We need your congressional district to show the right bills and record your position accurately.
          </p>
          <button onClick={() => onNeedDistrict?.()}
            style={{ padding: "11px 22px", fontFamily: serif, fontSize: 15, fontWeight: 700,
                     border: "none", borderRadius: 4, background: C.navy, color: "#fff", cursor: "pointer" }}>
            Find My District
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: serif, color: C.ink, maxWidth: 720, margin: "0 auto" }}>

      {/* Rep header */}
      {myDelegate && (
        <div style={{ background: C.navy, color: "#fff", padding: "12px 20px",
                      borderRadius: "6px 6px 0 0", display: "flex", alignItems: "center",
                      justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontSize: 11, color: C.gold, letterSpacing: 1, fontWeight: 700 }}>YOUR REPRESENTATIVE</div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{myDelegate.name}</div>
          </div>
          <div style={{ fontSize: 12, color: "#cfd6e4" }}>
            District {district} · {myDelegate.party}
          </div>
        </div>
      )}

      {/* Loading state */}
      {digestPhase === "loading" && (
        <div style={{ background: C.parchment, border: `1px solid ${C.line}`,
                      borderRadius: myDelegate ? "0 0 6px 6px" : 6,
                      padding: "40px 24px", textAlign: "center", color: C.muted }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 15 }}>Loading bills for {district}…</div>
        </div>
      )}

      {/* Error state */}
      {digestPhase === "error" && (
        <div style={{ background: C.parchment, border: `1px solid ${C.line}`,
                      borderRadius: 6, padding: "32px 24px", textAlign: "center" }}>
          <div style={{ color: C.crimson, fontSize: 15, marginBottom: 12 }}>
            Couldn't load bills right now. The Congress.gov API may be rate-limited.
          </div>
          <button onClick={() => { setDigestPhase("loading"); fetchDigest(district).then(d => { setMyDelegate(d.rep); setBills(d.items || []); setDigestPhase(d.items?.length ? "ready" : "empty"); }).catch(() => setDigestPhase("error")); }}
            style={{ padding: "9px 20px", fontFamily: serif, fontSize: 14, fontWeight: 700,
                     border: "none", borderRadius: 4, background: C.navy, color: "#fff", cursor: "pointer" }}>
            Try Again
          </button>
        </div>
      )}

      {/* Empty state */}
      {digestPhase === "empty" && (
        <div style={{ background: C.parchment, border: `1px solid ${C.line}`,
                      borderRadius: 6, padding: "32px 24px", textAlign: "center", color: C.muted }}>
          <div style={{ fontSize: 15 }}>No active bills found for {district} right now. Check back soon.</div>
        </div>
      )}

      {/* Bills ready */}
      {digestPhase === "ready" && bills.length > 0 && (
        <>
          {/* Bill selector */}
          <div style={{ background: "#fff", border: `1px solid ${C.line}`,
                        borderTop: myDelegate ? "none" : `1px solid ${C.line}` }}>
            <div style={{ padding: "12px 20px 0", fontSize: 11, fontWeight: 700,
                          color: C.muted, letterSpacing: 1 }}>
              SELECT A BILL TO VOTE ON
            </div>
            <div style={{ display: "flex", overflowX: "auto", padding: "10px 20px 0",
                          gap: 8, borderBottom: `2px solid ${C.gold}` }}>
              {bills.map((b, i) => (
                <button key={b.id} onClick={() => selectBill(i)}
                  style={{ fontFamily: serif, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
                           padding: "8px 14px", border: "none", cursor: "pointer",
                           background: "transparent", flexShrink: 0,
                           color: activeBillIdx === i ? C.crimson : C.muted,
                           borderBottom: `3px solid ${activeBillIdx === i ? C.crimson : "transparent"}`,
                           marginBottom: -2 }}>
                  {b.id?.split("-").slice(0,2).join(" ").toUpperCase() || `Bill ${i+1}`}
                </button>
              ))}
            </div>
          </div>

          {/* Active bill card */}
          {activeBill && (
            <div style={{ background: C.parchment, border: `1px solid ${C.line}`,
                          borderTop: "none", borderRadius: "0 0 6px 6px", overflow: "hidden" }}>
              <StarStrip />
              <div style={{ padding: "20px 24px 26px" }}>

                {/* Bill info */}
                <div style={{ fontSize: 11, color: C.gold, fontWeight: 700, letterSpacing: 1,
                              textTransform: "uppercase", marginBottom: 4 }}>
                  {activeBill.reason || "Active Legislation"}
                </div>
                <h2 style={{ margin: "0 0 8px", fontSize: 20, color: C.navy, lineHeight: 1.3 }}>
                  {activeBill.summary?.headline || activeBill.title}
                </h2>
                {activeBill.summary?.plain && (
                  <p style={{ margin: "0 0 8px", fontSize: 13.5, color: C.ink, lineHeight: 1.6 }}>
                    {activeBill.summary.plain}
                  </p>
                )}
                {activeBill.summary?.affects && (
                  <p style={{ margin: "0 0 4px", fontSize: 12.5, color: C.muted }}>
                    <strong>Who it affects:</strong> {activeBill.summary.affects}
                  </p>
                )}
                {activeBill.summary?.status && (
                  <p style={{ margin: "0 0 16px", fontSize: 12.5, color: C.muted }}>
                    <strong>Status:</strong> {activeBill.summary.status}
                  </p>
                )}

                {/* District badge */}
                <div style={{ padding: "10px 14px", background: "#fff",
                              border: `1px solid ${C.line}`, borderRadius: 4, fontSize: 13.5,
                              marginBottom: 18 }}>
                  Voting as <strong style={{ color: C.crimson }}>District {district}</strong>
                  {location?.city && (
                    <span style={{ color: C.muted }}> · {location.city}, {location.state}</span>
                  )}
                </div>

                {/* Position buttons */}
                {phase !== "done" && (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 8 }}>
                      YOUR POSITION
                    </div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
                      {POSITIONS.map(p => (
                        <button key={p.key} onClick={() => setSelected(p.key)}
                          style={{ flex: "1 1 120px", padding: "11px 8px", cursor: "pointer",
                                   fontFamily: serif, fontSize: 15, borderRadius: 4,
                                   border: `2px solid ${selected === p.key ? p.color : C.line}`,
                                   background: selected === p.key ? p.color : "#fff",
                                   color: selected === p.key ? "#fff" : p.color, fontWeight: 700 }}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {/* Honeypot — hidden from humans */}
                <input tabIndex={-1} autoComplete="off" value={honeypot}
                  onChange={e => setHoneypot(e.target.value)} aria-hidden="true"
                  style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }} />

                {/* Submit */}
                {phase !== "done" && (
                  <button onClick={submitVote} disabled={!canSubmit}
                    style={{ width: "100%", padding: "13px", fontFamily: serif, fontSize: 16,
                             fontWeight: 700, borderRadius: 4, border: "none",
                             cursor: canSubmit ? "pointer" : "not-allowed",
                             background: canSubmit ? C.crimson : "#C9BFAB",
                             color: "#fff", letterSpacing: 0.5 }}>
                    {phase === "submitting" ? "Recording…" : "Cast My Position"}
                  </button>
                )}

                {voteError && (
                  <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 4,
                                background: "#FBE9E7", color: C.crimson, fontSize: 13,
                                border: `1px solid ${C.crimsonBright}` }}>
                    {voteError}
                  </div>
                )}

                {/* Done state */}
                {phase === "done" && result && (
                  <div style={{ marginTop: 0 }}>
                    <div style={{ padding: "12px 16px", background: "#fff",
                                  border: `1px solid ${C.line}`, borderRadius: 4,
                                  fontSize: 13.5, color: C.navy, marginBottom: 12 }}>
                      ✓ Position recorded as{" "}
                      <strong>{result.tier === "verified" ? "location-verified" : "open"}</strong>.
                      {result.tier !== "verified" &&
                        " Your vote still counts in the open tally."}
                    </div>
                    <button onClick={resetVoteState}
                      style={{ width: "100%", padding: "10px", fontFamily: serif, fontSize: 14,
                               fontWeight: 700, borderRadius: 4, border: `1px solid ${C.line}`,
                               background: "#fff", color: C.navy, cursor: "pointer", marginBottom: 12 }}>
                      ← Vote on Another Bill
                    </button>
                  </div>
                )}

                {/* Tally */}
                {delegateVotes && <TallyPanel tally={delegateVotes} />}

                {/* Contact rep panel */}
                {showContact && phase === "done" && result && activeBill && (
                  <ContactRep
                    district={district}
                    billId={activeBill.id}
                    billTitle={activeBill.title}
                    position={selected}
                    onClose={() => setShowContact(false)}
                  />
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
function TallyPanel({ tally }) {
  const { sampleSize, qualityScore, verified, open, counts } = tally;
  const combined = {};
  for (const p of POSITIONS) {
    combined[p.key] = (verified?.[p.key] || 0) + (open?.[p.key] || 0);
  }
  const total = sampleSize || 1;

  return (
    <div style={{ marginTop: 22, borderTop: `2px solid ${C.gold}`, paddingTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline",
                    marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, letterSpacing: 1 }}>
          DISTRICT POSITIONS SO FAR
        </div>
        <div style={{ fontSize: 12, color: C.muted }}>{sampleSize} response{sampleSize !== 1 ? "s" : ""}</div>
      </div>
      {POSITIONS.map(p => {
        const n = combined[p.key] || 0;
        const pct = total > 0 ? Math.round((n / total) * 100) : 0;
        return (
          <div key={p.key} style={{ marginTop: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ fontWeight: 700, color: p.color }}>{p.label}</span>
              <span style={{ color: C.muted }}>{pct}% · {n}</span>
            </div>
            <div style={{ height: 8, background: C.parchmentEdge, borderRadius: 4, marginTop: 3 }}>
              <div style={{ width: `${pct}%`, height: "100%", background: p.color,
                            borderRadius: 4, transition: "width 0.4s ease" }} />
            </div>
          </div>
        );
      })}
      <div style={{ marginTop: 14, padding: "10px 14px", background: "#fff",
                    border: `1px solid ${C.line}`, borderRadius: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <QualityBadge score={qualityScore} />
          <span style={{ fontSize: 12, color: C.navy, fontWeight: 700 }}>
            {counts?.verified || 0} of {sampleSize} responses are location-verified
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.5, color: C.muted }}>
          Self-selected opinion poll, not a scientific survey. "Location-verified" means
          the connection placed in the district's state. Bot and rate filters applied.
        </p>
      </div>
    </div>
  );
}

function QualityBadge({ score }) {
  const pct = Math.round((score || 0) * 100);
  const tone = score >= 0.7 ? C.navy : score >= 0.4 ? C.gold : C.crimson;
  return (
    <span style={{ fontSize: 11, fontWeight: 800, color: "#fff",
                   background: tone, borderRadius: 10, padding: "2px 9px" }}>
      {pct}% verified
    </span>
  );
}

function StarStrip() {
  return (
    <div style={{ background: C.navy, padding: "6px 0", display: "flex",
                  justifyContent: "center", gap: 9 }}>
      {Array.from({ length: 13 }).map((_, i) => (
        <span key={i} style={{ color: C.gold, fontSize: 11 }}>★</span>
      ))}
    </div>
  );
}

function humanizeReason(reason) {
  const map = {
    honeypot_tripped:  "This submission looked automated and wasn't recorded.",
    too_fast:          "Submitted too quickly — please take a moment to review the bill, then try again.",
    rate_ip:           "Too many votes from your connection recently. Please try later.",
    rate_subnet:       "Too many votes from your network recently. Please try later.",
    missing_fields:    "Please select a position first.",
  };
  return map[reason] || "Your vote couldn't be recorded. Please try again.";
}
