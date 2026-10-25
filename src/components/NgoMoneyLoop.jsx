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
//
// October 2026 redesign: intro card, filter card, a cyr-table inside a white
// Panel on wide screens and one card per contribution on phones (same rows,
// same sort state). Presentation only. No em dashes.
// =============================================================================
import React, { useState, useEffect, useCallback } from "react";
import { Loading, Empty as KitEmpty, ErrorBox } from "./ui/Kit.jsx";

const C = {
  navy: "#0E2A6B", blue: "#2563EB", red: "#E0313F", gold: "#F5B82E",
  ink: "#0F172A", muted: "#5B6578", line: "#E2E8F0", soft: "#F8FAFE",
};

// Wide screens get the table; phones get stacked cards built from the same rows.
const RESPONSIVE_CSS = `
.ftm-loop-cards { display: none; }
@media (max-width: 760px) {
  .ftm-loop-table { display: none; }
  .ftm-loop-cards { display: grid; }
}
`;

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
    <th onClick={() => toggleSort(col)} title="Click to sort" aria-sort={sort.col === col ? (sort.dir === "desc" ? "descending" : "ascending") : "none"}
      style={{ textAlign: align || "left", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap",
               color: sort.col === col ? C.navy : undefined }}>
      {label}{arrow(col)}
    </th>
  );

  return (
    <div style={{ color: C.ink, maxWidth: 1000, margin: "0 auto", minWidth: 0 }}>
      <style>{RESPONSIVE_CSS}</style>
      <div className="cyr-card cyr-rise" style={{ padding: "18px 20px", marginBottom: 16, background: "linear-gradient(120deg,#FFFFFF 45%,#EEF4FF)" }}>
        <div className="cyr-eyebrow" style={{ fontSize: 11 }}>NGO funding · Colorado</div>
        <h2 className="cyr-h2" style={{ fontSize: "clamp(21px, 2.6vw, 26px)", marginTop: 6 }}>NGO money loop</h2>
        <div style={{ fontSize: 14.5, color: "#475569", lineHeight: 1.6, marginTop: 6, maxWidth: 760 }}>
          Non-individual contributions to Colorado committees from the Secretary of State's
          TRACER disclosure system, matched to each contributor's IRS identity: legal name,
          501(c) status, and latest reported revenue from Form 990 data via ProPublica
          Nonprofit Explorer. Contributing is legal and publicly reported by design;
          appearing here does not imply wrongdoing.
        </div>
      </div>

      {/* Filters */}
      <div className="cyr-card" style={{ padding: 14, marginBottom: 16, display: "grid", gap: 12,
                                         gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))" }}>
        <Select label="Committee" value={filters.committee}
          onChange={v => setFilters(f => ({ ...f, committee: v }))} options={facets.committees} />
        <Select label="501(c) subsection" value={filters.subsection}
          onChange={v => setFilters(f => ({ ...f, subsection: v }))} options={facets.subsections} />
      </div>

      {phase === "loading" && rows.length === 0 && <Loading rows={6} height={60} />}
      {phase === "error" && (
        <ErrorBox onRetry={() => load(0, false)}>Could not load the money loop.</ErrorBox>
      )}
      {phase === "notready" && (
        <div className="cyr-card"><KitEmpty icon="🔁" title="Not loaded yet">
          The NGO Money Loop database is not loaded yet. Run the etl-ngo-money schema and
          pipeline, then this table will populate.
        </KitEmpty></div>
      )}
      {phase === "ready" && rows.length === 0 && (
        <div className="cyr-card"><KitEmpty icon="🔎" title="No matches">No contributions match these filters yet.</KitEmpty></div>
      )}

      {rows.length > 0 && (
        <>
          <div className="cyr-card ftm-loop-table" style={{ padding: 0, overflowX: "auto" }}>
            <table className="cyr-table" style={{ minWidth: 860 }}>
              <thead>
                <tr>
                  <th style={{ minWidth: 170 }}>Contributor (TRACER)</th>
                  <th style={{ minWidth: 190 }}>IRS legal name · 501(c)</th>
                  <th style={{ minWidth: 160 }}>Committee</th>
                  {sortableTh("amount", "Amount", "right")}
                  {sortableTh("date", "Date")}
                  <th style={{ textAlign: "right", whiteSpace: "nowrap" }}>Org revenue</th>
                  <th style={{ textAlign: "right", whiteSpace: "nowrap" }}>Federal $ received</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.contribution_id}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 700, color: C.navy }}>{r.contributor_name}</div>
                      {r.match_status === "candidate" && <UnreviewedChip />}
                    </td>
                    <td style={tdStyle}>
                      <LegalName r={r} />
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                        {r.subsection && <span className="cyr-chip" style={{ fontSize: 11, padding: "2px 8px" }}>{r.subsection}</span>}
                        {r.exemption_revoked && <RevokedChip r={r} />}
                      </div>
                    </td>
                    <td style={{ ...tdStyle, fontSize: 12.5 }}>{r.committee_name}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{usd(r.amount)}</td>
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

          <div className="ftm-loop-cards" style={{ gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: C.muted }}>Sort by</span>
              {[["amount", "Amount"], ["date", "Date"]].map(([col, label]) => (
                <button key={col} onClick={() => toggleSort(col)} className="cyr-chip"
                  style={{ border: 0, cursor: "pointer", minHeight: 34, padding: "6px 12px",
                           background: sort.col === col ? C.navy : undefined, color: sort.col === col ? "#fff" : undefined }}>
                  {label}{arrow(col)}
                </button>
              ))}
            </div>
            {rows.map((r) => (
              <div key={r.contribution_id} className="cyr-card" style={{ padding: 14, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, color: C.navy, fontSize: 14.5, overflowWrap: "anywhere" }}>{r.contributor_name}</div>
                    <div style={{ fontSize: 12.5, color: C.muted, marginTop: 2 }}>{fmtDate(r.contribution_date)}</div>
                  </div>
                  <div className="cyr-num" style={{ fontSize: 19, color: C.ink, whiteSpace: "nowrap" }}>{usd(r.amount)}</div>
                </div>
                <div style={{ fontSize: 13, color: C.ink, marginTop: 8, lineHeight: 1.45, overflowWrap: "anywhere" }}>
                  <span style={{ color: C.muted }}>To </span>{r.committee_name}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginTop: 8, fontSize: 13 }}>
                  <LegalName r={r} />
                  {r.subsection && <span className="cyr-chip" style={{ fontSize: 11, padding: "2px 8px" }}>{r.subsection}</span>}
                  {r.match_status === "candidate" && <UnreviewedChip />}
                  {r.exemption_revoked && <RevokedChip r={r} />}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", fontSize: 12, color: C.muted, marginTop: 8 }}>
                  <span>Org revenue: {r.total_revenue != null
                    ? `${usd(r.total_revenue)}${r.revenue_fiscal_year ? ` (FY${r.revenue_fiscal_year})` : ""}`
                    : "no filing"}</span>
                  {r.federal_funds_received != null && <span>Federal $ received: {usd(r.federal_funds_received)}</span>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {phase === "ready" && hasMore && (
        <button onClick={() => load(offset + PAGE_SIZE, true)} className="cyr-btn cyr-btn-ghost"
          style={{ width: "100%", justifyContent: "center", marginTop: 14, padding: 14 }}>
          Load more contributions
        </button>
      )}
      {phase === "loading" && rows.length > 0 && (
        <div style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: 10 }}>Loading more...</div>
      )}

      <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.6, marginTop: 16 }}>
        Sources: Colorado TRACER (Secretary of State) bulk contribution data, ProPublica
        Nonprofit Explorer / IRS Form 990 data, IRS Auto-Revocation List, USASpending.gov
        federal awards. Name matches marked unreviewed are machine-suggested and awaiting
        human confirmation.
      </div>
    </div>
  );
}

const tdStyle = { fontSize: 13.5, verticalAlign: "top", lineHeight: 1.5 };

function LegalName({ r }) {
  return r.propublica_url ? (
    <a href={r.propublica_url} target="_blank" rel="noopener noreferrer"
      style={{ color: C.blue, fontWeight: 700, textDecoration: "none" }}>
      {r.legal_name}
    </a>
  ) : (
    <span style={{ fontWeight: 700 }}>{r.legal_name}</span>
  );
}
function UnreviewedChip() {
  return (
    <span title="This name match is machine-suggested and has not been human-reviewed yet" className="cyr-chip"
      style={{ fontSize: 10.5, padding: "2px 8px", marginTop: 4, background: "#F1F5FB", color: C.muted }}>
      Unreviewed match
    </span>
  );
}
function RevokedChip({ r }) {
  return (
    <span title={`On the IRS Auto-Revocation List${r.revocation_date ? `, revoked ${fmtDate(r.revocation_date)}` : ""}`} className="cyr-chip"
      style={{ fontSize: 10.5, padding: "2px 8px", background: "#FDECEE", color: "#B91C1C", whiteSpace: "nowrap", verticalAlign: "middle" }}>
      Exemption revoked
    </span>
  );
}
function Select({ label, value, onChange, options }) {
  return (
    <label style={{ fontSize: 12.5, fontWeight: 700, color: C.muted, display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      {label}
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ fontSize: 14, fontWeight: 600, color: C.ink, padding: "10px 12px", border: `1px solid ${C.line}`,
                 borderRadius: 12, background: "#fff", width: "100%", minHeight: 42, textOverflow: "ellipsis" }}>
        <option value="">All</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
