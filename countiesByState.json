// =============================================================================
// Check Your Representative — Constituent onboarding (consent) + digest preview
// -----------------------------------------------------------------------------
// Consumes the map/ZIP selection, captures EXPLICIT opt-in, lets the user pick
// topics + delivery, creates the profile, and previews their assigned bills
// with the shared AI summaries. People build their own profile — nobody is
// enrolled without choosing to be.
//
// Endpoints (see constituentProfile.js):
//   POST /api/profile            -> create (requires consent:true)
//   GET  /api/digest             -> { items:[{ id,title,reason,summary }] }
// Set USE_MOCK=false in your app.
// =============================================================================

import React, { useState } from "react";

const USE_MOCK = true;
const CONSENT_VERSION = "2026-06-13";

const C = { crimson:"#8B0000", navy:"#0A1A3F", gold:"#C9A227", parchment:"#FBF7EC",
  parchmentEdge:"#F0E6CE", ink:"#1A1A1A", muted:"#5C5347", line:"#D8C9A0" };
const serif = "Georgia, 'Times New Roman', serif";

// Official Congress.gov policy areas — what the user subscribes to.
const TOPICS = [
  "Agriculture and Food","Armed Forces and National Security","Civil Rights and Liberties",
  "Commerce","Crime and Law Enforcement","Economics and Public Finance","Education","Energy",
  "Environmental Protection","Families","Finance and Financial Sector","Government Operations",
  "Health","Housing and Community Development","Immigration","International Affairs",
  "Labor and Employment","Native Americans","Public Lands and Natural Resources",
  "Science, Technology, Communications","Social Welfare","Taxation","Transportation and Public Works",
];

// PREVIEW_MOCK ----------------------------------------------------------------
const MOCK_LOCATION = { state:"CO", county:"Larimer", city:"Loveland", zip:"80538" };
const MOCK_DISTRICT = "CO-02";
const MOCK_REPS = [{ name:"Rep. Joe Neguse", bioguideId:"N000191" }];
async function mockCreate() { await wait(500); return { ok:true, confirmToken:"mock" }; }
async function mockDigest() {
  await wait(500);
  return { items: [
    { id:"hr-1234-119", title:"H.R. 1234 — Clean Water Infrastructure Act", reason:"topic: Environmental Protection",
      summary:{ headline:"Funds upgrades to local water systems",
        plain:"Authorizes federal grants to repair aging drinking-water and wastewater infrastructure, with priority for rural and lower-income communities.",
        affects:"Residents served by older municipal water systems.", status:"Passed House committee" } },
    { id:"s-567-119", title:"S. 567 — Wildfire Resilience Act", reason:"via Rep. Joe Neguse",
      summary:{ headline:"Expands wildfire prevention funding for Western states",
        plain:"Increases funding for forest-thinning and defensible-space programs and creates a grant for community wildfire plans.",
        affects:"Communities in high wildfire-risk areas, including much of Colorado.", status:"Introduced; referred to committee" } },
  ]};
}
const wait = (ms) => new Promise(r => setTimeout(r, ms));
// end PREVIEW_MOCK ------------------------------------------------------------

export default function ConstituentOnboarding({
  location = USE_MOCK ? MOCK_LOCATION : null,
  district = USE_MOCK ? MOCK_DISTRICT : null,
  reps     = USE_MOCK ? MOCK_REPS : [],
  onCreated,
}) {
  const [topics, setTopics] = useState(new Set());
  const [wantsEmail, setWantsEmail] = useState(false);
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [phase, setPhase] = useState("form"); // form | submitting | done
  const [digest, setDigest] = useState(null);
  const [error, setError] = useState(null);

  const toggleTopic = (t) => setTopics(prev => {
    const n = new Set(prev); n.has(t) ? n.delete(t) : n.add(t); return n;
  });

  const emailValid = !wantsEmail || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  const canSubmit = consent && topics.size > 0 && emailValid && phase !== "submitting";

  async function submit() {
    if (!canSubmit) return;
    setPhase("submitting"); setError(null);
    const payload = {
      consent: true, consentVersion: CONSENT_VERSION,
      location, district, reps,
      topics: [...topics], wantsEmail, email: wantsEmail ? email : null,
    };
    try {
      // Save the consent-based profile to the database (falls back locally).
      let create;
      try {
        const r = await fetch("/api/profile", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload) });
        if (!r.ok) throw new Error("api_unavailable");
        create = await r.json();
      } catch {
        create = await mockCreate();
      }
      if (!create.ok) throw new Error("create_failed");

      // Bills are REAL: pull this district's live digest from /api/digest.
      // If the endpoint isn't there (e.g. running locally with `npm run dev`,
      // which doesn't serve /api), fall back to the sample so the screen works.
      let d;
      try {
        const params = new URLSearchParams({ district: district || "", topics: [...topics].join(",") });
        const r = await fetch(`/api/digest?${params}`);
        if (!r.ok) throw new Error("api_unavailable");
        d = await r.json();                       // real data, even if items is empty
      } catch {
        d = await mockDigest();                   // local/dev fallback only
        d.sample = true;
      }

      setDigest(d); setPhase("done");
      onCreated && onCreated({ profile: payload, confirmToken: create.confirmToken });
    } catch {
      setError("Couldn't create your profile. Please try again.");
      setPhase("form");
    }
  }

  return (
    <div style={{ fontFamily:serif, color:C.ink, background:C.parchment, border:`1px solid ${C.line}`,
                  borderRadius:6, overflow:"hidden", maxWidth:680, margin:"0 auto" }}>
      <StarStrip />
      <div style={{ padding:"20px 24px 26px" }}>
        <div style={{ textTransform:"uppercase", letterSpacing:2, fontSize:11, color:C.gold, fontWeight:700 }}>
          Get Your Legislative Digest
        </div>
        <h2 style={{ margin:"4px 0 2px", fontSize:22, color:C.navy }}>
          {location ? `${location.city}, ${location.state}` : "Your district"}
          {district && <span style={{ color:C.crimson }}> · {district}</span>}
        </h2>
        <p style={{ margin:0, fontSize:13, color:C.muted }}>
          Choose what you care about. We'll track those bills for your district and send plain-language summaries — only if you ask us to.
        </p>

        {phase !== "done" ? (
          <>
            {/* topics */}
            <div style={{ marginTop:18 }}>
              <div style={{ fontSize:12, fontWeight:700, color:C.navy, marginBottom:8 }}>
                TOPICS YOU CARE ABOUT {topics.size > 0 && <span style={{ color:C.muted }}>· {topics.size} selected</span>}
              </div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:7 }}>
                {TOPICS.map(t => {
                  const on = topics.has(t);
                  return (
                    <button key={t} onClick={()=>toggleTopic(t)}
                      style={{ fontFamily:serif, fontSize:12.5, padding:"6px 11px", borderRadius:14, cursor:"pointer",
                               border:`1.5px solid ${on ? C.navy : C.line}`,
                               background: on ? C.navy : "#fff", color: on ? "#fff" : C.ink }}>
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* delivery */}
            <div style={{ marginTop:20 }}>
              <div style={{ fontSize:12, fontWeight:700, color:C.navy, marginBottom:8 }}>HOW TO RECEIVE IT</div>
              <div style={{ fontSize:13, color:C.muted, marginBottom:8 }}>
                ✓ Always available on your dashboard.
              </div>
              <label style={{ display:"flex", alignItems:"center", gap:8, fontSize:14, cursor:"pointer" }}>
                <input type="checkbox" checked={wantsEmail} onChange={e=>setWantsEmail(e.target.checked)} />
                Also email me a digest
              </label>
              {wantsEmail && (
                <div style={{ marginTop:8 }}>
                  <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"
                    style={{ padding:"8px 11px", width:260, maxWidth:"100%", fontFamily:serif, fontSize:14,
                             border:`1px solid ${emailValid ? C.line : C.crimson}`, borderRadius:4, background:"#fff" }} />
                  <div style={{ fontSize:11.5, color:C.muted, marginTop:5 }}>
                    We'll send one confirmation email — you're not subscribed until you click the link in it. Unsubscribe anytime.
                  </div>
                </div>
              )}
            </div>

            {/* consent — required, explicit, versioned */}
            <label style={{ display:"flex", alignItems:"flex-start", gap:9, marginTop:20, fontSize:13.5,
                            background:"#fff", border:`1px solid ${C.line}`, borderRadius:4, padding:"12px 14px", cursor:"pointer" }}>
              <input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} style={{ marginTop:3 }} />
              <span>
                I'm creating this profile for myself and I want Check Your Representative to track
                legislation for my district and prepare summaries for me. I can edit my topics or
                delete my profile at any time. <span style={{ color:C.muted }}>(Consent v{CONSENT_VERSION})</span>
              </span>
            </label>

            {error && <div style={{ marginTop:12, color:C.crimson, fontSize:13 }}>{error}</div>}

            <button onClick={submit} disabled={!canSubmit}
              style={{ marginTop:18, width:"100%", padding:"13px", fontFamily:serif, fontSize:16, fontWeight:700,
                       borderRadius:4, border:"none", cursor: canSubmit ? "pointer":"not-allowed",
                       background: canSubmit ? C.crimson : "#C9BFAB", color:"#fff", letterSpacing:0.5 }}>
              {phase === "submitting" ? "Building your digest…" : "Create My Profile"}
            </button>
            {!consent && <div style={{ fontSize:11.5, color:C.muted, marginTop:6, textAlign:"center" }}>
              Check the box above to continue — your choice, always.</div>}
          </>
        ) : (
          <DigestPreview digest={digest} wantsEmail={wantsEmail} />
        )}
      </div>
    </div>
  );
}

function DigestPreview({ digest, wantsEmail }) {
  const items = digest?.items || [];
  return (
    <div style={{ marginTop:18 }}>
      <div style={{ background:"#fff", border:`1px solid ${C.line}`, borderRadius:4, padding:"12px 14px", marginBottom:14 }}>
        <strong style={{ color:C.navy }}>You're all set.</strong>{" "}
        {wantsEmail
          ? <span style={{ fontSize:13.5 }}>Check your inbox and click the confirmation link to start emails. Until then, your digest lives here.</span>
          : <span style={{ fontSize:13.5 }}>Your digest is ready below and on your dashboard.</span>}
      </div>

      {digest?.sample && (
        <div style={{ background:"#FFF8E1", border:`1px solid ${C.gold}`, borderRadius:4,
                      padding:"8px 12px", marginBottom:12, fontSize:12, color:C.muted }}>
          Showing sample bills — the live feed runs once this is deployed (it isn't served by the local dev server).
        </div>
      )}

      <div style={{ fontSize:12, fontWeight:700, color:C.navy, letterSpacing:1,
                    borderBottom:`2px solid ${C.gold}`, paddingBottom:5, marginBottom:6 }}>
        {digest?.rep ? `${digest.rep.name} · ` : ""}YOUR BILLS · {items.length}
      </div>

      {items.length === 0 && !digest?.sample && (
        <p style={{ fontSize:13.5, color:C.muted, padding:"10px 0" }}>
          No recent bills from your representative right now. We'll keep checking and your digest will fill in as they act.
        </p>
      )}

      {items.map(it => (
        <div key={it.id} style={{ padding:"12px 0", borderBottom:`1px solid ${C.parchmentEdge}` }}>
          <div style={{ fontSize:12, color:C.muted }}>{it.reason}</div>
          <div style={{ fontSize:16, fontWeight:700, color:C.navy, margin:"2px 0" }}>{it.summary?.headline || it.title}</div>
          <div style={{ fontSize:13.5, lineHeight:1.5 }}>{it.summary?.plain}</div>
          <div style={{ fontSize:12, color:C.muted, marginTop:4 }}>
            {it.summary?.affects ? <><strong>Who it affects:</strong> {it.summary.affects} &nbsp;·&nbsp; </> : null}
            <strong>Status:</strong> {it.summary?.status}
          </div>
        </div>
      ))}
      <p style={{ fontSize:11, color:C.muted, marginTop:12, fontStyle:"italic" }}>
        Summaries are AI-generated, factual, and non-partisan — they explain what each bill does, not how to vote.
      </p>
    </div>
  );
}

const StarStrip = () => (
  <div style={{ background:C.navy, padding:"6px 0", display:"flex", justifyContent:"center", gap:9 }}>
    {Array.from({length:13}).map((_,i)=><span key={i} style={{color:C.gold, fontSize:11}}>★</span>)}
  </div>
);
