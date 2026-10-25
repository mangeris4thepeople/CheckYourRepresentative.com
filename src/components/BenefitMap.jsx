// =============================================================================
// BenefitMap.jsx - the shared national benefit heat map: a US state
// choropleth with a ranked state table and a per-state drilldown to every
// county and city (Census "place"). SnapMap and MedicaidMap are thin
// wrappers that point this at their own endpoints and wording.
//
// Both APIs return the same generic row shape: universe_total (the
// denominator population), benefit_count (people or households receiving
// the benefit), and benefit_percent.
//
// October 2026 redesign: intro card, the map inside a white Panel, ranked
// rows with a proportional share bar, and a state page with a StatGrid and
// Panel lists. Presentation only. No em dashes.
// =============================================================================
import React, { useState, useEffect, useCallback } from "react";
import USAHeatMap from "./USAHeatMap.jsx";
import { Panel, StatGrid, Loading, Empty as KitEmpty, ErrorBox } from "./ui/Kit.jsx";

const C = {
  navy: "#0E2A6B", blue: "#2563EB", red: "#E0313F", gold: "#F5B82E",
  ink: "#0F172A", muted: "#5B6578", line: "#E2E8F0", soft: "#F8FAFE",
};

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

  const maxPct = Math.max(...states.map(x => Number(x.benefit_percent) || 0), 1);

  return (
    <div style={{ color: C.ink, maxWidth: 1000, margin: "0 auto", minWidth: 0 }}>
      <div className="cyr-card cyr-rise" style={{ padding: "18px 20px", marginBottom: 16, background: "linear-gradient(120deg,#FFFFFF 45%,#EEF4FF)" }}>
        <div className="cyr-eyebrow" style={{ fontSize: 11 }}>Census American Community Survey</div>
        <h2 className="cyr-h2" style={{ fontSize: "clamp(21px, 2.6vw, 26px)", marginTop: 6 }}>{config.title}</h2>
        <div style={{ fontSize: 14.5, color: "#475569", lineHeight: 1.6, marginTop: 6, maxWidth: 760 }}>
          {config.tagline}
          {dataYear ? ` Data: Census American Community Survey, ${dataYear} five year estimates.` : ""}
          {" "}Click any state for its full breakdown by county and by city or town.
        </div>
      </div>

      {phase === "loading" && <Loading rows={2} height={220} />}
      {phase === "error" && (
        <ErrorBox onRetry={load}>
          Could not load the data.
          {errorDetail && <span style={{ display: "block", fontSize: 11.5, fontWeight: 500, marginTop: 4, fontFamily: "var(--cyr-mono)" }}>{errorDetail}</span>}
        </ErrorBox>
      )}
      {phase === "notready" && <div className="cyr-card"><KitEmpty icon="🗺️" title="Not loaded yet">This database is not loaded yet. Check back shortly.</KitEmpty></div>}

      {phase === "ready" && (
        <>
          <Panel eyebrow="National map" title={`Share by state ${config.legendLabel}`} pad={16}>
            <USAHeatMap
              values={values}
              onSelect={setSelected}
              format={fmtPct}
              legendLow={config.legendLow}
              legendHigh="Most"
              legendLabel={config.legendLabel}
            />
          </Panel>

          <Panel eyebrow="Ranked" title={config.rankTitle} pad={12}>
            <ColumnNote countLabel={config.countLabel} universeLabel={config.universeLabel} />
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 6 }}>
              {ranked.map((s, i) => (
                <button key={s.state_abbr} onClick={() => setSelected(s.state_abbr)} className="cyr-row"
                  style={{ width: "100%", textAlign: "left", cursor: "pointer", fontFamily: "inherit", padding: "10px 12px", gap: 12 }}>
                  <span aria-hidden style={{ width: 26, flexShrink: 0, textAlign: "right", fontSize: 12.5, fontWeight: 800, color: "#94A3B8", fontVariantNumeric: "tabular-nums" }}>{i + 1}</span>
                  <DataBody name={s.name} row={s} maxPct={maxPct} bold />
                  <span aria-hidden style={{ color: "#94A3B8", fontSize: 18, flexShrink: 0 }}>›</span>
                </button>
              ))}
            </div>
          </Panel>
        </>
      )}

      <p style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.6, marginTop: 16 }}>
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
    <button onClick={onBack} className="cyr-btn cyr-btn-ghost" style={{ marginBottom: 16, minHeight: 40 }}>
      <span aria-hidden>←</span> National map
    </button>
  );
  const wrap = { color: C.ink, maxWidth: 1000, margin: "0 auto", minWidth: 0 };

  if (phase === "loading") return <div style={wrap}>{back}<Loading rows={5} height={64} /></div>;
  if (phase === "error") return (
    <div style={wrap}>
      {back}
      <ErrorBox>
        Could not load this state.
        {errorDetail && <span style={{ display: "block", fontSize: 11.5, fontWeight: 500, marginTop: 4, fontFamily: "var(--cyr-mono)" }}>{errorDetail}</span>}
      </ErrorBox>
    </div>
  );
  if (phase === "notready") return <div style={wrap}>{back}<div className="cyr-card"><KitEmpty icon="🗺️">This database is not loaded yet.</KitEmpty></div></div>;

  const { summary, counties, places, totalPlaces, dataYear } = data;
  const maxCounty = Math.max(...counties.map(x => Number(x.benefit_percent) || 0), 1);
  const maxPlace = Math.max(...places.map(x => Number(x.benefit_percent) || 0), 1);

  return (
    <div style={wrap}>
      {back}

      <div className="cyr-card cyr-rise" style={{ padding: 0, overflow: "hidden", marginBottom: 16 }}>
        <div style={{ height: 6, background: "linear-gradient(90deg,#2563EB,#0E2A6B)" }} />
        <div style={{ padding: "18px 22px", background: "linear-gradient(120deg,#FFFFFF 40%,#EEF4FF)" }}>
          <div className="cyr-eyebrow" style={{ fontSize: 11 }}>{config.title}</div>
          <h2 className="cyr-h2" style={{ fontSize: "clamp(24px, 3.4vw, 32px)", marginTop: 4 }}>{summary.name}</h2>
          <div style={{ fontSize: 14, color: "#475569", marginTop: 6, lineHeight: 1.6 }}>
            {fmtInt(summary.benefit_count)} of {fmtInt(summary.universe_total)} {config.summaryUnits} ({fmtPct(summary.benefit_percent)}).
            Census ACS 5-year estimates, {dataYear}.
          </div>
        </div>
      </div>

      <StatGrid min={150} items={[
        { value: fmtPct(summary.benefit_percent), label: "Share", tone: "blue" },
        { value: fmtInt(summary.benefit_count), label: config.countLabel, tone: "navy" },
        { value: fmtInt(summary.universe_total), label: config.universeLabel, tone: "navy" },
      ]} />

      <Panel eyebrow="Counties" title="By county" pad={12}>
        <ColumnNote countLabel={config.countLabel} universeLabel={config.universeLabel} />
        {counties.length === 0
          ? <SmallEmpty>No county data on record for this state.</SmallEmpty>
          : <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 6 }}>
              {counties.map(c => <DataRow key={c.geoid} row={c} maxPct={maxCounty} />)}
            </div>}
      </Panel>

      <Panel eyebrow="Cities and towns" title={`By city and town (${fmtInt(totalPlaces)} places on record)`} pad={12}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
            <span aria-hidden style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 14, opacity: .55 }}>🔎</span>
            <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && setSearch(searchInput.trim())}
              placeholder="Search cities and towns" aria-label="Search cities and towns"
              style={{ width: "100%", fontSize: 14.5, padding: "11px 14px 11px 38px", border: `1px solid ${C.line}`, borderRadius: 999 }} />
          </div>
          <button onClick={() => setSearch(searchInput.trim())} className="cyr-btn cyr-btn-primary" style={{ minHeight: 42 }}>
            Search
          </button>
        </div>
        {places.length === 0
          ? <SmallEmpty>No places match that search.</SmallEmpty>
          : <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 6 }}>
              {places.map(p => <DataRow key={p.geoid} row={p} maxPct={maxPlace} />)}
            </div>}
        {!search && totalPlaces > places.length && (
          <div style={{ padding: "12px 4px 2px", fontSize: 12.5, color: C.muted }}>
            Showing the {places.length} places with the highest counts. Use the search to find any other city or town.
          </div>
        )}
      </Panel>
    </div>
  );
}

function DataRow({ row, maxPct }) {
  return (
    <div className="cyr-row" style={{ padding: "10px 12px" }}>
      <DataBody name={row.name.replace(/, [A-Za-z ]+$/, "")} row={row} maxPct={maxPct} />
    </div>
  );
}

// One ranked line: name and share on top, a proportional bar, then the two
// counts that make the share, so color is never the only way to read it.
function DataBody({ name, row, maxPct, bold }) {
  const pct = Number(row.benefit_percent) || 0;
  return (
    <span style={{ flex: 1, minWidth: 0, display: "block" }}>
      <span style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
        <span style={{ fontSize: 14.5, fontWeight: bold ? 700 : 600, color: C.ink, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
        <span className="cyr-num" style={{ fontSize: 16, color: C.navy, whiteSpace: "nowrap" }}>{fmtPct(row.benefit_percent)}</span>
      </span>
      <span aria-hidden style={{ display: "block", height: 6, borderRadius: 99, background: "#EEF2F8", overflow: "hidden", margin: "6px 0 5px" }}>
        <span style={{ display: "block", height: "100%", width: `${Math.max(1.5, pct / maxPct * 100)}%`, borderRadius: 99, background: "linear-gradient(90deg,#6C98EE,#0E2A6B)" }} />
      </span>
      <span style={{ display: "flex", flexWrap: "wrap", gap: "2px 12px", fontSize: 12.5, color: C.muted, fontVariantNumeric: "tabular-nums" }}>
        <span><strong style={{ color: C.ink }}>{fmtInt(row.benefit_count)}</strong> of {fmtInt(row.universe_total)}</span>
      </span>
    </span>
  );
}

function ColumnNote({ countLabel, universeLabel }) {
  return (
    <div style={{ fontSize: 12.5, color: C.muted, margin: "0 2px 10px" }}>
      Each row: share, then {lowerFirst(countLabel)} of {lowerFirst(universeLabel)}.
    </div>
  );
}

// "Households on SNAP" -> "households on SNAP" (keeps acronyms intact).
function lowerFirst(s) {
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

function SmallEmpty({ children }) {
  return <div style={{ padding: "8px 4px", fontSize: 14, color: C.muted }}>{children}</div>;
}
