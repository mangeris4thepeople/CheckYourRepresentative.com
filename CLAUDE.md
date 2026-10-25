# CheckYourRepresentative.com

Vite + React front end (`src/`), Vercel serverless API (`api/`), Neon Postgres.
The shared UI kit is `src/components/ui/Kit.jsx`; build new UI on it.

## Rules

- No em dashes anywhere (copy, comments, commit messages). Use commas, colons, or " - ".
- No mock data. Every figure comes from a named public record; where data is missing, say so plainly.
- Keep the names `myDelegate`, `delegateVotes`, and `DELEGATES_DB`. Do not rename them.
- The footer keeps "Paid for by We The People Inc."
- On any feature change, rerender the About page (`src/components/marketing/AboutPage.jsx`) and the
  Site Tutorial (`src/components/marketing/SiteTutorial.jsx`), both driven by `src/content/siteCopy.js`.
  Also check `store-listing/` and the app shortcuts in `public/manifest.webmanifest` and `twa/twa-manifest.json`.

## Know Your Judge (moved to checkyourjudge.com)

The front end was removed from this site in d7c24a1. The full feature is preserved on branch
`archive/know-your-judge` (5c58802).

The judge API and data jobs stay live here until checkyourjudge.com takes over, so the data keeps refreshing:

- `api/judges.js` and the 9 judge rewrites in `vercel.json` (`/api/judges-list` through `/api/national-judge-detail`)
- Handlers in `api/_handlers/`: `judge-detail`, `judges-list`, `judges-geo`, `national-judges`,
  `sync-judges`, `sync-national-judges`, `sync-court-locations`, `sync-opinions`, `sync-ruling-stats`,
  `sync-ojpe`, `import-retention`
- Crons in `vercel.json`: `sync-national-judges`, `sync-court-locations`, `sync-opinions`,
  `sync-ruling-stats`, `sync-judges` (`sync-ojpe` and `import-retention` have no cron; they run manually)
- npm scripts `etl:judges`, `import:ojpe`, `import:retention` and their files in `scripts/etl/`

Once checkyourjudge.com is serving this data, remove all of the above from this repo (crons and rewrites first).
