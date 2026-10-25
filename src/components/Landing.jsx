// =============================================================================
// Landing.jsx - the /welcome campaign page for ads and social links.
// "Your voice vs their vote": the accountability platform for ALL Americans.
//
// October 2026 revamp: matches the new site. Light glass nav, gradient hero
// with a glass "voice vs vote" card, live stat cards from /api/stats (real
// numbers only, a shimmer until they arrive), white step cards, and the
// shared dark navy footer with the contact form. House style: no em dashes.
// =============================================================================

import React, { useState, useEffect, useRef } from "react";
import ExplainerBanner from "./marketing/ExplainerBanner.jsx";
import LandingNav from "./marketing/LandingNav.jsx";
import ContactUsForm from "./ContactUsForm.jsx";

const C = {
  navy: "#0E2A6B", blue: "#2563EB", red: "#E0313F", gold: "#F5B82E", green: "#16A34A",
  ink: "#0F172A", muted: "#5B6578", line: "#E2E8F0", bg: "#F6F8FC",
};
const sans = "var(--cyr-sans)";

const SPECTRUM = ["Progressive", "Conservative", "Independent", "Libertarian", "Green", "Socialist"];

const STEPS = [
  {
    n: "01", tone: C.gold, icon: "📍", title: "Register",
    body: "Enter your address and email. We confirm your congressional district and connect you to your House rep and both Senators. One vote per person, no spam, no duplicates.",
  },
  {
    n: "02", tone: C.red, icon: "🗳️", title: "Vote on Bills",
    body: "Read plain-language bill summaries. Cast your position, Support, Oppose, or Undecided.",
  },
  {
    n: "03", tone: C.blue, icon: "⚖️", title: "Hold Them Accountable",
    body: "See how your rep voted vs. how your district and the nation voted. Contact them directly with one click.",
  },
];

// No mock data - all data is real

export default function Landing({ onEnter, onNavigate }) {
  const [scrolled, setScrolled] = useState(false);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768;
  });

  const [counters, setCounters] = useState({ bills: 0, votes: 0, reps: 0 });
  const statsRef = useRef(null);
  const heroRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("scroll", onScroll);
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onResize); };
  }, []);

  // Fetch REAL stats from /api/stats, animate when section visible
  useEffect(() => {
    let targets = { bills: 0, votes: 0, reps: 535 };

    async function loadStats() {
      try {
        const r = await fetch("/api/stats");
        if (r.ok) {
          const d = await r.json();
          targets = {
            bills: d.totalBills || 0,
            votes: d.totalVotes || 0,
            reps: d.totalReps || 535,
          };
        }
      } catch {}
    }

    function animateTo(t) {
      const duration = 1400;
      const start = Date.now();
      const tick = () => {
        const p = Math.min((Date.now() - start) / duration, 1);
        const ease = 1 - Math.pow(1 - p, 3);
        setCounters({
          bills: Math.round(t.bills * ease),
          votes: Math.round(t.votes * ease),
          reps:  Math.round(t.reps * ease),
        });
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }

    const obs = new IntersectionObserver(async ([entry]) => {
      if (!entry.isIntersecting) return;
      obs.disconnect();
      await loadStats();
      animateTo(targets);
    }, { threshold: 0.2 });

    if (statsRef.current) obs.observe(statsRef.current);
    return () => obs.disconnect();
  }, []);

  // Also refresh stats every 30 seconds while page is open
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const r = await fetch("/api/stats");
        if (r.ok) {
          const d = await r.json();
          setCounters({
            bills: d.totalBills || 0,
            votes: d.totalVotes || 0,
            reps: d.totalReps || 535,
          });
        }
      } catch {}
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const STATS = [
    { n: counters.bills, label: "Bills analyzed", sub: "119th Congress", tone: C.navy, icon: "📄" },
    { n: counters.votes, label: "Constituent votes cast", sub: "and counting", tone: C.red, icon: "🗳️" },
    { n: counters.reps, label: "Representatives", sub: "House + Senate", tone: C.blue, icon: "🏛️" },
  ];

  return (
    <div style={{ fontFamily: sans, color: C.ink, overflowX: "hidden", minHeight: "100vh" }}>

      {/* Nav (light glass, shared look with the app shell) */}
      <LandingNav active="landing" onNavigate={onNavigate} onEnter={onEnter} />

      {/* Explainer banner (dismissible, directly above the hero) */}
      <ExplainerBanner onLearnMore={() => onNavigate?.("tutorial")} />

      {/* Hero */}
      <section ref={heroRef} className="cyr-page-hero" style={{ padding: isMobile ? "40px 16px 92px" : "64px 20px 120px" }}>
        <div className="cyr-grid" style={{ maxWidth: 1140, margin: "0 auto", position: "relative", gap: isMobile ? 26 : 40,
                                           gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "minmax(0, 1.1fr) minmax(0, 1fr)", alignItems: "center" }}>
          <div className="cyr-rise">
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,.14)",
                          border: "1px solid rgba(255,255,255,.28)", borderRadius: 999, padding: "6px 12px",
                          fontSize: 12.5, fontWeight: 700 }}>
              <span className="cyr-live-dot" /> Non-partisan · Citizen-powered · Free
            </div>
            <h1 className="cyr-h1" style={{ fontSize: "clamp(40px, 7vw, 78px)", margin: "18px 0 16px" }}>
              Your voice.<br />
              <span style={{ background: "linear-gradient(90deg,#FFE29A,#F5B82E 40%,#FFD1D6)", WebkitBackgroundClip: "text",
                             backgroundClip: "text", color: "transparent" }}>Their vote.</span>
            </h1>
            <p style={{ fontSize: "clamp(16px, 1.8vw, 19px)", lineHeight: 1.6, color: "rgba(255,255,255,.9)", maxWidth: 540, margin: "0 0 24px" }}>
              Cast your position on every bill before Congress.
              Your ZIP code. Your district. Your opinion, counted.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              <button className="cyr-btn cyr-btn-gold" onClick={onEnter} style={{ minHeight: 46, padding: "12px 22px", fontSize: 15 }}>
                Check your representative now <span aria-hidden>→</span>
              </button>
              <button className="cyr-btn cyr-btn-light" onClick={() => onNavigate?.("tutorial")} style={{ minHeight: 46 }}>
                How it works
              </button>
            </div>
            <div style={{ marginTop: 22, display: "flex", flexWrap: "wrap", gap: 6 }}>
              {SPECTRUM.map(label => (
                <span key={label} style={{ fontSize: 12, fontWeight: 600, padding: "5px 11px", borderRadius: 999,
                                           background: "rgba(255,255,255,.10)", border: "1px solid rgba(255,255,255,.22)",
                                           color: "rgba(255,255,255,.85)" }}>{label}</span>
              ))}
            </div>
          </div>

          {/* Voice vs vote card */}
          <div className="cyr-rise" style={{ animationDelay: "120ms", background: "rgba(255,255,255,.10)", border: "1px solid rgba(255,255,255,.24)",
                                              borderRadius: 24, padding: isMobile ? 16 : 20, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }}>
            <div style={{ background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.18)", borderRadius: 18, padding: "16px 18px" }}>
              <div className="cyr-eyebrow" style={{ color: "#FFE29A", fontSize: 11 }}>We the people</div>
              <div className="cyr-h2" style={{ color: "#fff", fontSize: 26, marginTop: 4 }}>Your voice</div>
              <div style={{ fontSize: 14, lineHeight: 1.6, color: "rgba(255,255,255,.85)", marginTop: 6 }}>
                Cast your position on every bill before Congress, counted by district.
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "10px 0" }}>
              <span style={{ flex: 1, height: 1, background: "rgba(255,255,255,.25)" }} />
              <span className="cyr-num" style={{ width: 46, height: 46, borderRadius: 99, display: "grid", placeItems: "center", fontSize: 16,
                                                 background: C.gold, color: C.ink, boxShadow: "0 8px 22px rgba(245,184,46,.45)" }}>VS</span>
              <span style={{ flex: 1, height: 1, background: "rgba(255,255,255,.25)" }} />
            </div>

            <div style={{ background: "#fff", borderRadius: 18, padding: "16px 18px", color: C.ink, boxShadow: "0 18px 40px rgba(11,34,90,.25)" }}>
              <div className="cyr-eyebrow" style={{ color: C.red, fontSize: 11 }}>Elected officials</div>
              <div className="cyr-h2" style={{ fontSize: 26, marginTop: 4 }}>Their vote</div>
              <div style={{ fontSize: 14, lineHeight: 1.6, color: "#475569", marginTop: 6 }}>
                You voted. Your district voted. The nation voted. See if your representative's
                votes actually line up with the people they represent. No spin. Just the record.
              </div>
              <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 14, background: "#F1F5FB", border: "1px solid #E2E8F0" }}>
                <div style={{ fontWeight: 800, fontSize: 14.5, color: C.navy }}>Enter your address</div>
                <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5, marginTop: 2 }}>
                  Find your district. See real bills. Cast your real position.
                </div>
                <button onClick={onEnter} className="cyr-btn cyr-btn-primary"
                  style={{ marginTop: 10, width: "100%", justifyContent: "center", minHeight: 44 }}>
                  Find out here <span aria-hidden>→</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div style={{ maxWidth: 1140, margin: "0 auto", padding: "0 16px" }}>

        {/* Live stats */}
        <section ref={statsRef} className="cyr-grid" style={{ marginTop: isMobile ? -64 : -76, position: "relative", gap: isMobile ? 8 : 16,
                                                               gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
          {STATS.map((s, i) => (
            <div key={s.label} className="cyr-card cyr-card-hover cyr-rise"
              style={{ padding: isMobile ? "14px 10px" : "18px 20px", animationDelay: `${i * 70}ms`, minWidth: 0,
                       display: "flex", gap: isMobile ? 6 : 14, alignItems: isMobile ? "flex-start" : "center",
                       flexDirection: isMobile ? "column" : "row" }}>
              <span aria-hidden style={{ width: isMobile ? 34 : 48, height: isMobile ? 34 : 48, borderRadius: isMobile ? 10 : 14, flexShrink: 0,
                                         display: "grid", placeItems: "center", fontSize: isMobile ? 16 : 22,
                                         background: `linear-gradient(135deg, ${s.tone}1A, ${s.tone}38)`, border: `1px solid ${s.tone}2E` }}>{s.icon}</span>
              <div style={{ minWidth: 0, width: "100%" }}>
                {s.n > 0
                  ? <div className="cyr-num" style={{ fontSize: isMobile ? 22 : "clamp(28px, 3.4vw, 38px)", color: s.tone, lineHeight: 1.05 }}>{s.n.toLocaleString()}</div>
                  : <div className="cyr-skeleton" style={{ height: isMobile ? 24 : 34, width: isMobile ? "80%" : 120 }} aria-label="Loading" />}
                <div style={{ fontSize: isMobile ? 12.5 : 14.5, fontWeight: 700, marginTop: 4, lineHeight: 1.3 }}>{s.label}</div>
                <div style={{ fontSize: isMobile ? 11.5 : 12.5, color: C.muted }}>{s.sub}</div>
              </div>
            </div>
          ))}
        </section>

        {/* Accountability CTA, real data lives in the tool */}
        <section className="cyr-card" style={{ marginTop: 40, padding: "clamp(26px, 5vw, 48px) clamp(20px, 4vw, 40px)", textAlign: "center",
                                                background: "linear-gradient(120deg,#FFFFFF,#EEF4FF)" }}>
          <div className="cyr-eyebrow">The accountability matrix</div>
          <h2 className="cyr-h2" style={{ fontSize: "clamp(28px, 4.4vw, 46px)", margin: "10px 0 14px" }}>
            Your district spoke.<br />
            <span style={{ color: C.red }}>Did they listen?</span>
          </h2>
          <p style={{ fontSize: 17, color: "#475569", lineHeight: 1.7, maxWidth: 580, margin: "0 auto 24px" }}>
            Enter your address to see how your representative actually voted on real bills,
            and how your district feels about each one. No spin. Just the record.
          </p>
          <button onClick={onEnter} className="cyr-btn cyr-btn-primary" style={{ minHeight: 48, padding: "13px 26px", fontSize: 15, whiteSpace: "normal" }}>
            See your district's real record <span aria-hidden>→</span>
          </button>
        </section>

        {/* How it works */}
        <section style={{ marginTop: 48 }}>
          <div style={{ textAlign: "center", marginBottom: 22 }}>
            <div className="cyr-eyebrow">For everyone. Left. Right. Center.</div>
            <h2 className="cyr-h2" style={{ fontSize: "clamp(28px, 4vw, 42px)", marginTop: 8 }}>
              Three steps. <span style={{ color: C.blue }}>One truth.</span>
            </h2>
          </div>
          <div className="cyr-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 250px), 1fr))" }}>
            {STEPS.map((step, i) => (
              <div key={step.n} className="cyr-card cyr-card-hover cyr-rise" style={{ padding: "24px 22px", animationDelay: `${i * 80}ms`,
                                                                                    borderTop: `4px solid ${step.tone}` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <span aria-hidden style={{ width: 48, height: 48, borderRadius: 14, display: "grid", placeItems: "center", fontSize: 23,
                                             background: `linear-gradient(135deg, ${step.tone}1F, ${step.tone}3D)`, border: `1px solid ${step.tone}33` }}>{step.icon}</span>
                  <span className="cyr-num" style={{ fontSize: 34, color: step.tone, opacity: .9 }}>{step.n}</span>
                </div>
                <div style={{ fontFamily: "var(--cyr-display)", fontWeight: 750, fontSize: 21, color: C.navy, margin: "14px 0 8px" }}>{step.title}</div>
                <div style={{ fontSize: 14.5, color: "#475569", lineHeight: 1.65 }}>{step.body}</div>
              </div>
            ))}
          </div>
        </section>

        {/* For all Americans */}
        <section className="cyr-card" style={{ marginTop: 48, marginBottom: 56, padding: "clamp(26px, 5vw, 48px) clamp(18px, 4vw, 40px)", textAlign: "center" }}>
          <div className="cyr-eyebrow" style={{ color: C.red }}>Non-partisan · Citizen-powered · Free</div>
          <h2 className="cyr-h2" style={{ fontSize: "clamp(26px, 4vw, 42px)", margin: "10px auto 16px", maxWidth: 720 }}>
            Whether you're left, right, or sick of both: <span style={{ color: C.red }}>your vote still counts.</span>
          </h2>
          <p style={{ fontSize: 16, lineHeight: 1.75, color: "#475569", maxWidth: 600, margin: "0 auto 28px" }}>
            CheckYourRepresentative.com doesn't tell you what to think.
            It tells you what your representative is doing and gives you the tools
            to respond. Democrat, Republican, Independent, or anything else: your voice
            belongs in this database.
          </p>

          {/* Political spectrum bar */}
          <div style={{ margin: "0 auto 24px", maxWidth: 520 }}>
            <div style={{ height: 10, borderRadius: 99, marginBottom: 8,
                          background: `linear-gradient(to right, #1565C0, #7B1FA2, #9E9E9E, #E65100, ${C.red})` }} />
            <div style={{ display: "flex", justifyContent: "space-between", gap: 4, fontSize: 11.5, fontWeight: 600, color: C.muted }}>
              <span>Progressive</span>
              <span>Liberal</span>
              <span>Moderate</span>
              <span>Conservative</span>
              <span>MAGA</span>
            </div>
          </div>
          <div className="cyr-chip" style={{ background: "#FFF6DD", color: "#8A5A00", fontSize: 13, padding: "7px 14px", marginBottom: 24 }}>
            All welcome. All counted. All matter.
          </div>

          <div>
            <button onClick={onEnter} className="cyr-btn cyr-btn-primary" style={{ minHeight: 50, padding: "14px 28px", fontSize: 15.5, whiteSpace: "normal" }}>
              Check your representative now <span aria-hidden>→</span>
            </button>
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="cyr-footer" style={{ marginTop: 0 }}>
        <div className="cyr-flagline" />
        <div className="cyr-footer-inner">
          <div style={{ flex: "1 1 320px", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <img src="/icons/mark-96.png" alt="" style={{ width: 40, height: 40, borderRadius: 12 }} />
              <div style={{ fontFamily: "var(--cyr-display)", fontWeight: 800, fontSize: 20, color: "#fff" }}>Check Your Representative</div>
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.8, color: "#AFC0E2" }}>
              Non-partisan voter education · Bill data from Congress.gov · 119th Congress
            </div>
            <div style={{ fontFamily: "var(--cyr-display)", fontStyle: "italic", fontSize: 16, color: "#FFE29A", margin: "12px 0 16px", lineHeight: 1.5 }}>
              "We the People of the United States, in Order to form a more perfect Union..."
            </div>
            <div style={{ display: "inline-block", fontSize: 13, fontWeight: 700, color: "#fff",
                          border: "1px solid rgba(255,255,255,.3)", borderRadius: 12, padding: "6px 10px" }}>
              Paid for by We The People Inc. · Not affiliated with any political party
            </div>
          </div>
          <div style={{ flex: "1 1 360px", minWidth: 0, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.14)",
                        borderRadius: 18, padding: 20 }}>
            <ContactUsForm />
          </div>
        </div>
      </footer>
    </div>
  );
}
