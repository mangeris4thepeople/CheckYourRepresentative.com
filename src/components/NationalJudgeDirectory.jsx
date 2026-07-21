// =============================================================================
// NationalJudgeDirectory.jsx - the national scope of the Know Your Judge tab.
// Every federal judge (Supreme Court, circuit courts, district courts, the
// standing specialty courts) and every state supreme and appellate judge
// CourtListener tracks, browsable by state. Same state-view pattern as the
// Colorado directory in KnowYourJudge.jsx (this app has no router): a
// searchable, filterable list and a detail view per judge.
//
// Data: /api/judges-national-list, /api/judge-national-courts and
// /api/judge-national-detail, all fed by the sync-judges-national cron.
// Colorado judges get their OJPE evaluations and retention results attached
// on the detail view; other states have no equivalent data source yet.
// =============================================================================
import React, { useState, useEffect, useCallback } from "react";
import RetentionBar from "./RetentionBar.jsx";

const C = {
  navy: "#0A1A3F", gold: "#C9A227", crimson: "#8B0000", parchment: "#FBF7EC",
  ink: "#1A1A1A", muted: "#5C5347", line: "#D8C9A0", green: "#1B5E20", red: "#B71C1C",
};
const serif = "Georgia, 'Times New Roman', serif";
const PAGE_SIZE = 20;

const STATE_NAMES = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi",
  MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire",
  NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina",
  ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee",
  TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
  WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", DC: "District of Columbia",
  PR: "Puerto Rico", GU: "Guam", VI: "U.S. Virgin Islands", AS: "American Samoa",
  MP: "Northern Mariana Islands",
};

const JURISDICTION_LABELS = {
  F: "Federal Appellate", FD: "Federal District", FS: "Federal Specialty",
  S: "State Supreme", SA: "State Appellate",
  TS: "Territory Supreme", TA: "Territory Appellate",
};

function scopeName(code) {
  if (code === "US") return "Federal courts (nationwide)";
  return STATE_NAMES[code] || code;
}

export default function NationalJudgeDirectory() {
  const [phase, setPhase] = useState("loading"); // loading | ready | notready | error
  const [judges, setJudges] = useState([]);
  const [scopes, setScopes] = useState([]);   // [{state, court_count, judge_count}]
  const [courts, setCourts] = useState([]);   // courts within the selected scope
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [scope, setScope] = useState("US");   // 'US' | state code | '' for everything
  const [courtId, setCourtId] = useState("");
  const [selected, setSelected] = useState(null); // judge id
  const [errorDetail, setErrorDetail] = useState(null);

  const loadList = useCallback(async (newOffset, append) => {
    setPhase("loading");
    try {
      const p = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(newOffset) });
      if (search) p.set("q", search);
      if (courtId) p.set("courtId", courtId);
      else if (scope) p.set("state", scope);
      const r = await fetch(`/api/judges-national-list?${p}`);
      const d = await r.json().catch(() => null);
      if (!r.ok || !d || d.ready === undefined) {
        console.error("National judges list fetch failed", { status: r.status, d });
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
      console.error("National judges list fetch threw", err);
      setErrorDetail(String(err.message || err));
      setPhase("error");
    }
  }, [search, scope, courtId]);

  useEffect(() => { loadList(0, false); }, [search, scope, courtId, loadList]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/judge-national-courts")
      .then(r => r.json())
      .then(d => { if (!cancelled && d.ready) setScopes(d.scopes || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!scope) { setCourts([]); return; }
    let cancelled = false;
    fetch(`/api/judge-national-courts?state=${encodeURIComponent(scope)}`)
      .then(r => r.json())
      .then(d => { if (!cancelled && d.ready) setCourts(d.courts || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [scope]);

  function runSearch() { setSearch(searchInput.trim()); }

  if (selected) {
    return <NationalJudgeDetail judgeId={selected} onBack={() => setSelected(null)} />;
  }

  // The federal option always exists even before the first sync has run, so
  // the default selection never points at a missing <option>.
  const scopeOptions = (scopes.some(s => s.state === "US") ? [...scopes] : [{ state: "US" }, ...scopes])
    .sort((a, b) =>
      a.state === "US" ? -1 : b.state === "US" ? 1 : scopeName(a.state).localeCompare(scopeName(b.state)));

  return (
    <div style={{ fontFamily: serif, color: C.ink, maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ background: C.navy, color: "#fff", padding: "22px 24px", borderRadius: 8,
                    border: `3px solid ${C.gold}`, marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, color: C.gold, textTransform: "uppercase", marginBottom: 8 }}>
          National Judge Directory
        </div>
        <div style={{ fontSize: 14, color: "#cfd6e4", lineHeight: 1.6 }}>
          Judges are the least-known officials on your ballot and on your case. This directory
          covers the federal bench, from the Supreme Court to every district court, and the
          supreme and appellate courts of all fifty states, so you can see who sits on a court,
          what their position is, and who put them there.
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <select value={scope} onChange={e => { setScope(e.target.value); setCourtId(""); }}
          style={{ flex: "1 1 190px", fontFamily: serif, fontSize: 13, padding: "10px 8px",
                   border: `1px solid ${C.line}`, borderRadius: 5, background: "#fff" }}>
          <option value="">All states &amp; federal</option>
          {scopeOptions.map(s => (
            <option key={s.state} value={s.state}>
              {scopeName(s.state)}{Number(s.judge_count) > 0 ? ` (${s.judge_count})` : ""}
            </option>
          ))}
        </select>
        {scope && courts.length > 0 && (
          <select value={courtId} onChange={e => setCourtId(e.target.value)}
            style={{ flex: "1 1 190px", fontFamily: serif, fontSize: 13, padding: "10px 8px",
                     border: `1px solid ${C.line}`, borderRadius: 5, background: "#fff" }}>
            <option value="">All courts</option>
            {courts.map(c => (
              <option key={c.id} value={c.id}>{c.name}{Number(c.judge_count) > 0 ? ` (${c.judge_count})` : ""}</option>
            ))}
          </select>
        )}
        <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && runSearch()}
          placeholder="Search by judge or court name"
          style={{ flex: "2 1 200px", fontFamily: serif, fontSize: 14, padding: "10px 12px",
                   border: `1px solid ${C.line}`, borderRadius: 5 }} />
        <button onClick={runSearch}
          style={{ fontFamily: serif, fontWeight: 700, fontSize: 13, padding: "10px 18px",
                   background: C.crimson, color: "#fff", border: "none", borderRadius: 5, cursor: "pointer" }}>
          Search
        </button>
      </div>

      {phase === "loading" && judges.length === 0 && <Center>Loading judges...</Center>}
      {phase === "error" && (
        <Center color={C.crimson}>
          Could not load judges. <Link onClick={() => loadList(0, false)}>Try again</Link>
          {errorDetail && (
            <div style={{ fontSize: 11.5, color: C.muted, marginTop: 8, fontFamily: "monospace" }}>{errorDetail}</div>
          )}
        </Center>
      )}
      {phase === "notready" && (
        <Center>The national judges database is not loaded yet. It fills in automatically as the daily sync runs.</Center>
      )}
      {phase === "ready" && judges.length === 0 && (
        <Center>
          No judges match{scope ? ` in ${scopeName(scope)}` : " that search"} yet.
          The directory fills in state by state as the daily sync runs.
        </Center>
      )}

      {judges.length > 0 && (
        <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 8, overflow: "hidden" }}>
          {judges.map(j => (
            <button key={j.id} onClick={() => setSelected(j.id)}
              style={{ display: "flex", width: "100%", textAlign: "left", alignItems: "center", gap: 12,
                       padding: "12px 16px", background: "transparent", border: "none",
                       borderBottom: "1px solid #f0ead8", cursor: "pointer", fontFamily: serif }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>{j.full_name}</div>
                <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
                  {j.court_name || "Court not on record"}{j.position_title ? ` · ${j.position_title}` : ""}
                </div>
              </div>
              {j.jurisdiction && (
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase",
                               color: C.muted, border: `1px solid ${C.line}`, borderRadius: 4,
                               padding: "3px 8px", flexShrink: 0 }}>
                  {JURISDICTION_LABELS[j.jurisdiction] || j.jurisdiction}
                </span>
              )}
              <span style={{ fontSize: 12, color: C.crimson, fontWeight: 700, flexShrink: 0 }}>View →</span>
            </button>
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
        Source: the Free Law Project's CourtListener judge database. Coverage spans the federal
        judiciary and every state's supreme and appellate courts; state trial courts are not
        included because no reliable nationwide source exists for them. Colorado judges also
        carry their official performance evaluations and retention results, from the Colorado
        deep dive.
      </p>
    </div>
  );
}

function NationalJudgeDetail({ judgeId, onBack }) {
  const [phase, setPhase] = useState("loading");
  const [data, setData] = useState(null);
  const [errorDetail, setErrorDetail] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setPhase("loading");
    fetch(`/api/judge-national-detail?judgeId=${encodeURIComponent(judgeId)}`)
      .then(async r => ({ ok: r.ok, status: r.status, d: await r.json().catch(() => null) }))
      .then(({ ok, status, d }) => {
        if (cancelled) return;
        if (!ok || !d || d.ready === undefined) {
          console.error("National judge detail fetch failed", { status, d });
          setErrorDetail(d?.detail || d?.error || `HTTP ${status}`);
          setPhase("error");
          return;
        }
        if (!d.ready) { setPhase("notready"); return; }
        setData(d);
        setPhase("ready");
      })
      .catch(err => {
        if (cancelled) return;
        setErrorDetail(String(err.message || err));
        setPhase("error");
      });
    return () => { cancelled = true; };
  }, [judgeId]);

  const back = (
    <button onClick={onBack}
      style={{ fontFamily: serif, fontSize: 13, fontWeight: 700, color: C.navy, background: "none",
               border: `1px solid ${C.line}`, borderRadius: 6, padding: "6px 14px", cursor: "pointer", marginBottom: 16 }}>
      ← All judges
    </button>
  );

  if (phase === "loading") return <div style={{ fontFamily: serif, maxWidth: 900, margin: "0 auto" }}>{back}<Center>Loading judge...</Center></div>;
  if (phase === "error") return (
    <div style={{ fontFamily: serif, maxWidth: 900, margin: "0 auto" }}>
      {back}
      <Center color={C.crimson}>
        Could not load this judge.
        {errorDetail && (
          <div style={{ fontSize: 11.5, color: C.muted, marginTop: 8, fontFamily: "monospace" }}>{errorDetail}</div>
        )}
      </Center>
    </div>
  );
  if (phase === "notready") return <div style={{ fontFamily: serif, maxWidth: 900, margin: "0 auto" }}>{back}<Center>The national judges database is not loaded yet.</Center></div>;

  const { judge, evaluations, retention } = data;
  const jurisdictionLabel = JURISDICTION_LABELS[judge.jurisdiction] || null;

  return (
    <div style={{ fontFamily: serif, color: C.ink, maxWidth: 900, margin: "0 auto" }}>
      {back}

      <div style={{ background: C.navy, color: "#fff", padding: "20px 24px", borderRadius: 8, border: `3px solid ${C.gold}`, marginBottom: 18 }}>
        <div style={{ fontSize: 20, fontWeight: 900 }}>{judge.full_name}</div>
        <div style={{ fontSize: 12.5, color: "#cfd6e4", marginTop: 4 }}>
          {judge.court_name || "Court not on record"}
          {judge.position_title ? ` · ${judge.position_title}` : ""}
          {judge.date_start ? ` · serving since ${String(judge.date_start).slice(0, 10)}` : ""}
        </div>
        <div style={{ fontSize: 12.5, color: "#cfd6e4", marginTop: 4 }}>
          {[
            judge.state ? scopeName(judge.state) : (jurisdictionLabel ? "Federal (nationwide)" : null),
            jurisdictionLabel,
            judge.appointed_by ? `Appointed by ${judge.appointed_by}` : null,
          ].filter(Boolean).join(" · ")}
        </div>
      </div>

      {evaluations.length > 0 && (
        <Section title="Performance evaluations (Colorado OJPE)">
          {evaluations.map((e, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderBottom: "1px solid #f0ead8" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: C.navy }}>{e.eval_year} evaluation</div>
                <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
                  {e.recommendation || "No recommendation recorded"}
                  {e.retention_score != null ? ` · score ${e.retention_score}` : ""}
                </div>
              </div>
              {e.narrative_url && (
                <a href={e.narrative_url} target="_blank" rel="noopener noreferrer"
                   style={{ fontSize: 11.5, color: C.crimson, fontWeight: 700, flexShrink: 0 }}>
                  Full narrative →
                </a>
              )}
            </div>
          ))}
        </Section>
      )}

      {retention.length > 0 && (
        <Section title="Retention election results">
          {retention.map((r, i) => (
            <RetentionBar key={i} electionYear={r.election_year} yesVotes={r.yes_votes}
              noVotes={r.no_votes} retained={r.retained} />
          ))}
        </Section>
      )}

      <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
        Directory data from the Free Law Project's CourtListener.
        {evaluations.length === 0 && retention.length === 0 && (
          " Performance evaluations and retention results are shown where an official state source" +
          " has been wired in; Colorado is the first."
        )}
      </p>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>{title}</div>
      <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 8, overflow: "hidden" }}>{children}</div>
    </div>
  );
}
function Center({ children, color }) {
  return <div style={{ textAlign: "center", padding: 40, color: color || C.muted, fontSize: 14.5, fontFamily: serif }}>{children}</div>;
}
function Link({ onClick, children }) {
  return <button onClick={onClick} style={{ background: "none", border: "none", color: C.crimson, fontFamily: serif, fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>{children}</button>;
}
