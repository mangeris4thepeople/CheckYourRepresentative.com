// =============================================================================
// NationalJudges.jsx - the national wing of Know Your Judge. A searchable
// 50-state directory of sitting state court judges, mirrored from the Free
// Law Project's CourtListener database by the sync-national-judges crawler.
// Coverage is what CourtListener has: strongest for supreme and appellate
// courts, growing for trial courts. Each judge links to their CourtListener
// profile for the full biography, positions, and financial disclosures.
//
// October 2026 revamp: pill search bar, judge rows with initials and a state
// chip, kit loading and error states. Presentation only. No em dashes.
// =============================================================================
import React, { useState, useEffect, useCallback } from "react";
import { PageHero, Panel, Loading, Empty, ErrorBox } from "./ui/Kit.jsx";

const C = {
  navy: "#0E2A6B", blue: "#2563EB", gold: "#F5B82E",
  ink: "#0F172A", muted: "#5B6578", line: "#E2E8F0", sky: "#E8F0FF",
};
const sans = "var(--cyr-sans)";
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

const JURISDICTION_NAMES = {
  S: "State supreme court", SA: "State appellate court",
  ST: "State trial court", SS: "State special court",
};

const fieldStyle = {
  fontFamily: sans, fontSize: 15, padding: "11px 14px", border: `1px solid ${C.line}`,
  borderRadius: 999, background: "#fff", color: C.ink, minHeight: 44, width: "100%",
};

// Standalone by default; `hideHeader` drops the hero when embedded under
// the national heat map, and `onSelectJudge` hands row clicks to the
// parent (the drill-down's judge profile) instead of the built-in detail.
export default function NationalJudges({ hideHeader = false, onSelectJudge = null }) {
  const [phase, setPhase] = useState("loading"); // loading | ready | notready | error
  const [judges, setJudges] = useState([]);
  const [states, setStates] = useState([]);
  const [totalJudges, setTotalJudges] = useState(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [state, setState] = useState("");
  const [selected, setSelected] = useState(null); // full judge row object
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

  if (selected) {
    return <NationalJudgeDetail judge={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div style={{ fontFamily: sans, color: C.ink, maxWidth: 1000, margin: "0 auto", minWidth: 0 }}>
      {!hideHeader && (
        <PageHero
          eyebrow="National judge registry"
          title="Every state's judges"
          lede={<>
            Sitting state court judges across all 50 states, mirrored from the Free Law Project's
            CourtListener database{totalJudges ? ` (${totalJudges.toLocaleString()} judges on file)` : ""}.
            Search by name or court, filter by state, and follow any judge through to their full
            CourtListener profile for biography, career history, and financial disclosures.
          </>}
          chips={[{ value: totalJudges, label: "judges on file" }]}
        />
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "2 1 220px", minWidth: 0 }}>
          <span aria-hidden style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 15, opacity: .55 }}>🔎</span>
          <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && runSearch()}
            placeholder="Search by judge or court name"
            aria-label="Search judges by name or court"
            style={{ ...fieldStyle, paddingLeft: 40 }} />
        </div>
        <select value={state} onChange={e => setState(e.target.value)} aria-label="Filter by state"
          style={{ ...fieldStyle, flex: "1 1 160px", width: "auto", minWidth: 0, fontSize: 14, cursor: "pointer" }}>
          <option value="">All states</option>
          {states.map(s => (
            <option key={s.state_abbr} value={s.state_abbr}>
              {STATE_NAMES[s.state_abbr] || s.state_abbr}{Number(s.judge_count) > 0 ? ` (${s.judge_count})` : ""}
            </option>
          ))}
        </select>
        <button onClick={runSearch} className="cyr-btn cyr-btn-primary" style={{ minHeight: 44, justifyContent: "center" }}>
          Search
        </button>
      </div>

      {phase === "loading" && judges.length === 0 && <Loading rows={4} height={58} />}
      {phase === "error" && (
        <ErrorBox onRetry={() => loadList(0, false)}>
          Could not load the national registry.
          {errorDetail && (
            <div style={{ fontSize: 11.5, marginTop: 6, fontFamily: "var(--cyr-mono)", fontWeight: 500, overflowWrap: "anywhere" }}>{errorDetail}</div>
          )}
        </ErrorBox>
      )}
      {phase === "notready" && (
        <Empty icon="⏳" title="Still loading">The national registry is still loading its first pass. Check back shortly.</Empty>
      )}
      {phase === "ready" && judges.length === 0 && <Empty icon="🔎" title="No matches">No judges match that search.</Empty>}

      {judges.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 8 }}>
          {judges.map(j => (
            <button key={j.id} onClick={() => (onSelectJudge ? onSelectJudge(j) : setSelected(j))}
              className="cyr-row"
              style={{ width: "100%", textAlign: "left", cursor: "pointer", fontFamily: sans, padding: "11px 14px", minHeight: 58 }}>
              <Initials name={j.full_name} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <span style={{ fontSize: 14.5, fontWeight: 700, color: C.navy, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                    {j.full_name}
                  </span>
                  {j.state_abbr && (
                    <span className="cyr-chip" style={{ fontSize: 10.5, padding: "2px 7px", flexShrink: 0 }}>{j.state_abbr}</span>
                  )}
                </span>
                <span style={{ display: "block", fontSize: 12.5, color: C.muted, lineHeight: 1.45, marginTop: 2 }}>
                  {j.court_name || "Court not on record"}
                  {j.position_title ? ` · ${j.position_title}` : ""}
                  {j.date_start ? ` · since ${String(j.date_start).slice(0, 4)}` : ""}
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
      {phase === "loading" && judges.length > 0 && (
        <div style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: 10 }}>Loading more...</div>
      )}

      <p style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.65, margin: "16px 0 0" }}>
        Source: the Free Law Project's CourtListener judge database, refreshed daily. Coverage
        reflects what CourtListener publishes: complete for supreme and appellate courts, growing
        for trial courts. Colorado judges get the fuller treatment in the Colorado view, with
        official performance evaluations and retention election results.
      </p>
    </div>
  );
}

function NationalJudgeDetail({ judge, onBack }) {
  const startDate = judge.date_start ? String(judge.date_start).slice(0, 10) : null;
  return (
    <div style={{ fontFamily: sans, color: C.ink, maxWidth: 900, margin: "0 auto", minWidth: 0 }}>
      <button onClick={onBack} className="cyr-btn cyr-btn-ghost" style={{ marginBottom: 14, minHeight: 40 }}>
        <span aria-hidden>←</span> All judges
      </button>

      <PageHero compact eyebrow="Judge profile" title={judge.full_name}
        lede={`${judge.court_name || "Court not on record"}${judge.position_title ? ` · ${judge.position_title}` : ""}${startDate ? ` · serving since ${startDate}` : ""}`} />

      <Panel eyebrow="Seat" title="Position" pad={8}>
        <Row label="Court" value={judge.court_name || "Not on record"} />
        <Row label="Court type" value={JURISDICTION_NAMES[judge.jurisdiction] || "State court"} />
        <Row label="State" value={STATE_NAMES[judge.state_abbr] || judge.state_abbr || "Not on record"} />
        <Row label="Title" value={judge.position_title || "Judge"} />
        <Row label="Serving since" value={startDate || "Not on record"} last />
      </Panel>

      <Panel eyebrow="CourtListener" title="Full profile" pad={18}>
        <div style={{ fontSize: 14, color: "#475569", lineHeight: 1.7 }}>
          Career history, education, political affiliations, and financial disclosures for this
          judge live on their CourtListener profile, maintained by the nonprofit Free Law Project.
        </div>
        <a href={clProfileUrl(judge)} target="_blank" rel="noopener noreferrer"
          className="cyr-btn cyr-btn-primary" style={{ marginTop: 14, whiteSpace: "normal" }}>
          View full CourtListener profile{"\u00a0"}→
        </a>
      </Panel>

      <p style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.65, marginTop: 4 }}>
        Performance evaluations and retention election results are currently tracked for Colorado
        judges in the Colorado view. Equivalent official data for other states gets added as each
        state's public records are wired in.
      </p>
    </div>
  );
}

function Initials({ name, size = 38 }) {
  const parts = String(name || "").replace(/[^A-Za-z\s.'-]/g, "").split(/\s+/).filter(p => p && /[A-Za-z]/.test(p[0]));
  const ini = ((parts[0] || "")[0] || "") + ((parts.length > 1 ? parts[parts.length - 1] : "")[0] || "");
  return (
    <span aria-hidden style={{ width: size, height: size, borderRadius: size * 0.32, flexShrink: 0, display: "grid", placeItems: "center",
                               fontFamily: "var(--cyr-display)", fontWeight: 800, fontSize: size * 0.38, color: "#fff",
                               background: "linear-gradient(135deg,#0E2A6B,#2563EB)" }}>
      {ini.toUpperCase() || "J"}
    </span>
  );
}

function Row({ label, value, last }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 120px) minmax(0, 1fr)", gap: 12, padding: "11px 12px",
                  borderBottom: last ? "none" : "1px solid #EEF2F8", fontFamily: sans, alignItems: "baseline" }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: C.muted }}>{label}</span>
      <span style={{ fontSize: 14, color: C.ink, fontWeight: 600, overflowWrap: "break-word", minWidth: 0 }}>{value}</span>
    </div>
  );
}
