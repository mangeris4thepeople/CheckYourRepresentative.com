// =============================================================================
// seo.js - per route document titles, meta descriptions, and social tags.
//
// The app has no router, so route changes are state changes; App.jsx calls
// applySeo() whenever the active view or tab changes and this module updates
// the tags in place. The static defaults for first paint live in index.html
// and match the "home" entry here. Keep the paths below in sync with
// public/sitemap.xml.
//
// House style: no em dashes or en dashes anywhere in this copy.
// =============================================================================

const ORIGIN = "https://checkyourrepresentative.com";
const SITE = "CheckYourRepresentative.com";

export const ROUTE_META = {
  home: {
    path: "/",
    title: "CheckYourRepresentative.com | See How Congress Really Votes",
    description:
      "Enter your address, see exactly how your member of Congress votes, who funds them, " +
      "and cast your own position on the bills in front of Congress right now. No spin, just the record.",
  },
  profile: {
    path: "/?tab=profile",
    title: `My Profile | ${SITE}`,
    description:
      "Sign in to save your district, cast positions on live bills, and build your own " +
      "public or private voter card.",
  },
  vote: {
    path: "/?tab=vote",
    title: `Vote on Bills Before Congress | ${SITE}`,
    description:
      "Support, oppose, or undecided: cast your position on active bills and build a real " +
      "record of what your district thinks before the floor vote happens.",
  },
  allbills: {
    path: "/?tab=allbills",
    title: `All Active Bills in Congress | ${SITE}`,
    description:
      "Every active bill in Congress with plain language breakdowns: who benefits, " +
      "who is worse off, and the money behind each one.",
  },
  matrix: {
    path: "/?tab=matrix",
    title: `Accountability Matrix | ${SITE}`,
    description:
      "District by district, see whether each representative's votes in Washington " +
      "match what their constituents actually wanted.",
  },
  rollcalls: {
    path: "/?tab=rollcalls",
    title: `Roll Call Votes | ${SITE}`,
    description:
      "Every recorded House vote, shown next to how constituents said they wanted their " +
      "representative to vote, so no one waits on a press release for the outcome.",
  },
  followthemoney: {
    path: "/?tab=followthemoney",
    title: `Follow the Money | ${SITE}`,
    description:
      "Campaign money, top donors, NGO funding, Social Security, Medicaid, SNAP, and the " +
      "Money Map: six public money flows on one county level map.",
  },
  judges: {
    path: "/?tab=judges",
    title: `Know Your Judge, the National Judicial Directory | ${SITE}`,
    description:
      "A national heat map of sitting judges in every state, drilling from state to county " +
      "to courthouse, with ruling records built from public court data.",
  },
  constituents: {
    path: "/?tab=constituents",
    title: `Constituents Directory | ${SITE}`,
    description:
      "Public voter cards from constituents across the country: real positions on real " +
      "bills, by district and nationwide.",
  },
  merch: {
    path: "/?tab=merch",
    title: `Merch | ${SITE}`,
    description:
      "Shirts and gear that fund non-partisan voter education and keep the record in " +
      "front of the people.",
  },
  about: {
    path: "/about",
    title: `What We Stand For | ${SITE}`,
    description:
      "Why this site exists: every member of Congress works for you, and the full record, " +
      "votes, money, and judges, should be one search away.",
  },
  tutorial: {
    path: "/tutorial",
    title: `Site Tutorial | ${SITE}`,
    description:
      "A step by step walkthrough of every section of the site, from finding your district " +
      "to following the money.",
  },
  howitworks: {
    path: "/how-it-works",
    title: `How It Works | ${SITE}`,
    description:
      "How to use the site: find your representative, read the bill, cast your position, " +
      "check the record, and follow the money.",
  },
  benefits: {
    path: "/benefits",
    title: `How This Benefits You | ${SITE}`,
    description:
      "What you get out of the site: a clear view of your representative's record and a " +
      "way to put your own position on the record.",
  },
  privacy: {
    path: "/privacy",
    title: `Privacy Commitment | ${SITE}`,
    description:
      "Your information and your votes are never sold to anyone. What we store, what we " +
      "count, and what we never touch.",
  },
  landing: {
    path: "/welcome",
    title: `Welcome | ${SITE}`,
    description:
      "See how your member of Congress votes, who funds them, and who benefits. Enter " +
      "your address and check the record.",
  },
};

function setTag(selector, create, value) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  el.setAttribute(el.tagName === "LINK" ? "href" : "content", value);
}

function setMetaByName(name, value) {
  setTag(`meta[name="${name}"]`, () => {
    const m = document.createElement("meta");
    m.setAttribute("name", name);
    return m;
  }, value);
}

function setMetaByProperty(property, value) {
  setTag(`meta[property="${property}"]`, () => {
    const m = document.createElement("meta");
    m.setAttribute("property", property);
    return m;
  }, value);
}

export function applySeo(routeKey) {
  const meta = ROUTE_META[routeKey] || ROUTE_META.home;
  try {
    document.title = meta.title;
    setMetaByName("description", meta.description);
    setMetaByProperty("og:title", meta.title);
    setMetaByProperty("og:description", meta.description);
    setMetaByProperty("og:url", ORIGIN + meta.path);
    setMetaByName("twitter:title", meta.title);
    setMetaByName("twitter:description", meta.description);
    setTag('link[rel="canonical"]', () => {
      const l = document.createElement("link");
      l.setAttribute("rel", "canonical");
      return l;
    }, ORIGIN + meta.path);
  } catch {
    // Never let a tag update break the app; worst case the previous
    // route's tags stay in place.
  }
}
