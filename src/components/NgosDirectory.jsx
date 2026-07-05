// =============================================================================
// NgosDirectory.jsx - the NGOs section. Follows the same state-view pattern as
// the Bills and Roll Call sections (this app has no router), reading from the
// funding transparency endpoints.
//
// List: filter by state, source type, and fiscal year. Click an org for its
// detail page, which renders TransparencyScore from org_funding_transparency
// plus the dollar-level funding events, reported revenue, and grants made.
// =============================================================================
import React, { useState, useEffect, useCallback } from "react";
import TransparencyScore from "./TransparencyScore.jsx";

const C = {
  navy: "#0A1A3F", gold: "#C9A227", crimson: "#8B0000", parchment: "#FBF7EC",
  ink: "#1A1A1A", muted: "#5C5347", line: "#D8C9A0", green: "#1B5E20", red: "#B71C1C",
};
const serif = "Georgia, 'Times New Roman', serif";

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
    <div style={{ fontFamily: serif, color: C.ink, maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ background: C.navy, color: "#fff", padding: "22px 24px", borderRadius: 8,
                    border: `3px solid ${C.gold}`, marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, color: C.gold, textTransform: "uppercase", marginBottom: 8 }}>
          NGO Funding Transparency
        </div>
        <div style={{ fontSize: 14, color: "#cfd6e4", lineHeight: 1.6 }}>
          How much of each organization's reported revenue can be traced to a dollar-level
          public disclosure, versus the portion that is legally aggregate-only. Every dollar
          that is disclosed is tracked; what the law does not require to be itemized is shown
          honestly as untraceable, not as wrongdoing.
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <Select label="State" value={filters.state} onChange={v => setFilters(f => ({ ...f, state: v }))}
          options={facets.states} />
        <Select label="Source type" value={filters.sourceType} onChange={v => setFilters(f => ({ ...f, sourceType: v }))}
          options={facets.sourceTypes} labelFor={(o) => SOURCE_LABELS[o] || o} />
        <Select label="Fiscal year" value={filters.fiscalYear} onChange={v => setFilters(f => ({ ...f, fiscalYear: v }))}
          options={facets.fiscalYears} />
      </div>

      {phase === "loading" && orgs.length === 0 && <Center>Loading organizations...</Center>}
      {phase === "error" && (
        <Center color={C.crimson}>Could not load organizations. <Link onClick={() => loadList(0, false)}>Try again</Link></Center>
      )}
      {phase === "notready" && (
        <Center>
          The NGO funding database is not loaded yet. Run the schema migration and the
          funding ETLs, then this list will populate.
        </Center>
      )}
      {phase === "ready" && orgs.length === 0 && <Center>No organizations match these filters yet.</Center>}

      {orgs.length > 0 && (
        <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 8, overflow: "hidden" }}>
          {orgs.map((o, i) => {
            const pct = o.pct_transparent;
            const barColor = pct == null ? "#ccc" : pct >= 75 ? C.green : pct >= 40 ? C.gold : C.red;
            return (
              <button key={o.id} onClick={() => setSelected(o.id)}
                style={{ width: "100%", textAlign: "left", cursor: "pointer", background: "transparent",
                         border: "none", borderBottom: i < orgs.length - 1 ? `1px solid #ece7d5` : "none",
                         padding: "12px 16px", display: "flex", alignItems: "center", gap: 14, fontFamily: serif }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: C.navy, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {o.name}
                  </div>
                  <div style={{ fontSize: 11.5, color: C.muted }}>
                    {o.state || "??"}{o.subsection_code ? ` · ${o.subsection_code}` : ""} · FY{o.fiscal_year} · Revenue {usd(o.total_revenue)}
                  </div>
                </div>
                <div style={{ width: 120, flexShrink: 0 }}>
                  <div style={{ height: 7, borderRadius: 999, background: "#EDE6D0", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.min(pct || 0, 100)}%`, background: barColor }} />
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, textAlign: "right", marginTop: 2 }}>
                    {pct == null ? "no filing" : `${pct}% traceable`}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {phase === "ready" && hasMore && (
        <button onClick={() => loadList(offset + PAGE_SIZE, true)}
          style={{ width: "100%", padding: 12, fontFamily: serif, fontWeight: 700, fontSize: 13,
                   background: C.navy, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", marginTop: 10 }}>
          Load More Organizations
        </button>
      )}
      {phase === "loading" && orgs.length > 0 && (
        <div style={{ textAlign: "center", color: C.muted, fontSize: 12, padding: 8 }}>Loading more...</div>
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
    <button onClick={onBack}
      style={{ fontFamily: serif, fontSize: 13, fontWeight: 700, color: C.navy, background: "none",
               border: `1px solid ${C.line}`, borderRadius: 6, padding: "6px 14px", cursor: "pointer", marginBottom: 16 }}>
      ← All organizations
    </button>
  );

  if (phase === "loading") return <div style={{ fontFamily: serif, maxWidth: 900, margin: "0 auto" }}>{back}<Center>Loading organization...</Center></div>;
  if (phase === "error") return <div style={{ fontFamily: serif, maxWidth: 900, margin: "0 auto" }}>{back}<Center color={C.crimson}>Could not load this organization.</Center></div>;
  if (phase === "notready") return <div style={{ fontFamily: serif, maxWidth: 900, margin: "0 auto" }}>{back}<Center>The NGO funding database is not loaded yet.</Center></div>;

  const { org, transparency, events, revenue, grants } = data;

  return (
    <div style={{ fontFamily: serif, color: C.ink, maxWidth: 900, margin: "0 auto" }}>
      {back}

      <div style={{ background: C.navy, color: "#fff", padding: "20px 24px", borderRadius: 8, border: `3px solid ${C.gold}`, marginBottom: 18 }}>
        <div style={{ fontSize: 20, fontWeight: 900 }}>{org.name}</div>
        <div style={{ fontSize: 12.5, color: "#cfd6e4", marginTop: 4 }}>
          {[org.city, org.state].filter(Boolean).join(", ")}
          {org.subsection_code ? ` · ${org.subsection_code}` : ""}
          {org.ein ? ` · EIN ${org.ein}` : ""}
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <TransparencyScore
          pctTransparent={transparency ? transparency.pct_transparent : null}
          disclosedAmount={transparency ? transparency.disclosed_dollar_level : 0}
          undisclosedAmount={transparency ? transparency.undisclosed_amount : 0}
          fiscalYear={transparency ? transparency.fiscal_year : (revenue[0] && revenue[0].fiscal_year)}
        />
      </div>

      {/* Reported revenue by year */}
      {revenue.length > 0 && (
        <Section title="Reported revenue">
          {revenue.map((r, i) => (
            <Row key={i} left={`FY${r.fiscal_year}`}
              right={`${usd(r.total_revenue)} total · ${usd(r.contributions_grants_total)} contributions/grants`} />
          ))}
        </Section>
      )}

      {/* Dollar-level funding events */}
      <Section title={`Traceable funding events (${events.length})`}>
        {events.length === 0
          ? <Empty>No dollar-level disclosures on record yet.</Empty>
          : events.map((e, i) => (
            <Row key={i}
              left={`${SOURCE_LABELS[e.source_type] || e.source_type} · ${e.source_name || ""}`}
              sub={e.description || ""}
              right={`${usd(e.amount)}${e.fiscal_year ? ` · FY${e.fiscal_year}` : ""}`} />
          ))}
      </Section>

      {/* Grants made */}
      {grants.length > 0 && (
        <Section title={`Grants made (${grants.length})`}>
          {grants.map((g, i) => (
            <Row key={i} left={g.recipient_name || "Unnamed recipient"} sub={g.purpose || ""}
              right={`${usd(g.amount)}${g.fiscal_year ? ` · FY${g.fiscal_year}` : ""}`} />
          ))}
        </Section>
      )}
    </div>
  );
}

// ---- small presentational helpers ----
function Select({ label, value, onChange, options, labelFor }) {
  return (
    <label style={{ fontFamily: serif, fontSize: 12, color: C.muted, display: "flex", flexDirection: "column", gap: 4 }}>
      {label}
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ fontFamily: serif, fontSize: 13, padding: "7px 10px", border: `1px solid ${C.line}`, borderRadius: 6, background: "#fff", minWidth: 140 }}>
        <option value="">All</option>
        {options.map(o => <option key={o} value={o}>{labelFor ? labelFor(o) : o}</option>)}
      </select>
    </label>
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
function Row({ left, sub, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderBottom: "1px solid #f0ead8" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: C.navy }}>{left}</div>
        {sub ? <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{sub}</div> : null}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, whiteSpace: "nowrap", flexShrink: 0 }}>{right}</div>
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
