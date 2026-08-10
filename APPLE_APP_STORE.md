# PULSE — Apple App Store readiness runbook

How to take the existing Capacitor app to the iOS App Store. The web app,
`appId` (`com.pulsepb.app`), and Capacitor config are shared with Android and
need no changes — iOS is a configuration + Apple-tooling task, not a rewrite.

---

## 0. The one hard requirement: a Mac
iOS apps can ONLY be built and submitted from **macOS with Xcode**. There is no
Windows/Linux path. Options if you don't own a Mac:

- **Borrow / buy a Mac** — even a base Mac mini or MacBook Air builds fine.
- **Cloud Mac** — MacinCloud / MacStadium (rent a macOS machine by the hour/month).
- **CI with macOS runners** — Codemagic, Ionic Appflow, or GitHub Actions
  `macos-latest`. These build + sign + upload to App Store Connect without you
  owning hardware. Codemagic has a Capacitor-friendly free tier.

You also need an **Apple Developer Program** membership — **$99/year**
(individual or organization). Sign up at developer.apple.com.

---

## 1. Scaffold the iOS project (on the Mac)
From the repo root:
```
npm install
npm run build
npx cap add ios          # creates the ios/ project (needs macOS + CocoaPods)
npx cap sync ios
npx cap open ios         # opens Xcode
```
Commit the generated `ios/` folder so future builds are reproducible.

---

## 2. Xcode configuration (one-time)
In Xcode, select the **App** target → **Signing & Capabilities**:

1. **Signing** — pick your Team (your Apple Developer account); let Xcode manage
   signing. Bundle Identifier must be **`com.pulsepb.app`**.
2. **Capabilities** — add:
   - **Push Notifications**
   - **Background Modes → Remote notifications** (for push)
   - **Associated Domains** — only if you use universal links (`applinks:pulsepb.com`).
3. **Deployment target** — iOS 14.0+ is a safe floor (Capacitor 7 supports it).

### Info.plist keys to add
The app lets users pick a profile/community photo (`<input type="file" accept="image/*">`),
which on iOS can touch the camera/photo library. Add usage strings (App Store
rejects missing ones):
```xml
<key>NSPhotoLibraryUsageDescription</key>
<string>PULSE uses your photos so you can set a profile picture and share images in community posts.</string>
<key>NSCameraUsageDescription</key>
<string>PULSE uses the camera so you can take a profile picture or share a photo in a community post.</string>
```
Skip the App Store export-compliance prompt on every upload (the app only uses
standard HTTPS, which is exempt):
```xml
<key>ITSAppUsesNonExemptEncryption</key>
<false/>
```

### Privacy manifest (required by Apple)
Add `ios/App/App/PrivacyInfo.xcprivacy` declaring data use + any "required
reason" APIs. Minimum for this app (adjust to match the Data-safety answers you
already wrote for Google Play — same substance):
- Collected data types: name, email address, user ID, photos (optional),
  messages, app activity — all "linked to the user," used for app functionality.
- No tracking (`NSPrivacyTracking = false`), no data sold/shared for ads.

---

## 3. Push notifications on iOS (APNs)
Your push already goes through Firebase (FCM) on the client. iOS needs APNs
underneath FCM:
1. Apple Developer → **Keys** → create an **APNs Auth Key** (`.p8`), note the Key
   ID + Team ID.
2. In **Firebase → your project → add an iOS app** (`com.pulsepb.app`), download
   `GoogleService-Info.plist`, add it to `ios/App/App/` in Xcode.
3. Firebase → Project settings → **Cloud Messaging → Apple app config** → upload
   the `.p8` APNs key.
4. The existing `@capacitor/push-notifications` + FCM sender then deliver to iOS
   with no backend changes (your `sendFcmToUser` already targets device tokens).

> If you'd rather ship v1 without push on iOS, the app is already safe: native
> push is behind `NATIVE_PUSH_ENABLED`, and the enable-notifications UI hides
> itself when it's off — no crash, no dead button.

---

## 4. Icons & splash
You already have the brand assets. Generate the iOS set:
```
npm run android:assets   # existing script; or:
npx capacitor-assets generate --ios
```
Confirm the app icon (1024×1024, no alpha/transparency for the App Store icon)
and splash render in Xcode's asset catalog.

---

## 5. App Store Connect
1. **appstoreconnect.apple.com → Apps → +** → new app, bundle id `com.pulsepb.app`,
   name "PULSE: Pickleball" (reuse the Play listing copy in `PLAY_STORE_LISTING.md`).
2. **Screenshots** — iOS requires specific device sizes (this is the main asset
   difference from Play):
   - 6.9" / 6.7" iPhone (e.g., 1290×2796) — **required**
   - 6.5" iPhone (1242×2688) — often still required
   - 13" iPad (2048×2732) — only if you enable iPad support
   You can adapt the sanitized screenshots in `store-assets/screenshots/`, or
   grab fresh ones from the iOS Simulator.
3. **App Privacy** — fill the "nutrition label" (mirror your Play Data-safety answers).
4. **Age rating** — questionnaire; expected **4+** (has user-generated content /
   chat → answer the UGC question truthfully).
5. **Export compliance** — "uses standard encryption only" → exempt (matches the
   Info.plist flag above).
6. **Sign in with Apple** — NOT required: the app offers no third-party sign-in on
   native, so Guideline 4.8 doesn't apply. (If you ever enable Google sign-in on
   native, you must then also add Sign in with Apple.)

---

## 6. Build → TestFlight → Review
In Xcode: **Product → Archive** → **Distribute App → App Store Connect → Upload**
(or let your CI do it). Then in App Store Connect:
1. The build appears under **TestFlight** — test on your own device first.
2. Attach the build to a **version**, fill the listing, submit for **Review**.
3. Apple review is stricter/slower than Google (typically ~24–48h). Common
   snags to pre-empt: a working demo login in "App Review Information," a live
   privacy-policy URL (`https://pulsepb.com/privacy`), and no broken links.

---

## Reuse from the Google Play work
- **Listing copy** → `PLAY_STORE_LISTING.md` (name, descriptions, support email,
  privacy URL) applies verbatim.
- **Data-safety answers** → map 1:1 to App Privacy + the privacy manifest.
- **App icon** → `store-assets/play-app-icon-512.png`; regenerate at 1024×1024
  with no transparency for the App Store icon.
- **Screenshots** → `store-assets/screenshots/` (re-crop to iPhone 6.7"/6.9" sizes).

## What's NOT ready / needs a decision
- iOS `GoogleService-Info.plist` + APNs key (only if shipping push on iOS at launch).
- iPad support: decide yes/no — if yes, add iPad screenshots + test the layout on
  a larger canvas (the app is responsive, so it should adapt).
