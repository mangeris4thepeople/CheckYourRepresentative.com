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
import React, { useState, useEffect, lazy, Suspense } from "react";
import ConstituentVoting from "./components/ConstituentVoting.jsx";
import AllBillsBrowser from "./components/AllBillsBrowser.jsx";
import AccountabilityDashboard from "./components/AccountabilityDashboard.jsx";
import VoterProfile from "./components/VoterProfile.jsx";
import ConstituentsDirectory from "./components/ConstituentsDirectory.jsx";
import RollCallExplorer from "./components/RollCallExplorer.jsx";
import ContextualHelp from "./components/ContextualHelp.jsx";
import ContactUsForm from "./components/ContactUsForm.jsx";
import Home from "./components/Home.jsx";
import "./styles/theme.css";
import SiteTutorialPage, { FirstRunTutorial } from "./components/marketing/SiteTutorial.jsx";
import { getStoredSession } from "./lib/session.js";
import { applySeo } from "./lib/seo.js";
import { trackPageview } from "./lib/analytics.js";

// Heavy or cold views load on demand instead of riding in the main bundle:
// Follow the Money pulls the big map trees, and the
// marketing/merch/admin views only render behind explicit navigation.
// (ConstituentMap - and with it the whole d3 package - was imported here for
// nothing at all; it is retired.)
const Landing = lazy(() => import("./components/Landing.jsx"));
const Merch = lazy(() => import("./components/Merch.jsx"));
const FollowTheMoney = lazy(() => import("./components/FollowTheMoney.jsx"));
const AboutPage = lazy(() => import("./components/marketing/AboutPage.jsx"));
const BenefitsPage = lazy(() => import("./components/marketing/BenefitsPage.jsx"));
const HowItWorksPage = lazy(() => import("./components/marketing/HowItWorksPage.jsx"));
const PrivacyCommitment = lazy(() => import("./components/marketing/PrivacyCommitment.jsx"));
const AdminCrosswalk = lazy(() => import("./components/AdminCrosswalk.jsx"));
const ReportCard = lazy(() => import("./components/ReportCard.jsx"));

// Shared fallback while a lazy view's chunk loads.
const LazyFallback = (
  <div style={{ padding: "40px 0", display: "grid", gap: 14 }}>
    <div className="cyr-skeleton" style={{ height: 34, width: "40%" }} />
    <div className="cyr-skeleton" style={{ height: 220 }} />
    <div className="cyr-skeleton" style={{ height: 120 }} />
  </div>
);

const C = { crimson:"#D62839", navy:"#0E2A6B", gold:"#F5B82E", parchment:"#F6F8FC",
  panel:"#FFFFFF", ink:"#0F172A", muted:"#5B6578", line:"#E2E8F0" };
const serif = "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const TABS = [
  { key: "home",         icon: "✨", label: "Home" },
  { key: "profile",      icon: "👤", label: "My Profile" },
  { key: "vote",         icon: "🗳️", label: "Vote on Bills" },
  { key: "allbills",     icon: "📄", label: "All Active Bills" },
  { key: "matrix",       icon: "📊", label: "Accountability" },
  { key: "rollcalls",    icon: "📋", label: "Roll Calls" },
  { key: "followthemoney", icon: "💰", label: "Follow the Money" },
  { key: "constituents", icon: "🌐", label: "Constituents" },
  { key: "merch",        icon: "👕", label: "Merch" },
];

// Tabs that get a left-hand contextual help sidebar.
const HELP_TABS = { profile: "profile", vote: "vote", followthemoney: "followthemoney" };

export default function App() {
  // Shared public-card links look like /?voter=123 - if present, skip the
  // landing page and open that constituent's card in the Constituents tab.
  const initialVoterId = (() => {
    try { return new URLSearchParams(window.location.search).get("voter"); } catch { return null; }
  })();

  // App-shortcut and deep links: /?tab=vote (and friends) skips the landing
  // page straight into that tab, which the installed app's shortcuts use.
  // /privacy (a Vercel rewrite of this same page) opens the privacy policy,
  // giving it the stable URL app stores require.
  const initialDeepLink = (() => {
    try {
      if (window.location.pathname === "/privacy") return { view: "privacy", tab: null };
      // Admin-only review queue for NGO Money Loop name matches; a Vercel
      // rewrite serves this same page at that path. The API enforces access,
      // this is just routing.
      if (window.location.pathname === "/admin/crosswalk") return { view: "admin-crosswalk", tab: null };
      // The old landing page lives on at /welcome as the campaign page for
      // ads and social links; the site entry itself is gate free.
      if (window.location.pathname === "/welcome") return { view: "landing", tab: null };
      if (window.location.pathname === "/home") return { view: "tool", tab: "home" };
      // The other content pages get stable paths too (Vercel rewrites of
      // this same page), so search engines and shared links can reach them
      // directly. Listed in public/sitemap.xml.
      const PATH_VIEWS = {
        "/about": "about", "/tutorial": "tutorial",
        "/how-it-works": "howitworks", "/benefits": "benefits",
      };
      if (PATH_VIEWS[window.location.pathname]) {
        return { view: PATH_VIEWS[window.location.pathname], tab: null };
      }
      // Shared RepSpace profile links land inside Follow the Money;
      // KnowYourRepTabs and RepSpaceTab read the rest of the path themselves.
      if (window.location.pathname.startsWith("/know-your-rep")) {
        return { view: "tool", tab: "followthemoney" };
      }
      // Shareable report cards: /report-card/M001153 renders the card
      // full-page (a Vercel rewrite serves this same page at that path).
      const rc = window.location.pathname.match(/^\/report-card\/([A-Z]\d{6})$/);
      if (rc) return { view: "report-card", tab: null, bioguide: rc[1] };
      const t = new URLSearchParams(window.location.search).get("tab");
      const VALID = new Set(["home", "vote", "allbills", "rollcalls", "constituents", "matrix",
        "followthemoney", "profile", "merch"]);
      if (t && VALID.has(t)) return { view: "tool", tab: t };
    } catch {}
    return null;
  })();

  // Signed-in visitors land on their profile; signed-out visitors land on
  // something worth looking at (the live Home tab) with a sign-in
  // nudge in the header, instead of a sign-in form as the front door.
  const hasStoredSession = !!getStoredSession();

  // A magic-link redirect arrives as /#session=...  VoterProfile is the only
  // component that consumes that hash, and it only mounts on the Profile tab.
  // A first-time sign-in has no stored session yet, so without this check the
  // person landed on a public tab still signed out, with their token
  // sitting unused in the URL - the #1 "sign-in doesn't work" report.
  const hasSessionHash = (() => {
    try { return window.location.hash.includes("session="); } catch { return false; }
  })();

  // view is one of: "landing" | "about" | "benefits" | "tutorial" |
  // "howitworks" | "privacy" | "tool". The marketing views are content
  // pages; the app has no router so they are plain state. Visitors land
  // straight in the tool: the old landing page gated entry behind a click
  // and deterred constituents, so the first-run walkthrough (below) now
  // carries the introduction instead.
  const [view, setView] = useState(initialVoterId ? "tool" : (hasSessionHash ? "tool" : (initialDeepLink?.view || "tool")));
  const [tab, setTab] = useState(initialVoterId ? "constituents"
    : hasSessionHash ? "profile"
    : (initialDeepLink?.tab || (hasStoredSession ? "profile" : "home")));
  const [resolved, setResolved] = useState(null);
  const [session, setSession] = useState(() => getStoredSession());
  const [showTutorial, setShowTutorial] = useState(false);

  // Per route titles and social tags. Until the visitor navigates somewhere
  // themselves, the bare / URL keeps the homepage title rather than the
  // default tab's, so search results for the site root read as the site,
  // not as whichever tab happens to open first.
  const [navigated, setNavigated] = useState(!!initialDeepLink?.tab || !!initialVoterId);
  function goTab(k) { setNavigated(true); setTab(k); }
  useEffect(() => {
    const routeKey = view !== "tool" ? view : (navigated && tab !== "home" ? tab : "home");
    applySeo(routeKey);
    // Cookieless page view for the same route key; see src/lib/analytics.js.
    trackPageview(routeKey);
  }, [view, tab, navigated]);

  // "Enter the Tool" always lands on the Profile tab - sign in first,
  // vote second. Also covers re-entering after having browsed elsewhere.
  // The very first time anyone enters, show the walkthrough automatically;
  // after they dismiss it once we never auto-show it again (localStorage).
  function handleEnter() {
    goTab("profile");
    setView("tool");
    try {
      if (localStorage.getItem("cyr_tutorial_seen") !== "1") setShowTutorial(true);
    } catch {}
  }

  function dismissTutorial() {
    try { localStorage.setItem("cyr_tutorial_seen", "1"); } catch {}
    setShowTutorial(false);
    // Anonymous aggregate counter, nothing identifying: see /privacy.
    fetch("/api/metric?m=walkthrough_dismissed", { method: "POST" }).catch(() => {});
  }

  // Reopened on demand from My Profile, so people can revisit it anytime.
  function openTutorial() { setShowTutorial(true); }

  // These views are separate full pages, so switching between them should
  // start at the top rather than inherit the previous page's scroll position.
  useEffect(() => {
    try { window.scrollTo(0, 0); } catch {}
  }, [view]);
  // Tabs are full sections too: jumping to one starts at its top.
  useEffect(() => {
    try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch {}
    // Keep the active pill visible in the horizontally scrolling tab bar.
    try {
      const el = document.querySelector('.cyr-tab[aria-current="page"]');
      const bar = el?.parentElement;
      if (el && bar) bar.scrollTo({ left: el.offsetLeft - bar.clientWidth / 2 + el.clientWidth / 2, behavior: "smooth" });
    } catch {}
  }, [tab, view]);

  // With no landing gate, the first visit opens the walkthrough on top of
  // the tool itself. Dismissing it (or jumping to one of its intro pages)
  // marks it seen; it never auto-opens again after that.
  useEffect(() => {
    try {
      if (view === "tool" && !initialVoterId && localStorage.getItem("cyr_tutorial_seen") !== "1") {
        setShowTutorial(true);
      }
    } catch {}
    // One anonymous visit tick per browser session; a pure daily counter
    // with no identifiers, consistent with the privacy policy.
    try {
      if (sessionStorage.getItem("cyr_visit_counted") !== "1") {
        sessionStorage.setItem("cyr_visit_counted", "1");
        fetch("/api/metric?m=visit", { method: "POST" }).catch(() => {});
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  if (view === "landing") return <Suspense fallback={LazyFallback}><Landing onEnter={handleEnter} onNavigate={setView} /></Suspense>;
  if (view === "about")      return <Suspense fallback={LazyFallback}><AboutPage onNavigate={setView} onEnter={handleEnter} /></Suspense>;
  if (view === "benefits")   return <Suspense fallback={LazyFallback}><BenefitsPage onNavigate={setView} onEnter={handleEnter} /></Suspense>;
  if (view === "tutorial")   return <SiteTutorialPage onNavigate={setView} onEnter={handleEnter} />;
  if (view === "howitworks") return <Suspense fallback={LazyFallback}><HowItWorksPage onNavigate={setView} onEnter={handleEnter} /></Suspense>;
  if (view === "privacy")    return <Suspense fallback={LazyFallback}><PrivacyCommitment onNavigate={setView} onEnter={handleEnter} /></Suspense>;
  if (view === "admin-crosswalk") return <Suspense fallback={LazyFallback}><AdminCrosswalk /></Suspense>;
  if (view === "report-card") {
    return (
      <div style={{ fontFamily: serif, background: C.parchment, minHeight: "100vh", padding: "30px 16px" }}>
        <Suspense fallback={LazyFallback}>
          <ReportCard bioguide={initialDeepLink?.bioguide}
            onClose={() => { window.location.href = "/"; }} />
        </Suspense>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: serif, color: C.ink, minHeight: "100vh" }}>
      <header className="cyr-topbar">
        <div className="cyr-flagline" />
        <div className="cyr-header-inner">
          <button className="cyr-brand" onClick={() => { setView("tool"); goTab("home"); }} aria-label="Check Your Representative home">
            <img className="cyr-seal" src="/icons/mark-96.png" alt="" />
            <span style={{ minWidth: 0 }}>
              <span className="cyr-site-title" style={{ display: "block" }}>Check Your Representative</span>
              <span className="cyr-tagline"><span className="cyr-live-dot" />Know your bills · Know your vote · Know your money</span>
            </span>
          </button>
          <button className="cyr-btn cyr-btn-ghost cyr-hide-sm" onClick={openTutorial}>How it works</button>
          {!session && tab !== "profile" && (
            <button className="cyr-btn cyr-btn-primary" onClick={() => { setView("tool"); goTab("profile"); }}>
              Sign in to vote <span aria-hidden>→</span>
            </button>
          )}
          {session && (
            <button className="cyr-btn cyr-btn-ghost" onClick={() => goTab("profile")}>
              👤 <span className="cyr-hide-sm">{resolved?.district || "My Profile"}</span>
            </button>
          )}
        </div>
        <nav className="cyr-nav" aria-label="Sections">
          {TABS.map(t => (
            <button key={t.key} onClick={() => goTab(t.key)} className="cyr-tab"
              aria-current={tab === t.key ? "page" : undefined}>
              <span className="cyr-tab-ico" aria-hidden>{t.icon}</span>
              {t.label}
              {t.key === "vote" && !session && <span className="cyr-lock" aria-label="sign in required">🔒</span>}
            </button>
          ))}
        </nav>
      </header>

      {showTutorial && (
        <FirstRunTutorial onDismiss={dismissTutorial}
          onNavigate={(v) => { dismissTutorial(); setView(v); }} />
      )}

      <main className="cyr-main" key={tab}>
        {tab === "home" && (
          <Home session={session} district={resolved?.district} onGoTab={goTab}
            onNavigate={(v) => setView(v)} />
        )}

        {tab === "vote" && (
          <HelpLayout page="vote">
            <ConstituentVoting
              district={resolved?.district}
              location={resolved?.location}
              session={session}
              onNeedSignIn={() => goTab("profile")}
            />
          </HelpLayout>
        )}

        {tab === "allbills" && (
          <AllBillsBrowser district={resolved?.district} session={session} />
        )}

        {tab === "merch" && <Suspense fallback={LazyFallback}><Merch /></Suspense>}

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
            <Suspense fallback={LazyFallback}><FollowTheMoney district={resolved?.district} /></Suspense>
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

      <footer className="cyr-footer">
        <div className="cyr-flagline" />
        <div className="cyr-footer-inner">
          <div style={{ flex: "1 1 320px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <img src="/icons/mark-96.png" alt="" style={{ width: 40, height: 40, borderRadius: 12 }} />
              <div style={{ fontFamily: "var(--cyr-display)", fontWeight: 800, fontSize: 20, color: "#fff" }}>Check Your Representative</div>
            </div>
            <div style={{ fontFamily: "var(--cyr-display)", fontStyle: "italic", fontSize: 17, color: "#FFE29A", marginBottom: 16 }}>
              "We the People..." A tool for an informed electorate.
            </div>
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 18 }}>
              <button onClick={() => setView("about")} className="cyr-footer-link">What We Stand For</button>
              <button onClick={() => setView("tutorial")} className="cyr-footer-link">Site Tutorial</button>
              <button onClick={() => setView("howitworks")} className="cyr-footer-link">How It Works</button>
              <button onClick={() => setView("benefits")} className="cyr-footer-link">How This Benefits You</button>
              <button onClick={() => setView("privacy")} className="cyr-footer-link">Privacy</button>
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.7, color: "#AFC0E2" }}>
              Non-partisan voter education. Bill data from Congress.gov, campaign finance from the FEC, spending from USASpending.gov and the Census.
            </div>
            <div style={{ marginTop: 14, display: "inline-block", fontSize: 13, fontWeight: 700, color: "#fff",
                          border: "1px solid rgba(255,255,255,.3)", borderRadius: 8, padding: "6px 10px" }}>
              Paid for by We The People Inc.
            </div>
          </div>
          <div style={{ flex: "1 1 360px", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 18, padding: 20 }}>
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
