// =============================================================================
// Landing.jsx — CheckYourRepresentative.com homepage (launches July 1, 2026)
// Dual-tone civic design: appeals across the full political spectrum.
// "Your voice vs their vote" — the accountability platform for ALL Americans.
// =============================================================================

import React, { useState, useEffect, useRef } from "react";

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

// Live mock tally — replace with real /api/tally calls in production
const MOCK_BILLS = [
  {
    id: "hr-1-119",
    title: "H.R. 1 — American Sovereignty Act",
    topic: "National Security",
    peopleSupport: 61,
    peopleOppose: 29,
    repVote: "Yea",
    repName: "Rep. Lauren Boebert (R-CO)",
    aligned: true,
  },
  {
    id: "hr-485-119",
    title: "H.R. 485 — Medicare for All Act",
    topic: "Healthcare",
    peopleSupport: 58,
    peopleOppose: 34,
    repVote: "Nay",
    repName: "Rep. Lauren Boebert (R-CO)",
    aligned: false,
  },
  {
    id: "s-100-119",
    title: "S. 100 — Clean Energy Transition Act",
    topic: "Environment",
    peopleSupport: 54,
    peopleOppose: 38,
    repVote: "Nay",
    repName: "Sen. John Hickenlooper (D-CO)",
    aligned: false,
  },
];

export default function Landing({ onEnter }) {
  const [scrolled, setScrolled] = useState(false);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768);
  const [activeBill, setActiveBill] = useState(0);
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

  // Animate counters when stats section visible
  useEffect(() => {
    const targets = { bills: 24847, votes: 1203847, reps: 535 };
    const obs = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      obs.disconnect();
      const duration = 1800;
      const start = Date.now();
      const tick = () => {
        const p = Math.min((Date.now() - start) / duration, 1);
        const ease = 1 - Math.pow(1 - p, 3);
        setCounters({
          bills: Math.round(targets.bills * ease),
          votes: Math.round(targets.votes * ease),
          reps:  Math.round(targets.reps * ease),
        });
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.3 });
    if (statsRef.current) obs.observe(statsRef.current);
    return () => obs.disconnect();
  }, []);

  // Cycle through bills
  useEffect(() => {
    const t = setInterval(() => setActiveBill(b => (b + 1) % MOCK_BILLS.length), 4000);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ fontFamily: serif, background: C.white, color: C.black, overflowX: "hidden" }}>

      {/* ── NAV ── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        background: scrolled ? "rgba(13,13,13,0.97)" : "transparent",
        backdropFilter: scrolled ? "blur(8px)" : "none",
        transition: "background 0.3s",
        padding: "0 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: 60,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <EagleSeal size={32} />
          <span style={{
            fontFamily: bebas, fontSize: isMobile ? 15 : 20, letterSpacing: 2,
            color: C.gold,
          }}>{isMobile ? "CheckYourRep.com" : "CheckYourRepresentative.com"}</span>
        </div>
        <button onClick={onEnter} style={{
          fontFamily: bebas, fontSize: isMobile ? 12 : 15, letterSpacing: 2,
          background: C.crimson, color: C.white, border: "none",
          padding: isMobile ? "6px 12px" : "8px 22px", borderRadius: 2, cursor: "pointer",
        }}>
          ENTER THE TOOL →
        </button>
      </nav>

      {/* ── SPLIT HERO ── */}
      <div ref={heroRef} style={{ minHeight: isMobile ? "auto" : "100vh", display: "flex", flexDirection: isMobile ? "column" : "row", position: "relative", overflow: "hidden" }}>

        {/* LEFT — THE PEOPLE */}
        <div style={{
          flex: 1, background: C.black, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: isMobile ? "80px 24px 48px" : "60px 40px 60px 60px",
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
            Your ZIP code. Your district. Your opinion — counted.
          </div>

          {/* Left side pills — hidden on mobile */}
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

        {/* DIVIDER — diagonal on desktop, horizontal bar on mobile */}
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

        {/* RIGHT — THEIR VOTE */}
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

          {/* Voting record mockup */}
          <div style={{
            marginTop: 32, background: C.white, border: `1px solid ${C.grayLight}`,
            borderRadius: 4, padding: "14px 20px", width: "100%", maxWidth: 320,
          }}>
            <div style={{ fontFamily: mono, fontSize: 11, color: C.gray, marginBottom: 8 }}>
              RECENT VOTES — YOUR REP
            </div>
            {[
              { bill: "H.R. 1", vote: "YEA", align: true },
              { bill: "H.R. 485", vote: "NAY", align: false },
              { bill: "S. 100", vote: "NAY", align: false },
            ].map((v, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "6px 0", borderTop: i > 0 ? `1px solid ${C.grayLight}` : "none",
              }}>
                <span style={{ fontFamily: mono, fontSize: 12, color: C.black }}>{v.bill}</span>
                <span style={{
                  fontFamily: bebas, fontSize: 14, letterSpacing: 1,
                  color: v.vote === "YEA" ? "#1B5E20" : C.crimson,
                  padding: "2px 10px", borderRadius: 2,
                  background: v.vote === "YEA" ? "#E8F5E9" : "#FBE9E7",
                }}>
                  {v.vote}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll indicator — desktop only */}
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

      {/* ── LIVE ACCOUNTABILITY TICKER ── desktop only */}
      {!isMobile && <div style={{
        background: C.black, borderTop: `3px solid ${C.gold}`,
        borderBottom: `3px solid ${C.gold}`,
        padding: "0", overflow: "hidden",
      }}>
        <div style={{
          display: "flex", alignItems: "center",
        }}>
          <div style={{
            background: C.gold, color: C.black,
            fontFamily: bebas, fontSize: 13, letterSpacing: 2,
            padding: "14px 20px", whiteSpace: "nowrap", flexShrink: 0,
          }}>
            LIVE RECORD
          </div>
          <div style={{
            display: "flex", gap: 0, overflow: "hidden", flex: 1,
          }}>
            {[...MOCK_BILLS, ...MOCK_BILLS].map((b, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 16,
                padding: "12px 28px", borderLeft: `1px solid #222`,
                whiteSpace: "nowrap", flexShrink: 0,
              }}>
                <span style={{ fontFamily: mono, fontSize: 11, color: "#555" }}>
                  {b.title.split("—")[0].trim()}
                </span>
                <span style={{
                  fontFamily: bebas, fontSize: 13, letterSpacing: 1,
                  color: b.peopleSupport > 50 ? "#4CAF50" : C.crimson,
                }}>
                  PEOPLE: {b.peopleSupport}% SUPPORT
                </span>
                <span style={{ color: "#333" }}>·</span>
                <span style={{
                  fontFamily: bebas, fontSize: 13, letterSpacing: 1,
                  color: b.repVote === "Yea" ? "#4CAF50" : C.crimson,
                }}>
                  REP VOTED: {b.repVote.toUpperCase()}
                </span>
                <span style={{
                  fontFamily: mono, fontSize: 10,
                  color: b.aligned ? "#4CAF50" : C.gold,
                  padding: "2px 8px",
                  border: `1px solid ${b.aligned ? "#4CAF50" : C.gold}`,
                  borderRadius: 2,
                }}>
                  {b.aligned ? "✓ ALIGNED" : "⚠ MISALIGNED"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      }
      {/* ── STATS BAR ── */}
      <div ref={statsRef} style={{
        background: C.cobalt, padding: "48px 32px",
        display: "flex", justifyContent: "center", gap: "clamp(20px, 4vw, 80px)",
        flexWrap: "wrap", padding: "40px 24px",
      }}>
        {[
          { n: counters.bills.toLocaleString(), label: "Bills Tracked", sub: "119th Congress" },
          { n: counters.votes.toLocaleString(), label: "Constituent Votes", sub: "and counting" },
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

      {/* ── BILL ACCOUNTABILITY SECTION ── */}
      <div style={{ background: C.white, padding: "60px 20px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{
            textAlign: "center", marginBottom: 56,
          }}>
            <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: 3, color: C.gray, marginBottom: 12 }}>
              THE ACCOUNTABILITY MATRIX
            </div>
            <div style={{
              fontFamily: bebas, fontSize: "clamp(36px, 5vw, 64px)",
              letterSpacing: 2, lineHeight: 1,
            }}>
              YOUR DISTRICT SPOKE.<br />
              <span style={{ color: C.crimson }}>DID THEY LISTEN?</span>
            </div>
          </div>

          {/* Bill cards */}
          {MOCK_BILLS.map((bill, i) => (
            <BillAccountabilityCard key={bill.id} bill={bill} index={i} />
          ))}

          <div style={{ textAlign: "center", marginTop: 48 }}>
            <button onClick={onEnter} style={{
              fontFamily: bebas, fontSize: 20, letterSpacing: 3,
              background: C.black, color: C.gold,
              border: `2px solid ${C.gold}`,
              padding: "16px 48px", borderRadius: 2, cursor: "pointer",
            }}>
              SEE YOUR DISTRICT'S FULL RECORD →
            </button>
          </div>
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
                body: "Read plain-language bill summaries. Cast your position — Support, Oppose, or Undecided. Anonymous. Secure.",
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
            WHETHER YOU'RE LEFT, RIGHT,<br />OR SICK OF BOTH —<br />
            <span style={{ color: C.crimson }}>YOUR VOTE STILL COUNTS.</span>
          </div>
          <p style={{ fontSize: 16, lineHeight: 1.8, color: C.gray, maxWidth: 600, margin: "0 auto 40px" }}>
            CheckYourRepresentative.com doesn't tell you what to think.
            It tells you what your representative is doing — and gives you the tools
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
        padding: "32px", textAlign: "center",
      }}>
        <EagleSeal size={40} />
        <div style={{
          fontFamily: bebas, fontSize: 18, letterSpacing: 3,
          color: C.gold, marginTop: 12, marginBottom: 8,
        }}>
          CHECKYOURREPRESENTATIVE.COM
        </div>
        <div style={{ fontFamily: mono, fontSize: 11, color: "#444", lineHeight: 1.8 }}>
          Non-partisan voter education · Bill data from Congress.gov · 119th Congress<br />
          "We the People of the United States, in Order to form a more perfect Union..."
        </div>
        <div style={{ marginTop: 16, fontFamily: mono, fontSize: 10, color: "#333" }}>
          Paid for by We The People Inc. · Not affiliated with any political party
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

// ---------------------------------------------------------------------------
function BillAccountabilityCard({ bill, index }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { threshold: 0.2 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  const supportPct = bill.peopleSupport;
  const opposePct  = bill.peopleOppose;

  return (
    <div ref={ref} style={{
      background: C.white, border: `1px solid ${C.grayLight}`,
      borderLeft: `4px solid ${bill.aligned ? "#2E7D32" : C.crimson}`,
      borderRadius: 2, padding: "28px 32px", marginBottom: 20,
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(20px)",
      transition: `opacity 0.5s ${index * 0.1}s, transform 0.5s ${index * 0.1}s`,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: mono, fontSize: 10, color: C.gray, letterSpacing: 2, marginBottom: 6 }}>
            {bill.topic.toUpperCase()}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.black, marginBottom: 4 }}>
            {bill.title}
          </div>
          <div style={{ fontFamily: mono, fontSize: 11, color: C.gray }}>
            {bill.repName}
          </div>
        </div>
        <div style={{
          fontFamily: bebas, fontSize: 13, letterSpacing: 2,
          padding: "6px 16px", borderRadius: 2,
          background: bill.aligned ? "#E8F5E9" : "#FBE9E7",
          color: bill.aligned ? "#1B5E20" : C.crimson,
          whiteSpace: "nowrap",
        }}>
          {bill.aligned ? "✓ REP ALIGNED" : "⚠ REP MISALIGNED"}
        </div>
      </div>

      {/* Constituent bar */}
      <div style={{ marginTop: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontFamily: mono, fontSize: 11, color: C.gray }}>THE PEOPLE</span>
          <span style={{ fontFamily: mono, fontSize: 11, color: C.gray }}>
            {supportPct}% support · {opposePct}% oppose
          </span>
        </div>
        <div style={{ height: 10, background: C.grayLight, borderRadius: 2, overflow: "hidden", display: "flex" }}>
          <div style={{
            width: visible ? `${supportPct}%` : "0%", background: C.cobalt,
            transition: `width 0.8s 0.3s ease-out`,
          }} />
          <div style={{
            width: visible ? `${opposePct}%` : "0%", background: C.crimson,
            transition: `width 0.8s 0.4s ease-out`,
          }} />
        </div>
      </div>

      {/* Rep vote */}
      <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontFamily: mono, fontSize: 11, color: C.gray }}>REP VOTED:</span>
        <span style={{
          fontFamily: bebas, fontSize: 16, letterSpacing: 2,
          color: bill.repVote === "Yea" ? "#1B5E20" : C.crimson,
          padding: "3px 14px",
          background: bill.repVote === "Yea" ? "#E8F5E9" : "#FBE9E7",
          borderRadius: 2,
        }}>
          {bill.repVote.toUpperCase()}
        </span>
        {!bill.aligned && (
          <span style={{ fontFamily: mono, fontSize: 11, color: C.gold }}>
            ← majority wanted the opposite
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
function EagleSeal({ size = 48 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 52 52" aria-hidden="true">
      <circle cx="26" cy="26" r="24" fill="none" stroke={C.gold} strokeWidth="1.5" />
      <circle cx="26" cy="26" r="19" fill={C.crimson} opacity="0.15" />
      <text x="26" y="32" textAnchor="middle"
        fontFamily={bebas} fontSize="16" fontWeight="700" fill={C.gold}
        letterSpacing="1">CYR</text>
    </svg>
  );
}
