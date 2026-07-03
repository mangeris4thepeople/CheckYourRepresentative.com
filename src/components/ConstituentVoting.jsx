// =============================================================================
// ConstituentVoting v2 - Big YES/NO buttons + full money trail matrix
// =============================================================================
import React, { useState, useEffect, useCallback, useRef } from "react";
import ContactRep from "./ContactRep.jsx";
import { getStoredSession } from "../lib/session.js";

const C = {
  yes: "#1B5E20", yesLight: "#E8F5E9", yesBorder: "#A5D6A7",
  no: "#B71C1C", noLight: "#FFEBEE", noBorder: "#EF9A9A",
  navy: "#0A1A3F", gold: "#C9A227", crimson: "#8B0000",
  parchment: "#FBF7EC", ink: "#1A1A1A", muted: "#5C5347",
  line: "#D8C9A0", panel: "#fff",
};
const serif = "Georgia, 'Times New Roman', serif";
const sans = "-apple-system, BlinkMacSystemFont, sans-serif";

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

export default function ConstituentVoting({ district, location, session, onNeedDistrict, onNeedSignIn }) {
  const [phase, setPhase] = useState("idle");
  const [bills, setBills] = useState([]);
  const [myDelegate, setMyDelegate] = useState(null);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [honeypot, setHoneypot] = useState("");
  const renderedAtRef = useRef(Date.now());
  const [votePhase, setVotePhase] = useState("idle"); // idle | signin | submitting | done | already | error
  const [showContact, setShowContact] = useState(false);
  const [result, setResult] = useState(null);
  const [tally, setTally] = useState(null);
  const [voteError, setVoteError] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [checkingStatus, setCheckingStatus] = useState(false);

  // Fall back to localStorage directly if no session prop was passed in
  // (defensive - App.jsx normally supplies this).
  const activeSession = session ?? getStoredSession();

  const bill = bills[idx] || null;

  useEffect(() => {
    if (!district) return;
    setPhase("loading"); setBills([]); setMyDelegate(null); reset();
    fetchDigest(district)
      .then(data => {
        setMyDelegate(data.rep || null);
        setBills(data.items || []);
        setPhase(data.items?.length ? "ready" : "empty");
        renderedAtRef.current = Date.now();
      })
      .catch(() => setPhase("error"));
  }, [district]);

  const loadTally = useCallback(async () => {
    if (!bill?.id) return;
    try { setTally(await fetchTally(bill.id)); } catch {}
  }, [bill?.id]);

  useEffect(() => { setTally(null); loadTally(); }, [loadTally]);

  // Every time the selected bill changes, check whether THIS ACCOUNT already
  // has a position on it. Not signed in? Show the sign-in gate instead of
  // ever rendering live buttons - no anonymous ballots.
  useEffect(() => {
    if (!bill?.id) return;
    if (!activeSession?.token) { setVotePhase("signin"); return; }

    let cancelled = false;
    setCheckingStatus(true);
    fetchVoteStatus(bill.id, activeSession.token)
      .then(status => {
        if (cancelled) return;
        if (!status.signedIn) {
          setVotePhase("signin");
          return;
        }
        if (status.voted) {
          setSelected(status.position);
          setResult({ status: "counted" });
          setVotePhase("already");
        } else {
          setSelected(null);
          setResult(null);
          setVotePhase("idle");
        }
      })
      .catch(() => { /* fail open to idle - server still enforces the real rule */ setVotePhase("idle"); })
      .finally(() => { if (!cancelled) setCheckingStatus(false); });
    return () => { cancelled = true; };
  }, [bill?.id, activeSession?.token]);

  function reset() {
    setSelected(null); setVotePhase("idle"); setShowContact(false);
    setResult(null); setTally(null); setVoteError(null);
  }

  function selectBill(i) { setIdx(i); reset(); renderedAtRef.current = Date.now(); }

  async function castVote(position) {
    if (!bill || votePhase === "submitting" || votePhase === "already") return;
    if (!activeSession?.token) { setVotePhase("signin"); return; }
    setSelected(position);
    setVotePhase("submitting"); setVoteError(null);
    try {
      const res = await castVoteApi({
        billId: bill.id, position, district,
        honeypot, renderedAt: renderedAtRef.current,
        sessionToken: activeSession.token,
      });
      if (res.status === "already_voted") {
        setSelected(res.position || position);
        setResult(res);
        setVotePhase("already");
        return;
      }
      if (res.status === "rejected") {
        if (res.reason === "signin_required") { setVotePhase("signin"); return; }
        setVoteError(humanize(res.reason)); setVotePhase("error"); return;
      }
      setResult(res); setVotePhase("done"); setShowContact(true); loadTally();

      // Save to local vote history for the voter profile
      try {
        const history = JSON.parse(localStorage.getItem("cyr_votes") || "[]");
        const entry = {
          billId: bill.id,
          billTitle: bill.summary?.headline || bill.title,
          position, district,
          tier: res.tier || "open",
          ts: Date.now(),
        };
        const filtered = history.filter(v => v.billId !== bill.id);
        filtered.unshift(entry);
        localStorage.setItem("cyr_votes", JSON.stringify(filtered.slice(0, 200)));
      } catch {}
    } catch {
      setVoteError("Could not reach the server. Try again."); setVotePhase("error");
    }
  }

  function toggle(key) { setExpanded(e => ({ ...e, [key]: !e[key] })); }

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

      {phase === "ready" && bill && (
        <>
          {/* Bill selector: big, bold, obviously clickable. The bills ARE the tool. */}
          <div style={{ background: C.navy, borderRadius: "8px 8px 0 0",
                        borderLeft: "1px solid "+C.line, borderRight: "1px solid "+C.line,
                        borderBottom: "3px solid "+C.gold, padding: "14px 16px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.gold, letterSpacing: 2, marginBottom: 10 }}>
              ★ SELECT A BILL TO VOTE ON ({bills.length} ACTIVE)
            </div>
            <div style={{ display: "flex", overflowX: "auto", gap: 8, paddingBottom: 4 }}>
              {bills.map((b, i) => (
                <button key={b.id} onClick={() => selectBill(i)}
                  style={{ fontFamily: sans, fontSize: 14, fontWeight: 900, whiteSpace: "nowrap",
                           letterSpacing: 0.5, padding: "12px 18px", cursor: "pointer",
                           flexShrink: 0, borderRadius: 6,
                           border: "2px solid "+(idx === i ? C.gold : "rgba(255,255,255,0.35)"),
                           background: idx === i ? C.crimson : "rgba(255,255,255,0.08)",
                           color: idx === i ? "#fff" : "#E8E2D4",
                           boxShadow: idx === i ? "0 2px 8px rgba(0,0,0,0.35)" : "none",
                           transition: "all 0.12s" }}>
                  {b.id?.replace(/-119$/,"").toUpperCase() || "Bill "+(i+1)}
                  {idx === i ? " ✓" : ""}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 10.5, color: "#8fa0c0", marginTop: 6 }}>
              Scroll for more bills →
            </div>
          </div>

          {/* Bill card */}
          <div style={{ background: C.parchment, border: "1px solid "+C.line, borderTop: "none", borderRadius: "0 0 8px 8px", overflow: "hidden" }}>
            
            {/* Bill headline */}
            <div style={{ padding: "20px 24px 0" }}>
              <div style={{ fontSize: 10, color: C.gold, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>
                {bill.policyArea || "Active Legislation"}
              </div>
              <h2 style={{ margin: "0 0 10px", fontSize: 20, color: C.navy, lineHeight: 1.3, fontFamily: serif }}>
                {bill.summary?.headline || bill.title}
              </h2>
              {bill.summary?.plain && (
                <p style={{ margin: "0 0 8px", fontSize: 14, color: C.ink, lineHeight: 1.65 }}>
                  {bill.summary.plain}
                </p>
              )}
            </div>

            {/* WHO INTRODUCED IT */}
            {bill.summary?.sponsor && (
              <div style={{ margin: "0 24px 8px", padding: "10px 14px", background: "#fff",
                            border: "1px solid "+C.line, borderRadius: 6 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.navy, letterSpacing: 1, marginBottom: 4 }}>
                  INTRODUCED BY
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{bill.summary.sponsor}</div>
              </div>
            )}

            {/* MONEY MATRIX - expandable sections */}
            <div style={{ margin: "0 24px 16px" }}>

              {/* Who Benefits */}
              {bill.summary?.who_benefits && (
                <MoneyRow
                  icon="✅" label="Who benefits if this passes"
                  text={bill.summary.who_benefits}
                  color="#1B5E20" bg="#E8F5E9" border="#A5D6A7"
                  open={expanded.benefits}
                  onToggle={() => toggle("benefits")}
                />
              )}

              {/* Who Loses */}
              {bill.summary?.who_loses && (
                <MoneyRow
                  icon="❌" label="Who is worse off if this passes"
                  text={bill.summary.who_loses}
                  color="#B71C1C" bg="#FFEBEE" border="#EF9A9A"
                  open={expanded.loses}
                  onToggle={() => toggle("loses")}
                />
              )}

              {/* PAC Money */}
              {bill.summary?.pac_money && (
                <MoneyRow
                  icon="💰" label="PAC & donor money behind this bill"
                  text={bill.summary.pac_money}
                  color="#5C4400" bg="#FFF8E1" border="#FFE082"
                  open={expanded.pac}
                  onToggle={() => toggle("pac")}
                />
              )}

              {/* Industries */}
              {bill.summary?.industries && (
                <MoneyRow
                  icon="🏭" label="Industries with financial stake"
                  text={bill.summary.industries}
                  color="#1A237E" bg="#E8EAF6" border="#9FA8DA"
                  open={expanded.industries}
                  onToggle={() => toggle("industries")}
                />
              )}

              {/* Vote Impact */}
              {bill.summary?.vote_impact && (
                <div style={{ marginTop: 8, padding: "12px 14px", background: "#0A1A3F",
                              borderRadius: 6, color: "#fff" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.gold, letterSpacing: 1, marginBottom: 4 }}>
                    IF THIS PASSES - WHAT CHANGES FOR YOU
                  </div>
                  <div style={{ fontSize: 14, lineHeight: 1.6 }}>{bill.summary.vote_impact}</div>
                </div>
              )}
            </div>

            {/* Status */}
            {bill.summary?.status && (
              <div style={{ margin: "0 24px 16px", fontSize: 12.5, color: C.muted }}>
                <strong>Status:</strong> {bill.summary.status}
              </div>
            )}

            {/* District badge */}
            <div style={{ margin: "0 24px 20px", padding: "10px 14px", background: "#fff",
                          border: "1px solid "+C.line, borderRadius: 4, fontSize: 13 }}>
              Voting as <strong style={{ color: C.crimson }}>District {district}</strong>
              {location?.city && <span style={{ color: C.muted }}> · {location.city}, {location.state}</span>}
            </div>

            {/* Checking prior vote status */}
            {checkingStatus && (
              <div style={{ margin: "0 24px 16px", fontSize: 12.5, color: C.muted, textAlign: "center" }}>
                Checking your voting status on this bill...
              </div>
            )}

            {/* Sign-in gate - no anonymous ballots, ever */}
            {votePhase === "signin" && !checkingStatus && (
              <div style={{ margin: "0 24px 24px", padding: "24px", background: "#fff",
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

            {/* BIG YES / NO BUTTONS - only once signed in and not already voted */}
            {votePhase !== "done" && votePhase !== "already" && votePhase !== "signin" && !checkingStatus && (
              <div style={{ margin: "0 24px 24px" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 10, letterSpacing: 1 }}>
                  YOUR VOTE ON THIS BILL
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <button
                    onClick={() => castVote("support")}
                    disabled={votePhase === "submitting"}
                    style={{ flex: 1, padding: "20px 12px", fontFamily: serif, fontSize: 22,
                             fontWeight: 900, borderRadius: 8, border: "3px solid "+C.yesBorder,
                             background: selected === "support" ? C.yes : C.yesLight,
                             color: selected === "support" ? "#fff" : C.yes,
                             cursor: votePhase === "submitting" ? "not-allowed" : "pointer",
                             transition: "all 0.15s", letterSpacing: 1 }}>
                    ✓ YES
                  </button>
                  <button
                    onClick={() => castVote("oppose")}
                    disabled={votePhase === "submitting"}
                    style={{ flex: 1, padding: "20px 12px", fontFamily: serif, fontSize: 22,
                             fontWeight: 900, borderRadius: 8, border: "3px solid "+C.noBorder,
                             background: selected === "oppose" ? C.no : C.noLight,
                             color: selected === "oppose" ? "#fff" : C.no,
                             cursor: votePhase === "submitting" ? "not-allowed" : "pointer",
                             transition: "all 0.15s", letterSpacing: 1 }}>
                    ✗ NO
                  </button>
                </div>
                <button
                  onClick={() => castVote("undecided")}
                  disabled={votePhase === "submitting"}
                  style={{ width: "100%", marginTop: 8, padding: "10px", fontFamily: serif, fontSize: 13,
                           fontWeight: 700, borderRadius: 6, border: "1px solid "+C.line,
                           background: selected === "undecided" ? "#eee" : "#fff",
                           color: C.muted, cursor: "pointer" }}>
                  Not sure / Undecided
                </button>
                {votePhase === "submitting" && (
                  <div style={{ textAlign: "center", color: C.muted, fontSize: 13, marginTop: 8 }}>
                    Recording your vote...
                  </div>
                )}
              </div>
            )}

            {voteError && (
              <div style={{ margin: "0 24px 16px", padding: "10px 12px", borderRadius: 4,
                            background: "#FBE9E7", color: C.crimson, fontSize: 13,
                            border: "1px solid "+C.crimson }}>
                {voteError}
              </div>
            )}

            {/* Just voted this session */}
            {votePhase === "done" && result && (
              <div style={{ margin: "0 24px 16px" }}>
                <div style={{ padding: "14px 16px", background: C.yes, color: "#fff",
                              borderRadius: 6, textAlign: "center", marginBottom: 12 }}>
                  <div style={{ fontSize: 20, fontWeight: 900 }}>
                    {selected === "support" ? "✓ YES recorded" : selected === "oppose" ? "✗ NO recorded" : "Undecided recorded"}
                  </div>
                  <div style={{ fontSize: 12, marginTop: 4, opacity: 0.9 }}>
                    {result.tier === "verified" ? "Network location matches your district" : "Vote counted"}
                  </div>
                </div>
              </div>
            )}

            {/* Already voted - this account has a locked-in position, no resubmission */}
            {votePhase === "already" && (
              <div style={{ margin: "0 24px 16px" }}>
                <div style={{ padding: "14px 16px", background: C.navy, color: "#fff",
                              borderRadius: 6, textAlign: "center", marginBottom: 8 }}>
                  <div style={{ fontSize: 18, fontWeight: 900 }}>
                    You already voted {selected === "support" ? "YES" : selected === "oppose" ? "NO" : "Undecided"} on this bill
                  </div>
                  <div style={{ fontSize: 12, marginTop: 4, color: C.gold }}>
                    One position per bill, per account. Votes can't be changed or resubmitted.
                  </div>
                </div>
              </div>
            )}

            {/* Tally */}
            {tally && <TallyPanel tally={tally} />}

            {/* Honeypot */}
            <input tabIndex={-1} autoComplete="off" value={honeypot}
              onChange={e => setHoneypot(e.target.value)} aria-hidden="true"
              style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }} />

            {/* Contact rep - available whether they just voted or had already voted */}
            {(votePhase === "done" || votePhase === "already") && (
              <div style={{ margin: "0 24px 24px" }}>
                {!showContact && (
                  <button onClick={() => setShowContact(true)}
                    style={{ width: "100%", padding: "10px", fontFamily: serif, fontSize: 14,
                             fontWeight: 700, borderRadius: 4, border: "1px solid "+C.line,
                             background: "#fff", color: C.navy, cursor: "pointer" }}>
                    Contact Your Representative About This Bill
                  </button>
                )}
                {showContact && bill && (
                  <ContactRep district={district} billId={bill.id} billTitle={bill.title}
                    position={selected} onClose={() => setShowContact(false)} />
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function MoneyRow({ icon, label, text, color, bg, border, open, onToggle }) {
  return (
    <div style={{ marginTop: 8, borderRadius: 6, border: "1px solid "+border, overflow: "hidden" }}>
      <button onClick={onToggle}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 10,
                 padding: "10px 14px", background: bg, border: "none", cursor: "pointer",
                 textAlign: "left" }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color, letterSpacing: 0.5, textTransform: "uppercase" }}>
          {label}
        </span>
        <span style={{ fontSize: 12, color, fontWeight: 700 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ padding: "10px 14px", background: "#fff", fontSize: 13.5,
                      color: "#1A1A1A", lineHeight: 1.65, borderTop: "1px solid "+border }}>
          {text}
        </div>
      )}
    </div>
  );
}

function TallyPanel({ tally }) {
  const { sampleSize, counts, verified, open } = tally;
  const combined = {};
  for (const p of ["support","oppose","undecided"]) {
    combined[p] = (verified?.[p]||0) + (open?.[p]||0);
  }
  const total = sampleSize || 1;
  const yPct = Math.round((combined.support/total)*100);
  const nPct = Math.round((combined.oppose/total)*100);

  return (
    <div style={{ margin: "0 24px 24px", borderTop: "2px solid #C9A227", paddingTop: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#0A1A3F", letterSpacing: 1, marginBottom: 12 }}>
        DISTRICT TALLY - {sampleSize} VOTE{sampleSize !== 1 ? "S" : ""}
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <div style={{ flex: yPct || 1, background: "#1B5E20", height: 24, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>{yPct}% YES</span>
        </div>
        <div style={{ flex: nPct || 1, background: "#B71C1C", height: 24, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>{nPct}% NO</span>
        </div>
      </div>
      <div style={{ fontSize: 11.5, color: "#5C5347" }}>
        {counts?.verified || 0} of {sampleSize} location-verified · Self-selected poll, not a scientific survey
      </div>
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
