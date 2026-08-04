// =============================================================================
// AdminCrosswalk.jsx - the /admin/crosswalk review queue.
//
// Lists ngo_name_crosswalk rows with status 'candidate': each is a machine
// suggested match between a TRACER contributor name and an IRS organization
// from ProPublica Nonprofit Explorer. Confirm or Reject updates status and
// reviewed_at through /api/crosswalk-review.
//
// Admin only: the API checks the signed-in session's email against the
// ADMIN_EMAILS env var, so this page is useless without an admin session.
// It reuses the stored session token from normal sign-in (My Profile).
// =============================================================================
import React, { useState, useEffect, useCallback } from "react";
import { getStoredSession } from "../lib/session.js";

const C = {
  navy: "#0A1A3F", gold: "#C9A227", crimson: "#8B0000", parchment: "#FBF7EC",
  ink: "#1A1A1A", muted: "#5C5347", line: "#D8C9A0", green: "#1B5E20", red: "#B71C1C",
};
const serif = "Georgia, 'Times New Roman', serif";

const usd = (n) => n == null ? "" :
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(n) || 0);

export default function AdminCrosswalk() {
  const session = getStoredSession();
  const [phase, setPhase] = useState("loading"); // loading | ready | denied | notready | error
  const [rows, setRows] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [done, setDone] = useState({}); // id -> "confirmed" | "rejected"

  const load = useCallback(async () => {
    if (!session?.token) { setPhase("denied"); return; }
    setPhase("loading");
    try {
      const r = await fetch(`/api/crosswalk-list?token=${encodeURIComponent(session.token)}`);
      if (r.status === 401 || r.status === 403) { setPhase("denied"); return; }
      const d = await r.json();
      if (!d.ready) { setPhase("notready"); return; }
      setRows(d.rows || []);
      setDone({});
      setPhase("ready");
    } catch {
      setPhase("error");
    }
  }, [session?.token]);

  useEffect(() => { load(); }, [load]);

  async function review(id, action) {
    setBusyId(id);
    try {
      const r = await fetch("/api/crosswalk-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: session.token, id, action }),
      });
      if (r.ok) {
        setDone(d => ({ ...d, [id]: action === "confirm" ? "confirmed" : "rejected" }));
      }
    } catch {}
    setBusyId(null);
  }

  return (
    <div style={{ fontFamily: serif, color: C.ink, background: C.parchment, minHeight: "100vh", padding: "24px 16px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ background: C.navy, color: "#fff", padding: "22px 24px", borderRadius: 8,
                      border: `3px solid ${C.gold}`, marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, color: C.gold, textTransform: "uppercase", marginBottom: 8 }}>
            Admin · Crosswalk Review
          </div>
          <div style={{ fontSize: 14, color: "#cfd6e4", lineHeight: 1.6 }}>
            Each row is a machine-suggested match between a TRACER contributor name and an
            IRS organization. Confirm it if they are the same organization, reject it if not.
            Confirmed matches show as verified in the NGO Money Loop; rejected ones disappear
            from it entirely.
          </div>
          <div style={{ marginTop: 10 }}>
            <a href="/?tab=followthemoney&ftm=ngo-funding"
              style={{ color: C.gold, fontSize: 13, fontWeight: 700 }}>← Back to the site</a>
          </div>
        </div>

        {phase === "loading" && <Center>Loading review queue...</Center>}
        {phase === "error" && <Center color={C.crimson}>Could not load the queue. <Link onClick={load}>Try again</Link></Center>}
        {phase === "notready" && <Center>The crosswalk tables are not loaded yet. Run the etl-ngo-money pipeline first.</Center>}
        {phase === "denied" && (
          <Center color={C.crimson}>
            Not authorized. Sign in on <a href="/?tab=profile" style={{ color: C.crimson }}>My Profile</a> with
            an admin account first (the account's email must be listed in the ADMIN_EMAILS environment variable).
          </Center>
        )}
        {phase === "ready" && rows.length === 0 && <Center>No candidates waiting for review. All caught up.</Center>}

        {phase === "ready" && rows.length > 0 && (
          <>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 10 }}>
              {rows.length} candidate{rows.length === 1 ? "" : "s"} waiting, biggest dollars first.
              <button onClick={load} style={{ marginLeft: 10, background: "none", border: "none", color: C.crimson,
                fontFamily: serif, fontWeight: 700, cursor: "pointer", textDecoration: "underline", fontSize: 13 }}>
                Refresh
              </button>
            </div>
            {rows.map((r) => {
              const decided = done[r.id];
              return (
                <div key={r.id}
                  style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 8, padding: "14px 16px",
                           marginBottom: 10, opacity: decided ? 0.55 : 1 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
                    {/* TRACER side */}
                    <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                      <div style={sideLabel}>TRACER contributor</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: C.navy }}>{r.contributor_name || r.contributor_normalized}</div>
                      <div style={{ fontSize: 12, color: C.muted }}>
                        {r.contribution_count || 0} contribution{(r.contribution_count || 0) === 1 ? "" : "s"} · {usd(r.total_amount)} total
                      </div>
                    </div>
                    {/* IRS side */}
                    <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                      <div style={sideLabel}>Suggested IRS organization</div>
                      <div style={{ fontSize: 15, fontWeight: 700 }}>
                        {r.propublica_url
                          ? <a href={r.propublica_url} target="_blank" rel="noopener noreferrer" style={{ color: C.navy }}>{r.legal_name}</a>
                          : r.legal_name}
                        {r.exemption_revoked && (
                          <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: "#fff", background: C.red,
                                         borderRadius: 4, padding: "2px 6px", verticalAlign: "middle" }}>
                            EXEMPTION REVOKED
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: C.muted }}>
                        EIN {r.ein}{r.subsection ? ` · ${r.subsection}` : ""}
                        {[r.city, r.state].filter(Boolean).length ? ` · ${[r.city, r.state].filter(Boolean).join(", ")}` : ""}
                        {r.total_revenue != null ? ` · Revenue ${usd(r.total_revenue)}` : ""}
                      </div>
                      <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>
                        {r.match_method === "exact_name" ? "Exact name match" : "Best search hit"}
                        {r.confidence != null ? ` · confidence ${Number(r.confidence).toFixed(2)}` : ""}
                      </div>
                    </div>
                    {/* Actions */}
                    <div style={{ flexShrink: 0, display: "flex", gap: 8, alignItems: "center" }}>
                      {decided ? (
                        <span style={{ fontSize: 13, fontWeight: 700, color: decided === "confirmed" ? C.green : C.red }}>
                          {decided === "confirmed" ? "✓ Confirmed" : "✕ Rejected"}
                        </span>
                      ) : (
                        <>
                          <button disabled={busyId === r.id} onClick={() => review(r.id, "confirm")}
                            style={{ ...actBtn, background: C.green }}>
                            ✓ Confirm
                          </button>
                          <button disabled={busyId === r.id} onClick={() => review(r.id, "reject")}
                            style={{ ...actBtn, background: C.red }}>
                            ✕ Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

const sideLabel = {
  fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase",
  color: "#5C5347", marginBottom: 3,
};
const actBtn = {
  fontFamily: serif, fontSize: 13, fontWeight: 700, color: "#fff", border: "none",
  borderRadius: 6, padding: "9px 14px", cursor: "pointer",
};
function Center({ children, color }) {
  return <div style={{ textAlign: "center", padding: 40, color: color || C.muted, fontSize: 14.5, fontFamily: serif }}>{children}</div>;
}
function Link({ onClick, children }) {
  return <button onClick={onClick} style={{ background: "none", border: "none", color: C.crimson, fontFamily: serif, fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>{children}</button>;
}
