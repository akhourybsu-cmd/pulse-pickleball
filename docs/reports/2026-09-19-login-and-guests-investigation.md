# PULSE login and guest-match investigation

Investigated September 19, 2026. No production changes were made during the initial investigation. The user subsequently authorized deployment; release preflight results are recorded below.

## Login: confirmed live deployment regression

The live web build calls the retired Supabase project `ryxklkayezjnwwunuphn`, whose hostname no longer resolves. The active backend is `rqfqwavhtfwwtmfjnxkx`.

Evidence:

- On `https://pulsepb.com/auth`, submitting a deliberately nonexistent test account reproduced **Failed to fetch**, with `AuthRetryableFetchError` from `signInWithPassword`. The biometric availability request also failed to reach its Edge Function.
- The live HTML loaded `/assets/index-DCjkizYE.js`. That public bundle contains `https://ryxklkayezjnwwunuphn.supabase.co` and does not contain the current project ID.
- DNS lookup of the retired hostname returned **No such host is known**. The current hostname resolved normally.
- The current backend's `/auth/v1/health` and `/auth/v1/settings` both returned HTTP 200 with the existing public client key. Password and Google authentication are enabled. The password endpoint's browser preflight returned HTTP 200 with the required headers allowed.
- GitHub `main` also contains the retired backend in `.env`. Commit [`bb0b44cf`](https://github.com/akhourybsu-cmd/pulse-pickleball/commit/bb0b44cfe5fc028701bd1cd02d68bfa97c7f8f02), authored by the generator bot on September 17 at 23:36 UTC, replaced the current project ID and URL with the retired values. Commit [`f7d5b8a8`](https://github.com/akhourybsu-cmd/pulse-pickleball/commit/f7d5b8a80472149916bf60255e26ec638af2b8f7), on September 18 at 22:52 UTC, changed `.env` again while retaining the retired backend. The live HTML's Last-Modified header was September 18 at 22:54:11 UTC.
- The Firebase workflow builds directly from checked-in environment files. The local checkout still has the correct `.env`, explaining why local checks can pass while the deployed site fails.

Prepared correction:

- `.env.production` pins the three existing public Supabase client settings to the verified current backend. Production builds use this mode-specific file ahead of generator-managed `.env` values.
- `scripts/validate-supabase-config.mjs`, called by `vite.config.ts` for production builds, rejects a retired/mismatched project, missing key, server credential, or legacy anon JWT issued for a different project. It never prints key values. Opaque publishable-key project ownership cannot be inferred from its text; the actual configured key was checked with the healthy backend.
- The same production build check covers web builds and Capacitor's existing `cap:sync` build command. Installed store versions were not inspected; a native release containing the retired URL would require a newly built app release.
- When merging the fix, also restore GitHub's generic `.env` to the current public settings so development defaults agree. Do not simply rebuild remote `main` with its current faulty configuration.

Vite replaces client environment variables at build time, so changing configuration requires rebuilding and publishing the frontend. [Vite environment documentation](https://vite.dev/guide/env-and-mode)

## Guests: independently reproduced database defect

The regular match wizard creates missing `guest_players` records with `.insert(...).select('id, display_name')`. The SELECT requests SQL `RETURNING`, which must satisfy the table's SELECT policy.

Migration `20260910280000_optimize_guest_players_rls.sql` replaced the direct ownership SELECT path with `can_view_guest_player(id)`. That STABLE helper looks the guest up in the same table. During insertion, its statement snapshot cannot see the newly inserted row. The SELECT policy consequently rejects the result with **new row violates row-level security policy for table "guest_players"**. PostgreSQL documents that STABLE functions do not see changes made by the calling statement. [PostgreSQL function visibility](https://www.postgresql.org/docs/current/xfunc-volatility.html)

This explains why adding a guest in **My Guests** can work while creating a new guest during **match submission** fails: My Guests does not request RETURNING. Existing guest reuse does not take that creation path. The live backend-address outage separately blocks guest network requests too.

Reproduction and fix:

- A local PostgreSQL-compatible PGlite test applies the actual RLS migration and runs as `authenticated`, rather than the database owner. Three cases failed before the fix: creator insert with RETURNING, batch insert with a PostgREST-style CTE, and group moderator insert with RETURNING. Four existing access-boundary cases passed.
- New migration `20260922120000_guest_insert_returning_visibility.sql` adds an authenticated SELECT policy that checks ownership/group management using the candidate row's `created_by` and `group_id`. It preserves the existing RR/kiosk policy, write checks, and role grants. It does not disable RLS or grant general guest access.
- All seven guest tests pass with the new migration, including private-guest isolation, unauthorized creation rejection, anonymous kiosk visibility, and returned guest IDs usable as match-participant foreign keys. Reapplying the new migration also succeeds.
- The initial investigation did not retrieve live policy definitions. During deployment preflight, the production SQL editor confirmed the same STABLE helper definitions and INSERT/SELECT policies. The separate private_sandbox_group_id policy is RESTRICTIVE and remains in place. No production insertion was attempted during this audit.

Additional guest interface observations: the Add Player sheet searches registered profiles and currently does not render its supplied guest callback. The separate Add Guest button above the teams opens the guest dialog. That dialog shows only the ten most recent owned guests, and selecting a recent guest retains its name rather than its ID; duplicate names can therefore select an unintended saved guest. These interface/identity issues were investigated but not changed in this patch.

## Validation

- Before the SQL fix: guest regression suite **3 failed / 4 passed**, with the expected RLS errors.
- After the fix: targeted auth, production-config, and guest suites **26 passed**.
- Full suite: **103 files passed, 3 skipped; 1,290 tests passed, 32 skipped, 10 todo**. Command: `npm test -- --maxWorkers=2`. Skipped live integration tests are not counted as passing.
- `npm run build`: succeeded, 4,722 modules. Existing bundle-size, Browserslist, Tailwind class, and mixed-import warnings remain. The build initially hit a sandbox filesystem restriction; the permitted local rerun succeeded.
- Rebuilt JS contains the current Supabase URL only.
- Browser check against the rebuilt frontend at `http://127.0.0.1:4173/auth`: the same nonexistent account returned **Invalid login credentials**, proving the request reached the healthy authentication service. This does not establish successful real-account login, MFA, or native-device behavior.
- The existing venue/reservation working changes were preserved. The local build includes those changes and must not be published as the isolated incident fix.

## Rollout

1. Prepare an isolated change from current remote `main` containing only the production environment correction/guard, new guest migration, and associated tests/report. Restore the generic `.env` public settings as noted above. Preserve the existing uncommitted venue/reservation work separately.
2. Build that isolated source and confirm it contains only the current backend URL. Publish the corrected frontend through the Firebase workflow, then verify the deployed bundle and login request.
3. Inspect the current target guest policies/migration history. Apply only the new guest visibility migration if the installed policy matches the reproduced defect; avoid blindly applying unrelated pending migrations.
4. With an authorized test account, verify successful password sign-in, Google return, adding a new guest during a casual match, reusing an existing guest, and My Guests creation. Keep guest matches unrated under the existing rules. Do not send real match invitations merely to test the fix.
5. Address the guest-picker and stable guest-ID observations in a focused UI follow-up if users' remaining reports concern selection rather than saving.

Deployment was separately authorized by the user on September 19. See the release preflight below; deployment completion still requires successful production workflow results and live verification.

## Authorized release preflight

- Release branch: `codex/login-guest-production-fix`, based on remote main `b33786ece5f7c453e7dddb9c7d273c6e7e5d23d3`, in a separate checkout. Unrelated venue/reservation changes are excluded.
- Production audit workflow [35468520319](https://github.com/akhourybsu-cmd/pulse-pickleball/actions/runs/35468520319) passed: **437 local migrations, 437 recorded, 0 pending**, and write capability verified in a rolled-back transaction.
- The new migration uses version `20260922120000`, following all installed migrations. The originally prepared timestamp collided with an existing platform-admin migration; the release preflight corrected it. All **438** local migration versions are unique.
- The production guest table has no INSERT triggers; its one non-internal trigger updates timestamps on UPDATE. The additional private-sandbox restriction is retained.
- Isolated release: **102 test files passed, 3 skipped; 1,271 tests passed, 32 skipped, 10 todo**. The initial concurrent test/build run hit one PGlite timeout and four text-contract failures caused by Windows CRLF checkout conversion. Restoring the existing SQL file's committed LF format (no committed source change) and running tests separately passed the complete suite.
- Migration-runner tests: **10 passed**.
- Production build succeeded with **4,720 modules**. Entry asset `/assets/index-D5qAWSDj.js` contains the current backend URL and excludes the retired URL. Existing build warnings remain.
- Successful real-account login, native app behavior, and a complete one-off match submission remain separate acceptance checks. Round Robins are unverified.