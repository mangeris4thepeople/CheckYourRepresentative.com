# Android app (Trusted Web Activity)

The Android app is the live site, wrapped as a Trusted Web Activity (TWA).
There is no second codebase: the site is a compliant PWA (manifest, icons,
service worker, offline page, all in `public/`), and the app in
`twa/twa-manifest.json` opens it full screen. Every site deploy updates the
app instantly, because the app IS the site.

## One-time setup on your machine

Bubblewrap needs a JDK and the Android SDK; it offers to download both on
first run. Node 18+ required.

```
npm install -g @bubblewrap/cli
cd twa
bubblewrap init --manifest https://checkyourrepresentative.com/manifest.webmanifest
```

Init reads the live web manifest and this folder's `twa-manifest.json`.
Accept the defaults it prefills from those files (package id
`com.checkyourrepresentative.app`, name, colors).

## The upload keystore: read this twice

`bubblewrap init` offers to create a signing key. Create it at
`twa/android.keystore` with alias `upload`, or make one yourself:

```
keytool -genkeypair -v -keystore android.keystore -alias upload \
  -keyalg RSA -keysize 2048 -validity 10000
```

Rules that protect the app listing:

1. The keystore file and its two passwords are NEVER committed to this
   repository. `twa/android.keystore` is gitignored.
2. Back the file and passwords up in at least two places that are not this
   computer (a password manager plus an offline copy).
3. With Play App Signing (next section), Google holds the key that signs
   what users install, and this keystore is only the upload key. A lost
   upload key can be reset through Play Console support. Without Play App
   Signing, losing this file means losing the ability to ever update the
   app. Enroll in Play App Signing; it is the default for new apps.

## Play App Signing and assetlinks

1. Build and upload the first AAB (below). Play Console enrolls the app in
   Play App Signing automatically for new apps.
2. In Play Console open Setup, App signing, and copy the SHA-256 fingerprint
   of the APP SIGNING key certificate (not the upload key).
3. Put that fingerprint into `public/.well-known/assetlinks.json` in place
   of REPLACE_WITH_PLAY_APP_SIGNING_SHA256_FINGERPRINT, commit, push. Vercel
   serves the file at
   https://checkyourrepresentative.com/.well-known/assetlinks.json with
   content type application/json.
4. Digital Asset Links is what removes the browser chrome. Until the
   fingerprint matches, the app opens with a URL bar; after it matches, it
   runs full screen. Verify with:
   https://developers.google.com/digital-asset-links/tools/generator

## Building the release artifact

```
cd twa
bubblewrap build
```

Outputs `app-release-bundle.aab` (upload this to Play) and an
`app-release-signed.apk` for local emulator testing:

```
bubblewrap install
```

On the emulator confirm: full screen with no URL bar (proves assetlinks),
navy splash screen with the seal, airplane mode shows the branded offline
page, the magic link sign in completes inside the app, and external links
(CourtListener, USASpending) open properly.

## Versioning

Each Play upload needs a higher `appVersionCode` in `twa-manifest.json`.
Bump it, rerun `bubblewrap build`, upload the new AAB. The web content
itself needs no version bump; it updates with every site deploy.
