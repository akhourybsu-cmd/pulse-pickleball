# Public venue and community access

Implemented on `codex/public-venue-access` in the `pulse-public-venues` worktree, based on locally available `origin/main` (`df3eac9d`). Production has not been changed.

## Guest experience

- `/player/community` is a searchable public directory for guests.
- Existing `/player/community/group/:groupId` links now show public community information before sign-in. Authenticated visitors retain the existing community and facility pages.
- Published, active venues with public communities also have `/venues/:slug` addresses using their existing unique venue slug. The venue profile editor displays that address with copy/open controls.
- Guests can browse introductions, branding, location, venue websites, court details and community size. Account prompts explain what an account unlocks and let visitors keep browsing.
- Joining, booking, events, posts and chat lead to the signup/sign-in choice. Booking is advertised only when the venue has an active booking module. Calendars, availability, messages, posts and member identities are not loaded by the guest page.
- Unlisted and private communities retain their existing membership/invitation access rules. Their invite-code landing pages still provide an invitation preview. Private samples and unpublished/inactive venues are excluded from public pages and search.

## Account continuity

Both account choices carry the exact local path, query and fragment. Signup and OAuth callbacks carry the destination in the URL, with browser storage as a fallback. Competing auth listeners retain the handoff until the destination acknowledges arrival. Venue slug routes resolve to the existing community page with the same tab/query/fragment after authentication.

Confirmation opened in a different browser can require password sign-in because PULSE uses PKCE. The failure recovery keeps the destination, and the confirmation message explains that next step. No PKCE or MFA protection is bypassed. The invite-code signup action now uses `mode=signup`, correcting its prior `tab=signup` mismatch.

## Data and release order

Apply `supabase/migrations/20260928100000_public_community_pages.sql` and `20260928110000_venue_address_integrations.sql`, then deploy the `venue-integrations` Edge Function before releasing the frontend. The public read RPCs return an explicit field projection; they add no raw-table or mutation grants for guests. Existing RLS and authenticated participation rules remain in place. Search is bounded to 24 results with deterministic pagination.

Use the normal backup/migration/release process. Verify the Supabase redirect allow-list includes `https://pulsepb.com/auth**` (the existing `https://pulsepb.com/**` entry also covers it). Confirm with a real test-account email and OAuth on staging; local fixtures do not validate the deployed provider configuration or email delivery.

## Venue subdomains

The app recognizes a single venue label such as `pickleball-palace.pulsepb.com` and forwards it to `https://pulsepb.com/venues/pickleball-palace`, preserving query and fragment. Authentication stays on the primary domain, where existing account sessions live. Reserved service names (`www`, `auth`, `api`, etc.) are excluded. Staging builds are blocked on production subdomains.

The address opens the existing venue page on the primary domain. Venue settings → Integrations now offers availability checking, a persistent reservation, setup status, refresh and copying. The profile also links to setup. Active, verified venue owners/managers can reserve one permanent name; samples cannot. Names are validated on the server, platform names are reserved, and collisions are checked against both canonical venue slugs and reservations. A shared transaction lock and a venue-slug trigger close the concurrent-claim race. Deleted venues retain a reservation tombstone so an old shared address cannot be assigned to another venue. Existing canonical URLs continue working; reserved aliases resolve through the same public projection and privacy checks.

The venue owner does not need Firebase or DNS access. The PULSE admin's Venues page has an address-request queue and setup dialog. Its Connect hosting / Check hosting actions call the Firebase Hosting REST API through an authenticated, MFA-checked, platform-superadmin-only Edge Function. It reads before creating, tolerates duplicate/asynchronous creation, displays Firebase's required DNS records, and records each completed provider check in the platform audit log. Checks have leases/cooldowns and stale-result rejection. Only service RPCs can change provider state; managers cannot mark their own address connected. Provider details and errors are limited to platform admins.

“Connected” requires active hosting, ownership and certificate states, with no pending DNS actions or provider issues. Pending addresses are plain text rather than share links. Privacy/publication readiness is independent: the UI requires the venue page to be public before offering the new share link. No privacy setting is silently changed. The owner sees friendly next-step copy and can use the existing venue link during setup. Provider checks are manually initiated by PULSE admins; open owner/admin views refresh stored status every 30 seconds. No background domain monitor is installed.

### One-time platform configuration and rollout

1. The production release bootstraps the server-only `FIREBASE_HOSTING_SERVICE_ACCOUNT_JSON` Supabase secret from the existing PULSE Firebase deployment credential when the integration secret is absent. A separately configured or rotated integration credential is preserved. The setup script validates both project identities and the key, never logs secret values or provider response bodies, and runs only for production apply/function releases. A service account must be authorized to get/create Firebase Hosting custom domains in project/site `pulse-pickleball-c60e1`. The provider adapter rejects other projects and requests only the `firebase.hosting` OAuth scope. Never place this credential in a frontend/VITE variable.
2. Deploy the two migrations, Edge Function and frontend through the existing release workflow. Backend/provider credentials and production data were not changed in this task.
3. From a verified venue's Integrations tab, reserve a name. In PULSE admin → Venues → Venue address requests, connect hosting. Apply the exact ADD/REMOVE records shown by Firebase at the DNS provider controlling `pulsepb.com`; review parent/shared records before editing. No DNS-provider credentials or API are assumed by this implementation.
4. Recheck hosting after propagation. Once connected, verify the actual HTTPS subdomain opens the expected venue and preserves a guest's signup return destination. Verify this with real staging/test accounts before broader rollout. Local fixture success does not validate live DNS, credentials, quotas, certificate issuance, email delivery or OAuth.

Firebase REST contract: [CustomDomain states and DNS records](https://firebase.google.com/docs/reference/hosting/rest/v1beta1/projects.sites.customDomains), [create operation and OAuth scopes](https://firebase.google.com/docs/reference/hosting/rest/v1beta1/projects.sites.customDomains/create).

Firebase's [custom-domain documentation](https://firebase.google.com/docs/hosting/custom-domain) supports individual subdomains and recommends no more than 20 subdomains per apex because of certificate minting limits. This initial integration uses managed per-venue provisioning. Broad rollout needs a hosting/DNS capacity decision; a wildcard DNS record alone is insufficient. The Integrations tab and provider adapter are separate from venue profile editing so later integrations can have their own setup and status without rebuilding venue settings.

## Verification

- Venue/auth regression coverage: 55 files, 632 tests verified, including guest UI, privacy, callbacks, address reservation/access controls, provider failures and signed service-account token exchange. The broad run exposed an Edge Function MFA-guard naming convention (fixed) and one existing 5-second database-test timeout under parallel build load; both affected suites passed when rerun with two workers. The final provider adapter suite also passed after its token-exchange test was added.
- TypeScript application and provider/handler checks, lint on the new integration/guest implementation, production build and backend artifact verification passed. Existing bundle-size warnings remain.
- Desktop and 390px browser checks used the real guest pages and Auth form with local data/auth fixtures. Browsing, booking prompts, signup mode, confirmation messaging and the return to the exact booking tab were verified. No live account was created.

Reproduce the isolated browser preview with:

```powershell
node node_modules/vite/bin/vite.js --config tests/venues/guest-browser/vite.config.ts --host 127.0.0.1 --port 4188
```

Open `/tests/venues/guest-browser/index.html` for guest signup, or `/tests/venues/guest-browser/integrations.html` for owner/admin address setup. The latter uses real UI components with a session-storage fixture, explicitly labelled as a local preview. It simulates hosting/DNS states without creating domains. Mobile checks at 390px covered unavailable names, reserving a name, the admin queue and DNS dialog, connected-state sharing and clipboard contents. The signed-in destination on the guest preview is displayed by a fixture; authenticated venue behavior is covered by the existing regression suite. Use synthetic credentials only.
