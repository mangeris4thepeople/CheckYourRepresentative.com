// =============================================================================
// Check Your Representative - single unified app.
// View 1: Landing (hero/features). View 2: the Tool (map, address,
// district, bills, voting). The button just switches views - one site, one host.
//
// Voting requires a signed-in profile (see api/vote.js). "Enter the Tool"
// lands on the Profile tab so signing in is the first thing a new visitor
// does. Once signed in, a saved district on the profile is loaded straight
// into `resolved` so returning visitors never have to re-enter their address
// - and any newly-resolved district gets written back to the profile so it's
// there next time too.
// =============================================================================
import React, { useState, useEffect } from "react";
import Landing from "./components/Landing.jsx";
import AddressLookup from "./components/AddressLookup.jsx";
import ConstituentMap from "./components/ConstituentMap.jsx";
import ConstituentOnboarding from "./components/ConstituentOnboarding.jsx";
import ConstituentVoting from "./components/ConstituentVoting.jsx";
import AllBillsBrowser from "./components/AllBillsBrowser.jsx";
import Merch from "./components/Merch.jsx";
import AccountabilityDashboard from "./components/AccountabilityDashboard.jsx";
import InteractiveDistrictMap from "./components/InteractiveDistrictMap.jsx";
import VoterProfile from "./components/VoterProfile.jsx";
import ConstituentsDirectory from "./components/ConstituentsDirectory.jsx";
import RollCallExplorer from "./components/RollCallExplorer.jsx";
import { getStoredSession } from "./lib/session.js";

const C = { crimson:"#8B0000", navy:"#0A1A3F", gold:"#C9A227", parchment:"#EFE7D2",
  panel:"#FBF7EC", ink:"#1A1A1A", muted:"#5C5347", line:"#D8C9A0" };
const serif = "Georgia, 'Times New Roman', serif";
const TABS = [
  { key: "profile",      label: "👤 My Profile" },
  { key: "vote",         label: "Vote on Bills" },
  { key: "allbills",     label: "🗳️ All Active Bills" },
  { key: "district",     label: "Find District" },
  { key: "matrix",       label: "📊 Accountability" },
  { key: "rollcalls",    label: "🏛 Roll Calls" },
  { key: "constituents", label: "🌐 Constituents" },
  { key: "merch",        label: "👕 Merch" },
];

// Inject mobile CSS once
const MOBILE_CSS = `
  @media (max-width: 600px) {
    .cyr-header-inner { padding: 12px 14px !important; gap: 10px !important; }
    .cyr-site-title { font-size: 17px !important; }
    .cyr-tagline { display: none !important; }
    .cyr-seal { width: 36px !important; height: 36px !important; }
    .cyr-home-btn { padding: 6px 10px !important; font-size: 12px !important; }
    .cyr-nav-inner { padding: 0 8px !important; }
    .cyr-tab { font-size: 13px !important; padding: 11px 10px !important; }
    .cyr-main { padding: 16px 12px 48px !important; }
    .cyr-footer-inner { padding: 16px 14px !important; font-size: 12px !important; }
  }
`;

if (typeof document !== "undefined" && !document.getElementById("cyr-mobile-css")) {
  const style = document.createElement("style");
  style.id = "cyr-mobile-css";
  style.textContent = MOBILE_CSS;
  document.head.appendChild(style);
}

export default function App() {
  // Shared public-card links look like /?voter=123 - if present, skip the
  // landing page and open that constituent's card in the Constituents tab.
  const initialVoterId = (() => {
    try { return new URLSearchParams(window.location.search).get("voter"); } catch { return null; }
  })();

  const [view, setView] = useState(initialVoterId ? "tool" : "landing");
  const [tab, setTab] = useState(initialVoterId ? "constituents" : "profile");
  const [resolved, setResolved] = useState(null);
  const [session, setSession] = useState(() => getStoredSession());

  // "Enter the Tool" always lands on the Profile tab - sign in first,
  // vote second. Also covers re-entering after having browsed elsewhere.
  function handleEnter() {
    setTab("profile");
    setView("tool");
  }

  // Called by VoterProfile once it has confirmed a session and loaded the
  // profile. Pulls the saved district straight into `resolved` so Vote /
  // Accountability / Find District all just work without re-asking for
  // an address.
  function handleProfileLoaded(profile, sess) {
    setSession(sess || getStoredSession());
    if (profile?.district) {
      setResolved(r => ({
        ...r,
        district: profile.district,
        location: profile.location || r?.location,
      }));
    }
  }

  function handleSignOut() {
    setSession(null);
  }

  // Whenever we resolve a district (via address lookup or the map) and the
  // visitor is signed in, quietly save it to their profile so it's there
  // automatically next time they sign in - anywhere, any device.
  useEffect(() => {
    if (!session?.token || !resolved?.district) return;
    if (!resolved.confirmed) return; // map browsing never overwrites a registered district
    fetch(`/api/auth/session?token=${session.token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ district: resolved.district, location: resolved.location }),
    }).catch(() => {});
  }, [session?.token, resolved?.district]);

  if (view === "landing") return <Landing onEnter={handleEnter} />;

  return (
    <div style={{ fontFamily: serif, color: C.ink, background: C.parchment, minHeight: "100vh" }}>
      <header style={{ background: C.navy, color: "#fff", borderBottom: `4px solid ${C.gold}` }}>
        <div className="cyr-header-inner" style={{ maxWidth: 1080, margin: "0 auto", padding: "16px 20px", display: "flex", alignItems: "center", gap: 14 }}>
          <Seal />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="cyr-site-title" style={{ fontSize: 22, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Check Your Representative</div>
            <div className="cyr-tagline" style={{ fontSize: 12, color: C.gold, letterSpacing: 1 }}>KNOW THE BILLS · KNOW YOUR VOTE · HOLD THE LINE</div>
          </div>
          <button className="cyr-home-btn" onClick={() => setView("landing")}
            style={{ fontFamily: serif, fontSize: 13, fontWeight: 700, color: "#fff", background: "transparent",
                     border: `1px solid ${C.gold}`, borderRadius: 5, padding: "8px 14px", cursor: "pointer", flexShrink: 0 }}>
            ← Home
          </button>
        </div>
        <StarStrip />
      </header>

      <nav style={{ background: C.panel, borderBottom: `1px solid ${C.line}`, overflowX: "auto" }}>
        <div className="cyr-nav-inner" style={{ maxWidth: 1080, margin: "0 auto", padding: "0 20px", display: "flex", gap: 0, minWidth: "min-content" }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="cyr-tab"
              style={{ fontFamily: serif, fontSize: 15, padding: "13px 18px", cursor: "pointer", border: "none",
                       background: "transparent", fontWeight: 700, whiteSpace: "nowrap",
                       color: tab === t.key ? C.crimson : C.muted,
                       borderBottom: `3px solid ${tab === t.key ? C.crimson : "transparent"}` }}>
              {t.label}
              {t.key === "vote" && !session && (
                <span style={{ marginLeft: 6, fontSize: 10, color: C.gold }}>🔒</span>
              )}
            </button>
          ))}
        </div>
      </nav>

      <main className="cyr-main" style={{ maxWidth: 1080, margin: "0 auto", padding: "24px 20px 60px" }}>
        {tab === "district" && (
          <>
            <AddressLookup onResolved={(r) => setResolved({ ...r, confirmed: true })} />
            {resolved ? (
              <div style={{ marginTop: 28 }}>
                <ConstituentOnboarding location={resolved.location} district={resolved.district} onGoVote={() => setTab('vote')} />
              </div>
            ) : (
              <p style={{ textAlign: "center", color: C.muted, fontStyle: "italic", maxWidth: 680, margin: "18px auto 0", fontSize: 13.5 }}>
                Enter your address above to confirm your district - then choose the topics you want summaries for.
              </p>
            )}
            <div style={{ marginTop: 40 }}>
              <div style={{ maxWidth: 1040, margin: "0 auto 10px", fontSize: 12, fontWeight: 700, letterSpacing: 1, color: C.muted, textAlign: "center" }}>
                - OR EXPLORE THE MAP  - 
              </div>
              <InteractiveDistrictMap onDistrictSelect={(d) => { setResolved(r => ({...r, district: d, confirmed: false})); setTab("vote"); }} />
            </div>
          </>
        )}

        {tab === "vote" && (
          <ConstituentVoting
            district={resolved?.district}
            location={resolved?.location}
            session={session}
            onNeedSignIn={() => setTab("profile")}
          />
        )}

        {tab === "allbills" && (
          <AllBillsBrowser district={resolved?.district} session={session} />
        )}

        {tab === "merch" && <Merch />}

        {tab === "rollcalls" && (
          <RollCallExplorer district={resolved?.district} />
        )}

        {tab === "constituents" && (
          <ConstituentsDirectory
            district={resolved?.district}
            initialVoterId={initialVoterId}
          />
        )}

        {tab === "matrix" && (
          <AccountabilityDashboard district={resolved?.district} />
        )}

        {tab === "profile" && (
          <VoterProfile
            district={resolved?.district}
            onProfileLoaded={handleProfileLoaded}
            onSignOut={handleSignOut}
          />
        )}
      </main>

      <footer style={{ background: C.navy, color: "#cfd6e4", borderTop: `4px solid ${C.gold}` }}>
        <div className="cyr-footer-inner" style={{ maxWidth: 1080, margin: "0 auto", padding: "22px 20px", fontSize: 12.5 }}>
          <div style={{ fontStyle: "italic", color: C.gold, marginBottom: 8 }}>"We the People..." - a tool for an informed electorate.</div>
          Check Your Representative · Non-partisan voter education · Bill data from Congress.gov.
          <span style={{ marginLeft: 16, color: "#6680aa" }}>Paid for by We The People Inc.</span>
        </div>
      </footer>
    </div>
  );
}

function Seal() {
  return (
    <svg className="cyr-seal" width="48" height="48" viewBox="0 0 52 52" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="26" cy="26" r="24" fill="#fff" stroke={C.gold} strokeWidth="2" />
      <circle cx="26" cy="26" r="19" fill={C.crimson} />
      <text x="26" y="33" textAnchor="middle" fontFamily={serif} fontSize="20" fontWeight="700" fill="#fff">CYR</text>
    </svg>
  );
}
function StarStrip() {
  return (
    <div style={{ background: C.crimson, padding: "5px 0", display: "flex", justifyContent: "center", gap: 10 }}>
      {Array.from({ length: 13 }).map((_, i) => <span key={i} style={{ color: C.gold, fontSize: 11 }}>★</span>)}
    </div>
  );
}
