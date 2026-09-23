# Assessment account-verification fixes and independent deployment

22 September 2026. Implemented locally on `codex/assessment-evidence`; not published or applied to production.

## User-facing outcome

- Anyone can still take the assessment and read its entire analysis without signing in. Creating an account preserves the report.
- An account with verification enabled must complete it before saving. Password sign-in, OAuth return, refresh and cached profile hydration all consult server session assurance.
- Cancellation signs out only this device and preserves guest answers. Invalid codes, unavailable verification, expired sessions, timeouts and account changes provide recovery without falsely confirming a save.
- Verification email uses the PULSE heartbeat logo, gold/ink/cream colors, accessible HTML and a plain-text alternative. Sender and reply-to are `support@pulsepb.com`. The existing Outlook inbox stays in place; automated delivery uses Resend.
- Storage denial no longer throws while importing the real Supabase client on a public page. A page-only memory fallback supports password sessions; OAuth/confirmation transfer still needs durable browser storage, and the assessment explains that constraint.
- Stay-signed-in changes choose the intended store and remove the stale authentication copy from the other store.
- PULSE Self-Assessed Level remains independent of DUPR and separate from match-based PULSE Performance Rating. This work does not change scoring weights or claim empirical calibration.

## Server enforcement

`20260922200000_enforce_session_mfa.sql` adds a private verification schema, a caller-scoped status function and restrictive policies for existing public tables, Storage objects and Realtime messages. A PostgREST pre-request guard also covers security-definer functions/views through the Data API. Existing authorization remains necessary after verification. The migration refuses to replace an existing unrelated pre-request hook.

Native authenticator verification uses actual verified Supabase factors and an `aal2` JWT, rather than an editable profile label. Email protection uses a separate proof bound to the authenticated user, live session and verified account email for 12 hours. It does **not** manufacture `aal2`. Code issuance uses cryptographic randomness and stores a challenge-specific SHA-256 hash, never the plaintext code. Codes expire after 10 minutes and can be consumed once. Five sends and ten failed attempts per 10-minute account window are enforced with locked database state across instances and sessions.

Send/verify handlers validate the exact caller JWT through the status RPC. The database selects the recipient; body-supplied user/session/email values are not authoritative. Bodies are bounded to 1 KiB. Provider failures invalidate the unsent challenge. Email enrollment is committed only after a valid code. Legacy public minting/verification RPCs and code-table access are revoked.

All 18 direct user-authenticated Edge handlers receive caller-MFA checks, including assessment claim/completion, account deletion and administrative operations. Shared payment authentication also checks assurance and matching user identity. Server jobs/webhooks retain their separate service authentication. Coverage tests detect unguarded direct `auth.getUser()` handlers; behavior tests exercise the shared handlers and actual production SQL.

Scope limits matter: custom email verification protects application data/API access, not every operation in Supabase's hosted Auth API. Native authenticator MFA provides stronger protection for account changes. Public resources remain public, and existing Realtime channels need provider-level expiry/reconnect checks in staging. Run the policy coverage query when adding tables; future schemas/tables are not automatically covered by this migration.

## Independent services and observed live configuration

No Lovable service is required for the runtime or deployment. The intended stack is GitHub Actions → Firebase Hosting, plus PULSE's external Supabase project for auth/database/storage/functions and direct Resend email delivery. Google Maps is used directly for city lookup; Google sign-in is optional, not required for email signup. Outlook can continue receiving support messages without changing mail routing.

Read-only browser checks of the existing Supabase dashboard confirmed:

- Project: **PULSE Pickleball Production**, `rqfqwavhtfwwtmfjnxkx`, in the PULSE Pickleball organization.
- Site URL: `https://pulsepb.com`.
- Callback allowlist includes the apex/www PULSE domain, existing Firebase hosting domains, local development URLs and the mobile callback.
- A Send Email hook is enabled and its displayed endpoint points directly to this Supabase project's `/functions/v1/` endpoint.
- The organization lists one production project and no separate staging project.

A Lovable project-list/database-status lookup was initially read-only. No build, deployment or mutation was performed there. After the user clarified independence, no further Lovable connector work was used. A runtime/deployment regression test now rejects Lovable gateways, credentials, client packages and hosting origins. Historical comments/migration-audit references are not execution dependencies.

## Staging setup and release order

The user created **PULSE Staging**, `svdpujbstxiaunoeqlee`, in the PULSE organization. Its dashboard reports Healthy, in East US (Ohio), with no migrations yet. Its local public client configuration is saved only in ignored `.env.staging.local`; Google/Apple login and the assessment release flag remain off until backend setup and checks complete. The staging build passes. Production remains `rqfqwavhtfwwtmfjnxkx`.

The staging example now contains separate-project placeholders. Vite staging mode rejects missing configuration, production fallback, mismatched URLs and server keys. The earlier example pointed at production, which was unsafe for real signup tests.

After the test project exists:

1. Configure the independent test backend and a Firebase preview/local frontend using `.env.staging.local`. Keep production users/data separate. Configure its exact callback origin and direct PULSE email delivery without copying production Auth users.
2. Use `scripts/deploy-supabase-staging.mjs` (read-only plan by default; explicit `--apply`) with `PULSE_STAGING_PROJECT_REF=svdpujbstxiaunoeqlee` and a staging-scoped `SUPABASE_ACCESS_TOKEN`. Historical migrations contain production endpoint literals: the staging runner binds them to staging and disables cron jobs in each migration transaction before commit. It rejects unknown external Supabase origins and production targets. Do not replay the unmodified production bootstrap against a test project. Deploy the new send/verify functions and every modified user-authenticated function (including `payments` and `auth-email-hook`). Configure email confirmation and the direct email hook. This is a coordinated database/functions/frontend release: the legacy MFA wire format is incompatible with the new challenge-ID flow.
3. Run `scripts/check-session-mfa-readiness.sql`. Verify the pre-request hook is active in the deployed Data API, role grants are closed, table policies cover every intended table and there are no stranded SMS/authenticator preferences. Resolve stale preferences through authenticated account recovery.
4. Exercise real signup/confirmation, password sign-in, authenticator enrollment/verification/disable, email enrollment/verification/disable, enabled OAuth callbacks, refresh/logout and expiry. Attempt direct Data API, GraphQL, Storage, Realtime and user Edge requests before/after verification. Check private responses as well as status codes.
5. Complete a guest report, save after confirmation in the same/second tab, retry after a dropped response, reject cross-account claims and reopen the one saved report on another device. Confirmation opened on a different browser must explain that the original browser holds the answers.
6. Verify Resend sender-domain status and actual delivery to Outlook, including SPF/DKIM results. Check the branded email on mobile and Outlook; browser rendering is not an email-client delivery test.
7. Only after these checks, coordinate production deployment of the migrations, functions and frontend. The SQL tests use PGlite and do not establish that a hosted gateway, provider or production policy deployment is correct.

The assessment score still needs independent coach-observation calibration before accuracy claims. Follow the blinded/held-out validation plan in the preceding assessment review; do not use DUPR as a conversion target.

## Validation and build cleanup

- Full Vitest run: **1,380 passed**, 32 skipped, 10 todo. Later added coverage/storage/staging/independence checks passed separately (19 + 6 + 2).
- Application TypeScript check passes. Existing schema declarations were aligned with the already-present pool-play and chat-edit migrations; incomplete realtime comment inserts now trigger refetch; the dashboard/tutorial and preview tab types are corrected.
- The round-robin summary now derives unused courts from actual capacity in both shared copies. Its existing test verifies the user-facing explanation. Four Windows-only SQL contract-test failures were fixed by normalizing CRLF in test input without changing the SQL.
- Production Vite build passes; existing chunk-size/Browserslist/Tailwind warnings remain. New/rewritten authentication, storage and assessment code passes targeted ESLint. Older Edge handlers have pre-existing lint debt; a whole-repository lint pass is not claimed.
- CI now runs a real TypeScript check and regression tests separately from Vite. Vite's transpilation alone is not a typecheck.
- Browser: full guest analysis before signup; actual Auth state provider with isolated backend adapter; pending MFA across reload; wrong code; cancel/sign-out; retry; successful verification → saved analysis. The preview never contacts a real auth service.
- Branded email HTML was visually inspected in the browser. No real signup, outgoing email, OAuth login, migration, function deployment or production write was performed in this pass.

Local email preview: `docs/reports/artifacts/pulse-verification-email.html` (illustrative code `123456`).

## Follow-up after staging creation

- Fixed `verify-supabase-staging.mjs`: it was still pinned to the former migration destination, now production. The fixture runner now requires the explicitly approved new staging project and verifies both JWT key roles/project claims before creating a client. It cannot target production or the retired backend.
- Fixed the auth email hook's confirmation links. `email_data.site_url` is a frontend URL; verification must use `SUPABASE_URL` at `/auth/v1/verify`, with the nested assessment return path retained in `redirect_to`. Missing token hashes now fail instead of sending a non-verifying website link. This follows the [official Supabase email-hook example](https://supabase.com/docs/guides/functions/examples/auth-send-email-hook-react-email-resend). The shared URL builder is used by the real hook and tested for all six supported message types.
- Additional tests pass: 3 staging destination guards, 9 email-link cases, 5 staging migration preparation checks. The latter prepares every repository migration and verifies that plan mode does not initialize history or write SQL. Focused ESLint and a real staging Vite build pass. These do not establish successful hosted migration replay or email delivery.
- A 24-hour token named **PULSE staging assessment setup** was created with access limited to the staging project and the reviewed deployment permissions. No secret value was printed or saved to a file. Its in-memory helper initially lacked network permission; restarting the helper with approved network access cleared the token. The dashboard reports it as never used. Replacement was blocked by automatic review because an additional credential was not explicitly authorized. Approval to revoke and replace the unused token is pending; do not create duplicates or reuse production credentials.
- The user authorized pushing and publishing once the checks pass. The release branch is current with `origin/main` and has no merge conflict. Push/review can proceed, but production publication remains gated on hosted migration, signup, confirmation-email and guest-save checks. No migrations, provider emails, or production changes have been made in this staging setup.
