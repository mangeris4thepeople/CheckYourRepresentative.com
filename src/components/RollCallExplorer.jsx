// =============================================================================
// RollCallExplorer.jsx - browse any past roll call vote in either chamber and
// see exactly who voted which way. House data via Congress.gov, Senate via
// senate.gov official records. If the visitor's district is known, their
// state's members float to the top of every breakdown.
// =============================================================================
import React, { useState, useEffect } from "react";

const C = {
  navy:"#0A1A3F", gold:"#C9A227", crimson:"#8B0000",
  yea:"#1B5E20", yeaLight:"#E8F5E9",
  nay:"#B71C1C", nayLight:"#FFEBEE",
  parchment:"#FBF7EC", muted:"#5C5347", line:"#D8C9A0",
};
const serif = "Georgia,'Times New Roman',serif";
const mono = "'Courier New',monospace";
const PARTY_COLOR = { R: "#B71C1C", D: "#0D47A1", I: "#4A148C", ID: "#4A148C" };

export default function RollCallExplorer({ district }) {
  const [chamber, setChamber] = useState("house");
  const [list, setList] = useState([]);
  const [listState, setListState] = useState("loading");
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailState, setDetailState] = useState("idle");
  const [search, setSearch] = useState("");
  const myState = district ? district.split("-")[0] : null;

  useEffect(() => {
    let cancelled = false;
    setListState("loading"); setList([]); setSelected(null); setDetail(null);
    fetch(`/api/rollcall?chamber=${chamber}`)
      .then(r => { if (!r.ok) throw new Error("bad"); return r.json(); })
      .then(d => { if (!cancelled) { setList(d.votes || []); setListState("ready"); } })
      .catch(() => { if (!cancelled) setListState("error"); });
    return () => { cancelled = true; };
  }, [chamber]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setDetailState("loading"); setDetail(null); setSearch("");
    fetch(`/api/rollcall?chamber=${chamber}&vote=${selected}`)
      .then(r => { if (!r.ok) throw new Error("bad"); return r.json(); })
      .then(d => { if (!cancelled) { setDetail(d); setDetailState("ready"); } })
      .catch(() => { if (!cancelled) setDetailState("error"); });
    return () => { cancelled = true; };
  }, [selected, chamber]);

  return (
    <div style={{ fontFamily: serif, maxWidth: 860, margin: "0 auto" }}>
      <div style={{ background: C.navy, color: "#fff", padding: "20px 24px",
                    borderRadius: "8px 8px 0 0", borderBottom: `3px solid ${C.gold}` }}>
        <div style={{ fontSize: 10, color: C.gold, fontWeight: 700, letterSpacing: 1 }}>
          THE PERMANENT RECORD
        </div>
        <div style={{ fontSize: 20, fontWeight: 700 }}>Roll Call Votes</div>
        <div style={{ fontSize: 12.5, color: "#cfd6e4", marginTop: 4 }}>
          Every recorded vote. Every name attached to it. Straight from official records.
        </div>
      </div>

      <div style={{ background: C.parchment, border: `1px solid ${C.line}`, borderTop: "none",
                    borderRadius: "0 0 8px 8px", padding: "18px 24px" }}>

        {/* Chamber toggle */}
        <div style={{ display: "flex", border: `1px solid ${C.navy}`, borderRadius: 6,
                      overflow: "hidden", width: "fit-content", marginBottom: 16 }}>
          {["house", "senate"].map(ch => (
            <button key={ch} onClick={() => setChamber(ch)}
              style={{ fontFamily: serif, fontSize: 13, fontWeight: 700, padding: "9px 20px",
                       border: "none", cursor: "pointer",
                       background: chamber === ch ? C.navy : "#fff",
                       color: chamber === ch ? "#fff" : C.navy }}>
              {ch === "house" ? "House" : "Senate"}
            </button>
          ))}
        </div>

        {/* Detail view */}
        {selected && (
          <div>
            <button onClick={() => setSelected(null)}
              style={{ fontFamily: serif, fontSize: 13, fontWeight: 700, color: C.navy,
                       background: "none", border: `1px solid ${C.line}`, borderRadius: 4,
                       padding: "7px 14px", cursor: "pointer", marginBottom: 14 }}>
              ← All {chamber === "house" ? "House" : "Senate"} votes
            </button>

            {detailState === "loading" && <Center>Pulling the official record…</Center>}
            {detailState === "error" && <Center>Could not load this vote. Try again shortly.</Center>}

            {detailState === "ready" && detail && (
              <div>
                <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 6,
                              padding: "16px 18px", marginBottom: 14 }}>
                  <div style={{ fontFamily: mono, fontSize: 11, color: C.muted, marginBottom: 4 }}>
                    ROLL CALL #{detail.vote}{detail.bill ? ` · ${detail.bill}` : ""}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.navy, marginBottom: 6 }}>
                    {detail.question || "Recorded vote"}
                  </div>
                  <div style={{ fontSize: 13, color: detail.result?.toLowerCase().includes("pass") || detail.result?.toLowerCase().includes("agreed") ? C.yea : C.crimson, fontWeight: 700 }}>
                    Result: {detail.result || "Recorded"}
                  </div>
                </div>

                {/* Tally bar */}
                <TallyBar tally={detail.tally} />

                {/* Party breakdown */}
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "12px 0 16px" }}>
                  {Object.entries(detail.tally.byParty).map(([party, t]) => (
                    <div key={party} style={{ background: "#fff", border: `1px solid ${C.line}`,
                                              borderRadius: 6, padding: "8px 14px", fontSize: 12.5 }}>
                      <span style={{ fontWeight: 900, color: PARTY_COLOR[party] || C.muted }}>{party}</span>
                      {"  "}
                      <span style={{ color: C.yea, fontWeight: 700 }}>{t.yea} yea</span>
                      {" · "}
                      <span style={{ color: C.nay, fontWeight: 700 }}>{t.nay} nay</span>
                      {t.not_voting ? <span style={{ color: C.muted }}> · {t.not_voting} NV</span> : null}
                    </div>
                  ))}
                </div>

                {/* Search */}
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder={`Search by name or state (e.g. ${myState || "CO"})`}
                  style={{ width: "100%", boxSizing: "border-box", fontFamily: serif, fontSize: 14,
                           padding: "10px 12px", border: `1px solid ${C.line}`, borderRadius: 5,
                           marginBottom: 12 }} />

                {/* Member list, my state first */}
                <MemberList members={detail.members} search={search} myState={myState} />
              </div>
            )}
          </div>
        )}

        {/* List view */}
        {!selected && (
          <div>
            {listState === "loading" && <Center>Loading recorded votes…</Center>}
            {listState === "error" && <Center>Could not load the vote list. Try again shortly.</Center>}
            {listState === "ready" && list.map(v => (
              <button key={v.vote} onClick={() => setSelected(v.vote)}
                style={{ display: "flex", alignItems: "center", gap: 14, width: "100%",
                         textAlign: "left", background: "#fff", border: `1px solid ${C.line}`,
                         borderRadius: 6, padding: "12px 16px", marginBottom: 8,
                         cursor: "pointer", fontFamily: serif }}>
                <div style={{ fontFamily: mono, fontSize: 11, color: C.muted, minWidth: 56, flexShrink: 0 }}>
                  #{v.vote}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.navy,
                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {v.bill ? `${v.bill}: ` : ""}{v.question || v.description || "Recorded vote"}
                  </div>
                  <div style={{ fontSize: 11.5, color: C.muted }}>
                    {v.date} · {v.result}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TallyBar({ tally }) {
  const total = tally.yea + tally.nay || 1;
  const yPct = Math.round((tally.yea / total) * 100);
  return (
    <div>
      <div style={{ display: "flex", gap: 6, height: 30, borderRadius: 4, overflow: "hidden" }}>
        <div style={{ flex: tally.yea || 1, background: C.yea, display: "flex",
                      alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: "#fff", fontSize: 13, fontWeight: 900 }}>{tally.yea} YEA</span>
        </div>
        <div style={{ flex: tally.nay || 1, background: C.nay, display: "flex",
                      alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: "#fff", fontSize: 13, fontWeight: 900 }}>{tally.nay} NAY</span>
        </div>
      </div>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
        {yPct}% in favor{tally.not_voting ? ` · ${tally.not_voting} not voting` : ""}{tally.present ? ` · ${tally.present} present` : ""}
      </div>
    </div>
  );
}

function MemberList({ members, search, myState }) {
  const q = search.trim().toLowerCase();
  let filtered = members;
  if (q) {
    filtered = members.filter(m =>
      m.name.toLowerCase().includes(q) || m.state.toLowerCase() === q);
  }
  const mine = myState ? filtered.filter(m => m.state === myState) : [];
  const rest = myState ? filtered.filter(m => m.state !== myState) : filtered;

  const row = (m, i, highlight) => (
    <div key={`${m.name}-${i}`}
      style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
               background: highlight ? "#FFF8E1" : "#fff",
               border: `1px solid ${highlight ? C.gold : C.line}`,
               borderRadius: 4, marginBottom: 5 }}>
      <div style={{ minWidth: 46, textAlign: "center", fontSize: 11, fontWeight: 900,
                    padding: "4px 0", borderRadius: 3,
                    background: m.position === "yea" ? C.yeaLight : m.position === "nay" ? C.nayLight : "#f2f2f2",
                    color: m.position === "yea" ? C.yea : m.position === "nay" ? C.nay : C.muted }}>
        {m.position === "yea" ? "YEA" : m.position === "nay" ? "NAY" : m.position === "present" ? "PRES" : "NV"}
      </div>
      <div style={{ flex: 1, fontSize: 13.5, color: "#1A1A1A" }}>{m.name}</div>
      <div style={{ fontFamily: mono, fontSize: 11.5, fontWeight: 700,
                    color: PARTY_COLOR[m.party] || C.muted, flexShrink: 0 }}>
        {m.party}-{m.state}
      </div>
    </div>
  );

  return (
    <div>
      {mine.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.navy, letterSpacing: 1, marginBottom: 6 }}>
            YOUR STATE ({myState})
          </div>
          {mine.map((m, i) => row(m, i, true))}
        </div>
      )}
      {mine.length > 0 && rest.length > 0 && (
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 1, margin: "10px 0 6px" }}>
          EVERYONE ELSE
        </div>
      )}
      {rest.map((m, i) => row(m, i, false))}
      {filtered.length === 0 && (
        <div style={{ color: C.muted, fontSize: 13, padding: "12px 0" }}>No members match that search.</div>
      )}
    </div>
  );
}

function Center({ children }) {
  return <div style={{ textAlign: "center", padding: "34px 16px", color: C.muted }}>{children}</div>;
}
