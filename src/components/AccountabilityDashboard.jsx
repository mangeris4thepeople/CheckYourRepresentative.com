import React, { useState, useEffect } from "react";

const C = { crimson:"#8B0000", navy:"#0A1A3F", gold:"#C9A227", parchment:"#FBF7EC",
  ink:"#1A1A1A", muted:"#5C5347", line:"#D8C9A0", panel:"#FBF7EC", green:"#1B5E20", red:"#B71C1C" };
const serif = "Georgia, 'Times New Roman', serif";
const mono = "'Courier New', monospace";

export default function AccountabilityDashboard({ district }) {
  const [rows, setRows]     = useState([]);
  const [phase, setPhase]   = useState("loading");
  const [filter, setFilter] = useState(district || "");
  const [view, setView]     = useState("district"); // district | national

  useEffect(() => {
    load();
  }, [filter, view]);

  async function load() {
    setPhase("loading");
    try {
      const params = new URLSearchParams();
      if (view === "district" && filter) params.set("district", filter);
      const r = await fetch("/api/matrix?" + params.toString());
      const data = await r.json();
      setRows(data.rows || []);
      setPhase(data.rows?.length ? "ready" : "empty");
    } catch {
      setPhase("error");
    }
  }

  const totalVotes    = rows.reduce((s,r) => s + Number(r.total_votes), 0);
  const totalContacts = rows.reduce((s,r) => s + Number(r.contacted_rep), 0);
  const totalSupport  = rows.reduce((s,r) => s + Number(r.support_votes), 0);
  const totalOppose   = rows.reduce((s,r) => s + Number(r.oppose_votes), 0);

  return (
    <div style={{ fontFamily:serif, color:C.ink }}>

      {/* HERO NUMBERS */}
      <div style={{ background:C.navy, color:"#fff", padding:"32px 24px", marginBottom:24,
                    borderRadius:8, border:"3px solid "+C.gold }}>
        <div style={{ fontSize:11, fontWeight:700, letterSpacing:3, color:C.gold,
                      textTransform:"uppercase", marginBottom:16 }}>
          Constituent Accountability — Live Data
        </div>
        <div style={{ display:"flex", gap:16, flexWrap:"wrap", justifyContent:"space-between" }}>
          <StatBox num={totalVotes.toLocaleString()} label="Total Positions Cast" color="#fff" />
          <StatBox num={totalSupport.toLocaleString()} label="Support" color="#4CAF50" />
          <StatBox num={totalOppose.toLocaleString()} label="Oppose" color="#ef5350" />
          <StatBox num={totalContacts.toLocaleString()} label="Contacted Their Rep" color={C.gold} />
          <StatBox num={rows.length.toLocaleString()} label="Bills Tracked" color="#90CAF9" />
        </div>
      </div>

      {/* CONTROLS */}
      <div style={{ display:"flex", gap:12, marginBottom:20, flexWrap:"wrap", alignItems:"center" }}>
        <div style={{ display:"flex", gap:0, border:"2px solid "+C.navy, borderRadius:6, overflow:"hidden" }}>
          {["district","national"].map(v => (
            <button key={v} onClick={() => setView(v)}
              style={{ fontFamily:serif, fontWeight:700, fontSize:13, padding:"8px 18px",
                       border:"none", cursor:"pointer",
                       background: view===v ? C.navy : "#fff",
                       color: view===v ? "#fff" : C.navy }}>
              {v === "district" ? "My District" : "National"}
            </button>
          ))}
        </div>
        {view === "district" && (
          <input value={filter} onChange={e=>setFilter(e.target.value.toUpperCase())}
            placeholder="CO-04"
            style={{ fontFamily:mono, fontSize:14, fontWeight:700, padding:"8px 12px",
                     border:"2px solid "+C.navy, borderRadius:6, width:100,
                     textTransform:"uppercase" }} />
        )}
        <button onClick={load}
          style={{ fontFamily:serif, fontWeight:700, fontSize:13, padding:"8px 16px",
                   background:C.crimson, color:"#fff", border:"none", borderRadius:6,
                   cursor:"pointer" }}>
          Refresh
        </button>
        <div style={{ fontSize:12, color:C.muted, marginLeft:"auto" }}>
          Updated live — every vote recorded instantly
        </div>
      </div>

      {/* TABLE */}
      {phase === "loading" && (
        <div style={{ textAlign:"center", padding:48, color:C.muted, fontSize:15 }}>
          Loading accountability data...
        </div>
      )}
      {phase === "empty" && (
        <div style={{ textAlign:"center", padding:48, color:C.muted, fontSize:15 }}>
          No data yet for {filter || "this view"}. Be the first to cast a position.
        </div>
      )}
      {phase === "error" && (
        <div style={{ textAlign:"center", padding:48, color:C.crimson, fontSize:15 }}>
          Could not load data. Please try again.
        </div>
      )}
      {phase === "ready" && (
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13.5,
                          fontFamily:serif, background:"#fff", borderRadius:8,
                          overflow:"hidden", boxShadow:"0 2px 12px rgba(0,0,0,0.08)" }}>
            <thead>
              <tr style={{ background:C.navy, color:"#fff" }}>
                <TH>Bill</TH>
                <TH>District</TH>
                <TH align="center" color="#4CAF50">Support</TH>
                <TH align="center" color="#ef5350">Oppose</TH>
                <TH align="center" color="#ccc">Undecided</TH>
                <TH align="center" color="#fff">Total</TH>
                <TH align="center" color={C.gold}>Contacted Rep</TH>
                <TH align="center" color={C.gold}>Contact Rate</TH>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const total = Number(row.total_votes) || 1;
                const supPct = Math.round(Number(row.support_votes)/total*100);
                const oppPct = Math.round(Number(row.oppose_votes)/total*100);
                const contactRate = Number(row.contact_rate_pct) || 0;
                return (
                  <tr key={i} style={{ borderBottom:"1px solid "+C.line,
                                       background: i%2===0 ? "#fff" : C.parchment }}>
                    <td style={{ padding:"12px 16px", fontWeight:700, color:C.navy,
                                 fontFamily:mono, fontSize:12 }}>
                      {row.bill_id?.replace(/-119$/,"").toUpperCase()}
                    </td>
                    <td style={{ padding:"12px 16px", fontWeight:700 }}>
                      {row.district || "—"}
                    </td>
                    <td style={{ padding:"12px 16px", textAlign:"center" }}>
                      <NumBadge n={row.support_votes} pct={supPct} color="#E8F5E9" text="#1B5E20" />
                    </td>
                    <td style={{ padding:"12px 16px", textAlign:"center" }}>
                      <NumBadge n={row.oppose_votes} pct={oppPct} color="#FFEBEE" text="#B71C1C" />
                    </td>
                    <td style={{ padding:"12px 16px", textAlign:"center", color:C.muted }}>
                      {row.undecided_votes}
                    </td>
                    <td style={{ padding:"12px 16px", textAlign:"center", fontWeight:700, fontSize:15 }}>
                      {row.total_votes}
                    </td>
                    <td style={{ padding:"12px 16px", textAlign:"center", fontWeight:700,
                                 color: Number(row.contacted_rep) > 0 ? C.crimson : C.muted }}>
                      {row.contacted_rep}
                    </td>
                    <td style={{ padding:"12px 16px", textAlign:"center" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6, justifyContent:"center" }}>
                        <div style={{ width:60, height:8, background:"#eee", borderRadius:4, overflow:"hidden" }}>
                          <div style={{ width:contactRate+"%", height:"100%",
                                        background: contactRate > 50 ? "#4CAF50" : C.gold,
                                        borderRadius:4 }} />
                        </div>
                        <span style={{ fontWeight:700, fontSize:12 }}>{contactRate}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop:16, fontSize:11.5, color:C.muted, textAlign:"center" }}>
        All positions are anonymous. Bot and rate-limit filters applied.
        "Contacted Rep" = constituent opened the Contact Your Rep panel after voting.
        Data updates in real time.
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

function TH({ children, align, color }) {
  return (
    <th style={{ padding:"12px 16px", textAlign:align||"left", fontWeight:700,
                 fontSize:11, letterSpacing:1, textTransform:"uppercase",
                 color: color || "#fff", borderBottom:"2px solid rgba(255,255,255,0.2)" }}>
      {children}
    </th>
  );
}

function NumBadge({ n, pct, color, text }) {
  return (
    <span style={{ background:color, color:text, fontWeight:700, fontSize:13,
                   padding:"3px 10px", borderRadius:20, display:"inline-block" }}>
      {n} <span style={{ fontWeight:400, fontSize:11 }}>({pct}%)</span>
    </span>
  );
}
