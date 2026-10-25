// =============================================================================
// ui/Kit.jsx - the shared building blocks of the October 2026 redesign.
//
// Every tab builds its page from these so the whole site reads as one product:
//   PageHero   gradient hero with eyebrow, title, lede, optional stat chips
//   StatGrid   row of big-number cards (values must be real data)
//   Panel      white rounded card with an optional header row
//   Seg        segmented pill control (tabs, filters, chamber switch)
//   Chip       small pill button or label
//   TallyBar   support / oppose / other bar with rounded ends
//   Loading, Empty, ErrorBox   consistent states
//
// Styling lives in src/styles/theme.css (cyr-* classes). House style: no em
// dashes, no mock data: components render only what they are given.
// =============================================================================
import React from "react";

export function PageHero({ eyebrow, title, lede, chips, children, compact }) {
  return (
    <section className="cyr-hero cyr-rise" style={{ padding: compact ? "26px 26px" : "34px 32px", borderRadius: 24, marginBottom: 20 }}>
      {eyebrow && <div className="cyr-eyebrow" style={{ color: "#FFE29A" }}>{eyebrow}</div>}
      {title && <h1 className="cyr-h1" style={{ fontSize: compact ? "clamp(26px, 3.8vw, 36px)" : "clamp(28px, 4.6vw, 46px)", margin: "8px 0 8px" }}>{title}</h1>}
      {lede && <div style={{ fontSize: 15.5, color: "rgba(255,255,255,.86)", lineHeight: 1.6, maxWidth: 640 }}>{lede}</div>}
      {chips && chips.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
          {chips.filter(c => c && c.value != null && c.value !== "").map((c, i) => (
            <div key={i} className="cyr-hero-chip">
              <span className="cyr-num" style={{ fontSize: 20 }}>{typeof c.value === "number" ? c.value.toLocaleString("en-US") : c.value}</span>
              <span style={{ fontSize: 12.5, color: "rgba(255,255,255,.85)" }}>{c.label}</span>
            </div>
          ))}
        </div>
      )}
      {children}
    </section>
  );
}

const TONES = {
  navy: "#0E2A6B", blue: "#2563EB", green: "#15803D", red: "#DC2626", gold: "#B7791F", purple: "#7C3AED", teal: "#0891B2",
};

export function StatGrid({ items, min = 150 }) {
  const list = (items || []).filter(it => it && it.value != null && it.value !== "");
  if (!list.length) return null;
  return (
    <div className="cyr-grid" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, marginBottom: 20 }}>
      {list.map((it, i) => (
        <div key={i} className="cyr-card cyr-card-hover cyr-rise cyr-stat" style={{ animationDelay: `${i * 50}ms` }}>
          <div className="cyr-num" style={{ fontSize: "clamp(24px, 3vw, 32px)", color: TONES[it.tone] || TONES.navy, lineHeight: 1.05 }}>
            {typeof it.value === "number" ? it.value.toLocaleString("en-US") : it.value}
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 700, marginTop: 6, color: "#0F172A" }}>{it.label}</div>
          {it.hint && <div style={{ fontSize: 12, color: "#5B6578", marginTop: 2 }}>{it.hint}</div>}
        </div>
      ))}
    </div>
  );
}

export function Panel({ eyebrow, title, action, children, pad = 20, style, className = "" }) {
  return (
    <div className={`cyr-card ${className}`} style={{ padding: 0, overflow: "hidden", marginBottom: 18, ...style }}>
      {(title || eyebrow || action) && (
        <div className="cyr-panel-head">
          <div style={{ minWidth: 0 }}>
            {eyebrow && <div className="cyr-eyebrow" style={{ fontSize: 11 }}>{eyebrow}</div>}
            {title && <div className="cyr-h2" style={{ fontSize: 19, marginTop: eyebrow ? 4 : 0 }}>{title}</div>}
          </div>
          {action}
        </div>
      )}
      <div style={{ padding: pad }}>{children}</div>
    </div>
  );
}

export function Seg({ options, value, onChange, size = "md", wrap }) {
  return (
    <div className={`cyr-seg ${size === "sm" ? "cyr-seg-sm" : ""}`} role="tablist" style={wrap ? { flexWrap: "wrap" } : undefined}>
      {options.map(o => {
        const key = typeof o === "string" ? o : o.value;
        const label = typeof o === "string" ? o : o.label;
        const active = key === value;
        return (
          <button key={key} type="button" role="tab" aria-pressed={active} aria-selected={active}
            onClick={() => onChange && onChange(key)}>
            {label}{typeof o === "object" && o.count != null && <span className="cyr-seg-count">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Chip({ children, active, onClick, tone, style }) {
  const Tag = onClick ? "button" : "span";
  return (
    <Tag type={onClick ? "button" : undefined} onClick={onClick} className="cyr-chip"
      style={{ border: 0, cursor: onClick ? "pointer" : "default",
               background: active ? "#0E2A6B" : tone ? `${TONES[tone]}1A` : undefined,
               color: active ? "#fff" : tone ? TONES[tone] : undefined, ...style }}>
      {children}
    </Tag>
  );
}

export function TallyBar({ support = 0, oppose = 0, other = 0, height = 12 }) {
  const t = support + oppose + other;
  if (!t) return <div style={{ height, borderRadius: 99, background: "#EEF2F8" }} />;
  return (
    <div style={{ display: "flex", height, borderRadius: 99, overflow: "hidden", background: "#EEF2F8", gap: 2 }}>
      {support > 0 && <div style={{ flex: support, background: "linear-gradient(90deg,#16A34A,#22C55E)" }} />}
      {oppose > 0 && <div style={{ flex: oppose, background: "linear-gradient(90deg,#DC2626,#F43F5E)" }} />}
      {other > 0 && <div style={{ flex: other, background: "#CBD5E1" }} />}
    </div>
  );
}

export function Loading({ rows = 4, height = 64 }) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {Array.from({ length: rows }).map((_, i) => <div key={i} className="cyr-skeleton" style={{ height }} />)}
    </div>
  );
}

export function Empty({ icon = "🗂️", title, children }) {
  return (
    <div style={{ textAlign: "center", padding: "36px 16px", color: "#5B6578" }}>
      <div style={{ fontSize: 30 }} aria-hidden>{icon}</div>
      {title && <div style={{ fontWeight: 800, color: "#0E2A6B", fontSize: 16, marginTop: 8 }}>{title}</div>}
      {children && <div style={{ fontSize: 14, lineHeight: 1.6, marginTop: 6 }}>{children}</div>}
    </div>
  );
}

export function ErrorBox({ children, onRetry }) {
  return (
    <div className="cyr-card" style={{ padding: 16, background: "#FEF2F2", borderColor: "#FECACA", color: "#991B1B",
                                       display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
      <span style={{ fontSize: 14, fontWeight: 600 }}>{children}</span>
      {onRetry && <button className="cyr-btn cyr-btn-ghost" onClick={onRetry}>Try again</button>}
    </div>
  );
}
