// =============================================================================
// AllBillsBrowser.jsx - every active bill on the floor, not just the curated
// eight. Browse, search, open any bill for the full money-trail breakdown,
// and cast a position on it. Same sign-in gate and one-vote-per-account rule
// as the curated Vote tab, because it's the same votes table underneath.
// =============================================================================
import React, { useState, useEffect, useCallback } from "react";
import ContactRep from "./ContactRep.jsx";
import { getStoredSession } from "../lib/session.js";

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
  if (selectedId) {
    return (
      <div style={{ fontFamily: serif, maxWidth: 760, margin: "0 auto" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          <button onClick={closeBill}
            style={{ fontFamily: serif, fontSize: 13, fontWeight: 700, color: C.navy,
                     background: "none", border: `1px solid ${C.line}`, borderRadius: 8,
                     padding: "8px 14px", cursor: "pointer" }}>
            ← All Active Bills
          </button>
          <button onClick={goPrevious} disabled={!hasPrevious || navBusy}
            style={{ fontFamily: serif, fontSize: 13, fontWeight: 700,
                     color: hasPrevious ? C.navy : "#bbb",
                     background: "#fff", border: `1px solid ${C.line}`, borderRadius: 8,
                     padding: "8px 14px", cursor: hasPrevious ? "pointer" : "not-allowed" }}>
            ↑ Previous Bill
          </button>
          <button onClick={goNext} disabled={navBusy || (currentIndex === bills.length - 1 && !hasMore)}
            style={{ fontFamily: serif, fontSize: 13, fontWeight: 700, color: C.navy,
                     background: "#fff", border: `1px solid ${C.line}`, borderRadius: 8,
                     padding: "8px 14px", cursor: "pointer" }}>
            ↓ Next Bill
          </button>
          <button onClick={goNextUnvoted} disabled={navBusy}
            style={{ fontFamily: serif, fontSize: 13, fontWeight: 700, color: "#fff",
                     background: C.crimson, border: "none", borderRadius: 8,
                     padding: "8px 14px", cursor: "pointer" }}>
            {navBusy ? "Searching…" : "⚡ Next You Haven't Voted On"}
          </button>
        </div>

        {detailState === "loading" && <Center>Researching this bill: sponsor, money trail, plain-English summary. First look takes a few seconds, cached forever after.</Center>}
        {detailState === "error" && <Center color={C.crimson}>Could not load this bill. Try again.</Center>}

        {detailState === "ready" && detail && (
          <div style={{ background: C.parchment, border: `1px solid ${C.line}`, borderRadius: 16, overflow: "hidden" }}>
            <div style={{ padding: "20px 24px 0" }}>
              <div style={{ fontSize: 10, color: C.gold, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>
                {detail.policyArea || "Active Legislation"} · {detail.id.replace(/-119$/, "").toUpperCase()}
              </div>
              <h2 style={{ margin: "0 0 10px", fontSize: 20, color: C.navy, lineHeight: 1.3 }}>
                {detail.summary?.headline || detail.title}
              </h2>
              {detail.summary?.plain && (
                <p style={{ margin: "0 0 8px", fontSize: 14, color: "#0F172A", lineHeight: 1.65 }}>
                  {detail.summary.plain}
                </p>
              )}
            </div>

            {detail.summary?.sponsor && (
              <div style={{ margin: "0 24px 8px", padding: "10px 14px", background: "#fff",
                            border: `1px solid ${C.line}`, borderRadius: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.navy, letterSpacing: 1, marginBottom: 4 }}>
                  INTRODUCED BY
                </div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{detail.summary.sponsor}</div>
              </div>
            )}

            <div style={{ margin: "0 24px 16px" }}>
              {detail.summary?.who_benefits && (
                <MoneyRow icon="✅" label="Who benefits if this passes" text={detail.summary.who_benefits}
                  color="#15803D" bg="#E8F5E9" border="#A5D6A7" />
              )}
              {detail.summary?.who_loses && (
                <MoneyRow icon="❌" label="Who is worse off if this passes" text={detail.summary.who_loses}
                  color="#DC2626" bg="#FFEBEE" border="#EF9A9A" />
              )}
              {detail.summary?.pac_money && (
                <MoneyRow icon="💰" label="PAC and donor money behind this bill" text={detail.summary.pac_money}
                  color="#8A5A00" bg="#FFF8E1" border="#FFE082" />
              )}
              {detail.summary?.industries && (
                <MoneyRow icon="🏭" label="Industries with financial stake" text={detail.summary.industries}
                  color="#1A237E" bg="#E8EAF6" border="#9FA8DA" />
              )}
              {detail.summary?.vote_impact && (
                <div style={{ marginTop: 8, padding: "12px 14px", background: C.navy, borderRadius: 12, color: "#fff" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.gold, letterSpacing: 1, marginBottom: 4 }}>
                    IF THIS PASSES: WHAT CHANGES FOR YOU
                  </div>
                  <div style={{ fontSize: 14, lineHeight: 1.6 }}>{detail.summary.vote_impact}</div>
                </div>
              )}
            </div>

            {detail.summary?.status && (
              <div style={{ margin: "0 24px 16px", fontSize: 12.5, color: C.muted }}>
                <strong>Status:</strong> {detail.summary.status}
              </div>
            )}

            {district && (
              <div style={{ margin: "0 24px 20px", padding: "10px 14px", background: "#fff",
                            border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 13 }}>
                Voting as <strong style={{ color: C.crimson }}>District {district}</strong>
              </div>
            )}

            {votePhase === "signin" && (
              <div style={{ margin: "0 24px 24px", padding: 24, background: "#fff",
                            border: `2px solid ${C.crimson}`, borderRadius: 16, textAlign: "center" }}>
                <div style={{ fontSize: 30, marginBottom: 8 }}>🔒</div>
                <div style={{ fontSize: 17, fontWeight: 900, color: C.navy, marginBottom: 6 }}>Sign in to vote</div>
                <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>
                  One position per bill, per account. Head to My Profile to sign in with your email.
                </div>
              </div>
            )}

            {(votePhase === "idle" || votePhase === "submitting") && (
              <div style={{ margin: "0 24px 24px" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 10, letterSpacing: 1 }}>
                  YOUR VOTE ON THIS BILL
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <button onClick={() => castVote("support")} disabled={votePhase === "submitting"}
                    style={{ flex: 1, padding: "18px 12px", fontFamily: serif, fontSize: 20, fontWeight: 900,
                             borderRadius: 16, border: `3px solid #A5D6A7`,
                             background: selectedPosition === "support" ? C.yes : C.yesLight,
                             color: selectedPosition === "support" ? "#fff" : C.yes, cursor: "pointer" }}>
                    ✓ YES
                  </button>
                  <button onClick={() => castVote("oppose")} disabled={votePhase === "submitting"}
                    style={{ flex: 1, padding: "18px 12px", fontFamily: serif, fontSize: 20, fontWeight: 900,
                             borderRadius: 16, border: `3px solid #EF9A9A`,
                             background: selectedPosition === "oppose" ? C.no : C.noLight,
                             color: selectedPosition === "oppose" ? "#fff" : C.no, cursor: "pointer" }}>
                    ✗ NO
                  </button>
                </div>
                <button onClick={() => castVote("undecided")} disabled={votePhase === "submitting"}
                  style={{ width: "100%", marginTop: 8, padding: 10, fontFamily: serif, fontSize: 13, fontWeight: 700,
                           borderRadius: 12, border: `1px solid ${C.line}`, background: "#fff", color: C.muted, cursor: "pointer" }}>
                  Not sure / Undecided
                </button>
                {votePhase === "submitting" && <div style={{ textAlign: "center", color: C.muted, fontSize: 13, marginTop: 8 }}>Recording your vote…</div>}
              </div>
            )}

            {voteError && (
              <div style={{ margin: "0 24px 16px", padding: "10px 12px", borderRadius: 8,
                            background: "#FBE9E7", color: C.crimson, fontSize: 13, border: `1px solid ${C.crimson}` }}>
                {voteError}
              </div>
            )}

            {votePhase === "done" && (
              <div style={{ margin: "0 24px 16px", padding: "14px 16px", background: C.yes, color: "#fff",
                            borderRadius: 12, textAlign: "center" }}>
                <div style={{ fontSize: 19, fontWeight: 900 }}>
                  {selectedPosition === "support" ? "✓ YES recorded" : selectedPosition === "oppose" ? "✗ NO recorded" : "Undecided recorded"}
                </div>
              </div>
            )}

            {votePhase === "already" && (
              <div style={{ margin: "0 24px 16px", padding: "14px 16px", background: "linear-gradient(125deg,#0B225A 0%,#1D3FA6 58%,#2563EB 100%)", color: "#fff",
                            borderRadius: 12, textAlign: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 900 }}>
                  You already voted {selectedPosition === "support" ? "YES" : selectedPosition === "oppose" ? "NO" : "Undecided"} on this bill
                </div>
                <div style={{ fontSize: 11, marginTop: 4, color: C.gold }}>One position per bill, per account.</div>
              </div>
            )}

            {tally && <TallyPanel tally={tally} />}

            {(votePhase === "done" || votePhase === "already") && (
              <div style={{ margin: "0 24px 24px" }}>
                {!showContact ? (
                  <button onClick={() => setShowContact(true)}
                    style={{ width: "100%", padding: 10, fontFamily: serif, fontSize: 14, fontWeight: 700,
                             borderRadius: 8, border: `1px solid ${C.line}`, background: "#fff", color: C.navy, cursor: "pointer" }}>
                    Contact Your Representative About This Bill
                  </button>
                ) : (
                  <ContactRep district={district} billId={detail.id} billTitle={detail.title}
                    position={selectedPosition} onClose={() => setShowContact(false)} />
                )}
              </div>
            )}
          </div>
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
    <div style={{ marginTop: 8, padding: "10px 14px", background: bg, borderRadius: 12, border: `1px solid ${border}` }}>
      <div style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 4 }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: 13, color: "#0F172A", lineHeight: 1.55 }}>{text}</div>
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
    <div style={{ margin: "0 24px 20px", borderTop: `2px solid ${C.gold}`, paddingTop: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.navy, letterSpacing: 1, marginBottom: 10 }}>
        NATIONAL TALLY: {sampleSize} VOTE{sampleSize !== 1 ? "S" : ""}
      </div>
      <div style={{ display: "flex", gap: 6, height: 22 }}>
        <div style={{ flex: yPct || 0.0001, background: "#15803D", borderRadius: 3 }} />
        <div style={{ flex: nPct || 0.0001, background: "#DC2626", borderRadius: 3 }} />
      </div>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
        {yPct}% YES · {nPct}% NO · self-selected, not a scientific survey
      </div>
    </div>
  );
}

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
