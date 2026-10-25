// =============================================================================
// SocialSecurityPanel.jsx - Social Security (OASDI) sub-section of Follow the
// Money. State-level beneficiary and benefit figures from ssa_oasdi_state,
// sourced from the Social Security Administration. The visitor's own state
// (from their matched district) is pinned to the top, everything else is
// browsable below.
//
// October 2026 redesign: intro card, StatGrid for the visitor's own state,
// and state rows (cyr-row, cyr-row-mine for home) inside a Panel with a pill
// search. Presentation only. No em dashes.
// =============================================================================
import React, { useState, useEffect } from "react";
import { Panel, StatGrid, Loading, Empty as KitEmpty, ErrorBox } from "./ui/Kit.jsx";

const C = {
  navy: "#0E2A6B", blue: "#2563EB", red: "#E0313F", gold: "#F5B82E",
  ink: "#0F172A", muted: "#5B6578", line: "#E2E8F0",
};

const num = (n) => n == null ? "0" : new Intl.NumberFormat("en-US").format(Number(n));
const usd = (n) => n == null ? "$0" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(n));

function parts(row) {
  const retirement = (row.retirement_workers || 0) + (row.retirement_spouses || 0) + (row.retirement_children || 0);
  const survivors = (row.survivors_widowers_parents || 0) + (row.survivors_children || 0);
  const disability = (row.disability_workers || 0) + (row.disability_spouses || 0) + (row.disability_children || 0);
  return { retirement, survivors, disability };
}

function StateRow({ row, highlighted }) {
  const { retirement, survivors, disability } = parts(row);
  const total = retirement + survivors + disability;
  const seg = (v, color) => v > 0 && total > 0 ? <span style={{ flex: v, background: color }} /> : null;
  return (
    <div className={highlighted ? "cyr-row cyr-row-mine" : "cyr-row"} style={{ flexWrap: "wrap", rowGap: 8 }}>
      <span aria-hidden className="cyr-chip" style={{ fontFamily: "var(--cyr-mono)", minWidth: 42, justifyContent: "center", flexShrink: 0 }}>
        {row.state_abbr || "?"}
      </span>
      <div style={{ flex: "1 1 200px", minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: C.ink }}>
          {row.state} {row.state_abbr ? `(${row.state_abbr})` : ""}
        </div>
        <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.5 }}>
          {num(retirement)} retirement &middot; {num(survivors)} survivors &middot; {num(disability)} disability
        </div>
        {total > 0 && (
          <div aria-hidden style={{ display: "flex", gap: 2, height: 6, borderRadius: 99, overflow: "hidden", marginTop: 6, maxWidth: 320 }}>
            {seg(retirement, "#2563EB")}{seg(survivors, "#F5B82E")}{seg(disability, "#E0313F")}
          </div>
        )}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, flexShrink: 0, textAlign: "right", marginLeft: "auto" }}>
        <span className="cyr-num" style={{ fontSize: 17, color: C.navy }}>{num(row.total_beneficiaries)}</span> beneficiaries
        {row.total_monthly_benefits != null && (
          <div style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>{usd(row.total_monthly_benefits)} per month</div>
        )}
      </div>
    </div>
  );
}

export default function SocialSecurityPanel({ district }) {
  const [phase, setPhase] = useState("loading"); // loading | ready | notready | error
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState("");
  const [errorDetail, setErrorDetail] = useState(null);

  const homeState = district ? String(district).split("-")[0].toUpperCase() : null;

  useEffect(() => {
    let cancelled = false;
    fetch("/api/social-security-detail")
      .then(async r => {
        const d = await r.json().catch(() => null);
        return { httpOk: r.ok, httpStatus: r.status, d };
      })
      .then(({ httpOk, httpStatus, d }) => {
        if (cancelled) return;
        // A real server error has no ready field at all, distinct from the
        // handler's own ready:false for a genuinely missing table. Treating
        // them the same hid real bugs behind a generic message before.
        if (!httpOk || !d || d.ready === undefined) {
          console.error("Social Security data fetch failed", { httpOk, httpStatus, d });
          setErrorDetail(d?.detail || d?.error || `HTTP ${httpStatus}`);
          setPhase("error");
          return;
        }
        if (!d.ready) { setPhase("notready"); return; }
        setRows(d.rows || []);
        setPhase("ready");
      })
      .catch(err => {
        if (cancelled) return;
        console.error("Social Security data fetch threw", err);
        setErrorDetail(String(err.message || err));
        setPhase("error");
      });
    return () => { cancelled = true; };
  }, []);

  if (phase === "loading") return <div style={{ maxWidth: 900, margin: "0 auto" }}><Loading rows={6} height={70} /></div>;
  if (phase === "error") {
    return (
      <ErrorBox>
        Could not load Social Security data.
        {errorDetail && <span style={{ display: "block", fontSize: 11.5, fontWeight: 500, marginTop: 4, fontFamily: "var(--cyr-mono)" }}>{errorDetail}</span>}
      </ErrorBox>
    );
  }
  if (phase === "notready") return <div className="cyr-card"><KitEmpty icon="🧓" title="Not loaded yet">Social Security data has not been loaded yet.</KitEmpty></div>;

  const home = homeState ? rows.find(r => r.state_abbr === homeState) : null;
  const q = query.trim().toLowerCase();
  const others = rows
    .filter(r => r.state_abbr !== homeState)
    .filter(r => !q || r.state.toLowerCase().includes(q) || (r.state_abbr || "").toLowerCase().includes(q));

  const year = rows[0]?.data_year;

  const homeParts = home ? parts(home) : null;

  return (
    <div style={{ color: C.ink, maxWidth: 900, margin: "0 auto", minWidth: 0 }}>
      <div className="cyr-card cyr-rise" style={{ padding: "18px 20px", marginBottom: 16, background: "linear-gradient(120deg,#FFFFFF 45%,#EEF4FF)" }}>
        <div className="cyr-eyebrow" style={{ fontSize: 11 }}>Social Security Administration</div>
        <h2 className="cyr-h2" style={{ fontSize: "clamp(21px, 2.6vw, 26px)", marginTop: 6 }}>
          Social Security (OASDI){year ? ` ${year} data` : ""}
        </h2>
        <div style={{ fontSize: 14.5, color: "#475569", lineHeight: 1.6, marginTop: 6 }}>
          Retirement, survivors, and disability insurance beneficiaries and monthly benefit totals, by state.
          Source: Social Security Administration.
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 10, fontSize: 12.5, color: C.muted }}>
          {[["#2563EB", "Retirement"], ["#F5B82E", "Survivors"], ["#E0313F", "Disability"]].map(([c, l]) => (
            <span key={l} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span aria-hidden style={{ width: 10, height: 10, borderRadius: 3, background: c }} />{l}
            </span>
          ))}
        </div>
      </div>

      {home && (
        <>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: C.navy, margin: "4px 0 10px" }}>Your state: {home.state}</div>
          <StatGrid min={140} items={[
            { value: num(home.total_beneficiaries), label: "Beneficiaries", tone: "navy",
              hint: home.total_monthly_benefits != null ? `${usd(home.total_monthly_benefits)} per month` : undefined },
            { value: num(homeParts.retirement), label: "Retirement", tone: "blue" },
            { value: num(homeParts.survivors), label: "Survivors", tone: "gold" },
            { value: num(homeParts.disability), label: "Disability", tone: "red" },
          ]} />
        </>
      )}

      <Panel eyebrow="Browse" title={`All states and territories (${others.length})`} pad={14}>
        <div style={{ position: "relative", marginBottom: 12 }}>
          <span aria-hidden style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 14, opacity: .55 }}>🔎</span>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by state..."
            aria-label="Search by state"
            style={{ width: "100%", fontSize: 14.5, padding: "11px 14px 11px 38px",
                     border: `1px solid ${C.line}`, borderRadius: 999, boxSizing: "border-box" }}
          />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 8 }}>
          {home && <StateRow row={home} highlighted />}
          {others.length === 0
            ? <div style={{ padding: "8px 4px", fontSize: 14, color: C.muted }}>No states match that search.</div>
            : others.map((r, i) => <StateRow key={i} row={r} />)}
        </div>
      </Panel>
    </div>
  );
}
