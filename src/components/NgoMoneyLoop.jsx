// =============================================================================
// NgoMoneyLoop.jsx - the NGO Money Loop table inside the NGO Funding section.
//
// Reads /api/ngo-money-loop (the ngo_money_loop view): Colorado TRACER
// contributions from non-individual contributors, joined to the IRS identity
// of each contributor (via the human-reviewed name crosswalk), the org's
// latest 990 revenue, its Auto-Revocation status, and any federal award
// dollars already tracked by the USASpending pipeline.
//
// Sortable by amount and date, filterable by committee and 501(c)
// subsection. Follows the same palette and table styling as the rest of the
// Follow the Money tab.
// =============================================================================
import React, { useState, useEffect, useCallback } from "react";

const C = {
  navy: "#0A1A3F", gold: "#C9A227", crimson: "#8B0000", parchment: "#FBF7EC",
  ink: "#1A1A1A", muted: "#5C5347", line: "#D8C9A0", red: "#B71C1C",
};
const serif = "Georgia, 'Times New Roman', serif";

const usd = (n) => n == null ? "" :
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(n) || 0);

const fmtDate = (d) => {
  if (!d) return "";
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[2]}/${m[3]}/${m[1]}` : String(d);
};

const PAGE_SIZE = 25;

export default function NgoMoneyLoop() {
  const [phase, setPhase] = useState("loading"); // loading | ready | notready | error
  const [rows, setRows] = useState([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [facets, setFacets] = useState({ committees: [], subsections: [] });
  const [filters, setFilters] = useState({ committee: "", subsection: "" });
  const [sort, setSort] = useState({ col: "amount", dir: "desc" });

  const load = useCallback(async (newOffset, append) => {
    setPhase("loading");
    try {
      const p = new URLSearchParams({
        limit: String(PAGE_SIZE), offset: String(newOffset),
        sort: sort.col, dir: sort.dir,
      });
      if (filters.committee) p.set("committee", filters.committee);
      if (filters.subsection) p.set("subsection", filters.subsection);
      const r = await fetch(`/api/ngo-money-loop?${p}`);
      const d = await r.json();
      if (!d.ready) { setPhase("notready"); return; }
      setRows(prev => append ? [...prev, ...(d.rows || [])] : (d.rows || []));
      setOffset(d.offset ?? newOffset);
      setHasMore(!!d.hasMore);
      setFacets({ committees: d.committees || [], subsections: d.subsections || [] });
      setPhase("ready");
    } catch {
      setPhase("error");
    }
  }, [filters, sort]);

  useEffect(() => { load(0, false); }, [filters, sort, load]);

  const toggleSort = (col) => {
    setSort(s => s.col === col
      ? { col, dir: s.dir === "desc" ? "asc" : "desc" }
      : { col, dir: "desc" });
  };

  const arrow = (col) => sort.col === col ? (sort.dir === "desc" ? " ▼" : " ▲") : "";

  const sortableTh = (col, label, align) => (
    <th onClick={() => toggleSort(col)} title="Click to sort"
      style={{ ...thStyle, textAlign: align || "left", cursor: "pointer", userSelect: "none" }}>
      {label}{arrow(col)}
    </th>
  );

  return (
    <div style={{ fontFamily: serif, color: C.ink, maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ background: C.navy, color: "#fff", padding: "22px 24px", borderRadius: 8,
                    border: `3px solid ${C.gold}`, marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, color: C.gold, textTransform: "uppercase", marginBottom: 8 }}>
          NGO Money Loop
        </div>
        <div style={{ fontSize: 14, color: "#cfd6e4", lineHeight: 1.6 }}>
          Non-individual contributions to Colorado committees from the Secretary of State's
          TRACER disclosure system, matched to each contributor's IRS identity: legal name,
          501(c) status, and latest reported revenue from Form 990 data via ProPublica
          Nonprofit Explorer. Contributing is legal and publicly reported by design;
          appearing here does not imply wrongdoing.
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <Select label="Committee" value={filters.committee}
          onChange={v => setFilters(f => ({ ...f, committee: v }))} options={facets.committees} />
        <Select label="501(c) subsection" value={filters.subsection}
          onChange={v => setFilters(f => ({ ...f, subsection: v }))} options={facets.subsections} />
      </div>

      {phase === "loading" && rows.length === 0 && <Center>Loading the money loop...</Center>}
      {phase === "error" && (
        <Center color={C.crimson}>Could not load the money loop. <Link onClick={() => load(0, false)}>Try again</Link></Center>
      )}
      {phase === "notready" && (
        <Center>
          The NGO Money Loop database is not loaded yet. Run the etl-ngo-money schema and
          pipeline, then this table will populate.
        </Center>
      )}
      {phase === "ready" && rows.length === 0 && <Center>No contributions match these filters yet.</Center>}

      {rows.length > 0 && (
        <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 8, overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 900, fontFamily: serif }}>
            <thead>
              <tr style={{ background: C.parchment, borderBottom: `2px solid ${C.line}` }}>
                <th style={thStyle}>Contributor (TRACER)</th>
                <th style={thStyle}>IRS Legal Name</th>
                <th style={thStyle}>501(c)</th>
                <th style={thStyle}>Committee</th>
                {sortableTh("amount", "Amount", "right")}
                {sortableTh("date", "Date")}
                <th style={{ ...thStyle, textAlign: "right" }}>Org Revenue</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Federal $ Received</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.contribution_id}
                  style={{ borderBottom: i < rows.length - 1 ? "1px solid #ece7d5" : "none" }}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 700, color: C.navy }}>{r.contributor_name}</div>
                    {r.match_status === "candidate" && (
                      <span title="This name match is machine-suggested and has not been human-reviewed yet"
                        style={{ fontSize: 10, fontWeight: 700, color: C.muted, border: `1px solid ${C.line}`,
                                 borderRadius: 4, padding: "1px 5px" }}>
                        UNREVIEWED MATCH
                      </span>
                    )}
                  </td>
                  <td style={tdStyle}>
                    {r.propublica_url ? (
                      <a href={r.propublica_url} target="_blank" rel="noopener noreferrer"
                        style={{ color: C.navy, fontWeight: 700 }}>
                        {r.legal_name}
                      </a>
                    ) : (
                      <span style={{ fontWeight: 700 }}>{r.legal_name}</span>
                    )}
                    {r.exemption_revoked && (
                      <span title={`On the IRS Auto-Revocation List${r.revocation_date ? `, revoked ${fmtDate(r.revocation_date)}` : ""}`}
                        style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: "#fff", background: C.red,
                                 borderRadius: 4, padding: "2px 6px", whiteSpace: "nowrap", verticalAlign: "middle" }}>
                        EXEMPTION REVOKED
                      </span>
                    )}
                  </td>
                  <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>{r.subsection || ""}</td>
                  <td style={tdStyle}>{r.committee_name}</td>
                  <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700, whiteSpace: "nowrap" }}>{usd(r.amount)}</td>
                  <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>{fmtDate(r.contribution_date)}</td>
                  <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap", color: C.muted }}>
                    {r.total_revenue != null
                      ? `${usd(r.total_revenue)}${r.revenue_fiscal_year ? ` (FY${r.revenue_fiscal_year})` : ""}`
                      : "no filing"}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap", color: C.muted }}>
                    {r.federal_funds_received != null ? usd(r.federal_funds_received) : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {phase === "ready" && hasMore && (
        <button onClick={() => load(offset + PAGE_SIZE, true)}
          style={{ width: "100%", padding: 12, fontFamily: serif, fontWeight: 700, fontSize: 13,
                   background: C.navy, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", marginTop: 10 }}>
          Load More Contributions
        </button>
      )}
      {phase === "loading" && rows.length > 0 && (
        <div style={{ textAlign: "center", color: C.muted, fontSize: 12, padding: 8 }}>Loading more...</div>
      )}

      <div style={{ fontSize: 11.5, color: C.muted, lineHeight: 1.6, marginTop: 14 }}>
        Sources: Colorado TRACER (Secretary of State) bulk contribution data, ProPublica
        Nonprofit Explorer / IRS Form 990 data, IRS Auto-Revocation List, USASpending.gov
        federal awards. Name matches marked unreviewed are machine-suggested and awaiting
        human confirmation.
      </div>
    </div>
  );
}

const thStyle = {
  fontFamily: serif, fontSize: 11, fontWeight: 700, color: "#5C5347", letterSpacing: 1,
  textTransform: "uppercase", textAlign: "left", padding: "10px 12px", whiteSpace: "nowrap",
};
const tdStyle = { fontSize: 13, padding: "10px 12px", verticalAlign: "top", lineHeight: 1.5 };

function Select({ label, value, onChange, options }) {
  return (
    <label style={{ fontFamily: serif, fontSize: 12, color: C.muted, display: "flex", flexDirection: "column", gap: 4 }}>
      {label}
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ fontFamily: serif, fontSize: 13, padding: "7px 10px", border: `1px solid ${C.line}`,
                 borderRadius: 6, background: "#fff", minWidth: 160, maxWidth: 320 }}>
        <option value="">All</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
function Center({ children, color }) {
  return <div style={{ textAlign: "center", padding: 40, color: color || C.muted, fontSize: 14.5, fontFamily: serif }}>{children}</div>;
}
function Link({ onClick, children }) {
  return <button onClick={onClick} style={{ background: "none", border: "none", color: C.crimson, fontFamily: serif, fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>{children}</button>;
}
