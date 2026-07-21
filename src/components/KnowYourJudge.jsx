// =============================================================================
// KnowYourJudge.jsx - the Know Your Judge tab. Colorado's judiciary: every
// judge we track, their court, their official OJPE performance evaluations,
// and their retention election results. Follows the same state-view pattern
// as KnowYourRep.jsx (this app has no router): a searchable, filterable
// list and a detail view per judge.
//
// Directory sources: appellate judges from the CourtListener sync, trial
// court judges and all evaluation/retention data transcribed from official
// state publications (OJPE reports, Secretary of State election results).
// =============================================================================
import React, { useState, useEffect, useCallback } from "react";
import RetentionBar from "./RetentionBar.jsx";

const C = {
  navy: "#0A1A3F", gold: "#C9A227", crimson: "#8B0000", parchment: "#FBF7EC",
  ink: "#1A1A1A", muted: "#5C5347", line: "#D8C9A0", green: "#1B5E20", red: "#B71C1C",
};
const serif = "Georgia, 'Times New Roman', serif";
const PAGE_SIZE = 20;

export default function KnowYourJudge() {
  const [phase, setPhase] = useState("loading"); // loading | ready | notready | error
  const [judges, setJudges] = useState([]);
  const [courts, setCourts] = useState([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [courtId, setCourtId] = useState("");
  const [selected, setSelected] = useState(null); // judge id
  const [errorDetail, setErrorDetail] = useState(null);

  const loadList = useCallback(async (newOffset, append) => {
    setPhase("loading");
    try {
      const p = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(newOffset) });
      if (search) p.set("q", search);
      if (courtId) p.set("courtId", courtId);
      const r = await fetch(`/api/judges-list?${p}`);
      const d = await r.json().catch(() => null);
      if (!r.ok || !d || d.ready === undefined) {
        console.error("Judges list fetch failed", { status: r.status, d });
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
      console.error("Judges list fetch threw", err);
      setErrorDetail(String(err.message || err));
      setPhase("error");
    }
  }, [search, courtId]);

  useEffect(() => { loadList(0, false); }, [search, courtId, loadList]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/judge-courts")
      .then(r => r.json())
      .then(d => { if (!cancelled && d.ready) setCourts(d.courts || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  function runSearch() { setSearch(searchInput.trim()); }

  if (selected) {
    return <JudgeDetail judgeId={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div style={{ fontFamily: serif, color: C.ink, maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ background: C.navy, color: "#fff", padding: "22px 24px", borderRadius: 8,
                    border: `3px solid ${C.gold}`, marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, color: C.gold, textTransform: "uppercase", marginBottom: 8 }}>
          Know Your Judge
        </div>
        <div style={{ fontSize: 14, color: "#cfd6e4", lineHeight: 1.6 }}>
          Colorado's judges do not run in contested elections, you vote to retain or remove them.
          This section shows every judge we track, their official performance evaluation from the
          state's Office of Judicial Performance Evaluation, and how past retention votes went,
          so a retention ballot line is never a blind guess.
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && runSearch()}
          placeholder="Search by judge or court name"
          style={{ flex: "2 1 220px", fontFamily: serif, fontSize: 14, padding: "10px 12px",
                   border: `1px solid ${C.line}`, borderRadius: 5 }} />
        <select value={courtId} onChange={e => setCourtId(e.target.value)}
          style={{ flex: "1 1 180px", fontFamily: serif, fontSize: 13, padding: "10px 8px",
                   border: `1px solid ${C.line}`, borderRadius: 5, background: "#fff" }}>
          <option value="">All courts</option>
          {courts.map(c => (
            <option key={c.id} value={c.id}>{c.name}{Number(c.judge_count) > 0 ? ` (${c.judge_count})` : ""}</option>
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
          Could not load judges. <Link onClick={() => loadList(0, false)}>Try again</Link>
          {errorDetail && (
            <div style={{ fontSize: 11.5, color: C.muted, marginTop: 8, fontFamily: "monospace" }}>{errorDetail}</div>
          )}
        </Center>
      )}
      {phase === "notready" && <Center>The judges database is not loaded yet.</Center>}
      {phase === "ready" && judges.length === 0 && <Center>No judges match that search.</Center>}

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
        Sources: appellate judges from the Free Law Project's CourtListener. Performance evaluations
        transcribed from the Colorado Office of Judicial Performance Evaluation. Retention results
        transcribed from official Colorado Secretary of State election records.
      </p>
    </div>
  );
}

function JudgeDetail({ judgeId, onBack }) {
  const [phase, setPhase] = useState("loading");
  const [data, setData] = useState(null);
  const [errorDetail, setErrorDetail] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setPhase("loading");
    fetch(`/api/judge-detail?judgeId=${encodeURIComponent(judgeId)}`)
      .then(async r => ({ ok: r.ok, status: r.status, d: await r.json().catch(() => null) }))
      .then(({ ok, status, d }) => {
        if (cancelled) return;
        if (!ok || !d || d.ready === undefined) {
          console.error("Judge detail fetch failed", { status, d });
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
  if (phase === "notready") return <div style={{ fontFamily: serif, maxWidth: 900, margin: "0 auto" }}>{back}<Center>The judges database is not loaded yet.</Center></div>;

  const { judge, evaluations, retention } = data;

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
        {judge.appointed_by && (
          <div style={{ fontSize: 12.5, color: "#cfd6e4", marginTop: 4 }}>Appointed by {judge.appointed_by}</div>
        )}
      </div>

      <Section title="Performance evaluations (OJPE)">
        {evaluations.length === 0
          ? <Empty>No OJPE evaluation on record for this judge yet.</Empty>
          : evaluations.map((e, i) => (
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

      <Section title="Retention election results">
        {retention.length === 0
          ? <Empty>No retention election on record for this judge yet.</Empty>
          : retention.map((r, i) => (
            <RetentionBar key={i} electionYear={r.election_year} yesVotes={r.yes_votes}
              noVotes={r.no_votes} retained={r.retained} />
          ))}
      </Section>
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
function Empty({ children }) {
  return <div style={{ padding: "14px", fontSize: 13, color: C.muted }}>{children}</div>;
}
function Center({ children, color }) {
  return <div style={{ textAlign: "center", padding: 40, color: color || C.muted, fontSize: 14.5, fontFamily: serif }}>{children}</div>;
}
function Link({ onClick, children }) {
  return <button onClick={onClick} style={{ background: "none", border: "none", color: C.crimson, fontFamily: serif, fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>{children}</button>;
}
