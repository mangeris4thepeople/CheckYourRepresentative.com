// =============================================================================
// VoterProfile.jsx - persistent auth via email magic link
// Signs in → loads profile from DB → tracks votes → shareable public card
// =============================================================================
import React, { useState, useEffect, useCallback } from "react";
import { getStoredSession, storeSession } from "../lib/session.js";
import { PRIVACY_SHORT } from "../content/siteCopy.js";

const C = {
  navy:"#0A1A3F", gold:"#C9A227", crimson:"#8B0000",
  crimsonBright:"#B22234",
  yes:"#1B5E20", yesLight:"#E8F5E9",
  no:"#B71C1C", noLight:"#FFEBEE",
  parchment:"#FBF7EC", muted:"#5C5347", line:"#D8C9A0", panel:"#fff"
};
const serif = "Georgia,'Times New Roman',serif";

function humanizeSendError(code) {
  const m = {
    valid_email_required: "Enter a valid email address.",
    too_many_requests: "Too many sign-in attempts from your network. Try again in a bit.",
    email_provider_failed: "The email couldn't be sent right now. Try again shortly.",
  };
  return m[code] || "Something went wrong sending your sign-in link. Try again.";
}

// onProfileLoaded(profile, session) - lets App.jsx pull the saved district
// into `resolved` so Vote / Accountability / Find District don't need the
// visitor to re-enter their address every time they sign in.
// onSignOut() - lets App.jsx clear its copy of the session.
export default function VoterProfile({ district, onDistrictNeeded, onProfileLoaded, onSignOut, onShowTutorial }) {
  const [authPhase, setAuthPhase] = useState("loading"); // loading|signed-out|sending|sent|signed-in
  const [email, setEmail]         = useState("");
  const [session, setSession]     = useState(null);
  const [profile, setProfile]     = useState(null);
  const [tab, setTab]             = useState("profile");
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [copied, setCopied]       = useState(false);
  const [draft, setDraft]         = useState({});
  const [sendError, setSendError] = useState(null);
  const [voteFilter, setVoteFilter]         = useState(""); // "" = All
  const [filteredVotes, setFilteredVotes]   = useState([]);
  const [voteOffset, setVoteOffset]         = useState(0);
  const [voteHasMore, setVoteHasMore]       = useState(false);
  const [voteListPhase, setVoteListPhase]   = useState("idle"); // idle|loading|ready|error

  // On mount: check URL hash for incoming magic link redirect, then check stored session
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("session=")) {
      const params = new URLSearchParams(hash.slice(1));
      const token = params.get("session");
      const em    = params.get("email");
      // Clean the hash so it doesn't persist
      window.history.replaceState(null, "", window.location.pathname);
      if (token && em) {
        storeSession({ token, email: em });
        loadProfile({ token, email: em });
        return;
      }
    }
    const stored = getStoredSession();
    if (stored?.token) {
      loadProfile(stored);
    } else {
      setAuthPhase("signed-out");
    }
  }, []);

  const loadProfile = useCallback(async (sess) => {
    setAuthPhase("loading");
    try {
      const r = await fetch(`/api/auth/session?token=${sess.token}`);
      if (!r.ok) { storeSession(null); setAuthPhase("signed-out"); return; }
      const data = await r.json();
      setSession(sess);
      setProfile(data);
      setDraft({
        display_name: data.display_name || "",
        bio:          data.bio || "",
        city:         data.city || "",
        is_public:    data.is_public || false,
        email_channel: data.email_channel || "off",
      });
      setAuthPhase("signed-in");
      onProfileLoaded?.(data, sess);
    } catch {
      storeSession(null);
      setAuthPhase("signed-out");
    }
  }, []);

  async function sendMagicLink() {
    if (!email.includes("@")) return;
    setAuthPhase("sending");
    setSendError(null);
    try {
      const r = await fetch("/api/auth/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || data.ok === false) {
        setSendError(humanizeSendError(data.error));
        setAuthPhase("signed-out");
        return;
      }
      if (data.sent === false) {
        // Server accepted it but no email provider is configured yet  - 
        // don't lie and say "check your email" when nothing was sent.
        setSendError("Sign-in emails aren't configured on the server yet. Contact the site owner.");
        setAuthPhase("signed-out");
        return;
      }
      setAuthPhase("sent");
    } catch {
      setSendError("Couldn't reach the server. Check your connection and try again.");
      setAuthPhase("signed-out");
    }
  }

  async function signOut() {
    if (session?.token) {
      await fetch(`/api/auth/session?token=${session.token}`, { method: "DELETE" }).catch(() => {});
    }
    storeSession(null);
    setSession(null);
    setProfile(null);
    setAuthPhase("signed-out");
    onSignOut?.();
  }

  const PAGE_SIZE = 20;
  const loadMyVotes = useCallback(async (billType, newOffset, append) => {
    if (!session?.token) return;
    setVoteListPhase("loading");
    try {
      const p = new URLSearchParams({ token: session.token, limit: String(PAGE_SIZE), offset: String(newOffset) });
      if (billType) p.set("billType", billType);
      const r = await fetch(`/api/my-votes?${p}`);
      const d = await r.json();
      if (!d.ready) { setVoteListPhase("error"); return; }
      setFilteredVotes(prev => append ? [...prev, ...(d.votes || [])] : (d.votes || []));
      setVoteOffset(d.offset ?? newOffset);
      setVoteHasMore(!!d.hasMore);
      setVoteListPhase("ready");
    } catch {
      setVoteListPhase("error");
    }
  }, [session]);

  useEffect(() => {
    if (tab === "votes" && session?.token) loadMyVotes(voteFilter, 0, false);
  }, [tab, voteFilter, session, loadMyVotes]);

  async function saveProfile() {
    if (!session?.token) return;
    setSaving(true);
    try {
      await fetch(`/api/auth/session?token=${session.token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, district: district || profile?.district }),
      });
      setProfile(p => ({ ...p, ...draft, district: district || p?.district }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {}
    setSaving(false);
  }

  // ── LOADING ──
  if (authPhase === "loading") {
    return (
      <div style={{ fontFamily: serif, maxWidth: 560, margin: "0 auto", textAlign: "center", padding: "60px 20px", color: C.muted }}>
        <div style={{ fontSize: 28, marginBottom: 12 }}>⏳</div>
        <div>Loading your profile…</div>
      </div>
    );
  }

  // ── SIGNED OUT - sign in form ──
  if (authPhase === "signed-out" || authPhase === "sending") {
    return (
      <div style={{ fontFamily: serif, maxWidth: 480, margin: "0 auto" }}>
        <div style={{ background: C.navy, color: "#fff", padding: "24px",
                      borderRadius: "8px 8px 0 0", borderBottom: `3px solid ${C.gold}`,
                      textAlign: "center" }}>
          <div style={{ fontSize: 11, color: C.gold, fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>
            MY PROFILE
          </div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>Sign In</div>
          <div style={{ fontSize: 13, color: "#cfd6e4", marginTop: 6 }}>
            No password needed - we'll email you a sign-in link
          </div>
        </div>
        <div style={{ background: C.parchment, border: `1px solid ${C.line}`,
                      borderTop: "none", borderRadius: "0 0 8px 8px", padding: "28px 24px" }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: C.navy, letterSpacing: 1,
                          display: "block", marginBottom: 8 }}>
            YOUR EMAIL ADDRESS
          </label>
          {sendError && (
            <div style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 4,
                          background: "#FBE9E7", color: C.crimson, fontSize: 12.5,
                          border: `1px solid ${C.crimson}` }}>
              {sendError}
            </div>
          )}
          <input
            type="email" value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendMagicLink()}
            placeholder="you@email.com"
            style={{ width: "100%", padding: "12px 14px", fontFamily: serif, fontSize: 15,
                     border: `1px solid ${C.line}`, borderRadius: 6, background: "#fff",
                     boxSizing: "border-box", marginBottom: 14 }}
          />
          <button onClick={sendMagicLink} disabled={authPhase === "sending" || !email.includes("@")}
            style={{ width: "100%", padding: "14px", fontFamily: serif, fontSize: 16,
                     fontWeight: 700, background: email.includes("@") ? C.crimson : "#C9BFAB",
                     color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>
            {authPhase === "sending" ? "Sending…" : "Send Sign-In Link →"}
          </button>
          <p style={{ fontSize: 12, color: C.muted, marginTop: 14, lineHeight: 1.6, textAlign: "center" }}>
            We'll send a link to your inbox. Click it to sign in - no password ever.<br/>
            Your votes and profile are saved to your email address.
          </p>
          <div style={{ marginTop: 12, padding: "10px 12px", background: "#fff",
                        border: `1px solid ${C.line}`, borderRadius: 6,
                        fontSize: 12, color: C.muted, lineHeight: 1.6, textAlign: "center" }}>
            🔒 {PRIVACY_SHORT}
          </div>
        </div>
      </div>
    );
  }

  // ── SENT - check email ──
  if (authPhase === "sent") {
    return (
      <div style={{ fontFamily: serif, maxWidth: 480, margin: "0 auto", textAlign: "center",
                    padding: "48px 24px", background: C.parchment, border: `1px solid ${C.line}`,
                    borderRadius: 8 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📬</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: C.navy, marginBottom: 10 }}>
          Check your inbox
        </div>
        <div style={{ fontSize: 15, color: C.muted, lineHeight: 1.7, marginBottom: 20 }}>
          We sent a sign-in link to <strong style={{ color: C.navy }}>{email}</strong>.<br/>
          Click it to sign in - the link expires in 15 minutes.
        </div>
        <button onClick={() => setAuthPhase("signed-out")}
          style={{ fontFamily: serif, fontSize: 13, color: C.muted, background: "none",
                   border: `1px solid ${C.line}`, borderRadius: 6, padding: "8px 16px", cursor: "pointer" }}>
          ← Use a different email
        </button>
      </div>
    );
  }

  // ── SIGNED IN ──
  const votes = profile?.votes || []; // capped recent-activity preview, used for Share tab card
  const totalVotes = profile?.totalVotes ?? votes.length;
  const voteTally = profile?.voteTally || [];
  const verifiedCount = votes.filter(v => v.tier === "verified").length;
  const publicUrl = `${window.location.origin}/?voter=${profile?.profileId}`;

  const positionColor = p => p === "support" ? C.yes : p === "oppose" ? C.no : C.muted;
  const positionBg    = p => p === "support" ? C.yesLight : p === "oppose" ? C.noLight : "#f5f5f5";
  const positionLabel = p => p === "support" ? "Support" : p === "oppose" ? "Oppose" : "Undecided";

  return (
    <div style={{ fontFamily: serif, maxWidth: 680, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ background: C.navy, color: "#fff", padding: "20px 24px",
                    borderRadius: "8px 8px 0 0", borderBottom: `3px solid ${C.gold}`,
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 10, color: C.gold, fontWeight: 700, letterSpacing: 1 }}>
            SIGNED IN AS
          </div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>
            {draft.display_name || profile?.email}
          </div>
          {(district || profile?.district) && (
            <div style={{ fontSize: 12, color: "#cfd6e4" }}>
              District {district || profile?.district}
            </div>
          )}
        </div>
        <button onClick={signOut}
          style={{ fontFamily: serif, fontSize: 12, fontWeight: 700, color: "#cfd6e4",
                   background: "none", border: "1px solid rgba(255,255,255,0.25)",
                   borderRadius: 4, padding: "6px 12px", cursor: "pointer" }}>
          Sign Out
        </button>
      </div>

      {/* Tab bar */}
      <div style={{ background: C.panel, borderLeft: `1px solid ${C.line}`,
                    borderRight: `1px solid ${C.line}`, display: "flex", overflowX: "auto" }}>
        {[
          { key: "profile", label: "👤 Profile" },
          { key: "votes",   label: `🗳️ My Votes (${totalVotes})` },
          { key: "share",   label: "🌐 Share" },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ fontFamily: serif, flex: 1, padding: "12px 8px", border: "none",
                     background: "none", cursor: "pointer", fontSize: 13, fontWeight: 700,
                     whiteSpace: "nowrap",
                     color: tab === t.key ? C.crimson : C.muted,
                     borderBottom: `3px solid ${tab === t.key ? C.crimson : "transparent"}` }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── PROFILE TAB ── */}
      {tab === "profile" && (
        <div style={{ background: C.parchment, border: `1px solid ${C.line}`,
                      borderTop: "none", borderRadius: "0 0 8px 8px", padding: "24px" }}>

          {/* Stats row */}
          <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
            {[
              { n: totalVotes, label: "Votes Cast" },
              { n: verifiedCount, label: "Verified" },
              { n: district || profile?.district || " - ", label: "District" },
            ].map((s, i) => (
              <div key={i} style={{ flex: "1 1 100px", background: "#fff", border: `1px solid ${C.line}`,
                                    borderRadius: 6, padding: "12px 14px", textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: C.navy }}>{s.n}</div>
                <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: 1 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Plain-English note on what "Verified" means. It is a location
              signal on each vote, not an identity check, so the copy says so. */}
          <div style={{ fontSize: 11.5, color: C.muted, lineHeight: 1.6, marginBottom: 18 }}>
            <strong style={{ color: C.navy }}>Verified</strong> counts how many of your positions were cast
            from a network location that matched your district's state. It is a location signal on each vote,
            not an identity check.
            {onShowTutorial && (
              <>
                {" "}
                <button onClick={onShowTutorial}
                  style={{ background: "none", border: "none", color: C.crimson, fontFamily: serif,
                           fontSize: 11.5, fontWeight: 700, cursor: "pointer", padding: 0,
                           textDecoration: "underline" }}>
                  View the site tutorial
                </button>
              </>
            )}
          </div>

          <Field label="DISPLAY NAME (optional)">
            <input value={draft.display_name} onChange={e => setDraft(d => ({ ...d, display_name: e.target.value }))}
              placeholder="Anonymous Constituent" style={inp} />
          </Field>

          <Field label="CITY / TOWN">
            <input value={draft.city} onChange={e => setDraft(d => ({ ...d, city: e.target.value }))}
              placeholder="e.g. Windsor, CO" style={inp} />
          </Field>

          <Field label="BIO (optional)">
            <textarea value={draft.bio} onChange={e => setDraft(d => ({ ...d, bio: e.target.value }))}
              placeholder="Why do you vote? What issues matter most?" rows={3}
              style={{ ...inp, resize: "vertical" }} />
          </Field>

          <Field label="EMAIL DIGEST">
            <select value={draft.email_channel}
              onChange={e => setDraft(d => ({ ...d, email_channel: e.target.value }))}
              style={{ ...inp, width: "auto" }}>
              <option value="off">Off - no emails</option>
              <option value="floor_alerts">Alert me when new bills hit the floor</option>
              <option value="pending">Weekly digest of my rep's new votes</option>
            </select>
          </Field>

          {/* Public toggle */}
          <div style={{ padding: "16px", background: "#fff", border: `1px solid ${C.line}`,
                        borderRadius: 6, marginBottom: 20, display: "flex",
                        justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>
                {draft.is_public ? "🌐 Public Profile" : "🔒 Private Profile"}
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                {draft.is_public
                  ? "Your votes are visible on your shareable public card"
                  : "Only you can see your vote history"}
              </div>
            </div>
            <button onClick={() => setDraft(d => ({ ...d, is_public: !d.is_public }))}
              style={{ fontFamily: serif, padding: "8px 16px", fontWeight: 700, fontSize: 13,
                       cursor: "pointer", borderRadius: 6, border: "none",
                       background: draft.is_public ? C.yes : C.muted, color: "#fff" }}>
              {draft.is_public ? "Make Private" : "Make Public"}
            </button>
          </div>

          {/* Privacy promise sits right next to the control that enforces it. */}
          <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6, marginBottom: 20,
                        marginTop: -8, padding: "0 2px" }}>
            {PRIVACY_SHORT}
          </div>

          <button onClick={saveProfile} disabled={saving}
            style={{ width: "100%", padding: "14px", fontFamily: serif, fontSize: 16,
                     fontWeight: 900, background: saved ? C.yes : C.navy,
                     color: "#fff", border: "none", borderRadius: 6, cursor: "pointer",
                     transition: "background 0.2s" }}>
            {saving ? "Saving…" : saved ? "✓ Saved!" : "Save Profile"}
          </button>
        </div>
      )}

      {/* ── VOTES TAB ── */}
      {tab === "votes" && (
        <div style={{ background: C.parchment, border: `1px solid ${C.line}`,
                      borderTop: "none", borderRadius: "0 0 8px 8px" }}>

          {/* Bill-type tally pills */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "14px 20px",
                        borderBottom: `1px solid ${C.line}` }}>
            <button onClick={() => setVoteFilter("")}
              style={{ fontFamily: serif, fontSize: 12, fontWeight: 700, padding: "6px 14px",
                       borderRadius: 20, cursor: "pointer", border: `1px solid ${C.navy}`,
                       background: voteFilter === "" ? C.navy : "#fff",
                       color: voteFilter === "" ? "#fff" : C.navy }}>
              All
            </button>
            {voteTally.map(t => (
              <button key={t.bill_type} onClick={() => setVoteFilter(t.bill_type)}
                style={{ fontFamily: serif, fontSize: 12, fontWeight: 700, padding: "6px 14px",
                         borderRadius: 20, cursor: "pointer", border: `1px solid ${C.navy}`,
                         background: voteFilter === t.bill_type ? C.navy : "#fff",
                         color: voteFilter === t.bill_type ? "#fff" : C.navy }}>
                {String(t.bill_type).toUpperCase()} {t.n}
              </button>
            ))}
          </div>

          {voteListPhase === "loading" && filteredVotes.length === 0 && (
            <div style={{ padding: "48px 24px", textAlign: "center", color: C.muted }}>Loading your votes…</div>
          )}
          {voteListPhase === "error" && (
            <div style={{ padding: "48px 24px", textAlign: "center", color: C.crimson }}>
              Could not load your votes. Try again shortly.
            </div>
          )}
          {voteListPhase === "ready" && filteredVotes.length === 0 && (
            <div style={{ padding: "48px 24px", textAlign: "center", color: C.muted }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🗳️</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: C.navy }}>
                {voteFilter ? "No votes of this bill type yet" : "No votes yet"}
              </div>
              <div style={{ fontSize: 13 }}>
                Go to <strong>Vote on Bills</strong> and cast your first position.
                It will appear here permanently.
              </div>
            </div>
          )}

          {filteredVotes.length > 0 && (
            <>
              {filteredVotes.map((v, i) => (
                <div key={i} style={{ padding: "14px 20px",
                                      borderBottom: i < filteredVotes.length - 1 ? `1px solid ${C.line}` : "none",
                                      display: "flex", justifyContent: "space-between",
                                      alignItems: "center", gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>
                      {String(v.bill_id || "").replace(/-119$/, "").toUpperCase()}
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                      {v.district} · {new Date(v.created_at).toLocaleDateString()}
                      {v.tier === "verified" && <span style={{ color: C.yes }}> · ✓ Verified</span>}
                    </div>
                  </div>
                  <div style={{ padding: "6px 14px", borderRadius: 20, fontWeight: 700,
                                fontSize: 13, background: positionBg(v.position),
                                color: positionColor(v.position), flexShrink: 0 }}>
                    {positionLabel(v.position)}
                  </div>
                </div>
              ))}
              {voteHasMore && (
                <button onClick={() => loadMyVotes(voteFilter, voteOffset + PAGE_SIZE, true)}
                  disabled={voteListPhase === "loading"}
                  style={{ width: "100%", padding: 12, fontFamily: serif, fontWeight: 700, fontSize: 13,
                           background: C.navy, color: "#fff", border: "none", cursor: "pointer" }}>
                  {voteListPhase === "loading" ? "Loading…" : "Load More Votes"}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* ── SHARE TAB ── */}
      {tab === "share" && (
        <div style={{ background: C.parchment, border: `1px solid ${C.line}`,
                      borderTop: "none", borderRadius: "0 0 8px 8px", padding: "24px" }}>
          {!draft.is_public ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.navy, marginBottom: 8 }}>
                Your profile is private
              </div>
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>
                Make your profile public to get a shareable link showing your voting record.
              </div>
              <button onClick={() => { setDraft(d => ({ ...d, is_public: true })); setTab("profile"); }}
                style={{ fontFamily: serif, padding: "12px 24px", background: C.yes, color: "#fff",
                         border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                Make My Profile Public →
              </button>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 8 }}>
                🌐 Your shareable public link
              </div>
              <div style={{ padding: "12px 14px", background: "#fff", border: `1px solid ${C.line}`,
                            borderRadius: 6, fontFamily: "monospace", fontSize: 12,
                            wordBreak: "break-all", marginBottom: 12, color: C.navy }}>
                {publicUrl}
              </div>
              <button onClick={() => {
                navigator.clipboard?.writeText(publicUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
                style={{ width: "100%", padding: "12px", fontFamily: serif, fontSize: 14,
                         fontWeight: 700, background: copied ? C.yes : C.navy,
                         color: "#fff", border: "none", borderRadius: 6, cursor: "pointer",
                         marginBottom: 20, transition: "background 0.2s" }}>
                {copied ? "✓ Copied!" : "Copy Link"}
              </button>

              {/* Public card preview */}
              <div style={{ padding: "18px", background: "#fff", border: `2px solid ${C.gold}`,
                            borderRadius: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 1, marginBottom: 12 }}>
                  PUBLIC CARD PREVIEW
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: C.navy }}>
                  {draft.display_name || "Anonymous Constituent"}
                </div>
                {(district || profile?.district) && (
                  <div style={{ fontSize: 12, color: C.muted }}>
                    District {district || profile?.district}
                  </div>
                )}
                {draft.bio && (
                  <div style={{ fontSize: 13, color: C.muted, marginTop: 8, fontStyle: "italic" }}>
                    "{draft.bio}"
                  </div>
                )}
                <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {votes.slice(0, 6).map((v, i) => (
                    <div key={i} style={{ padding: "5px 12px", borderRadius: 20,
                                          background: positionBg(v.position),
                                          color: positionColor(v.position),
                                          fontSize: 11, fontWeight: 700 }}>
                      {String(v.bill_id || "").replace(/-119$/, "").toUpperCase()}
                      {" · "}{positionLabel(v.position)}
                      {v.tier === "verified" && " ✓"}
                    </div>
                  ))}
                  {votes.length === 0 && (
                    <div style={{ fontSize: 12, color: C.muted }}>
                      No votes yet - cast some positions first
                    </div>
                  )}
                </div>
                <div style={{ marginTop: 14, fontSize: 11, color: C.muted }}>
                  checkyourrepresentative.com · Paid for by We The People Inc.
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const inp = {
  width: "100%", padding: "10px 12px", fontFamily: serif, fontSize: 14,
  border: `1px solid #D8C9A0`, borderRadius: 6, background: "#fff",
  boxSizing: "border-box",
};
const Field = ({ label, children }) => (
  <div style={{ marginBottom: 16 }}>
    <label style={{ fontSize: 11, fontWeight: 700, color: "#0A1A3F",
                    letterSpacing: 1, display: "block", marginBottom: 6 }}>
      {label}
    </label>
    {children}
  </div>
);
