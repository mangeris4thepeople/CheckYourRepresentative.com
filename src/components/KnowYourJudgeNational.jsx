// =============================================================================
// KnowYourJudgeNational.jsx - the Know Your Judge tab, one national
// experience. Drill path: national heat map of sitting judges (total or per
// 100,000 residents) -> state view (statewide courts, county heat map,
// flagged unmapped courts, and for Colorado the retention and OJPE
// directory preserved in full) -> county view (courts grouped by city, each
// with a plain language explanation and its sitting judges) -> judge
// profile with the Ruling Record: raw public record counts from
// CourtListener opinions, never a score or grade.
//
// October 2026 revamp: gradient PageHero per level, white Panel cards,
// segmented metric switch, ranked rows with a proportional bar, and judge
// cards with initials. Presentation only; every fetch and state transition
// is unchanged. House style: no em dashes, no mock data.
// =============================================================================
import React, { useState, useEffect, useCallback } from "react";
import USAHeatMap from "./USAHeatMap.jsx";
import NationalJudges from "./NationalJudges.jsx";
import KnowYourJudge from "./KnowYourJudge.jsx";
import { PageHero, Panel, Loading, Empty as KitEmpty, ErrorBox } from "./ui/Kit.jsx";

const C = {
  navy: "#0E2A6B", blue: "#2563EB", gold: "#F5B82E", crimson: "#E0313F", red: "#DC2626",
  ink: "#0F172A", muted: "#5B6578", line: "#E2E8F0", soft: "#F8FAFE", sky: "#E8F0FF",
};
const sans = "var(--cyr-sans)";

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
  DC: "District of Columbia", PR: "Puerto Rico",
};

const JURISDICTION_LABELS = {
  S: "Supreme court", SA: "Appellate court", ST: "Trial court", SS: "Special court",
};

const fmtInt = (n) => (n == null ? "n/a" : Number(n).toLocaleString());

const countyFiles = import.meta.glob("../data/counties/*.json");
async function loadCountyShapes(abbr) {
  const loader = countyFiles[`../data/counties/${abbr}.json`];
  if (!loader) return null;
  const mod = await loader();
  return mod.default || mod;
}

// Plain language explanation of what a court handles, derived from its
// CourtListener jurisdiction class and its own name. General wording on
// purpose: court structures differ by state, and this never claims more
// than the classification supports.
export function courtExplanation(court) {
  const name = String(court.full_name || "").toLowerCase();
  if (court.jurisdiction === "S") {
    return "This is the state's highest court, the court of last resort. It reviews decisions " +
      "appealed from the courts below it and its rulings bind every other court in the state.";
  }
  if (court.jurisdiction === "SA") {
    return "This is an appellate court. It does not hold trials; it reviews decisions from the " +
      "state's trial courts to check that the law was applied correctly, and its published " +
      "opinions guide the courts below it.";
  }
  if (/juvenile/.test(name)) {
    return "This court hears cases involving minors, such as juvenile delinquency, dependency, " +
      "and related family matters.";
  }
  if (/probate|surrogate/.test(name)) {
    return "This court handles wills, estates, guardianships, and related matters after a " +
      "death or for people who cannot manage their own affairs.";
  }
  if (/family|domestic/.test(name)) {
    return "This court hears family matters such as divorce, custody, support, and protective orders.";
  }
  if (/tax/.test(name)) {
    return "This court hears disputes between taxpayers and the state's taxing authorities.";
  }
  if (/workers|compensation|industrial/.test(name)) {
    return "This court or tribunal decides workers' compensation and related workplace injury claims.";
  }
  if (/municipal|city court/.test(name)) {
    return "This is a municipal court. It typically handles city ordinance violations, minor " +
      "offenses, and traffic matters arising inside the city.";
  }
  if (court.jurisdiction === "SS") {
    return "This is a specialized court with jurisdiction limited to particular kinds of cases, " +
      "as set out in the state's law creating it.";
  }
  if (/county court|justice|magistrate|district court/.test(name)) {
    return "This is a trial court. Cases start here: criminal charges, civil disputes, and the " +
      "other day to day matters of the justice system, with the exact mix set by state law.";
  }
  return "This is a state trial court. Cases start here, with the mix of criminal, civil, and " +
    "other matters set by the state's law for this court.";
}

export default function KnowYourJudgeNational() {
  // Navigation is plain state, like the rest of the app: a stack of views.
  const [state, setState] = useState(null);        // state abbr
  const [county, setCounty] = useState(null);      // { fips, name }
  const [judge, setJudge] = useState(null);        // judge row (from any list)

  if (judge) {
    return <JudgeProfile judgeRow={judge} onBack={() => setJudge(null)} />;
  }
  if (state && county) {
    return <CountyView state={state} county={county}
      onBack={() => setCounty(null)} onSelectJudge={setJudge} />;
  }
  if (state) {
    return <StateView state={state} onBack={() => setState(null)}
      onSelectCounty={setCounty} onSelectJudge={setJudge} />;
  }
  return <NationalView onSelectState={setState} onSelectJudge={setJudge} />;
}

function NationalView({ onSelectState, onSelectJudge }) {
  const [phase, setPhase] = useState("loading");
  const [states, setStates] = useState([]);
  const [totalJudges, setTotalJudges] = useState(null);
  const [metric, setMetric] = useState("judges"); // judges | per_100k
  const [errorDetail, setErrorDetail] = useState(null);

  const load = useCallback(async () => {
    setPhase("loading");
    try {
      const r = await fetch("/api/judges-map");
      const d = await r.json().catch(() => null);
      if (!r.ok || !d || d.ready === undefined) {
        setErrorDetail(d?.detail || d?.error || `HTTP ${r.status}`);
        setPhase("error");
        return;
      }
      if (!d.ready) { setPhase("notready"); return; }
      setStates(d.states || []);
      setTotalJudges(d.totalJudges ?? null);
      setPhase("ready");
    } catch (err) {
      setErrorDetail(String(err.message || err));
      setPhase("error");
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const hasPop = states.some(s => s.per_100k != null);
  const values = {};
  for (const s of states) {
    values[s.state_abbr] = metric === "per_100k" ? (s.per_100k ?? null) : s.judges;
  }
  const metricKey = metric === "per_100k" ? "per_100k" : "judges";
  const ranked = [...states].sort((a, b) => Number(b[metricKey] || 0) - Number(a[metricKey] || 0));
  const maxVal = ranked.length ? Number(ranked[0][metricKey] || 0) : 0;

  return (
    <Wrap>
      <PageHero
        eyebrow="Know Your Judge"
        title="Judges in every state"
        lede={<>
          The judges of every state{totalJudges ? ` (${fmtInt(totalJudges)} on file)` : ""}, mirrored
          from the Free Law Project's CourtListener database. The map colors each state by its
          sitting judges. Click a state to drill into its courts county by county, down to each
          courthouse and every judge's public ruling record.
        </>}
        chips={phase === "ready" ? [
          { value: totalJudges, label: "judges on file" },
          { value: states.length || null, label: "jurisdictions with judges on file" },
        ] : null}
      />

      {phase === "loading" && <Loading rows={3} height={120} />}
      {phase === "error" && (
        <ErrorBox onRetry={load}>
          Could not load the map.
          {errorDetail && <Mono>{errorDetail}</Mono>}
        </ErrorBox>
      )}
      {phase === "notready" && (
        <Panel><KitEmpty icon="⚖️" title="Still loading">The judge registry is still loading its first pass. Check back shortly.</KitEmpty></Panel>
      )}

      {phase === "ready" && (
        <>
          <Panel
            eyebrow="National heat map"
            title={metric === "per_100k" ? "Judges per 100,000 residents" : "Sitting judges on file"}
            pad={16}
            className="cyr-rise"
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
              <MetricSeg value={metric} onChange={setMetric} options={[
                { value: "judges", label: "Total judges" },
                { value: "per_100k", label: "Per 100,000 residents", disabled: !hasPop },
              ]} />
              <div style={{ fontSize: 13, color: C.muted }}>Tap or click any state to open its courts.</div>
            </div>
            <div style={{ overflowX: "hidden" }}>
              <USAHeatMap
                values={values}
                onSelect={onSelectState}
                format={(v) => metric === "per_100k" ? `${Number(v).toFixed(2)} per 100k` : `${fmtInt(v)} judges`}
                legendLow="Fewest judges on file"
                legendHigh="Most"
                legendLabel={metric === "per_100k" ? "(per 100,000 residents)" : "(sitting judges)"}
              />
            </div>
          </Panel>

          <Panel
            eyebrow="Every state"
            title={metric === "per_100k" ? "Every state, ranked by judges per 100,000 residents" : "Every state, ranked by sitting judges on file"}
            pad={12}
          >
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))", gap: 8 }}>
              {ranked.map((s, i) => {
                const v = Number(s[metricKey] || 0);
                return (
                  <RankRow key={s.state_abbr} rank={i + 1}
                    onClick={() => onSelectState(s.state_abbr)}
                    name={STATE_NAMES[s.state_abbr] || s.state_abbr}
                    badge={s.state_abbr}
                    primary={`${fmtInt(s.judges)} judges`}
                    secondary={s.per_100k != null ? `${Number(s.per_100k).toFixed(2)} per 100k` : ""}
                    share={maxVal > 0 ? v / maxVal : 0}
                  />
                );
              })}
            </div>
          </Panel>

          <Panel eyebrow="Search" title="Find a judge by name or court" pad={16}>
            <NationalJudges hideHeader onSelectJudge={onSelectJudge} />
          </Panel>
        </>
      )}

      <SourceNote>
        Source: the Free Law Project's CourtListener judge database, refreshed daily. Coverage
        reflects what CourtListener publishes: complete for supreme and appellate courts, growing
        for trial courts. A light state means fewer judges on file there, which is a public
        records gap, not a measure of the state's judiciary.
      </SourceNote>
    </Wrap>
  );
}

function StateView({ state, onBack, onSelectCounty, onSelectJudge }) {
  const [phase, setPhase] = useState("loading");
  const [data, setData] = useState(null);
  const [shapes, setShapes] = useState(null);
  const [errorDetail, setErrorDetail] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setPhase("loading");
    Promise.all([
      fetch(`/api/state-judges?state=${state}`).then(r => r.json()).catch(() => null),
      loadCountyShapes(state).catch(() => null),
    ]).then(([d, sh]) => {
      if (cancelled) return;
      if (!d || d.ready === undefined) { setErrorDetail(d?.detail || d?.error || "no response"); setPhase("error"); return; }
      if (!d.ready) { setPhase("notready"); return; }
      setData(d);
      setShapes(sh);
      setPhase("ready");
    });
    return () => { cancelled = true; };
  }, [state]);

  const stateName = STATE_NAMES[state] || state;
  const back = <BackBar onClick={onBack} label="All states" trail={[stateName]} />;

  if (phase === "loading") return <Wrap>{back}<Loading rows={4} height={90} /></Wrap>;
  if (phase === "error") return (
    <Wrap>{back}
      <ErrorBox>Could not load this state.{errorDetail && <Mono>{errorDetail}</Mono>}</ErrorBox>
    </Wrap>
  );
  if (phase === "notready") return (
    <Wrap>{back}
      <PageHero compact eyebrow="Know Your Judge" title={stateName} />
      <Panel>
        <KitEmpty icon="🗺️" title="No courts mapped yet">
          No courts are mapped for {stateName} yet. The court location pass runs daily; this fills
          in as CourtListener's coverage and the mapping grow. That is a public records gap, not a
          statement about {stateName}'s courts.
        </KitEmpty>
      </Panel>
    </Wrap>
  );

  const { statewide, counties, unlocated } = data;
  const values = {};
  const countyNames = {};
  for (const c of counties) { values[c.county_fips] = c.judge_count; countyNames[c.county_fips] = c.county_name; }
  const rankedCounties = [...counties].sort((a, b) => b.judge_count - a.judge_count);
  const maxCounty = rankedCounties.length ? Number(rankedCounties[0].judge_count || 0) : 0;

  return (
    <Wrap>
      {back}
      <PageHero
        compact
        eyebrow="Know Your Judge"
        title={stateName}
        lede="Statewide courts first, then the county map. Click a county for its courts and judges."
        chips={[
          { value: statewide.length || null, label: statewide.length === 1 ? "statewide court" : "statewide courts" },
          { value: counties.length || null, label: counties.length === 1 ? "county with courts" : "counties with courts" },
          { value: unlocated.length || null, label: "courts not yet mapped" },
        ]}
      />

      <Panel eyebrow="Top of the system" title="Statewide courts" pad={statewide.length ? 12 : 20}>
        {statewide.length === 0
          ? <Muted>No statewide courts on file yet for this state.</Muted>
          : <div style={{ display: "grid", gap: 12 }}>
              {statewide.map(court => (
                <CourtBlock key={court.cl_id} court={court} onSelectJudge={onSelectJudge} />
              ))}
            </div>}
      </Panel>

      {shapes && counties.length > 0 && (
        <Panel eyebrow="County heat map" title={`${stateName} by county`} pad={16}>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 10 }}>Tap or click a county to open its courts.</div>
          <div style={{ overflowX: "hidden" }}>
            <USAHeatMap
              regions={shapes.counties}
              viewBox={shapes.viewBox}
              ariaLabel={`${stateName} county heat map`}
              values={values}
              onSelect={(fips) => onSelectCounty({ fips, name: countyNames[fips] || shapes.counties[fips]?.name })}
              format={(v) => `${fmtInt(v)} judges`}
              legendLow="Fewest judges on file"
              legendHigh="Most"
              legendLabel="(judges at courts seated in the county)"
            />
          </div>
        </Panel>
      )}

      <Panel eyebrow="Local courts" title="Counties with courts on file" pad={rankedCounties.length ? 12 : 20}>
        {rankedCounties.length === 0
          ? <Muted>
              No county level courts are mapped for this state yet. CourtListener's trial court
              coverage varies by state; this is a public records gap, not a site failure.
            </Muted>
          : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))", gap: 8 }}>
              {rankedCounties.map((c, i) => (
                <RankRow key={c.county_fips} rank={i + 1}
                  onClick={() => onSelectCounty({ fips: c.county_fips, name: c.county_name })}
                  name={`${c.county_name} County`}
                  primary={`${fmtInt(c.judge_count)} judges`}
                  secondary={`${fmtInt(c.court_count)} courts`}
                  share={maxCounty > 0 ? Number(c.judge_count || 0) / maxCounty : 0}
                />
              ))}
            </div>}
      </Panel>

      {unlocated.length > 0 && (
        <Panel eyebrow="Flagged" title="Courts not yet mapped to a county" pad={12}>
          <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, padding: "2px 4px 10px" }}>
            These courts' official names do not name a county, so they are flagged here rather
            than pinned to a guessed location.
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            {unlocated.map(c => (
              <div key={c.cl_id} className="cyr-row" style={{ padding: "10px 12px" }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: C.ink }}>{c.full_name}</span>
                <span className="cyr-chip" style={{ flexShrink: 0 }}>{fmtInt(c.judge_count)} judges</span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {state === "CO" && (
        <Panel eyebrow="Colorado only" title="Colorado retention elections and performance evaluations" pad={16}>
          <KnowYourJudge />
        </Panel>
      )}
    </Wrap>
  );
}

function CountyView({ state, county, onBack, onSelectJudge }) {
  const [phase, setPhase] = useState("loading");
  const [data, setData] = useState(null);
  const [errorDetail, setErrorDetail] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setPhase("loading");
    fetch(`/api/county-courts?state=${state}&fips=${county.fips}`)
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        if (!d || d.ready === undefined) { setErrorDetail(d?.detail || d?.error || "no response"); setPhase("error"); return; }
        setData(d);
        setPhase("ready");
      })
      .catch(err => { if (!cancelled) { setErrorDetail(String(err.message || err)); setPhase("error"); } });
    return () => { cancelled = true; };
  }, [state, county.fips]);

  const stateName = STATE_NAMES[state] || state;
  const back = <BackBar onClick={onBack} label={stateName} trail={[stateName, `${county.name} County`]} />;

  if (phase === "loading") return <Wrap>{back}<Loading rows={4} height={90} /></Wrap>;
  if (phase === "error") return (
    <Wrap>{back}
      <ErrorBox>Could not load this county.{errorDetail && <Mono>{errorDetail}</Mono>}</ErrorBox>
    </Wrap>
  );

  const courts = data.courts || [];
  const judgeTotal = courts.reduce((n, c) => n + (Array.isArray(c.judges) ? c.judges.length : 0), 0);

  // Group courts by city; courts without a recorded city group under the
  // county heading itself.
  const byCity = new Map();
  for (const court of courts) {
    const key = court.city || `${county.name} County`;
    if (!byCity.has(key)) byCity.set(key, []);
    byCity.get(key).push(court);
  }

  return (
    <Wrap>
      {back}
      <PageHero
        compact
        eyebrow={stateName}
        title={`${county.name} County, ${stateName}`}
        lede={`${fmtInt(courts.length)} courts on file, grouped by city.`}
        chips={[
          { value: courts.length || null, label: courts.length === 1 ? "court" : "courts" },
          { value: judgeTotal || null, label: "sitting judges" },
        ]}
      />

      {courts.length === 0 && (
        <Panel>
          <KitEmpty icon="🏛️" title="No courts on file yet">
            No courts are on file for this county yet. CourtListener's trial court coverage varies
            by state and grows over time; this is a public records gap, not a site failure.
          </KitEmpty>
        </Panel>
      )}

      {[...byCity.entries()].map(([city, cityCourts]) => (
        <Panel key={city} eyebrow="Courts in" title={city} pad={12}>
          <div style={{ display: "grid", gap: 12 }}>
            {cityCourts.map(court => (
              <CourtBlock key={court.cl_id} court={court} onSelectJudge={onSelectJudge} />
            ))}
          </div>
        </Panel>
      ))}
    </Wrap>
  );
}

// One court: name, city, plain language explanation, and its judges.
function CourtBlock({ court, onSelectJudge }) {
  const judges = Array.isArray(court.judges) ? court.judges : [];
  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 16, background: C.soft, padding: 14 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <span aria-hidden style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, display: "grid", placeItems: "center",
                                   fontSize: 19, background: "linear-gradient(135deg,#E8F0FF,#D6E4FF)", border: "1px solid #C9D7F2" }}>🏛️</span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: "var(--cyr-display)", fontWeight: 750, fontSize: 17.5, color: C.navy, lineHeight: 1.25 }}>
            {court.full_name}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
            {JURISDICTION_LABELS[court.jurisdiction] && <span className="cyr-chip">{JURISDICTION_LABELS[court.jurisdiction]}</span>}
            {court.city && <span className="cyr-chip" style={{ background: "#FFF6DD", color: "#8A5A00" }}>📍 {court.city}</span>}
            <span className="cyr-chip" style={{ background: "#fff", border: `1px solid ${C.line}`, color: C.muted }}>
              {judges.length} {judges.length === 1 ? "judge" : "judges"}
            </span>
          </div>
        </div>
      </div>
      <div style={{ fontSize: 13.5, color: "#475569", lineHeight: 1.6, margin: "10px 0 12px" }}>
        {courtExplanation(court)}
      </div>
      {judges.length === 0
        ? <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, background: "#fff", borderRadius: 12, padding: "10px 12px", border: `1px dashed ${C.line}` }}>
            No sitting judges on file for this court yet, a public records gap that fills in as
            CourtListener's coverage grows.
          </div>
        : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 230px), 1fr))", gap: 8 }}>
            {judges.map(j => (
              <JudgeCard key={j.cl_person_id} onClick={() => onSelectJudge(j)}
                name={j.full_name}
                sub={`${j.position_title || "Judge"}${j.date_start ? ` · since ${String(j.date_start).slice(0, 4)}` : ""}`} />
            ))}
          </div>}
    </div>
  );
}

const OPINION_TYPE_LABELS = {
  "010combined": "Combined opinion", "015unamimous": "Unanimous opinion",
  "020lead": "Lead opinion", "025plurality": "Plurality opinion",
  "030concurrence": "Concurrence", "035concurrenceinpart": "Concurrence in part",
  "040dissent": "Dissent", "050addendum": "Addendum", "060remittitur": "Remittitur",
  "070rehearing": "Rehearing", "080onthemerits": "Opinion on the merits",
};

function JudgeProfile({ judgeRow, onBack }) {
  const [phase, setPhase] = useState("loading");
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setPhase("loading");
    fetch(`/api/national-judge-detail?personId=${encodeURIComponent(judgeRow.cl_person_id)}`)
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        setData(d && d.ready ? d : null);
        setPhase("ready");
      })
      .catch(() => { if (!cancelled) { setData(null); setPhase("ready"); } });
    return () => { cancelled = true; };
  }, [judgeRow.cl_person_id]);

  const judge = data?.judge || judgeRow;
  const stats = data?.stats || null;
  const recent = data?.recentOpinions || [];
  const startDate = judge.date_start ? String(judge.date_start).slice(0, 10) : null;
  const clUrl = `https://www.courtlistener.com/person/${judge.cl_person_id}/${judge.slug || "judge"}/`;
  const notInFeed = "Not yet in the public feed for this court";

  return (
    <Wrap>
      <BackBar onClick={onBack} label="Back" />

      <PageHero compact eyebrow="Judge profile">
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 10, flexWrap: "wrap" }}>
          <Initials name={judge.full_name} size={60} light />
          <div style={{ minWidth: 0, flex: "1 1 220px" }}>
            <h1 className="cyr-h1" style={{ fontSize: "clamp(26px, 3.8vw, 38px)", margin: 0 }}>{judge.full_name}</h1>
            <div style={{ fontSize: 15, color: "rgba(255,255,255,.86)", marginTop: 6, lineHeight: 1.5 }}>
              {judge.court_name || "Court not on record"}
              {judge.position_title ? ` · ${judge.position_title}` : ""}
              {startDate ? ` · serving since ${startDate}` : ""}
            </div>
          </div>
        </div>
        {stats && stats.total_opinions != null && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
            <div className="cyr-hero-chip">
              <span className="cyr-num" style={{ fontSize: 20 }}>{fmtInt(stats.total_opinions)}</span>
              <span style={{ fontSize: 12.5, color: "rgba(255,255,255,.85)" }}>authored opinions on file</span>
            </div>
          </div>
        )}
      </PageHero>

      <div className="cyr-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", alignItems: "start", gap: 18 }}>
        <Panel eyebrow="Seat" title="Position" pad={8} style={{ marginBottom: 0 }}>
          <Row label="Court" value={judge.court_name || "Not on record"} />
          <Row label="State" value={STATE_NAMES[judge.state_abbr] || judge.state_abbr || "Not on record"} />
          {judge.county_name && <Row label="County" value={`${judge.county_name} County`} />}
          {judge.city && <Row label="Seat" value={judge.city} />}
          <Row label="Title" value={judge.position_title || "Judge"} />
          <Row label="Serving since" value={startDate || "Not on record"} last />
        </Panel>

        <Panel eyebrow="Public record" title="Ruling record" pad={16} style={{ marginBottom: 0 }}>
          <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, background: C.sky, borderRadius: 12, padding: "10px 12px", marginBottom: 14 }}>
            Raw public record counts from opinions this judge authored, as published by
            CourtListener. These are counts, not a score, grade, or ranking.
          </div>
          {phase === "loading" && <Loading rows={2} height={56} />}
          {phase === "ready" && !stats && (
            <Muted>
              No authored opinions on file for this judge yet. CourtListener's opinion coverage
              varies by court, strongest for supreme and appellate courts, and the nightly sync
              keeps collecting; an empty record here reflects that coverage, not the judge.
            </Muted>
          )}
          {phase === "ready" && stats && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 120px), 1fr))", gap: 8, marginBottom: 10 }}>
                <MiniStat label="Total opinions" value={fmtInt(stats.total_opinions)} tone={C.navy} />
                <MiniStat label="Majority or lead" value={fmtInt(stats.majority_count)} tone={C.blue} />
                <MiniStat label="Concurrences" value={fmtInt(stats.concurrence_count)} tone="#7C3AED" />
                <MiniStat label="Dissents" value={fmtInt(stats.dissent_count)} tone="#B7791F" />
                {Number(stats.other_count) > 0 && <MiniStat label="Other filings" value={fmtInt(stats.other_count)} tone="#0891B2" />}
              </div>
              <Row label="Affirmed / reversed"
                value={stats.affirmed_count != null || stats.reversed_count != null
                  ? `${fmtInt(stats.affirmed_count)} / ${fmtInt(stats.reversed_count)}`
                  : notInFeed} />
              <Row label="Average citations"
                value={stats.avg_citations != null ? Number(stats.avg_citations).toFixed(1) : notInFeed}
                last={!stats.first_opinion_date} />
              {stats.first_opinion_date && (
                <Row label="Opinions span" last
                  value={`${String(stats.first_opinion_date).slice(0, 10)} to ${String(stats.last_opinion_date).slice(0, 10)}`} />
              )}
            </>
          )}
        </Panel>
      </div>

      {recent.length > 0 && (
        <Panel eyebrow="Latest filings" title="Most recent opinions" pad={12} style={{ marginTop: 18 }}>
          <div style={{ display: "grid", gap: 6 }}>
            {recent.map(o => (
              <a key={o.cl_opinion_id} href={o.url || clUrl} target="_blank" rel="noopener noreferrer"
                className="cyr-row" style={{ textDecoration: "none", padding: "10px 12px", flexWrap: "wrap", rowGap: 6 }}>
                <span aria-hidden style={{ fontSize: 16, flexShrink: 0 }}>📄</span>
                <span style={{ flex: "1 1 200px", minWidth: 0, fontSize: 14, color: C.navy, fontWeight: 700, lineHeight: 1.35 }}>
                  {o.case_name || "Untitled opinion"}
                </span>
                <span style={{ display: "inline-flex", gap: 6, alignItems: "center", flexShrink: 0, flexWrap: "wrap" }}>
                  <span className="cyr-chip" style={{ fontSize: 11 }}>{OPINION_TYPE_LABELS[o.opinion_type] || "Opinion"}</span>
                  {o.date_filed && <span style={{ fontSize: 12.5, color: C.muted }} className="cyr-num">{String(o.date_filed).slice(0, 10)}</span>}
                </span>
              </a>
            ))}
          </div>
        </Panel>
      )}

      <div className="cyr-card" style={{ marginTop: recent.length ? 0 : 18, padding: "18px 20px", display: "flex", flexWrap: "wrap", gap: 14,
                                         alignItems: "center", justifyContent: "space-between", background: "linear-gradient(120deg,#FFFFFF,#EEF4FF)" }}>
        <div style={{ minWidth: 0, flex: "1 1 260px" }}>
          <div className="cyr-h2" style={{ fontSize: 18 }}>The full record lives on CourtListener</div>
          <div style={{ fontSize: 13.5, color: "#475569", marginTop: 4 }}>Biography, every opinion, and career history from the Free Law Project.</div>
        </div>
        <a href={clUrl} target="_blank" rel="noopener noreferrer" className="cyr-btn cyr-btn-primary"
          style={{ whiteSpace: "normal", textAlign: "center" }}>
          All opinions and biography on CourtListener{"\u00a0"}→
        </a>
      </div>
    </Wrap>
  );
}

// ---------- local presentation helpers ----------

function Wrap({ children }) {
  return <div style={{ fontFamily: sans, color: C.ink, maxWidth: 1000, margin: "0 auto", minWidth: 0 }}>{children}</div>;
}

function BackBar({ onClick, label, trail }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
      <button onClick={onClick} className="cyr-btn cyr-btn-ghost" style={{ minHeight: 40 }}>
        <span aria-hidden>←</span> {label}
      </button>
      {trail && trail.length > 0 && (
        <nav aria-label="Breadcrumb" style={{ fontSize: 13, color: C.muted, display: "flex", gap: 6, flexWrap: "wrap", minWidth: 0 }}>
          <span>All states</span>
          {trail.map((t, i) => (
            <React.Fragment key={i}>
              <span aria-hidden style={{ color: "#94A3B8" }}>/</span>
              <span style={{ color: i === trail.length - 1 ? C.navy : C.muted, fontWeight: i === trail.length - 1 ? 700 : 500 }}>{t}</span>
            </React.Fragment>
          ))}
        </nav>
      )}
    </div>
  );
}

// Segmented pill switch that also supports a disabled option (Seg in the
// kit has no disabled state, and the per capita view needs one).
function MetricSeg({ options, value, onChange }) {
  return (
    <div className="cyr-seg cyr-seg-sm" role="tablist" style={{ flexShrink: 0 }}>
      {options.map(o => (
        <button key={o.value} type="button" role="tab" aria-pressed={o.value === value} aria-selected={o.value === value}
          disabled={o.disabled} style={{ opacity: o.disabled ? 0.5 : 1, minHeight: 34 }}
          onClick={() => !o.disabled && onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function RankRow({ rank, name, badge, primary, secondary, share, onClick }) {
  return (
    <button onClick={onClick} className="cyr-row"
      style={{ width: "100%", textAlign: "left", cursor: "pointer", fontFamily: sans, padding: "10px 12px", minHeight: 52 }}>
      <span className="cyr-num" style={{ width: 28, flexShrink: 0, textAlign: "center", fontSize: 13, color: "#94A3B8" }}>{rank}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "flex", alignItems: "baseline", gap: 8, justifyContent: "space-between" }}>
          <span style={{ fontSize: 14.5, fontWeight: 700, color: C.navy, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
            {name}
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.ink, whiteSpace: "nowrap", flexShrink: 0 }}>{primary}</span>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
          <span style={{ flex: 1, height: 6, borderRadius: 99, background: "#EEF2F8", overflow: "hidden", minWidth: 0 }}>
            <span style={{ display: "block", height: "100%", width: `${Math.max(2, Math.round(share * 100))}%`, borderRadius: 99,
                           background: "linear-gradient(90deg,#2563EB,#0E2A6B)" }} />
          </span>
          {secondary && <span style={{ fontSize: 12, color: C.muted, whiteSpace: "nowrap", flexShrink: 0 }}>{secondary}</span>}
          {badge && <span className="cyr-chip" style={{ fontSize: 10.5, padding: "2px 7px", flexShrink: 0 }}>{badge}</span>}
        </span>
      </span>
      <span aria-hidden style={{ color: "#94A3B8", fontSize: 18, flexShrink: 0 }}>›</span>
    </button>
  );
}

function Initials({ name, size = 38, light }) {
  const parts = String(name || "").replace(/[^A-Za-z\s.'-]/g, "").split(/\s+/).filter(p => p && /[A-Za-z]/.test(p[0]));
  const ini = ((parts[0] || "")[0] || "") + ((parts.length > 1 ? parts[parts.length - 1] : "")[0] || "");
  return (
    <span aria-hidden style={{ width: size, height: size, borderRadius: size * 0.32, flexShrink: 0, display: "grid", placeItems: "center",
                               fontFamily: "var(--cyr-display)", fontWeight: 800, fontSize: size * 0.38,
                               background: light ? "rgba(255,255,255,.16)" : "linear-gradient(135deg,#0E2A6B,#2563EB)",
                               border: light ? "1px solid rgba(255,255,255,.35)" : "none", color: "#fff" }}>
      {ini.toUpperCase() || "J"}
    </span>
  );
}

function JudgeCard({ name, sub, onClick }) {
  return (
    <button onClick={onClick} className="cyr-row"
      style={{ width: "100%", textAlign: "left", cursor: "pointer", fontFamily: sans, padding: "10px 12px", minHeight: 56 }}>
      <Initials name={name} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: C.navy, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
        <span style={{ display: "block", fontSize: 12.5, color: C.muted, marginTop: 1 }}>{sub}</span>
      </span>
      <span aria-hidden style={{ color: C.blue, fontSize: 18, flexShrink: 0 }}>›</span>
    </button>
  );
}

function MiniStat({ label, value, tone }) {
  return (
    <div style={{ background: C.soft, border: `1px solid ${C.line}`, borderRadius: 14, padding: "12px 12px 10px", minWidth: 0 }}>
      <div className="cyr-num" style={{ fontSize: 24, color: tone, lineHeight: 1.05 }}>{value}</div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: C.ink, marginTop: 4 }}>{label}</div>
    </div>
  );
}

function Row({ label, value, last }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 132px) minmax(0, 1fr)", gap: 12, padding: "11px 12px",
                  borderBottom: last ? "none" : "1px solid #EEF2F8", fontFamily: sans, alignItems: "baseline" }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: C.muted }}>{label}</span>
      <span style={{ fontSize: 14, color: C.ink, fontWeight: 600, overflowWrap: "break-word", minWidth: 0 }}>{value}</span>
    </div>
  );
}

function Muted({ children }) {
  return <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.65 }}>{children}</div>;
}

function SourceNote({ children }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 12.5, color: C.muted, lineHeight: 1.65,
                  marginTop: 6, padding: "12px 14px", borderRadius: 14, background: "#F1F5FB" }}>
      <span aria-hidden style={{ fontSize: 14 }}>ℹ️</span>
      <span style={{ minWidth: 0 }}>{children}</span>
    </div>
  );
}

function Mono({ children }) {
  return <div style={{ fontSize: 11.5, color: C.muted, marginTop: 6, fontFamily: "var(--cyr-mono)", fontWeight: 500, overflowWrap: "anywhere" }}>{children}</div>;
}
