// =============================================================================
// NgosDirectory.jsx - the NGOs section. Follows the same state-view pattern as
// the Bills and Roll Call sections (this app has no router), reading from the
// funding transparency endpoints.
//
// List: filter by state, source type, and fiscal year. Click an org for its
// detail page, which renders TransparencyScore from org_funding_transparency
// plus the dollar-level funding events, reported revenue, and grants made.
//
// October 2026 redesign: intro card, filter card with rounded selects, org
// rows with a traceability meter, and a Panel based detail page. Presentation
// only; every fetch and state transition is unchanged. No em dashes.
// =============================================================================
import React, { useState, useEffect, useCallback } from "react";
import TransparencyScore from "./TransparencyScore.jsx";
import { Panel, Loading, Empty as KitEmpty, ErrorBox } from "./ui/Kit.jsx";

const C = {
  navy: "#0E2A6B", blue: "#2563EB", red: "#E0313F", gold: "#F5B82E", goldInk: "#B7791F", green: "#16A34A",
  ink: "#0F172A", muted: "#5B6578", line: "#E2E8F0", soft: "#F8FAFE",
};

const SOURCE_LABELS = {
  federal_award: "Federal award",
  state_grant: "State grant",
  foreign_principal: "Foreign principal (FARA)",
  foundation_grant: "Foundation grant",
  pac_contribution: "PAC contribution (FEC)",
};

const usd = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(n) || 0);

const PAGE_SIZE = 20;

export default function NgosDirectory() {
  const [phase, setPhase] = useState("loading"); // loading | ready | notready | error
  const [orgs, setOrgs] = useState([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [facets, setFacets] = useState({ states: [], sourceTypes: [], fiscalYears: [] });
  const [filters, setFilters] = useState({ state: "", sourceType: "", fiscalYear: "" });
  const [selected, setSelected] = useState(null); // org id for detail

  const loadList = useCallback(async (newOffset, append) => {
    setPhase("loading");
    try {
      const p = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(newOffset) });
      if (filters.state) p.set("state", filters.state);
      if (filters.sourceType) p.set("sourceType", filters.sourceType);
      if (filters.fiscalYear) p.set("fiscalYear", filters.fiscalYear);
      const r = await fetch(`/api/ngos?${p}`);
      const d = await r.json();
      if (!d.ready) { setPhase("notready"); return; }
      setOrgs(prev => append ? [...prev, ...(d.orgs || [])] : (d.orgs || []));
      setOffset(d.offset ?? newOffset);
      setHasMore(!!d.hasMore);
      setFacets({ states: d.states || [], sourceTypes: d.sourceTypes || [], fiscalYears: d.fiscalYears || [] });
      setPhase("ready");
    } catch {
      setPhase("error");
    }
  }, [filters]);

  useEffect(() => { loadList(0, false); }, [filters, loadList]);

  if (selected) {
    return <NgoDetail orgId={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div style={{ color: C.ink, maxWidth: 1000, margin: "0 auto", minWidth: 0 }}>
      <Intro eyebrow="NGO funding" title="Funding transparency">
        How much of each organization's reported revenue can be traced to a dollar-level
        public disclosure, versus the portion that is legally aggregate-only. Every dollar
        that is disclosed is tracked; what the law does not require to be itemized is shown
        honestly as untraceable, not as wrongdoing.
      </Intro>

      {/* Filters */}
      <FilterBar>
        <Select label="State" value={filters.state} onChange={v => setFilters(f => ({ ...f, state: v }))}
          options={facets.states} />
        <Select label="Source type" value={filters.sourceType} onChange={v => setFilters(f => ({ ...f, sourceType: v }))}
          options={facets.sourceTypes} labelFor={(o) => SOURCE_LABELS[o] || o} />
        <Select label="Fiscal year" value={filters.fiscalYear} onChange={v => setFilters(f => ({ ...f, fiscalYear: v }))}
          options={facets.fiscalYears} />
      </FilterBar>

      {phase === "loading" && orgs.length === 0 && <Loading rows={6} height={70} />}
      {phase === "error" && (
        <ErrorBox onRetry={() => loadList(0, false)}>Could not load organizations.</ErrorBox>
      )}
      {phase === "notready" && (
        <div className="cyr-card"><KitEmpty icon="🏢" title="Not loaded yet">
          The NGO funding database is not loaded yet. Run the schema migration and the
          funding ETLs, then this list will populate.
        </KitEmpty></div>
      )}
      {phase === "ready" && orgs.length === 0 && (
        <div className="cyr-card"><KitEmpty icon="🔎" title="No matches">No organizations match these filters yet.</KitEmpty></div>
      )}

      {orgs.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 10 }}>
          {orgs.map((o, i) => {
            const pct = o.pct_transparent;
            const barColor = pct == null ? "#CBD5E1" : pct >= 75 ? C.green : pct >= 40 ? C.goldInk : C.red;
            return (
              <button key={o.id} onClick={() => setSelected(o.id)} className={`cyr-row${i < 12 ? " cyr-rise" : ""}`}
                style={{ width: "100%", textAlign: "left", cursor: "pointer", fontFamily: "inherit", flexWrap: "wrap",
                         rowGap: 10, padding: "14px 16px", animationDelay: `${Math.min(i, 12) * 25}ms` }}>
                <span style={{ flex: "1 1 260px", minWidth: 0 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: C.ink, lineHeight: 1.35,
                                 overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                    {o.name}
                  </span>
                  <span style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 5 }}>
                    <span className="cyr-chip" style={{ fontSize: 11, padding: "2px 8px" }}>{o.state || "??"}</span>
                    {o.subsection_code && <span className="cyr-chip" style={{ fontSize: 11, padding: "2px 8px", background: "#F1F5FB", color: C.muted }}>{o.subsection_code}</span>}
                    <span style={{ fontSize: 12.5, color: C.muted }}>FY{o.fiscal_year} · Revenue {usd(o.total_revenue)}</span>
                  </span>
                </span>
                <span style={{ flex: "0 1 150px", minWidth: 120, marginLeft: "auto" }}>
                  <span style={{ display: "block", height: 8, borderRadius: 999, background: "#EEF2F8", overflow: "hidden" }}>
                    <span style={{ display: "block", height: "100%", width: `${Math.min(pct || 0, 100)}%`, minWidth: pct ? 4 : 0, background: barColor, borderRadius: 999 }} />
                  </span>
                  <span style={{ display: "block", fontSize: 12, fontWeight: 700, color: pct == null ? C.muted : C.ink, textAlign: "right", marginTop: 4 }}>
                    {pct == null ? "no filing" : `${pct}% traceable`}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {phase === "ready" && hasMore && (
        <button onClick={() => loadList(offset + PAGE_SIZE, true)} className="cyr-btn cyr-btn-ghost"
          style={{ width: "100%", justifyContent: "center", marginTop: 14, padding: 14 }}>
          Load more organizations
        </button>
      )}
      {phase === "loading" && orgs.length > 0 && (
        <div style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: 10 }}>Loading more...</div>
      )}
    </div>
  );
}

function NgoDetail({ orgId, onBack }) {
  const [phase, setPhase] = useState("loading");
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setPhase("loading");
    fetch(`/api/ngo-detail?orgId=${encodeURIComponent(orgId)}`)
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        if (!d.ready) { setPhase("notready"); return; }
        setData(d);
        setPhase("ready");
      })
      .catch(() => { if (!cancelled) setPhase("error"); });
    return () => { cancelled = true; };
  }, [orgId]);

  const back = (
    <button onClick={onBack} className="cyr-btn cyr-btn-ghost" style={{ marginBottom: 16, minHeight: 40 }}>
      <span aria-hidden>←</span> All organizations
    </button>
  );
  const wrap = { color: C.ink, maxWidth: 920, margin: "0 auto", minWidth: 0 };

  if (phase === "loading") return <div style={wrap}>{back}<Loading rows={4} height={90} /></div>;
  if (phase === "error") return <div style={wrap}>{back}<ErrorBox>Could not load this organization.</ErrorBox></div>;
  if (phase === "notready") return <div style={wrap}>{back}<div className="cyr-card"><KitEmpty icon="🏢">The NGO funding database is not loaded yet.</KitEmpty></div></div>;

  const { org, transparency, events, revenue, grants } = data;

  return (
    <div style={wrap}>
      {back}

      <div className="cyr-card cyr-rise" style={{ padding: 0, overflow: "hidden", marginBottom: 18 }}>
        <div style={{ height: 6, background: "linear-gradient(90deg,#2563EB,#0E2A6B)" }} />
        <div style={{ padding: "20px 22px", background: "linear-gradient(120deg,#FFFFFF 40%,#EEF4FF)" }}>
          <div className="cyr-eyebrow" style={{ fontSize: 11 }}>Organization</div>
          <h2 className="cyr-h2" style={{ fontSize: "clamp(22px, 3.2vw, 30px)", marginTop: 4, overflowWrap: "anywhere" }}>{org.name}</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            {[org.city, org.state].filter(Boolean).length > 0 && <span className="cyr-chip">{[org.city, org.state].filter(Boolean).join(", ")}</span>}
            {org.subsection_code && <span className="cyr-chip" style={{ background: "#F1F5FB", color: C.muted }}>{org.subsection_code}</span>}
            {org.ein && <span className="cyr-chip" style={{ background: "#F1F5FB", color: C.muted, fontFamily: "var(--cyr-mono)" }}>EIN {org.ein}</span>}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <TransparencyScore
          pctTransparent={transparency ? transparency.pct_transparent : null}
          disclosedAmount={transparency ? transparency.disclosed_dollar_level : 0}
          undisclosedAmount={transparency ? transparency.undisclosed_amount : 0}
          fiscalYear={transparency ? transparency.fiscal_year : (revenue[0] && revenue[0].fiscal_year)}
        />
      </div>

      {/* Reported revenue by year */}
      {revenue.length > 0 && (
        <Panel eyebrow="Form 990" title="Reported revenue" pad={0}>
          {revenue.map((r, i) => (
            <Row key={i} last={i === revenue.length - 1} left={`FY${r.fiscal_year}`}
              right={`${usd(r.total_revenue)} total · ${usd(r.contributions_grants_total)} contributions/grants`} />
          ))}
        </Panel>
      )}

      {/* Dollar-level funding events */}
      <Panel eyebrow="Dollar-level disclosures" title={`Traceable funding events (${events.length})`} pad={0}>
        {events.length === 0
          ? <SmallEmpty>No dollar-level disclosures on record yet.</SmallEmpty>
          : events.map((e, i) => (
            <Row key={i} last={i === events.length - 1}
              left={`${SOURCE_LABELS[e.source_type] || e.source_type} · ${e.source_name || ""}`}
              sub={e.description || ""}
              right={`${usd(e.amount)}${e.fiscal_year ? ` · FY${e.fiscal_year}` : ""}`} />
          ))}
      </Panel>

      {/* Grants made */}
      {grants.length > 0 && (
        <Panel eyebrow="Schedule I" title={`Grants made (${grants.length})`} pad={0}>
          {grants.map((g, i) => (
            <Row key={i} last={i === grants.length - 1} left={g.recipient_name || "Unnamed recipient"} sub={g.purpose || ""}
              right={`${usd(g.amount)}${g.fiscal_year ? ` · FY${g.fiscal_year}` : ""}`} />
          ))}
        </Panel>
      )}
    </div>
  );
}

// ---- small presentational helpers ----
function Intro({ eyebrow, title, children }) {
  return (
    <div className="cyr-card cyr-rise" style={{ padding: "18px 20px", marginBottom: 16, background: "linear-gradient(120deg,#FFFFFF 45%,#EEF4FF)" }}>
      <div className="cyr-eyebrow" style={{ fontSize: 11 }}>{eyebrow}</div>
      <h2 className="cyr-h2" style={{ fontSize: "clamp(21px, 2.6vw, 26px)", marginTop: 6 }}>{title}</h2>
      <div style={{ fontSize: 14.5, color: "#475569", lineHeight: 1.6, marginTop: 6, maxWidth: 720 }}>{children}</div>
    </div>
  );
}
function FilterBar({ children }) {
  return (
    <div className="cyr-card" style={{ padding: 14, marginBottom: 16, display: "grid", gap: 12,
                                       gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
      {children}
    </div>
  );
}
function Select({ label, value, onChange, options, labelFor }) {
  return (
    <label style={{ fontSize: 12.5, fontWeight: 700, color: C.muted, display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      {label}
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ fontSize: 14, fontWeight: 600, color: C.ink, padding: "10px 12px", border: `1px solid ${C.line}`, borderRadius: 12,
                 background: "#fff", width: "100%", minHeight: 42 }}>
        <option value="">All</option>
        {options.map(o => <option key={o} value={o}>{labelFor ? labelFor(o) : o}</option>)}
      </select>
    </label>
  );
}
function Row({ left, sub, right, last }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 20px", flexWrap: "wrap",
                  borderBottom: last ? "none" : "1px solid #EEF2F8" }}>
      <div style={{ flex: "1 1 220px", minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: C.navy, overflowWrap: "anywhere" }}>{left}</div>
        {sub ? <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.5, marginTop: 2 }}>{sub}</div> : null}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, textAlign: "right", marginLeft: "auto" }}>{right}</div>
    </div>
  );
}
function SmallEmpty({ children }) {
  return <div style={{ padding: "16px 20px", fontSize: 14, color: C.muted }}>{children}</div>;
}
