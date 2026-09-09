# Verified free venue foundation

## Publication handoff

Publication was approved on September 9, 2026. Backend commit `8d1a160f` deployed successfully through Supabase workflow run `34384642106`: 428 local migrations, 427 previously recorded, exactly one applied (`20260917100000_verified_free_venues.sql`). Production project: `rqfqwavhtfwwtmfjnxkx`.

The web/PWA release follows only after that backend success, using the established Firebase main-branch workflow, which repeats the full tests and production build. Its final deployment outcome and live smoke checks are recorded in the publishing task and GitHub Actions. No payment subscription, native Android build, Android Studio configuration, or Google Play release is part of this publication. The Android PWA receives this same web release.

This is the ownership-review and capability foundation, not a completed paid subscription launch.

## Product rules in this draft

- New venues start with the same shared community data and features as ordinary communities: posts/photos, chat, members, invitations, community events/RSVPs/calendar, files, moderation, and notification preferences. Venue identity and branding remain distinct.
- Request → private ownership review → approval → atomic creation of venue, staff owner, official community, and community owner membership.
- The initial verification method is manual PULSE staff review. Applicants supply business details, an HTTPS public business reference, meaningful evidence, business contact information, and authority confirmation. Confirmed PULSE account email is required, but is **not** treated as ownership proof.
- Reviewers must independently confirm authority, check competing claims, and record a note. A reviewer cannot approve their own application. A sole administrator who owns a venue needs another authorized reviewer.
- Owners can track, withdraw, and revise returned requests. Reviewers can approve, ask for information, or decline. History retains previous submissions and decisions. In-app notifications point to the private workflow without including evidence or contact details.
- Public profile creation does not expose the private applicant contact or evidence. The evidence queries are excluded from the existing persisted-cache allowlist.
- Court booking and facility operations are separate optional modules. Ordinary community events and their calendar remain free. Entitlements are server-owned and checked at the court/event write boundaries.
- Existing venue module access is preserved by a one-time migration backfill, including ELEVENO if it is present when applied. Rerunning the migration does not grant add-ons to newly created free venues.
- The historical auto-verification trigger is replaced. Existing automatically issued badges without recorded approval are corrected; communities and tools remain. Ownership transfer clears verification and exposes the re-verification route to the new owner.
- Request submissions/resubmissions are limited to five per account per day. Queue pagination prioritizes the oldest pending requests so resolved/newer requests cannot hide unresolved ones.

The approved foundation uses manual review and preserves existing venue tools. Payment activation remains a separate phase.

## Entry points

- Community → Venue requests, or Create → I'm a venue.
- `/player/venue-requests`: applicant workflow and status.
- `/admin/venue-requests`: platform-admin review queue and decisions.
- Venue settings → Features & verification: free essentials, verification status, and optional modules.
- Venues without modules use the existing full community page with venue branding and venue owner badges. Module-enabled venues retain their facility page and can open all shared community tools from Info.

## Verification performed

- Full Vitest suite: **850 passed**, 32 skipped, 10 todo; 65 passing test files.
- Includes 19 new venue tests covering private RLS reads, unauthorized/direct mutation attempts, atomic ownership creation, confirmed-email/evidence requirements, independent review, revision/withdrawal, stale decisions, competing claims, transfer/re-verification, migration reruns, legacy grants, module expiry, free community event compatibility, notifications, and rate limiting.
- Production web build passed. Android commands were not run.
- Focused ESLint check passed for new venue workflow components/hooks/API helpers, route dispatcher, and SQL test suite.
- Local browser checked the two-step request form at 1280px and 390px widths. Mobile document width stayed within the viewport; PULSE Manrope/Inter typography was used. Step transitions focus the heading and required authority confirmation blocks submission.
- SQL was executed against the local PGlite schema fixture, not the production Supabase instance. Complete live-schema, authenticated admin/applicant, and production smoke checks are still required at release time.
- Repository-wide TypeScript checking has existing errors in tournament, chat/realtime, round-robin, venue query typings, and older preview files. It is not a clean global typecheck baseline.

## Full copy/paste SQL and deployment order

The complete, transactional migration is in:

`supabase/migrations/20260917100000_verified_free_venues.sql`

Copy the **entire file**, including `BEGIN` and `COMMIT`. It contains no placeholder values and does not create any charges. Do not apply a shortened excerpt.

1. Confirm the manual review policy, authorized reviewers, and preservation of existing access.
2. Use the established backup/migration preflight. Apply and verify the SQL **before** deploying the new frontend. Database and hosting run in separate GitHub workflows, so one combined push alone is not an ordering guarantee.
3. Verify existing venue memberships, owner identities, module grants, and the intentionally corrected verification badges.
4. Smoke-test distinct applicant/admin accounts: submit → return → revise → approve → open the free venue. Verify private requests remain inaccessible to unrelated players.
5. Verify ordinary events, files, chat, invitations and moderation on the free venue; verify ELEVENO’s existing court and operations workflows.
6. Publish the frontend and repeat live checks. Do not downgrade Lovable or alter Android as part of this release.

## Next phase: paid add-ons

Not implemented or activated here: actual prices, payment checkout, subscription webhooks, invoices, cancellation/grace-period policy, billing self-service, and paid feature activation. The cards explicitly disclose that pricing/activation is not available yet. There is no simulated checkout or client-side self-grant.

Before monetization, finalize module packaging, currencies/taxes, billing intervals, failed-payment and grandfathering policy, and reviewer/support responsibilities. A trusted billing backend must own module grants/revocations and reconcile webhook retries. Extend capability guards to any newly introduced premium APIs or legacy operational routes before exposing them. Shared community features must not become dependent on a paid subscription.
