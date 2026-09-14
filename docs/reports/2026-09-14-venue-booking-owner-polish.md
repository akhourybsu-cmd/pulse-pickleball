# Venue booking and owner setup pass — September 14, 2026

Status: published to the production web/PWA on September 14, 2026 in source commit `d59bd316fb83920f2adfad7103b5cc2f726f8a41`. No database migration required. [Firebase deployment](https://github.com/akhourybsu-cmd/pulse-pickleball/actions/runs/34899136132) succeeded; the combined release passed 1,171 tests and the production build. Live bundles matched the tested build. See [the branded entrance report](2026-09-14-venue-branded-entrance.md#publication) for publication evidence and verification limits.

## Completed

- Court selection no longer claims to hold availability. The next action explicitly opens a booking review.
- Court buttons identify the full court name, date and venue-local time range. Mobile court chips, view toggles and clear-selection controls have larger touch targets and visible keyboard focus.
- Paid duration choices now include every half-hour from 30 minutes through four hours, limited by closing time or the next occupied slot. The selected grid range remains adjustable. Invalid presets show a recovery prompt and do not request a quote or submit checkout.
- The dialog never labels a pending, refreshing, failed or malformed price response as a free court. Paid quote refreshes do not show an actionable stale total. Paid and free submission paths remain separate.
- Test payments explicitly state that no real money or court reservation is involved. Paid bookings no longer display an unusable free-booking name field.
- Dialog width, long names, policy text, totals and footer actions fit narrow screens. Removed fixed negative date-strip margins that caused horizontal overflow. On phones, the selected-court review action sits below the summary so large text remains readable.
- Owner Stripe guidance distinguishes required submissions, pending review, restrictions, disconnection and ownership review. Technical requirement names are grouped into readable categories; no identity values or Stripe person IDs are displayed. Existing eligibility gates and financial permissions were not changed.

Requirement presentation was checked against the [Stripe Account reference](https://docs.stripe.com/api/accounts/object). Information already pending verification is shown separately from information the owner still needs to provide.

## Verification

- Added booking price/range/consent safeguards, calendar-label tests, malformed-response tests, selection-layout regression coverage, owner requirement presentation and guidance tests.
- Browser QA uses real components with isolated fake Pickleball Palace data. All backend calls and external checkout mutations are blocked by the local fixture. This is not a new live Stripe acceptance test.
- Calendar, booking dialog and owner panel checked at 280, 320, 360, 390, 430, 768, 1024 and 1440px. No horizontal page/dialog overflow in the checked states. The desktop court grid retains its deliberate internal horizontal scroller.
- Additional 125% text checks at 280, 320, 390, 430 and 844px. Visual inspection caught and corrected a squeezed selected-court summary; the final stacked action was verified at 320px with a long unbroken name.
- Browser interaction: select court → review → choose 150 minutes → total $25 → consent → change to 240 minutes → total $40 with consent cleared and payment disabled. An invalid 45-minute paid preset recovered by selecting a valid duration.
- Final full suite: `npm test -- --maxWorkers=2` — 1,158 passed, 32 skipped, 10 todo; 90 passed test files, 3 skipped. Production build: `npm run build` — passed (4,703 modules). Existing Browserslist, ambiguous duration utility and chunk-size/import warnings remain; no new build failure.

Local QA: `npm exec vite -- --config tests/venues/browser/vite.config.ts --host 127.0.0.1 --port 8090 --strictPort`, then `/tests/venues/browser/index.html`. Fixture switches: `?owner`, `?dialog`, `?dialog&invalid`, `?dialog&loading`, `?dialog&price-error`, `?dialog&free`, and `&large-text`.

## Remaining priorities

1. Complete the existing Stripe acceptance matrix before enabling real collections: distinct-venue/account isolation, expiration and interrupted checkout, remaining refund edge cases, event replay/recovery, and installed-PWA return flows. See the existing Stripe launch checklist; this pass does not mark those checks complete.
2. Add owner-dashboard attention summaries for payment requests where appropriate, respecting owner-only financial access rather than exposing financial details to general venue staff.
3. Continue role-based venue acceptance across event creation/edit/cancel, RSVP/waitlist transitions, closures and court changes, staff access changes, ownership transfer, and member-facing calendar/feed consistency.

Live collections, Stripe accounts, venue tiers and production database records were untouched. Pickleball Palace remains private; ELEVENO's free tier is unchanged. Android Studio and Google Play were not changed. The web/PWA release now includes these fixes through the existing deployment workflow.
