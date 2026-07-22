// =============================================================================
// KnowYourJudgeNational.jsx - the Know Your Judge tab, one national
// experience. Drill path: national heat map of sitting judges (total or per
// 100,000 residents) -> state view (statewide courts, county heat map,
// flagged unmapped courts, and for Colorado the retention and OJPE
// directory preserved in full) -> county view (courts grouped by city, each
// with a plain language explanation and its sitting judges) -> judge
// profile with the Ruling Record: raw public record counts from
// CourtListener opinions, never a score or grade.
// =============================================================================
import React, { useState, useEffect, useCallback } from "react";
import USAHeatMap from "./USAHeatMap.jsx";
import NationalJudges from "./NationalJudges.jsx";
import KnowYourJudge from "./KnowYourJudge.jsx";

const C = {
  navy: "#0A1A3F", gold: "#C9A227", crimson: "#8B0000", parchment: "#FBF7EC",
  ink: "#1A1A1A", muted: "#5C5347", line: "#D8C9A0",
};
const serif = "Georgia, 'Times New Roman', serif";

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
  const ranked = [...states].sort((a, b) =>
    Number(b[metric === "per_100k" ? "per_100k" : "judges"] || 0) -
    Number(a[metric === "per_100k" ? "per_100k" : "judges"] || 0));

  const pill = (key, label, disabled) => (
    <button key={key} onClick={() => !disabled && setMetric(key)} disabled={disabled}
      style={{ fontFamily: serif, fontSize: 12.5, fontWeight: 700, padding: "7px 16px",
               borderRadius: 18, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1,
               border: `1px solid ${metric === key ? C.navy : C.line}`,
               background: metric === key ? C.navy : "#fff",
               color: metric === key ? C.gold : C.muted }}>
      {label}
    </button>
  );

  return (
    <div style={{ fontFamily: serif, color: C.ink, maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ background: C.navy, color: "#fff", padding: "22px 24px", borderRadius: 8,
                    border: `3px solid ${C.gold}`, marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, color: C.gold, textTransform: "uppercase", marginBottom: 8 }}>
          Know Your Judge
        </div>
        <div style={{ fontSize: 14, color: "#cfd6e4", lineHeight: 1.6 }}>
          The judges of every state{totalJudges ? ` (${fmtInt(totalJudges)} on file)` : ""}, mirrored
          from the Free Law Project's CourtListener database. The map colors each state by its
          sitting judges. Click a state to drill into its courts county by county, down to each
          courthouse and every judge's public ruling record.
        </div>
      </div>

      {phase === "loading" && <Center>Loading the national map...</Center>}
      {phase === "error" && (
        <Center color={C.crimson}>
          Could not load the map. <Link onClick={load}>Try again</Link>
          {errorDetail && <Mono>{errorDetail}</Mono>}
        </Center>
      )}
      {phase === "notready" && <Center>The judge registry is still loading its first pass. Check back shortly.</Center>}

      {phase === "ready" && (
        <>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 12 }}>
            {pill("judges", "Total judges", false)}
            {pill("per_100k", "Per 100,000 residents", !hasPop)}
          </div>
          <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 8, padding: 18, marginBottom: 18 }}>
            <USAHeatMap
              values={values}
              onSelect={onSelectState}
              format={(v) => metric === "per_100k" ? `${Number(v).toFixed(2)} per 100k` : `${fmtInt(v)} judges`}
              legendLow="Fewest judges on file"
              legendHigh="Most"
              legendLabel={metric === "per_100k" ? "(per 100,000 residents)" : "(sitting judges)"}
            />
          </div>

          <Section title={metric === "per_100k" ? "Every state, ranked by judges per 100,000 residents" : "Every state, ranked by sitting judges on file"}>
            {ranked.map(s => (
              <button key={s.state_abbr} onClick={() => onSelectState(s.state_abbr)}
                style={{ display: "flex", width: "100%", textAlign: "left", alignItems: "center", gap: 12,
                         padding: "9px 14px", background: "transparent", border: "none",
                         borderBottom: "1px solid #f0ead8", cursor: "pointer", fontFamily: serif }}>
                <span style={{ flex: 2, fontSize: 13.5, fontWeight: 700, color: C.navy }}>
                  {STATE_NAMES[s.state_abbr] || s.state_abbr}
                </span>
                <span style={{ flex: 1, fontSize: 13, color: C.ink, textAlign: "right" }}>{fmtInt(s.judges)} judges</span>
                <span style={{ flex: 1, fontSize: 13, color: C.muted, textAlign: "right" }}>
                  {s.per_100k != null ? `${Number(s.per_100k).toFixed(2)} per 100k` : ""}
                </span>
              </button>
            ))}
          </Section>

          <Section title="Find a judge by name or court">
            <div style={{ padding: "4px 0 0" }}>
              <NationalJudges hideHeader onSelectJudge={onSelectJudge} />
            </div>
          </Section>
        </>
      )}

      <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.6, marginTop: 18 }}>
        Source: the Free Law Project's CourtListener judge database, refreshed daily. Coverage
        reflects what CourtListener publishes: complete for supreme and appellate courts, growing
        for trial courts. A light state means fewer judges on file there, which is a public
        records gap, not a measure of the state's judiciary.
      </p>
    </div>
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

  const back = <BackButton onClick={onBack}>← All states</BackButton>;
  const stateName = STATE_NAMES[state] || state;

  if (phase === "loading") return <Wrap>{back}<Center>Loading {stateName}...</Center></Wrap>;
  if (phase === "error") return <Wrap>{back}<Center color={C.crimson}>Could not load this state.{errorDetail && <Mono>{errorDetail}</Mono>}</Center></Wrap>;
  if (phase === "notready") return (
    <Wrap>{back}
      <Center>
        No courts are mapped for {stateName} yet. The court location pass runs daily; this fills
        in as CourtListener's coverage and the mapping grow. That is a public records gap, not a
        statement about {stateName}'s courts.
      </Center>
    </Wrap>
  );

  const { statewide, counties, unlocated } = data;
  const values = {};
  const countyNames = {};
  for (const c of counties) { values[c.county_fips] = c.judge_count; countyNames[c.county_fips] = c.county_name; }
  const rankedCounties = [...counties].sort((a, b) => b.judge_count - a.judge_count);

  return (
    <Wrap>
      {back}
      <div style={{ background: C.navy, color: "#fff", padding: "20px 24px", borderRadius: 8,
                    border: `3px solid ${C.gold}`, marginBottom: 18 }}>
        <div style={{ fontSize: 20, fontWeight: 900 }}>{stateName}</div>
        <div style={{ fontSize: 13, color: "#cfd6e4", marginTop: 6, lineHeight: 1.6 }}>
          Statewide courts first, then the county map. Click a county for its courts and judges.
        </div>
      </div>

      <Section title="Statewide courts">
        {statewide.length === 0
          ? <Empty>No statewide courts on file yet for this state.</Empty>
          : statewide.map(court => (
            <CourtBlock key={court.cl_id} court={court} onSelectJudge={onSelectJudge} />
          ))}
      </Section>

      {shapes && counties.length > 0 && (
        <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 8, padding: 18, marginBottom: 18 }}>
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
      )}

      <Section title="Counties with courts on file">
        {rankedCounties.length === 0
          ? <Empty>
              No county level courts are mapped for this state yet. CourtListener's trial court
              coverage varies by state; this is a public records gap, not a site failure.
            </Empty>
          : rankedCounties.map(c => (
            <button key={c.county_fips} onClick={() => onSelectCounty({ fips: c.county_fips, name: c.county_name })}
              style={{ display: "flex", width: "100%", textAlign: "left", alignItems: "center", gap: 12,
                       padding: "9px 14px", background: "transparent", border: "none",
                       borderBottom: "1px solid #f0ead8", cursor: "pointer", fontFamily: serif }}>
              <span style={{ flex: 2, fontSize: 13.5, fontWeight: 700, color: C.navy }}>{c.county_name} County</span>
              <span style={{ flex: 1, fontSize: 13, color: C.muted, textAlign: "right" }}>{fmtInt(c.court_count)} courts</span>
              <span style={{ flex: 1, fontSize: 13, color: C.ink, textAlign: "right" }}>{fmtInt(c.judge_count)} judges</span>
            </button>
          ))}
      </Section>

      {unlocated.length > 0 && (
        <Section title="Courts not yet mapped to a county">
          <div style={{ padding: "10px 14px", fontSize: 12, color: C.muted, lineHeight: 1.6, borderBottom: "1px solid #f0ead8" }}>
            These courts' official names do not name a county, so they are flagged here rather
            than pinned to a guessed location.
          </div>
          {unlocated.map(c => (
            <div key={c.cl_id} style={{ display: "flex", gap: 12, padding: "9px 14px", borderBottom: "1px solid #f0ead8" }}>
              <span style={{ flex: 3, fontSize: 13, color: C.ink }}>{c.full_name}</span>
              <span style={{ flex: 1, fontSize: 13, color: C.muted, textAlign: "right" }}>{fmtInt(c.judge_count)} judges</span>
            </div>
          ))}
        </Section>
      )}

      {state === "CO" && (
        <Section title="Colorado retention elections and performance evaluations">
          <div style={{ padding: "14px" }}>
            <KnowYourJudge />
          </div>
        </Section>
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

  const back = <BackButton onClick={onBack}>← {STATE_NAMES[state] || state}</BackButton>;

  if (phase === "loading") return <Wrap>{back}<Center>Loading {county.name} County...</Center></Wrap>;
  if (phase === "error") return <Wrap>{back}<Center color={C.crimson}>Could not load this county.{errorDetail && <Mono>{errorDetail}</Mono>}</Center></Wrap>;

  const courts = data.courts || [];

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
      <div style={{ background: C.navy, color: "#fff", padding: "20px 24px", borderRadius: 8,
                    border: `3px solid ${C.gold}`, marginBottom: 18 }}>
        <div style={{ fontSize: 20, fontWeight: 900 }}>{county.name} County, {STATE_NAMES[state] || state}</div>
        <div style={{ fontSize: 13, color: "#cfd6e4", marginTop: 6 }}>
          {fmtInt(courts.length)} courts on file, grouped by city.
        </div>
      </div>

      {courts.length === 0 && (
        <Center>
          No courts are on file for this county yet. CourtListener's trial court coverage varies
          by state and grows over time; this is a public records gap, not a site failure.
        </Center>
      )}

      {[...byCity.entries()].map(([city, cityCourts]) => (
        <Section key={city} title={city}>
          {cityCourts.map(court => (
            <CourtBlock key={court.cl_id} court={court} onSelectJudge={onSelectJudge} />
          ))}
        </Section>
      ))}
    </Wrap>
  );
}

// One court: name, city, plain language explanation, and its judges.
function CourtBlock({ court, onSelectJudge }) {
  const judges = Array.isArray(court.judges) ? court.judges : [];
  return (
    <div style={{ borderBottom: "1px solid #f0ead8" }}>
      <div style={{ padding: "12px 14px 4px" }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: C.navy }}>
          {court.full_name}
          {court.city && <span style={{ marginLeft: 8, fontSize: 11.5, fontWeight: 700, color: C.gold }}>{court.city}</span>}
        </div>
        <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.6, margin: "6px 0 8px" }}>
          {courtExplanation(court)}
        </div>
      </div>
      {judges.length === 0
        ? <div style={{ padding: "0 14px 12px", fontSize: 12.5, color: C.muted }}>
            No sitting judges on file for this court yet, a public records gap that fills in as
            CourtListener's coverage grows.
          </div>
        : judges.map(j => (
          <button key={j.cl_person_id} onClick={() => onSelectJudge(j)}
            style={{ display: "flex", width: "100%", textAlign: "left", alignItems: "center", gap: 12,
                     padding: "8px 14px 8px 26px", background: "transparent", border: "none",
                     borderTop: "1px solid #f7f2e4", cursor: "pointer", fontFamily: serif }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: C.navy }}>{j.full_name}</span>
              <span style={{ fontSize: 12, color: C.muted, marginLeft: 8 }}>
                {j.position_title || "Judge"}
                {j.date_start ? ` · since ${String(j.date_start).slice(0, 4)}` : ""}
              </span>
            </div>
            <span style={{ fontSize: 12, color: C.crimson, fontWeight: 700, flexShrink: 0 }}>View →</span>
          </button>
        ))}
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

  return (
    <Wrap>
      <BackButton onClick={onBack}>← Back</BackButton>

      <div style={{ background: C.navy, color: "#fff", padding: "20px 24px", borderRadius: 8,
                    border: `3px solid ${C.gold}`, marginBottom: 18 }}>
        <div style={{ fontSize: 20, fontWeight: 900 }}>{judge.full_name}</div>
        <div style={{ fontSize: 12.5, color: "#cfd6e4", marginTop: 4 }}>
          {judge.court_name || "Court not on record"}
          {judge.position_title ? ` · ${judge.position_title}` : ""}
          {startDate ? ` · serving since ${startDate}` : ""}
        </div>
      </div>

      <Section title="Position">
        <Row label="Court" value={judge.court_name || "Not on record"} />
        <Row label="State" value={STATE_NAMES[judge.state_abbr] || judge.state_abbr || "Not on record"} />
        {judge.county_name && <Row label="County" value={`${judge.county_name} County`} />}
        {judge.city && <Row label="Seat" value={judge.city} />}
        <Row label="Title" value={judge.position_title || "Judge"} />
        <Row label="Serving since" value={startDate || "Not on record"} />
      </Section>

      <Section title="Ruling record">
        <div style={{ padding: "10px 14px", fontSize: 12, color: C.muted, lineHeight: 1.6, borderBottom: "1px solid #f0ead8" }}>
          Raw public record counts from opinions this judge authored, as published by
          CourtListener. These are counts, not a score, grade, or ranking.
        </div>
        {phase === "loading" && <Empty>Loading ruling record...</Empty>}
        {phase === "ready" && !stats && (
          <Empty>
            No authored opinions on file for this judge yet. CourtListener's opinion coverage
            varies by court, strongest for supreme and appellate courts, and the nightly sync
            keeps collecting; an empty record here reflects that coverage, not the judge.
          </Empty>
        )}
        {phase === "ready" && stats && (
          <>
            <Row label="Total opinions" value={fmtInt(stats.total_opinions)} />
            <Row label="Majority or lead" value={fmtInt(stats.majority_count)} />
            <Row label="Concurrences" value={fmtInt(stats.concurrence_count)} />
            <Row label="Dissents" value={fmtInt(stats.dissent_count)} />
            {Number(stats.other_count) > 0 && <Row label="Other filings" value={fmtInt(stats.other_count)} />}
            <Row label="Affirmed / reversed"
              value={stats.affirmed_count != null || stats.reversed_count != null
                ? `${fmtInt(stats.affirmed_count)} / ${fmtInt(stats.reversed_count)}`
                : "Not yet in the public feed for this court"} />
            <Row label="Average citations"
              value={stats.avg_citations != null ? Number(stats.avg_citations).toFixed(1)
                : "Not yet in the public feed for this court"} />
            {stats.first_opinion_date && (
              <Row label="Opinions span"
                value={`${String(stats.first_opinion_date).slice(0, 10)} to ${String(stats.last_opinion_date).slice(0, 10)}`} />
            )}
          </>
        )}
        {recent.length > 0 && (
          <div style={{ borderTop: `1px solid ${C.line}` }}>
            <div style={{ padding: "10px 14px 4px", fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 1, textTransform: "uppercase" }}>
              Most recent opinions
            </div>
            {recent.map(o => (
              <a key={o.cl_opinion_id} href={o.url || clUrl} target="_blank" rel="noopener noreferrer"
                style={{ display: "flex", gap: 12, padding: "8px 14px", borderTop: "1px solid #f7f2e4",
                         textDecoration: "none", fontFamily: serif, alignItems: "baseline" }}>
                <span style={{ flex: 2, fontSize: 13, color: C.navy, fontWeight: 700, minWidth: 0 }}>
                  {o.case_name || "Untitled opinion"}
                </span>
                <span style={{ flex: 1, fontSize: 12, color: C.muted, textAlign: "right", flexShrink: 0 }}>
                  {OPINION_TYPE_LABELS[o.opinion_type] || "Opinion"}
                  {o.date_filed ? ` · ${String(o.date_filed).slice(0, 10)}` : ""}
                </span>
              </a>
            ))}
          </div>
        )}
        <div style={{ padding: "12px 14px", borderTop: `1px solid ${C.line}` }}>
          <a href={clUrl} target="_blank" rel="noopener noreferrer"
            style={{ display: "inline-block", fontFamily: serif, fontSize: 13, fontWeight: 700,
                     color: "#fff", background: C.crimson, borderRadius: 6, padding: "9px 18px",
                     textDecoration: "none" }}>
            All opinions and biography on CourtListener →
          </a>
        </div>
      </Section>
    </Wrap>
  );
}

function Wrap({ children }) {
  return <div style={{ fontFamily: serif, color: C.ink, maxWidth: 1000, margin: "0 auto" }}>{children}</div>;
}
function BackButton({ onClick, children }) {
  return (
    <button onClick={onClick}
      style={{ fontFamily: serif, fontSize: 13, fontWeight: 700, color: C.navy, background: "none",
               border: `1px solid ${C.line}`, borderRadius: 6, padding: "6px 14px", cursor: "pointer", marginBottom: 16 }}>
      {children}
    </button>
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
function Row({ label, value }) {
  return (
    <div style={{ display: "flex", gap: 12, padding: "10px 14px", borderBottom: "1px solid #f0ead8", fontFamily: serif }}>
      <span style={{ flex: "0 0 160px", fontSize: 12, fontWeight: 700, color: C.muted }}>{label}</span>
      <span style={{ flex: 1, fontSize: 13.5, color: C.ink }}>{value}</span>
    </div>
  );
}
function Empty({ children }) {
  return <div style={{ padding: "14px", fontSize: 13, color: C.muted, lineHeight: 1.6 }}>{children}</div>;
}
function Center({ children, color }) {
  return <div style={{ textAlign: "center", padding: 40, color: color || C.muted, fontSize: 14.5, fontFamily: serif, lineHeight: 1.7 }}>{children}</div>;
}
function Mono({ children }) {
  return <div style={{ fontSize: 11.5, color: C.muted, marginTop: 8, fontFamily: "monospace" }}>{children}</div>;
}
function Link({ onClick, children }) {
  return <button onClick={onClick} style={{ background: "none", border: "none", color: C.crimson, fontFamily: serif, fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>{children}</button>;
}
