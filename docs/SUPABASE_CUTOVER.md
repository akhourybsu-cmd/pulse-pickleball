# Supabase cutover runbook

This runbook moves PULSE from Lovable Cloud project
`ryxklkayezjnwwunuphn` to Supabase project `rqfqwavhtfwwtmfjnxkx`.
Do not reduce, pause, or remove the Lovable backend until the post-cutover
checks pass.

## Current staging state

- Schema and migration history are installed on the destination.
- 142 public tables, 6,122 source public rows, 157 auth users, and 160 auth
  identities were imported.
- The ELEVENO reconciliation adds one intentional `venue_staff` row, so the
  validated destination total is 6,123 public rows.
- All 29 storage objects were copied and verified byte-for-byte.
- Stored Lovable asset and preview URLs were rewritten to the destination
  Supabase project and `https://pulsepb.com`.
- ELEVENO's venue, official community, and staff owner is Dhruv Patel. Alex
  Khoury remains an active venue manager and community moderator.
- The rollback-only restore rehearsal passes with no foreign-key orphans and
  no remaining Lovable origins.
- A destination-specific VAPID key pair is installed. The staging client uses
  its public key and detects/replaces subscriptions created with the legacy
  key, so the five imported browser subscriptions can recover cleanly.
- Google OAuth is configured on the `PULSE Pickleball` Google Cloud project,
  connected to the destination Supabase callback, and published for external
  users. The staging Google sign-in button is enabled, and a complete OAuth
  sign-in returned the imported Alex Khoury account to `/player/dashboard`.
- Google Cloud project `pulse-pickleball-c60e1` is linked to the existing
  `My Billing Account 1` account, and Places API (New) is enabled. The dedicated
  `PULSE Supabase Places` key is restricted to that API and installed as the
  destination's `GOOGLE_MAPS_API_KEY` secret. Authenticated staging city search
  and place details passed for Boston, MA and Toronto, ON, CA; no profile
  changes were saved during these tests.
- `npm run test` passes 469 tests (32 skipped, 10 todo); the latest
  `npm run build:staging` succeeds with 4,639 modules. Existing bundle-size,
  Browserslist, animation-class, and mixed-import warnings remain.
- The September 3 staging check pass repaired two runtime database blockers:
  mismatched/duplicate community audit triggers, and chat edits silently
  failing RLS. Migrations `20260910170000` and `20260910180000` are applied and
  recorded in destination migration history. The chat client now uses the
  author-only `edit_group_message` RPC with a server-generated edit timestamp.
- Privileged email functions now validate configured server credentials rather
  than trusting a decoded role claim or accepting the public anon key. Both
  email functions were deployed. `send-transactional-email` and `push-send`
  explicitly disable the gateway JWT check because their handlers enforce
  server-key / dispatch-secret authorization respectively.
- The final isolated integration run passed 20 checks with zero failures.
  One direct secret-key test was skipped in the CLI runner and independently
  passed in the Supabase dashboard; a temporary signed-in-only probe also
  verified the actual Edge Function-to-email call using its managed server key.
  The temporary probe deployment has been deleted.
- Fresh integrity checks: 322 foreign keys without orphan rows, 479 text/JSON
  columns without legacy origins, and all 29 stored objects still match the
  original bytes and SHA-256 hashes. Auth remains 157 users / 160 identities.
  Temporary accounts, venues, communities, messages, posts, programs, court
  holds, friendships, audit rows, and uploaded fixture objects were removed.
- Production frontend configuration has not been changed.

## September 3 verification results

| Check | Evidence / limitation |
| --- | --- |
| Google login and Places | Imported Alex account signed in; Boston and Toronto search/details passed |
| Password authentication | Imported account login, real recovery email, password reset, and login with the reset password passed with the account holder |
| ELEVENO UI | Home, courts, programs, feed, chat, roster and manager entry points loaded; Dhruv displays as owner, Alex as manager/moderator according to context |
| Venue image | Destination-hosted 512×512 logo loaded; desktop page width 1,265px within a 1,280px viewport |
| Ownership | Temporary venue transfer changed venue owner, community roles and staff roles atomically; retained settings; new owner could edit venue; previous owner could no longer transfer |
| Settings audit | Authenticated community settings save created exactly one canonical audit entry |
| Programs / courts | Two-court program holds, overlap rejection, capacity-based waitlisting, automatic promotion, and court release on parent deletion passed |
| Venue posts | Authenticated creation, shared read, edit and deletion passed |
| Chat | Three successive venue messages and three DMs delivered on persistent subscriptions; replies, edits and shared history passed; non-author edit and non-friend DM attempts were rejected |
| Uploads | Authenticated PNG upload, byte-identical public download and removal passed in all seven buckets |
| Email authorization | Forged service-role claim and public-key sender rejected; dashboard secret and actual internal server caller reached empty-body validation; no mail sent |
| Scheduled processing | Five jobs active; 78 scheduled HTTP responses succeeded in the audited hour; both email queues empty |
| Push dispatch | Fixed gateway rejection of database-secret requests; 26 subsequent synthetic dispatches returned HTTP 200, sent=0, with no real-device endpoints involved |
| Email delivery | Real recovery message accepted by the provider, received in the selected inbox, and used successfully; historical June–August sender-domain failures were imported, not new migration sends |
| Device behavior | Actual web-push receipt, mobile keyboard/scroll behavior and interactive crop adjustment remain device/UI acceptance tests; do not infer these from backend upload checks |

Realtime diagnostic runs initially timed out. One captured trace showed the
second immediate subscribe racing the SDK's disconnect after removal of its
last channel. The final test keeps each chat subscription alive across three
successive messages, matching normal chat use; venue delivery took 1.374s and
the friendship/conversation/DM check took 1.632s in total. This does not establish
offline/reconnect behavior or physical-device reliability; retain those in the
live acceptance checklist. Do not attribute failures to a provider outage
without project-specific evidence.

Repeatable checks live in `scripts/verify-supabase-staging.mjs` and
`scripts/audit-supabase-staging.sql`. The integration runner is pinned to the
destination and requires `--allow-fixtures`. Inject
`PULSE_STAGING_SERVICE_ROLE_KEY` and `PULSE_STAGING_ANON_KEY` only in process
memory. `PULSE_STAGING_SECRET_KEY` is optional: the CLI-returned key failed the
gateway in this session, whereas the dashboard's managed-key request passed.
An explicitly supplied invalid key fails the test; omission reports SKIP,
never PASS. Do not commit credentials or assume the skipped test ran.

For the optional `--verify-nested-email` check, the manual probe source is
`tests/migration/fixtures/migration-email-auth-check.ts`. Deploy it temporarily
under the function name stated in that file, and remove it immediately after
testing. It is deliberately excluded from the deployable functions directory.

The server-key authorization approach follows Supabase's
[authorization-header documentation](https://supabase.com/docs/guides/functions/auth-headers)
and [managed environment-variable documentation](https://supabase.com/docs/guides/functions/secrets).

## Credentials still required

Lovable shows the source secret names but does not expose their values. Create
or retrieve provider-side credentials and install them on the destination.

| Capability | Destination input | Cutover requirement |
| --- | --- | --- |
| Geocoding | `GOOGLE_MAPS_API_KEY` | Configured; authenticated autocomplete and place details verified |
| Stripe API | `STRIPE_SECRET_KEY` | Deferred by the user; required before any paid flow |
| Stripe webhook | `STRIPE_WEBHOOK_SECRET` | Deferred by the user; required before paid-flow cutover |
| Extra league slot | `STRIPE_LEAGUE_SLOT_PRICE_ID` | Deferred by the user; required before enabling that purchase |
| Web push | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_CONTACT` | Configured; authenticated delivery test remains |
| Native push | `FCM_SERVICE_ACCOUNT_JSON` | Optional until native push is launched |
| Simulation tools | `SIM_ADMIN_SECRET` | Optional; test/admin tooling only |
| Google login | Supabase Google provider credentials | Configured, published, and staging sign-in verified |
| Apple login | Supabase Apple provider credentials | Required before setting `VITE_AUTH_APPLE=true` |

Email delivery secrets are already configured on the destination. Supabase's
own URL, publishable key, service key, and database URL are managed by the
destination project and must not be copied from Lovable.

Google Maps billing linkage, Places API (New), the restricted server key, and
authenticated city-picker tests are complete. The key is named
`PULSE Supabase Places` (credential ID
`0c44aea4-46f5-407f-b48e-0fa4f106bacf`). It is not service-account-bound and
grants access only to Places API (New). Its application restriction is `None`
so it can be used by the Supabase server proxy; it is not IP-restricted. Keep
the value only in the destination's `GOOGLE_MAPS_API_KEY` Edge Function secret.
Do not put this server key into a frontend `VITE_*` variable or commit it.
Billing is usage-based on `My Billing Account 1`; this setup did not create a
spending cap, budget alert, or reduced API quota.

Stripe setup is intentionally paused at the user's request. Do not create
Stripe keys, webhooks, products, or prices until the user resumes that work.
This deferral does not make paid flows ready for the destination.

### Install Edge Function secrets

1. Copy `supabase/.env.production-secrets.example` to
   `supabase/.env.production-secrets.local`.
2. Replace every required placeholder. Remove optional lines that are not
   being configured yet.
3. From the repository root, run:

   ```powershell
   npx supabase secrets set `
     --project-ref rqfqwavhtfwwtmfjnxkx `
     --env-file supabase/.env.production-secrets.local
   ```

4. Verify names only; do not print secret values:

   ```powershell
   npx supabase secrets list --project-ref rqfqwavhtfwwtmfjnxkx
   ```

For Stripe, create a webhook endpoint at:

```text
https://rqfqwavhtfwwtmfjnxkx.supabase.co/functions/v1/tournament-stripe-webhook
```

Subscribe it to `checkout.session.completed` and use that endpoint's signing
secret as `STRIPE_WEBHOOK_SECRET`.

## Staging frontend

The ignored `.env.staging.local` points local staging builds at the new
project. Google OAuth is enabled after its completed provider check; Apple
remains disabled.

```powershell
npm run dev:staging
npm run build:staging
```

Use `http://localhost:8080/auth` for the account-holder acceptance tests. The
destination redirect allowlist includes `http://localhost:8080/**`, but not
`http://127.0.0.1:8080/**`; using the latter for reset emails can send the user
back to the production Site URL instead. No redirect settings were changed.

### Ordered final acceptance (in progress)

1. **PASSED September 3.** Existing imported email/password login, real recovery
   email receipt, recovery-link routing, password update and login with the
   reset password all passed for the imported `Testing Test` account. A fresh
   dashboard reload restored its profile, matches, communities and other player
   data without new console errors. The destination `email_send_log` records
   the recovery message at 19:48 UTC as `sent` with no provider error, and
   `auth.users.last_sign_in_at` confirms a later sign-in with a password hash
   present.
2. Physical-phone push receipt, keyboard/scrolling/reconnect and image framing.
   **Deferred by the user to immediate post-cutover acceptance.**
3. Confirm unavailable-payment UI while Stripe remains deferred. **Deferred by
   the user to immediate post-cutover acceptance; Stripe stays unconfigured.**
4. Cutover preparation has begun. A fresh source export was attempted, but the
   Lovable database panel currently reports zero rows for every table while its
   own recent project history identifies a disk-full connection failure. Those
   zeroes are not accepted as source data. The verified September 2 export is
   the current migration snapshot; Lovable's September 3 automatic backup and
   the original backend remain intact for rollback. Production traffic has not
   yet been switched.

The September 3 account-check preparation found that the custom `auth-email`
function generates implicit recovery links while the frontend client uses
PKCE. The installed SDK rejects this mismatch, and the old reset page only
read the resulting missing session. `preparePasswordRecovery` now explicitly
validates/installs the emailed session, waits for SDK-handled PKCE callbacks,
rejects failed/incomplete callbacks without falling back to a previous
account, and removes credentials from the URL. The form stays hidden until
verification finishes. Thirteen new regression tests pass; an expired-link
browser check shows only the invalid-link message, with no password form.
The provider accepted the real recovery message and the account holder
confirmed inbox receipt, completed the reset, and signed back in. These are
frontend changes only; no new SQL migration or remote function deployment was
needed.

The suspected hook URL issue was ruled out: Supabase's hook payload sets
`site_url` from the Auth external host, unlike the email template's frontend
Site URL ([Supabase Auth implementation](https://github.com/supabase/auth/blob/master/internal/api/mail.go)).
The existing hook verification-link host was not changed.

A staging password reset changes only the destination account. The final
fresh auth-data import will restore the then-current source password hash;
do not promise that a staging-only test password persists through cutover.

Test at minimum:

1. Existing email/password login and password reset.
2. ELEVENO player view, member list, chat, posts, events, bookings, and images.
3. Dhruv's owner-only controls and Alex's manager controls.
4. Direct messages and realtime venue chat from two accounts.
5. Image upload, crop/focal point, and destination public URLs.
6. Transactional email and scheduled queue processing.
7. Maps/geocoding after the Google key is installed.
8. Stripe checkout plus webhook completion after Stripe is configured.
9. Web push after the VAPID pair is installed.

Existing browser sessions will not survive the project change because the new
project has a different JWT signing secret. Users will need to sign in again;
their imported password hashes remain available for email/password login.

## Final data sync and production switch

Lovable remains the live writer, so staging is only a point-in-time copy.

1. Announce a short maintenance window and stop writes to the Lovable-backed
   app.
2. Take a fresh database export and storage delta from Lovable.
3. Re-inspect snapshot counts and update the restore guardrails if live data
   changed.
4. Run the restore script without `commit_restore` and require every audit to
   pass.
5. Run the same restore with `-v commit_restore=1` to commit the final snapshot.
6. Re-run storage hashes, ELEVENO authority checks, and Supabase advisors.
   Keep migrations `20260910170000` and `20260910180000` installed; a data-only
   refresh preserves them, but rebuilding the schema from the source dump
   requires reapplying destination migrations before app use.
7. Change production frontend variables to the destination project URL and
   publishable key. Set OAuth flags only for configured providers.
8. Deploy, then execute the staging checklist against `https://pulsepb.com`.
9. Monitor Auth, Postgres, Edge Function, Realtime, and Stripe webhook logs.
10. Keep Lovable available for rollback until the observation window passes;
    only then reduce its cloud usage or plan.

## Accepted security debt

Supabase currently reports one Security Advisor error for
`public.profiles_public`. It is intentionally a security-definer view limited
to authenticated callers and a curated non-PII column set. The app relies on
it for cross-player display names across matches, venue rosters, chat, and
leagues. Replacing it safely requires a dedicated authorization/API redesign,
not a cutover-time option flip.

The inherited schema also reports 443 warnings, primarily legacy functions
without a fixed `search_path`, plus extensions installed in `public`. Treat
that as a separate hardening project; bulk-changing hundreds of function
execution contexts during cutover would add unacceptable regression risk.
