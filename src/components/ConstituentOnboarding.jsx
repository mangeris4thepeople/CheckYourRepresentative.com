// =============================================================================
// ConstituentOnboarding — USE_MOCK = false
// Shows bill digest for district. Profile/signup hidden until July 1, 2026.
// =============================================================================
import React, { useState, useEffect } from "react";

const ONBOARD_CSS = `
  @media (max-width: 600px) {
    .cyr-onboard-pad { padding: 16px 14px 20px !important; }
    .cyr-onboard-h2 { font-size: 18px !important; }
    .cyr-topic-btn { font-size: 12px !important; padding: 6px 9px !important; }
  }
`;
if (typeof document !== "undefined" && !document.getElementById("cyr-onboard-css")) {
  const _ob = document.createElement("style");
  _ob.id = "cyr-onboard-css";
  _ob.textContent = ONBOARD_CSS;
  document.head.appendChild(_ob);
}


const LAUNCH_DATE = new Date("2026-07-01T08:00:00").getTime();
const PRE_LAUNCH  = Date.now() < LAUNCH_DATE;

const C = { crimson:"#8B0000", navy:"#0A1A3F", gold:"#C9A227", parchment:"#FBF7EC",
  parchmentEdge:"#F0E6CE", ink:"#1A1A1A", muted:"#5C5347", line:"#D8C9A0" };
const serif = "Georgia, 'Times New Roman', serif";

const TOPICS = [
  "Agriculture and Food","Armed Forces and National Security","Civil Rights and Liberties",
  "Commerce","Crime and Law Enforcement","Economics and Public Finance","Education","Energy",
  "Environmental Protection","Families","Finance and Financial Sector","Government Operations",
  "Health","Housing and Community Development","Immigration","International Affairs",
  "Labor and Employment","Native Americans","Public Lands and Natural Resources",
  "Science, Technology, Communications","Social Welfare","Taxation","Transportation and Public Works",
];

export default function ConstituentOnboarding({ location, district, reps = [], onCreated, onGoVote }) {
  const [topics, setTopics]       = useState(new Set());
  const [digest, setDigest]       = useState(null);
  const [digestPhase, setDigestPhase] = useState("idle"); // idle|loading|ready|error
  const [wantsEmail, setWantsEmail]   = useState(false);
  const [email, setEmail]         = useState("");
  const [consent, setConsent]     = useState(false);
  const [phase, setPhase]         = useState("form"); // form|submitting|done
  const [error, setError]         = useState(null);

  const toggleTopic = (t) => setTopics(prev => {
    const n = new Set(prev); n.has(t) ? n.delete(t) : n.add(t); return n;
  });

  // Load digest preview when district available
  useEffect(() => {
    if (!district || topics.size === 0) return;
    setDigestPhase("loading");
    const params = new URLSearchParams({ district, topics: [...topics].join(",") });
    fetch(`/api/digest?${params}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => { setDigest(d); setDigestPhase("ready"); })
      .catch(() => setDigestPhase("error"));
  }, [district, topics.size]);

  const emailValid = !wantsEmail || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  const canSubmit  = consent && topics.size > 0 && emailValid && phase !== "submitting";

  async function submit() {
    if (!canSubmit || PRE_LAUNCH) return;
    setPhase("submitting"); setError(null);
    try {
      const r = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consent: true, consentVersion: "2026-07-01",
          location, district, reps,
          topics: [...topics], wantsEmail, email: wantsEmail ? email : null,
        }),
      });
      if (!r.ok) throw new Error();
      const data = await r.json();
      if (!data.ok) throw new Error();
      setPhase("done");
      onCreated?.({ confirmToken: data.confirmToken });
    } catch {
      setError("Couldn't create your profile. Please try again.");
      setPhase("form");
    }
  }

  return (
    <div style={{ fontFamily: serif, color: C.ink, background: C.parchment,
                  border: `1px solid ${C.line}`, borderRadius: 6, overflow: "hidden",
                  maxWidth: 680, margin: "0 auto" }}>
      <StarStrip />
      <div className="cyr-onboard-pad" style={{ padding: "20px 24px 26px" }}>
        <div style={{ textTransform: "uppercase", letterSpacing: 2, fontSize: 11,
                      color: C.gold, fontWeight: 700 }}>
          Your Legislative Digest
        </div>
        <h2 className="cyr-onboard-h2" style={{ margin: "4px 0 2px", fontSize: 22, color: C.navy }}>
          {location ? `${location.city}, ${location.state}` : "Your district"}
          {district && <span style={{ color: C.crimson }}> · {district}</span>}
        </h2>
        <p style={{ margin: "0 0 18px", fontSize: 13, color: C.muted }}>
          Choose topics to filter bills from your representative — no sign-up required to browse.
        </p>

        {/* Topic selector */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 8 }}>
            TOPICS YOU CARE ABOUT
            {topics.size > 0 && <span style={{ color: C.muted }}> · {topics.size} selected</span>}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {TOPICS.map(t => {
              const on = topics.has(t);
              return (
                <button key={t} onClick={() => toggleTopic(t)}
                  className="cyr-topic-btn"
                  style={{ fontFamily: serif, fontSize: 12.5, padding: "6px 11px",
                           borderRadius: 14, cursor: "pointer",
                           border: `1.5px solid ${on ? C.navy : C.line}`,
                           background: on ? C.navy : "#fff",
                           color: on ? "#fff" : C.ink }}>
                  {t}
                </button>
              );
            })}
          </div>
        </div>

        {/* Digest preview */}
        {digestPhase === "loading" && (
          <div style={{ padding: "20px 0", textAlign: "center", color: C.muted, fontSize: 13.5 }}>
            Loading bills for {district}…
          </div>
        )}
        {digestPhase === "error" && (
          <div style={{ padding: "12px 14px", background: "#FBE9E7", borderRadius: 4,
                        color: C.crimson, fontSize: 13 }}>
            Couldn't load bills right now. Try again in a moment.
          </div>
        )}
        {digestPhase === "ready" && digest && (
          <DigestPreview digest={digest} onGoVote={onGoVote} />
        )}
        {topics.size === 0 && digestPhase === "idle" && (
          <div style={{ padding: "16px 14px", background: "#fff", border: `1px solid ${C.line}`,
                        borderRadius: 4, fontSize: 13.5, color: C.muted, fontStyle: "italic" }}>
            Select topics above to see bills from your representative.
          </div>
        )}

        {/* Profile signup — HIDDEN until July 1 */}
        {!PRE_LAUNCH && phase !== "done" && (
          <>
            <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${C.line}` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 12 }}>
                SAVE YOUR PREFERENCES & GET EMAIL UPDATES
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8,
                              fontSize: 14, cursor: "pointer", marginBottom: 10 }}>
                <input type="checkbox" checked={wantsEmail}
                  onChange={e => setWantsEmail(e.target.checked)} />
                Email me a digest when my rep votes
              </label>
              {wantsEmail && (
                <input value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com" type="email"
                  style={{ padding: "8px 11px", width: 280, maxWidth: "100%", fontFamily: serif,
                           fontSize: 14, border: `1px solid ${emailValid ? C.line : C.crimson}`,
                           borderRadius: 4, background: "#fff", marginBottom: 10 }} />
              )}
              <label style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 13.5,
                              background: "#fff", border: `1px solid ${C.line}`, borderRadius: 4,
                              padding: "12px 14px", cursor: "pointer", marginBottom: 12 }}>
                <input type="checkbox" checked={consent}
                  onChange={e => setConsent(e.target.checked)} style={{ marginTop: 3 }} />
                <span>
                  I'm creating this profile for myself and want Check Your Representative to track
                  legislation for my district. I can delete my profile at any time.
                </span>
              </label>
              {error && <div style={{ marginBottom: 10, color: C.crimson, fontSize: 13 }}>{error}</div>}
              <button onClick={submit} disabled={!canSubmit}
                style={{ width: "100%", padding: "13px", fontFamily: serif, fontSize: 16,
                         fontWeight: 700, borderRadius: 4, border: "none",
                         cursor: canSubmit ? "pointer" : "not-allowed",
                         background: canSubmit ? C.crimson : "#C9BFAB",
                         color: "#fff", letterSpacing: 0.5 }}>
                {phase === "submitting" ? "Saving…" : "Create My Profile"}
              </button>
            </div>
          </>
        )}

        {!PRE_LAUNCH && phase === "done" && (
          <div style={{ marginTop: 18, padding: "14px 16px", background: "#fff",
                        border: `1px solid ${C.line}`, borderRadius: 4, fontSize: 14, color: C.navy }}>
            <strong>You're all set.</strong>{" "}
            {wantsEmail
              ? "Check your inbox and click the confirmation link to start receiving email digests."
              : "Your topic preferences are saved. Your digest is ready above."}
          </div>
        )}

        {/* Pre-launch notice instead of signup */}
        {PRE_LAUNCH && (
          <div style={{ marginTop: 18, padding: "12px 16px", background: "#fff",
                        border: `1px solid ${C.gold}`, borderRadius: 4, fontSize: 13, color: C.muted }}>
            <strong style={{ color: C.navy }}>Full profiles launch July 1, 2026.</strong>{" "}
            Browse your district's bills above and vote on them now — your votes are recorded immediately.
            Email digests and saved profiles go live on launch day.
          </div>
        )}
      </div>
    </div>
  );
}

function DigestPreview({ digest, onGoVote }) {
  return (
    <div style={{ borderTop: "2px solid #C9A227", paddingTop: 16, textAlign: "center" }}>
      {digest?.rep && (
        <div style={{ fontSize: 13, color: "#5C5347", marginBottom: 12 }}>
          Your representative: <strong style={{ color: "#0A1A3F" }}>{digest.rep.name}</strong> · District found ✓
        </div>
      )}
      <div style={{ fontSize: 15, fontWeight: 700, color: "#0A1A3F", marginBottom: 8 }}>
        Ready to vote on active legislation?
      </div>
      <p style={{ fontSize: 13.5, color: "#5C5347", marginBottom: 16, lineHeight: 1.6 }}>
        Every active bill in Congress — explained in plain English with the full money trail.
        Your vote is recorded and sent to your representative daily.
      </p>
      <button
        onClick={onGoVote}
        style={{
          width: "100%", padding: "18px", fontFamily: "Georgia, serif",
          fontSize: 20, fontWeight: 900, borderRadius: 8, border: "none",
          background: "#1B5E20", color: "#fff", cursor: "pointer", letterSpacing: 1
        }}>
        🗳️ VOTE ON BILLS NOW →
      </button>
    </div>
  );
}

const StarStrip = () => (
  <div style={{ background: C.navy, padding: "6px 0", display: "flex",
                justifyContent: "center", gap: 9 }}>
    {Array.from({length:13}).map((_,i) =>
      <span key={i} style={{color: C.gold, fontSize: 11}}>★</span>)}
  </div>
);

