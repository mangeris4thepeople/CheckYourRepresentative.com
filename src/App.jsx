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
import ConstituentMap from "./components/ConstituentMap.jsx";
import ConstituentVoting from "./components/ConstituentVoting.jsx";
import AllBillsBrowser from "./components/AllBillsBrowser.jsx";
import Merch from "./components/Merch.jsx";
import AccountabilityDashboard from "./components/AccountabilityDashboard.jsx";
import VoterProfile from "./components/VoterProfile.jsx";
import ConstituentsDirectory from "./components/ConstituentsDirectory.jsx";
import RollCallExplorer from "./components/RollCallExplorer.jsx";
import FollowTheMoney from "./components/FollowTheMoney.jsx";
import KnowYourJudgeNational from "./components/KnowYourJudgeNational.jsx";
import ContextualHelp from "./components/ContextualHelp.jsx";
import ContactUsForm from "./components/ContactUsForm.jsx";
import AboutPage from "./components/marketing/AboutPage.jsx";
import BenefitsPage from "./components/marketing/BenefitsPage.jsx";
import HowItWorksPage from "./components/marketing/HowItWorksPage.jsx";
import PrivacyCommitment from "./components/marketing/PrivacyCommitment.jsx";
import SiteTutorialPage, { FirstRunTutorial } from "./components/marketing/SiteTutorial.jsx";
import { getStoredSession } from "./lib/session.js";

const C = { crimson:"#8B0000", navy:"#0A1A3F", gold:"#C9A227", parchment:"#EFE7D2",
  panel:"#FBF7EC", ink:"#1A1A1A", muted:"#5C5347", line:"#D8C9A0" };
const serif = "Georgia, 'Times New Roman', serif";
const TABS = [
  { key: "profile",      label: "👤 My Profile" },
  { key: "vote",         label: "🗳️ Vote on Bills" },
  { key: "allbills",     label: "📄 All Active Bills" },
  { key: "matrix",       label: "📊 Accountability" },
  { key: "rollcalls",    label: "📋 Roll Calls" },
  { key: "followthemoney", label: "💰 Follow the Money" },
  { key: "judges",       label: "⚖️ Know Your Judge" },
  { key: "constituents", label: "🌐 Constituents" },
  { key: "merch",        label: "👕 Merch" },
];

// Tabs that get a left-hand contextual help sidebar.
const HELP_TABS = { profile: "profile", vote: "vote", followthemoney: "followthemoney", judges: "judges" };

// Inject mobile CSS once
const MOBILE_CSS = `
  @media (max-width: 900px) {
    .cyr-tagline { font-size: 10.5px !important; }
  }
  @media (max-width: 600px) {
    .cyr-header-inner { padding: 12px 14px !important; gap: 10px !important; }
    .cyr-site-title { font-size: 17px !important; }
    .cyr-tagline { display: none !important; }
    .cyr-seal { width: 36px !important; height: 36px !important; }
    .cyr-home-btn { padding: 6px 10px !important; font-size: 12px !important; }
    .cyr-nav-inner { padding: 6px 8px !important; flex-wrap: wrap !important; min-width: 0 !important; justify-content: center !important; }
    .cyr-tab { font-size: 13px !important; padding: 9px 10px !important; }
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

  // view is one of: "landing" | "about" | "benefits" | "tutorial" |
  // "howitworks" | "privacy" | "tool". The marketing views are the pre-tool
  // content pages; the app has no router so they are plain state.
  const [view, setView] = useState(initialVoterId ? "tool" : "landing");
  const [tab, setTab] = useState(initialVoterId ? "constituents" : "profile");
  const [resolved, setResolved] = useState(null);
  const [session, setSession] = useState(() => getStoredSession());
  const [showTutorial, setShowTutorial] = useState(false);

  // "Enter the Tool" always lands on the Profile tab - sign in first,
  // vote second. Also covers re-entering after having browsed elsewhere.
  // The very first time anyone enters, show the walkthrough automatically;
  // after they dismiss it once we never auto-show it again (localStorage).
  function handleEnter() {
    setTab("profile");
    setView("tool");
    try {
      if (localStorage.getItem("cyr_tutorial_seen") !== "1") setShowTutorial(true);
    } catch {}
  }

  function dismissTutorial() {
    try { localStorage.setItem("cyr_tutorial_seen", "1"); } catch {}
    setShowTutorial(false);
  }

  // Reopened on demand from My Profile, so people can revisit it anytime.
  function openTutorial() { setShowTutorial(true); }

  // These views are separate full pages, so switching between them should
  // start at the top rather than inherit the previous page's scroll position.
  useEffect(() => {
    try { window.scrollTo(0, 0); } catch {}
  }, [view]);

  // Called by VoterProfile once it has confirmed a session and loaded the
  // profile. Pulls the saved district straight into `resolved` so Vote /
  // Accountability / All Active Bills all just work without re-asking for
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

  if (view === "landing") return <Landing onEnter={handleEnter} onNavigate={setView} />;
  if (view === "about")      return <AboutPage onNavigate={setView} onEnter={handleEnter} />;
  if (view === "benefits")   return <BenefitsPage onNavigate={setView} onEnter={handleEnter} />;
  if (view === "tutorial")   return <SiteTutorialPage onNavigate={setView} onEnter={handleEnter} />;
  if (view === "howitworks") return <HowItWorksPage onNavigate={setView} onEnter={handleEnter} />;
  if (view === "privacy")    return <PrivacyCommitment onNavigate={setView} onEnter={handleEnter} />;

  return (
    <div style={{ fontFamily: serif, color: C.ink, background: C.parchment, minHeight: "100vh" }}>
      <header style={{ background: C.navy, color: "#fff", borderBottom: `4px solid ${C.gold}` }}>
        <div className="cyr-header-inner" style={{ maxWidth: 1080, margin: "0 auto", padding: "16px 20px", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="cyr-site-title" style={{ fontSize: 22, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Check Your Representative</div>
            <div className="cyr-tagline" style={{ fontSize: 12, color: C.gold, letterSpacing: 1 }}>KNOW YOUR BILLS · KNOW YOUR VOTE · KNOW YOUR MONEY · HOLD THE LINE</div>
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

      {showTutorial && <FirstRunTutorial onDismiss={dismissTutorial} />}

      <main className="cyr-main" style={{ maxWidth: 1080, margin: "0 auto", padding: "24px 20px 60px" }}>
        {tab === "vote" && (
          <HelpLayout page="vote">
            <ConstituentVoting
              district={resolved?.district}
              location={resolved?.location}
              session={session}
              onNeedSignIn={() => setTab("profile")}
            />
          </HelpLayout>
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

        {tab === "followthemoney" && (
          <HelpLayout page="followthemoney">
            <FollowTheMoney district={resolved?.district} />
          </HelpLayout>
        )}

        {tab === "judges" && (
          <HelpLayout page="judges">
            <KnowYourJudgeNational />
          </HelpLayout>
        )}

        {tab === "profile" && (
          <HelpLayout page="profile">
            <VoterProfile
              district={resolved?.district}
              resolved={resolved}
              onResolved={(r) => setResolved({ ...r, confirmed: true })}
              onDistrictSelect={(d) => setResolved(r => ({ ...r, district: d, confirmed: false }))}
              onProfileLoaded={handleProfileLoaded}
              onSignOut={handleSignOut}
              onShowTutorial={openTutorial}
            />
          </HelpLayout>
        )}
      </main>

      <footer style={{ background: C.navy, color: "#fff", borderTop: `4px solid ${C.gold}` }}>
        <div className="cyr-footer-inner" style={{ maxWidth: 1080, margin: "0 auto", padding: "24px 20px", fontSize: 12.5,
                      display: "flex", flexWrap: "wrap", gap: 28, justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 300px" }}>
            <div style={{ fontStyle: "italic", fontWeight: 700, color: C.gold, marginBottom: 8 }}>"We the People..." - a tool for an informed electorate.</div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 10 }}>
              <button onClick={() => setView("about")} style={footerLink}>What We Stand For</button>
              <button onClick={openTutorial} style={footerLink}>Site Tutorial</button>
              <button onClick={() => setView("howitworks")} style={footerLink}>How It Works</button>
              <button onClick={() => setView("privacy")} style={footerLink}>Privacy</button>
            </div>
            <div style={{ fontWeight: 700, color: "#fff" }}>
              Check Your Representative · Non-partisan voter education · Bill data from Congress.gov.
              <span style={{ marginLeft: 16, color: C.gold }}>Paid for by We The People Inc.</span>
            </div>
          </div>
          <div style={{ flex: "1 1 340px" }}>
            <ContactUsForm />
          </div>
        </div>
      </footer>
    </div>
  );
}

// Wraps a tab's content with its contextual help sidebar. The sidebar sits on
// the left on wide screens and collapses to a tappable header on narrow ones,
// so it never pushes the page content down on mobile.
function HelpLayout({ page, children }) {
  return (
    <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
      <ContextualHelp page={page} />
      <div style={{ flex: "1 1 320px", minWidth: 0 }}>{children}</div>
    </div>
  );
}

const footerLink = {
  fontFamily: serif, fontSize: 12.5, fontWeight: 700, color: "#fff", background: "none",
  border: "none", borderBottom: `1px solid ${"#C9A227"}`, padding: 0,
  cursor: "pointer",
};

function StarStrip() {
  return (
    <div style={{ background: C.crimson, padding: "5px 0", display: "flex", justifyContent: "center", gap: 10 }}>
      {Array.from({ length: 13 }).map((_, i) => <span key={i} style={{ color: C.gold, fontSize: 11 }}>★</span>)}
    </div>
  );
}
