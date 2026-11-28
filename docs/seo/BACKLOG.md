# CYR SEO backlog

Worked daily: Opus builds at 1:37 AM Mountain, Fable inspects, corrects and merges at 3:19 AM.
Source: full crawl of all 858 sitemap URLs on 2026-11-26. All returned 200. Zero mentions of the site owner or any campaign.

## Open

1. [P0 accuracy] 249 bill pages (/bill/...) render AI-written "Who benefits" and "Who is worse off" blocks (api/_seo/pages.js near the `benefits:` field and the `block("Who benefits", ...)` call, from extra.who_benefits and the worse-off field). These are interpretations with political-motive speculation and at least one false claim: /bill/s-5130-119 says the bill serves "Cruz's own 2026 Senate reelection", but Sen. Ted Cruz was reelected in 2024 and his seat is next up in 2030. Fix: stop rendering both blocks on public pages and in JSON-LD; where available show the official CRS summary from the Congress.gov API bill summaries endpoint with its source link. Keep the labeled plain-English "What it does" only where it makes no claim beyond the bill record; list any that do.
2. [P1 accuracy, verify] /rep/darline-graham-g000608 shows FEC money under candidate ID S0SC00149, the late Sen. Lindsey Graham's campaign. Check the FEC API for Sen. Darline Graham Nordone's own candidate ID, decide which committee the page should show, and audit the member-to-FEC crosswalk for other members seated in 2026 by appointment or special election.
3. [P1 titles] 850 of 858 titles exceed 65 characters, mostly from the " | CheckYourRepresentative.com" suffix. Shorten the suffix or drop it on rep and bill pages so the name and key words fit in 60 characters.
4. [P1 descriptions] 840 of 858 meta descriptions exceed 160 characters. Generate them at 155 or less from the page's own data.
5. [P2 freshness] 433 sitemap lastmod values read 2026-11-20 and about 100 still read early July 2026. Set lastmod from each page's real data update time.
6. [P2 separation] A personal admin Gmail address is hard-coded in api/_handlers/daily-report.js, test-email.js and verify-congress.js in a public repo. Move to an ADMIN_EMAIL env var defaulting to info@checkyourrepresentative.com.
7. [P3] api/seo.js header comment uses /rep/lauren-boebert-b000825 as its example; use a neutral example.

## Done

8. DECIDED BY DOUG 2026-11-26, DONE in branch seo/2026-11-26: footer and email disclaimer changed from "Paid for by We The People Inc." to "Published by We The People Inc." everywhere (We The People Inc. owns the site). Matches public/llms.txt.
9. DECIDED BY DOUG 2026-11-26, DONE in branch seo/2026-11-26: Merch removed. Deleted src/components/Merch.jsx and api/_handlers/checkout.js, removed the Merch tab, route, tutorial entry, route meta, prerendered page and sitemap entry, removed the /api/checkout rewrite, and added a permanent redirect from /merch to /.

## Keywords

Seed list; refine from Search Console data when available: how did my representative vote, who funds my congressman, check my representative, congressional voting record lookup, representative attendance record, missed votes congress, FEC donors by state for my representative, find my representative by address, roll call votes this week, plain English bill summary congress, plus "<member name> voting record" for the 10 members with the most pageviews.
