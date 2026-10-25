// =============================================================================
// KnowYourJudge.jsx - the Colorado retention section of Know Your Judge.
// Colorado's judiciary: every judge we track, their court, their official
// OJPE performance evaluations, and their retention election results.
// Follows the same state-view pattern as KnowYourRep.jsx (this app has no
// router): a searchable, filterable list and a detail view per judge.
//
// Directory sources: appellate judges from the CourtListener sync, trial
// court judges and all evaluation/retention data transcribed from official
// state publications (OJPE reports, Secretary of State election results).
//
// October 2026 revamp: it renders inside a Panel on the Colorado state
// page, so it uses a light intro callout instead of a second hero, pill
// search, judge rows with initials, and kit states. Presentation only.
// House style: no em dashes.
// =============================================================================
import React, { useState, useEffect, useCallback } from "react";
import RetentionBar from "./RetentionBar.jsx";
import { Loading, Empty as KitEmpty, ErrorBox } from "./ui/Kit.jsx";

const C = {
  navy: "#0E2A6B", blue: "#2563EB", gold: "#F5B82E",
  ink: "#0F172A", muted: "#5B6578", line: "#E2E8F0", green: "#15803D", red: "#DC2626", soft: "#F8FAFE",
};
const sans = "var(--cyr-sans)";
const PAGE_SIZE = 20;

const fieldStyle = {
  fontFamily: sans, fontSize: 15, padding: "11px 14px", border: `1px solid ${C.line}`,
  borderRadius: 999, background: "#fff", color: C.ink, minHeight: 44, width: "100%",
};

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
    <div style={{ fontFamily: sans, color: C.ink, maxWidth: 1000, margin: "0 auto", minWidth: 0 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "14px 16px", borderRadius: 16, marginBottom: 14,
                    background: "linear-gradient(120deg,#EEF4FF,#FFFFFF)", border: "1px solid #DCE6F7" }}>
        <span aria-hidden style={{ fontSize: 22, lineHeight: 1.2, flexShrink: 0 }}>🗳️</span>
        <div style={{ fontSize: 14, color: "#334155", lineHeight: 1.65, minWidth: 0 }}>
          Colorado's judges do not run in contested elections, you vote to retain or remove them.
          This section shows every judge we track, their official performance evaluation from the
          state's Office of Judicial Performance Evaluation, and how past retention votes went,
          so a retention ballot line is never a blind guess.
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "2 1 220px", minWidth: 0 }}>
          <span aria-hidden style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 15, opacity: .55 }}>🔎</span>
          <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && runSearch()}
            placeholder="Search by judge or court name"
            aria-label="Search Colorado judges by name or court"
            style={{ ...fieldStyle, paddingLeft: 40 }} />
        </div>
        <select value={courtId} onChange={e => setCourtId(e.target.value)} aria-label="Filter by court"
          style={{ ...fieldStyle, flex: "1 1 180px", width: "auto", minWidth: 0, fontSize: 14, cursor: "pointer" }}>
          <option value="">All courts</option>
          {courts.map(c => (
            <option key={c.id} value={c.id}>{c.name}{Number(c.judge_count) > 0 ? ` (${c.judge_count})` : ""}</option>
          ))}
        </select>
        <button onClick={runSearch} className="cyr-btn cyr-btn-primary" style={{ minHeight: 44, justifyContent: "center" }}>
          Search
        </button>
      </div>

      {phase === "loading" && judges.length === 0 && <Loading rows={4} height={58} />}
      {phase === "error" && (
        <ErrorBox onRetry={() => loadList(0, false)}>
          Could not load judges.
          {errorDetail && (
            <div style={{ fontSize: 11.5, marginTop: 6, fontFamily: "var(--cyr-mono)", fontWeight: 500, overflowWrap: "anywhere" }}>{errorDetail}</div>
          )}
        </ErrorBox>
      )}
      {phase === "notready" && <KitEmpty icon="⏳" title="Not loaded yet">The judges database is not loaded yet.</KitEmpty>}
      {phase === "ready" && judges.length === 0 && <KitEmpty icon="🔎" title="No matches">No judges match that search.</KitEmpty>}

      {judges.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))", gap: 8 }}>
          {judges.map(j => (
            <button key={j.id} onClick={() => setSelected(j.id)} className="cyr-row"
              style={{ width: "100%", textAlign: "left", cursor: "pointer", fontFamily: sans, padding: "11px 12px", minHeight: 58 }}>
              <Initials name={j.full_name} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 14.5, fontWeight: 700, color: C.navy, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {j.full_name}
                </span>
                <span style={{ display: "block", fontSize: 12.5, color: C.muted, lineHeight: 1.45, marginTop: 1 }}>
                  {j.court_name || "Court not on record"}{j.position_title ? ` · ${j.position_title}` : ""}
                </span>
              </span>
              <span aria-hidden style={{ color: C.blue, fontSize: 18, flexShrink: 0 }}>›</span>
            </button>
          ))}
        </div>
      )}

      {hasMore && phase === "ready" && (
        <button onClick={() => loadList(offset + PAGE_SIZE, true)} className="cyr-btn cyr-btn-ghost"
          style={{ width: "100%", justifyContent: "center", marginTop: 12, padding: 13 }}>
          Load more judges
        </button>
      )}

      <p style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.65, margin: "16px 0 0" }}>
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
    <button onClick={onBack} className="cyr-btn cyr-btn-ghost" style={{ marginBottom: 14, minHeight: 40 }}>
      <span aria-hidden>←</span> All judges
    </button>
  );
  const wrap = { fontFamily: sans, color: C.ink, maxWidth: 900, margin: "0 auto", minWidth: 0 };

  if (phase === "loading") return <div style={wrap}>{back}<Loading rows={3} height={64} /></div>;
  if (phase === "error") return (
    <div style={wrap}>
      {back}
      <ErrorBox>
        Could not load this judge.
        {errorDetail && (
          <div style={{ fontSize: 11.5, marginTop: 6, fontFamily: "var(--cyr-mono)", fontWeight: 500, overflowWrap: "anywhere" }}>{errorDetail}</div>
        )}
      </ErrorBox>
    </div>
  );
  if (phase === "notready") return <div style={wrap}>{back}<KitEmpty icon="⏳" title="Not loaded yet">The judges database is not loaded yet.</KitEmpty></div>;

  const { judge, evaluations, retention } = data;

  return (
    <div style={wrap}>
      {back}

      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", padding: "16px 18px", borderRadius: 18, marginBottom: 16,
                    background: "linear-gradient(125deg,#0B225A 0%,#1E40AF 55%,#2563EB 100%)", color: "#fff",
                    boxShadow: "0 14px 30px rgba(14,42,107,.18)" }}>
        <Initials name={judge.full_name} size={52} light />
        <div style={{ minWidth: 0, flex: "1 1 220px" }}>
          <div className="cyr-h1" style={{ fontSize: "clamp(22px, 3vw, 28px)" }}>{judge.full_name}</div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,.86)", marginTop: 4, lineHeight: 1.5 }}>
            {judge.court_name || "Court not on record"}
            {judge.position_title ? ` · ${judge.position_title}` : ""}
            {judge.date_start ? ` · serving since ${String(judge.date_start).slice(0, 10)}` : ""}
          </div>
          {judge.appointed_by && (
            <div style={{ fontSize: 13.5, color: "rgba(255,255,255,.8)", marginTop: 2 }}>Appointed by {judge.appointed_by}</div>
          )}
        </div>
      </div>

      <SubCard icon="📋" title="Performance evaluations (OJPE)">
        {evaluations.length === 0
          ? <Muted>No OJPE evaluation on record for this judge yet.</Muted>
          : <div style={{ display: "grid", gap: 8 }}>
              {evaluations.map((e, i) => {
                const rec = e.recommendation ? sentence(e.recommendation) : null;
                const meets = /meets/i.test(e.recommendation || "") && !/not/i.test(e.recommendation || "");
                return (
                  <div key={i} className="cyr-row" style={{ padding: "11px 12px", flexWrap: "wrap", rowGap: 8 }}>
                    <span className="cyr-num" style={{ fontSize: 18, color: C.navy, flexShrink: 0, width: 52 }}>{e.eval_year}</span>
                    <span style={{ flex: "1 1 180px", minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: C.ink }}>{e.eval_year} evaluation</span>
                      <span style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginTop: 4 }}>
                        <span className="cyr-chip" style={rec ? (meets ? { background: "#DCFCE7", color: C.green } : { background: "#FEF3C7", color: "#92400E" }) : { background: "#F1F5F9", color: C.muted }}>
                          {rec || "No recommendation recorded"}
                        </span>
                        {e.retention_score != null && <span style={{ fontSize: 12.5, color: C.muted }}>score {e.retention_score}</span>}
                      </span>
                    </span>
                    {e.narrative_url && (
                      <a href={e.narrative_url} target="_blank" rel="noopener noreferrer" className="cyr-btn cyr-btn-ghost"
                        style={{ fontSize: 12.5, padding: "8px 12px", flexShrink: 0 }}>
                        Full narrative →
                      </a>
                    )}
                  </div>
                );
              })}
            </div>}
      </SubCard>

      <SubCard icon="🗳️" title="Retention election results">
        {retention.length === 0
          ? <Muted>No retention election on record for this judge yet.</Muted>
          : <div style={{ display: "grid", gap: 8 }}>
              {retention.map((r, i) => (
                <RetentionBar key={i} electionYear={r.election_year} yesVotes={r.yes_votes}
                  noVotes={r.no_votes} retained={r.retained} />
              ))}
            </div>}
      </SubCard>
    </div>
  );
}

// OJPE publishes recommendations in all caps; show them in sentence case.
function sentence(s) {
  const t = String(s).trim();
  if (t !== t.toUpperCase()) return t;
  const low = t.toLowerCase();
  return low.charAt(0).toUpperCase() + low.slice(1);
}

function SubCard({ icon, title, children }) {
  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 16, background: C.soft, padding: 14, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span aria-hidden style={{ fontSize: 17 }}>{icon}</span>
        <span className="cyr-h2" style={{ fontSize: 17 }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function Initials({ name, size = 38, light }) {
  const parts = String(name || "").replace(/[^A-Za-z\s.'-]/g, "").split(/\s+/).filter(p => p && /[A-Za-z]/.test(p[0]));
  const ini = ((parts[0] || "")[0] || "") + ((parts.length > 1 ? parts[parts.length - 1] : "")[0] || "");
  return (
    <span aria-hidden style={{ width: size, height: size, borderRadius: size * 0.32, flexShrink: 0, display: "grid", placeItems: "center",
                               fontFamily: "var(--cyr-display)", fontWeight: 800, fontSize: size * 0.38, color: "#fff",
                               background: light ? "rgba(255,255,255,.16)" : "linear-gradient(135deg,#0E2A6B,#2563EB)",
                               border: light ? "1px solid rgba(255,255,255,.35)" : "none" }}>
      {ini.toUpperCase() || "J"}
    </span>
  );
}

function Muted({ children }) {
  return <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.6, padding: "2px 2px" }}>{children}</div>;
}
