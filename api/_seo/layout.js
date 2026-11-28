// =============================================================================
// api/_seo/layout.js - the HTML shell for the server-rendered public pages.
//
// These pages exist so search engines and AI assistants can read the public
// record without running the app: every one is complete HTML with its own
// title, description, canonical URL, social tags, and structured data. They
// carry the same "Bright Republic" look as the app (tokens mirrored from
// src/styles/theme.css) and every page links into the live tool.
//
// House style: no em dashes or en dashes anywhere.
// =============================================================================
import { ORIGIN, SITE, esc, jsonLd } from "./util.js";

const CSS = `
:root{--navy:#0E2A6B;--navy2:#16388A;--blue:#2563EB;--sky:#E8F0FF;--red:#E0313F;--gold:#F5B82E;--gold-soft:#FFF6DD;--green:#16A34A;--ink:#0F172A;--muted:#5B6578;--line:#E2E8F0;--bg:#F6F8FC;--radius:16px;--shadow:0 1px 2px rgba(15,23,42,.04),0 8px 24px rgba(15,23,42,.06);--shadow-lg:0 2px 6px rgba(15,23,42,.06),0 22px 48px rgba(14,42,107,.14);--sans:"Inter",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;--display:"Fraunces","Inter",Georgia,serif;--mono:"JetBrains Mono",ui-monospace,Menlo,monospace;--grad:linear-gradient(120deg,#0E2A6B 0%,#2563EB 55%,#E0313F 115%)}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{margin:0;font-family:var(--sans);color:var(--ink);background:radial-gradient(1200px 500px at 85% -10%,rgba(37,99,235,.10),transparent 60%),radial-gradient(900px 420px at -10% 10%,rgba(224,49,63,.07),transparent 60%),var(--bg);-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;line-height:1.55}
a{color:var(--blue);text-underline-offset:3px}
img{max-width:100%}
:focus-visible{outline:3px solid rgba(37,99,235,.45);outline-offset:2px;border-radius:8px}
.flag{height:4px;background:linear-gradient(90deg,var(--red) 0 33%,#fff 33% 66%,var(--blue) 66% 100%)}
.top{position:sticky;top:0;z-index:50;background:rgba(255,255,255,.86);backdrop-filter:saturate(180%) blur(14px);-webkit-backdrop-filter:saturate(180%) blur(14px);border-bottom:1px solid rgba(226,232,240,.9)}
.top-in{max-width:1180px;margin:0 auto;padding:12px 20px;display:flex;align-items:center;gap:14px}
.brand{display:flex;align-items:center;gap:12px;min-width:0;flex:1;text-decoration:none;color:inherit}
.brand img{width:42px;height:42px;border-radius:12px;box-shadow:0 6px 16px rgba(14,42,107,.25);flex-shrink:0}
.brand b{display:block;font-family:var(--display);font-weight:800;font-size:21px;letter-spacing:-.01em;color:var(--navy);line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.brand i{display:block;font-style:normal;font-size:11.5px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-top:3px}
.btn{font-family:var(--sans);font-size:14px;font-weight:700;border-radius:999px;padding:10px 18px;border:1px solid transparent;display:inline-flex;align-items:center;gap:8px;white-space:nowrap;text-decoration:none;line-height:1.1;transition:transform .15s ease,box-shadow .2s ease,background-color .2s ease}
.btn-primary{background:var(--grad);background-size:160% 160%;color:#fff;box-shadow:0 8px 20px rgba(37,99,235,.28)}
.btn-primary:hover{transform:translateY(-1px);box-shadow:0 12px 28px rgba(37,99,235,.36)}
.btn-ghost{background:#fff;color:var(--navy);border-color:var(--line)}
.btn-ghost:hover{border-color:#BFD0F2;background:var(--sky)}
.btn-gold{background:var(--gold);color:var(--ink);box-shadow:0 8px 20px rgba(245,184,46,.35)}
.btn-gold:hover{transform:translateY(-1px)}
.btn-light{background:rgba(255,255,255,.14);color:#fff;border-color:rgba(255,255,255,.35)}
.btn-light:hover{background:rgba(255,255,255,.24)}
.nav{max-width:1180px;margin:0 auto;padding:0 14px 10px;display:flex;gap:6px;overflow-x:auto;scrollbar-width:none}
.nav::-webkit-scrollbar{display:none}
.nav a{font-size:14px;font-weight:600;color:var(--muted);border:1px solid transparent;border-radius:999px;padding:8px 14px;white-space:nowrap;text-decoration:none;flex-shrink:0}
.nav a:hover{background:#fff;color:var(--navy);border-color:var(--line)}
.nav a[aria-current=page]{background:var(--navy);color:#fff;box-shadow:0 6px 16px rgba(14,42,107,.25)}
.hero{background:var(--grad);color:#fff;position:relative;overflow:hidden}
.hero::before{content:"";position:absolute;inset:0;opacity:.14;background-image:radial-gradient(circle at 1px 1px,#fff 1.2px,transparent 1.3px);background-size:24px 24px}
.hero-in{max-width:1180px;margin:0 auto;padding:44px 20px 78px;position:relative}
.crumbs{font-size:13px;font-weight:600;margin:0 0 18px;padding:0;list-style:none;display:flex;flex-wrap:wrap;gap:6px;color:rgba(255,255,255,.75)}
.crumbs a{color:#fff;text-decoration:none;opacity:.9}
.crumbs a:hover{text-decoration:underline}
.crumbs li+li::before{content:"/";margin-right:6px;opacity:.6}
.kicker{font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#FFE29A;margin:0 0 10px}
h1{font-family:var(--display);font-weight:800;font-size:clamp(30px,5vw,50px);line-height:1.06;letter-spacing:-.02em;margin:0 0 12px}
.lede{font-size:clamp(16px,2vw,19px);line-height:1.6;max-width:760px;margin:0;color:rgba(255,255,255,.92)}
.hero-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px}
.who{display:flex;gap:22px;align-items:center;flex-wrap:wrap}
.who img{width:132px;height:161px;object-fit:cover;border-radius:18px;border:3px solid rgba(255,255,255,.85);box-shadow:0 18px 40px rgba(0,0,0,.28);background:#DCE4F5;flex-shrink:0}
.pill{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700;border-radius:999px;padding:5px 11px;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.32);color:#fff}
.pills{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 0}
main{max-width:1180px;margin:-44px auto 0;padding:0 20px 64px;position:relative}
.card{background:#fff;border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow);padding:24px}
.card+.card,.grid+.card,.card+.grid{margin-top:18px}
.grid{display:grid;gap:18px}
.g2{grid-template-columns:repeat(2,minmax(0,1fr))}
.g3{grid-template-columns:repeat(3,minmax(0,1fr))}
.g4{grid-template-columns:repeat(4,minmax(0,1fr))}
.grid>*{min-width:0}
.grid>.card{margin-top:0}
h2{font-family:var(--display);font-weight:800;font-size:clamp(21px,2.6vw,27px);letter-spacing:-.01em;color:var(--navy);margin:0 0 6px;line-height:1.2}
h3{font-size:15px;font-weight:800;color:var(--navy);margin:18px 0 8px}
.sub{font-size:14px;color:var(--muted);margin:0 0 16px}
.stat{padding:18px 20px}
.stat b{display:block;font-family:var(--display);font-weight:800;font-size:clamp(26px,3.4vw,36px);color:var(--navy);line-height:1.05;letter-spacing:-.02em}
.stat span{display:block;font-size:12.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);margin-top:6px}
.stat small{display:block;font-size:13px;color:var(--muted);margin-top:4px}
.bar{height:10px;border-radius:99px;background:#EEF2F9;overflow:hidden;margin-top:12px}
.bar i{display:block;height:100%;border-radius:99px;background:var(--grad)}
table{width:100%;border-collapse:collapse;font-size:14.5px}
th{text-align:left;font-size:12px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);padding:8px 10px;border-bottom:2px solid var(--line);white-space:nowrap}
td{padding:10px;border-bottom:1px solid #EEF2F7;vertical-align:top}
tr:last-child td{border-bottom:0}
td.n,th.n{text-align:right;font-family:var(--mono);font-size:13.5px;white-space:nowrap}
.scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
.list{list-style:none;margin:0;padding:0}
.list li{padding:11px 0;border-bottom:1px solid #EEF2F7}
.list li:last-child{border-bottom:0}
.meta{font-size:13px;color:var(--muted)}
.src{font-size:12.5px;color:var(--muted);margin:14px 0 0}
.src a{color:var(--muted)}
.tag{display:inline-block;font-size:11.5px;font-weight:800;letter-spacing:.04em;border-radius:6px;padding:2px 7px;vertical-align:1px}
.tag.R{background:#FDECEE;color:#B4202C}.tag.D{background:#E8F0FF;color:#1D4ED8}.tag.I{background:#F1F5F9;color:#475569}
.mcard{display:flex;gap:14px;align-items:center;padding:14px;border-radius:14px;border:1px solid var(--line);background:#fff;text-decoration:none;color:inherit;transition:transform .2s ease,box-shadow .25s ease,border-color .2s ease}
.mcard:hover{transform:translateY(-2px);box-shadow:var(--shadow-lg);border-color:#C9D7F2}
.mcard img{width:54px;height:66px;object-fit:cover;border-radius:10px;background:#E8EEF8;flex-shrink:0}
.mcard b{display:block;font-size:15.5px;color:var(--navy);line-height:1.25}
.mcard span{display:block;font-size:13px;color:var(--muted);margin-top:2px}
.mcard .tag{display:inline-block;font-size:11.5px;margin:0 0 0 4px}
.chips{display:flex;flex-wrap:wrap;gap:8px}
.chips a{font-size:13.5px;font-weight:600;text-decoration:none;color:var(--navy);background:#fff;border:1px solid var(--line);border-radius:999px;padding:7px 13px}
.chips a:hover{background:var(--sky);border-color:#BFD0F2}
.az{columns:4 220px;column-gap:26px;list-style:none;margin:0;padding:0;font-size:14.5px}
.az li{padding:5px 0;break-inside:avoid}
.az a{text-decoration:none;font-weight:600;color:var(--navy)}
.az a:hover{text-decoration:underline}
.faq dt{font-weight:800;color:var(--navy);font-size:16px;margin:18px 0 6px}
.faq dt:first-child{margin-top:0}
.faq dd{margin:0;font-size:15.5px;color:#1F2937;line-height:1.7}
.cta{background:linear-gradient(120deg,var(--gold-soft),#fff);border:1px solid #F5D27A;border-radius:18px;padding:24px;display:flex;flex-wrap:wrap;gap:16px;align-items:center;justify-content:space-between;margin-top:18px}
.cta p{margin:4px 0 0;font-size:15px;color:#334155}
.cta strong{font-family:var(--display);font-size:21px;color:var(--navy)}
.prose p{font-size:16.5px;line-height:1.75;color:#1F2937;margin:0 0 14px}
.prose p:last-child{margin-bottom:0}
.note{font-size:13px;color:var(--muted);background:#F1F5FB;border-radius:12px;padding:11px 14px;margin:16px 0 0;line-height:1.6}
footer{background:#0B1B44;color:#DCE4F5}
.foot{max-width:1180px;margin:0 auto;padding:40px 20px 30px;display:flex;flex-wrap:wrap;gap:32px;justify-content:space-between}
.foot b{font-family:var(--display);font-weight:800;font-size:20px;color:#fff}
.foot nav{display:flex;flex-wrap:wrap;gap:8px 18px;margin:14px 0}
.foot a{font-size:13.5px;font-weight:600;color:#fff;opacity:.85;text-decoration:none}
.foot a:hover{opacity:1;text-decoration:underline}
.foot p{font-size:13px;line-height:1.7;color:#AFC0E2;margin:0;max-width:560px}
.paid{margin-top:14px;display:inline-block;font-size:13px;font-weight:700;color:#fff;border:1px solid rgba(255,255,255,.3);border-radius:8px;padding:6px 10px}
@media (max-width:980px){.g4{grid-template-columns:repeat(2,minmax(0,1fr))}.g3{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:640px){.top-in{padding:10px 14px;gap:10px}.brand b{font-size:17px}.brand i{display:none}.brand img{width:36px;height:36px}.btn{padding:8px 13px;font-size:13px}.hide-sm{display:none!important}.hero-in{padding:30px 16px 68px}main{padding:0 14px 48px}.card{padding:18px}.g2,.g3{grid-template-columns:1fr}.who img{width:104px;height:127px}.nav{padding:0 10px 8px}.nav a{font-size:13px;padding:7px 12px}}
@media (prefers-reduced-motion:reduce){*{transition:none!important;scroll-behavior:auto!important}}
`.trim();

const NAV = [
  ["congress", "/congress", "Find Your Member"],
  ["bills", "/bills", "Bills"],
  ["vote", "/vote", "Vote on Bills"],
  ["accountability", "/accountability", "Accountability"],
  ["rollcalls", "/roll-calls", "Roll Calls"],
  ["money", "/follow-the-money", "Follow the Money"],
];

// One page. `head` carries title/description/path; `hero` and `body` are
// already-escaped HTML strings built by the page renderers.
export function page({ title, description, path, robots, ogType = "website", ogImage, schema = [], crumbs = [], active, hero, body }) {
  const url = ORIGIN + path;
  const image = ogImage || `${ORIGIN}/og-image.png`;
  const robotsTag = robots || "index, follow, max-snippet:-1, max-image-preview:large";

  const crumbSchema = crumbs.length ? [{
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem", position: i + 1, name: c[0], item: ORIGIN + c[1],
    })),
  }] : [];
  const scripts = [...schema, ...crumbSchema]
    .map((s) => `<script type="application/ld+json">${jsonLd(s)}</script>`).join("\n");

  const crumbHtml = crumbs.length
    ? `<ol class="crumbs" aria-label="Breadcrumb">${crumbs.map((c, i) =>
        i === crumbs.length - 1
          ? `<li aria-current="page">${esc(c[0])}</li>`
          : `<li><a href="${esc(c[1])}">${esc(c[0])}</a></li>`).join("")}</ol>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="${esc(robotsTag)}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="${esc(ogType)}">
<meta property="og:site_name" content="${SITE}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(image)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(image)}">
<link rel="icon" type="image/x-icon" href="/favicon.ico">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="#0E2A6B">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,700;9..144,800&family=Inter:wght@400;600;700;800&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
<style>${CSS}</style>
${scripts}
</head>
<body>
<header class="top">
<div class="flag"></div>
<div class="top-in">
<a class="brand" href="/" aria-label="Check Your Representative home">
<img src="/icons/mark-96.png" alt="" width="42" height="42">
<span><b>Check Your Representative</b><i>Know your bills · Know your vote · Know your money</i></span>
</a>
<a class="btn btn-ghost hide-sm" href="/how-it-works">How it works</a>
<a class="btn btn-primary" href="/">Open the tool <span aria-hidden="true">→</span></a>
</div>
<nav class="nav" aria-label="Sections">
${NAV.map(([k, href, label]) => `<a href="${href}"${k === active ? ' aria-current="page"' : ""}>${label}</a>`).join("")}
</nav>
</header>
<div class="hero"><div class="hero-in">${crumbHtml}${hero}</div></div>
<main>
${body}
</main>
<footer>
<div class="flag"></div>
<div class="foot">
<div>
<b>Check Your Representative</b>
<nav aria-label="Site">
<a href="/congress">All members of Congress</a>
<a href="/bills">Bills in Congress</a>
<a href="/about">What We Stand For</a>
<a href="/tutorial">Site Tutorial</a>
<a href="/how-it-works">How It Works</a>
<a href="/benefits">How This Benefits You</a>
<a href="/privacy">Privacy</a>
</nav>
<p>Non-partisan voter education. Bill data from Congress.gov, campaign finance from the FEC, spending from USASpending and the Census Bureau. Every figure on this page links to its public source.</p>
<div class="paid">Published by We The People Inc.</div>
</div>
</div>
</footer>
<script>window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments)};</script>
<script defer src="/_vercel/insights/script.js"></script>
</body>
</html>`;
}

// A plain branded page for 404s and soft failures. Never indexed.
export function notFound(message) {
  return page({
    title: `Page not found | ${SITE}`,
    description: "That page is not on file. Find your member of Congress or browse the bills in front of Congress.",
    path: "/congress",
    robots: "noindex, follow",
    hero: `<p class="kicker">Not on file</p><h1>We could not find that page</h1><p class="lede">${esc(message || "The link may be out of date.")}</p><div class="hero-actions"><a class="btn btn-gold" href="/congress">Find your member of Congress</a><a class="btn btn-light" href="/bills">Browse bills</a></div>`,
    body: "",
  });
}
