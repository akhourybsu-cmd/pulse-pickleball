# Venue experience implementation

The requested release covers player records, walk-ins and guests, memberships and passes,
venue-published waivers, player check-in, waitlist offers, booking rules and rates,
series editing, targeted communications, reporting, coaching, and private events / desk sales.

User decisions: venues supply their own waiver wording; desk collections support Stripe
checkout links / QR codes and recorded cash. No sample customers, fabricated purchases,
or legal wording will be inserted into production.

## Integration requirements

- Existing court allocation and exclusion constraints remain the source of availability.
- Payment amounts, inventory, eligibility, and entitlements are decided on the server.
- Card fulfillment follows verified Stripe outcomes; cash has an attributed ledger.
- Each venue owns its customer records. Notes and contacts are staff-only.
- Public rosters and player-facing check-in show first name and last initial only.
- Every new public table has RLS and the restrictive session-MFA policy.
- Staff can operate the desk; pricing / document publishing require management;
  refunds and Stripe configuration remain owner-only.
- Published waiver versions and acceptance records are immutable.
- Retries must not double-charge, duplicate visits, or consume passes twice.

## Delivery checks

- [x] Player directory, history, private notes and guest records
- [x] Waiver publishing, guest / signed-in acceptance and check-in requirements
- [x] Desk sales, cash reconciliation, Stripe checkout and entitlements
- [x] Walk-in court / event visits and integrated attendance
- [x] Player kiosk and QR check-in with exception handling
- [x] Waitlist offers and deadlines
- [x] Court pricing and booking policies
- [x] Recurring series edits and holiday exceptions
- [x] Targeted notifications and reminder preferences
- [x] Date-range venue reports and exports
- [x] Coaches, availability and lesson bookings
- [x] Private-event quotes, deposits and court blocks
- [ ] Production release and live version verification

## Venue setup

All tools are reachable from the persistent venue administration shell. Staff use
Walk-ins & visits, Players & waivers, Front desk & memberships, and Check-in stations.
Managers also configure coaches, booking rules/rates, communications, reports and
published documents. The actual venue owner controls card refunds and renewal cancellation.

- Publish venue-approved wording by uploading a `.txt`/`.md` file or pasting the text.
  Publishing a replacement preserves old signatures and requires new acknowledgment.
  Documents are required before check-in, while paid booking fulfillment stays reliable.
- Set products, membership discounts, coach availability, rates and payment policy.
  Prices include applicable taxes. Monthly memberships use Stripe; one-time passes
  support cash or card. Half-hour court-pass use is supported.
- Start a check-in station for 1–24 hours. A signed-out station displays only branding
  and QR; players authenticate on their phones, while staff issue private guest links.
- Enable timed waitlist offers and reminders in Communications when ready. Delivery
  is in-app and respects notification preferences. No email/SMS service is claimed.
- Quotes reserve courts only when confirmed or held for checkout. Deposits and balances
  remain separate receipts. Lesson packages cover an individual lesson. Coach conflicts
  and court conflicts are checked together by the database.
- Walk-ins join the real event competition roster; public guest names remain abbreviated.
  Online court reservations, lessons, private bookings and desk guests share attendance.
- Physical equipment returns restore stock independently from refunds. Cash closing
  records a counted amount and variance; closed cash days reject further cash entries.

## Reporting definitions

Revenue uses payment dates and excludes duplicate desk/payment-order records. Refunds
are totals returned to date for those sales; net revenue is before processing fees.
Attendance includes registrations and confirmed visits. Utilization uses current active
courts, opening hours and closures, excluding pending checkout holds. Private events track
the booked contact's attendance, not an invented headcount for unregistered guests.

## Verification

Database tests exercise actual migrations using PGlite: access boundaries/MFA, immutable
waiver versions, visit eligibility, cash/card fulfillment, renewals, pass restoration,
stock returns, court/coach conflicts, deposits, timed offers, notification preferences,
series concurrency/DST, revenue deduplication, and competition roster synchronization.
Edge tests cover staff/buyer identity, owner-only cancellation, Stripe account scope,
idempotency and scheduler authentication. Browser checks use an isolated local fixture
with real Rally Haus branding; fixture transactions never reach production.

Local baseline testing found four suites unable to import the absent local
`react-test-renderer` package; the release gate uses a fresh lockfile install in CI.
No test customers, payments, schedules or waiver wording are seeded into production.
Existing real court reservations are projected into attendance/customer records.
