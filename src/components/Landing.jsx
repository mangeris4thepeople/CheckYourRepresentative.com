// =============================================================================
// Landing.jsx - CheckYourRepresentative.com homepage (launches July 1, 2026)
// Dual-tone civic design: appeals across the full political spectrum.
// "Your voice vs their vote" - the accountability platform for ALL Americans.
// =============================================================================

import React, { useState, useEffect, useRef } from "react";
import ExplainerBanner from "./marketing/ExplainerBanner.jsx";
import LandingNav from "./marketing/LandingNav.jsx";
import ContactUsForm from "./ContactUsForm.jsx";

const C = {
  black:    "#0D0D0D",
  white:    "#FAFAFA",
  crimson:  "#C41E3A",
  cobalt:   "#1A3A6B",
  gold:     "#D4A843",
  goldDim:  "#8B6914",
  gray:     "#6B6B6B",
  grayLight:"#E8E8E8",
  parchment:"#F5F0E8",
};

const bebas = "'Bebas Neue', 'Arial Black', Impact, sans-serif";
const serif = "Georgia, 'Times New Roman', serif";
const mono  = "'Courier New', Courier, monospace";

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



  return (
    <div style={{ fontFamily: serif, background: C.white, color: C.black, overflowX: "hidden" }}>

      {/* ── NAV (shared with the landing-adjacent content pages) ── */}
      <LandingNav active="landing" onNavigate={onNavigate} onEnter={onEnter} />

      {/* ── EXPLAINER BANNER (dismissible, directly above the hero) ── */}
      <ExplainerBanner onLearnMore={() => onNavigate?.("tutorial")} />

      {/* ── SPLIT HERO ── */}
      <div ref={heroRef} style={{ minHeight: isMobile ? "auto" : "100vh", display: "flex", flexDirection: isMobile ? "column" : "row", position: "relative", overflow: "hidden" }}>

        {/* LEFT - THE PEOPLE */}
        <div style={{
          flex: 1, background: C.black, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: isMobile ? "48px 24px 48px" : "60px 40px 60px 60px",
          position: "relative",
        }}>
          <div style={{
            fontSize: 11, letterSpacing: 4, color: C.gold, fontFamily: mono,
            marginBottom: 16, textTransform: "uppercase"
          }}>
            WE THE PEOPLE
          </div>
          <div style={{
            fontFamily: bebas, fontSize: "clamp(72px, 10vw, 120px)",
            color: C.white, lineHeight: 0.9, textAlign: "center",
            letterSpacing: 2,
          }}>
            YOUR<br />
            <span style={{ color: C.gold }}>VOICE</span>
          </div>
          <div style={{
            marginTop: 28, fontSize: 15, color: "#cccccc", lineHeight: 1.7, fontWeight: 700,
            textAlign: "center", maxWidth: 320,
          }}>
            Cast your position on every bill before Congress.
            Your ZIP code. Your district. Your opinion - counted.
          </div>

          {/* Left side pills - hidden on mobile */}
          {!isMobile && (
          <div style={{ marginTop: 32, display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
            {["Progressive", "Conservative", "Independent", "Libertarian", "Green", "Socialist"].map(label => (
              <span key={label} style={{
                fontFamily: mono, fontSize: 11, padding: "4px 12px",
                border: "1px solid #333", borderRadius: 20, color: "#666",
              }}>{label}</span>
            ))}
          </div>
          )}
        </div>

        {/* DIVIDER - diagonal on desktop, horizontal bar on mobile */}
        {isMobile ? (
          <div style={{ background: C.black, display: "flex", alignItems: "center",
                        justifyContent: "center", padding: "16px 0", position: "relative", zIndex: 10 }}>
            <div style={{ position: "absolute", left: 0, right: 0, height: 2, background: C.gold, opacity: 0.4 }} />
            <div style={{
              background: C.gold, color: C.black, fontFamily: bebas, fontSize: 22, letterSpacing: 3,
              padding: "10px 16px", borderRadius: "50%", width: 56, height: 56,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 0 30px rgba(212,168,67,0.5)", position: "relative", zIndex: 2,
            }}>VS</div>
          </div>
        ) : (
        <div style={{
          position: "absolute", left: "50%", top: 0, bottom: 0, width: 0,
          zIndex: 10, pointerEvents: "none",
        }}>
          <svg style={{ position: "absolute", left: -60, top: 0, height: "100%", width: 120 }}
               viewBox="0 0 120 800" preserveAspectRatio="none">
            <polygon points="60,0 120,0 60,800 0,800" fill={C.gold} opacity="0.15" />
            <line x1="60" y1="0" x2="60" y2="800" stroke={C.gold} strokeWidth="2" />
          </svg>
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            background: C.gold, color: C.black,
            fontFamily: bebas, fontSize: 22, letterSpacing: 3,
            padding: "12px 16px", borderRadius: "50%", width: 56, height: 56,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 40px rgba(212,168,67,0.4)",
            zIndex: 20,
          }}>VS</div>
        </div>
        )}

        {/* RIGHT - THEIR VOTE */}
        <div style={{
          flex: 1, background: C.parchment, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: isMobile ? "40px 24px 60px" : "60px 60px 60px 40px",
          position: "relative",
        }}>
          <div style={{
            fontSize: 11, letterSpacing: 4, color: C.gray, fontFamily: mono,
            marginBottom: 16, textTransform: "uppercase"
          }}>
            ELECTED OFFICIALS
          </div>
          <div style={{
            fontFamily: bebas, fontSize: "clamp(72px, 10vw, 120px)",
            color: C.black, lineHeight: 0.9, textAlign: "center",
            letterSpacing: 2,
          }}>
            THEIR<br />
            <span style={{ color: C.crimson }}>VOTE</span>
          </div>
          <div style={{
            marginTop: 28, fontSize: 15, color: "#444", lineHeight: 1.7, fontWeight: 700,
            textAlign: "center", maxWidth: 320,
          }}>
            See how your representative actually voted on every bill.
            No spin. No excuses. Just the record.
          </div>

          {/* Real CTA */}
          <div style={{
            marginTop: 32, background: C.white, border: `2px solid ${C.crimson}`,
            borderRadius: 4, padding: "20px", width: "100%", maxWidth: 320,
            textAlign: "center",
          }}>
            <div style={{ fontFamily: bebas, fontSize: 18, color: C.crimson, letterSpacing: 2, marginBottom: 8 }}>
              ENTER YOUR ADDRESS
            </div>
            <div style={{ fontFamily: mono, fontSize: 11, color: C.gray, lineHeight: 1.6 }}>
              Find your district. See real bills. Cast your real position.
            </div>
            <button onClick={onEnter} style={{
              marginTop: 14, fontFamily: bebas, fontSize: 14, letterSpacing: 2,
              background: C.crimson, color: C.white, border: "none",
              padding: "10px 24px", borderRadius: 2, cursor: "pointer", width: "100%",
            }}>
              CHECK YOUR REP →
            </button>
          </div>
        </div>

        {/* Scroll indicator - desktop only */}
        {!isMobile && <div style={{
          position: "absolute", bottom: 32, left: "50%", transform: "translateX(-50%)",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
          animation: "bounce 2s infinite",
        }}>
          <span style={{ fontFamily: mono, fontSize: 10, color: C.gold, letterSpacing: 2 }}>
            SCROLL
          </span>
          <span style={{ color: C.gold, fontSize: 18 }}>↓</span>
        </div>}
      </div>



      {/* ── STATS BAR ── */}
      <div ref={statsRef} style={{
        background: C.cobalt,
        display: "flex", justifyContent: "center", gap: "clamp(20px, 4vw, 80px)",
        flexWrap: "wrap", padding: "40px 24px",
      }}>
        {[
          { n: counters.bills > 0 ? counters.bills.toLocaleString() : " - ", label: "Bills Analyzed", sub: "119th Congress" },
          { n: counters.votes > 0 ? counters.votes.toLocaleString() : " - ", label: "Constituent Votes Cast", sub: "and counting" },
          { n: counters.reps.toLocaleString(), label: "Representatives", sub: "House + Senate" },
        ].map((s, i) => (
          <div key={i} style={{ textAlign: "center" }}>
            <div style={{
              fontFamily: bebas, fontSize: "clamp(48px, 6vw, 72px)",
              color: C.gold, lineHeight: 1, letterSpacing: 2,
            }}>{s.n}</div>
            <div style={{ fontSize: 14, color: C.white, fontWeight: 700, marginTop: 4 }}>{s.label}</div>
            <div style={{ fontFamily: mono, fontSize: 11, color: "#8899cc", marginTop: 2 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* ── ACCOUNTABILITY CTA - real data lives in the tool ── */}
      <div style={{ background: C.white, padding: "60px 20px" }}>
        <div style={{ maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
          <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: 3, color: C.gray, marginBottom: 12 }}>
            THE ACCOUNTABILITY MATRIX
          </div>
          <div style={{
            fontFamily: bebas, fontSize: "clamp(32px, 5vw, 56px)",
            letterSpacing: 2, lineHeight: 1.1, marginBottom: 20,
          }}>
            YOUR DISTRICT SPOKE.<br />
            <span style={{ color: C.crimson }}>DID THEY LISTEN?</span>
          </div>
          <p style={{ fontSize: 17, color: "#444", fontWeight: 700, lineHeight: 1.7,
                      maxWidth: 560, margin: "0 auto 32px" }}>
            Enter your address to see how your representative actually voted on real bills  - 
            and how your district feels about each one. No spin. Just the record.
          </p>
          <button onClick={onEnter} style={{
            fontFamily: bebas, fontSize: 20, letterSpacing: 3,
            background: C.black, color: C.gold,
            border: `2px solid ${C.gold}`,
            padding: "16px 48px", borderRadius: 2, cursor: "pointer",
          }}>
            SEE YOUR DISTRICT'S REAL RECORD →
          </button>
        </div>
      </div>

      {/* ── HOW IT WORKS ── */}
      <div style={{ background: C.black, padding: "80px 32px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: 3, color: C.gray, marginBottom: 12 }}>
              FOR EVERYONE. LEFT. RIGHT. CENTER.
            </div>
            <div style={{
              fontFamily: bebas, fontSize: "clamp(36px, 5vw, 60px)",
              color: C.white, letterSpacing: 2,
            }}>
              THREE STEPS.<br />
              <span style={{ color: C.gold }}>ONE TRUTH.</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 32, flexWrap: "wrap", justifyContent: "center" }}>
            {[
              {
                n: "01",
                color: C.gold,
                title: "Find Your District",
                body: "Enter your ZIP. We confirm your congressional district and find your House rep and both Senators.",
                icon: "📍",
              },
              {
                n: "02",
                color: C.crimson,
                title: "Vote on Bills",
                body: "Read plain-language bill summaries. Cast your position - Support, Oppose, or Undecided. Anonymous. Secure.",
                icon: "🗳️",
              },
              {
                n: "03",
                color: C.cobalt,
                title: "Hold Them Accountable",
                body: "See how your rep voted vs. how your district voted. Contact them directly with one click.",
                icon: "⚖️",
              },
            ].map((step, i) => (
              <div key={i} style={{
                flex: "1 1 240px", maxWidth: 280,
                padding: "32px 28px",
                border: `1px solid #222`,
                borderTop: `3px solid ${step.color}`,
                borderRadius: 2,
              }}>
                <div style={{
                  fontFamily: bebas, fontSize: 48, color: step.color,
                  letterSpacing: 2, lineHeight: 1, marginBottom: 8,
                }}>{step.n}</div>
                <div style={{ fontSize: 32, marginBottom: 12 }}>{step.icon}</div>
                <div style={{
                  fontFamily: bebas, fontSize: 22, color: C.white,
                  letterSpacing: 1, marginBottom: 12,
                }}>{step.title}</div>
                <div style={{ fontSize: 14, color: "#888", lineHeight: 1.7 }}>
                  {step.body}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── FOR ALL AMERICANS ── */}
      <div style={{
        background: C.parchment, padding: "60px 20px",
        borderTop: `4px solid ${C.gold}`,
      }}>
        <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
          <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: 3, color: C.gray, marginBottom: 16 }}>
            NON-PARTISAN · CITIZEN-POWERED · FREE
          </div>
          <div style={{
            fontFamily: bebas, fontSize: "clamp(32px, 5vw, 56px)",
            letterSpacing: 2, lineHeight: 1.1, marginBottom: 24,
          }}>
            WHETHER YOU'RE LEFT, RIGHT,<br />OR SICK OF BOTH:<br />
            <span style={{ color: C.crimson }}>YOUR VOTE STILL COUNTS.</span>
          </div>
          <p style={{ fontSize: 16, lineHeight: 1.8, color: C.gray, maxWidth: 600, margin: "0 auto 40px" }}>
            CheckYourRepresentative.com doesn't tell you what to think.
            It tells you what your representative is doing and gives you the tools
            to respond. Democrat, Republican, Independent, or anything else: your voice
            belongs in this database.
          </p>

          {/* Political spectrum bar */}
          <div style={{ margin: "0 auto 40px", maxWidth: 500 }}>
            <div style={{
              height: 8, borderRadius: 4,
              background: `linear-gradient(to right, #1565C0, #7B1FA2, #9E9E9E, #E65100, ${C.crimson})`,
              marginBottom: 8,
            }} />
            <div style={{
              display: "flex", justifyContent: "space-between",
              fontFamily: mono, fontSize: 10, color: C.gray,
            }}>
              <span>PROGRESSIVE</span>
              <span>LIBERAL</span>
              <span>MODERATE</span>
              <span>CONSERVATIVE</span>
              <span>MAGA</span>
            </div>
          </div>
          <div style={{
            fontFamily: bebas, fontSize: 18, letterSpacing: 3,
            color: C.gold, marginBottom: 32,
          }}>
            ALL WELCOME. ALL COUNTED. ALL MATTER.
          </div>

          <button onClick={onEnter} style={{
            fontFamily: bebas, fontSize: 22, letterSpacing: 3,
            background: C.crimson, color: C.white, border: "none",
            padding: "18px 56px", borderRadius: 2, cursor: "pointer",
            display: "block", margin: "0 auto",
          }}>
            CHECK YOUR REPRESENTATIVE NOW →
          </button>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <div style={{
        background: C.black, borderTop: `3px solid ${C.gold}`,
        padding: "32px 20px",
      }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", flexWrap: "wrap",
                      gap: 28, justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 300px", textAlign: "left" }}>
            <div style={{
              fontFamily: bebas, fontSize: 18, letterSpacing: 3,
              color: C.gold, marginBottom: 10,
            }}>
              CHECKYOURREPRESENTATIVE.COM
            </div>
            <div style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: "#cfcfcf", lineHeight: 1.8 }}>
              Non-partisan voter education · Bill data from Congress.gov · 119th Congress<br />
              "We the People of the United States, in Order to form a more perfect Union..."
            </div>
            <div style={{ marginTop: 14, fontFamily: mono, fontSize: 10, fontWeight: 700, color: "#cfcfcf" }}>
              Paid for by We The People Inc. · Not affiliated with any political party
            </div>
          </div>
          <div style={{ flex: "1 1 340px" }}>
            <ContactUsForm />
          </div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
        @keyframes bounce {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50% { transform: translateX(-50%) translateY(8px); }
        }
        * { box-sizing: border-box; }
        button:hover { opacity: 0.88; transition: opacity 0.15s; }
      `}</style>
    </div>
  );
}
