// =============================================================================
// ConstituentOnboarding - USE_MOCK = false
// Shows bill digest for district. Profile/signup hidden until July 1, 2026.
// =============================================================================
import React, { useState, useEffect } from "react";

const ONBOARD_CSS = `
  @media (max-width: 600px) {
    .cyr-onboard-pad { padding: 16px 14px 20px !important; }
    .cyr-onboard-h2 { font-size: 18px !important; }
    .cyr-topic-btn { font-size: 12.5px !important; padding: 7px 11px !important; }
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

const C = { crimson:"#E0313F", navy:"#0E2A6B", blue:"#2563EB", ink:"#0F172A", muted:"#5B6578", line:"#E2E8F0" };
const serif = "var(--cyr-sans)";

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
    <div style={{ fontFamily: serif, color: C.ink, background: "#fff",
                  border: `1px solid ${C.line}`, borderRadius: 20, overflow: "hidden",
                  maxWidth: "100%", margin: "0 auto", boxShadow: "var(--cyr-shadow)" }}>
      <div style={{ height: 6, background: "linear-gradient(90deg,#0E2A6B,#2563EB 60%,#E0313F)" }} />
      <div className="cyr-onboard-pad" style={{ padding: "20px 22px 24px" }}>
        <div className="cyr-eyebrow" style={{ fontSize: 11 }}>
          Your legislative digest
        </div>
        <h2 className="cyr-onboard-h2 cyr-h2" style={{ margin: "4px 0 4px", fontSize: 22 }}>
          {location ? `${location.city}, ${location.state}` : "Your district"}
          {district && <span style={{ color: C.crimson }}> · {district}</span>}
        </h2>
        <p style={{ margin: "0 0 18px", fontSize: 14, color: C.muted, lineHeight: 1.55 }}>
          Choose topics to filter bills from your representative. No sign-up required to browse.
        </p>

        {/* Topic selector */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.navy, marginBottom: 10, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            Topics you care about
            {topics.size > 0 && <span className="cyr-chip" style={{ fontSize: 11.5, padding: "2px 9px" }}>{topics.size} selected</span>}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {TOPICS.map(t => {
              const on = topics.has(t);
              return (
                <button key={t} onClick={() => toggleTopic(t)} aria-pressed={on}
                  className="cyr-topic-btn"
                  style={{ fontFamily: serif, fontSize: 13, fontWeight: 600, padding: "8px 13px", minHeight: 36,
                           borderRadius: 999, cursor: "pointer",
                           border: `1px solid ${on ? C.navy : "#D5DDEA"}`,
                           background: on ? C.navy : "#fff",
                           color: on ? "#fff" : C.ink,
                           boxShadow: on ? "0 4px 12px rgba(14,42,107,.2)" : "none" }}>
                  {on && <span aria-hidden>✓ </span>}{t}
                </button>
              );
            })}
          </div>
        </div>

        {/* Digest preview */}
        {digestPhase === "loading" && (
          <div style={{ padding: "8px 0" }}>
            <div style={{ textAlign: "center", color: C.muted, fontSize: 13.5, marginBottom: 10 }}>Loading bills for {district}…</div>
            <div className="cyr-skeleton" style={{ height: 120 }} />
          </div>
        )}
        {digestPhase === "error" && (
          <div style={{ padding: "12px 14px", background: "#FEF2F2", borderRadius: 14, border: "1px solid #FECACA",
                        color: "#991B1B", fontSize: 13.5, fontWeight: 600 }}>
            Couldn't load bills right now. Try again in a moment.
          </div>
        )}
        {digestPhase === "ready" && digest && (
          <DigestPreview digest={digest} onGoVote={onGoVote} />
        )}
        {topics.size === 0 && digestPhase === "idle" && (
          <div style={{ padding: "14px 16px", background: "#F6F8FC", border: `1px dashed #CBD5E1`,
                        borderRadius: 14, fontSize: 14, color: C.muted, textAlign: "center" }}>
            Select topics above to see bills from your representative.
          </div>
        )}

        {/* Profile signup - HIDDEN until July 1 */}
        {!PRE_LAUNCH && phase !== "done" && (
          <>
            <div style={{ marginTop: 22, paddingTop: 20, borderTop: `1px solid ${C.line}` }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: C.navy, marginBottom: 12 }}>
                Save your preferences and get email updates
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 10,
                              fontSize: 14.5, cursor: "pointer", marginBottom: 10, minHeight: 40 }}>
                <input type="checkbox" checked={wantsEmail}
                  onChange={e => setWantsEmail(e.target.checked)} style={{ width: 18, height: 18, accentColor: C.blue }} />
                Email me a digest when my rep votes
              </label>
              {wantsEmail && (
                <input value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com" type="email"
                  style={{ padding: "11px 13px", width: 320, maxWidth: "100%", fontFamily: serif, minHeight: 46,
                           fontSize: 15, border: `1px solid ${emailValid ? "#D5DDEA" : C.crimson}`,
                           borderRadius: 12, background: "#fff", marginBottom: 12 }} />
              )}
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, lineHeight: 1.55,
                              background: consent ? "#F3F7FF" : "#F8FAFE", border: `1px solid ${consent ? "#C9D7F2" : C.line}`, borderRadius: 14,
                              padding: "12px 14px", cursor: "pointer", marginBottom: 12 }}>
                <input type="checkbox" checked={consent}
                  onChange={e => setConsent(e.target.checked)} style={{ marginTop: 3, width: 18, height: 18, accentColor: C.blue, flexShrink: 0 }} />
                <span>
                  I'm creating this profile for myself and want Check Your Representative to track
                  legislation for my district. I can delete my profile at any time.
                </span>
              </label>
              {error && <div style={{ marginBottom: 10, color: "#991B1B", fontSize: 13.5, fontWeight: 600 }}>{error}</div>}
              <button onClick={submit} disabled={!canSubmit} className="cyr-btn cyr-btn-primary"
                style={{ width: "100%", justifyContent: "center", minHeight: 50, fontSize: 16,
                         cursor: canSubmit ? "pointer" : "not-allowed", opacity: canSubmit ? 1 : 0.5 }}>
                {phase === "submitting" ? "Saving…" : "Create my profile"}
              </button>
            </div>
          </>
        )}

        {!PRE_LAUNCH && phase === "done" && (
          <div style={{ marginTop: 18, padding: "14px 16px", background: "#ECFDF3",
                        border: "1px solid #BBF7D0", borderRadius: 14, fontSize: 14, color: "#14532D", lineHeight: 1.55 }}>
            <strong>You're all set.</strong>{" "}
            {wantsEmail
              ? "Check your inbox and click the confirmation link to start receiving email digests."
              : "Your topic preferences are saved. Your digest is ready above."}
          </div>
        )}

        {/* Pre-launch notice instead of signup */}
        {PRE_LAUNCH && (
          <div style={{ marginTop: 18, padding: "12px 16px", background: "#FFF6DD",
                        border: "1px solid #F5D27A", borderRadius: 14, fontSize: 13.5, color: "#5B4A1A", lineHeight: 1.55 }}>
            <strong style={{ color: C.navy }}>Full profiles launch July 1, 2026.</strong>{" "}
            Browse your district's bills above and vote on them now. Your votes are recorded immediately.
            Email digests and saved profiles go live on launch day.
          </div>
        )}
      </div>
    </div>
  );
}

function DigestPreview({ digest, onGoVote }) {
  return (
    <div style={{ padding: "18px 16px", borderRadius: 18, textAlign: "center",
                  background: "linear-gradient(180deg,#F3F7FF 0%,#FFFFFF 100%)", border: "1px solid #DCE6FA" }}>
      {digest?.rep && (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "center",
                      fontSize: 13.5, color: "#5B6578", marginBottom: 12, background: "#fff", border: "1px solid #E2E8F0",
                      borderRadius: 999, padding: "6px 14px" }}>
          Your representative: <strong style={{ color: "#0E2A6B" }}>{digest.rep.name}</strong>
          <span style={{ color: "#15803D", fontWeight: 700 }}>· District found ✓</span>
        </div>
      )}
      <div className="cyr-h2" style={{ fontSize: 20, marginBottom: 6 }}>
        Ready to vote on active legislation?
      </div>
      <p style={{ fontSize: 14, color: "#5B6578", margin: "0 0 16px", lineHeight: 1.6 }}>
        Every active bill in Congress, explained in plain English with the full money trail.
        Your vote is recorded and sent to your representative daily.
      </p>
      <button
        onClick={onGoVote}
        style={{
          width: "100%", minHeight: 58, padding: "14px 18px", fontFamily: "var(--cyr-sans)",
          fontSize: 18, fontWeight: 800, borderRadius: 999, border: "none",
          background: "linear-gradient(135deg,#16A34A,#22C55E)", color: "#fff", cursor: "pointer",
          boxShadow: "0 10px 22px rgba(22,163,74,.3)", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10,
        }}>
        <span aria-hidden>🗳️</span> Vote on bills now <span aria-hidden>→</span>
      </button>
    </div>
  );
}
