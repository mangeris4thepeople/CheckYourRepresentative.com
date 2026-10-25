// =============================================================================
// VoterProfile.jsx - persistent auth via email magic link
// Signs in, loads profile from DB, tracks votes, shareable public card.
// =============================================================================
import React, { useState, useEffect, useCallback } from "react";
import { getStoredSession, storeSession } from "../lib/session.js";
import { PRIVACY_SHORT } from "../content/siteCopy.js";
import AddressLookup from "./AddressLookup.jsx";
import ConstituentOnboarding from "./ConstituentOnboarding.jsx";
import { PageHero, StatGrid, Panel, Seg, Loading, Empty, ErrorBox } from "./ui/Kit.jsx";

const C = {
  navy:"#0E2A6B", blue:"#2563EB", ink:"#0F172A",
  yes:"#15803D", yesLight:"#ECFDF3",
  no:"#B91C1C", noLight:"#FEF2F2",
  muted:"#5B6578", line:"#E2E8F0",
};
const sans = "var(--cyr-sans)";
const mono = "var(--cyr-mono)";

function humanizeSendError(code) {
  const m = {
    valid_email_required: "Enter a valid email address.",
    too_many_requests: "Too many sign-in attempts from your network. Try again in a bit.",
    email_provider_failed: "The email couldn't be sent right now. Try again shortly.",
  };
  return m[code] || "Something went wrong sending your sign-in link. Try again.";
}

// onProfileLoaded(profile, session) - lets App.jsx pull the saved district
// into `resolved` so Vote / Accountability / All Active Bills don't need the
// visitor to re-enter their address every time they sign in.
// onSignOut() - lets App.jsx clear its copy of the session.
// resolved / onResolved / onDistrictSelect - the district lookup used to live
// on its own "Find District" tab; it now lives here instead, right next to
// the District stat it fills in.
export default function VoterProfile({ district, resolved, onResolved, onDistrictSelect, onProfileLoaded, onSignOut, onShowTutorial }) {
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
      <div style={{ fontFamily: sans, maxWidth: 760, margin: "0 auto" }}>
        <div className="cyr-skeleton" style={{ height: 150, borderRadius: 24, marginBottom: 16 }} />
        <div style={{ textAlign: "center", color: C.muted, fontSize: 14, marginBottom: 12 }}>Loading your profile…</div>
        <Loading rows={3} height={70} />
      </div>
    );
  }

  // ── SIGNED OUT - sign in form ──
  if (authPhase === "signed-out" || authPhase === "sending") {
    return (
      <div style={{ fontFamily: sans, maxWidth: 760, margin: "0 auto" }}>
        <style>{SCOPED_CSS}</style>
        <PageHero
          compact
          eyebrow="My profile"
          title="Sign in"
          lede="No password needed. We'll email you a sign-in link." />

        <div className="cyr-card cyr-rise" style={{ maxWidth: 520, margin: "0 auto", borderRadius: 24, overflow: "hidden" }}>
          <div className="cyr-vp-pad" style={{ padding: "26px 26px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
              <span aria-hidden style={iconDot("#E8F0FF", C.blue, 46)}>✉️</span>
              <div style={{ minWidth: 0 }}>
                <div className="cyr-h2" style={{ fontSize: 21 }}>Sign in with your email</div>
                <div style={{ fontSize: 13.5, color: C.muted, marginTop: 2 }}>One tap from your inbox and you're in.</div>
              </div>
            </div>
            <label htmlFor="cyr-signin-email" style={labelStyle}>Your email address</label>
            {sendError && (
              <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 12,
                            background: "#FEF2F2", color: "#991B1B", fontSize: 13.5, fontWeight: 600,
                            border: "1px solid #FECACA" }}>
                {sendError}
              </div>
            )}
            <input
              id="cyr-signin-email"
              type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendMagicLink()}
              placeholder="you@email.com"
              style={{ ...inp, padding: "14px 16px", fontSize: 16, marginBottom: 14 }}
            />
            <button onClick={sendMagicLink} disabled={authPhase === "sending" || !email.includes("@")}
              className="cyr-btn cyr-btn-primary"
              style={{ width: "100%", justifyContent: "center", minHeight: 52, fontSize: 16,
                       opacity: email.includes("@") ? 1 : 0.55 }}>
              {authPhase === "sending" ? "Sending…" : <>Send sign-in link <span aria-hidden>→</span></>}
            </button>
            <p style={{ fontSize: 13.5, color: C.muted, margin: "16px 0 0", lineHeight: 1.6, textAlign: "center" }}>
              We'll send a link to your inbox. Click it to sign in, no password ever.<br/>
              Your votes and profile are saved to your email address.
            </p>
          </div>
          <div style={{ padding: "14px 22px", background: "#F6F8FC", borderTop: `1px solid ${C.line}`,
                        fontSize: 13, color: C.muted, lineHeight: 1.6, display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span aria-hidden>🔒</span><span>{PRIVACY_SHORT}</span>
          </div>
        </div>
      </div>
    );
  }

  // ── SENT - check email ──
  if (authPhase === "sent") {
    return (
      <div className="cyr-card cyr-rise" style={{ fontFamily: sans, maxWidth: 520, margin: "0 auto", textAlign: "center",
                    padding: "44px 24px", borderRadius: 24 }}>
        <div aria-hidden style={{ width: 84, height: 84, borderRadius: 99, margin: "0 auto 16px", background: "#E8F0FF",
                                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40 }}>📬</div>
        <div className="cyr-h2" style={{ fontSize: 26, marginBottom: 10 }}>
          Check your inbox
        </div>
        <div style={{ fontSize: 15.5, color: C.muted, lineHeight: 1.7, marginBottom: 22 }}>
          We sent a sign-in link to <strong style={{ color: C.navy, overflowWrap: "anywhere" }}>{email}</strong>.<br/>
          Click it to sign in. The link expires in 15 minutes.
        </div>
        <button onClick={() => setAuthPhase("signed-out")} className="cyr-btn cyr-btn-ghost" style={{ minHeight: 44 }}>
          <span aria-hidden>←</span> Use a different email
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
  const myDistrict = district || profile?.district;

  const positionColor = p => p === "support" ? C.yes : p === "oppose" ? C.no : "#475569";
  const positionBg    = p => p === "support" ? C.yesLight : p === "oppose" ? C.noLight : "#F1F5F9";
  const positionLabel = p => p === "support" ? "Support" : p === "oppose" ? "Oppose" : "Undecided";
  const positionIcon  = p => p === "support" ? "✓" : p === "oppose" ? "✕" : "?";

  return (
    <div style={{ fontFamily: sans, maxWidth: 820, margin: "0 auto" }}>
      <style>{SCOPED_CSS}</style>

      {/* Header */}
      <PageHero compact eyebrow="Signed in as" title={<span style={{ overflowWrap: "anywhere" }}>{draft.display_name || profile?.email}</span>}
        lede={myDistrict ? `District ${myDistrict}` : null}>
        <div style={{ marginTop: 16 }}>
          <button onClick={signOut} className="cyr-btn cyr-btn-light" style={{ minHeight: 42 }}>
            Sign out
          </button>
        </div>
      </PageHero>

      <StatGrid min={100} items={[
        { value: totalVotes, label: "Votes cast", tone: "navy" },
        { value: verifiedCount, label: "Verified", tone: "green" },
        { value: <span style={{ whiteSpace: "nowrap", fontSize: "0.82em" }}>{myDistrict || "Not set"}</span>, label: "District", tone: "red" },
      ]} />

      {/* Tab bar */}
      <div className="cyr-vp-tabs" style={{ marginBottom: 16 }}>
        <Seg value={tab} onChange={setTab} options={[
          { value: "profile", label: "👤 Profile" },
          { value: "votes",   label: "🗳️ My votes", count: totalVotes },
          { value: "share",   label: "🌐 Share" },
        ]} />
      </div>

      {/* ── PROFILE TAB ── */}
      {tab === "profile" && (
        <>
          <Panel title="Your details" eyebrow="Profile">
            {/* Plain-English note on what "Verified" means. It is a location
                signal on each vote, not an identity check, so the copy says so. */}
            <div style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.6, marginBottom: 20, padding: "12px 14px",
                          background: "#F3F7FF", border: "1px solid #DCE6FA", borderRadius: 14 }}>
              <strong style={{ color: C.navy }}>Verified</strong> counts how many of your positions were cast
              from a network location that matched your district's state. It is a location signal on each vote,
              not an identity check.
              {onShowTutorial && (
                <>
                  {" "}
                  <button onClick={onShowTutorial}
                    style={{ background: "none", border: "none", color: C.blue, fontFamily: sans,
                             fontSize: 13.5, fontWeight: 700, cursor: "pointer", padding: 0,
                             textDecoration: "underline", textUnderlineOffset: 3 }}>
                    View the site tutorial
                  </button>
                </>
              )}
            </div>

            <div className="cyr-vp-two">
              <Field label="Display name (optional)">
                <input value={draft.display_name} onChange={e => setDraft(d => ({ ...d, display_name: e.target.value }))}
                  placeholder="Anonymous Constituent" style={inp} />
              </Field>

              <Field label="City / town">
                <input value={draft.city} onChange={e => setDraft(d => ({ ...d, city: e.target.value }))}
                  placeholder="e.g. Windsor, CO" style={inp} />
              </Field>
            </div>

            <Field label="Bio (optional)">
              <textarea value={draft.bio} onChange={e => setDraft(d => ({ ...d, bio: e.target.value }))}
                placeholder="Why do you vote? What issues matter most?" rows={3}
                style={{ ...inp, resize: "vertical" }} />
            </Field>

            <Field label="Email digest">
              <select value={draft.email_channel}
                onChange={e => setDraft(d => ({ ...d, email_channel: e.target.value }))}
                style={{ ...inp, maxWidth: "100%" }}>
                <option value="off">Off - no emails</option>
                <option value="floor_alerts">Alert me when new bills hit the floor</option>
                <option value="pending">Weekly digest of my rep's new votes</option>
              </select>
            </Field>

            {/* Public toggle */}
            <div className="cyr-row" style={{ padding: "14px 16px", marginBottom: 10, flexWrap: "wrap",
                                              background: draft.is_public ? "#ECFDF3" : "#F6F8FC",
                                              borderColor: draft.is_public ? "#BBF7D0" : C.line }}>
              <span aria-hidden style={iconDot(draft.is_public ? "#DCFCE7" : "#E2E8F0", draft.is_public ? C.yes : "#475569", 40)}>
                {draft.is_public ? "🌐" : "🔒"}
              </span>
              <div style={{ flex: "1 1 180px", minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.ink }}>
                  {draft.is_public ? "Public profile" : "Private profile"}
                </div>
                <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>
                  {draft.is_public
                    ? "Your votes are visible on your shareable public card"
                    : "Only you can see your vote history"}
                </div>
              </div>
              <button onClick={() => setDraft(d => ({ ...d, is_public: !d.is_public }))}
                role="switch" aria-checked={!!draft.is_public}
                style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "none", border: 0, cursor: "pointer",
                         fontFamily: sans, fontSize: 13.5, fontWeight: 700, color: C.navy, minHeight: 40, padding: "0 2px" }}>
                {draft.is_public ? "Make private" : "Make public"}
                <span aria-hidden style={{ width: 48, height: 28, borderRadius: 99, position: "relative", flexShrink: 0,
                                           background: draft.is_public ? C.yes : "#CBD5E1", transition: "background .2s ease" }}>
                  <span style={{ position: "absolute", top: 3, left: draft.is_public ? 23 : 3, width: 22, height: 22, borderRadius: 99,
                                 background: "#fff", boxShadow: "0 1px 3px rgba(15,23,42,.25)", transition: "left .2s ease" }} />
                </span>
              </button>
            </div>

            {/* Privacy promise sits right next to the control that enforces it. */}
            <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, marginBottom: 20, padding: "0 4px" }}>
              {PRIVACY_SHORT}
            </div>

            <button onClick={saveProfile} disabled={saving} className="cyr-btn cyr-btn-primary"
              style={{ width: "100%", justifyContent: "center", minHeight: 52, fontSize: 16,
                       ...(saved ? { background: C.yes, boxShadow: "0 8px 20px rgba(22,163,74,.3)" } : {}) }}>
              {saving ? "Saving…" : saved ? "✓ Saved!" : "Save profile"}
            </button>
          </Panel>

          <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.65, margin: "4px 4px 18px" }}>
            You don't have to register or cast a single vote to use this site. Anyone can find
            their district, look up their representative and senator, and read every active bill
            below, all without ever signing in or taking a position.
          </div>

          {/* Find Your District - moved here from the old standalone "Find
              District" tab. The street address only ever goes to
              /api/geocode to resolve a district; it is never included in
              the profile save payload above, never stored, never shown. */}
          <section style={{ marginTop: 6 }}>
            <div style={{ padding: "0 4px", marginBottom: 12 }}>
              <div className="cyr-eyebrow" style={{ fontSize: 11 }}>District finder</div>
              <div className="cyr-h2" style={{ fontSize: 22, marginTop: 4 }}>Find your district</div>
              <div style={{ fontSize: 13.5, color: C.muted, marginTop: 6, lineHeight: 1.55, display: "flex", gap: 8 }}>
                <span aria-hidden>🔒</span>
                <span>Used only to look up your district. Your address is never stored and never shown to anyone.</span>
              </div>
            </div>
            <AddressLookup onResolved={onResolved} />
            {resolved ? (
              <div style={{ marginTop: 16 }}>
                <ConstituentOnboarding location={resolved.location} district={resolved.district} />
              </div>
            ) : (
              <p style={{ textAlign: "center", color: C.muted, maxWidth: 680, margin: "16px auto 0", fontSize: 13.5, lineHeight: 1.55 }}>
                Enter your address above to confirm your district, then choose the topics you want summaries for.
              </p>
            )}
          </section>
        </>
      )}

      {/* ── VOTES TAB ── */}
      {tab === "votes" && (
        <Panel title="My votes" eyebrow="Your record" pad={0}>
          {/* Bill-type tally pills */}
          <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.line}` }}>
            <Seg size="sm" value={voteFilter} onChange={setVoteFilter} options={[
              { value: "", label: "All" },
              ...voteTally.map(t => ({ value: t.bill_type, label: String(t.bill_type).toUpperCase(), count: t.n })),
            ]} />
          </div>

          <div style={{ padding: 14 }}>
            {voteListPhase === "loading" && filteredVotes.length === 0 && (
              <Loading rows={4} height={62} />
            )}
            {voteListPhase === "error" && (
              <ErrorBox onRetry={() => loadMyVotes(voteFilter, 0, false)}>Could not load your votes. Try again shortly.</ErrorBox>
            )}
            {voteListPhase === "ready" && filteredVotes.length === 0 && (
              <Empty icon="🗳️" title={voteFilter ? "No votes of this bill type yet" : "No votes yet"}>
                Go to <strong>Vote on Bills</strong> and cast your first position.
                It will appear here permanently.
              </Empty>
            )}

            {filteredVotes.length > 0 && (
              <div style={{ display: "grid", gap: 8 }}>
                {filteredVotes.map((v, i) => (
                  <div key={i} className="cyr-row">
                    <span style={{ fontFamily: mono, fontSize: 12.5, fontWeight: 700, borderRadius: 10, padding: "6px 9px",
                                   background: String(v.bill_id || "").startsWith("s") ? "#FDECEE" : "#E8F0FF",
                                   color: String(v.bill_id || "").startsWith("s") ? "#B91C1C" : "#1D4ED8",
                                   flexShrink: 0, minWidth: 86, textAlign: "center" }}>
                      {String(v.bill_id || "").replace(/-119$/, "").toUpperCase()}
                    </span>
                    <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: C.muted, display: "flex", flexWrap: "wrap", gap: "2px 8px", alignItems: "center" }}>
                      <span style={{ whiteSpace: "nowrap" }}>{v.district} · {new Date(v.created_at).toLocaleDateString()}</span>
                      {v.tier === "verified" && <span style={{ color: C.yes, fontWeight: 700 }}>✓ Verified</span>}
                    </div>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 999, fontWeight: 800,
                                   fontSize: 13, background: positionBg(v.position), color: positionColor(v.position), flexShrink: 0 }}>
                      <span aria-hidden>{positionIcon(v.position)}</span>{positionLabel(v.position)}
                    </span>
                  </div>
                ))}
                {voteHasMore && (
                  <button onClick={() => loadMyVotes(voteFilter, voteOffset + PAGE_SIZE, true)}
                    disabled={voteListPhase === "loading"} className="cyr-btn cyr-btn-ghost"
                    style={{ width: "100%", justifyContent: "center", minHeight: 48, marginTop: 4 }}>
                    {voteListPhase === "loading" ? "Loading…" : "Load more votes"}
                  </button>
                )}
              </div>
            )}
          </div>
        </Panel>
      )}

      {/* ── SHARE TAB ── */}
      {tab === "share" && (
        <Panel title="Share your record" eyebrow="Public card">
          {!draft.is_public ? (
            <div style={{ textAlign: "center", padding: "16px 0 8px" }}>
              <div aria-hidden style={{ width: 64, height: 64, borderRadius: 99, margin: "0 auto 12px", background: "#F1F5F9",
                                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>🔒</div>
              <div className="cyr-h2" style={{ fontSize: 21, marginBottom: 8 }}>
                Your profile is private
              </div>
              <div style={{ fontSize: 14.5, color: C.muted, marginBottom: 20, lineHeight: 1.6 }}>
                Make your profile public to get a shareable link showing your voting record.
              </div>
              <button onClick={() => { setDraft(d => ({ ...d, is_public: true })); setTab("profile"); }}
                className="cyr-btn cyr-btn-primary" style={{ minHeight: 48, fontSize: 15, padding: "12px 24px" }}>
                Make my profile public <span aria-hidden>→</span>
              </button>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 15, fontWeight: 800, color: C.navy, marginBottom: 8 }}>
                🌐 Your shareable public link
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
                <div style={{ flex: "1 1 260px", minWidth: 0, padding: "12px 14px", background: "#F6F8FC", border: `1px solid ${C.line}`,
                              borderRadius: 14, fontFamily: mono, fontSize: 12.5, wordBreak: "break-all", color: C.navy }}>
                  {publicUrl}
                </div>
                <button onClick={() => {
                  navigator.clipboard?.writeText(publicUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                  className="cyr-btn cyr-btn-primary"
                  style={{ flex: "0 0 auto", justifyContent: "center", minHeight: 46,
                           ...(copied ? { background: C.yes, boxShadow: "0 8px 20px rgba(22,163,74,.3)" } : {}) }}>
                  {copied ? "✓ Copied!" : "Copy link"}
                </button>
              </div>

              {/* Public card preview */}
              <div style={{ fontSize: 13, fontWeight: 700, color: C.muted, marginBottom: 8 }}>Public card preview</div>
              <div style={{ borderRadius: 20, overflow: "hidden", border: `1px solid ${C.line}`, boxShadow: "var(--cyr-shadow)" }}>
                <div className="cyr-hero" style={{ padding: "20px 20px 18px", borderRadius: 0, boxShadow: "none" }}>
                  <div className="cyr-h1" style={{ fontSize: 24, overflowWrap: "anywhere" }}>
                    {draft.display_name || "Anonymous Constituent"}
                  </div>
                  {myDistrict && (
                    <div style={{ fontSize: 13.5, color: "rgba(255,255,255,.85)", marginTop: 4 }}>
                      District {myDistrict}
                    </div>
                  )}
                </div>
                <div style={{ padding: "16px 18px", background: "#fff" }}>
                  {draft.bio && (
                    <div style={{ fontSize: 14, color: "#334155", marginBottom: 12, fontStyle: "italic", lineHeight: 1.55 }}>
                      "{draft.bio}"
                    </div>
                  )}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {votes.slice(0, 6).map((v, i) => (
                      <div key={i} style={{ padding: "5px 12px", borderRadius: 999,
                                            background: positionBg(v.position),
                                            color: positionColor(v.position),
                                            fontSize: 12, fontWeight: 700 }}>
                        {String(v.bill_id || "").replace(/-119$/, "").toUpperCase()}
                        {" · "}{positionLabel(v.position)}
                        {v.tier === "verified" && " ✓"}
                      </div>
                    ))}
                    {votes.length === 0 && (
                      <div style={{ fontSize: 13, color: C.muted }}>
                        No votes yet. Cast some positions first.
                      </div>
                    )}
                  </div>
                  <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.line}`, fontSize: 12, color: C.muted }}>
                    checkyourrepresentative.com · Paid for by We The People Inc.
                  </div>
                </div>
              </div>
            </>
          )}
        </Panel>
      )}
    </div>
  );
}

const SCOPED_CSS = `
  .cyr-vp-two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 14px; }
  @media (max-width: 560px) {
    .cyr-vp-two { grid-template-columns: minmax(0, 1fr); }
    .cyr-vp-pad { padding: 22px 18px 20px !important; }
  }
`;

const inp = {
  width: "100%", padding: "12px 14px", fontFamily: sans, fontSize: 15,
  border: `1px solid #D5DDEA`, borderRadius: 12, background: "#fff",
  boxSizing: "border-box", minHeight: 46,
};
const labelStyle = { fontSize: 13.5, fontWeight: 700, color: "#0F172A", display: "block", marginBottom: 6 };
const Field = ({ label, children }) => (
  <div style={{ marginBottom: 16, minWidth: 0 }}>
    <label style={labelStyle}>
      {label}
    </label>
    {children}
  </div>
);
function iconDot(bg, fg, size = 38) {
  return { width: size, height: size, borderRadius: 14, background: bg, color: fg, flexShrink: 0,
           fontSize: Math.round(size * 0.45), display: "inline-flex", alignItems: "center", justifyContent: "center" };
}
