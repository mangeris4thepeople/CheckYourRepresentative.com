// =============================================================================
// scripts/build-seo-pages.mjs - runs after `vite build`.
//
// The app is one HTML shell, so before this script every address (/about,
// /privacy, every tab) shipped the homepage's title, description, and
// canonical URL, with an empty <div id="root">. Search engines read that as
// one page repeated, with nothing on it.
//
// This writes one HTML file per public route into dist/, each a copy of the
// built shell with:
//   - that route's own title, description, canonical URL, and social tags
//     (from ROUTE_META in src/lib/seo.js, the same source the app uses)
//   - real text inside #root: the page's heading and copy (from
//     src/content/siteCopy.js) plus links to the rest of the site. React
//     replaces it the moment the app mounts, so visitors see it only as the
//     first paint; crawlers that do not run scripts read it as the page.
//   - structured data on the homepage (WebSite and Organization)
//
// vercel.json rewrites each clean path to its file. House style: no em
// dashes or en dashes anywhere.
// =============================================================================
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ROUTE_META } from "../src/lib/seo.js";
import * as COPY from "../src/content/siteCopy.js";
import { STATES, statePath, ORIGIN, SITE } from "../api/_seo/util.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");
const shellPath = resolve(dist, "index.html");
if (!existsSync(shellPath)) {
  console.error("build-seo-pages: dist/index.html not found, run vite build first");
  process.exit(1);
}
const shell = readFileSync(shellPath, "utf8");

const esc = (v) => String(v ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ---- head ----

function withHead(html, meta) {
  const url = ORIGIN + meta.path;
  const swaps = [
    [/<title>[\s\S]*?<\/title>/, `<title>${esc(meta.title)}</title>`],
    [/(<meta name="description" content=")[^"]*(")/, `$1${esc(meta.description)}$2`],
    [/(<link rel="canonical" href=")[^"]*(")/, `$1${esc(url)}$2`],
    [/(<meta property="og:url" content=")[^"]*(")/, `$1${esc(url)}$2`],
    [/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(meta.title)}$2`],
    [/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(meta.description)}$2`],
    [/(<meta name="twitter:title" content=")[^"]*(")/, `$1${esc(meta.title)}$2`],
    [/(<meta name="twitter:description" content=")[^"]*(")/, `$1${esc(meta.description)}$2`],
  ];
  let out = html;
  for (const [re, to] of swaps) {
    if (!re.test(out)) throw new Error(`build-seo-pages: shell is missing a tag matched by ${re}`);
    out = out.replace(re, to);
  }
  if (meta.noindex) out = out.replace("</title>", `</title>\n    <meta name="robots" content="noindex, follow" />`);
  return out;
}

// ---- body copy ----

// Turns a siteCopy export into headings and paragraphs without knowing its
// exact shape, so new copy shows up here without touching this script.
const HEADING_KEYS = new Set(["heading", "title", "headline", "label", "name", "dataSourcesHeading"]);
const SKIP_KEYS = new Set(["icon", "kicker", "n", "code", "learnMore", "effectiveDate", "lastUpdated"]);
function copyToHtml(node, depth = 2) {
  if (node == null) return "";
  if (typeof node === "string") return `<p>${esc(node)}</p>`;
  if (Array.isArray(node)) {
    if (node.every((x) => typeof x === "string")) return node.map((x) => `<p>${esc(x)}</p>`).join("");
    return node.map((x) => copyToHtml(x, depth)).join("");
  }
  if (typeof node === "object") {
    let out = "";
    for (const [k, v] of Object.entries(node)) {
      if (SKIP_KEYS.has(k)) continue;
      if (HEADING_KEYS.has(k) && typeof v === "string") {
        const h = Math.min(depth, 4);
        out += `<h${h}>${esc(v)}</h${h}>`;
      } else {
        out += copyToHtml(v, depth + 1);
      }
    }
    return out;
  }
  return "";
}

const SECTIONS = [
  ["/congress", "Find your member of Congress", "Every sitting senator and representative, with attendance, campaign money, donors, committees and sponsored bills."],
  ["/bills", "Bills in Congress, in plain English", "What each bill does, who it affects, and where it stands."],
  ["/vote", "Vote on bills", "Put your own position on the record before the floor vote."],
  ["/accountability", "Accountability Matrix", "Whether each representative's votes match what constituents wanted."],
  ["/roll-calls", "Roll call votes", "Every recorded vote, every name attached."],
  ["/follow-the-money", "Follow the Money", "Campaign money, donors, NGO funding, Social Security, Medicaid and SNAP on one map."],
  ["/constituents", "Constituents Directory", "Public voter cards from districts across the country."],
  ["/about", "What We Stand For", "Why this site exists and where every number comes from."],
  ["/how-it-works", "How It Works", "Find your representative, read the bill, cast your position, check the record."],
  ["/tutorial", "Site Tutorial", "A walkthrough of every section."],
  ["/benefits", "How This Benefits You", "What you get out of the site."],
  ["/privacy", "Privacy Commitment", "Your information and your votes are never sold."],
];

const stateLinks = Object.keys(STATES)
  .sort((a, b) => STATES[a].localeCompare(STATES[b]))
  .map((c) => `<a href="${statePath(c)}">${esc(STATES[c])}</a>`).join("");

const FALLBACK_CSS = `
#cyr-pre{font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#0F172A;line-height:1.6}
#cyr-pre .pre-hero{background:linear-gradient(120deg,#0E2A6B 0%,#2563EB 55%,#E0313F 115%);color:#fff;padding:36px 20px 44px}
#cyr-pre .pre-in{max-width:1080px;margin:0 auto}
#cyr-pre .pre-brand{display:flex;align-items:center;gap:12px;font-family:Fraunces,Georgia,serif;font-weight:800;font-size:19px;margin-bottom:26px}
#cyr-pre .pre-brand img{width:40px;height:40px;border-radius:12px}
#cyr-pre h1{font-family:Fraunces,Georgia,serif;font-weight:800;font-size:clamp(28px,5vw,46px);line-height:1.08;letter-spacing:-.02em;margin:0 0 12px}
#cyr-pre .pre-lede{font-size:clamp(16px,2vw,19px);max-width:760px;margin:0;color:rgba(255,255,255,.92)}
#cyr-pre .pre-body{max-width:1080px;margin:0 auto;padding:26px 20px 60px}
#cyr-pre h2{font-family:Fraunces,Georgia,serif;font-size:24px;color:#0E2A6B;margin:28px 0 10px}
#cyr-pre h3{font-size:17px;color:#0E2A6B;margin:20px 0 6px}
#cyr-pre h4{font-size:15px;color:#0E2A6B;margin:14px 0 4px}
#cyr-pre p{font-size:16px;margin:0 0 12px;color:#1F2937;max-width:820px}
#cyr-pre .pre-list{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px}
#cyr-pre .pre-list a{display:block;padding:14px 16px;border-radius:14px;background:#fff;border:1px solid #E2E8F0;text-decoration:none;color:#0E2A6B;font-weight:800}
#cyr-pre .pre-list span{display:block;font-weight:400;font-size:13.5px;color:#5B6578;margin-top:3px}
#cyr-pre .pre-chips{display:flex;flex-wrap:wrap;gap:8px}
#cyr-pre .pre-chips a{font-size:13.5px;font-weight:600;text-decoration:none;color:#0E2A6B;background:#fff;border:1px solid #E2E8F0;border-radius:999px;padding:6px 12px}
#cyr-pre .pre-foot{font-size:13px;color:#5B6578;margin-top:30px}
`.replace(/\n/g, "");

function fallback({ h1, lede, copyHtml = "" }) {
  return `<div id="cyr-pre"><style>${FALLBACK_CSS}</style>
<div class="pre-hero"><div class="pre-in">
<div class="pre-brand"><img src="/icons/mark-96.png" alt="" width="40" height="40"><span>Check Your Representative</span></div>
<h1>${esc(h1)}</h1>
<p class="pre-lede">${esc(lede)}</p>
</div></div>
<div class="pre-body">
${copyHtml}
<h2>Explore the public record</h2>
<ul class="pre-list">${SECTIONS.map(([href, name, desc]) => `<li><a href="${href}">${esc(name)}<span>${esc(desc)}</span></a></li>`).join("")}</ul>
<h2>Members of Congress by state</h2>
<div class="pre-chips">${stateLinks}</div>
<p class="pre-foot">Non-partisan voter education. Bill data from Congress.gov, campaign finance from the FEC, spending from USASpending and the Census Bureau. Paid for by We The People Inc.</p>
</div></div>`;
}

function withBody(html, inner) {
  const marker = '<div id="root"></div>';
  if (!html.includes(marker)) throw new Error("build-seo-pages: #root marker not found in shell");
  return html.replace(marker, `<div id="root">${inner}</div>`);
}

function withSchema(html, objs) {
  const tags = objs.map((o) =>
    `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`).join("\n    ");
  return html.replace("</head>", `  ${tags}\n  </head>`);
}

// ---- page definitions ----

const heading = (key) => ROUTE_META[key].title.replace(` | ${SITE}`, "");

const PAGES = [
  // key, output file, h1, copy
  ["about", "about.html", COPY.ABOUT.heading, copyToHtml({ lede: COPY.ABOUT.lede, mission: COPY.ABOUT.missionLine, pillars: COPY.ABOUT.pillars, paragraphs: COPY.ABOUT.paragraphs, dataSourcesHeading: COPY.ABOUT.dataSourcesHeading, dataSourcesIntro: COPY.ABOUT.dataSourcesIntro, dataSources: COPY.ABOUT.dataSources })],
  ["howitworks", "how-it-works.html", COPY.HOW_IT_WORKS.heading, copyToHtml({ steps: COPY.HOW_IT_WORKS.steps })],
  ["benefits", "benefits.html", COPY.BENEFITS.heading, copyToHtml({ paragraphs: COPY.BENEFITS.paragraphs })],
  ["tutorial", "tutorial.html", heading("tutorial"), copyToHtml({ start: COPY.TUTORIAL_GETTING_STARTED, home: COPY.TUTORIAL_HOME, pages: COPY.TUTORIAL_PAGES, other: COPY.TUTORIAL_OTHER })],
  ["privacy", "privacy.html", COPY.PRIVACY_POLICY.title, copyToHtml({ sections: COPY.PRIVACY_POLICY.sections })],
  ["landing", "welcome.html", "See how your member of Congress really votes", ""],
  ["vote", "vote.html", heading("vote"), ""],
  ["allbills", "all-bills.html", heading("allbills"), ""],
  ["matrix", "accountability.html", heading("matrix"), ""],
  ["rollcalls", "roll-calls.html", heading("rollcalls"), ""],
  ["followthemoney", "follow-the-money.html", heading("followthemoney"), ""],
  ["constituents", "constituents.html", heading("constituents"), ""],
  ["merch", "merch.html", heading("merch"), ""],
];

let written = 0;
for (const [key, file, h1, copyHtml] of PAGES) {
  const meta = ROUTE_META[key];
  if (!meta) throw new Error(`build-seo-pages: no ROUTE_META entry for ${key}`);
  const expected = "/" + file.replace(/\.html$/, "");
  if (meta.path !== expected) throw new Error(`build-seo-pages: ${key} path ${meta.path} does not match ${file}`);
  let html = withHead(shell, meta);
  html = withBody(html, fallback({ h1, lede: meta.description, copyHtml }));
  writeFileSync(resolve(dist, file), html);
  written++;
}

// Homepage last, so every route file above started from the untouched shell.
const home = ROUTE_META.home;
let homeHtml = withBody(shell, fallback({
  h1: "See how Congress really votes",
  lede: home.description,
  copyHtml: `<p>${esc(COPY.BANNER.body)}</p>`,
}));
homeHtml = withSchema(homeHtml, [
  {
    "@context": "https://schema.org", "@type": "WebSite", "@id": `${ORIGIN}/#website`,
    name: SITE, alternateName: "Check Your Representative", url: `${ORIGIN}/`,
    description: home.description, inLanguage: "en-US",
    publisher: { "@id": `${ORIGIN}/#org` },
  },
  {
    "@context": "https://schema.org", "@type": "Organization", "@id": `${ORIGIN}/#org`,
    name: "Check Your Representative", legalName: "We The People Inc.", url: `${ORIGIN}/`,
    logo: `${ORIGIN}/icons/icon-512.png`, email: "info@checkyourrepresentative.com",
    description: "Non-partisan voter education: how Congress votes, who funds it, and what constituents think.",
  },
]);
writeFileSync(shellPath, homeHtml);

console.log(`build-seo-pages: wrote ${written} route pages and the homepage shell`);
