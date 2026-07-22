# Releasing the Android app to Google Play

The app is the live site in a Trusted Web Activity wrapper. Full build
mechanics are in docs/ANDROID.md; this file is the Play Console sequence.

## 0. Prerequisites

- A Google Play developer account ($25 one time) at play.google.com/console
- The AAB built per docs/ANDROID.md (`bubblewrap build` in twa/)
- The upload keystore backed up per docs/ANDROID.md

## 1. Create the app

Play Console, Create app: name "Check Your Representative", default
language English (US), App, Free. Confirm the declarations.

## 2. Store listing

All content is prewritten in store-listing/:
- App name: title.txt
- Short description: short-description.txt (80 character limit, it fits)
- Full description: full-description.txt
- App icon: store-listing/assets/icon-512.png
- Feature graphic: store-listing/assets/feature-graphic-1024x500.png
- Phone screenshots: store-listing/assets/screenshot-*.png (1080x1920)
- Category: News and magazines (or Books and reference); tags civic
- Contact email: Info@checkyourrepresentative.com
- Privacy policy URL: https://checkyourrepresentative.com/privacy

## 3. Data safety questionnaire

Answer exactly per store-listing/data-safety-answers.md. The account
deletion URL is the privacy policy page, whose Your Rights section
documents the email request path.

## 4. Content rating questionnaire

Category: reference, news, or educational. No user generated content
visible to others except opt-in public profiles (declare the user
interaction question accordingly: users can share limited info, profiles
are private by default). No violence, no gambling, no ads. Expected
rating: Everyone.

## 5. Internal testing first

App bundles, Internal testing, Create release, upload
twa/app-release-bundle.aab. Add your own email as a tester. Install from
the internal testing link on a real phone and run the checklist at the
bottom of docs/ANDROID.md (full screen, splash, offline page, magic link
sign in, external links).

## 6. Fix assetlinks before promoting

After the first upload, copy the Play App Signing SHA-256 fingerprint
into public/.well-known/assetlinks.json (docs/ANDROID.md section 3),
push, redeploy, and reinstall the internal build to confirm the URL bar
is gone. Do not promote to production while the URL bar shows.

## 7. Promote to production

Releases overview, promote the internal release to Production, staged
rollout at 100% (or 20% first if cautious). Review typically takes a few
days for a first release.

## 8. Updating the app later

The web content updates itself with every site deploy; no Play release
needed. Only rebuild and upload a new AAB when the wrapper changes
(icons, name, shortcuts, colors): bump appVersionCode in
twa/twa-manifest.json, `bubblewrap build`, upload to internal testing,
promote.
