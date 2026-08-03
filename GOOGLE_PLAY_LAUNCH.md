# PULSE — Google Play launch runbook

This app ships to the Play Store as a **Capacitor** app: the same Vite/React web
build (`dist/`) runs inside a native Android WebView shell under `android/`.
This doc is the end-to-end path from the code in this repo to a live listing.

> You do the final signed build on a machine with the **Android SDK** (Android
> Studio). The CI/dev container here has Java + Gradle but **no Android SDK**, so
> it can scaffold and configure the project (done) but cannot produce the signed
> `.aab`.

---

## 0. What's already set up in this repo

- `capacitor.config.ts` — `appId: com.pulsepb.app`, `appName: PULSE`, `webDir: dist`, splash config.
- `android/` — the native Android project (committed; build artifacts gitignored).
- Adaptive launcher icons + splash generated from `assets/logo.png` (brand ink background).
- Plugins: `@capacitor/app`, `@capacitor/splash-screen`, `@capacitor/status-bar`.
- Custom-scheme deep link `com.pulsepb.app://` wired in `AndroidManifest.xml`.
- npm scripts: `cap:sync`, `android:open`, `android:assets`.

**`applicationId` is `com.pulsepb.app` and is PERMANENT once published — never change it.**

---

## 1. One-time prerequisites

1. **Google Play Developer account** — https://play.google.com/console — one-time **$25** fee. Individual or organization (org needs D-U-N-S verification and takes longer, so start it early).
2. **Android Studio** (latest) on your build machine — installs the Android SDK, platform tools, and JDK 17.
3. **Node 18+** and this repo cloned with `npm install` run.
4. A **privacy policy URL** that is publicly reachable (required by Play). Host it at e.g. `https://pulsepb.com/privacy`. See §7.

---

## 2. Build the web assets and sync into Android

From the repo root:

```bash
npm run cap:sync        # = vite build && cap sync android
```

Run this every time the web code changes — it rebuilds `dist/` and copies it into
`android/app/src/main/assets/public`. Then open the native project:

```bash
npm run android:open    # builds, syncs, and opens Android Studio
# or: npx cap open android
```

`capacitor.config.ts` intentionally has **no `server.url`** — release builds ship
the bundled `dist/`, so the app launches instantly and works offline-first. Do not
add `server.url` for store builds (only for temporary live-reload dev).

---

## 3. Set the version for each release

Edit `android/app/build.gradle`:

```gradle
versionCode 1          // MUST increase by 1 for every upload (integer)
versionName "1.0.0"    // human-facing version string
```

Play rejects an upload whose `versionCode` is not higher than the last one. Bump
`versionCode` on every release; bump `versionName` for user-visible releases.

---

## 4. Create the upload signing key (one time)

Play uses **Play App Signing**: you upload with your *upload key*; Google manages
the *app signing key*. Generate the upload keystore once and keep it safe forever:

```bash
keytool -genkey -v -keystore pulse-upload.keystore \
  -alias pulse-upload -keyalg RSA -keysize 2048 -validity 10000
```

Store `pulse-upload.keystore` and its passwords in a password manager — **losing it
means you can't push updates** (recoverable only via Google support if Play App
Signing is enabled, which it is by default for new apps).

Wire it into Gradle without committing secrets. Create
`android/keystore.properties` (already gitignored via `*.properties`? verify — if
not, add it to `android/.gitignore`):

```
storeFile=/absolute/path/to/pulse-upload.keystore
storePassword=…
keyAlias=pulse-upload
keyPassword=…
```

Then in `android/app/build.gradle`, add a `signingConfigs` block that reads it and
reference it from `buildTypes.release`. (Android Studio's **Build > Generate Signed
Bundle** wizard can also do this for you interactively the first time.)

---

## 5. Produce the release bundle (.aab)

Play requires an **Android App Bundle (.aab)**, not an APK.

**Android Studio:** Build ▸ *Generate Signed Bundle / APK* ▸ **Android App Bundle**
▸ choose the upload keystore ▸ **release** ▸ Finish. Output lands in
`android/app/release/app-release.aab`.

**CLI alternative** (with signing configured in Gradle):

```bash
cd android && ./gradlew bundleRelease
# → android/app/build/outputs/bundle/release/app-release.aab
```

Sanity-check on a device first with a debug build: `./gradlew installDebug` or
Android Studio ▸ Run.

---

## 6. Play Console — create the app + upload

1. Play Console ▸ **Create app** — name **PULSE**, default language, **App**, Free/Paid.
2. **Testing ▸ Internal testing** — create a release, upload the `.aab`, add your
   own email as a tester. Ship to yourself first and install via the opt-in link.
   Only promote to Production once it works on a real device.
3. Fill the required declarations before Production (see §7).
4. Promote Internal ▸ Closed (optional) ▸ **Production** ▸ submit for review.

First review typically takes a few hours to a few days.

---

## 7. Required store declarations (checklist)

Play blocks Production until all of these are complete:

- [ ] **Privacy policy URL** (public) — `https://pulsepb.com/privacy`.
- [ ] **Data safety form** — declare what you collect. PULSE collects at least:
      account email/identity, profile info (name, avatar, location/city), app
      activity (matches, ratings), and messages. Declare encryption in transit and
      whether users can request deletion (Supabase → yes; provide a deletion path).
- [ ] **Account deletion** — because there are accounts, Play requires an in-app
      and/or web route to **delete the account**. Provide a URL (e.g.
      `https://pulsepb.com/delete-account`) or an in-app control.
- [ ] **Content rating questionnaire** — complete it (social features → answer the
      user-communication questions honestly).
- [ ] **Target audience & content** — set age range; PULSE is not directed at children.
- [ ] **App category** — Sports (or Health & Fitness).
- [ ] **Ads** — declare whether the app shows ads (currently: no).
- [ ] **Store listing assets:**
  - [ ] App icon **512×512** PNG (use a crisp 1024 source — see §9).
  - [ ] **Feature graphic 1024×500**.
  - [ ] **Phone screenshots** — at least 2 (min 320px, 16:9 or 9:16). Grab from a
        device/emulator: Home, Matches, Social, a league, the skill assessment.
  - [ ] Short description (≤80 chars) + full description.
- [ ] **Contact email**.

---

## 8. KNOWN LIMITATION — native social sign-in (do before wide release)

Email/password sign-up and login work in the WebView and are fine for launch.

**Google/Apple OAuth will NOT work as-is in the native app.** Two reasons:
1. Google blocks OAuth inside embedded WebViews (`disallowed_useragent`).
2. The current `handleOAuth` uses a Lovable-specific `lovable.auth.signInWithOAuth`
   helper (see `src/pages/Auth.tsx`) that isn't wired for a native redirect.

To enable social login on device (fast-follow):
- Use `@capacitor/browser` to open the provider in the system browser/Custom Tab.
- Redirect back to `com.pulsepb.app://auth/callback` (the deep-link intent filter is
  already in `AndroidManifest.xml`); catch it with `@capacitor/app`'s `appUrlOpen`
  and hand the code to `supabase.auth.exchangeCodeForSession`.
- Add `com.pulsepb.app://auth/callback` to the Supabase project's **Auth ▸ URL
  Configuration ▸ Redirect URLs**, and to the Google/Apple OAuth client's allowed redirects.
- Gate this path behind `Capacitor.isNativePlatform()` so web keeps its existing flow.

Until that's done, either hide the social buttons on native or expect them to fail —
so **ship v1 with email/password**, then add native OAuth and update.

Also verify **Supabase Auth ▸ URL Configuration** allows the app's origin; password
reset / magic-link emails point at a web URL, so keep `https://pulsepb.com` (or your
prod web origin) in the redirect allowlist.

---

## 9. Icon quality note

The launcher icons were generated from `public/pulse-icon-512.png` (512×512). For
crisp store assets, drop a **1024×1024** master at `assets/logo.png` and re-run:

```bash
npm run android:assets
```

Then provide a 1024×1024 export for the Play **512×512 store icon** field too.

---

## 10. Shipping an update later

1. Make web changes → `npm run cap:sync`.
2. Bump `versionCode` (and `versionName`) in `android/app/build.gradle`.
3. Regenerate the signed `.aab` (§5) with the **same upload keystore**.
4. Play Console ▸ Production ▸ new release ▸ upload ▸ roll out.

> Note: pure web/JS changes still require a new store build to reach installed apps,
> because release builds bundle `dist/` (no `server.url`). There is no over-the-air
> web update unless you deliberately add a live/OTA mechanism.

---

## 11b. Automation (do the least work per release)

Two GitHub Actions workflows + local one-command scripts are set up so you rarely
touch the signing wizard or hand-bump versions.

### Local one-liners (you have Android Studio + SDK)
- `npm run android:apk` → builds a debug APK at
  `android/app/build/outputs/apk/debug/app-debug.apk` (installable on a phone).
- `npm run android:bundle` → builds a **signed** release `.aab` (needs
  `android/keystore.properties` — copy `android/keystore.properties.example` and
  fill it in once). Output: `android/app/build/outputs/bundle/release/app-release.aab`.

Signing is wired in `android/app/build.gradle`: it reads `keystore.properties`
when present (gitignored), so there's no per-build wizard.

### Cloud builds (no local machine needed)
- **Actions ▸ "Android debug APK" ▸ Run workflow** — builds an installable APK as
  a downloadable artifact. No secrets required (the committed `.env` supplies the
  Supabase config). Great for sending testers a build fast.
- **Actions ▸ "Android release (signed AAB → Play)" ▸ Run workflow** — builds a
  signed `.aab`, uploads it as an artifact, and (if the Play service-account
  secret is set) publishes it straight to the chosen Play track. `versionCode`
  auto-increments from the run number, so no manual bump.

### One-time setup for the release workflow
1. Create the upload keystore (§4) and base64-encode it:
   ```bash
   base64 -w0 pulse-upload.keystore > keystore.b64   # macOS: base64 -i pulse-upload.keystore | tr -d '\n'
   ```
2. GitHub ▸ repo ▸ **Settings ▸ Secrets and variables ▸ Actions ▸ New repository secret**, add:
   - `ANDROID_KEYSTORE_BASE64` — contents of `keystore.b64`
   - `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (`pulse-upload`), `ANDROID_KEY_PASSWORD`
3. **First release must be created manually** in the Play Console (Google blocks the
   API until a new app has its first build + core setup). So: run the release
   workflow once *without* the Play secret, download the `.aab` artifact, and
   upload it via **Internal testing** in the Console; complete the §7 declarations.
4. For automated uploads afterward, create a **Play service account**: Play Console
   ▸ Setup ▸ **API access** ▸ create/link a Google Cloud service account ▸ grant it
   *Release* permissions ▸ download its JSON key ▸ add it as the
   `PLAY_SERVICE_ACCOUNT_JSON` secret. From then on the release workflow publishes
   to the selected track automatically.

> Ongoing release = click **Run workflow** (or push a tag if you later add that
> trigger). Everything else — build, sign, version bump, upload — is automated.

## 11c. What can't be automated (one-time, by you)
- Google Play **Developer account** + the **$25** fee.
- **Creating the app** entry and the first release in the Play Console.
- Store listing content: **privacy policy URL**, **Data safety**, **account
  deletion** path, **content rating**, screenshots, descriptions (§7).
- Safeguarding the **upload keystore** (losing it blocks updates).

## 12. Later: iOS / App Store

The `ios/` platform isn't added yet. When ready: `npx cap add ios`, open in Xcode on
a Mac, set the bundle id (`com.pulsepb.app`), signing team, icons/splash
(`capacitor-assets generate --ios`), and archive to App Store Connect. The native
OAuth work in §8 is shared. Apple requires "Sign in with Apple" if you offer other
third-party sign-in, and has its own privacy-nutrition-label + review process.
