// =============================================================================
// BenefitMap.jsx - the shared national benefit heat map: a US state
// choropleth with a ranked state table and a per-state drilldown to every
// county and city (Census "place"). SnapMap and MedicaidMap are thin
// wrappers that point this at their own endpoints and wording.
//
// Both APIs return the same generic row shape: universe_total (the
// denominator population), benefit_count (people or households receiving
// the benefit), and benefit_percent.
// =============================================================================
import React, { useState, useEffect, useCallback } from "react";
import USAHeatMap from "./USAHeatMap.jsx";

const C = {
  navy: "#0A1A3F", gold: "#C9A227", crimson: "#8B0000", parchment: "#FBF7EC",
  ink: "#1A1A1A", muted: "#5C5347", line: "#D8C9A0",
};
const serif = "Georgia, 'Times New Roman', serif";

const fmtInt = (n) => (n == null ? "n/a" : Number(n).toLocaleString());
const fmtPct = (n) => (n == null ? "n/a" : `${Number(n).toFixed(1)}%`);

export default function BenefitMap({ config }) {
  const [phase, setPhase] = useState("loading"); // loading | ready | notready | error
  const [states, setStates] = useState([]);
  const [dataYear, setDataYear] = useState(null);
  const [selected, setSelected] = useState(null); // state abbr
  const [errorDetail, setErrorDetail] = useState(null);

  const load = useCallback(async () => {
    setPhase("loading");
    try {
      const r = await fetch(config.nationalUrl);
      const d = await r.json().catch(() => null);
      if (!r.ok || !d || d.ready === undefined) {
        setErrorDetail(d?.detail || d?.error || `HTTP ${r.status}`);
        setPhase("error");
        return;
      }
      if (!d.ready) { setPhase("notready"); return; }
      setStates(d.states || []);
      setDataYear(d.dataYear);
      setPhase("ready");
    } catch (err) {
      setErrorDetail(String(err.message || err));
      setPhase("error");
    }
  }, [config.nationalUrl]);

  useEffect(() => { load(); }, [load]);

  if (selected) {
    return <StateDetail config={config} state={selected} onBack={() => setSelected(null)} />;
  }

  const values = {};
  for (const s of states) values[s.state_abbr] = s.benefit_percent == null ? null : Number(s.benefit_percent);
  const ranked = [...states].sort((a, b) => Number(b.benefit_percent || 0) - Number(a.benefit_percent || 0));

  return (
    <div style={{ fontFamily: serif, color: C.ink, maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ background: C.navy, color: "#fff", padding: "22px 24px", borderRadius: 8,
                    border: `3px solid ${C.gold}`, marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, color: C.gold, textTransform: "uppercase", marginBottom: 8 }}>
          {config.title}
        </div>
        <div style={{ fontSize: 14, color: "#cfd6e4", lineHeight: 1.6 }}>
          {config.tagline}
          {dataYear ? ` Data: Census American Community Survey, ${dataYear} five year estimates.` : ""}
          {" "}Click any state for its full breakdown by county and by city or town.
        </div>
      </div>

      {phase === "loading" && <Center>Loading the national map...</Center>}
      {phase === "error" && (
        <Center color={C.crimson}>
          Could not load the data. <Link onClick={load}>Try again</Link>
          {errorDetail && (
            <div style={{ fontSize: 11.5, color: C.muted, marginTop: 8, fontFamily: "monospace" }}>{errorDetail}</div>
          )}
        </Center>
      )}
      {phase === "notready" && <Center>This database is not loaded yet. Check back shortly.</Center>}

      {phase === "ready" && (
        <>
          <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 8, padding: 18, marginBottom: 18 }}>
            <USAHeatMap
              values={values}
              onSelect={setSelected}
              format={fmtPct}
              legendLow={config.legendLow}
              legendHigh="Most"
              legendLabel={config.legendLabel}
            />
          </div>

          <Section title={config.rankTitle}>
            <RowHeader cols={["State", config.countLabel, config.universeLabel, "Share"]} />
            {ranked.map(s => (
              <button key={s.state_abbr} onClick={() => setSelected(s.state_abbr)}
                style={{ display: "flex", width: "100%", textAlign: "left", alignItems: "center", gap: 12,
                         padding: "9px 14px", background: "transparent", border: "none",
                         borderBottom: "1px solid #f0ead8", cursor: "pointer", fontFamily: serif }}>
                <span style={{ flex: 2, fontSize: 13.5, fontWeight: 700, color: C.navy }}>{s.name}</span>
                <span style={{ flex: 1.4, fontSize: 13, color: C.ink, textAlign: "right" }}>{fmtInt(s.benefit_count)}</span>
                <span style={{ flex: 1.4, fontSize: 13, color: C.muted, textAlign: "right" }}>{fmtInt(s.universe_total)}</span>
                <span style={{ flex: 0.8, fontSize: 13, fontWeight: 700, color: C.crimson, textAlign: "right" }}>{fmtPct(s.benefit_percent)}</span>
              </button>
            ))}
          </Section>
        </>
      )}

      <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.6, marginTop: 18 }}>
        {config.sourceNote}
      </p>
    </div>
  );
}

function StateDetail({ config, state, onBack }) {
  const [phase, setPhase] = useState("loading");
  const [data, setData] = useState(null);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [errorDetail, setErrorDetail] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setPhase("loading");
    const sep = config.detailUrl.includes("?") ? "&" : "?";
    const p = new URLSearchParams({ state });
    if (search) p.set("q", search);
    fetch(`${config.detailUrl}${sep}${p}`)
      .then(async r => ({ ok: r.ok, status: r.status, d: await r.json().catch(() => null) }))
      .then(({ ok, status, d }) => {
        if (cancelled) return;
        if (!ok || !d || d.ready === undefined) {
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
  }, [config.detailUrl, state, search]);

  const back = (
    <button onClick={onBack}
      style={{ fontFamily: serif, fontSize: 13, fontWeight: 700, color: C.navy, background: "none",
               border: `1px solid ${C.line}`, borderRadius: 6, padding: "6px 14px", cursor: "pointer", marginBottom: 16 }}>
      ← National map
    </button>
  );

  if (phase === "loading") return <div style={{ fontFamily: serif, maxWidth: 1000, margin: "0 auto" }}>{back}<Center>Loading state breakdown...</Center></div>;
  if (phase === "error") return (
    <div style={{ fontFamily: serif, maxWidth: 1000, margin: "0 auto" }}>
      {back}
      <Center color={C.crimson}>
        Could not load this state.
        {errorDetail && (
          <div style={{ fontSize: 11.5, color: C.muted, marginTop: 8, fontFamily: "monospace" }}>{errorDetail}</div>
        )}
      </Center>
    </div>
  );
  if (phase === "notready") return <div style={{ fontFamily: serif, maxWidth: 1000, margin: "0 auto" }}>{back}<Center>This database is not loaded yet.</Center></div>;

  const { summary, counties, places, totalPlaces, dataYear } = data;

  return (
    <div style={{ fontFamily: serif, color: C.ink, maxWidth: 1000, margin: "0 auto" }}>
      {back}

      <div style={{ background: C.navy, color: "#fff", padding: "20px 24px", borderRadius: 8,
                    border: `3px solid ${C.gold}`, marginBottom: 18 }}>
        <div style={{ fontSize: 20, fontWeight: 900 }}>{summary.name}</div>
        <div style={{ fontSize: 13, color: "#cfd6e4", marginTop: 6, lineHeight: 1.6 }}>
          {fmtInt(summary.benefit_count)} of {fmtInt(summary.universe_total)} {config.summaryUnits} ({fmtPct(summary.benefit_percent)}).
          Census ACS 5-year estimates, {dataYear}.
        </div>
      </div>

      <Section title="By county">
        <RowHeader cols={["County", config.countLabel, config.universeLabel, "Share"]} />
        {counties.length === 0
          ? <Empty>No county data on record for this state.</Empty>
          : counties.map(c => <DataRow key={c.geoid} row={c} />)}
      </Section>

      <Section title={`By city and town (${fmtInt(totalPlaces)} places on record)`}>
        <div style={{ display: "flex", gap: 8, padding: "12px 14px", borderBottom: "1px solid #f0ead8" }}>
          <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && setSearch(searchInput.trim())}
            placeholder="Search cities and towns"
            style={{ flex: 1, fontFamily: serif, fontSize: 13.5, padding: "8px 11px",
                     border: `1px solid ${C.line}`, borderRadius: 5 }} />
          <button onClick={() => setSearch(searchInput.trim())}
            style={{ fontFamily: serif, fontWeight: 700, fontSize: 13, padding: "8px 16px",
                     background: C.crimson, color: "#fff", border: "none", borderRadius: 5, cursor: "pointer" }}>
            Search
          </button>
        </div>
        <RowHeader cols={["City / town", config.countLabel, config.universeLabel, "Share"]} />
        {places.length === 0
          ? <Empty>No places match that search.</Empty>
          : places.map(p => <DataRow key={p.geoid} row={p} />)}
        {!search && totalPlaces > places.length && (
          <div style={{ padding: "10px 14px", fontSize: 12, color: C.muted }}>
            Showing the {places.length} places with the highest counts. Use the search to find any other city or town.
          </div>
        )}
      </Section>
    </div>
  );
}

function DataRow({ row }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 14px",
                  borderBottom: "1px solid #f0ead8", fontFamily: serif }}>
      <span style={{ flex: 2, fontSize: 13, color: C.ink }}>{row.name.replace(/, [A-Za-z ]+$/, "")}</span>
      <span style={{ flex: 1.4, fontSize: 13, color: C.ink, textAlign: "right" }}>{fmtInt(row.benefit_count)}</span>
      <span style={{ flex: 1.4, fontSize: 13, color: C.muted, textAlign: "right" }}>{fmtInt(row.universe_total)}</span>
      <span style={{ flex: 0.8, fontSize: 13, fontWeight: 700, color: C.crimson, textAlign: "right" }}>{fmtPct(row.benefit_percent)}</span>
    </div>
  );
}

function RowHeader({ cols }) {
  return (
    <div style={{ display: "flex", gap: 12, padding: "9px 14px", borderBottom: `1px solid ${C.line}`,
                  background: C.parchment, fontFamily: serif }}>
      <span style={{ flex: 2, fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 1, textTransform: "uppercase" }}>{cols[0]}</span>
      <span style={{ flex: 1.4, fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 1, textTransform: "uppercase", textAlign: "right" }}>{cols[1]}</span>
      <span style={{ flex: 1.4, fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 1, textTransform: "uppercase", textAlign: "right" }}>{cols[2]}</span>
      <span style={{ flex: 0.8, fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 1, textTransform: "uppercase", textAlign: "right" }}>{cols[3]}</span>
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
