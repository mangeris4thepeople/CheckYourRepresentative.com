# Play Console Data Safety form answers

These answers match https://checkyourrepresentative.com/privacy exactly.
If the privacy policy changes, change this sheet and the form together.

## Data collection and security

- Does your app collect or share any of the required user data types? YES
- Is all of the user data collected by your app encrypted in transit? YES
- Do you provide a way for users to request that their data is deleted? YES
  (documented request path: users email Info@checkyourrepresentative.com
  from the privacy policy's Your Rights section, and the account and its
  data are deleted)

## Data types collected

Personal info, Email address
- Collected: YES. Shared: NO. Processed ephemerally: NO. Required: YES
- Purpose: Account management (magic link sign in; optional opt-in digest email)

Personal info, Name
- Collected: YES (optional display name). Shared: NO. Required: NO
- Purpose: Account management, App functionality (shown only if the user
  sets their profile public)

App activity, Other user-generated content
- Collected: YES (positions cast on bills: support, oppose, undecided)
- Shared: NO. Required: NO
- Purpose: App functionality (the district tally; shown with the user's
  name only if their profile is public, otherwise only in anonymous
  aggregates)

App activity, App interactions
- Collected: YES (page views through cookieless Vercel Web Analytics:
  which page was viewed, the referring site, browser, OS, device type)
- Shared: NO. Processed ephemerally: NO. Required: YES (no opt out toggle)
- Purpose: Analytics
- Not linked to the user's account or identity; the visitor hash Vercel
  uses is discarded after 24 hours. Page addresses are scrubbed in the
  browser before sending (src/lib/analytics.js), so sign in tokens and
  profile card IDs are never included.

Location, Approximate location
- Collected: YES (country, region, city derived by Vercel Web Analytics
  from the request; no IP address stored by the analytics tool)
- Shared: NO. Required: YES
- Purpose: Analytics
- Note: separate from the district lookup address, which is still used
  once for matching and never stored.

App info and performance, Other app performance data
- Collected: NO crash or performance SDKs. Server hosts keep standard
  operational logs (IP addresses) for security and rate limiting only.

## Data types NOT collected (answer NO)

Precise location (the district lookup address is used once for matching
and never stored), Financial info, Health and fitness,
Messages, Photos and videos, Audio, Files and docs, Calendar, Contacts,
Browsing history, Search history, Installed apps, Device or other IDs for
advertising.

## Other form answers

- Ads: NO ads of any kind, no advertising SDKs
- Data sold: NO, to anyone, ever
- Third parties data is shared with: none for user data. Infrastructure
  processors only: Neon (database), Resend (sign in email), Vercel
  (hosting and cookieless Web Analytics), consistent with the privacy policy
- Account creation: YES, email based (one time link, no password)
- Account deletion URL: https://checkyourrepresentative.com/privacy
  (Your Rights section documents the deletion request path)
- Target audience: adults; not directed at children
