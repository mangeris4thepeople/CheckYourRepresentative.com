// =============================================================================
// MarketingPage.jsx - shared chrome for the content pages (About, How This
// Benefits, Site Tutorial, How It Works, Privacy Commitment).
//
// October 2026 revamp: a light glass top bar that matches the app shell, an
// optional gradient page hero (title, kicker, lede props), the body floating
// up over the hero on a white card, and the same dark footer as the tool.
// Pages that still render <PageHeading> inside their body keep working.
// House style: no em dashes anywhere.
// =============================================================================
import React from "react";
import ContactUsForm from "../ContactUsForm.jsx";
import "../../styles/theme.css";

const NAV = [
  { key: "about",    label: "What We Stand For" },
  { key: "tutorial", label: "Site Tutorial" },
  { key: "benefits", label: "Why It Matters" },
  { key: "howitworks", label: "How It Works" },
];

const FOOTER_LINKS = [
  { key: "about",      label: "What We Stand For" },
  { key: "benefits",   label: "How This Benefits You And The Country" },
  { key: "tutorial",   label: "Site Tutorial" },
  { key: "howitworks", label: "How It Works" },
  { key: "privacy",    label: "Privacy" },
];

export default function MarketingPage({ active, onNavigate, onEnter, title, kicker, lede, children, wide }) {
  return (
    <div style={{ minHeight: "100vh", fontFamily: "var(--cyr-sans)", color: "var(--cyr-ink)" }}>
      <header className="cyr-topbar">
        <div className="cyr-flagline" />
        <div className="cyr-header-inner">
          <button className="cyr-brand" onClick={onEnter} aria-label="Open Check Your Representative">
            <img className="cyr-seal" src="/icons/mark-96.png" alt="" />
            <span className="cyr-site-title">Check Your Representative</span>
          </button>
          <nav className="cyr-hide-sm" style={{ display: "flex", gap: 4 }}>
            {NAV.map(n => (
              <button key={n.key} className="cyr-tab" aria-current={active === n.key ? "page" : undefined}
                onClick={() => onNavigate?.(n.key)}>{n.label}</button>
            ))}
          </nav>
          <button className="cyr-btn cyr-btn-primary" onClick={onEnter}>Open the tool <span aria-hidden>→</span></button>
        </div>
      </header>

      {title ? (
        <>
          <section className="cyr-page-hero">
            <div style={{ maxWidth: 860, margin: "0 auto", position: "relative" }} className="cyr-rise">
              {kicker && <div className="cyr-eyebrow" style={{ color: "#FFE29A" }}>{kicker}</div>}
              <h1 className="cyr-h1" style={{ fontSize: "clamp(36px, 6vw, 60px)", margin: "12px 0 14px" }}>{title}</h1>
              {lede && <p style={{ fontSize: "clamp(17px, 2vw, 21px)", lineHeight: 1.55, color: "rgba(255,255,255,.9)", margin: 0, maxWidth: 720 }}>{lede}</p>}
            </div>
          </section>
          <div className="cyr-page-body" style={wide ? { maxWidth: 1000 } : undefined}>
            <div className="cyr-card cyr-rise" style={{ padding: "clamp(22px, 4vw, 44px)", animationDelay: "80ms" }}>
              {children}
            </div>
            <EnterCta onEnter={onEnter} />
          </div>
        </>
      ) : (
        <div style={{ maxWidth: 860, margin: "0 auto", padding: "40px 20px 64px" }}>
          <div className="cyr-card cyr-rise" style={{ padding: "clamp(22px, 4vw, 44px)" }}>{children}</div>
          <EnterCta onEnter={onEnter} />
        </div>
      )}

      <footer className="cyr-footer" style={{ marginTop: 0 }}>
        <div className="cyr-flagline" />
        <div className="cyr-footer-inner">
          <div style={{ flex: "1 1 320px" }}>
            <div style={{ fontFamily: "var(--cyr-display)", fontWeight: 800, fontSize: 20, color: "#fff", marginBottom: 14 }}>Check Your Representative</div>
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 16 }}>
              {FOOTER_LINKS.map(item => (
                <button key={item.key} onClick={() => onNavigate?.(item.key)} className="cyr-footer-link">{item.label}</button>
              ))}
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.8, color: "#AFC0E2" }}>
              Non-partisan voter education. Bill data from Congress.gov, 119th Congress.<br />
              Not affiliated with any political party.
            </div>
            <div style={{ marginTop: 14, display: "inline-block", fontSize: 13, fontWeight: 700, color: "#fff",
                          border: "1px solid rgba(255,255,255,.3)", borderRadius: 16, padding: "6px 10px" }}>
              Paid for by We The People Inc.
            </div>
          </div>
          <div style={{ flex: "1 1 360px", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 18, padding: 20 }}>
            <ContactUsForm />
          </div>
        </div>
      </footer>
    </div>
  );
}

function EnterCta({ onEnter }) {
  return (
    <div className="cyr-card" style={{ marginTop: 22, padding: "24px 26px", display: "flex", flexWrap: "wrap", gap: 16,
                                       alignItems: "center", justifyContent: "space-between",
                                       background: "linear-gradient(120deg,#FFFFFF,#EEF4FF)" }}>
      <div>
        <div className="cyr-h2" style={{ fontSize: 22 }}>Ready to check the record?</div>
        <div style={{ fontSize: 14.5, color: "#475569", marginTop: 4 }}>Everything except casting votes works without signing in.</div>
      </div>
      <button className="cyr-btn cyr-btn-primary" onClick={onEnter}>Open the tool <span aria-hidden>→</span></button>
    </div>
  );
}

// Shared heading for pages that render their own title inside the body.
export function PageHeading({ children }) {
  return (
    <h1 className="cyr-h1" style={{ fontSize: "clamp(32px, 5vw, 48px)", color: "var(--cyr-navy)", margin: "0 0 24px" }}>
      {children}
    </h1>
  );
}

// Section title used inside the content pages.
export function SectionTitle({ children, id }) {
  return (
    <h2 id={id} className="cyr-h2" style={{ fontSize: "clamp(22px, 2.6vw, 28px)", margin: "40px 0 16px",
                                            display: "flex", alignItems: "center", gap: 12 }}>
      <span aria-hidden style={{ width: 6, height: 26, borderRadius: 12, background: "var(--cyr-grad)", flexShrink: 0 }} />
      {children}
    </h2>
  );
}
