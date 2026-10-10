# PULSE — updating the Google Play app

## Existing closed beta

Update the existing `com.pulsepb.app` listing with the original PULSE upload key.
Do not create another app, replace its signing key, or reset the tester list.

1. In Play Console, check **Latest releases and bundles** for the highest uploaded
   version code, including drafts and other tracks. Choose a new, higher code.
2. In GitHub Actions, run **Android release (signed AAB → Play)** from the latest
   `main` branch. Enter that `version_code` and a `version_name` such as `1.1.0`.
   Leave `upload_to_play` off to download a bundle for manual upload.
3. Download the versioned artifact and extract `app-release.aab`. Upload it under
   **Closed testing → your existing track → Create new release**. Keep the existing
   testers, add release notes, review the release, and submit the update.
4. Install the update from the existing tester link over the previous beta,
   without uninstalling it. Complete the device checks below before promoting
   the release to production.

Publishing the website does not update the Play app: Android bundles a copy of
PULSE's web assets. Every Android update requires a fresh production build and
Capacitor sync. The release workflow does both automatically.

## What the release workflow verifies

- The source is the latest `main` commit, with the pinned production backend.
- Version inputs are valid; the version code must also be checked against Play
  Console because this validation cannot read the highest uploaded code.
- Production backend connectivity, a fresh web build, and Android asset hashes.
- A signed release bundle using the configured PULSE upload key.
- A valid bundle signature and a downloadable SHA-256 checksum.

Automatic publication is optional. It requires `PLAY_SERVICE_ACCOUNT_JSON`,
`upload_to_play` enabled, and the **exact existing track ID**. A closed track can
have a custom ID; do not assume it is `alpha` or `beta`. Merely configuring the
secret does not publish a build. Workflow run numbers are not app versions.

The original signing configuration uses these repository secrets:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

Reuse the existing values. Do not print them in logs, commit them, or generate a
replacement key to fix a missing local configuration. The workflow removes its
local keystore and properties file after the build, including on failure.

## Local Android builds

Use Node 20+, Android SDK platform 36, and **JDK 21**. Android Studio may bundle a
newer Java runtime; explicitly select Java 21 for Gradle. The project pins Android
Gradle Plugin 8.13.2 and Gradle 8.13 with a distribution checksum.

From the repository root:

```bash
npm ci
npm run cap:sync
```

Then from `android/`:

```bash
./gradlew :app:assembleDebug :app:assembleDebugAndroidTest
```

On Windows use `gradlew.bat`. Outputs:

- App: `android/app/build/outputs/apk/debug/app-debug.apk`
- Tests: `android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk`

The instrumentation tests check the permanent app ID, bundled production backend,
absence of a remote development URL, and successful WebView rendering. Run
`:app:connectedDebugAndroidTest` only with a test device or emulator attached.
These tests do not replace signed-in device testing.

For a local **signed release**, copy `android/keystore.properties.example` to
`android/keystore.properties` and reference the existing upload key. Keep both
files containing credentials and the key out of version control. Set the confirmed
`VERSION_CODE` and `VERSION_NAME` environment variables, run `npm run cap:sync`,
then run `:app:bundleRelease` from `android/`.

Missing signing configuration stops release builds. Debug builds do not require
it. Historical local debug version defaults are not a substitute for choosing a
fresh release version. The signed bundle is written to:

`android/app/build/outputs/bundle/release/app-release.aab`

## Device checks before promotion

Use the actual Play-delivered beta on an Android phone. Confirm:

- Updating preserves the existing account and session.
- Email sign-in, signup, confirmation, password reset, sign-out and sign-in work.
- Guests can complete the assessment, read results, and retain them after signup.
- PULSE assessment results remain clearly distinct from DUPR ratings.
- Shared community links retain their destination through sign-in.
- Home, matches, friends/chat, communities and leagues load correctly.
- Round-robin assignments and scores update, including after background/resume.
- Switching apps preserves forms and drafts; the Android Back button behaves
  correctly and there is no endless loading screen.
- Notification permission and receipt work with the intended account.

Native Google/Apple social-login buttons are currently hidden; the Android app
uses email sign-in. Do not advertise native social sign-in as available. Enabling
it later requires a system-browser OAuth flow and a tested native callback.

Review the existing Play listing, app-access instructions and data-safety answers
for changes introduced by the update. Public support routes include
`https://pulsepb.com/privacy` and `https://pulsepb.com/delete-account`. Do not
replace an already configured store listing as part of a routine binary update.

## Troubleshooting

- **Version code already used:** choose a code above every existing Play upload
  and rebuild. Renaming the `.aab` does not change its version.
- **Wrong signing certificate:** verify the configured upload key against the
  existing Play listing. Do not create a new app or random replacement key.
- **Stale interface or backend check fails:** build from current `main`, rerun
  `npm run cap:sync`, and verify the generated asset manifest. Never bypass the
  backend or source-revision checks.
- **Unsupported Java class version:** select JDK 21 for this Gradle project.
- **Play publishing credential absent:** leave automatic upload off; download
  the signed artifact and upload it to the existing track in Play Console.

## Native push configuration

The Android project includes Firebase initialization, the Google Services plugin,
`android/app/google-services.json`, and native notification registration in
`src/lib/push.ts`. Native FCM tokens use `device_tokens`; browser push subscriptions
use `push_subscriptions`. Both are sent by the `push-send` edge function.

Server delivery also requires the correct Firebase service-account credential in
Supabase's `FCM_SERVICE_ACCOUNT_JSON` secret. A successful Android build does not
prove delivery: test permission, token registration, receipt, and account changes
on the closed beta. Keep service-account private keys out of the repository.
