// =============================================================================
// AccountabilityDashboard.jsx - the accountability matrix, bill-first.
// Left rail: every tracked bill. Click one and the main panel shows how the
// whole nation is voting on it: national tally bar, then every district's
// split, with the visitor's own district highlighted at the top.
// One fetch, no filters. The bill is the story.
// =============================================================================
import React, { useState, useEffect, useRef } from "react";
import BillSidebar from "./BillSidebar.jsx";
import "./BillSidebar.css";

const C = { crimson:"#8B0000", navy:"#0A1A3F", gold:"#C9A227", parchment:"#FBF7EC",
  ink:"#1A1A1A", muted:"#5C5347", line:"#D8C9A0", green:"#1B5E20", red:"#B71C1C",
  greenLight:"#E8F5E9", redLight:"#FFEBEE" };
const serif = "Georgia, 'Times New Roman', serif";
const mono = "'Courier New', monospace";
const POLL_MS = 20000;

export default function AccountabilityDashboard({ district }) {
  const [totals, setTotals] = useState(null);
  const [phase, setPhase] = useState("loading");
  const [selected, setSelected] = useState(null); // bill_id, set by BillSidebar
  const [billRows, setBillRows] = useState([]);   // district breakdown for the selected bill
  const [billRowsPhase, setBillRowsPhase] = useState("idle"); // idle|loading|ready|error
  const [synopses, setSynopses] = useState({});   // bill_id -> {headline, plain}
  const [expandedStates, setExpandedStates] = useState(() => new Set()); // which state rows are open
  const inFlight = useRef(false);

  const userState = district ? String(district).split("-")[0] : null;
  const activeBill = selected;

  function toggleState(st) {
    setExpandedStates(prev => {
      const next = new Set(prev);
      if (next.has(st)) next.delete(st); else next.add(st);
      return next;
    });
  }

  useEffect(() => { load(); }, []);

  // Live refresh: re-pull the site-wide totals every 20s while the page is
  // open, in addition to the one-time load on mount and the manual Refresh
  // button. Guarded against overlapping calls (see load()).
  useEffect(() => {
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, []);

  async function load() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPhase(p => (p === "ready" ? p : "loading"));
    try {
      const r = await fetch("/api/matrix");
      const data = await r.json();
      setTotals(data.totals || null);
      setPhase(Number(data.totals?.total_votes) > 0 ? "ready" : "empty");
    } catch {
      setPhase("error");
    } finally {
      inFlight.current = false;
    }
  }

  // District breakdown for whichever bill is currently selected in the
  // sidebar. Fetched per bill (not derived from a capped national list), so
  // any voted-on bill the sidebar surfaces works here too.
  useEffect(() => {
    if (!activeBill) { setBillRows([]); return; }
    let cancelled = false;
    setBillRowsPhase("loading");
    fetch(`/api/matrix?billId=${encodeURIComponent(activeBill)}`)
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        setBillRows(d.rows || []);
        setBillRowsPhase("ready");
      })
      .catch(() => { if (!cancelled) setBillRowsPhase("error"); });
    return () => { cancelled = true; };
  }, [activeBill]);

  useEffect(() => {
    if (!activeBill || synopses[activeBill]) return;
    let cancelled = false;
    fetch(`/api/bill-summary?billId=${encodeURIComponent(activeBill)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!cancelled && d) {
          setSynopses(s => ({ ...s, [activeBill]: { headline: d.headline, plain: d.plain } }));
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [activeBill]);

  const synopsis = activeBill ? synopses[activeBill] : null;

  // National aggregate for the selected bill
  const nat = billRows.reduce((t, r) => ({
    support: t.support + Number(r.support_votes),
    oppose: t.oppose + Number(r.oppose_votes),
    undecided: t.undecided + Number(r.undecided_votes),
    total: t.total + Number(r.total_votes),
    contacted: t.contacted + Number(r.contacted_rep),
  }), { support: 0, oppose: 0, undecided: 0, total: 0, contacted: 0 });

  // Site-wide hero numbers, from the unlimited totals aggregate, not the
  // capped bill-by-bill rows list (see api/matrix.js), since summing rows
  // undercounts once there are more than 100 active bill/district pairs.
  const totalVotes    = Number(totals?.total_votes) || 0;
  const totalSupport  = Number(totals?.support_votes) || 0;
  const totalOppose   = Number(totals?.oppose_votes) || 0;
  const totalContacts = Number(totals?.contacted_rep) || 0;

  // Group the selected bill's district rows by state. Each state gets combined
  // totals; the individual district rows live inside it and show when expanded.
  const stateMap = {};
  for (const row of billRows) {
    const st = String(row.district || "").split("-")[0] || "??";
    if (!stateMap[st]) stateMap[st] = { state: st, rows: [], support: 0, oppose: 0, undecided: 0, total: 0 };
    const g = stateMap[st];
    g.rows.push(row);
    g.support   += Number(row.support_votes);
    g.oppose    += Number(row.oppose_votes);
    g.undecided += Number(row.undecided_votes);
    g.total     += Number(row.total_votes);
  }
  // States: the user's own state first, then by combined volume.
  const stateGroups = Object.values(stateMap).sort((a, b) => {
    if (userState) {
      if (a.state === userState && b.state !== userState) return -1;
      if (b.state === userState && a.state !== userState) return 1;
    }
    return b.total - a.total;
  });
  // Districts within a state: the user's own district first, then by volume.
  for (const g of stateGroups) {
    g.rows.sort((a, b) => {
      if (district) {
        if (a.district === district && b.district !== district) return -1;
        if (b.district === district && a.district !== district) return 1;
      }
      return Number(b.total_votes) - Number(a.total_votes);
    });
  }

  // When the selected bill changes, collapse everything except the user's own
  // state, which is what they most likely want to see first.
  useEffect(() => {
    setExpandedStates(new Set(userState ? [userState] : []));
  }, [activeBill, userState]);

  return (
    <div style={{ fontFamily:serif, color:C.ink }}>

      {/* HERO NUMBERS */}
      <div style={{ background:C.navy, color:"#fff", padding:"28px 24px", marginBottom:20,
                    borderRadius:8, border:"3px solid "+C.gold }}>
        <div style={{ fontSize:11, fontWeight:700, letterSpacing:3, color:C.gold,
                      textTransform:"uppercase", marginBottom:14 }}>
          Constituent Accountability - Live Data
        </div>
        <div style={{ display:"flex", gap:16, flexWrap:"wrap", justifyContent:"space-between" }}>
          <StatBox num={totalVotes.toLocaleString()} label="Total Positions Cast" color="#fff" />
          <StatBox num={totalSupport.toLocaleString()} label="Support" color="#4CAF50" />
          <StatBox num={totalOppose.toLocaleString()} label="Oppose" color="#ef5350" />
          <StatBox num={totalContacts.toLocaleString()} label="Contacted Their Rep" color={C.gold} />
          <StatBox num={(Number(totals?.bills_tracked) || 0).toLocaleString()} label="Bills Tracked" color="#90CAF9" />
        </div>
      </div>

      {phase === "loading" && <Center>Loading accountability data...</Center>}
      {phase === "empty" && <Center>No positions cast yet. Be the first.</Center>}
      {phase === "error" && (
        <Center color={C.crimson}>
          Could not load data. <button onClick={load} style={{ fontFamily:serif, fontWeight:700,
            border:"none", background:C.crimson, color:"#fff", borderRadius:4,
            padding:"6px 14px", cursor:"pointer", marginLeft:8 }}>Try Again</button>
        </Center>
      )}

      {phase === "ready" && (
        <div style={{ display:"flex", gap:16, flexWrap:"wrap", alignItems:"flex-start" }}>

          {/* LEFT RAIL: bills */}
          <div style={{ flex:"0 0 200px", minWidth:180 }}>
            <BillSidebar
              userVotes={{}}
              selectedBillId={activeBill}
              onSelectBill={setSelected}
            />
          </div>

          {/* MAIN PANEL: how the nation is voting on this bill */}
          <div style={{ flex:"1 1 340px", minWidth:300 }}>
            <div style={{ background:"#fff", border:"1px solid "+C.line, borderRadius:8,
                          overflow:"hidden", boxShadow:"0 2px 12px rgba(0,0,0,0.08)" }}>

              <div style={{ background:C.navy, color:"#fff", padding:"14px 18px" }}>
                <div style={{ fontFamily:mono, fontSize:12, color:C.gold, letterSpacing:1 }}>
                  {activeBill?.replace(/-119$/,"").toUpperCase()}
                </div>
                <div style={{ fontSize:15, fontWeight:700, marginTop:2 }}>
                  {synopsis?.headline || "How America Is Voting"}
                </div>
                {synopsis?.plain ? (
                  <div style={{ fontSize:12.5, color:"#cfd6e4", lineHeight:1.55, marginTop:6 }}>
                    {synopsis.plain}
                  </div>
                ) : (
                  <div style={{ fontSize:11, color:"#8fa0c0", marginTop:6 }}>
                    Loading bill synopsis...
                  </div>
                )}
              </div>

              <div style={{ padding:"16px 18px" }}>
                {/* National tally bar */}
                <NationalBar nat={nat} />

                <div style={{ fontSize:11, color:C.muted, margin:"8px 0 16px" }}>
                  {nat.total} position{nat.total !== 1 ? "s" : ""} across {billRows.length} district{billRows.length !== 1 ? "s" : ""}
                  {nat.contacted > 0 ? ` · ${nat.contacted} contacted their rep` : ""}
                  {billRowsPhase === "loading" ? " · updating..." : ""}
                </div>

                {/* District breakdown, grouped by state. Each state is a
                    collapsible row of combined totals; click to reveal its
                    districts. The user's own state defaults to expanded. */}
                <div style={{ fontSize:10, fontWeight:700, color:C.muted, letterSpacing:1, marginBottom:8 }}>
                  BY STATE AND DISTRICT
                </div>
                {stateGroups.map((g) => {
                  const open = expandedStates.has(g.state);
                  const gTotal = g.total || 1;
                  const mineState = userState && g.state === userState;
                  return (
                    <div key={g.state} style={{ marginBottom:6 }}>
                      {/* State header row (click to expand/collapse) */}
                      <button onClick={() => toggleState(g.state)}
                        style={{ width:"100%", textAlign:"left", cursor:"pointer",
                                 display:"flex", alignItems:"center", gap:12, padding:"10px 12px",
                                 borderRadius:6, fontFamily:serif,
                                 background: mineState ? "#FFF8E1" : "#fff",
                                 border:"1px solid "+(mineState ? C.gold : C.line) }}>
                        <div style={{ minWidth:74, fontWeight:900, fontSize:14, color:C.navy }}>
                          <span style={{ fontSize:11, color:C.muted, marginRight:4 }}>{open ? "▾" : "▸"}</span>
                          {g.state}
                          <span style={{ fontSize:10, color:C.muted, fontWeight:700 }}> · {g.rows.length}</span>
                          {mineState && <div style={{ fontSize:8.5, color:C.gold, fontWeight:700, letterSpacing:1 }}>YOUR STATE</div>}
                        </div>
                        <div style={{ flex:1, display:"flex", height:18, borderRadius:3, overflow:"hidden" }}>
                          <div style={{ flex: g.support || 0.0001, background:C.green }} />
                          <div style={{ flex: g.oppose || 0.0001, background:C.red }} />
                          <div style={{ flex: (gTotal - g.support - g.oppose) || 0.0001, background:"#ccc" }} />
                        </div>
                        <div style={{ minWidth:110, textAlign:"right", fontSize:12.5, whiteSpace:"nowrap" }}>
                          <span style={{ color:C.green, fontWeight:700 }}>{g.support}</span>
                          <span style={{ color:C.muted }}> / </span>
                          <span style={{ color:C.red, fontWeight:700 }}>{g.oppose}</span>
                          <span style={{ color:C.muted, fontSize:11 }}> of {g.total}</span>
                        </div>
                      </button>

                      {/* District rows for this state, shown when expanded */}
                      {open && g.rows.map((row, i) => {
                        const total = Number(row.total_votes) || 1;
                        const sup = Number(row.support_votes);
                        const opp = Number(row.oppose_votes);
                        const mine = district && row.district === district;
                        return (
                          <div key={i}
                            style={{ display:"flex", alignItems:"center", gap:12, padding:"9px 12px",
                                     margin:"6px 0 0 18px", borderRadius:6,
                                     background: mine ? "#FFF8E1" : C.parchment,
                                     border:"1px solid "+(mine ? C.gold : C.line) }}>
                            <div style={{ minWidth:64, fontWeight:900, fontSize:13.5, color:C.navy }}>
                              {row.district || "??"}
                              {mine && <div style={{ fontSize:8.5, color:C.gold, fontWeight:700, letterSpacing:1 }}>YOURS</div>}
                            </div>
                            <div style={{ flex:1, display:"flex", height:16, borderRadius:3, overflow:"hidden" }}>
                              <div style={{ flex: sup || 0.0001, background:C.green }} />
                              <div style={{ flex: opp || 0.0001, background:C.red }} />
                              <div style={{ flex: (total - sup - opp) || 0.0001, background:"#ccc" }} />
                            </div>
                            <div style={{ minWidth:110, textAlign:"right", fontSize:12.5, whiteSpace:"nowrap" }}>
                              <span style={{ color:C.green, fontWeight:700 }}>{sup}</span>
                              <span style={{ color:C.muted }}> / </span>
                              <span style={{ color:C.red, fontWeight:700 }}>{opp}</span>
                              <span style={{ color:C.muted, fontSize:11 }}> of {row.total_votes}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:12 }}>
              <button onClick={load}
                style={{ fontFamily:serif, fontWeight:700, fontSize:13, padding:"8px 16px",
                         background:C.crimson, color:"#fff", border:"none", borderRadius:6,
                         cursor:"pointer" }}>
                Refresh
              </button>
              <div style={{ fontSize:11.5, color:C.muted }}>
                Updated live - every vote recorded instantly
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop:16, fontSize:11.5, color:C.muted, textAlign:"center" }}>
        All positions are anonymous. Bot and rate-limit filters applied.
        "Contacted rep" = constituent opened the Contact Your Rep panel after voting.
      </div>
    </div>
  );
}

function NationalBar({ nat }) {
  const total = nat.total || 1;
  const supPct = Math.round(nat.support / total * 100);
  const oppPct = Math.round(nat.oppose / total * 100);
  return (
    <div style={{ display:"flex", gap:6, height:34, borderRadius:5, overflow:"hidden" }}>
      <div style={{ flex: nat.support || 0.0001, background:C.green, display:"flex",
                    alignItems:"center", justifyContent:"center" }}>
        <span style={{ color:"#fff", fontSize:13, fontWeight:900 }}>
          {nat.support} SUPPORT ({supPct}%)
        </span>
      </div>
      <div style={{ flex: nat.oppose || 0.0001, background:C.red, display:"flex",
                    alignItems:"center", justifyContent:"center" }}>
        <span style={{ color:"#fff", fontSize:13, fontWeight:900 }}>
          {nat.oppose} OPPOSE ({oppPct}%)
        </span>
      </div>
    </div>
  );
}

function StatBox({ num, label, color }) {
  return (
    <div style={{ textAlign:"center", minWidth:120 }}>
      <div style={{ fontSize:36, fontWeight:900, color, fontFamily:serif, lineHeight:1 }}>
        {num}
      </div>
      <div style={{ fontSize:11, fontWeight:700, letterSpacing:1, color:"rgba(255,255,255,0.7)",
                    textTransform:"uppercase", marginTop:4 }}>
        {label}
      </div>
    </div>
  );
}

function Center({ children, color }) {
  return (
    <div style={{ textAlign:"center", padding:48, color: color || "#5C5347", fontSize:15 }}>
      {children}
    </div>
  );
}
