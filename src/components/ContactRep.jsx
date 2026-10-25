// =============================================================================
// ContactRep.jsx - "Make Your Voice Heard" panel
// Shows after a constituent casts their position on a bill.
// Loads their 3 legislators (House rep + 2 Senators), displays an AI-drafted
// letter, and gives them one-click links to each official's contact page.
// =============================================================================

import React, { useState, useEffect, useRef } from "react";
import { getStoredSession } from "../lib/session.js";
import { Loading, ErrorBox } from "./ui/Kit.jsx";

const C = {
  red: "#DC2626",
  navy: "#0E2A6B",
  blue: "#2563EB",
  ink: "#0F172A",
  muted: "#5B6578",
  line: "#E2E8F0",
  green: "#15803D",
};
const sans = "var(--cyr-sans)";
const SCOPED_CSS = `
  @media (max-width: 560px) { .cyr-cr-body { padding: 16px 14px 20px !important; } }
`;

const CHAMBER_ICON = { House: "🏛️", Senate: "⚖️" };
const PARTY_COLOR  = { Democrat: "#1D4ED8", Republican: C.red, Independent: C.muted };

// ---------------------------------------------------------------------------
// Main component
// Props:
//   district   - e.g. "CO-04"
//   billId     - e.g. "hr-1234-119"
//   billTitle  - full title string
//   position   - "support" | "oppose" | "undecided"
//   onClose    - optional callback to dismiss
// ---------------------------------------------------------------------------
export default function ContactRep({ district, billId, billTitle, position, onClose }) {
  const [phase, setPhase] = useState("loading"); // loading | ready | error
  const [legislators, setLegislators] = useState([]);
  const [letter, setLetter] = useState("");
  const [letterEdited, setLetterEdited] = useState("");
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const textRef = useRef(null);

  useEffect(() => {
    if (!district || !billId) { setPhase("error"); return; }
    setPhase("loading");
    const params = new URLSearchParams({
      district,
      billId,
      position: position || "undecided",
    });
    fetch(`/api/contact?${params}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setLegislators(data.legislators || []);
        setLetter(data.letter || "");
        setLetterEdited(data.letter || "");
        setPhase("ready");
      // Track that this constituent opened Contact Rep (intent to contact).
      // The server derives the identity from the session; signed-out viewers
      // aren't tracked (the accountability matrix only counts real accounts).
      try {
        const sess = getStoredSession();
        if (sess?.token) {
          fetch("/api/contact-track", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ billId, district, position, sessionToken: sess.token })
          });
        }
      } catch {}
      })
      .catch(() => {
        // Fallback: show generic contact links even if API fails
        setLegislators([
          { name: "Your House Representative", chamber: "House", party: "",
            contactUrl: "https://www.house.gov/representatives/find-your-representative" },
          { name: "Senator 1", chamber: "Senate", party: "",
            contactUrl: "https://www.senate.gov/senators/contact" },
          { name: "Senator 2", chamber: "Senate", party: "",
            contactUrl: "https://www.senate.gov/senators/contact" },
        ]);
        setLetter(fallbackLetter(district, billTitle, position));
        setLetterEdited(fallbackLetter(district, billTitle, position));
        setPhase("ready");
      });
  }, [district, billId, billTitle, position]);

  function copyLetter() {
    navigator.clipboard.writeText(letterEdited).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  function openContact(url) {
    // Copy to clipboard first so they can paste it immediately
    navigator.clipboard.writeText(letterEdited).catch(() => {});
    window.open(url, "_blank", "noopener,noreferrer");
  }

  const positionLabel = position === "support" ? "Support" : position === "oppose" ? "Oppose" : "Undecided";
  const positionTone = position === "support"
    ? { bg: "#ECFDF3", fg: "#15803D", icon: "✓" }
    : position === "oppose" ? { bg: "#FEF2F2", fg: "#B91C1C", icon: "✕" } : { bg: "#F1F5F9", fg: "#475569", icon: "?" };

  return (
    <div className="cyr-card cyr-rise" style={{
      fontFamily: sans, color: C.ink, overflow: "hidden", borderRadius: 24,
      maxWidth: 820, margin: "18px auto 0", boxShadow: "var(--cyr-shadow-lg)",
    }}>
      <style>{SCOPED_CSS}</style>
      {/* Header */}
      <div className="cyr-panel-head" style={{ alignItems: "flex-start", padding: "18px 20px", flexWrap: "wrap" }}>
        <div style={{ minWidth: 0, flex: "1 1 200px" }}>
          <div className="cyr-eyebrow" style={{ fontSize: 11 }}>Make your voice heard</div>
          <div className="cyr-h2" style={{ fontSize: 22, marginTop: 4 }}>Contact your legislators</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <span className="cyr-chip" style={{ background: positionTone.bg, color: positionTone.fg, fontSize: 12.5, padding: "6px 12px" }}>
            <span aria-hidden>{positionTone.icon}</span> {positionLabel}
          </span>
          {onClose && (
            <button onClick={onClose} aria-label="Close" className="cyr-btn cyr-btn-ghost"
              style={{ width: 40, height: 40, padding: 0, justifyContent: "center", fontSize: 15 }}>✕</button>
          )}
        </div>
      </div>

      <div className="cyr-cr-body" style={{ padding: "20px 22px 24px" }}>
        {phase === "loading" && (
          <div>
            <div style={{ fontSize: 14.5, color: C.muted, marginBottom: 14, display: "flex", gap: 8, alignItems: "center" }}>
              <span aria-hidden>⚖️</span> Looking up your legislators and drafting your letter…
            </div>
            <Loading rows={3} height={58} />
          </div>
        )}

        {phase === "error" && (
          <ErrorBox>Couldn't load legislator info. Try again or visit congress.gov directly.</ErrorBox>
        )}

        {phase === "ready" && (
          <>
            {/* Intro */}
            <p style={{ margin: "0 0 20px", fontSize: 15, color: "#334155", lineHeight: 1.65 }}>
              Your position has been recorded. Now take the next step: let your elected officials know directly.
              We've drafted a letter for you. Edit it, then send it to each of your{" "}
              <strong style={{ color: C.navy }}>{legislators.length} legislators</strong> below.
            </p>

            {/* Legislator cards */}
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: C.navy, marginBottom: 10 }}>
                Your representatives
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))", gap: 10 }}>
                {legislators.map((leg, i) => (
                  <LegislatorCard
                    key={i}
                    leg={leg}
                    active={activeTab === i}
                    onClick={() => setActiveTab(i)}
                  />
                ))}
              </div>
            </div>

            {/* Letter editor */}
            <div style={{ marginBottom: 16 }}>
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "baseline",
                marginBottom: 8, gap: 8, flexWrap: "wrap",
              }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.navy }}>
                  Your letter: edit as needed
                </div>
                <div style={{ fontSize: 12.5, color: C.muted }}>
                  Personalize before sending
                </div>
              </div>
              <textarea
                ref={textRef}
                value={letterEdited}
                onChange={e => setLetterEdited(e.target.value)}
                style={{
                  width: "100%", minHeight: 280, fontFamily: sans, fontSize: 14.5,
                  lineHeight: 1.7, color: C.ink, background: "#FBFCFE",
                  border: `1px solid ${C.line}`, borderRadius: 16, padding: "16px 18px",
                  resize: "vertical", boxSizing: "border-box",
                }}
              />
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
              <button onClick={copyLetter} className="cyr-btn cyr-btn-ghost"
                style={{ minHeight: 48, padding: "12px 20px", justifyContent: "center",
                         ...(copied ? { background: "#ECFDF3", borderColor: "#BBF7D0", color: C.green } : {}) }}>
                {copied ? "✓ Copied!" : "📋 Copy letter"}
              </button>

              {legislators[activeTab] && (
                <button
                  onClick={() => openContact(legislators[activeTab].contactUrl)}
                  className="cyr-btn cyr-btn-primary"
                  style={{ minHeight: 48, padding: "12px 20px", flex: "1 1 220px", justifyContent: "center",
                           whiteSpace: "normal", textAlign: "center", minWidth: 0 }}>
                  ✉️ Open contact page: {legislators[activeTab].name.split(",")[0]}
                </button>
              )}
            </div>

            {/* All contact links */}
            <div style={{ fontSize: 15, fontWeight: 800, color: C.navy, marginBottom: 10 }}>
              All contact pages
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {legislators.map((leg, i) => (
                <div key={i} className="cyr-row" style={{ justifyContent: "space-between" }}>
                  <span aria-hidden style={{ width: 38, height: 38, borderRadius: 12, background: leg.chamber === "Senate" ? "#FDECEE" : "#E8F0FF",
                                             display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                    {CHAMBER_ICON[leg.chamber]}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700, color: C.ink, overflowWrap: "anywhere" }}>
                      {leg.name}
                    </div>
                    <div style={{ fontSize: 12.5, color: C.muted, marginTop: 1 }}>
                      {leg.chamber}{leg.party ? ` · ${leg.party}` : ""}
                    </div>
                  </div>
                  <button
                    onClick={() => openContact(leg.contactUrl)}
                    className="cyr-btn cyr-btn-ghost"
                    style={{ minHeight: 40, flexShrink: 0 }}>
                    Contact <span aria-hidden>→</span>
                  </button>
                </div>
              ))}
            </div>

            {/* Tip */}
            <div style={{
              marginTop: 16, padding: "12px 16px", background: "#F3F7FF", border: "1px solid #DCE6FA",
              borderRadius: 14, fontSize: 13.5, color: "#334155", lineHeight: 1.6,
            }}>
              <strong style={{ color: C.navy }}>💡 Tip:</strong> Clicking "Contact →" copies your letter to the clipboard and opens the
              official contact page in a new tab. Paste it into the message field, fill in your name and
              address, and submit. Personal messages are more effective than form letters.
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
function LegislatorCard({ leg, active, onClick }) {
  const partyColor = PARTY_COLOR[leg.party] || C.muted;
  return (
    <button onClick={onClick} aria-pressed={active} style={{
      fontFamily: sans, textAlign: "left", cursor: "pointer", minWidth: 0,
      padding: "12px 14px", borderRadius: 16, minHeight: 72,
      border: `2px solid ${active ? C.blue : C.line}`,
      background: active ? "#EEF4FF" : "#fff",
      color: C.ink,
      boxShadow: active ? "0 8px 20px rgba(37,99,235,.16)" : "none",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: active ? C.blue : C.muted }}>
          {CHAMBER_ICON[leg.chamber]} {leg.chamber}
        </span>
        {active && <span aria-hidden style={{ width: 20, height: 20, borderRadius: 99, background: C.blue, color: "#fff", fontSize: 11,
                                              display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 900 }}>✓</span>}
      </div>
      <div style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.3, overflowWrap: "anywhere" }}>
        {leg.name}
      </div>
      {leg.party && (
        <div style={{ marginTop: 4, fontSize: 12, fontWeight: 700, color: partyColor }}>
          {leg.party}
        </div>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
function fallbackLetter(district, billTitle, position) {
  const posWord = position === "support" ? "support" : position === "oppose" ? "oppose" : "seek more information about";
  return `Dear Representative/Senator,

I am a constituent from ${district} writing to share my position on ${billTitle || "this legislation"}.

I am writing to ${posWord} this bill. As someone directly affected by the decisions made in Washington, I urge you to carefully consider how this legislation will impact the people of our district.

I respectfully ask that you consider my position when voting on this matter. Please keep your constituents informed of your stance and vote. I appreciate your service and your attention to this issue.

Respectfully,
[Your Name]
[Your Address]
[City, State, ZIP]
[Your Phone/Email]`;
}
