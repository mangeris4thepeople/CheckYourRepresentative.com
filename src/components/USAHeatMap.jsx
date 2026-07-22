// =============================================================================
// USAHeatMap.jsx - a clickable US state choropleth. Real state shapes from
// the Census Bureau's cartographic boundaries (us-atlas, Albers composite
// projection with Alaska and Hawaii inset), pre-rendered to SVG path data
// in src/data/us-state-paths.json so no mapping library ships to the client.
//
// Color is a single-hue sequential ramp, light for low values through deep
// red for high, per the site's data visualization rules: value tooltips on
// hover, a labeled legend, and the caller is expected to render a table of
// the same numbers beside it so color is never the only way to read them.
// =============================================================================
import React, { useMemo, useState } from "react";
import STATE_PATHS from "../data/us-state-paths.json";

const C = { navy: "#0A1A3F", gold: "#C9A227", ink: "#1A1A1A", muted: "#5C5347", line: "#D8C9A0" };
const serif = "Georgia, 'Times New Roman', serif";

// Light to dark single-hue ramp (monotonic lightness, no rainbow).
const RAMP = ["#F6E3CE", "#EFC3A4", "#E29B7B", "#D06F55", "#B84734", "#992117", "#750000"];
const NO_DATA = "#E8E2D2";

function rampColor(t) {
  const x = Math.max(0, Math.min(1, t)) * (RAMP.length - 1);
  const i = Math.min(RAMP.length - 2, Math.floor(x));
  const f = x - i;
  const a = hex(RAMP[i]);
  const b = hex(RAMP[i + 1]);
  const mix = a.map((v, k) => Math.round(v + (b[k] - v) * f));
  return `rgb(${mix[0]},${mix[1]},${mix[2]})`;
}
function hex(h) {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

// Renders the US state map by default; pass `regions` and `viewBox` to draw
// any other set of shapes with the same colors, legend, and interactions
// (the per-state county maps use this with the lazy loaded county files).
export default function USAHeatMap({ values, onSelect, format, legendLow, legendHigh, legendLabel,
                                     regions, viewBox, ariaLabel }) {
  const [hover, setHover] = useState(null); // { abbr, x, y }
  const shapes = regions || STATE_PATHS;

  const [min, max] = useMemo(() => {
    const nums = Object.values(values || {}).filter(v => Number.isFinite(v));
    if (!nums.length) return [0, 1];
    return [Math.min(...nums), Math.max(...nums)];
  }, [values]);

  const scale = (v) => (max > min ? (v - min) / (max - min) : 0.5);

  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={viewBox || "0 0 975 610"} style={{ width: "100%", height: "auto", display: "block" }}
        role="img" aria-label={ariaLabel || "United States heat map"}>
        {Object.entries(shapes).map(([abbr, s]) => {
          const v = values?.[abbr];
          const has = Number.isFinite(v);
          const isHover = hover?.abbr === abbr;
          return (
            <path key={abbr} d={s.d}
              fill={has ? rampColor(scale(v)) : NO_DATA}
              stroke={isHover ? C.navy : "#FFFFFF"}
              strokeWidth={isHover ? 2 : 1}
              style={{ cursor: has && onSelect ? "pointer" : "default" }}
              onClick={() => has && onSelect && onSelect(abbr)}
              onMouseMove={(e) => {
                const box = e.currentTarget.ownerSVGElement.getBoundingClientRect();
                setHover({ abbr, x: e.clientX - box.left, y: e.clientY - box.top });
              }}
              onMouseLeave={() => setHover(null)}
            >
              <title>{s.name}{has ? `: ${format ? format(v) : v}` : ": no data"}</title>
            </path>
          );
        })}
      </svg>

      {hover && (
        <div style={{
          position: "absolute", left: Math.min(hover.x + 14, 780), top: hover.y + 10,
          background: C.navy, color: "#fff", fontFamily: serif, fontSize: 12.5,
          padding: "7px 11px", borderRadius: 6, pointerEvents: "none",
          border: `1px solid ${C.gold}`, whiteSpace: "nowrap", zIndex: 5,
        }}>
          <span style={{ fontWeight: 700 }}>{shapes[hover.abbr].name}</span>
          {"  "}
          {Number.isFinite(values?.[hover.abbr])
            ? (format ? format(values[hover.abbr]) : values[hover.abbr])
            : "no data"}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, fontFamily: serif }}>
        <span style={{ fontSize: 11.5, color: C.muted }}>{legendLow}</span>
        <div style={{
          flex: "0 1 260px", height: 12, borderRadius: 6, border: `1px solid ${C.line}`,
          background: `linear-gradient(to right, ${RAMP.join(",")})`,
        }} />
        <span style={{ fontSize: 11.5, color: C.muted }}>{legendHigh}</span>
        {legendLabel && (
          <span style={{ fontSize: 11.5, color: C.muted, marginLeft: 6 }}>{legendLabel}</span>
        )}
      </div>
    </div>
  );
}
