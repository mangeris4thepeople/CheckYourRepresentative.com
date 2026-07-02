// =============================================================================
// ContactRep.jsx - "Make Your Voice Heard" panel
// Shows after a constituent casts their position on a bill.
// Loads their 3 legislators (House rep + 2 Senators), displays an AI-drafted
// letter, and gives them one-click links to each official's contact page.
// =============================================================================

import React, { useState, useEffect, useRef } from "react";

const C = {
  crimson: "#8B0000",
  crimsonBright: "#B22234",
  navy: "#0A1A3F",
  gold: "#C9A227",
  parchment: "#FBF7EC",
  parchmentEdge: "#F0E6CE",
  ink: "#1A1A1A",
  muted: "#5C5347",
  line: "#D8C9A0",
  green: "#1B5E20",
  greenLight: "#E8F5E9",
};
const serif = "Georgia, 'Times New Roman', serif";

const CHAMBER_ICON = { House: "🏛️", Senate: "⚖️" };
const PARTY_COLOR  = { Democrat: C.navy, Republican: C.crimson, Independent: C.muted };

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
      billTitle: billTitle || billId,
    });
    fetch(`/api/contact?${params}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setLegislators(data.legislators || []);
        setLetter(data.letter || "");
        setLetterEdited(data.letter || "");
        setPhase("ready");
      // Track that this constituent opened Contact Rep (intent to contact)
      try {
        fetch("/api/contact-track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ billId, district, position, identity: null })
        });
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
  const positionColor = position === "support" ? C.navy : position === "oppose" ? C.crimson : C.muted;

  return (
    <div style={{
      fontFamily: serif, color: C.ink, background: C.parchment,
      border: `2px solid ${C.gold}`, borderRadius: 8, overflow: "hidden",
      maxWidth: 720, margin: "24px auto 0",
      boxShadow: "0 4px 24px rgba(10,26,63,0.12)"
    }}>
      {/* Header */}
      <div style={{ background: C.navy, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: C.gold, marginBottom: 3 }}>
            MAKE YOUR VOICE HEARD
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>
            Contact Your Legislators
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{
            fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 20,
            background: positionColor, color: "#fff"
          }}>
            {positionLabel}
          </span>
          {onClose && (
            <button onClick={onClose} style={{
              background: "transparent", border: "none", color: "#aaa",
              fontSize: 20, cursor: "pointer", lineHeight: 1, padding: "0 4px"
            }}>✕</button>
          )}
        </div>
      </div>

      {/* Gold strip */}
      <div style={{ height: 4, background: C.gold }} />

      <div style={{ padding: "20px 22px 28px" }}>
        {phase === "loading" && (
          <div style={{ textAlign: "center", padding: "40px 0", color: C.muted }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>⚖️</div>
            <div style={{ fontSize: 15 }}>Looking up your legislators and drafting your letter…</div>
          </div>
        )}

        {phase === "error" && (
          <div style={{ textAlign: "center", padding: "30px 0", color: C.crimson }}>
            <div style={{ fontSize: 14 }}>Couldn't load legislator info. Try again or visit congress.gov directly.</div>
          </div>
        )}

        {phase === "ready" && (
          <>
            {/* Intro */}
            <p style={{ margin: "0 0 20px", fontSize: 13.5, color: C.muted, lineHeight: 1.6 }}>
              Your position has been recorded. Now take the next step - let your elected officials know directly.
              We've drafted a letter for you. Edit it, then send it to each of your{" "}
              <strong style={{ color: C.navy }}>{legislators.length} legislators</strong> below.
            </p>

            {/* Legislator cards */}
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, color: C.navy, marginBottom: 10 }}>
                YOUR REPRESENTATIVES
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
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
                display: "flex", justifyContent: "space-between", alignItems: "center",
                marginBottom: 8
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, color: C.navy }}>
                  YOUR LETTER - EDIT AS NEEDED
                </div>
                <div style={{ fontSize: 11, color: C.muted, fontStyle: "italic" }}>
                  Personalize before sending
                </div>
              </div>
              <textarea
                ref={textRef}
                value={letterEdited}
                onChange={e => setLetterEdited(e.target.value)}
                style={{
                  width: "100%", minHeight: 280, fontFamily: serif, fontSize: 13.5,
                  lineHeight: 1.7, color: C.ink, background: "#fff",
                  border: `1px solid ${C.line}`, borderRadius: 4, padding: "14px 16px",
                  resize: "vertical", boxSizing: "border-box",
                }}
              />
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
              <button onClick={copyLetter} style={{
                fontFamily: serif, fontSize: 14, fontWeight: 700,
                padding: "10px 20px", borderRadius: 4, cursor: "pointer",
                background: copied ? C.green : "#fff",
                color: copied ? "#fff" : C.navy,
                border: `2px solid ${copied ? C.green : C.navy}`,
                transition: "all 0.2s",
              }}>
                {copied ? "✓ Copied!" : "📋 Copy Letter"}
              </button>

              {legislators[activeTab] && (
                <button
                  onClick={() => openContact(legislators[activeTab].contactUrl)}
                  style={{
                    fontFamily: serif, fontSize: 14, fontWeight: 700,
                    padding: "10px 20px", borderRadius: 4, cursor: "pointer",
                    background: C.crimson, color: "#fff", border: "none", flex: 1,
                  }}>
                  ✉️ Open Contact Page - {legislators[activeTab].name.split(",")[0]}
                </button>
              )}
            </div>

            {/* All contact links */}
            <div style={{
              background: "#fff", border: `1px solid ${C.line}`,
              borderRadius: 4, padding: "14px 16px"
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 10, letterSpacing: 1 }}>
                ALL CONTACT PAGES
              </div>
              {legislators.map((leg, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "8px 0",
                  borderTop: i > 0 ? `1px solid ${C.line}` : "none"
                }}>
                  <div>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: C.ink }}>
                      {CHAMBER_ICON[leg.chamber]} {leg.name}
                    </span>
                    <span style={{ fontSize: 12, color: C.muted, marginLeft: 8 }}>
                      {leg.chamber} · {leg.party}
                    </span>
                  </div>
                  <button
                    onClick={() => openContact(leg.contactUrl)}
                    style={{
                      fontFamily: serif, fontSize: 12, fontWeight: 700,
                      padding: "6px 14px", borderRadius: 4, cursor: "pointer",
                      background: C.navy, color: "#fff", border: "none",
                      whiteSpace: "nowrap", marginLeft: 12,
                    }}>
                    Contact →
                  </button>
                </div>
              ))}
            </div>

            {/* Tip */}
            <div style={{
              marginTop: 14, padding: "10px 14px", background: C.parchmentEdge,
              borderRadius: 4, fontSize: 12, color: C.muted, lineHeight: 1.5
            }}>
              <strong>Tip:</strong> Clicking "Contact →" copies your letter to the clipboard and opens the
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
    <button onClick={onClick} style={{
      fontFamily: serif, textAlign: "left", cursor: "pointer",
      flex: "1 1 180px", padding: "10px 14px", borderRadius: 6,
      border: `2px solid ${active ? C.gold : C.line}`,
      background: active ? C.navy : "#fff",
      color: active ? "#fff" : C.ink,
      transition: "all 0.15s",
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1,
                    color: active ? C.gold : C.muted, marginBottom: 3 }}>
        {CHAMBER_ICON[leg.chamber]} {leg.chamber.toUpperCase()}
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.3 }}>
        {leg.name}
      </div>
      {leg.party && (
        <div style={{
          marginTop: 4, fontSize: 11, fontWeight: 700,
          color: active ? "#cfd6e4" : partyColor
        }}>
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
