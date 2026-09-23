# Mobile sign-in callback and loading recovery

The user reported perpetual loading, followed by “both auth code and code verifier should be non-empty,” and then successfully entered the app. This focused release is based on production main and does not include the pending assessment/MFA backend changes.

## Cause and correction

The configured Supabase PKCE client already exchanges callback codes during initialization. App.tsx independently called exchangeCodeForSession for the same code, after the SDK had consumed the verifier. A test using the installed Supabase SDK and a local mock Auth endpoint reproduces the exact reported message on the second exchange. The corrected flow waits for SDK initialization and confirms its session, issuing only one exchange. Explicit-token email links still use setSession validation. Password recovery retains its separate handler. A callback missing its verifier cannot fall back to another account's existing session.

Callback handling is shared across StrictMode effect replays and applies navigation once. Auth event listeners no longer race callback/form navigation. Auth parameters are removed on both success and failure; ordinary query parameters and fragment links remain intact. Failure displays an actionable sign-in recovery screen and retains the intended return destination.

Session restoration and profile hydration previously had no deadline. Both now stop waiting after 15 seconds and provide Retry connection and Reload PULSE. Timeouts do not delete authentication storage or pretend a transport failure is an invalid login. The homepage uses the same app-wide session check. The sign-in form's initial session check also stops waiting on a hung request.

## Verification

- 45 focused tests pass, including the actual SDK regression, callback validation/cleanup, password recovery, auth storage and transient errors. All services in these tests are local mocks.
- Full local run: 1,302 passed, four existing Windows SQL newline contract failures, 32 skipped and 10 todo. All 24 tests in the affected contract file pass with the SQL's committed LF line endings. The migration itself is unchanged. CI now runs the full suite before the build.
- The production build passes. Focused lint has no errors; existing Auth hook and preview fast-refresh warnings remain.
- The TypeScript check retains unrelated preexisting errors on main; this hotfix does not claim a clean repository-wide typecheck. No diagnostics remain in the modified authentication files.
- Browser checks use the real AuthStateProvider/AuthGuard under StrictMode. Both a never-resolving getSession and a never-resolving profile query show a recovery screen after the deadline; restoring the mock connection and retrying loads player information.
- Physical-device sign-in and the installed app version were not inspected. Web/PWA delivery and a packaged Capacitor app are distinct: a bundled native app needs a separately built store release. This change does not claim to update an installed store binary.

## Release

The user explicitly requested publication. Publish this frontend-only fix through the existing GitHub/Firebase release pipeline after CI succeeds. No database migration or new credential is needed. Keep the assessment release gated on its separate hosted staging acceptance checks.
