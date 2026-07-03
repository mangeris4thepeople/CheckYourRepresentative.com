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
  navy:"#0A1A3F", gold:"#C9A227", crimson:"#8B0000",
  yes:"#1B5E20", yesLight:"#E8F5E9",
  no:"#B71C1C", noLight:"#FFEBEE",
  parchment:"#FBF7EC", muted:"#5C5347", line:"#D8C9A0",
};
const serif = "Georgia,'Times New Roman',serif";
const mono = "'Courier New',monospace";

async function fetchList(offset, q) {
  const params = new URLSearchParams({ offset: String(offset) });
  if (q) params.set("q", q);
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

  const loadList = useCallback(async (newOffset, q, append) => {
    setListState("loading");
    try {
      const data = await fetchList(newOffset, q);
      setBills(prev => append ? [...prev, ...data.bills] : data.bills);
      setOffset(data.offset);
      setHasMore(data.hasMore);
      setTotalCount(data.totalCount);
      setListState("ready");
    } catch {
      setListState("error");
    }
  }, []);

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
        if (s.voted) { setSelectedPosition(s.position); setVotePhase("already"); }
        else setVotePhase("idle");
      })
      .catch(() => setVotePhase("idle"));
  }

  function closeBill() {
    setSelectedId(null); setDetail(null); setDetailState("idle");
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
        setSelectedPosition(res.position || position); setVotePhase("already"); return;
      }
      if (res.status === "rejected") {
        if (res.reason === "signin_required") { setVotePhase("signin"); return; }
        setVoteError(humanize(res.reason)); setVotePhase("idle"); return;
      }
      setVotePhase("done"); setShowContact(true);
      fetchTally(selectedId).then(setTally).catch(() => {});
    } catch {
      setVoteError("Could not reach the server. Try again."); setVotePhase("idle");
    }
  }

  // ================= DETAIL VIEW =================
  if (selectedId) {
    return (
      <div style={{ fontFamily: serif, maxWidth: 760, margin: "0 auto" }}>
        <button onClick={closeBill}
          style={{ fontFamily: serif, fontSize: 13, fontWeight: 700, color: C.navy,
                   background: "none", border: `1px solid ${C.line}`, borderRadius: 4,
                   padding: "8px 14px", cursor: "pointer", marginBottom: 14 }}>
          ← All Active Bills
        </button>

        {detailState === "loading" && <Center>Researching this bill: sponsor, money trail, plain-English summary. First look takes a few seconds, cached forever after.</Center>}
        {detailState === "error" && <Center color={C.crimson}>Could not load this bill. Try again.</Center>}

        {detailState === "ready" && detail && (
          <div style={{ background: C.parchment, border: `1px solid ${C.line}`, borderRadius: 8, overflow: "hidden" }}>
            <div style={{ padding: "20px 24px 0" }}>
              <div style={{ fontSize: 10, color: C.gold, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>
                {detail.policyArea || "Active Legislation"} · {detail.id.replace(/-119$/, "").toUpperCase()}
              </div>
              <h2 style={{ margin: "0 0 10px", fontSize: 20, color: C.navy, lineHeight: 1.3 }}>
                {detail.summary?.headline || detail.title}
              </h2>
              {detail.summary?.plain && (
                <p style={{ margin: "0 0 8px", fontSize: 14, color: "#1A1A1A", lineHeight: 1.65 }}>
                  {detail.summary.plain}
                </p>
              )}
            </div>

            {detail.summary?.sponsor && (
              <div style={{ margin: "0 24px 8px", padding: "10px 14px", background: "#fff",
                            border: `1px solid ${C.line}`, borderRadius: 6 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.navy, letterSpacing: 1, marginBottom: 4 }}>
                  INTRODUCED BY
                </div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{detail.summary.sponsor}</div>
              </div>
            )}

            <div style={{ margin: "0 24px 16px" }}>
              {detail.summary?.who_benefits && (
                <MoneyRow icon="✅" label="Who benefits if this passes" text={detail.summary.who_benefits}
                  color="#1B5E20" bg="#E8F5E9" border="#A5D6A7" />
              )}
              {detail.summary?.who_loses && (
                <MoneyRow icon="❌" label="Who is worse off if this passes" text={detail.summary.who_loses}
                  color="#B71C1C" bg="#FFEBEE" border="#EF9A9A" />
              )}
              {detail.summary?.pac_money && (
                <MoneyRow icon="💰" label="PAC and donor money behind this bill" text={detail.summary.pac_money}
                  color="#5C4400" bg="#FFF8E1" border="#FFE082" />
              )}
              {detail.summary?.industries && (
                <MoneyRow icon="🏭" label="Industries with financial stake" text={detail.summary.industries}
                  color="#1A237E" bg="#E8EAF6" border="#9FA8DA" />
              )}
              {detail.summary?.vote_impact && (
                <div style={{ marginTop: 8, padding: "12px 14px", background: C.navy, borderRadius: 6, color: "#fff" }}>
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
                            border: `1px solid ${C.line}`, borderRadius: 4, fontSize: 13 }}>
                Voting as <strong style={{ color: C.crimson }}>District {district}</strong>
              </div>
            )}

            {votePhase === "signin" && (
              <div style={{ margin: "0 24px 24px", padding: 24, background: "#fff",
                            border: `2px solid ${C.crimson}`, borderRadius: 8, textAlign: "center" }}>
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
                             borderRadius: 8, border: `3px solid #A5D6A7`,
                             background: selectedPosition === "support" ? C.yes : C.yesLight,
                             color: selectedPosition === "support" ? "#fff" : C.yes, cursor: "pointer" }}>
                    ✓ YES
                  </button>
                  <button onClick={() => castVote("oppose")} disabled={votePhase === "submitting"}
                    style={{ flex: 1, padding: "18px 12px", fontFamily: serif, fontSize: 20, fontWeight: 900,
                             borderRadius: 8, border: `3px solid #EF9A9A`,
                             background: selectedPosition === "oppose" ? C.no : C.noLight,
                             color: selectedPosition === "oppose" ? "#fff" : C.no, cursor: "pointer" }}>
                    ✗ NO
                  </button>
                </div>
                <button onClick={() => castVote("undecided")} disabled={votePhase === "submitting"}
                  style={{ width: "100%", marginTop: 8, padding: 10, fontFamily: serif, fontSize: 13, fontWeight: 700,
                           borderRadius: 6, border: `1px solid ${C.line}`, background: "#fff", color: C.muted, cursor: "pointer" }}>
                  Not sure / Undecided
                </button>
                {votePhase === "submitting" && <div style={{ textAlign: "center", color: C.muted, fontSize: 13, marginTop: 8 }}>Recording your vote…</div>}
              </div>
            )}

            {voteError && (
              <div style={{ margin: "0 24px 16px", padding: "10px 12px", borderRadius: 4,
                            background: "#FBE9E7", color: C.crimson, fontSize: 13, border: `1px solid ${C.crimson}` }}>
                {voteError}
              </div>
            )}

            {votePhase === "done" && (
              <div style={{ margin: "0 24px 16px", padding: "14px 16px", background: C.yes, color: "#fff",
                            borderRadius: 6, textAlign: "center" }}>
                <div style={{ fontSize: 19, fontWeight: 900 }}>
                  {selectedPosition === "support" ? "✓ YES recorded" : selectedPosition === "oppose" ? "✗ NO recorded" : "Undecided recorded"}
                </div>
              </div>
            )}

            {votePhase === "already" && (
              <div style={{ margin: "0 24px 16px", padding: "14px 16px", background: C.navy, color: "#fff",
                            borderRadius: 6, textAlign: "center" }}>
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
                             borderRadius: 4, border: `1px solid ${C.line}`, background: "#fff", color: C.navy, cursor: "pointer" }}>
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
  return (
    <div style={{ fontFamily: serif, maxWidth: 860, margin: "0 auto" }}>
      <div style={{ background: C.navy, color: "#fff", padding: "20px 24px",
                    borderRadius: "8px 8px 0 0", borderBottom: `3px solid ${C.gold}` }}>
        <div style={{ fontSize: 10, color: C.gold, fontWeight: 700, letterSpacing: 1 }}>
          THE FULL FLOOR
        </div>
        <div style={{ fontSize: 20, fontWeight: 700 }}>All Active Bills</div>
        <div style={{ fontSize: 12.5, color: "#cfd6e4", marginTop: 4 }}>
          Every bill with recent activity in the 119th Congress{totalCount ? ` · ${totalCount.toLocaleString()} total` : ""}.
        </div>
      </div>

      <div style={{ background: C.parchment, border: `1px solid ${C.line}`, borderTop: "none",
                    borderRadius: "0 0 8px 8px", padding: "16px 24px" }}>

        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && runSearch()}
            placeholder="Search by keyword or policy area (e.g. health, defense, tax)"
            style={{ flex: 1, fontFamily: serif, fontSize: 14, padding: "10px 12px",
                     border: `1px solid ${C.line}`, borderRadius: 5 }} />
          <button onClick={runSearch}
            style={{ fontFamily: serif, fontWeight: 700, fontSize: 13, padding: "10px 18px",
                     background: C.crimson, color: "#fff", border: "none", borderRadius: 5, cursor: "pointer" }}>
            Search
          </button>
        </div>

        {listState === "loading" && bills.length === 0 && <Center>Loading active bills…</Center>}
        {listState === "error" && <Center color={C.crimson}>Could not load bills. Try again shortly.</Center>}
        {listState === "ready" && bills.length === 0 && <Center>No bills match that search.</Center>}

        {bills.map(b => (
          <button key={b.id} onClick={() => openBill(b.id)}
            style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left",
                     background: "#fff", border: `1px solid ${C.line}`, borderRadius: 6,
                     padding: "12px 16px", marginBottom: 8, cursor: "pointer", fontFamily: serif }}>
            <div style={{ fontFamily: mono, fontSize: 11, color: C.muted, minWidth: 66, flexShrink: 0 }}>
              {b.id.replace(/-119$/, "").toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: C.navy,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {b.title}
              </div>
              <div style={{ fontSize: 11, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {b.policyArea ? `${b.policyArea} · ` : ""}{b.actionDate}: {b.latestAction}
              </div>
            </div>
          </button>
        ))}

        {listState === "ready" && hasMore && (
          <button onClick={() => loadList(offset + 250, search, true)}
            style={{ width: "100%", padding: 12, fontFamily: serif, fontWeight: 700, fontSize: 13,
                     background: C.navy, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", marginTop: 4 }}>
            Load More Bills
          </button>
        )}
        {listState === "loading" && bills.length > 0 && (
          <div style={{ textAlign: "center", color: C.muted, fontSize: 12, padding: 8 }}>Loading more…</div>
        )}
      </div>
    </div>
  );
}

function MoneyRow({ icon, label, text, color, bg, border }) {
  return (
    <div style={{ marginTop: 8, padding: "10px 14px", background: bg, borderRadius: 6, border: `1px solid ${border}` }}>
      <div style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 4 }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: 13, color: "#1A1A1A", lineHeight: 1.55 }}>{text}</div>
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
        <div style={{ flex: yPct || 0.0001, background: "#1B5E20", borderRadius: 3 }} />
        <div style={{ flex: nPct || 0.0001, background: "#B71C1C", borderRadius: 3 }} />
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
