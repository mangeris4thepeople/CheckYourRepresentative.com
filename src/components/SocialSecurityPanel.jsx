// =============================================================================
// SocialSecurityPanel.jsx - Social Security (OASDI) sub-section of Follow the
// Money. State-level beneficiary and benefit figures from ssa_oasdi_state,
// sourced from the Social Security Administration. The visitor's own state
// (from their matched district) is pinned to the top, everything else is
// browsable below.
// =============================================================================
import React, { useState, useEffect } from "react";

const C = {
  navy: "#0A1A3F", gold: "#C9A227", crimson: "#8B0000", parchment: "#FBF7EC",
  ink: "#1A1A1A", muted: "#5C5347", line: "#D8C9A0",
};
const serif = "Georgia, 'Times New Roman', serif";

const num = (n) => n == null ? "0" : new Intl.NumberFormat("en-US").format(Number(n));
const usd = (n) => n == null ? "$0" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(n));

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>{title}</div>
      <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 8, overflow: "hidden" }}>{children}</div>
    </div>
  );
}

function StateRow({ row, highlighted }) {
  const retirement = (row.retirement_workers || 0) + (row.retirement_spouses || 0) + (row.retirement_children || 0);
  const survivors = (row.survivors_widowers_parents || 0) + (row.survivors_children || 0);
  const disability = (row.disability_workers || 0) + (row.disability_spouses || 0) + (row.disability_children || 0);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
                  borderBottom: "1px solid #f0ead8", background: highlighted ? C.parchment : "transparent" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: C.navy }}>
          {row.state} {row.state_abbr ? `(${row.state_abbr})` : ""}
        </div>
        <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
          {num(retirement)} retirement &middot; {num(survivors)} survivors &middot; {num(disability)} disability
        </div>
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, whiteSpace: "nowrap", flexShrink: 0, textAlign: "right" }}>
        {num(row.total_beneficiaries)} beneficiaries
        {row.total_monthly_benefits != null && (
          <div style={{ fontSize: 11.5, color: C.muted, fontWeight: 400 }}>{usd(row.total_monthly_benefits)} per month</div>
        )}
      </div>
    </div>
  );
}

function Center({ children, color }) {
  return <div style={{ textAlign: "center", padding: 40, color: color || C.muted, fontSize: 14.5, fontFamily: serif }}>{children}</div>;
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

  if (phase === "loading") return <Center>Loading Social Security data...</Center>;
  if (phase === "error") {
    return (
      <Center color={C.crimson}>
        Could not load Social Security data.
        {errorDetail && (
          <div style={{ fontSize: 11.5, color: C.muted, marginTop: 8, fontFamily: "monospace" }}>{errorDetail}</div>
        )}
      </Center>
    );
  }
  if (phase === "notready") return <Center>Social Security data has not been loaded yet.</Center>;

  const home = homeState ? rows.find(r => r.state_abbr === homeState) : null;
  const q = query.trim().toLowerCase();
  const others = rows
    .filter(r => r.state_abbr !== homeState)
    .filter(r => !q || r.state.toLowerCase().includes(q) || (r.state_abbr || "").toLowerCase().includes(q));

  const year = rows[0]?.data_year;

  return (
    <div style={{ fontFamily: serif, color: C.ink, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.navy }}>
          Social Security (OASDI){year ? ` ${year} data` : ""}
        </div>
        <div style={{ fontSize: 12.5, color: C.muted, marginTop: 4 }}>
          Retirement, survivors, and disability insurance beneficiaries and monthly benefit totals, by state.
          Source: Social Security Administration.
        </div>
      </div>

      {home && (
        <Section title="Your state">
          <StateRow row={home} highlighted />
        </Section>
      )}

      <Section title={`All states and territories (${others.length})`}>
        <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.line}` }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by state..."
            style={{ width: "100%", fontFamily: serif, fontSize: 13, padding: "8px 10px",
                     border: `1px solid ${C.line}`, borderRadius: 6, boxSizing: "border-box" }}
          />
        </div>
        {others.length === 0
          ? <div style={{ padding: "14px", fontSize: 13, color: C.muted }}>No states match that search.</div>
          : others.map((r, i) => <StateRow key={i} row={r} />)}
      </Section>
    </div>
  );
}
