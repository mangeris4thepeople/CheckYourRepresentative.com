// =============================================================================
// AccountabilityDashboard.jsx - the accountability matrix, bill-first.
// Bill picker: every tracked bill. Pick one and the main panel shows how the
// whole nation is voting on it: national tally bar, then every district's
// split, with the visitor's own district highlighted at the top.
// One fetch, no filters. The bill is the story.
//
// October 2026 redesign: PageHero with live chips, StatGrid of site-wide
// totals, and bill picker plus breakdown in Panels. Data flow is unchanged.
// =============================================================================
import React, { useState, useEffect, useRef } from "react";
import BillSidebar from "./BillSidebar.jsx";
import "./BillSidebar.css";
import { PageHero, StatGrid, Panel, TallyBar, Loading, Empty, ErrorBox } from "./ui/Kit.jsx";

const C = { navy:"#0E2A6B", blue:"#2563EB", ink:"#0F172A", muted:"#5B6578", line:"#E2E8F0",
  green:"#15803D", red:"#DC2626", gold:"#B7791F" };
const POLL_MS = 20000;

function pct(n, d) { return d ? Math.round((n / d) * 100) : 0; }

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
      .then(r => { if (!r.ok) throw new Error(`matrix ${r.status}`); return r.json(); })
      .then(d => {
        if (cancelled) return;
        // A server error body has no rows array: show the error state, not
        // a silent "no votes in any district".
        if (!Array.isArray(d.rows)) throw new Error(d.error || "bad response");
        setBillRows(d.rows);
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

  const billLabel = activeBill ? activeBill.replace(/-119$/, "").toUpperCase().replace("-", " ") : null;

  return (
    <div style={{ fontFamily: "var(--cyr-sans)", color: C.ink }}>

      <PageHero
        eyebrow="Constituent accountability"
        title="How America is voting"
        lede="Every position constituents have cast on a bill, counted live and broken down by state and district. Pick a bill to see where the country stands."
        chips={totals ? [
          { value: totalVotes, label: "positions cast" },
          { value: Number(totals?.bills_tracked) || 0, label: "bills tracked" },
          district ? { value: district, label: "your district" } : null,
        ] : null}
      >
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 14, fontSize: 13, fontWeight: 600,
                      color: "rgba(255,255,255,.88)" }}>
          <span className="cyr-live-dot" />
          Live data, refreshed every 20 seconds
        </div>
      </PageHero>

      {totals && (
        <StatGrid min={150} items={[
          { value: totalSupport, label: "Support", tone: "green", hint: `${pct(totalSupport, totalVotes)}% of positions` },
          { value: totalOppose, label: "Oppose", tone: "red", hint: `${pct(totalOppose, totalVotes)}% of positions` },
          { value: totalContacts, label: "Contacted their rep", tone: "gold", hint: "after casting a position" },
          { value: Number(totals?.bills_tracked) || 0, label: "Bills tracked", tone: "blue", hint: "with at least one position" },
        ]} />
      )}

      {phase === "loading" && (
        <div className="acc-layout">
          <Loading rows={5} height={52} />
          <Loading rows={4} height={72} />
        </div>
      )}
      {phase === "empty" && (
        <Panel pad={8}>
          <Empty icon="🗳️" title="No positions cast yet">Be the first.</Empty>
        </Panel>
      )}
      {phase === "error" && <ErrorBox onRetry={load}>Could not load data.</ErrorBox>}

      {phase === "ready" && (
        <div className="acc-layout">

          {/* Bill picker */}
          <div style={{ minWidth: 0 }}>
            <BillSidebar
              userVotes={{}}
              selectedBillId={activeBill}
              onSelectBill={setSelected}
            />
          </div>

          {/* Main panel: how the nation is voting on this bill */}
          <div style={{ minWidth: 0 }}>
            <Panel
              eyebrow={billLabel || "National tally"}
              title={synopsis?.headline || "How America is voting"}
              action={billRowsPhase === "loading" ? <span className="cyr-chip" style={{ flexShrink: 0 }}>Updating</span> : null}
            >
              {activeBill && (
                synopsis?.plain ? (
                  <p style={{ fontSize: 14.5, color: "#334155", lineHeight: 1.65, margin: "0 0 18px" }}>{synopsis.plain}</p>
                ) : (
                  <div style={{ marginBottom: 18 }}>
                    <div className="cyr-skeleton" style={{ height: 12, width: "92%", marginBottom: 8 }} />
                    <div className="cyr-skeleton" style={{ height: 12, width: "70%" }} />
                    <div style={{ fontSize: 12.5, color: C.muted, marginTop: 8 }}>Loading bill synopsis...</div>
                  </div>
                )
              )}

              {!activeBill && (
                <Empty icon="📊" title="Pick a bill">Choose any bill from the list to see the national tally and the district by district split.</Empty>
              )}

              {activeBill && billRowsPhase === "error" && (
                <div style={{ marginBottom: 16 }}><ErrorBox>Could not load the breakdown for this bill.</ErrorBox></div>
              )}

              {activeBill && (
                <>
                  {/* National tally */}
                  <NationalTally nat={nat} />

                  <div style={{ fontSize: 13, color: C.muted, margin: "10px 0 22px", lineHeight: 1.5 }}>
                    <span className="cyr-num" style={{ color: C.ink, fontSize: 14 }}>{nat.total}</span> position{nat.total !== 1 ? "s" : ""} across{" "}
                    <span className="cyr-num" style={{ color: C.ink, fontSize: 14 }}>{billRows.length}</span> district{billRows.length !== 1 ? "s" : ""}
                    {nat.contacted > 0 ? ` · ${nat.contacted} contacted their rep` : ""}
                    {billRowsPhase === "loading" ? " · updating..." : ""}
                  </div>

                  {/* District breakdown, grouped by state. Each state is a
                      collapsible row of combined totals; click to reveal its
                      districts. The user's own state defaults to expanded. */}
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
                    <div className="cyr-h2" style={{ fontSize: 17 }}>By state and district</div>
                    {stateGroups.length > 0 && (
                      <span style={{ fontSize: 12.5, color: C.muted, whiteSpace: "nowrap" }}>Select a state to expand</span>
                    )}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 8 }}>
                    {stateGroups.map((g) => {
                      const open = expandedStates.has(g.state);
                      const mineState = userState && g.state === userState;
                      return (
                        <div key={g.state} style={{ minWidth: 0 }}>
                          {/* State header row (click to expand/collapse) */}
                          <button type="button" onClick={() => toggleState(g.state)} aria-expanded={open}
                            className={mineState ? "cyr-row cyr-row-mine" : "cyr-row"}
                            style={{ width: "100%", textAlign: "left", cursor: "pointer", fontFamily: "inherit",
                                     flexDirection: "column", alignItems: "stretch", gap: 8, minHeight: 44 }}>
                            <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                              <span aria-hidden style={{ width: 22, height: 22, borderRadius: 8, flexShrink: 0, display: "grid", placeItems: "center",
                                                         background: open ? C.navy : "#EEF2F8", color: open ? "#fff" : C.muted, fontSize: 11,
                                                         transition: "transform .2s ease", transform: open ? "rotate(90deg)" : "none" }}>▸</span>
                              <span style={{ fontWeight: 800, fontSize: 15, color: C.navy }}>{g.state}</span>
                              <span className="cyr-chip" style={{ fontSize: 11, padding: "2px 8px", background: mineState ? "#FDE7B0" : undefined }}>
                                {g.rows.length} district{g.rows.length !== 1 ? "s" : ""}
                              </span>
                              {mineState && <span className="cyr-chip" style={{ fontSize: 11, padding: "2px 8px", background: "#0E2A6B", color: "#fff" }}>Your state</span>}
                              <SplitNums support={g.support} oppose={g.oppose} total={g.total} />
                            </span>
                            <TallyBar support={g.support} oppose={g.oppose} other={g.total - g.support - g.oppose} height={10} />
                          </button>

                          {/* District rows for this state, shown when expanded */}
                          {open && (
                            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 6, margin: "6px 0 4px 14px",
                                          paddingLeft: 12, borderLeft: "2px solid #E2E8F0" }}>
                              {g.rows.map((row, i) => {
                                const sup = Number(row.support_votes);
                                const opp = Number(row.oppose_votes);
                                const total = Number(row.total_votes) || 0;
                                const mine = district && row.district === district;
                                return (
                                  <div key={i} className={mine ? "cyr-row cyr-row-mine" : "cyr-row"}
                                    style={{ flexDirection: "column", alignItems: "stretch", gap: 7, padding: "10px 12px" }}>
                                    <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                                      <span style={{ fontWeight: 800, fontSize: 14, color: C.navy, fontFamily: "var(--cyr-mono)" }}>{row.district || "??"}</span>
                                      {mine && <span className="cyr-chip" style={{ fontSize: 11, padding: "2px 8px", background: "#0E2A6B", color: "#fff" }}>Yours</span>}
                                      <SplitNums support={sup} oppose={opp} total={row.total_votes} />
                                    </span>
                                    <TallyBar support={sup} oppose={opp} other={total - sup - opp} height={8} />
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {billRowsPhase === "ready" && stateGroups.length === 0 && (
                      <Empty icon="🗺️" title="No district positions yet">Nobody has cast a position on this bill yet.</Empty>
                    )}
                  </div>
                </>
              )}
            </Panel>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: -4 }}>
              <button type="button" onClick={load} className="cyr-btn cyr-btn-ghost" style={{ minHeight: 40 }}>
                <span aria-hidden>↻</span> Refresh
              </button>
              <div style={{ fontSize: 12.5, color: C.muted, display: "inline-flex", alignItems: "center", gap: 8 }}>
                <span className="cyr-live-dot" /> Updated live, every vote recorded instantly
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 22, fontSize: 12.5, color: C.muted, textAlign: "center", lineHeight: 1.6, maxWidth: 720, marginLeft: "auto", marginRight: "auto" }}>
        All positions are anonymous. Bot and rate-limit filters applied.
        "Contacted rep" = constituent opened the Contact Your Rep panel after voting.
      </div>
    </div>
  );
}

function SplitNums({ support, oppose, total }) {
  return (
    <span style={{ marginLeft: "auto", fontSize: 13, whiteSpace: "nowrap", flexShrink: 0 }}>
      <span style={{ color: C.green, fontWeight: 800 }}>{support}</span>
      <span style={{ color: "#94A3B8" }}> / </span>
      <span style={{ color: C.red, fontWeight: 800 }}>{oppose}</span>
      <span style={{ color: C.muted, fontSize: 12 }}> of {total}</span>
    </span>
  );
}

function NationalTally({ nat }) {
  const total = nat.total || 0;
  const cells = [
    { label: "Support", value: nat.support, color: C.green, bg: "#ECFDF3" },
    { label: "Oppose", value: nat.oppose, color: C.red, bg: "#FEF2F2" },
    { label: "Undecided", value: nat.undecided, color: C.muted, bg: "#F1F5F9" },
  ];
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginBottom: 12 }}>
        {cells.map(c => (
          <div key={c.label} style={{ background: c.bg, borderRadius: 14, padding: "12px 12px 10px", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
              <span className="cyr-num" style={{ fontSize: "clamp(22px, 3vw, 28px)", color: c.color, lineHeight: 1 }}>{c.value}</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: c.color }}>{pct(c.value, total)}%</span>
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: C.ink, marginTop: 4 }}>{c.label}</div>
          </div>
        ))}
      </div>
      <TallyBar support={nat.support} oppose={nat.oppose} other={nat.undecided} height={14} />
    </div>
  );
}
