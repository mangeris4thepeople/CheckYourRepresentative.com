// =============================================================================
// Home.jsx - the front door of the revamped site (October 2026).
//
// Everything on this page is live: counts, the "moving in Congress" list, and
// the data freshness board all come from /api/pulse, which reads them straight
// out of Neon. If a number is not available it is not shown. No estimates, no
// placeholders dressed up as data. House style: no em dashes.
// =============================================================================
import React, { useEffect, useRef, useState } from "react";

const FEATURES = [
  { tab: "vote", icon: "🗳️", title: "Vote on live bills", tone: "#2563EB",
    body: "Read a plain language breakdown of who benefits, who pays, and whose money is behind it. Then cast your position before the floor vote." },
  { tab: "matrix", icon: "📊", title: "Accountability", tone: "#E0313F",
    body: "Line your district's positions up against your representative's actual recorded votes and watch the pattern form." },
  { tab: "followthemoney", icon: "💰", title: "Follow the Money", tone: "#16A34A",
    body: "FEC filings, top donor buckets, NGO funding, Medicaid, SNAP, Social Security, and the six layer Money Map." },
  { tab: "rollcalls", icon: "📋", title: "Roll Calls", tone: "#7C3AED",
    body: "Every recorded vote in Congress with every name attached. No summaries, the primary record." },
  { tab: "constituents", icon: "🌐", title: "Constituents", tone: "#0891B2",
    body: "Public voter cards by district, so you can see what people near you actually think." },
];

const STAT_TILES = [
  { key: "activeBills", label: "Active bills in Congress", hint: "tracked live from Congress.gov" },
  { key: "votes", label: "Positions cast by constituents", hint: "real votes, quarantined ones excluded" },
  { key: "votingDistricts", label: "Districts heard from", hint: "with at least one position cast" },
  { key: "fecFilings", label: "Campaign finance filings", hint: "House and Senate, from the FEC" },
  { key: "publicProfiles", label: "Public voter cards", hint: "constituents who share their record" },
  { key: "alertsSent", label: "Floor alerts sent", hint: "heads up before a vote hits the floor" },
  { key: "bills", label: "Bills in the 119th Congress", hint: "every bill, not a curated subset" },
  { key: "ngos", label: "Nonprofits matched to IRS records", hint: "Form 990 and revocation data" },
  { key: "members", label: "Members of Congress profiled", hint: "House and Senate rosters" },
];

// Freshness expectations, in hours, for the color of each status dot.
const EXPECTED_HOURS = { bills: 30, housefec: 30, senfec: 30, repspace: 30,
  reps: 24 * 8, senators: 24 * 8, ngos: 24 * 35, moneymap: 24 * 8 };

function timeAgo(iso) {
  if (!iso) return "";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return "just now";
  const m = s / 60; if (m < 60) return `${Math.round(m)} min ago`;
  const h = m / 60; if (h < 36) return `${Math.round(h)} hr ago`;
  const d = h / 24; if (d < 45) return `${Math.round(d)} days ago`;
  return `${Math.round(d / 30)} months ago`;
}

function fmtDate(d) {
  if (!d) return "";
  const dt = new Date(typeof d === "string" && d.length === 10 ? d + "T12:00:00" : d);
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function billLabel(b) {
  const t = String(b.type || "").toUpperCase();
  const map = { HR: "H.R.", S: "S.", HRES: "H.Res.", SRES: "S.Res.", HJRES: "H.J.Res.", SJRES: "S.J.Res.", HCONRES: "H.Con.Res.", SCONRES: "S.Con.Res." };
  return `${map[t] || t} ${b.number}`;
}

// Animated count up. Until the tile scrolls into view it shows the real final
// number (so nothing ever reads as 0), then counts up from 0 when it appears.
function CountUp({ value, duration = 1200 }) {
  const [n, setN] = useState(null);
  const ref = useRef(null);
  useEffect(() => {
    if (value == null) return;
    let raf, started = false;
    const run = () => {
      if (started) return; started = true;
      const t0 = performance.now();
      const tick = (t) => {
        const p = Math.min(1, (t - t0) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        setN(Math.round(value * eased));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((es) => { if (es.some(e => e.isIntersecting)) { run(); io.disconnect(); } }, { threshold: 0.2 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [value, duration]);
  const shown = n == null ? value : n;
  return <span ref={ref}>{shown == null ? "" : shown.toLocaleString("en-US")}</span>;
}

export default function Home({ session, district, onGoTab, onNavigate }) {
  const [pulse, setPulse] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/pulse")
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(d => { if (alive) setPulse(d); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, []);

  const c = { ...(pulse?.counts || {}) };
  if (c.reps != null && c.senators != null) c.members = c.reps + c.senators;
  const newest = pulse?.freshness?.[0];
  const tiles = STAT_TILES.filter(t => c[t.key] != null && c[t.key] > 0)
    // When every tracked bill is still active the two tiles say the same thing.
    .filter(t => !(t.key === "bills" && c.bills === c.activeBills));

  return (
    <div>
      {/* ---------- hero ---------- */}
      <section className="cyr-hero cyr-rise">
        <div className="cyr-grid cyr-grid-split" style={{ gap: 34 }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,.14)",
                          border: "1px solid rgba(255,255,255,.28)", borderRadius: 999, padding: "6px 12px",
                          fontSize: 12.5, fontWeight: 700, letterSpacing: ".04em" }}>
              <span className="cyr-live-dot" />
              {newest ? `Live public record. Last sync ${timeAgo(newest.syncedAt)}` : "Live public record, 119th Congress"}
            </div>
            <h1 className="cyr-h1" style={{ fontSize: "clamp(36px, 5.6vw, 64px)", margin: "18px 0 16px" }}>
              Your government,<br />
              <span style={{ background: "linear-gradient(90deg,#FFE29A,#F5B82E 40%,#FFD1D6)", WebkitBackgroundClip: "text",
                             backgroundClip: "text", color: "transparent" }}>in plain sight.</span>
            </h1>
            <p style={{ fontSize: "clamp(16px, 1.6vw, 19px)", lineHeight: 1.6, color: "rgba(255,255,255,.88)", maxWidth: 560, margin: "0 0 26px" }}>
              See how your member of Congress actually votes, who funds them, and who benefits.
              Then put your own position on the record, before the floor vote happens.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              <button className="cyr-btn cyr-btn-gold" onClick={() => onGoTab(session ? "vote" : "profile")}>
                {session ? "Vote on live bills" : "Find my representative"} <span aria-hidden>→</span>
              </button>
              <button className="cyr-btn cyr-btn-light" onClick={() => onGoTab("followthemoney")}>Follow the money</button>
              <button className="cyr-btn cyr-btn-light cyr-hide-sm" onClick={() => onNavigate("tutorial")}>How it works</button>
            </div>
            {district && (
              <div style={{ marginTop: 18, fontSize: 13.5, color: "rgba(255,255,255,.8)" }}>
                Your district: <strong style={{ color: "#fff" }}>{district}</strong>
              </div>
            )}
          </div>

          {/* Right now panel */}
          <div style={{ background: "rgba(255,255,255,.10)", border: "1px solid rgba(255,255,255,.24)", borderRadius: 22,
                        padding: 22, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", animation: "cyr-float 7s ease-in-out infinite" }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".14em", textTransform: "uppercase", color: "#FFE29A" }}>Right now</div>
            {[
              ["activeBills", "active bills before Congress"],
              ["votes", "positions cast by constituents"],
              ["votingDistricts", "districts heard from"],
            ].map(([k, label]) => (
              <div key={k} style={{ padding: "14px 0", borderBottom: "1px solid rgba(255,255,255,.16)" }}>
                {pulse ? (
                  <div className="cyr-num" style={{ fontSize: 34, lineHeight: 1 }}>
                    {c[k] != null ? <CountUp value={c[k]} /> : "n/a"}
                  </div>
                ) : <div className="cyr-skeleton" style={{ height: 32, width: 140, opacity: .25 }} />}
                <div style={{ fontSize: 13.5, color: "rgba(255,255,255,.8)", marginTop: 4 }}>{label}</div>
              </div>
            ))}
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.7)", marginTop: 12 }}>
              Counted live from the CYR database. Sources: Congress.gov and the FEC.
            </div>
          </div>
        </div>
      </section>

      {failed && (
        <div className="cyr-card" style={{ padding: 16, marginTop: 18, color: "#8A5A00", background: "#FFF6DD", borderColor: "#F5D27A" }}>
          The live counters are refreshing. Every tab below still loads its data directly.
        </div>
      )}

      {/* ---------- live stat tiles ---------- */}
      {tiles.length > 0 && (
        <section style={{ marginTop: 34 }}>
          <SectionHead eyebrow="By the numbers" title="The record, counted live" />
          <div className="cyr-grid cyr-grid-stats">
            {tiles.map((t, i) => (
              <div key={t.key} className="cyr-card cyr-card-hover cyr-rise" style={{ padding: "18px 18px 16px", animationDelay: `${i * 60}ms` }}>
                <div className="cyr-num" style={{ fontSize: "clamp(26px, 3vw, 34px)", color: "#0E2A6B", lineHeight: 1.05 }}>
                  <CountUp value={c[t.key]} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, marginTop: 6 }}>{t.label}</div>
                <div style={{ fontSize: 12.5, color: "#5B6578", marginTop: 2 }}>{t.hint}</div>
              </div>
            ))}
          </div>
        </section>
      )}
      {!pulse && !failed && (
        <section style={{ marginTop: 34 }}>
          <div className="cyr-grid cyr-grid-stats">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="cyr-skeleton" style={{ height: 104 }} />)}
          </div>
        </section>
      )}

      {/* ---------- moving + freshness ---------- */}
      {pulse && (
        <section className="cyr-grid cyr-grid-split" style={{ marginTop: 34, gap: 20 }}>
          <div className="cyr-card" style={{ padding: 22 }}>
            <SectionHead eyebrow="Latest floor and committee action" title="Moving in Congress" compact
              action={<button className="cyr-btn cyr-btn-ghost" onClick={() => onGoTab("allbills")}>All bills →</button>} />
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 10 }}>
              {(pulse.moving || []).map(b => (
                <button key={b.id} onClick={() => onGoTab(session ? "vote" : "allbills")}
                  className="cyr-card-hover"
                  style={{ textAlign: "left", background: "#F8FAFE", border: "1px solid #E2E8F0", borderRadius: 14,
                           padding: "12px 14px", cursor: "pointer", display: "flex", gap: 12, alignItems: "flex-start", fontFamily: "inherit" }}>
                  <span className="cyr-chip" style={{ flexShrink: 0, background: "#0E2A6B", color: "#fff", marginTop: 1 }}>{billLabel(b)}</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ fontWeight: 700, fontSize: 14.5, color: "#0F172A", lineHeight: 1.35,
                                   overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{b.title}</span>
                    <span style={{ display: "block", fontSize: 12.5, color: "#5B6578", marginTop: 4 }}>
                      {fmtDate(b.actionDate)}{b.latestAction ? ` · ${String(b.latestAction).slice(0, 110)}` : ""}
                    </span>
                  </span>
                </button>
              ))}
              {(!pulse.moving || pulse.moving.length === 0) && (
                <div style={{ color: "#5B6578", fontSize: 14 }}>No recent actions synced yet today.</div>
              )}
            </div>
          </div>

          <div className="cyr-card" style={{ padding: 22 }}>
            <SectionHead eyebrow="Automatic daily pulls" title="Data freshness" compact />
            <div style={{ display: "grid", gap: 2 }}>
              {(pulse.freshness || []).map(f => {
                const hrs = (Date.now() - new Date(f.syncedAt).getTime()) / 36e5;
                const ok = hrs <= (EXPECTED_HOURS[f.key] || 48);
                return (
                  <div key={f.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid #EEF2F8" }}>
                    <span style={{ width: 9, height: 9, borderRadius: "50%", flexShrink: 0, background: ok ? "#16A34A" : "#F59E0B",
                                   boxShadow: ok ? "0 0 0 4px rgba(22,163,74,.12)" : "0 0 0 4px rgba(245,158,11,.14)" }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>{f.label}</span>
                      <span style={{ display: "block", fontSize: 12, color: "#5B6578" }}>{f.source}</span>
                    </span>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: ok ? "#15803D" : "#B45309", whiteSpace: "nowrap" }}>{timeAgo(f.syncedAt)}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: 12, color: "#5B6578", marginTop: 12, lineHeight: 1.5 }}>
              Green means the source refreshed on schedule. Amber means it is due for its next pull.
            </div>
          </div>
        </section>
      )}

      {/* ---------- features ---------- */}
      <section style={{ marginTop: 40 }}>
        <SectionHead eyebrow="Everything in one place" title="Pick a thread and pull it" />
        <div className="cyr-grid cyr-grid-features">
          {FEATURES.map((f, i) => (
            <button key={f.tab} onClick={() => onGoTab(f.tab)} className="cyr-card cyr-card-hover cyr-rise"
              style={{ textAlign: "left", padding: 22, cursor: "pointer", fontFamily: "inherit", animationDelay: `${i * 70}ms` }}>
              <span style={{ width: 46, height: 46, borderRadius: 14, display: "grid", placeItems: "center", fontSize: 22,
                             background: `linear-gradient(135deg, ${f.tone}22, ${f.tone}44)`, border: `1px solid ${f.tone}33` }}>{f.icon}</span>
              <span style={{ display: "block", fontFamily: "var(--cyr-display)", fontWeight: 750, fontSize: 20, color: "#0E2A6B", margin: "14px 0 6px" }}>{f.title}</span>
              <span style={{ display: "block", fontSize: 14.5, lineHeight: 1.6, color: "#475569" }}>{f.body}</span>
              <span style={{ display: "inline-block", marginTop: 12, fontSize: 13.5, fontWeight: 700, color: f.tone }}>Open →</span>
            </button>
          ))}
        </div>
      </section>

      {/* ---------- mission strip ---------- */}
      <section className="cyr-card" style={{ marginTop: 40, padding: "30px 28px", display: "flex", flexWrap: "wrap", gap: 20,
                                             alignItems: "center", justifyContent: "space-between",
                                             background: "linear-gradient(120deg,#FFFFFF,#EEF4FF)" }}>
        <div style={{ flex: "1 1 420px" }}>
          <div className="cyr-eyebrow" style={{ color: "#E0313F" }}>Not partisan. Not for sale.</div>
          <div className="cyr-h2" style={{ fontSize: "clamp(22px, 2.6vw, 30px)", marginTop: 8 }}>
            Every member of Congress works for you. This is where you check the work.
          </div>
          <div style={{ fontSize: 14.5, color: "#475569", marginTop: 8, lineHeight: 1.6 }}>
            Your votes and your information are never sold to anyone. Every number traces to a named public record.
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="cyr-btn cyr-btn-primary" onClick={() => onNavigate("about")}>What we stand for</button>
          <button className="cyr-btn cyr-btn-ghost" onClick={() => onNavigate("tutorial")}>Site tutorial</button>
        </div>
      </section>
    </div>
  );
}

function SectionHead({ eyebrow, title, action, compact }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: compact ? 14 : 18 }}>
      <div>
        <div className="cyr-eyebrow">{eyebrow}</div>
        <h2 className="cyr-h2" style={{ fontSize: compact ? 22 : "clamp(24px, 2.8vw, 32px)", marginTop: 6 }}>{title}</h2>
      </div>
      {action}
    </div>
  );
}
