# CYR Android App — Launch Plan for August 28, 2026

The app is the live site in a Trusted Web Activity (TWA) wrapper. The repo
side is ~95% done already: `twa/twa-manifest.json`, the web manifest, service
worker + offline page, assetlinks scaffold, store listing copy, screenshots,
and data-safety answers all exist and check out. What remains is almost
entirely Play Console work that only a human with the account can do.

## The one thing that decides whether 8/28 is possible

**Google Play account type.** New *personal* developer accounts must run a
closed test with 12 testers for 14 continuous days before they can apply for
production access. 14 days from Aug 15 is Aug 29 — that misses 8/28.

- If you already have a Play developer account from before, or register as an
  **organization** (needs a D-U-N-S number), the 14-day gate does not apply
  and 8/28 is comfortably achievable.
- If you must use a new personal account, the realistic path is: closed test
  live by Aug 14 with 12 testers recruited (friends/family count), apply for
  production Aug 28-29, launch the first days of September.

**Action today (Aug 12): create/verify the Play developer account** ($25
one-time, identity verification can take a few days) —
https://play.google.com/console

## Timeline

| Date | Who | What |
|---|---|---|
| Aug 12 | Doug | Register Play developer account; start identity verification |
| Aug 12 | done | Architecture audit fixed + merged (this branch) |
| Aug 13-14 | Doug + Claude | Install JDK/bubblewrap, generate upload keystore (`twa/android.keystore`, alias `upload`), **back it up twice**, `bubblewrap build` → AAB. Verify targetSdkVersion ≥ 35 |
| Aug 14-15 | Doug | Play Console: create app, store listing (all copy in `store-listing/`), Data Safety (answers in `store-listing/data-safety-answers.md`), content rating, privacy policy URL `https://checkyourrepresentative.com/privacy` |
| Aug 15 | Doug | Upload AAB to Internal testing; install on a real phone; run the checklist at the bottom of `docs/ANDROID.md` |
| Aug 15 | Claude | Copy the Play App Signing SHA-256 fingerprint into `public/.well-known/assetlinks.json`, push, redeploy; confirm URL bar disappears on reinstall |
| Aug 15-24 | both | (Personal-account path: closed test running with 12 testers) Fix anything the checklist surfaces; site improvements ship instantly to the app since the app IS the site |
| Aug 22-24 | Doug | Promote to Production (staged rollout). First-app review takes several days — submitting by Aug 24 protects Aug 28 |
| Aug 28 | — | Launch 🚀 |

## Why TWA is the right architecture for v1

One codebase: every site deploy updates the app instantly with no Play
review. The site is already mobile-responsive, has a service worker with a
branded offline page, installable manifest, and deep-link shortcuts (Vote /
Money / Judges). A native or React Native rebuild would be a multi-week
parallel codebase for zero user-visible gain at this stage. Revisit native
only when you need push notifications or offline data (v2 candidates).

## Remaining repo work (Claude can do in-session)

1. After first AAB upload: real fingerprint into `assetlinks.json` (step above).
2. Optional de-risking: static `public/privacy.html` fallback so the privacy
   policy URL renders without JavaScript for Play reviewers.
3. Bump `appVersionCode` for any future wrapper-level change (icons, name,
   shortcuts) — web content needs no Play release.

## Production config still needed (from the audit — affects the app too)

These are dashboard actions, not code. Claude can drive them in your browser
with your go-ahead:

1. **Neon SQL editor**: run `migrations/schema_v2.sql` +
   `migrations/schema_v2_addendum.sql` (turns the NGO Money Loop from
   "schema_not_migrated" to live), then `schema_contact_actions.sql` and the
   new blocks in `schema.sql` (sessions/auth_requests provisioning is
   self-healing but belongs in the schema).
2. **Vercel env vars**: set `ADMIN_EMAILS` (unlocks /admin/crosswalk),
   confirm `CENSUS_API_KEY`, `FEC_API_KEY`, `SITE_URL` are present.
3. **GitHub Actions**: confirm the `DATABASE_URL` secret matches production
   Neon, then manually dispatch the `etl-ngo-money` workflow (years
   "2024 2025 2026") and `etl-monthly` once — both have been failing
   structurally and have never completed.
4. **Trigger once after deploy**: `/api/cron?op=sync-ssa&key=<CRON_SECRET>`
   to replace the 2015 Social Security data with the 2024 edition.
