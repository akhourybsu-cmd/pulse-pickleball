# PULSE platform administration and venue control — September 14, 2026

Status: backend deployed and transactionally verified in production; frontend publication in progress. Android Studio and Google Play are unchanged.

## Implemented scope

- A platform-first dashboard: pending approvals, applications waiting for information, venues needing verification, venue directory and recent platform decisions.
- Persistent desktop sidebar and a bounded mobile drawer. PULSE typography, clear hierarchy, large touch targets and responsive review forms.
- Searchable, server-paginated venue directory with Free community, Court Booking, Facility Tools and Both features. These labels describe existing capabilities, not new commercial products.
- Included feature grants/removals, optional expiry, mandatory reason, before/after review, explicit acknowledgment, audit history and a generic owner notification.
- Paid subscriptions are read-only in these controls. Admin grants do not charge, refund, change Stripe accounts, cancel subscriptions or change venue ownership, staff, posts, existing events or bookings.
- Stale access snapshots reject edits. Database locks serialize grants with new real feature/rental checkouts. Pending real rental checkout blocks removal of Court Booking. Existing subscription access cannot be overwritten or canceled through an included grant.
- Platform decisions have a read-only activity page. Individual applications expose their review history and distinguish new venue approval from re-verification.
- The sole superadmin may review their own venue request with explicit self-review disclosure. History and audit records distinguish it from third-party verification. Genuine evidence, reviewer note, duplicate detection and atomic approval remain required.

## Sole-superadmin migration

The complete migration resolves exactly one confirmed `akhourybsu@gmail.com` account, then binds platform authority to that account's UUID. An editable profile email cannot grant access.

The migration preserves/creates that account's existing `admin` assignment, records the former admin UUIDs, and removes **only other platform-admin assignments**. It does not delete users or alter venue staff, membership or league-manager roles. Browser role writes are revoked; a database trigger prevents promotion of another platform admin or reassignment/removal of the designated admin. Controlled database maintenance would be required to change this identity later.

If the confirmed target account cannot be resolved uniquely, the entire transaction fails without applying changes. Private samples remain non-commercial and their included features are locked. The directory cannot expose another owner's private sample.

## Archived, not deleted

The old session-centric dashboard is retained at `/admin/legacy-tools`. Sessions, auto-pairing, check-in, kiosk, sign-up QR and rating maintenance are no longer the platform home. Legacy rating recalculation now asks for explicit confirmation, and the old dead-end Live Session link goes to the session directory.

Biometrics diagnostics, test accounts, password support, badges and marketing are grouped in the archive. Existing routes and data remain. Feature-flagged tournament tools remain hidden while disabled. Current player leagues and venue operations were not removed or refactored.

## Verification

- Final full suite: **1,195 passed**, 32 skipped, 10 todo; 93 passed test files, 3 skipped. Includes all 24 new platform-admin database/UI tests, including the final rental-checkout guard.
- New tests cover account pinning, bootstrap rollback, email changes, forbidden role writes, non-admin/anonymous denial, audit privacy, grants/revocation, expiry, stale snapshots, Stripe locks, pending rental safeguards, sample privacy, directory filters, self-review and UI access gating.
- Production build passed: 4,710 modules. Existing Browserslist, duration-utility, import and bundle-size warnings remain.
- Focused ESLint passed for the new and refactored admin core. A repository TypeScript check is not a clean overall baseline; its filtered output contained no diagnostics in the changed admin components.
- Browser QA used actual components with local fake records only. The fixture cannot access production; grant simulation changes in-memory fake data.
- Overview, venue directory and access dialog checked at 280, 320, 390, 430, 768, 1024 and 1440px; no horizontal page/dialog overflow in those checked states.
- Long unbroken venue name/email and 125% text checked at 280, 320, 390, 430, 844 and 1440px; the access editor was additionally checked at 280/320px. Approval form checked with 125% text at 280, 320, 390, 430, 768 and 1440px. Light/dark appearance and mobile navigation were visually inspected.
- Simulated grant updated the feature badge; downgrade review described retained bookings and unchanged billing. Final acknowledgment is cleared when selected features, expiry or note changes.
- Production migration assertions confirmed exactly one platform admin bound to the uniquely resolved confirmed account; forbidden browser role/audit writes and anonymous grant execution; successful superadmin overview/directory queries; and signed-out overview rejection.
- In-transaction fingerprints confirmed that venues, module access, venue staff, group membership, private samples, payment settings/accounts, orders and subscriptions stayed unchanged by this release. Any mismatch would have rolled back the migration. No row data or credentials were exported to the deployment log.
- After adding the release assertions, all 24 targeted database/UI tests and all 10 migration-runner tests passed again.
- Real multi-session concurrency, authenticated hosted approval/grant mutations and installed-PWA behavior have not been tested in this turn.

## Production release evidence

- Backend commit: `af0a0f4b68f392b440c7c4788a5d49ea54f68988`.
- [Supabase deployment 34904567315](https://github.com/akhourybsu-cmd/pulse-pickleball/actions/runs/34904567315): successful against `rqfqwavhtfwwtmfjnxkx` on September 14, 2026. The audit reported **436 local, 435 recorded, 1 pending** and applied only `20260922100000_platform_admin_venue_control.sql`. Edge Function deployment was correctly skipped.
- Frontend deployment and public asset verification: pending.

## Complete copy/paste SQL and release order

File: `supabase/migrations/20260922100000_platform_admin_venue_control.sql`.

The file contains the **entire** transactional migration, including BEGIN and COMMIT, and no placeholder credentials. Copy the complete file rather than an excerpt. The existing migration runner records versions and should be preferred to manual replay.

1. Completed: production target and migration history checked by the existing workflow. Unique confirmed account resolution and role reconciliation were verified transactionally. No backup/restore exercise was performed.
2. Completed: the backend-only commit deployed successfully before frontend publication, including the live access and unchanged-record assertions above.
3. Pending: publish the web/PWA through the Firebase main-branch workflow, then verify the public admin route and release assets.
4. Remaining acceptance: while signed into the hosted portal, verify pending/waiting filters, directory search, audit privacy and the owner notification. Use a verified disposable non-commercial test venue for grant/revoke acceptance. Do not remove Pickleball Palace sample access or change ELEVENO's tier without a specific request.
5. Completed: no subscription, checkout payment, payout destination or venue operational data was changed by the migration. No native Android release is needed.

Local QA: `npm exec vite -- --config tests/admin/browser/vite.config.ts --host 127.0.0.1 --port 8091 --strictPort`, then `/tests/admin/browser/index.html`. Optional `?page=/admin/venues&long&large-text`, `?page=/admin/venue-requests&large-text`, or `?error`.
