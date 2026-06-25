// =============================================================================
// Landing — the front door (countdown, hero, features). It's now the first
// screen of the SAME app, so the "Enter" buttons just switch views in-app —
// no second site, no external link, nothing to 404.
// =============================================================================
import React, { useState, useEffect } from "react";

const CSS = `
  .lp * { box-sizing: border-box; margin: 0; padding: 0; }
  .lp { background:#0a0f1e; color:#fff; font-family:'Source Sans 3',Georgia,serif; min-height:100vh; overflow-x:hidden; position:relative; }
  .lp .stripe { height:8px; background:repeating-linear-gradient(90deg,#B22234 0,#B22234 60px,#fff 60px,#fff 120px); }
  .lp nav { display:flex; align-items:center; justify-content:space-between; padding:16px 40px; border-bottom:2px solid rgba(255,255,255,.15); }
  .lp .nav-logo { font-family:'Playfair Display',Georgia,serif; font-size:20px; font-weight:900; color:#fff; }
  .lp .nav-logo span { color:#B22234; }
  .lp .nav-right { display:flex; align-items:center; gap:14px; }
  .lp .nav-badge { background:#B22234; color:#fff; font-size:12px; font-weight:900; padding:6px 14px; border-radius:20px; letter-spacing:.06em; text-transform:uppercase; }
  .lp .cta-nav { font-size:14px; font-weight:900; color:#fff; background:#B22234; border:2px solid rgba(255,255,255,.3); border-radius:8px; padding:10px 20px; cursor:pointer; white-space:nowrap; }
  .lp .cta-nav:hover { background:#C8102E; }
  .lp .cta-primary { display:inline-block; font-family:'Playfair Display',Georgia,serif; font-size:clamp(18px,2.2vw,22px); font-weight:900; color:#fff; background:#B22234; border:2px solid rgba(255,255,255,.25); border-radius:10px; padding:18px 48px; cursor:pointer; }
  .lp .cta-primary:hover { background:#C8102E; transform:translateY(-1px); }
  .lp .cta-note { font-size:15px; font-weight:700; color:rgba(255,255,255,.8); margin-top:14px; }
  .lp .cta-block { text-align:center; padding:0 40px 80px; }
  .lp .hero { text-align:center; padding:80px 40px 60px; max-width:960px; margin:0 auto; }
  .lp .eyebrow { font-size:15px; font-weight:900; letter-spacing:.18em; text-transform:uppercase; color:#B22234; margin-bottom:24px; display:flex; align-items:center; justify-content:center; gap:12px; }
  .lp .eyebrow::before,.lp .eyebrow::after { content:''; display:block; width:48px; height:2px; background:#B22234; }
  .lp .hero h1 { font-family:'Playfair Display',Georgia,serif; font-size:clamp(34px,5vw,68px); font-weight:900; line-height:1.1; margin-bottom:20px; color:#fff; }
  .lp .hero h1 em { font-style:normal; color:#B22234; }
  .lp .hero-sub { font-size:clamp(18px,2vw,24px); font-weight:700; color:#fff; line-height:1.6; max-width:700px; margin:0 auto 48px; }
  .lp .countdown-wrap { background:rgba(255,255,255,.06); border:2px solid rgba(178,34,52,.6); border-radius:16px; padding:44px; max-width:720px; margin:0 auto 40px; }
  .lp .countdown-label { font-size:14px; font-weight:900; letter-spacing:.15em; text-transform:uppercase; color:#fff; margin-bottom:28px; }
  .lp .countdown { display:flex; justify-content:center; gap:12px; flex-wrap:wrap; }
  .lp .unit { display:flex; flex-direction:column; align-items:center; gap:8px; min-width:96px; }
  .lp .unit-num { font-family:'Playfair Display',Georgia,serif; font-size:clamp(44px,7vw,80px); font-weight:900; line-height:1; min-width:2ch; text-align:center; color:#fff; }
  .lp .unit-label { font-size:13px; font-weight:900; letter-spacing:.12em; text-transform:uppercase; color:rgba(255,255,255,.8); }
  .lp .colon { font-family:'Playfair Display',Georgia,serif; font-size:clamp(44px,7vw,80px); color:#B22234; line-height:1; align-self:flex-start; margin-top:4px; font-weight:900; }
  .lp .launch-date { margin-top:24px; font-size:15px; font-weight:700; color:#fff; letter-spacing:.05em; }
  .lp .launch-date strong { color:#B22234; font-weight:900; }
  .lp .explainer { max-width:860px; margin:0 auto 80px; padding:0 40px; }
  .lp .section-title { font-family:'Playfair Display',Georgia,serif; font-size:32px; font-weight:900; text-align:center; margin-bottom:24px; color:#fff; }
  .lp .section-title span { color:#B22234; }
  .lp .explainer-text { font-size:19px; font-weight:700; line-height:1.8; color:#fff; text-align:center; margin-bottom:52px; }
  .lp .features { display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:20px; }
  .lp .feature { background:rgba(255,255,255,.07); border:2px solid rgba(255,255,255,.15); border-radius:12px; padding:28px; }
  .lp .feature-icon { font-size:32px; margin-bottom:14px; }
  .lp .feature h3 { font-family:'Playfair Display',Georgia,serif; font-size:18px; font-weight:900; margin-bottom:10px; color:#fff; }
  .lp .feature p { font-size:15px; font-weight:700; color:rgba(255,255,255,.85); line-height:1.7; }
  .lp .signup { text-align:center; padding:0 40px 80px; max-width:640px; margin:0 auto; }
  .lp .signup h2 { font-family:'Playfair Display',Georgia,serif; font-size:32px; font-weight:900; margin-bottom:14px; color:#fff; }
  .lp .signup p { font-size:17px; font-weight:700; color:#fff; margin-bottom:28px; }
  .lp .signup-form { display:flex; gap:10px; max-width:460px; margin:0 auto; }
  .lp .signup-form input { flex:1; background:rgba(255,255,255,.1); border:2px solid rgba(255,255,255,.25); border-radius:8px; padding:14px 16px; font-size:15px; font-weight:700; color:#fff; outline:none; font-family:inherit; }
  .lp .signup-form input::placeholder { color:rgba(255,255,255,.5); }
  .lp .signup-form button { background:#B22234; color:#fff; border:none; border-radius:8px; padding:14px 24px; font-size:15px; font-weight:900; cursor:pointer; white-space:nowrap; }
  .lp footer { border-top:2px solid rgba(255,255,255,.15); padding:28px 40px; display:flex; align-items:center; justify-content:space-between; font-size:14px; font-weight:700; color:rgba(255,255,255,.7); flex-wrap:wrap; gap:10px; }
  .lp .stripe-bottom { height:6px; background:repeating-linear-gradient(90deg,#B22234 0,#B22234 40px,#fff 40px,#fff 80px,#002868 80px,#002868 120px); }
  @media(max-width:560px){ .lp nav{flex-direction:column; gap:12px; align-items:flex-start;} .lp .signup-form{flex-direction:column;} }
`;

const FEATURES = [
  ["🗳️", "Cast Your Vote", "Confirm your district, see the bills your representative is voting on, and record your own position anonymously."],
  ["📊", "See the Scorecard", "A real-time alignment score showing how often your rep votes the way their constituents actually want."],
  ["📋", "Track Live Bills", "Active legislation in the 119th Congress with plain-language explanations — no law degree required."],
  ["🪪", "Know Your Rights", "Full 50-state voter ID database. Know exactly what you need to vote in your state before Election Day."],
  ["⚖️", "Accountability Matrix", "Side-by-side: your vote, your district's vote, your rep's actual vote. The truth is in the numbers."],
  ["🔍", "Bill Intelligence", "AI-powered summaries of every major bill in plain English — what it does and who's behind it."],
];

export default function Landing({ onEnter }) {
  const [t, setT] = useState({ d: "00", h: "00", m: "00", s: "00" });
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [btn, setBtn] = useState("Notify me");

  useEffect(() => {
    const launch = new Date("2026-07-01T08:00:00").getTime();
    const pad = (n) => String(n).padStart(2, "0");
    const tick = () => {
      const diff = launch - Date.now();
      if (diff <= 0) { setT({ d: "00", h: "00", m: "00", s: "00" }); return; }
      setT({
        d: pad(Math.floor(diff / 86400000)),
        h: pad(Math.floor((diff % 86400000) / 3600000)),
        m: pad(Math.floor((diff % 3600000) / 60000)),
        s: pad(Math.floor((diff % 60000) / 1000)),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  async function submitEmail() {
    if (!email.includes("@")) return;
    setBtn("Sending...");
    try {
      const r = await fetch("https://formspree.io/f/xlgkwwyl", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email, source: "CheckYourRepresentative.com launch signup" }),
      });
      if (r.ok) setSent(true); else setBtn("Try again");
    } catch { setBtn("Try again"); }
  }

  return (
    <div className="lp">
      <style>{CSS}</style>
      <div className="stripe" />

      <nav>
        <div className="nav-logo">Check<span>Your</span>Representative<span>.com</span></div>
        <div className="nav-right">
          <div className="nav-badge">Launching July 1, 2026</div>
          <button className="cta-nav" onClick={onEnter}>Preview the Tool &rarr;</button>
        </div>
      </nav>

      <div className="hero">
        <div className="eyebrow">A Civic Accountability Platform</div>
        <h1>We are tracking down the people you placed in office and <em>holding them accountable.</em></h1>
        <p className="hero-sub">Your vote put them there. Now find out if they're voting the way you expected — on every bill, every time.</p>

        <div className="countdown-wrap">
          <div className="countdown-label">Launching in</div>
          <div className="countdown">
            <div className="unit"><div className="unit-num">{t.d}</div><div className="unit-label">Days</div></div>
            <div className="colon">:</div>
            <div className="unit"><div className="unit-num">{t.h}</div><div className="unit-label">Hours</div></div>
            <div className="colon">:</div>
            <div className="unit"><div className="unit-num">{t.m}</div><div className="unit-label">Minutes</div></div>
            <div className="colon">:</div>
            <div className="unit"><div className="unit-num">{t.s}</div><div className="unit-label">Seconds</div></div>
          </div>
          <div className="launch-date">Full launch: <strong>July 1, 2026 at 8:00 AM</strong></div>
        </div>

        <button className="cta-primary" onClick={onEnter}>Find Your Representative &rarr;</button>
        <div className="cta-note">The tool is live now — preview your district before the full July 1 launch.</div>
      </div>

      <div className="explainer">
        <div className="section-title">What is <span>CheckYourRepresentative.com</span>?</div>
        <p className="explainer-text">
          CheckYourRepresentative.com is a free, nonpartisan platform that gives every American the tools to see exactly how their elected representative votes in Congress — and compare it to how their district actually wants them to vote. No spin. No media filter. Just the record.
        </p>
        <div className="features">
          {FEATURES.map(([icon, title, body]) => (
            <div className="feature" key={title}>
              <div className="feature-icon">{icon}</div>
              <h3>{title}</h3>
              <p>{body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="cta-block">
        <button className="cta-primary" onClick={onEnter}>See It For Your District &rarr;</button>
      </div>

      <div className="signup">
        <h2>Get notified at launch</h2>
        <p>Be the first to hold your representative accountable when we go live July 1.</p>
        {sent ? (
          <div style={{ color: "#6bcf7f", fontSize: 16, fontWeight: 900 }}>✓ You're on the list. See you July 1.</div>
        ) : (
          <div className="signup-form">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" />
            <button onClick={submitEmail}>{btn}</button>
          </div>
        )}
      </div>

      <footer>
        <div>© 2026 CheckYourRepresentative.com — Nonpartisan civic accountability</div>
        <div style={{ letterSpacing: "4px", color: "rgba(255,255,255,.5)", fontWeight: 900 }}>★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★</div>
        <div>119th Congress · Paid for by We The People Inc.</div>
      </footer>
      <div className="stripe-bottom" />
    </div>
  );
}
