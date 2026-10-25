// =============================================================================
// RollCallExplorer.jsx - browse any past roll call vote in either chamber and
// see exactly who voted which way. House data via Congress.gov, Senate via
// senate.gov official records. If the visitor's district is known, their
// state's members float to the top of every breakdown.
//
// October 2026 redesign: PageHero, Seg chamber switch, cyr-row lists, Panels,
// StatGrid tally and TallyBar. Data flow is unchanged.
// =============================================================================
import React, { useState, useEffect } from "react";
import { PageHero, StatGrid, Panel, Seg, TallyBar as KitTallyBar, Loading, Empty, ErrorBox } from "./ui/Kit.jsx";

const C = {
  navy:"#0E2A6B", blue:"#2563EB", ink:"#0F172A",
  yea:"#15803D", yeaLight:"#ECFDF3",
  nay:"#DC2626", nayLight:"#FEF2F2",
  muted:"#5B6578", line:"#E2E8F0",
};
const mono = "var(--cyr-mono)";
const PARTY_COLOR = { R: "#DC2626", D: "#1D4ED8", I: "#7C3AED", ID: "#7C3AED" };
const PARTY_BG = { R: "#FEF2F2", D: "#EEF4FF", I: "#F5F3FF", ID: "#F5F3FF" };

// Phone-sized tap targets for the shared Seg pills on this tab.
const LOCAL_CSS = `.rc-seg .cyr-seg button{min-height:40px;padding-left:20px;padding-right:20px}`;

// Congress.gov sends ISO timestamps; show them as a readable date. Anything
// else (senate.gov text dates) is shown exactly as sent.
function fmtDate(d) {
  if (typeof d !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(d)) return d;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  try {
    return dt.toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric",
                                        hour: "numeric", minute: "2-digit" }) + " ET";
  } catch {
    return d;
  }
}

function passed(result) {
  const r = String(result || "").toLowerCase();
  return r.includes("pass") || r.includes("agreed");
}

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

  const chamberName = chamber === "house" ? "House" : "Senate";

  return (
    <div style={{ fontFamily: "var(--cyr-sans)", maxWidth: 940, margin: "0 auto", color: C.ink }}>
      <style>{LOCAL_CSS}</style>

      <PageHero
        eyebrow="The permanent record"
        title="Roll call votes"
        lede="Every recorded vote. Every name attached to it. Straight from official records."
        chips={[
          listState === "ready" ? { value: list.length, label: `recent ${chamberName} votes` } : null,
          district ? { value: district, label: "your district" } : null,
        ]}
      />

      {/* Chamber toggle */}
      <div className="rc-seg" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                                       flexWrap: "wrap", marginBottom: 16 }}>
        <Seg value={chamber} onChange={setChamber}
          options={[{ value: "house", label: "House" }, { value: "senate", label: "Senate" }]} />
        <span style={{ fontSize: 12.5, color: C.muted }}>
          {chamber === "house" ? "Source: Congress.gov" : "Source: senate.gov official records"}
        </span>
      </div>

      {/* Detail view */}
      {selected && (
        <div>
          <button type="button" onClick={() => setSelected(null)} className="cyr-btn cyr-btn-ghost"
            style={{ marginBottom: 14, minHeight: 40 }}>
            <span aria-hidden>←</span> All {chamberName} votes
          </button>

          {detailState === "loading" && (
            <Panel>
              <div style={{ fontSize: 13.5, color: C.muted, marginBottom: 12 }}>Pulling the official record…</div>
              <Loading rows={4} height={56} />
            </Panel>
          )}
          {detailState === "error" && <ErrorBox>Could not load this vote. Try again shortly.</ErrorBox>}

          {detailState === "ready" && detail && (
            <div>
              <Panel
                eyebrow={`Roll call #${detail.vote}${detail.bill ? ` · ${detail.bill}` : ""}`}
                title={detail.question || "Recorded vote"}
              >
                <span className="cyr-chip" style={{ fontSize: 13, padding: "6px 12px",
                  background: passed(detail.result) ? C.yeaLight : C.nayLight,
                  color: passed(detail.result) ? C.yea : C.nay }}>
                  {passed(detail.result) ? "✓" : "✕"} Result: {detail.result || "Recorded"}
                </span>

                {detail.summary && (detail.summary.headline || detail.summary.plain) && (
                  <div style={{ marginTop: 16, padding: "14px 16px", background: "#F8FAFE", border: `1px solid ${C.line}`, borderRadius: 14 }}>
                    <div className="cyr-eyebrow" style={{ fontSize: 11 }}>What this bill does</div>
                    {detail.summary.headline && (
                      <div style={{ fontFamily: "var(--cyr-display)", fontSize: 17, fontWeight: 750, color: C.navy, margin: "6px 0 4px", lineHeight: 1.3 }}>
                        {detail.summary.headline}
                      </div>
                    )}
                    {detail.summary.plain && (
                      <div style={{ fontSize: 14, color: "#334155", lineHeight: 1.65 }}>
                        {detail.summary.plain}
                      </div>
                    )}
                  </div>
                )}
              </Panel>

              {/* Tally */}
              <StatGrid min={100} items={[
                { value: detail.tally.yea, label: "Yea", tone: "green" },
                { value: detail.tally.nay, label: "Nay", tone: "red" },
                detail.tally.present ? { value: detail.tally.present, label: "Present", tone: "gold" } : null,
                detail.tally.not_voting ? { value: detail.tally.not_voting, label: "Not voting", tone: "navy" } : null,
              ]} />

              <Panel title="How each party voted" pad={18}>
                <TallyBar tally={detail.tally} />

                {/* Party breakdown */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10, marginTop: 16 }}>
                  {Object.entries(detail.tally.byParty).map(([party, t]) => (
                    <div key={party} style={{ background: PARTY_BG[party] || "#F8FAFE", border: `1px solid ${C.line}`,
                                              borderRadius: 14, padding: "12px 14px", minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <span style={{ width: 28, height: 28, borderRadius: 9, display: "grid", placeItems: "center", flexShrink: 0,
                                       background: PARTY_COLOR[party] || C.muted, color: "#fff", fontWeight: 800, fontSize: 12.5 }}>{party}</span>
                        <span style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>{t.yea + t.nay + (t.present || 0) + (t.not_voting || 0)} members</span>
                      </div>
                      <KitTallyBar support={t.yea} oppose={t.nay} other={(t.present || 0) + (t.not_voting || 0)} height={8} />
                      <div style={{ fontSize: 13, marginTop: 8, display: "flex", flexWrap: "wrap", gap: "2px 10px" }}>
                        <span style={{ color: C.yea, fontWeight: 700 }}>{t.yea} yea</span>
                        <span style={{ color: C.nay, fontWeight: 700 }}>{t.nay} nay</span>
                        {t.not_voting ? <span style={{ color: C.muted }}>{t.not_voting} NV</span> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel title="Every member's vote" pad={16}
                action={<span className="cyr-chip" style={{ flexShrink: 0 }}>{detail.members.length} members</span>}>
                {/* Search */}
                <div style={{ position: "relative", marginBottom: 14 }}>
                  <span aria-hidden style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 15, opacity: .55 }}>🔎</span>
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder={`Search by name or state (e.g. ${myState || "CO"})`}
                    aria-label="Search members by name or state"
                    style={{ width: "100%", boxSizing: "border-box", fontFamily: "inherit", fontSize: 15,
                             padding: "12px 14px 12px 40px", border: `1px solid ${C.line}`, borderRadius: 999 }} />
                </div>

                {/* Member list, my state first */}
                <MemberList members={detail.members} search={search} myState={myState} />
              </Panel>
            </div>
          )}
        </div>
      )}

      {/* List view */}
      {!selected && (
        <Panel title={`Recent ${chamberName} votes`} eyebrow="Newest first" pad={14}
          action={listState === "ready" ? <span className="cyr-chip" style={{ flexShrink: 0 }}>{list.length} votes</span> : null}>
          {listState === "loading" && <Loading rows={6} height={64} />}
          {listState === "error" && <ErrorBox>Could not load the vote list. Try again shortly.</ErrorBox>}
          {listState === "ready" && list.length === 0 && (
            <Empty icon="📋" title="No recorded votes yet">No roll call votes are on file for this session yet.</Empty>
          )}
          {listState === "ready" && list.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 8 }}>
              {list.map((v, i) => {
                const ok = passed(v.result);
                return (
                  <button key={v.vote} type="button" onClick={() => setSelected(v.vote)}
                    className={i < 12 ? "cyr-row cyr-rise" : "cyr-row"}
                    style={{ width: "100%", textAlign: "left", cursor: "pointer", fontFamily: "inherit",
                             alignItems: "flex-start", padding: "12px 14px", animationDelay: `${Math.min(i, 12) * 25}ms` }}>
                    <span style={{ flexShrink: 0, minWidth: 58, textAlign: "center", borderRadius: 10, padding: "6px 8px",
                                   background: "#EEF2F8", color: C.navy, fontFamily: mono, fontSize: 12, fontWeight: 700 }}>
                      #{v.vote}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 14.5, fontWeight: 700, color: C.ink, lineHeight: 1.35,
                                     overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                        {v.bill ? <span style={{ color: C.blue }}>{v.bill}: </span> : ""}{v.question || v.description || "Recorded vote"}
                      </span>
                      <span style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 6 }}>
                        {v.result && (
                          <span className="cyr-chip" style={{ fontSize: 11, padding: "2px 8px",
                            background: ok ? C.yeaLight : C.nayLight, color: ok ? C.yea : C.nay }}>{v.result}</span>
                        )}
                        <span style={{ fontSize: 12.5, color: C.muted }}>{fmtDate(v.date)}</span>
                      </span>
                    </span>
                    <span aria-hidden style={{ color: "#94A3B8", fontSize: 18, alignSelf: "center", flexShrink: 0 }}>›</span>
                  </button>
                );
              })}
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}

function TallyBar({ tally }) {
  const total = tally.yea + tally.nay || 1;
  const yPct = Math.round((tally.yea / total) * 100);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 14, fontWeight: 700 }}>
          <span style={{ color: C.yea }}>{tally.yea} yea</span>
          <span style={{ color: "#94A3B8" }}> / </span>
          <span style={{ color: C.nay }}>{tally.nay} nay</span>
        </span>
        <span className="cyr-num" style={{ fontSize: 18, color: C.navy }}>{yPct}% <span style={{ fontFamily: "var(--cyr-sans)", fontSize: 12.5, fontWeight: 600, color: C.muted }}>in favor</span></span>
      </div>
      <KitTallyBar support={tally.yea} oppose={tally.nay} height={14} />
      {(tally.not_voting || tally.present) ? (
        <div style={{ fontSize: 12.5, color: C.muted, marginTop: 6 }}>
          {[tally.not_voting ? `${tally.not_voting} not voting` : null, tally.present ? `${tally.present} present` : null].filter(Boolean).join(" · ")}
        </div>
      ) : null}
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

  const label = p => p === "yea" ? "Yea" : p === "nay" ? "Nay" : p === "present" ? "Present" : "Not voting";
  const row = (m, i, highlight) => (
    <div key={`${m.name}-${i}`} className={highlight ? "cyr-row cyr-row-mine" : "cyr-row"}
      style={{ gap: 10, padding: "9px 12px", minHeight: 44 }}>
      <span style={{ minWidth: 74, textAlign: "center", fontSize: 11.5, fontWeight: 800, flexShrink: 0,
                     padding: "5px 6px", borderRadius: 999,
                     background: m.position === "yea" ? C.yeaLight : m.position === "nay" ? C.nayLight : "#F1F5F9",
                     color: m.position === "yea" ? C.yea : m.position === "nay" ? C.nay : C.muted }}>
        {label(m.position)}
      </span>
      <span title={m.name} style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: C.ink,
                     overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</span>
      <span style={{ fontFamily: mono, fontSize: 11.5, fontWeight: 700, flexShrink: 0, borderRadius: 8, padding: "3px 7px",
                     background: PARTY_BG[m.party] || "#F1F5F9", color: PARTY_COLOR[m.party] || C.muted }}>
        {m.party}-{m.state}
      </span>
    </div>
  );

  const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))", gap: 6 };

  return (
    <div>
      {mine.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.navy, marginBottom: 8 }}>
            Your state ({myState})
          </div>
          <div style={grid}>{mine.map((m, i) => row(m, i, true))}</div>
        </div>
      )}
      {mine.length > 0 && rest.length > 0 && (
        <div style={{ fontSize: 13, fontWeight: 800, color: C.muted, margin: "6px 0 8px" }}>
          Everyone else
        </div>
      )}
      <div style={grid}>{rest.map((m, i) => row(m, i, false))}</div>
      {filtered.length === 0 && (
        <Empty icon="🔎" title="No matches">No members match that search.</Empty>
      )}
    </div>
  );
}
