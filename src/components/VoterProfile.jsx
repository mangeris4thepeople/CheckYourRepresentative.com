// VoterProfile.jsx — public/private voter profiles
import React, { useState, useEffect } from "react";

const C = {
  navy:"#0A1A3F", gold:"#C9A227", crimson:"#8B0000",
  yes:"#1B5E20", yesLight:"#E8F5E9",
  no:"#B71C1C", noLight:"#FFEBEE",
  parchment:"#FBF7EC", muted:"#5C5347", line:"#D8C9A0", panel:"#fff"
};
const serif = "Georgia, \'Times New Roman\', serif";

function getOrCreateId() {
  let id = localStorage.getItem("cyr_voter_id");
  if (!id) {
    id = "v_" + Math.random().toString(36).slice(2,10) + Date.now().toString(36);
    localStorage.setItem("cyr_voter_id", id);
  }
  return id;
}

function loadProfile() {
  try {
    const raw = localStorage.getItem("cyr_profile");
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveProfile(p) {
  localStorage.setItem("cyr_profile", JSON.stringify(p));
}

function loadVoteHistory() {
  try {
    const raw = localStorage.getItem("cyr_votes");
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export default function VoterProfile({ district, onClose }) {
  const [profile, setProfile] = useState(() => loadProfile() || {
    name: "",
    city: "",
    isPublic: false,
    bio: "",
    created: Date.now(),
  });
  const [votes, setVotes] = useState(() => loadVoteHistory());
  const [tab, setTab] = useState("profile");
  const [saved, setSaved] = useState(false);
  const [publicUrl, setPublicUrl] = useState(null);
  const voterId = getOrCreateId();

  function handleSave() {
    saveProfile(profile);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    if (profile.isPublic) {
      setPublicUrl(`${window.location.origin}/voter/${voterId}`);
    }
  }

  const positionColor = p => p === "support" ? C.yes : p === "oppose" ? C.no : C.muted;
  const positionBg   = p => p === "support" ? C.yesLight : p === "oppose" ? C.noLight : "#f5f5f5";
  const positionLabel= p => p === "support" ? "✓ YES" : p === "oppose" ? "✗ NO" : "Undecided";

  return (
    <div style={{ fontFamily: serif, maxWidth: 680, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ background: C.navy, color: "#fff", padding: "20px 24px",
                    borderRadius: "8px 8px 0 0", borderBottom: `3px solid ${C.gold}`,
                    display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 10, color: C.gold, fontWeight: 700, letterSpacing: 1 }}>
            VOTER PROFILE
          </div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>
            {profile.name || "Anonymous Constituent"}
          </div>
          {district && <div style={{ fontSize: 12, color: "#cfd6e4" }}>District {district}</div>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 12, color: profile.isPublic ? C.gold : "#cfd6e4" }}>
            {profile.isPublic ? "🌐 Public" : "🔒 Private"}
          </div>
          {onClose && (
            <button onClick={onClose}
              style={{ background: "none", border: "1px solid rgba(255,255,255,0.3)",
                       borderRadius: 4, color: "#fff", cursor: "pointer", padding: "4px 8px",
                       fontFamily: serif, fontSize: 12 }}>
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: C.panel, borderLeft: `1px solid ${C.line}`,
                    borderRight: `1px solid ${C.line}`, display: "flex" }}>
        {["profile","votes","public"].map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ fontFamily: serif, flex: 1, padding: "12px", border: "none",
                     background: "none", cursor: "pointer", fontSize: 13, fontWeight: 700,
                     color: tab === t ? C.crimson : C.muted,
                     borderBottom: `3px solid ${tab === t ? C.crimson : "transparent"}`,
                     textTransform: "capitalize" }}>
            {t === "public" ? "🌐 Share" : t === "votes" ? `🗳️ My Votes (${votes.length})` : "👤 Profile"}
          </button>
        ))}
      </div>

      {/* Profile tab */}
      {tab === "profile" && (
        <div style={{ background: C.parchment, border: `1px solid ${C.line}`,
                      borderTop: "none", borderRadius: "0 0 8px 8px", padding: "24px" }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.navy, letterSpacing: 1,
                            display: "block", marginBottom: 6 }}>
              DISPLAY NAME (optional)
            </label>
            <input value={profile.name} onChange={e => setProfile({...profile, name: e.target.value})}
              placeholder="Anonymous Constituent"
              style={{ width: "100%", padding: "10px 12px", fontFamily: serif, fontSize: 14,
                       border: `1px solid ${C.line}`, borderRadius: 6, background: "#fff",
                       boxSizing: "border-box" }} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.navy, letterSpacing: 1,
                            display: "block", marginBottom: 6 }}>
              CITY / TOWN
            </label>
            <input value={profile.city} onChange={e => setProfile({...profile, city: e.target.value})}
              placeholder="e.g. Loveland, CO"
              style={{ width: "100%", padding: "10px 12px", fontFamily: serif, fontSize: 14,
                       border: `1px solid ${C.line}`, borderRadius: 6, background: "#fff",
                       boxSizing: "border-box" }} />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.navy, letterSpacing: 1,
                            display: "block", marginBottom: 6 }}>
              BIO (optional)
            </label>
            <textarea value={profile.bio} onChange={e => setProfile({...profile, bio: e.target.value})}
              placeholder="Why do you vote? What issues matter most to you?"
              rows={3}
              style={{ width: "100%", padding: "10px 12px", fontFamily: serif, fontSize: 14,
                       border: `1px solid ${C.line}`, borderRadius: 6, background: "#fff",
                       boxSizing: "border-box", resize: "vertical" }} />
          </div>

          {/* Public/Private toggle */}
          <div style={{ padding: "16px", background: "#fff", border: `1px solid ${C.line}`,
                        borderRadius: 8, marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>
                  {profile.isPublic ? "🌐 Public Profile" : "🔒 Private Profile"}
                </div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                  {profile.isPublic
                    ? "Your votes and positions are visible to everyone"
                    : "Only you can see your vote history"}
                </div>
              </div>
              <button onClick={() => setProfile({...profile, isPublic: !profile.isPublic})}
                style={{ fontFamily: serif, padding: "8px 16px", fontWeight: 700, fontSize: 13,
                         cursor: "pointer", borderRadius: 6, border: "none",
                         background: profile.isPublic ? C.yes : C.muted, color: "#fff" }}>
                {profile.isPublic ? "Make Private" : "Make Public"}
              </button>
            </div>
          </div>

          <button onClick={handleSave}
            style={{ width: "100%", padding: "14px", fontFamily: serif, fontSize: 16,
                     fontWeight: 900, background: C.navy, color: "#fff", border: "none",
                     borderRadius: 8, cursor: "pointer" }}>
            {saved ? "✓ Saved!" : "Save Profile"}
          </button>
        </div>
      )}

      {/* Votes tab */}
      {tab === "votes" && (
        <div style={{ background: C.parchment, border: `1px solid ${C.line}`,
                      borderTop: "none", borderRadius: "0 0 8px 8px" }}>
          {votes.length === 0 ? (
            <div style={{ padding: "40px 24px", textAlign: "center", color: C.muted }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🗳️</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>No votes yet</div>
              <div style={{ fontSize: 13 }}>
                Go to Vote on Bills and cast your first vote. It will appear here.
              </div>
            </div>
          ) : (
            <div>
              <div style={{ padding: "12px 20px", borderBottom: `1px solid ${C.line}`,
                            fontSize: 11, fontWeight: 700, color: C.navy, letterSpacing: 1 }}>
                YOUR VOTE HISTORY · {votes.length} VOTES CAST
              </div>
              {votes.map((v, i) => (
                <div key={i} style={{ padding: "14px 20px",
                                      borderBottom: i < votes.length-1 ? `1px solid ${C.line}` : "none",
                                      display: "flex", justifyContent: "space-between",
                                      alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>
                      {(v.billId||"").replace(/-119$/,"").toUpperCase()}
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                      {v.district} · {new Date(v.ts).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{ padding: "6px 14px", borderRadius: 20, fontWeight: 900,
                                fontSize: 13, background: positionBg(v.position),
                                color: positionColor(v.position) }}>
                    {positionLabel(v.position)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Share tab */}
      {tab === "public" && (
        <div style={{ background: C.parchment, border: `1px solid ${C.line}`,
                      borderTop: "none", borderRadius: "0 0 8px 8px", padding: "24px" }}>
          {!profile.isPublic ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.navy, marginBottom: 8 }}>
                Your profile is private
              </div>
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>
                Make your profile public to get a shareable link that shows your votes and positions.
              </div>
              <button onClick={() => { setProfile({...profile, isPublic:true}); setTab("profile"); }}
                style={{ fontFamily: serif, padding: "12px 24px", background: C.yes, color: "#fff",
                         border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                Make My Profile Public
              </button>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 8 }}>
                🌐 Your public profile
              </div>
              <div style={{ padding: "14px", background: "#fff", border: `1px solid ${C.line}`,
                            borderRadius: 6, fontFamily: "monospace", fontSize: 12,
                            wordBreak: "break-all", marginBottom: 16, color: C.navy }}>
                {`${window.location.origin}/?voter=${voterId}`}
              </div>
              <button onClick={() => {
                navigator.clipboard?.writeText(`${window.location.origin}/?voter=${voterId}`);
              }}
                style={{ width: "100%", padding: "12px", fontFamily: serif, fontSize: 14,
                         fontWeight: 700, background: C.navy, color: "#fff", border: "none",
                         borderRadius: 8, cursor: "pointer", marginBottom: 16 }}>
                Copy Link
              </button>
              <div style={{ padding: "16px", background: "#fff", border: `1px solid ${C.line}`,
                            borderRadius: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 12,
                              letterSpacing: 1 }}>
                  YOUR PUBLIC CARD PREVIEW
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: C.navy }}>
                  {profile.name || "Anonymous Constituent"}
                </div>
                {district && <div style={{ fontSize: 12, color: C.muted }}>District {district}</div>}
                {profile.bio && (
                  <div style={{ fontSize: 13, color: C.muted, marginTop: 8, fontStyle: "italic" }}>
                    "{profile.bio}"
                  </div>
                )}
                <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {votes.slice(0,5).map((v,i) => (
                    <div key={i} style={{ padding: "4px 10px", borderRadius: 20,
                                          background: positionBg(v.position),
                                          color: positionColor(v.position),
                                          fontSize: 11, fontWeight: 700 }}>
                      {(v.billId||"").replace(/-119$/,"").toUpperCase()} · {positionLabel(v.position)}
                    </div>
                  ))}
                  {votes.length === 0 && (
                    <div style={{ fontSize: 12, color: C.muted }}>No votes to display yet</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
