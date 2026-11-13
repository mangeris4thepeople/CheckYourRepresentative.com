// =============================================================================
// ga.js - Google Analytics 4, loaded only after the visitor clicks
// "Allow analytics". Vercel Web Analytics (src/lib/analytics.js) keeps running
// as before and is unaffected by this file.
//
// Nothing from Google loads unless ALL of these are true:
//   - this is a production build
//   - VITE_GA_MEASUREMENT_ID is set in the environment
//   - the visitor has chosen "Allow analytics" (stored in localStorage)
//
// Consent Mode starts with every storage type denied. Google's gtag.js is
// only added to the page after a yes, and page views are sent by hand
// through trackGAPageview(), so the URL is scrubbed first. Google signals,
// ad personalization, and automatic page views are all switched off.
//
// Every URL is scrubbed by scrubUrl() from analytics.js before it leaves the
// browser: the #session=... magic link token and its email are dropped, and
// query params are dropped except ?tab= and utm_* campaign tags.
//
// Withdrawing: choosing "No thanks" stops loading on later visits and tells
// Google to deny storage on the current page. Clearing this site's data in
// the browser shows the choice again.
//
// House style: no em dashes or en dashes anywhere in this file.
// =============================================================================
import { scrubUrl } from "./analytics.js";
import { ROUTE_META } from "./seo.js";

export const CONSENT_KEY = "cyr-analytics-consent";
const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || "";

// Views that are never reported. The admin review queue is internal only.
const SKIP_KEYS = new Set(["admin-crosswalk"]);

let loaded = false;
let lastKey = null;
let firstView = true;

export function gaConfigured() {
  return !!import.meta.env.PROD && !!MEASUREMENT_ID;
}

export function getAnalyticsConsent() {
  try {
    const v = window.localStorage.getItem(CONSENT_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

function ensureGtag() {
  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    window.gtag = function gtag() { window.dataLayer.push(arguments); };
    window.gtag("consent", "default", {
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
    window.gtag("js", new Date());
  }
}

function loadGA() {
  if (loaded || !gaConfigured()) return;
  loaded = true;
  ensureGtag();
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(MEASUREMENT_ID);
  document.head.appendChild(s);
  window.gtag("consent", "update", { analytics_storage: "granted" });
  window.gtag("config", MEASUREMENT_ID, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    anonymize_ip: true,
  });
}

// Called once at startup. Loads GA only for a visitor who already said yes.
export function startGA() {
  if (getAnalyticsConsent() === "granted") loadGA();
}

// Called by the consent banner and by any future settings control.
export function setAnalyticsConsent(choice) {
  if (choice !== "granted" && choice !== "denied") return;
  try { window.localStorage.setItem(CONSENT_KEY, choice); } catch { /* storage blocked */ }
  if (choice === "granted") {
    loadGA();
  } else if (loaded && window.gtag) {
    try { window.gtag("consent", "update", { analytics_storage: "denied" }); } catch { /* best effort */ }
  }
}

// Called by App.jsx alongside trackPageview(). Sends nothing unless GA loaded.
export function trackGAPageview(routeKey) {
  if (!loaded || !routeKey || SKIP_KEYS.has(routeKey) || routeKey === lastKey) return;
  lastKey = routeKey;
  try {
    const route = ROUTE_META[routeKey]?.path || "/" + routeKey;
    let pageLocation = window.location.origin + route;
    if (firstView) {
      // The first view keeps the scrubbed landing URL so utm_* campaign tags count.
      pageLocation = scrubUrl(window.location.href);
    }
    firstView = false;
    const path = new URL(pageLocation).pathname;
    window.gtag("event", "page_view", { page_location: pageLocation, page_path: path, page_title: ROUTE_META[routeKey]?.title || document.title });
  } catch {
    // Analytics must never break the app.
  }
}
