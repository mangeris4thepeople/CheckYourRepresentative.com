// InteractiveDistrictMap.jsx
// Click state → see districts → click district → see live vote tallies + rep
import React, { useState, useEffect } from "react";

const C = {
  navy:"#0A1A3F", gold:"#C9A227", crimson:"#8B0000",
  yes:"#1B5E20", no:"#B71C1C", parchment:"#FBF7EC",
  muted:"#5C5347", line:"#D8C9A0", panel:"#fff"
};
const serif = "Georgia, \'Times New Roman\', serif";

// State → number of districts
const STATE_DISTRICTS = {
  AL:7,AK:1,AZ:9,AR:4,CA:52,CO:8,CT:5,DE:1,FL:28,GA:14,
  HI:2,ID:2,IL:17,IN:9,IA:4,KS:4,KY:6,LA:6,ME:2,MD:8,
  MA:9,MI:13,MN:8,MS:4,MO:8,MT:2,NE:3,NV:4,NH:2,NJ:12,
  NM:3,NY:26,NC:14,ND:1,OH:15,OK:5,OR:6,PA:17,RI:2,SC:7,
  SD:1,TN:9,TX:38,UT:4,VT:1,VA:11,WA:10,WV:2,WI:8,WY:1,
  DC:1,PR:1,GU:1,VI:1,AS:1,MP:1
};

const STATE_NAMES = {
  AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",
  CO:"Colorado",CT:"Connecticut",DE:"Delaware",FL:"Florida",GA:"Georgia",
  HI:"Hawaii",ID:"Idaho",IL:"Illinois",IN:"Indiana",IA:"Iowa",
  KS:"Kansas",KY:"Kentucky",LA:"Louisiana",ME:"Maine",MD:"Maryland",
  MA:"Massachusetts",MI:"Michigan",MN:"Minnesota",MS:"Mississippi",MO:"Missouri",
  MT:"Montana",NE:"Nebraska",NV:"Nevada",NH:"New Hampshire",NJ:"New Jersey",
  NM:"New Mexico",NY:"New York",NC:"North Carolina",ND:"North Dakota",OH:"Ohio",
  OK:"Oklahoma",OR:"Oregon",PA:"Pennsylvania",RI:"Rhode Island",SC:"South Carolina",
  SD:"South Dakota",TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",
  VA:"Virginia",WA:"Washington",WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming",
  DC:"District of Columbia"
};

export default function InteractiveDistrictMap({ onDistrictSelect }) {
  const [state, setState] = useState(null);
  const [district, setDistrict] = useState(null);
  const [districtData, setDistrictData] = useState(null);
  const [loading, setLoading] = useState(false);

  const states = Object.keys(STATE_DISTRICTS).filter(s => STATE_NAMES[s]).sort();

  async function selectDistrict(st, dist) {
    const code = dist === "AL" ? `${st}-AL` : `${st}-${String(dist).padStart(2,"0")}`;
    setDistrict(code);
    setLoading(true);
    setDistrictData(null);

    try {
      // Load rep info + vote tally for this district
      const [matrixRes, repRes] = await Promise.allSettled([
        fetch(`/api/matrix?district=${code}`).then(r => r.json()),
        fetch(`/api/digest?district=${code}`).then(r => r.json()),
      ]);

      const matrix = matrixRes.status === "fulfilled" ? matrixRes.value : null;
      const digest = repRes.status === "fulfilled" ? repRes.value : null;

      setDistrictData({
        code,
        rep: digest?.rep || null,
        rows: matrix?.rows || [],
        totalVotes: (matrix?.rows || []).reduce((s,r) => s + Number(r.total_votes||0), 0),
      });
    } catch {}
    setLoading(false);
    onDistrictSelect?.(code);
  }

  return (
    <div style={{ fontFamily: serif }}>
      {/* State grid */}
      {!state && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 1,
                        textAlign:"center", marginBottom: 16 }}>
            SELECT A STATE TO EXPLORE ITS CONGRESSIONAL DISTRICTS
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(100px,1fr))", gap: 6 }}>
            {states.map(st => (
              <button key={st} onClick={() => { setState(st); setDistrict(null); setDistrictData(null); }}
                style={{ fontFamily: serif, padding:"10px 6px", background: C.panel,
                         border:`1px solid ${C.line}`, borderRadius: 6, cursor:"pointer",
                         fontSize: 13, fontWeight: 700, color: C.navy,
                         transition:"all 0.15s" }}
                onMouseEnter={e => { e.target.style.background=C.navy; e.target.style.color="#fff"; }}
                onMouseLeave={e => { e.target.style.background=C.panel; e.target.style.color=C.navy; }}>
                <div style={{ fontSize: 18, marginBottom: 2 }}>{st}</div>
                <div style={{ fontSize: 10, color:"inherit", opacity:0.7 }}>
                  {STATE_DISTRICTS[st]} dist.
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* District grid for selected state */}
      {state && !district && (
        <div>
          <button onClick={() => setState(null)}
            style={{ fontFamily: serif, fontSize: 13, fontWeight: 700, color: C.navy,
                     background:"none", border:"none", cursor:"pointer", marginBottom: 12,
                     padding:0 }}>
            ← All States
          </button>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.navy, marginBottom: 4 }}>
            {STATE_NAMES[state]}
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>
            {STATE_DISTRICTS[state]} congressional district{STATE_DISTRICTS[state] > 1 ? "s" : ""} · Click to see live votes
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(90px,1fr))", gap:6 }}>
            {STATE_DISTRICTS[state] === 1 ? (
              <button onClick={() => selectDistrict(state,"AL")}
                style={{ fontFamily: serif, padding:"16px 8px", background: C.navy,
                         border:"none", borderRadius:8, cursor:"pointer",
                         fontSize:14, fontWeight:900, color:"#fff" }}>
                {state}-AL<br/>
                <span style={{ fontSize:11, fontWeight:400, opacity:0.8 }}>At Large</span>
              </button>
            ) : (
              Array.from({length: STATE_DISTRICTS[state]}, (_,i) => i+1).map(n => (
                <button key={n} onClick={() => selectDistrict(state, n)}
                  style={{ fontFamily: serif, padding:"14px 6px", background: C.panel,
                           border:`1px solid ${C.line}`, borderRadius:6, cursor:"pointer",
                           fontSize:15, fontWeight:700, color:C.navy, textAlign:"center" }}
                  onMouseEnter={e => { e.currentTarget.style.background=C.navy; e.currentTarget.style.color="#fff"; }}
                  onMouseLeave={e => { e.currentTarget.style.background=C.panel; e.currentTarget.style.color=C.navy; }}>
                  <div>Dist. {n}</div>
                  <div style={{ fontSize:10, opacity:0.6 }}>{state}-{String(n).padStart(2,"0")}</div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* District detail */}
      {district && (
        <div>
          <button onClick={() => { setDistrict(null); setDistrictData(null); }}
            style={{ fontFamily: serif, fontSize:13, fontWeight:700, color:C.navy,
                     background:"none", border:"none", cursor:"pointer", marginBottom:12, padding:0 }}>
            ← {STATE_NAMES[state]} Districts
          </button>

          {loading && (
            <div style={{ padding:"32px", textAlign:"center", color:C.muted }}>
              Loading district data...
            </div>
          )}

          {districtData && (
            <div>
              {/* Rep header */}
              <div style={{ background:C.navy, color:"#fff", padding:"16px 20px",
                            borderRadius:"8px 8px 0 0", borderBottom:`3px solid ${C.gold}` }}>
                <div style={{ fontSize:10, color:C.gold, fontWeight:700, letterSpacing:1 }}>
                  CONGRESSIONAL DISTRICT
                </div>
                <div style={{ fontSize:24, fontWeight:900, marginBottom:4 }}>{district}</div>
                {districtData.rep ? (
                  <div>
                    <div style={{ fontSize:16, fontWeight:700 }}>{districtData.rep.name}</div>
                    <div style={{ fontSize:12, color:"#cfd6e4" }}>
                      {districtData.rep.party} · {districtData.rep.state}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize:13, color:"#cfd6e4" }}>Representative data loading...</div>
                )}
              </div>

              {/* Vote stats */}
              <div style={{ background:C.crimson, padding:"16px 20px",
                            display:"flex", gap:24, flexWrap:"wrap" }}>
                <Stat label="Total Votes Cast" value={districtData.totalVotes} />
                <Stat label="Bills With Votes" value={districtData.rows.length} />
                <Stat label="Support" value={districtData.rows.reduce((s,r)=>s+Number(r.support_votes||0),0)} color="#4CAF50" />
                <Stat label="Oppose" value={districtData.rows.reduce((s,r)=>s+Number(r.oppose_votes||0),0)} color="#ef5350" />
              </div>

              {/* Bill breakdown */}
              {districtData.rows.length > 0 ? (
                <div style={{ background:C.parchment, border:`1px solid ${C.line}`,
                              borderTop:"none", borderRadius:"0 0 8px 8px" }}>
                  <div style={{ padding:"14px 20px", borderBottom:`1px solid ${C.line}`,
                                fontSize:11, fontWeight:700, color:C.navy, letterSpacing:1 }}>
                    CONSTITUENT VOTES BY BILL
                  </div>
                  {districtData.rows.map((row,i) => {
                    const total = Number(row.total_votes)||1;
                    const yPct = Math.round((Number(row.support_votes||0)/total)*100);
                    const nPct = Math.round((Number(row.oppose_votes||0)/total)*100);
                    const bill = (row.bill_id||"").replace(/-119$/,"").toUpperCase();
                    return (
                      <div key={i} style={{ padding:"12px 20px",
                                           borderBottom: i < districtData.rows.length-1 ? `1px solid ${C.line}` : "none" }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                          <div style={{ fontSize:13, fontWeight:700, color:C.navy }}>{bill}</div>
                          <div style={{ fontSize:12, color:C.muted }}>{row.total_votes} votes</div>
                        </div>
                        <div style={{ display:"flex", gap:4, height:20, borderRadius:4, overflow:"hidden" }}>
                          <div style={{ flex:yPct||1, background:C.yes, display:"flex",
                                        alignItems:"center", justifyContent:"center" }}>
                            <span style={{ color:"#fff", fontSize:11, fontWeight:700 }}>{yPct}%</span>
                          </div>
                          <div style={{ flex:nPct||1, background:C.no, display:"flex",
                                        alignItems:"center", justifyContent:"center" }}>
                            <span style={{ color:"#fff", fontSize:11, fontWeight:700 }}>{nPct}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ background:C.parchment, border:`1px solid ${C.line}`, borderTop:"none",
                              borderRadius:"0 0 8px 8px", padding:"24px 20px", textAlign:"center",
                              color:C.muted, fontSize:14 }}>
                  No votes recorded for this district yet. Be the first  - 
                  <button onClick={() => onDistrictSelect?.(district)}
                    style={{ fontFamily:serif, color:C.crimson, background:"none", border:"none",
                             fontWeight:700, cursor:"pointer", fontSize:14 }}>
                    vote now
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color="#fff" }) {
  return (
    <div style={{ textAlign:"center" }}>
      <div style={{ fontSize:32, fontWeight:900, color: color||"#fff", lineHeight:1 }}>
        {value || 0}
      </div>
      <div style={{ fontSize:10, color:"rgba(255,255,255,0.7)", letterSpacing:1,
                    textTransform:"uppercase", marginTop:2 }}>
        {label}
      </div>
    </div>
  );
}
