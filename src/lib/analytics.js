// =============================================================================
// analytics.js - Vercel Web Analytics, wired for a router-less app.
//
// Vercel Web Analytics is cookieless: no cookies, no local storage, no
// cross-site tracking, and visitors are counted with a hash that resets
// every day, so a visit cannot be tied to a person or followed over time.
// The privacy policy (PRIVACY_POLICY in src/content/siteCopy.js) describes
// exactly this setup; keep the two in sync.
//
// The app has no router (route changes are state changes), so auto page
// tracking is off and App.jsx reports each view itself through
// trackPageview(), using the same route keys as applySeo() in seo.js.
//
// Every URL is scrubbed before it leaves the browser:
//   - the #session=... magic link token is dropped (the whole hash goes)
//   - query params are dropped except ?tab= and utm_* campaign tags, so a
//     ?voter= card id or anything else never reaches the analytics store
//
// Production builds only, so local dev never sends anything.
//
// House style: no em dashes or en dashes anywhere in this file.
// =============================================================================
import { inject, pageview } from "@vercel/analytics";
import { ROUTE_META } from "./seo.js";

const KEEP_PARAMS = new Set([
  "tab", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
]);

// Views that are never reported. The admin review queue is internal only.
const SKIP_KEYS = new Set(["admin-crosswalk"]);

let started = false;
let lastKey = null;
let firstView = true;

export function scrubUrl(raw) {
  try {
    const u = new URL(raw, window.location.origin);
    const kept = new URLSearchParams();
    for (const [k, v] of u.searchParams) {
      if (KEEP_PARAMS.has(k.toLowerCase())) kept.set(k.toLowerCase(), v);
    }
    const qs = kept.toString();
    return u.origin + u.pathname + (qs ? "?" + qs : "");
  } catch {
    // If the URL cannot be parsed, send the bare origin rather than risk
    // leaking whatever was in it.
    return window.location.origin + "/";
  }
}

export function startAnalytics() {
  if (started || !import.meta.env.PROD) return;
  started = true;
  try {
    inject({
      mode: "production",
      disableAutoTrack: true,
      beforeSend: (event) => ({ ...event, url: scrubUrl(event.url) }),
    });
  } catch {
    // Analytics must never break the app.
  }
}

// Called by App.jsx whenever the active view or tab changes. The first call
// reports the real landing URL (so shared links like /report-card/M001153
// and utm tagged campaign links are measured as they arrived); later calls
// report the canonical path for the view the visitor moved to.
export function trackPageview(routeKey) {
  if (!started || !routeKey || SKIP_KEYS.has(routeKey) || routeKey === lastKey) return;
  lastKey = routeKey;
  const route = ROUTE_META[routeKey]?.path || "/" + routeKey;
  try {
    let path = route;
    if (firstView) {
      const landed = new URL(scrubUrl(window.location.href));
      path = landed.pathname + landed.search;
    }
    firstView = false;
    pageview({ route, path });
  } catch {
    // Best effort only.
  }
}
