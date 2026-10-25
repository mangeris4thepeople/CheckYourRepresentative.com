// =============================================================================
// AllBillsBrowser.jsx - every active bill on the floor, not just the curated
// eight. Browse, search, open any bill for the full money-trail breakdown,
// and cast a position on it. Same sign-in gate and one-vote-per-account rule
// as the curated Vote tab, because it's the same votes table underneath.
// =============================================================================
import React, { useState, useEffect, useCallback } from "react";
import ContactRep from "./ContactRep.jsx";
import { getStoredSession } from "../lib/session.js";
import { TallyBar } from "./ui/Kit.jsx";

const C = {
  navy:"#0E2A6B", gold:"#F5B82E", crimson:"#D62839",
  yes:"#15803D", yesLight:"#E8F5E9",
  no:"#DC2626", noLight:"#FFEBEE",
  parchment:"#FFFFFF", muted:"#5B6578", line:"#E2E8F0",
};
const serif = "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const mono = "'JetBrains Mono', ui-monospace, Menlo, monospace";

async function fetchList(offset, q, token) {
  const params = new URLSearchParams({ offset: String(offset) });
  if (q) params.set("q", q);
  if (token) params.set("token", token);
  const r = await fetch(`/api/bills-list?${params}`);
  if (!r.ok) throw new Error("list_failed");
  return r.json();
}
async function fetchDetail(billId) {
  const r = await fetch(`/api/bill-detail?billId=${encodeURIComponent(billId)}`);
  if (!r.ok) throw new Error("detail_failed");
  return r.json();
}
async function fetchVoteStatus(billId, token) {
  const url = `/api/vote-status?billId=${encodeURIComponent(billId)}` + (token ? `&token=${encodeURIComponent(token)}` : "");
  const r = await fetch(url);
  if (!r.ok) throw new Error("status_failed");
  return r.json();
}
async function castVoteApi(payload) {
  const r = await fetch("/api/vote", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error("vote_failed");
  return r.json();
}
async function fetchTally(billId) {
  const r = await fetch(`/api/tally?billId=${encodeURIComponent(billId)}`);
  if (!r.ok) throw new Error("tally_failed");
  return r.json();
}

export default function AllBillsBrowser({ district, session: sessionProp }) {
  const session = sessionProp ?? getStoredSession();

  // ---- list state ----
  const [bills, setBills] = useState([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(null);
  const [listState, setListState] = useState("loading");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  // ---- selected bill / voting state ----
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailState, setDetailState] = useState("idle");
  const [votePhase, setVotePhase] = useState("idle"); // idle | signin | checking | submitting | done | already
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [tally, setTally] = useState(null);
  const [showContact, setShowContact] = useState(false);
  const [voteError, setVoteError] = useState(null);
  const [votedIds, setVotedIds] = useState(() => new Set());
  const [navBusy, setNavBusy] = useState(false);

  const loadList = useCallback(async (newOffset, q, append) => {
    setListState("loading");
    try {
      const data = await fetchList(newOffset, q, session?.token);
      setBills(prev => append ? [...prev, ...data.bills] : data.bills);
      setOffset(data.offset);
      setHasMore(data.hasMore);
      setTotalCount(data.totalCount);
      if (data.votedBillIds?.length) {
        setVotedIds(prev => new Set([...prev, ...data.votedBillIds]));
      }
      setListState("ready");
      return data;
    } catch {
      setListState("error");
      return null;
    }
  }, [session?.token]);

  useEffect(() => { loadList(0, search, false); }, [search, loadList]);

  function runSearch() { setSearch(searchInput.trim()); }

  // ---- open a bill ----
  function openBill(id) {
    setSelectedId(id);
    setDetail(null);
    setDetailState("loading");
    setVotePhase("idle");
    setSelectedPosition(null);
    setTally(null);
    setShowContact(false);
    setVoteError(null);

    fetchDetail(id)
      .then(d => { setDetail(d); setDetailState("ready"); })
      .catch(() => setDetailState("error"));

    fetchTally(id).then(setTally).catch(() => {});

    if (!session?.token) { setVotePhase("signin"); return; }
    fetchVoteStatus(id, session.token)
      .then(s => {
        if (!s.signedIn) { setVotePhase("signin"); return; }
        if (s.voted) {
          setSelectedPosition(s.position); setVotePhase("already");
          setVotedIds(prev => new Set(prev).add(id));
        }
        else setVotePhase("idle");
      })
      .catch(() => setVotePhase("idle"));
  }

  function closeBill() {
    setSelectedId(null); setDetail(null); setDetailState("idle");
  }

  const currentIndex = bills.findIndex(b => b.id === selectedId);
  const hasPrevious = currentIndex > 0;

  function goPrevious() {
    if (!hasPrevious) return;
    openBill(bills[currentIndex - 1].id);
  }

  async function goNext() {
    if (currentIndex === -1) return;
    if (currentIndex + 1 < bills.length) {
      openBill(bills[currentIndex + 1].id);
      return;
    }
    // Ran off the end of what's loaded, pull more if there's more to get.
    if (hasMore) {
      setNavBusy(true);
      const data = await loadList(offset + 250, search, true);
      setNavBusy(false);
      if (data?.bills?.length) openBill(data.bills[0].id);
    }
  }

  // Walk forward through loaded bills for the first one this account
  // hasn't voted on yet. Auto-loads more pages if the current page runs
  // out, capped so it can't loop forever on an all-voted list.
  async function goNextUnvoted() {
    if (!session?.token) { setVotePhase("signin"); return; }
    setNavBusy(true);
    let searchFrom = currentIndex + 1;
    let currentBills = bills;
    let currentHasMore = hasMore;
    let currentOffset = offset;
    let safety = 0;

    while (safety < 6) {
      const hit = currentBills.slice(searchFrom).find(b => !votedIds.has(b.id));
      if (hit) { setNavBusy(false); openBill(hit.id); return; }
      if (!currentHasMore) break;
      const data = await loadList(currentOffset + 250, search, true);
      if (!data?.bills?.length) break;
      searchFrom = currentBills.length;
      currentBills = [...currentBills, ...data.bills];
      currentHasMore = data.hasMore;
      currentOffset = data.offset;
      safety++;
    }
    setNavBusy(false);
    setVoteError("No more unvoted bills found nearby. Try Load More on the list, or search a different topic.");
  }

  async function castVote(position) {
    if (!selectedId || votePhase === "submitting" || votePhase === "already") return;
    if (!session?.token) { setVotePhase("signin"); return; }
    setSelectedPosition(position);
    setVotePhase("submitting");
    setVoteError(null);
    try {
      const res = await castVoteApi({
        billId: selectedId, position, district,
        renderedAt: Date.now(), sessionToken: session.token,
      });
      if (res.status === "already_voted") {
        setSelectedPosition(res.position || position); setVotePhase("already");
        setVotedIds(prev => new Set(prev).add(selectedId));
        return;
      }
      if (res.status === "rejected") {
        if (res.reason === "signin_required") { setVotePhase("signin"); return; }
        setVoteError(humanize(res.reason)); setVotePhase("idle"); return;
      }
      setVotePhase("done"); setShowContact(true);
      setVotedIds(prev => new Set(prev).add(selectedId));
      fetchTally(selectedId).then(setTally).catch(() => {});
    } catch {
      setVoteError("Could not reach the server. Try again."); setVotePhase("idle");
    }
  }

  // ================= DETAIL VIEW =================
  // October 2026 revamp: pill toolbar, a hero style bill card, color coded
  // money trail cards, the national tally bar, and big friendly vote pills.
  if (selectedId) {
    const billNo = detail ? detail.id.replace(/-119$/, "").toUpperCase() : "";
    const posMeta = {
      support: { word: "Yes", color: "#16A34A", soft: "#ECFDF3", border: "#BBF7D0", icon: "✓" },
      oppose: { word: "No", color: "#DC2626", soft: "#FEF2F2", border: "#FECACA", icon: "✕" },
      undecided: { word: "Undecided", color: "#64748B", soft: "#F1F5F9", border: "#E2E8F0", icon: "?" },
    };
    const pm = posMeta[selectedPosition] || posMeta.undecided;
    return (
      <div style={{ fontFamily: serif, maxWidth: 820, margin: "0 auto" }}>
        <style>{DETAIL_CSS}</style>
        <div className="cyr-abd-nav" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
          <button onClick={closeBill} className="cyr-btn cyr-btn-ghost" style={{ minHeight: 42 }}>
            <span aria-hidden>←</span> All Active Bills
          </button>
          <span style={{ flex: "1 1 0", minWidth: 0 }} className="cyr-hide-sm" />
          <button onClick={goPrevious} disabled={!hasPrevious || navBusy} className="cyr-btn cyr-btn-ghost"
            style={{ minHeight: 42, opacity: hasPrevious ? 1 : 0.5 }}>
            <span aria-hidden>↑</span> Previous bill
          </button>
          <button onClick={goNext} disabled={navBusy || (currentIndex === bills.length - 1 && !hasMore)} className="cyr-btn cyr-btn-ghost"
            style={{ minHeight: 42 }}>
            <span aria-hidden>↓</span> Next bill
          </button>
          <button onClick={goNextUnvoted} disabled={navBusy} className="cyr-btn cyr-btn-primary cyr-abd-next" style={{ minHeight: 42 }}>
            {navBusy ? "Searching…" : "⚡ Next you haven't voted on"}
          </button>
        </div>

        {detailState === "loading" && (
          <div className="cyr-card" style={{ padding: 18, borderRadius: 24 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 14, color: C.muted, marginBottom: 14, lineHeight: 1.5 }}>
              <span aria-hidden style={{ fontSize: 18 }}>🔎</span>
              <span>Researching this bill: sponsor, money trail, plain-English summary. First look takes a few seconds, cached forever after.</span>
            </div>
            <div className="cyr-skeleton" style={{ height: 140, borderRadius: 18, marginBottom: 12 }} />
            <Skeletons rows={4} height={58} />
          </div>
        )}
        {detailState === "error" && (
          <div className="cyr-card" style={{ padding: 16, background: "#FEF2F2", borderColor: "#FECACA", color: "#991B1B",
                                             display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Could not load this bill. Try again.</span>
            <button className="cyr-btn cyr-btn-ghost" onClick={() => openBill(selectedId)}>Try again</button>
          </div>
        )}

        {detailState === "ready" && detail && (
          <article className="cyr-card cyr-rise" style={{ overflow: "hidden", borderRadius: 24, boxShadow: "var(--cyr-shadow-lg)" }}>
            <div className="cyr-hero cyr-abd-hero" style={{ padding: "28px 28px 26px", borderRadius: 0, boxShadow: "none" }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontFamily: mono, fontSize: 12.5, fontWeight: 700, background: "rgba(255,255,255,.16)",
                               border: "1px solid rgba(255,255,255,.3)", borderRadius: 999, padding: "4px 11px" }}>{billNo}</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, background: "rgba(245,184,46,.22)", color: "#FFE29A",
                               borderRadius: 999, padding: "4px 11px" }}>{detail.policyArea || "Active legislation"}</span>
                {votedIds.has(detail.id) && (
                  <span style={{ fontSize: 12.5, fontWeight: 800, background: "#fff", color: C.navy, borderRadius: 999, padding: "4px 11px" }}>✓ Voted</span>
                )}
              </div>
              <h2 className="cyr-h1" style={{ fontSize: "clamp(23px, 3.4vw, 32px)", margin: "14px 0 0", lineHeight: 1.15, overflowWrap: "anywhere" }}>
                {detail.summary?.headline || detail.title}
              </h2>
            </div>

            <div className="cyr-abd-body" style={{ padding: "22px 26px 26px" }}>
              {detail.summary?.plain && (
                <p style={{ margin: "0 0 18px", fontSize: 16, color: "#1F2937", lineHeight: 1.7 }}>
                  {detail.summary.plain}
                </p>
              )}

              {(detail.summary?.sponsor || detail.summary?.status) && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: 10, marginBottom: 18 }}>
                  {detail.summary?.sponsor && (
                    <div className="cyr-row" style={{ background: "#F6F8FC", alignItems: "flex-start" }}>
                      <span aria-hidden style={iconDot("#E8F0FF", "#2563EB")}>🏛️</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: C.muted }}>Introduced by</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", overflowWrap: "anywhere" }}>{detail.summary.sponsor}</div>
                      </div>
                    </div>
                  )}
                  {detail.summary?.status && (
                    <div className="cyr-row" style={{ background: "#F6F8FC", alignItems: "flex-start" }}>
                      <span aria-hidden style={iconDot("#FFF6DD", "#B45309")}>📍</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: C.muted }}>Status</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "#0F172A", lineHeight: 1.45 }}>{detail.summary.status}</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: "grid", gap: 10 }}>
                {detail.summary?.who_benefits && (
                  <MoneyRow icon="✅" label="Who benefits if this passes" text={detail.summary.who_benefits}
                    color="#15803D" bg="#ECFDF3" border="#BBF7D0" />
                )}
                {detail.summary?.who_loses && (
                  <MoneyRow icon="❌" label="Who is worse off if this passes" text={detail.summary.who_loses}
                    color="#B91C1C" bg="#FEF2F2" border="#FECACA" />
                )}
                {detail.summary?.pac_money && (
                  <MoneyRow icon="💰" label="PAC and donor money behind this bill" text={detail.summary.pac_money}
                    color="#B45309" bg="#FFF7E6" border="#FDE3A7" />
                )}
                {detail.summary?.industries && (
                  <MoneyRow icon="🏭" label="Industries with financial stake" text={detail.summary.industries}
                    color="#1D4ED8" bg="#EEF4FF" border="#C7D7FE" />
                )}
              </div>

              {detail.summary?.vote_impact && (
                <div style={{ marginTop: 14, padding: "16px 18px", borderRadius: 18,
                              background: "linear-gradient(135deg,#EEF4FF 0%,#F5F0FF 100%)", border: "1px solid #D6E2FB" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 800, color: C.navy, marginBottom: 6 }}>
                    <span aria-hidden>💡</span> If this passes: what changes for you
                  </div>
                  <div style={{ fontSize: 15, lineHeight: 1.65, color: "#1F2937" }}>{detail.summary.vote_impact}</div>
                </div>
              )}

              {district && (
                <div style={{ marginTop: 16, display: "inline-flex", alignItems: "center", gap: 8, background: "#F6F8FC",
                              border: `1px solid ${C.line}`, borderRadius: 999, padding: "8px 14px", fontSize: 13.5, color: "#334155" }}>
                  <span aria-hidden>📍</span> Voting as <strong style={{ color: "#E0313F" }}>District {district}</strong>
                </div>
              )}

              {tally && <TallyPanel tally={tally} />}

              {votePhase === "signin" && (
                <div style={{ marginTop: 18, padding: "26px 20px", borderRadius: 20, textAlign: "center",
                              background: "linear-gradient(180deg,#FFFFFF 0%,#F3F7FF 100%)", border: "1px solid #C9D7F2" }}>
                  <div aria-hidden style={{ width: 60, height: 60, borderRadius: 99, margin: "0 auto 10px", background: "#E8F0FF",
                                            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>🔒</div>
                  <div className="cyr-h2" style={{ fontSize: 22, marginBottom: 6 }}>Sign in to vote</div>
                  <div style={{ fontSize: 14.5, color: C.muted, lineHeight: 1.6 }}>
                    One position per bill, per account. Head to My Profile to sign in with your email.
                  </div>
                </div>
              )}

              {(votePhase === "idle" || votePhase === "submitting") && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: C.navy, marginBottom: 10 }}>
                    Your vote on this bill
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                    {[
                      { key: "support", label: "Yes", icon: "✓", bg: "linear-gradient(135deg,#16A34A,#22C55E)", shadow: "rgba(22,163,74,.32)" },
                      { key: "oppose", label: "No", icon: "✕", bg: "linear-gradient(135deg,#DC2626,#F43F5E)", shadow: "rgba(220,38,38,.30)" },
                    ].map(p => {
                      const dim = selectedPosition && selectedPosition !== p.key;
                      return (
                        <button key={p.key} onClick={() => castVote(p.key)} disabled={votePhase === "submitting"} className="cyr-abd-pill"
                          style={{ minHeight: 64, borderRadius: 999, border: selectedPosition === p.key ? "3px solid #fff" : "0",
                                   outline: selectedPosition === p.key ? `3px solid ${p.key === "support" ? "#16A34A" : "#DC2626"}` : "none",
                                   background: p.bg, color: "#fff", fontFamily: serif, fontSize: 20, fontWeight: 800, cursor: "pointer",
                                   display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10,
                                   boxShadow: `0 10px 22px ${p.shadow}`, opacity: dim ? 0.5 : 1 }}>
                          <span aria-hidden style={{ width: 30, height: 30, borderRadius: 99, background: "rgba(255,255,255,.24)", fontSize: 16,
                                                     display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 900 }}>
                            {p.icon}
                          </span>
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                  <button onClick={() => castVote("undecided")} disabled={votePhase === "submitting"} className="cyr-abd-pill"
                    style={{ width: "100%", marginTop: 10, minHeight: 50, borderRadius: 999, fontFamily: serif, fontSize: 15, fontWeight: 700,
                             border: `1.5px solid ${selectedPosition === "undecided" ? "#64748B" : "#CBD5E1"}`, background: "#fff", color: "#334155",
                             cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <span aria-hidden style={{ width: 24, height: 24, borderRadius: 99, background: "#F1F5F9", fontSize: 13, fontWeight: 900,
                                               display: "inline-flex", alignItems: "center", justifyContent: "center" }}>?</span>
                    Not sure / Undecided
                  </button>
                  {votePhase === "submitting" && (
                    <div style={{ textAlign: "center", color: C.muted, fontSize: 13.5, marginTop: 10 }}>Recording your vote…</div>
                  )}
                </div>
              )}

              {voteError && (
                <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 14, background: "#FEF2F2",
                              color: "#991B1B", fontSize: 14, fontWeight: 600, border: "1px solid #FECACA" }}>
                  {voteError}
                </div>
              )}

              {votePhase === "done" && (
                <div className="cyr-rise" style={{ marginTop: 18, padding: "16px 18px", borderRadius: 20, background: "#ECFDF3",
                                                   border: "1px solid #BBF7D0", display: "flex", alignItems: "center", gap: 14 }}>
                  <span aria-hidden style={{ ...iconDot(pm.color, "#fff"), width: 46, height: 46, fontSize: 20, fontWeight: 900 }}>{pm.icon}</span>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#14532D" }}>
                    {selectedPosition === "support" ? "Yes recorded" : selectedPosition === "oppose" ? "No recorded" : "Undecided recorded"}
                  </div>
                </div>
              )}

              {votePhase === "already" && (
                <div className="cyr-rise" style={{ marginTop: 18, padding: "16px 18px", borderRadius: 20, background: "#EEF4FF",
                                                   border: "1px solid #C9D7F2", display: "flex", alignItems: "center", gap: 14 }}>
                  <span aria-hidden style={{ ...iconDot(pm.color, "#fff"), width: 46, height: 46, fontSize: 20, fontWeight: 900 }}>{pm.icon}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 16.5, fontWeight: 800, color: C.navy }}>
                      You already voted {selectedPosition === "support" ? "Yes" : selectedPosition === "oppose" ? "No" : "Undecided"} on this bill
                    </div>
                    <div style={{ fontSize: 13.5, marginTop: 2, color: C.muted }}>One position per bill, per account.</div>
                  </div>
                </div>
              )}

              {(votePhase === "done" || votePhase === "already") && (
                <div style={{ marginTop: 14 }}>
                  {!showContact ? (
                    <button onClick={() => setShowContact(true)} className="cyr-btn cyr-btn-ghost"
                      style={{ width: "100%", justifyContent: "center", minHeight: 50, fontSize: 15, whiteSpace: "normal", textAlign: "center" }}>
                      <span aria-hidden>✉️</span> Contact Your Representative About This Bill
                    </button>
                  ) : (
                    <ContactRep district={district} billId={detail.id} billTitle={detail.title}
                      position={selectedPosition} onClose={() => setShowContact(false)} />
                  )}
                </div>
              )}
            </div>
          </article>
        )}
      </div>
    );
  }

  // ================= LIST VIEW =================
  // October 2026 revamp: gradient hero, pill search with quick topics, and
  // bill cards with a chamber colored badge and a two line title so nothing
  // important gets cut off on phones.
  const TOPICS = ["Health", "Taxation", "Armed Forces", "Immigration", "Energy", "Crime", "Education", "Agriculture"];
  return (
    <div style={{ fontFamily: serif, maxWidth: 920, margin: "0 auto" }}>
      <div className="cyr-hero" style={{ padding: "30px 28px", borderRadius: 24 }}>
        <div className="cyr-eyebrow" style={{ color: "#FFE29A" }}>The full floor</div>
        <h1 className="cyr-h1" style={{ fontSize: "clamp(28px, 4.4vw, 44px)", margin: "8px 0 8px" }}>All Active Bills</h1>
        <div style={{ fontSize: 15, color: "rgba(255,255,255,.86)", lineHeight: 1.55, maxWidth: 560 }}>
          Every bill with recent activity in the 119th Congress, newest action first. Open any bill for the
          plain language money trail, then cast your position.
        </div>
        {totalCount ? (
          <div style={{ display: "inline-flex", alignItems: "baseline", gap: 8, marginTop: 16, background: "rgba(255,255,255,.14)",
                        border: "1px solid rgba(255,255,255,.28)", borderRadius: 999, padding: "6px 14px" }}>
            <span className="cyr-num" style={{ fontSize: 20 }}>{totalCount.toLocaleString()}</span>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,.85)" }}>{search ? `bills matching "${search}"` : "bills tracked"}</span>
          </div>
        ) : null}
      </div>

      <div className="cyr-card" style={{ marginTop: -18, position: "relative", padding: 14, borderRadius: 20, marginLeft: 12, marginRight: 12 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
            <span aria-hidden style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 15, opacity: .55 }}>🔎</span>
            <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && runSearch()}
              placeholder="Search bills by keyword or topic"
              aria-label="Search bills"
              style={{ width: "100%", fontFamily: serif, fontSize: 15, padding: "12px 14px 12px 40px",
                       border: `1px solid ${C.line}`, borderRadius: 999 }} />
          </div>
          <button onClick={runSearch} className="cyr-btn cyr-btn-primary">Search</button>
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 10, overflowX: "auto", scrollbarWidth: "none" }}>
          {search && (
            <button onClick={() => { setSearchInput(""); setSearch(""); }} className="cyr-chip"
              style={{ border: 0, cursor: "pointer", background: "#FDECEE", color: "#B91C1C", flexShrink: 0 }}>✕ Clear</button>
          )}
          {TOPICS.map(t => (
            <button key={t} onClick={() => { setSearchInput(t); setSearch(t); }} className="cyr-chip"
              style={{ border: 0, cursor: "pointer", flexShrink: 0, background: search === t ? "#0E2A6B" : undefined, color: search === t ? "#fff" : undefined }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        {listState === "loading" && bills.length === 0 && (
          <div style={{ display: "grid", gap: 10 }}>
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="cyr-skeleton" style={{ height: 78 }} />)}
          </div>
        )}
        {listState === "error" && <Center color={C.crimson}>Could not load bills. Try again shortly.</Center>}
        {listState === "ready" && bills.length === 0 && <Center>No bills match that search.</Center>}

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 10 }}>
          {bills.map((b, i) => {
            const t = String(b.type || b.id.split("-")[0]).toLowerCase();
            const senate = t.startsWith("s");
            const voted = votedIds.has(b.id);
            return (
              <button key={b.id} onClick={() => openBill(b.id)} className={i < 12 ? "cyr-rise" : undefined}
                style={{ display: "flex", alignItems: "flex-start", gap: 14, width: "100%", textAlign: "left",
                         background: "#fff", border: `1px solid ${voted ? "#F5D27A" : C.line}`, borderRadius: 16,
                         padding: "14px 16px", cursor: "pointer", fontFamily: serif,
                         boxShadow: "0 1px 2px rgba(15,23,42,.04)", animationDelay: `${Math.min(i, 12) * 30}ms` }}>
                <span style={{ flexShrink: 0, minWidth: 74, textAlign: "center", borderRadius: 10, padding: "6px 8px",
                               background: senate ? "#FDECEE" : "#E8F0FF", color: senate ? "#B91C1C" : "#1D4ED8",
                               fontFamily: mono, fontSize: 12, fontWeight: 700 }}>
                  {b.id.replace(/-119$/, "").toUpperCase().replace("-", " ")}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", lineHeight: 1.35,
                                 overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                    {b.title}
                  </span>
                  <span style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginTop: 6 }}>
                    {b.policyArea && <span className="cyr-chip" style={{ fontSize: 11, padding: "2px 8px" }}>{b.policyArea}</span>}
                    <span style={{ fontSize: 12.5, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
                      {b.actionDate}{b.latestAction ? ` · ${b.latestAction}` : ""}
                    </span>
                  </span>
                </span>
                {voted ? (
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#8A5A00", background: "#FFF6DD", borderRadius: 999,
                                 padding: "4px 9px", flexShrink: 0, alignSelf: "center" }}>✓ Voted</span>
                ) : (
                  <span aria-hidden style={{ color: "#94A3B8", fontSize: 18, alignSelf: "center", flexShrink: 0 }}>›</span>
                )}
              </button>
            );
          })}
        </div>

        {listState === "ready" && hasMore && (
          <button onClick={() => loadList(offset + 250, search, true)} className="cyr-btn cyr-btn-ghost"
            style={{ width: "100%", justifyContent: "center", marginTop: 14, padding: 14 }}>
            Load more bills
          </button>
        )}
        {listState === "loading" && bills.length > 0 && (
          <div style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: 10 }}>Loading more…</div>
        )}
      </div>
    </div>
  );
}

function MoneyRow({ icon, label, text, color, bg, border }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "14px 16px", background: "#fff",
                  borderRadius: 16, border: `1px solid ${border}`, boxShadow: "0 1px 2px rgba(15,23,42,.04)" }}>
      <span aria-hidden style={iconDot(bg, color)}>{icon}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 800, color, marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 14.5, color: "#1F2937", lineHeight: 1.6 }}>{text}</div>
      </div>
    </div>
  );
}

function TallyPanel({ tally }) {
  const { sampleSize = 0, counts = {}, verified = {}, open = {} } = tally || {};
  const combined = {};
  for (const p of ["support", "oppose", "undecided"]) combined[p] = (verified[p] || 0) + (open[p] || 0);
  const total = sampleSize || 1;
  const yPct = Math.round((combined.support / total) * 100);
  const nPct = Math.round((combined.oppose / total) * 100);
  return (
    <div style={{ marginTop: 18, padding: "16px 16px 14px", borderRadius: 16, background: "#F6F8FC", border: `1px solid ${C.line}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: C.navy }}>National tally</div>
        <div style={{ fontSize: 13, color: C.muted }}>
          <strong className="cyr-num" style={{ color: "#0F172A", fontSize: 15 }}>{sampleSize.toLocaleString()}</strong> vote{sampleSize !== 1 ? "s" : ""}
        </div>
      </div>
      <TallyBar support={combined.support} oppose={combined.oppose} other={combined.undecided} height={14} />
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 10, fontSize: 13, color: C.muted, alignItems: "center" }}>
        <TallyKey color="#16A34A" label={`${yPct}% yes`} />
        <TallyKey color="#DC2626" label={`${nPct}% no`} />
        <span style={{ fontSize: 12.5 }}>Self-selected, not a scientific survey</span>
      </div>
    </div>
  );
}

function TallyKey({ color, label }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700, color: "#334155" }}>
      <span aria-hidden style={{ width: 10, height: 10, borderRadius: 99, background: color }} />{label}
    </span>
  );
}

function Skeletons({ rows, height }) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {Array.from({ length: rows }).map((_, i) => <div key={i} className="cyr-skeleton" style={{ height }} />)}
    </div>
  );
}

function iconDot(bg, fg) {
  return { width: 38, height: 38, borderRadius: 12, background: bg, color: fg, flexShrink: 0, fontSize: 17,
           display: "inline-flex", alignItems: "center", justifyContent: "center" };
}

const DETAIL_CSS = `
  .cyr-abd-pill { transition: transform .15s ease, box-shadow .2s ease, filter .2s ease, opacity .2s ease; }
  .cyr-abd-pill:not(:disabled):hover { transform: translateY(-2px); filter: saturate(1.08); }
  @media (max-width: 640px) {
    .cyr-abd-nav > button { flex: 1 1 auto; justify-content: center; }
    .cyr-abd-nav > button:first-child { flex-basis: 100%; }
    .cyr-abd-nav > .cyr-abd-next { flex-basis: 100%; }
    .cyr-abd-hero { padding: 22px 18px 20px !important; }
    .cyr-abd-body { padding: 18px 16px 22px !important; }
  }
`;

function Center({ children, color }) {
  return <div style={{ textAlign: "center", padding: 40, color: color || C.muted, fontSize: 14 }}>{children}</div>;
}

function humanize(reason) {
  const m = {
    honeypot_tripped: "This submission looked automated.",
    too_fast: "Submitted too quickly. Try again.",
    rate_ip: "Too many votes from your connection. Try later.",
    rate_subnet: "Too many votes from your network. Try later.",
    missing_fields: "Please select a position.",
  };
  return m[reason] || "Could not record your vote. Please try again.";
}
