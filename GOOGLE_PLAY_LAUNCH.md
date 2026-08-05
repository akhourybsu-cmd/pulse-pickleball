# PULSE — Google Play launch runbook

This app ships to the Play Store as a **Capacitor** app: the same Vite/React web
build (`dist/`) runs inside a native Android WebView shell under `android/`.
This doc is the end-to-end path from the code in this repo to a live listing.

> You do the final signed build on a machine with the **Android SDK** (Android
> Studio). The CI/dev container here has Java + Gradle but **no Android SDK**, so
> it can scaffold and configure the project (done) but cannot produce the signed
> `.aab`. The GitHub Actions release workflow *can* build it (§10) — but the
> fastest first release is Android Studio locally, below.

---

## ⭐ FASTEST FIRST RELEASE — Android Studio, tonight (baby-proof)

Follow this top to bottom. Two phases: **Phase 1** gets the real app on YOUR
phone (~30–45 min). **Phase 2** is the store paperwork to go public (do after
Phase 1 works). If any command or Android Studio step throws a red error, paste
it into Claude Code (repo terminal) or Android Studio's Gemini and fix before
moving on — don't skip a checkpoint.

### Before you start (one time)
- Install **Android Studio** (latest) — this installs the Android SDK + JDK 21.
- Have this repo cloned locally with **Node 20+**. In the repo run: `npm install`
- Create a **Google Play Console** account ($25, one-time) — you have this. ✅

### Phase 1 — Get the signed app on your phone

**Step 1 — Build the web app + open Android Studio (one command).**
In the repo (Claude Code terminal):
```bash
npm run android:open
```
This builds the web bundle, copies it into `android/`, and opens the project in
Android Studio. ✅ Checkpoint: Android Studio opens and finishes "Gradle sync"
with no red errors (bottom status bar). First sync can take a few minutes.

> ⚠️ THE #1 MISTAKE: never build the app in Android Studio without running
> `npm run cap:sync` (or `npm run android:open`) first — Android Studio does NOT
> rebuild the web code, so you'd ship a stale app.

**Step 2 — Create your signing key + build the AAB (one wizard does both).**
Android Studio menu ▸ **Build ▸ Generate Signed App Bundle / APK…**
1. Choose **Android App Bundle** ▸ Next.
2. Under "Key store path" click **Create new…**
   - **Key store path:** save it OUTSIDE the repo, e.g. `~/keys/pulse-upload.jks`
   - Set a **keystore password** (write it down now).
   - **Alias:** `pulse-upload`  ·  **Key password:** (write it down)  ·  **Validity: 30 years**
   - Fill the certificate name fields (your name / org), click OK.
3. Back in the wizard: keystore + passwords are filled ▸ Next.
4. Build variant: **release** ▸ Finish.

✅ Checkpoint: a "locate / analyze" popup appears. Your file is at
`android/app/release/app-release.aab`.

> 🔐 BACK UP `pulse-upload.jks` + both passwords in a password manager RIGHT NOW.
> This is your upload key forever — losing it means pain (recoverable only via
> Google support). Never commit it (it's gitignored).

**Step 3 — Smoke-test on your own phone first.**
Plug in your Android phone (USB debugging on) ▸ Android Studio ▸ press **Run ▸**.
✅ Checkpoint: the app installs and opens. Log in with **email/password** (social
sign-in is intentionally hidden on the app), record a match, open Player Pulse,
open a league. If it works, proceed.

**Step 4 — Create the app in Play Console + upload to Internal testing.**
1. https://play.google.com/console ▸ **Create app**.
   - App name: **PULSE: Pickleball**  ·  Language: English (US)  ·  Type: **App**  ·  **Free**
   - Accept the declarations ▸ Create app.
2. Left nav ▸ **Testing ▸ Internal testing** ▸ **Create new release**.
3. If prompted about **Play App Signing**, accept the default (**let Google
   manage the app signing key**) — this is correct.
4. **Upload** your `app-release.aab`.
5. Release name auto-fills; paste the v1.0.0 "What's new" text from
   `PLAY_STORE_LISTING.md` ▸ **Next ▸ Save ▸ Review release ▸ Start rollout to
   Internal testing**.
6. Open the **Testers** tab ▸ add your own Google account email ▸ copy the
   **opt-in link** ▸ open it on your phone ▸ "Download it on Google Play".

✅ Checkpoint: PULSE installs from the Play Store on your phone. **Phase 1 done —
v1 exists and works.**

### Phase 2 — Go public (store listing + required forms)

Play blocks Production until these are done. Left nav ▸ work through each;
copy from `PLAY_STORE_LISTING.md`:

1. **Store listing** — App name `PULSE: Pickleball`; short + full description
   (copy from listing doc); upload assets:
   - App icon **512×512 PNG**, Feature graphic **1024×500**, **2–8 phone
     screenshots** (grab from your phone: Home, Matches, a league, Player Pulse).
2. **Store settings** — Category **Sports**; contact email `support@pulsepb.com`.
3. **Privacy policy** — a PUBLIC url to your live site's `/privacy` (e.g.
   `https://pulsepb.com/privacy`). ⚠️ Must be reachable — confirm the web app is
   deployed at that domain first.
4. **App content** (each is a short wizard; answers pre-filled in listing doc):
   - **Data safety** — collects account info, location (opt-in), messages, app
     activity; encrypted in transit; deletion available at `/delete-account`; no
     data sold. (See listing doc for the exact per-row answers.)
   - **Content rating** — run IARC; answer YES to user-to-user communication
     (chat). Expected: Everyone.
   - **Target audience** — 18+ (not directed at children).
   - **Ads** — No ads.
   - **Government apps / news / COVID** — No.
5. **Promote to Production:** Testing ▸ Internal testing ▸ **Promote release ▸
   Production** ▸ (or Production ▸ Create release, upload the same AAB) ▸ roll out.
   First review is typically hours–days.

### If something breaks
- **Gradle sync / build error in Android Studio** → ask the built-in **Gemini**,
  and/or paste the red text into **Claude Code**.
- **Upload rejected "versionCode already used"** → each upload needs a higher
  `versionCode`. Local builds default to `1`; for the next one run
  `VERSION_CODE=2 ./gradlew bundleRelease` from `android/`, or bump the default in
  `android/app/build.gradle`.
- **App shows old content** → you forgot `npm run cap:sync` before building.

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
2. **Android Studio** (latest) on your build machine — installs the Android SDK, platform tools, and a JDK. Capacitor 7 needs **JDK 21** (recent Android Studio bundles it; the CI workflows use Temurin 21).
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

---

## Push notifications (native / FCM)

The app has two push paths that both fan out from the `push-send` edge function:

- **Web push** (browser/PWA): service worker + VAPID, stored in `push_subscriptions`. Already live.
- **Native push** (installed app): FCM device tokens stored in `device_tokens`, sent via FCM HTTP v1.

The native client + backend are already wired (`src/lib/push.ts`, `device_tokens`
table, `supabase/functions/_shared/fcm.ts`). Native delivery stays a **no-op until
Firebase is configured** — enabling notifications still records permission + a
token; messages just won't arrive yet. To turn it on:

### 1. Firebase project + Android app
1. Create a project at <https://console.firebase.google.com>.
2. Add an **Android app** with package name **`com.pulsepb.app`**.
3. Download **`google-services.json`** and place it at **`android/app/google-services.json`**.

### 2. Wire Firebase into the Android build
`@capacitor/push-notifications` is already installed. Add the Google Services
Gradle plugin so `google-services.json` is processed:

- `android/build.gradle` (project) — in `buildscript { dependencies { … } }`:
  `classpath 'com.google.gms:google-services:4.4.2'`
- `android/app/build.gradle` (app) — at the **bottom**:
  `apply plugin: 'com.google.gms.google-services'`

Then `npx cap sync android` (CI already runs `npm run cap:sync`).

> `google-services.json` is secret-ish — keep it out of public forks. It's safe in
> a private repo. The Android build will **fail** if the gradle plugin is applied
> but the json is missing, so add both together.

### 3. Server credential (Supabase secret)
1. Firebase Console → **Project settings → Service accounts → Generate new private key** → downloads a JSON.
2. Add it as a Supabase secret so `push-send` can mint FCM tokens:
   `FCM_SERVICE_ACCOUNT_JSON` = the full contents of that JSON.

That's it — once the secret is present, `push-send` starts delivering to
`device_tokens` alongside web subscriptions. No app or function code changes needed.

### iOS (later)
FCM also brokers APNs. When adding iOS: add an iOS app in Firebase, upload an APNs
auth key, drop `GoogleService-Info.plist` into the Xcode project, and enable the
Push Notifications + Background Modes capabilities. The `device_tokens` /
`push-send` path is shared.
