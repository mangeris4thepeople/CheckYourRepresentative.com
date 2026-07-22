// =============================================================================
// NationalJudges.jsx - the national wing of Know Your Judge. A searchable
// 50-state directory of sitting state court judges, mirrored from the Free
// Law Project's CourtListener database by the sync-national-judges crawler.
// Coverage is what CourtListener has: strongest for supreme and appellate
// courts, growing for trial courts. Each judge links to their CourtListener
// profile for the full biography, positions, and financial disclosures.
// =============================================================================
import React, { useState, useEffect, useCallback } from "react";

const C = {
  navy: "#0A1A3F", gold: "#C9A227", crimson: "#8B0000", parchment: "#FBF7EC",
  ink: "#1A1A1A", muted: "#5C5347", line: "#D8C9A0",
};
const serif = "Georgia, 'Times New Roman', serif";
const PAGE_SIZE = 20;

const STATE_NAMES = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
  MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
  DC: "District of Columbia", PR: "Puerto Rico", GU: "Guam", VI: "Virgin Islands",
  AS: "American Samoa", MP: "Northern Mariana Islands",
};

const clProfileUrl = (j) =>
  `https://www.courtlistener.com/person/${j.cl_person_id}/${j.slug || "judge"}/`;

export default function NationalJudges() {
  const [phase, setPhase] = useState("loading"); // loading | ready | notready | error
  const [judges, setJudges] = useState([]);
  const [states, setStates] = useState([]);
  const [totalJudges, setTotalJudges] = useState(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [state, setState] = useState("");
  const [errorDetail, setErrorDetail] = useState(null);

  const loadList = useCallback(async (newOffset, append) => {
    setPhase("loading");
    try {
      const p = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(newOffset) });
      if (search) p.set("q", search);
      if (state) p.set("state", state);
      const r = await fetch(`/api/national-judges-list?${p}`);
      const d = await r.json().catch(() => null);
      if (!r.ok || !d || d.ready === undefined) {
        console.error("National judges fetch failed", { status: r.status, d });
        setErrorDetail(d?.detail || d?.error || `HTTP ${r.status}`);
        setPhase("error");
        return;
      }
      if (!d.ready) { setPhase("notready"); return; }
      setJudges(prev => append ? [...prev, ...(d.judges || [])] : (d.judges || []));
      setOffset(d.offset ?? newOffset);
      setHasMore(!!d.hasMore);
      setPhase("ready");
    } catch (err) {
      console.error("National judges fetch threw", err);
      setErrorDetail(String(err.message || err));
      setPhase("error");
    }
  }, [search, state]);

  useEffect(() => { loadList(0, false); }, [search, state, loadList]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/national-courts")
      .then(r => r.json())
      .then(d => {
        if (cancelled || !d.ready) return;
        setStates(d.states || []);
        setTotalJudges(d.totalJudges ?? null);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  function runSearch() { setSearch(searchInput.trim()); }

  return (
    <div style={{ fontFamily: serif, color: C.ink, maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ background: C.navy, color: "#fff", padding: "22px 24px", borderRadius: 8,
                    border: `3px solid ${C.gold}`, marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, color: C.gold, textTransform: "uppercase", marginBottom: 8 }}>
          National Judge Registry
        </div>
        <div style={{ fontSize: 14, color: "#cfd6e4", lineHeight: 1.6 }}>
          Sitting state court judges across all 50 states, mirrored from the Free Law Project's
          CourtListener database{totalJudges ? ` (${totalJudges.toLocaleString()} judges on file)` : ""}.
          Search by name or court, filter by state, and follow any judge through to their full
          CourtListener profile for biography, career history, and financial disclosures.
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && runSearch()}
          placeholder="Search by judge or court name"
          style={{ flex: "2 1 220px", fontFamily: serif, fontSize: 14, padding: "10px 12px",
                   border: `1px solid ${C.line}`, borderRadius: 5 }} />
        <select value={state} onChange={e => setState(e.target.value)}
          style={{ flex: "1 1 180px", fontFamily: serif, fontSize: 13, padding: "10px 8px",
                   border: `1px solid ${C.line}`, borderRadius: 5, background: "#fff" }}>
          <option value="">All states</option>
          {states.map(s => (
            <option key={s.state_abbr} value={s.state_abbr}>
              {STATE_NAMES[s.state_abbr] || s.state_abbr}{Number(s.judge_count) > 0 ? ` (${s.judge_count})` : ""}
            </option>
          ))}
        </select>
        <button onClick={runSearch}
          style={{ fontFamily: serif, fontWeight: 700, fontSize: 13, padding: "10px 18px",
                   background: C.crimson, color: "#fff", border: "none", borderRadius: 5, cursor: "pointer" }}>
          Search
        </button>
      </div>

      {phase === "loading" && judges.length === 0 && <Center>Loading judges...</Center>}
      {phase === "error" && (
        <Center color={C.crimson}>
          Could not load the national registry. <Link onClick={() => loadList(0, false)}>Try again</Link>
          {errorDetail && (
            <div style={{ fontSize: 11.5, color: C.muted, marginTop: 8, fontFamily: "monospace" }}>{errorDetail}</div>
          )}
        </Center>
      )}
      {phase === "notready" && (
        <Center>The national registry is still loading its first pass. Check back shortly.</Center>
      )}
      {phase === "ready" && judges.length === 0 && <Center>No judges match that search.</Center>}

      {judges.length > 0 && (
        <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 8, overflow: "hidden" }}>
          {judges.map(j => (
            <a key={j.id} href={clProfileUrl(j)} target="_blank" rel="noopener noreferrer"
              style={{ display: "flex", width: "100%", textAlign: "left", alignItems: "center", gap: 12,
                       padding: "12px 16px", textDecoration: "none",
                       borderBottom: "1px solid #f0ead8", fontFamily: serif }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>
                  {j.full_name}
                  {j.state_abbr && (
                    <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: C.gold,
                                   letterSpacing: 1 }}>{j.state_abbr}</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
                  {j.court_name || "Court not on record"}
                  {j.position_title ? ` · ${j.position_title}` : ""}
                  {j.date_start ? ` · since ${String(j.date_start).slice(0, 4)}` : ""}
                </div>
              </div>
              <span style={{ fontSize: 12, color: C.crimson, fontWeight: 700, flexShrink: 0 }}>
                CourtListener →
              </span>
            </a>
          ))}
        </div>
      )}

      {hasMore && phase === "ready" && (
        <button onClick={() => loadList(offset + PAGE_SIZE, true)}
          style={{ display: "block", margin: "16px auto 0", fontFamily: serif, fontSize: 13, fontWeight: 700,
                   color: C.navy, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 6,
                   padding: "10px 22px", cursor: "pointer" }}>
          Load More Judges
        </button>
      )}

      <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.6, marginTop: 18 }}>
        Source: the Free Law Project's CourtListener judge database, refreshed daily. Coverage
        reflects what CourtListener publishes: complete for supreme and appellate courts, growing
        for trial courts. Colorado judges get the fuller treatment in the Colorado view, with
        official performance evaluations and retention election results.
      </p>
    </div>
  );
}

function Center({ children, color }) {
  return <div style={{ textAlign: "center", padding: 40, color: color || C.muted, fontSize: 14.5, fontFamily: serif }}>{children}</div>;
}
function Link({ onClick, children }) {
  return <button onClick={onClick} style={{ background: "none", border: "none", color: C.crimson, fontFamily: serif, fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>{children}</button>;
}
