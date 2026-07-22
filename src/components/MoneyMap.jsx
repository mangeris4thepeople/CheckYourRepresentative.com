// =============================================================================
// MoneyMap.jsx - the Money Map sub-tab of Follow the Money. Overlays six
// public money flows on one county level USA map:
//   Medicare, Medicaid, SNAP, Social Security income, NGO federal awards
//   (county level), and campaign contributions to the tracked delegation
//   (state level only: the FEC publishes itemized contributions by
//   contributor city and state, never by county).
//
// One active layer draws a standard choropleth. Two draw a bivariate 3x3
// blend with a two axis legend. Three or more switch to small multiples on
// a shared percentile scale. A correlation panel shows pairwise Pearson r
// for the current scope, computed server side from public records; the
// sidebar copy says plainly that correlation is not causation.
//
// Layer hues are a fixed six color palette validated colorblind safe with
// the site's palette checker. Counties without a program's data render in
// the neutral no-data shade and are excluded from that pair's correlation.
// =============================================================================
import React, { useState, useEffect, useMemo, useCallback } from "react";
import STATE_PATHS from "../data/us-state-paths.json";

const C = {
  navy: "#0A1A3F", gold: "#C9A227", crimson: "#8B0000", parchment: "#FBF7EC",
  ink: "#1A1A1A", muted: "#5C5347", line: "#D8C9A0",
};
const serif = "Georgia, 'Times New Roman', serif";
const NO_DATA = "#E8E2D2";

const ABBR_TO_FIPS = {
  AL: "01", AK: "02", AZ: "04", AR: "05", CA: "06", CO: "08", CT: "09", DE: "10", DC: "11",
  FL: "12", GA: "13", HI: "15", ID: "16", IL: "17", IN: "18", IA: "19", KS: "20", KY: "21",
  LA: "22", ME: "23", MD: "24", MA: "25", MI: "26", MN: "27", MS: "28", MO: "29", MT: "30",
  NE: "31", NV: "32", NH: "33", NJ: "34", NM: "35", NY: "36", NC: "37", ND: "38", OH: "39",
  OK: "40", OR: "41", PA: "42", RI: "44", SC: "45", SD: "46", TN: "47", TX: "48", UT: "49",
  VT: "50", VA: "51", WA: "53", WV: "54", WI: "55", WY: "56", PR: "72",
};

const fmtMoney = (n) => n == null ? "n/a" : `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const fmtInt = (n) => n == null ? "n/a" : Number(n).toLocaleString();

// Fixed layer order and hues; palette validated with the site checker.
const LAYERS = [
  { key: "medicare", label: "Medicare", hue: "#2E5EAA", estimate: true,
    pcKey: "pc_medicare", rawKey: "medicare",
    fmtPc: (v) => `${(v * 100).toFixed(1)}% covered`, fmtRaw: (v) => `${fmtInt(v)} people`,
    source: { name: "Census ACS table S2704", url: "https://data.census.gov/table/ACSST5Y2023.S2704" },
    section: "medicare-medicaid" },
  { key: "medicaid", label: "Medicaid", hue: "#0E8A4D", estimate: true,
    pcKey: "pc_medicaid", rawKey: "medicaid",
    fmtPc: (v) => `${(v * 100).toFixed(1)}% covered`, fmtRaw: (v) => `${fmtInt(v)} people`,
    source: { name: "Census ACS table S2704", url: "https://data.census.gov/table/ACSST5Y2023.S2704" },
    section: "medicare-medicaid" },
  { key: "snap", label: "SNAP", hue: "#D6870B", estimate: true,
    pcKey: "pc_snap", rawKey: "snap",
    fmtPc: (v) => `${(v * 1000).toFixed(1)} households per 1,000 residents`, fmtRaw: (v) => `${fmtInt(v)} households`,
    source: { name: "Census ACS table S2201", url: "https://data.census.gov/table/ACSST5Y2023.S2201" },
    section: "snap" },
  { key: "ss_income", label: "Social Security $", hue: "#8A50C8", estimate: true,
    pcKey: "pc_ss_income", rawKey: "ss_income",
    fmtPc: (v) => `${fmtMoney(v)} per resident per year`, fmtRaw: fmtMoney,
    source: { name: "Census ACS table B19065", url: "https://data.census.gov/table/ACSDT5Y2023.B19065" },
    section: "social-security" },
  { key: "ngo", label: "NGO federal awards", hue: "#C23B4B", estimate: false,
    pcKey: "pc_ngo", rawKey: "ngo",
    fmtPc: (v) => `${fmtMoney(v)} per resident`, fmtRaw: fmtMoney,
    source: { name: "USASpending.gov spending by geography", url: "https://www.usaspending.gov/search" },
    section: "ngo-funding" },
  { key: "contributions", label: "Campaign contributions", hue: "#0FA3B1", estimate: false,
    stateOnly: true,
    source: { name: "FEC itemized receipts (by contributor state)", url: "https://www.fec.gov/data/receipts/" },
    section: "know-your-rep" },
];

// Stevens 3x3 bivariate palette, x axis = first layer, y axis = second.
const BIVARIATE = [
  "#e8e8e8", "#e4acac", "#c85a5a",
  "#b0d5df", "#ad9ea5", "#985356",
  "#64acbe", "#627f8c", "#574249",
];

const countyFiles = import.meta.glob("../data/counties/*.json");

function mixToWhite(hex, t) {
  const c = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  const m = c.map(v => Math.round(255 + (v - 255) * t));
  return `rgb(${m[0]},${m[1]},${m[2]})`;
}
// Single hue ramp: light tint of the layer hue through the full hue to a
// darkened version, applied on a percentile scale.
function rampFor(hue) {
  return (t) => {
    const x = Math.max(0, Math.min(1, t));
    if (x < 0.75) return mixToWhite(hue, 0.15 + x * (1 / 0.75) * 0.85);
    const d = (x - 0.75) / 0.25;
    const c = [parseInt(hue.slice(1, 3), 16), parseInt(hue.slice(3, 5), 16), parseInt(hue.slice(5, 7), 16)]
      .map(v => Math.round(v * (1 - d * 0.45)));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  };
}

function percentiler(values) {
  const sorted = [...values].filter(v => v != null).sort((a, b) => a - b);
  if (!sorted.length) return () => null;
  return (v) => {
    if (v == null) return null;
    let lo = 0, hi = sorted.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid] <= v) lo = mid + 1; else hi = mid; }
    return sorted.length > 1 ? (lo - 1) / (sorted.length - 1) : 0.5;
  };
}

export default function MoneyMap({ onGoSection }) {
  const [phase, setPhase] = useState("loading");
  const [data, setData] = useState(null);
  const [shapes, setShapes] = useState(null); // { fips: {name, d} } all counties
  const [stateViewBoxes, setStateViewBoxes] = useState({});
  const [active, setActive] = useState(["snap"]);
  const [metric, setMetric] = useState("pc"); // pc | raw
  const [scope, setScope] = useState("US");
  const [picked, setPicked] = useState(null); // county fips
  const [hover, setHover] = useState(null);
  const [errorDetail, setErrorDetail] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/money-map").then(r => r.json()).catch(() => null),
      Promise.all(Object.entries(countyFiles).map(async ([path, loader]) => {
        const mod = await loader();
        const abbr = path.match(/([A-Z]{2})\.json$/)[1];
        return [abbr, mod.default || mod];
      })),
    ]).then(([d, files]) => {
      if (cancelled) return;
      const all = {};
      const boxes = {};
      for (const [abbr, file] of files) {
        boxes[abbr] = file.viewBox;
        Object.assign(all, file.counties);
      }
      setShapes(all);
      setStateViewBoxes(boxes);
      if (!d || d.ready === undefined) { setErrorDetail(d?.detail || d?.error || "no response"); setPhase("error"); return; }
      if (!d.ready) { setPhase("notready"); return; }
      setData(d);
      setPhase("ready");
    });
    return () => { cancelled = true; };
  }, []);

  const counties = useMemo(() => {
    if (!data) return [];
    const list = data.counties;
    if (scope === "US") return list;
    return list.filter(c => c.s === scope);
  }, [data, scope]);

  const byFips = useMemo(() => new Map(counties.map(c => [c.f, c])), [counties]);

  const countyLayers = active.filter(k => k !== "contributions").map(k => LAYERS.find(l => l.key === k));
  const contribOnly = active.length === 1 && active[0] === "contributions";

  const valueOf = useCallback((c, layer) => {
    const v = metric === "pc" ? c[layer.pcKey] : c[layer.rawKey];
    return v == null ? null : Number(v);
  }, [metric]);

  const percentilers = useMemo(() => {
    const m = {};
    for (const layer of countyLayers) {
      m[layer.key] = percentiler(counties.map(c => valueOf(c, layer)));
    }
    return m;
  }, [counties, countyLayers, valueOf]);

  const fillFor = useCallback((fips) => {
    const c = byFips.get(fips);
    if (!c) return NO_DATA;
    if (countyLayers.length === 1) {
      const layer = countyLayers[0];
      const p = percentilers[layer.key](valueOf(c, layer));
      return p == null ? NO_DATA : rampFor(layer.hue)(p);
    }
    if (countyLayers.length === 2) {
      const [la, lb] = countyLayers;
      const pa = percentilers[la.key](valueOf(c, la));
      const pb = percentilers[lb.key](valueOf(c, lb));
      if (pa == null || pb == null) return NO_DATA;
      const tx = Math.min(2, Math.floor(pa * 3));
      const ty = Math.min(2, Math.floor(pb * 3));
      return BIVARIATE[ty * 3 + tx];
    }
    return NO_DATA;
  }, [byFips, countyLayers, percentilers, valueOf]);

  const viewBox = scope === "US" ? "0 0 975 610" : (stateViewBoxes[scope] || "0 0 975 610");
  const visibleFips = useMemo(() => {
    if (!shapes) return [];
    if (scope === "US") return Object.keys(shapes);
    const prefix = ABBR_TO_FIPS[scope];
    return Object.keys(shapes).filter(f => f.startsWith(prefix));
  }, [shapes, scope]);

  const corrFor = useCallback((a, b) => {
    if (!data) return null;
    const row = data.correlations.find(r => r.scope === scope &&
      ((r.program_a === a && r.program_b === b) || (r.program_a === b && r.program_b === a)));
    return row || null;
  }, [data, scope]);

  function toggleLayer(key) {
    setActive(prev => prev.includes(key)
      ? (prev.length > 1 ? prev.filter(k => k !== key) : prev)
      : [...prev, key]);
  }

  if (phase === "loading") return <Center>Loading the Money Map...</Center>;
  if (phase === "error") return <Center color={C.crimson}>Could not load the Money Map.<Mono>{errorDetail}</Mono></Center>;
  if (phase === "notready") return (
    <Center>The Money Map rollup has not been computed yet. Its data job runs weekly; check back shortly.</Center>
  );

  const years = data.years || {};
  const pickedCounty = picked ? data.counties.find(c => c.f === picked) : null;

  return (
    <div style={{ fontFamily: serif, color: C.ink, maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ background: C.navy, color: "#fff", padding: "22px 24px", borderRadius: 8,
                    border: `3px solid ${C.gold}`, marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, color: C.gold, textTransform: "uppercase", marginBottom: 8 }}>
          Money Map
        </div>
        <div style={{ fontSize: 14, color: "#cfd6e4", lineHeight: 1.6 }}>
          Six public money flows on one county map. Pick one program for a heat map, two to see
          where they overlap, three or more to compare side by side. The correlation panel shows
          statistical relationships in public spending data, offered for your own analysis:
          correlation is not causation.
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        {LAYERS.map(l => {
          const on = active.includes(l.key);
          return (
            <button key={l.key} onClick={() => toggleLayer(l.key)}
              style={{ fontFamily: serif, fontSize: 12, fontWeight: 700, padding: "7px 12px",
                       borderRadius: 16, cursor: "pointer",
                       border: `2px solid ${l.hue}`,
                       background: on ? l.hue : "#fff", color: on ? "#fff" : C.ink }}>
              {l.label}
              <span style={{ fontWeight: 400, marginLeft: 6, fontSize: 10.5, opacity: 0.85 }}>{years[l.key]}</span>
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <Pill on={metric === "pc"} onClick={() => setMetric("pc")}>Per capita</Pill>
        <Pill on={metric === "raw"} onClick={() => setMetric("raw")}>Total figures</Pill>
        <select value={scope} onChange={e => { setScope(e.target.value); setPicked(null); }}
          style={{ fontFamily: serif, fontSize: 13, padding: "7px 10px", border: `1px solid ${C.line}`,
                   borderRadius: 6, background: "#fff", marginLeft: "auto" }}>
          <option value="US">National</option>
          {Object.keys(ABBR_TO_FIPS).sort().map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {active.includes("contributions") && (
        <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 8, padding: "12px 16px",
                      marginBottom: 12, fontSize: 12.5, color: C.muted, lineHeight: 1.6 }}>
          Campaign contributions appear at the state level only: the Federal Election Commission
          publishes itemized contributions by contributor city and state, not by county, a
          government disclosure boundary rather than a site limitation.
          {!contribOnly && " The county visuals below draw the other selected layers."}
        </div>
      )}

      {contribOnly ? (
        <ContributionsStateMap data={data} />
      ) : countyLayers.length <= 2 ? (
        <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 8, padding: 18, marginBottom: 14 }}>
          <CountyCanvas shapes={shapes} fips={visibleFips} viewBox={viewBox}
            fillFor={fillFor} onPick={setPicked} hover={hover} setHover={setHover}
            tooltip={(f) => {
              const c = byFips.get(f);
              if (!c) return `${shapes[f].name}: no data on file (a public records gap, not a site failure)`;
              return `${c.n}: ` + countyLayers.map(l => {
                const v = valueOf(c, l);
                return `${l.label} ${v == null ? "no data" : (metric === "pc" ? l.fmtPc(v) : l.fmtRaw(v))}`;
              }).join(" · ");
            }} />
          {countyLayers.length === 1 && (
            <SingleLegend layer={countyLayers[0]} metric={metric} />
          )}
          {countyLayers.length === 2 && (
            <BivariateLegend a={countyLayers[0]} b={countyLayers[1]} />
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12, marginBottom: 14 }}>
          {countyLayers.map(layer => (
            <div key={layer.key} style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 6 }}>
                {layer.label} {layer.estimate && <EstimateBadge />}
              </div>
              <CountyCanvas shapes={shapes} fips={visibleFips} viewBox={viewBox} mini
                fillFor={(f) => {
                  const c = byFips.get(f);
                  if (!c) return NO_DATA;
                  const p = percentilers[layer.key](valueOf(c, layer));
                  return p == null ? NO_DATA : rampFor(layer.hue)(p);
                }}
                onPick={setPicked} hover={null} setHover={() => {}}
                tooltip={() => ""} />
            </div>
          ))}
          <div style={{ gridColumn: "1 / -1", fontSize: 11.5, color: C.muted }}>
            Small multiples share a percentile scale within each program: the darkest county in
            each mini map is that program's highest, so shapes compare, not absolute dollars.
          </div>
        </div>
      )}

      <CorrelationMatrix data={data} scope={scope} corrFor={corrFor}
        onPickPair={(a, b) => setActive([a, b])} />

      {pickedCounty && (
        <CountyCard county={pickedCounty} years={years} onGoSection={onGoSection}
          onClose={() => setPicked(null)} />
      )}
      {picked && !pickedCounty && shapes[picked] && (
        <Section title={shapes[picked].name}>
          <Empty>
            No Money Map data on file for this county. Its rows are excluded from correlations
            and shaded neutral: a public records gap, not a site failure.
          </Empty>
        </Section>
      )}

      <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.6, marginTop: 16 }}>
        Sources: US Census Bureau American Community Survey 5-year estimates (tables S2704, S2201,
        B19055, B19065; Census estimates carry a visible badge), USASpending.gov federal award
        obligations to nonprofit recipients, and FEC itemized receipt aggregates. Correlations are
        Pearson r over counties with data for both programs; counties missing either are excluded.
      </p>
    </div>
  );
}

function CountyCanvas({ shapes, fips, viewBox, fillFor, onPick, hover, setHover, tooltip, mini }) {
  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={viewBox} style={{ width: "100%", height: "auto", display: "block" }}
        role="img" aria-label="County heat map">
        {fips.map(f => (
          <path key={f} d={shapes[f].d}
            fill={fillFor(f)}
            stroke="#FFFFFF" strokeWidth={mini ? 0.3 : 0.5}
            style={{ cursor: "pointer" }}
            onClick={() => onPick(f)}
            onMouseMove={!mini ? (e) => {
              const box = e.currentTarget.ownerSVGElement.getBoundingClientRect();
              setHover({ f, x: e.clientX - box.left, y: e.clientY - box.top });
            } : undefined}
            onMouseLeave={!mini ? () => setHover(null) : undefined}
          />
        ))}
      </svg>
      {hover && !mini && (
        <div style={{ position: "absolute", left: Math.min(hover.x + 12, 640), top: hover.y + 10,
                      background: C.navy, color: "#fff", fontFamily: serif, fontSize: 12,
                      padding: "6px 10px", borderRadius: 6, pointerEvents: "none",
                      border: `1px solid ${C.gold}`, maxWidth: 340, lineHeight: 1.5, zIndex: 5 }}>
          {tooltip(hover.f)}
        </div>
      )}
    </div>
  );
}

function SingleLegend({ layer, metric }) {
  const ramp = rampFor(layer.hue);
  const stops = Array.from({ length: 7 }, (_, i) => ramp(i / 6));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, fontFamily: serif, flexWrap: "wrap" }}>
      <span style={{ fontSize: 11.5, color: C.muted }}>Lowest</span>
      <div style={{ flex: "0 1 240px", height: 12, borderRadius: 6, border: `1px solid ${C.line}`,
                    background: `linear-gradient(to right, ${stops.join(",")})` }} />
      <span style={{ fontSize: 11.5, color: C.muted }}>Highest</span>
      <span style={{ fontSize: 11.5, color: C.muted }}>
        {layer.label}, {metric === "pc" ? "per capita" : "totals"}, percentile shading
      </span>
      {layer.estimate && <EstimateBadge />}
    </div>
  );
}

function BivariateLegend({ a, b }) {
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center", marginTop: 12, fontFamily: serif, flexWrap: "wrap" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 22px)", gridTemplateRows: "repeat(3, 22px)" }}>
        {[2, 1, 0].map(y => [0, 1, 2].map(x => (
          <div key={`${x}${y}`} style={{ background: BIVARIATE[y * 3 + x], border: "1px solid #fff" }} />
        )))}
      </div>
      <div style={{ fontSize: 11.5, color: C.muted, lineHeight: 1.7 }}>
        Right = higher {a.label}; up = higher {b.label} (thirds of each).<br />
        Dark corner: high on both. Pale corner: low on both. The off corners show where one
        runs high while the other runs low.
        {(a.estimate || b.estimate) && <span style={{ marginLeft: 6 }}><EstimateBadge /></span>}
      </div>
    </div>
  );
}

function ContributionsStateMap({ data }) {
  const [hover, setHover] = useState(null);
  const byState = new Map((data.contribStates || []).map(r => [r.state_abbr, Number(r.dollars)]));
  const vals = [...byState.values()];
  const max = vals.length ? Math.max(...vals) : 1;
  const ramp = rampFor("#0FA3B1");
  if (!vals.length) {
    return <Section title="Campaign contributions"><Empty>
      No contribution geography is on file yet. It loads with the delegation finance sync.
    </Empty></Section>;
  }
  return (
    <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 8, padding: 18, marginBottom: 14, position: "relative" }}>
      <svg viewBox="0 0 975 610" style={{ width: "100%", height: "auto", display: "block" }}>
        {Object.entries(STATE_PATHS).map(([abbr, s]) => {
          const v = byState.get(abbr);
          return (
            <path key={abbr} d={s.d}
              fill={v == null ? NO_DATA : ramp(Math.sqrt(v / max))}
              stroke="#fff" strokeWidth={1}
              onMouseMove={(e) => {
                const box = e.currentTarget.ownerSVGElement.getBoundingClientRect();
                setHover({ abbr, x: e.clientX - box.left, y: e.clientY - box.top });
              }}
              onMouseLeave={() => setHover(null)} />
          );
        })}
      </svg>
      {hover && (
        <div style={{ position: "absolute", left: Math.min(hover.x + 12, 700), top: hover.y + 10,
                      background: C.navy, color: "#fff", fontFamily: serif, fontSize: 12,
                      padding: "6px 10px", borderRadius: 6, pointerEvents: "none",
                      border: `1px solid ${C.gold}` }}>
          {STATE_PATHS[hover.abbr].name}: {byState.has(hover.abbr) ? fmtMoney(byState.get(hover.abbr)) : "no itemized receipts on file"}
        </div>
      )}
      <div style={{ fontSize: 11.5, color: C.muted, marginTop: 10, lineHeight: 1.6 }}>
        Itemized contributions to the tracked delegation's committees by contributor state, most
        recent cycle on file per candidate, square root shading. Source: FEC.
      </div>
    </div>
  );
}

function CorrelationMatrix({ data, scope, corrFor, onPickPair }) {
  const keys = LAYERS.map(l => l.key);
  const label = (k) => LAYERS.find(l => l.key === k).label;
  const cellColor = (r) => {
    if (r == null) return "#f4efe2";
    const x = Math.max(-1, Math.min(1, r));
    return x >= 0 ? mixToWhite("#C23B4B", 0.15 + Math.abs(x) * 0.7) : mixToWhite("#2E5EAA", 0.15 + Math.abs(x) * 0.7);
  };
  const pairs = [];
  for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
    const row = corrFor(keys[i], keys[j]);
    if (row) pairs.push({ a: keys[i], b: keys[j], r: Number(row.r), n: row.n });
  }
  const sorted = [...pairs].sort((x, y) => y.r - x.r);
  const strongest = sorted[0];
  const weakest = sorted[sorted.length - 1];

  return (
    <Section title={`Correlations across counties (${scope === "US" ? "national" : scope})`}>
      <div style={{ padding: "12px 14px", overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", fontFamily: serif, fontSize: 11.5 }}>
          <thead>
            <tr>
              <th></th>
              {keys.map(k => <th key={k} style={{ padding: "4px 6px", color: C.muted, fontWeight: 700, textAlign: "center" }}>{label(k)}</th>)}
            </tr>
          </thead>
          <tbody>
            {keys.map(ka => (
              <tr key={ka}>
                <td style={{ padding: "4px 6px", color: C.muted, fontWeight: 700 }}>{label(ka)}</td>
                {keys.map(kb => {
                  if (ka === kb) return <td key={kb} style={{ padding: "4px 6px", textAlign: "center", color: C.muted }}>1</td>;
                  if (ka === "contributions" || kb === "contributions") {
                    return <td key={kb} title="The FEC publishes no county level contribution data"
                      style={{ padding: "4px 6px", textAlign: "center", color: C.muted, background: "#f4efe2" }}>n/a</td>;
                  }
                  const row = corrFor(ka, kb);
                  const r = row ? Number(row.r) : null;
                  return (
                    <td key={kb} onClick={() => row && onPickPair(ka, kb)}
                      title={row ? `${label(ka)} vs ${label(kb)}: r = ${r} across ${row.n} counties. Click for the bivariate map.` : "Not enough counties with both programs"}
                      style={{ padding: "4px 8px", textAlign: "center", cursor: row ? "pointer" : "default",
                               background: cellColor(r), fontWeight: 700, color: C.ink }}>
                      {r == null ? "n/a" : r.toFixed(2)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ padding: "0 14px 12px", fontSize: 12, color: C.muted, lineHeight: 1.7 }}>
        {strongest && (
          <div>
            Strongest positive: {label(strongest.a)} and {label(strongest.b)} (r = {strongest.r.toFixed(2)}):
            counties high on one tend to run high on the other.
          </div>
        )}
        {weakest && weakest !== strongest && (
          weakest.r < 0 ? (
            <div>
              Most negative: {label(weakest.a)} and {label(weakest.b)} (r = {weakest.r.toFixed(2)}):
              where one runs high, the other tends to run low.
            </div>
          ) : (
            <div>
              Weakest: {label(weakest.a)} and {label(weakest.b)} (r = {weakest.r.toFixed(2)}).
            </div>
          )
        )}
        <div style={{ marginTop: 4 }}>
          These are statistical relationships in public spending data, offered for your own
          analysis. Correlation is not causation. Click any cell to see that pair on the map.
        </div>
      </div>
    </Section>
  );
}

function CountyCard({ county, years, onGoSection, onClose }) {
  return (
    <Section title={`${county.n}`}>
      <div style={{ padding: "10px 14px", fontSize: 12, color: C.muted, borderBottom: "1px solid #f0ead8", display: "flex" }}>
        <span>Population {fmtInt(county.p)} (ACS civilian noninstitutionalized)</span>
        <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none",
          color: C.crimson, fontFamily: serif, fontWeight: 700, cursor: "pointer" }}>Close</button>
      </div>
      {LAYERS.map(l => {
        if (l.stateOnly) {
          return (
            <CardRow key={l.key} layer={l} years={years}
              value="No county data: the FEC publishes contributions by contributor city and state, not by county"
              onGoSection={onGoSection} />
          );
        }
        const pcVal = county[l.pcKey] == null ? null : Number(county[l.pcKey]);
        const rawVal = county[l.rawKey] == null ? null : Number(county[l.rawKey]);
        const value = pcVal == null
          ? "No data on file for this county: a public records gap, not a site failure"
          : `${l.fmtPc(pcVal)} (${l.fmtRaw(rawVal)})`;
        return <CardRow key={l.key} layer={l} years={years} value={value} onGoSection={onGoSection} />;
      })}
    </Section>
  );
}

function CardRow({ layer, years, value, onGoSection }) {
  return (
    <div style={{ display: "flex", gap: 10, padding: "9px 14px", borderBottom: "1px solid #f0ead8",
                  fontFamily: serif, alignItems: "baseline", flexWrap: "wrap" }}>
      <span style={{ flex: "0 0 170px", fontSize: 12.5, fontWeight: 700, color: layer.hue }}>
        {layer.label} {layer.estimate && <EstimateBadge />}
      </span>
      <span style={{ flex: 1, minWidth: 200, fontSize: 13, color: C.ink }}>{value}</span>
      <span style={{ fontSize: 11, color: C.muted }}>{years[layer.key]}</span>
      <a href={layer.source.url} target="_blank" rel="noopener noreferrer"
        style={{ fontSize: 11.5, color: C.crimson, fontWeight: 700 }}>{layer.source.name}</a>
      {onGoSection && (
        <button onClick={() => onGoSection(layer.section)}
          style={{ fontSize: 11.5, color: C.navy, background: "none", border: `1px solid ${C.line}`,
                   borderRadius: 5, padding: "3px 9px", fontFamily: serif, fontWeight: 700, cursor: "pointer" }}>
          Open section →
        </button>
      )}
    </div>
  );
}

function EstimateBadge() {
  return (
    <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5, color: "#fff",
                   background: C.muted, borderRadius: 4, padding: "1px 6px", verticalAlign: "middle" }}>
      CENSUS ESTIMATE
    </span>
  );
}

function Pill({ on, onClick, children }) {
  return (
    <button onClick={onClick}
      style={{ fontFamily: serif, fontSize: 12.5, fontWeight: 700, padding: "7px 16px",
               borderRadius: 18, cursor: "pointer",
               border: `1px solid ${on ? C.navy : C.line}`,
               background: on ? C.navy : "#fff", color: on ? C.gold : C.muted }}>
      {children}
    </button>
  );
}
function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>{title}</div>
      <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 8, overflow: "hidden" }}>{children}</div>
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
