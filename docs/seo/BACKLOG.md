# CYR SEO backlog

Worked daily: Opus builds at 1:37 AM Mountain, Fable inspects, corrects and merges at 3:19 AM.
Source: full crawl of all 858 sitemap URLs on 2026-11-26. All returned 200. Zero mentions of the site owner or any campaign.

## Open

1. [P0 accuracy] PARTLY DONE 2026-11-27 (PR #11): bill pages (/bill/...) no longer render the AI-written "Who benefits" and "Who is worse off" blocks, which carried political-motive speculation and at least one false claim (/bill/s-5130-119 said the bill served "Cruz's own 2026 Senate reelection"; Sen. Ted Cruz holds a Class I seat, was reelected in 2024 and is next up in 2030). Still open: (a) where available show the official CRS summary from the Congress.gov API bill summaries endpoint with its source link; (b) audit the remaining AI-written "Who it affects" and "What changes for most people" text, which can also speculate (example: /bill/s-5130-119 "Who it affects"), and list any that claim more than the bill record.
2. [P1 accuracy, verify] /rep/darline-graham-g000608 shows FEC money under candidate ID S0SC00149, the late Sen. Lindsey Graham's campaign. Check the FEC API for Sen. Darline Graham Nordone's own candidate ID, decide which committee the page should show, and audit the member-to-FEC crosswalk for other members seated in 2026 by appointment or special election.
3. [P1 titles] PARTLY DONE 2026-11-27 (PR #11): every server-rendered title (members index, state, member, bills index and bill pages) fits 60 characters. Still open: the app routes prerendered from src/lib/seo.js (/, /accountability, /welcome, /roll-calls, /follow-the-money) are over 60.
4. [P1 descriptions] PARTLY DONE 2026-11-27 (PR #11): every server-rendered meta description fits 155 characters. Still open: check the same five app routes in src/lib/seo.js.
5. [P2 freshness] 433 sitemap lastmod values read 2026-11-20 and about 100 still read early July 2026. Set lastmod from each page's real data update time.
6. [P2 separation] A personal admin Gmail address is hard-coded in api/_handlers/daily-report.js, test-email.js and verify-congress.js in a public repo. Move to an ADMIN_EMAIL env var defaulting to info@checkyourrepresentative.com.
7. [P3] api/seo.js header comment uses /rep/lauren-boebert-b000825 as its example; use a neutral example.

## NEEDS DOUG (do not work these without his decision)

- The in-app voting tool (src/components/BillVotingQueue.jsx, fed by api/_handlers/digest.js) still shows "Who benefits if this passes" and "Who is worse off if this passes". Removing them changes the product.
- Vercel Web Analytics is off for the project, so the daily run cannot report pageviews. Turn it on in the project's Analytics tab if daily traffic numbers are wanted.

## Done

8. DECIDED BY DOUG 2026-11-26, DONE in branch seo/2026-11-26: footer and email disclaimer changed from "Paid for by We The People Inc." to "Published by We The People Inc." everywhere (We The People Inc. owns the site). Matches public/llms.txt.
9. DECIDED BY DOUG 2026-11-26, DONE in branch seo/2026-11-26: Merch removed. Deleted src/components/Merch.jsx and api/_handlers/checkout.js, removed the Merch tab, route, tutorial entry, route meta, prerendered page and sitemap entry, removed the /api/checkout rewrite, and added a permanent redirect from /merch to /.

## Keywords

Seed list; refine from Search Console data when available: how did my representative vote, who funds my congressman, check my representative, congressional voting record lookup, representative attendance record, missed votes congress, FEC donors by state for my representative, find my representative by address, roll call votes this week, plain English bill summary congress, plus "<member name> voting record" for the 10 members with the most pageviews.
