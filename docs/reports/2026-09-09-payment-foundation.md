# Payment integration — staged implementation, not a live launch

## Approved staged release — September 9, 2026

The user approved publishing this foundation with new checkout disabled. The complete payment migration and dependent functions deployed successfully through [the production backend workflow](https://github.com/akhourybsu-cmd/pulse-pickleball/actions/runs/34394343201). The frontend follows only after that successful backend deployment. This is a website and Android PWA release, not an Android Studio / Google Play build.

No new Stripe credentials, products, billing settings, charges, refunds or payouts were created. `PULSE_PAYMENTS_MODE` defaults to `off`; live mode also requires a matching dedicated key, verified account and separate launch approval. The remaining gates below apply before enabling payment collection, not to displaying the disabled payment setup screens.

Pre-publication verification: 873 app tests passed (32 skipped, 10 todo), all 10 migration-runner tests passed, all three new payment functions passed type checks, and the production web build passed. Full Stripe end-to-end testing remains outstanding.

## Included in the staged release

| Flow | Merchant / funds | Implementation |
| --- | --- | --- |
| Venue add-ons | PULSE Pickleball | $10 USD per feature per month, confirmed by the owner on September 9, 2026. Server catalog accepts only `court_booking` and `facility_tools`; separate monthly subscriptions with no one-time purchase option. Charging remains off. |
| Court rentals | The venue's connected Stripe account | Direct charges, with no PULSE application fee or transfer to PULSE. Venue-defined all-inclusive hourly prices, prorated by duration. |
| Saved payment methods | Stripe's vault, per merchant | Profile opens hosted Setup-mode Checkout and the merchant's hosted customer portal. No PAN, CVC, bank account or payment-method secret is stored in PULSE. |
| Purchase records | Private PULSE ledger | Purchaser history, owner-only rental history, receipts, refund status, policy snapshots, cancellation requests and test labels. |

New pages and controls:

- Profile → Payments & purchases (`/player/payments`).
- Venue Features & verification → Manage venue finances (`/player/payments?venue=...`).
- Optional add-on purchase review with explicit $10/month automatic-renewal consent, named PULSE merchant and paid-period cancellation terms.
- Server-priced court checkout with named merchant, total, accepted policy and unmistakable pay-to-reserve button.
- Paid reservations in My Bookings link to payment/cancellation options rather than being directly deleted.
- Owner-only Stripe onboarding, prices, support contact, venue time zone, tax-inclusive acknowledgment and collections switch.
- Owner cancellation queue: decline; cancel without refund; or cancel after a successful full refund. Responses remain visible to the purchaser.

## Security and consistency

- JWTs are verified with `auth.getUser`, not merely decoded. Confirmed user email is required.
- Stripe customers are mapped by auth user ID, Stripe account and test/live mode—not matched by email.
- PULSE charges and venue charges are account-scoped separately. Browser requests cannot choose arbitrary charge destinations, customers, amounts, entitlements or fulfillment states.
- Venue finance authority uses the actual `venues.owner_id`. Being a community moderator, venue manager or PULSE administrator does not silently authorize control of another venue's funds.
- Ownership changes pause new venue collections until the financial ownership is reviewed; existing accounts are not automatically reassigned.
- The database locks court writers against checkout holds. A hold is not a confirmed public event; its public projection contains only the occupied time and court.
- Holds are released only following verified Stripe expiration or a safe orphan-session reconciliation—not simply by elapsed local time.
- Successful payment, order status, public reservation creation and module grant use a transactional database function. Duplicate fulfillment is a no-op.
- An add-on expiring while an already-authorized rental checkout is underway does not invalidate that purchased reservation.
- Price and policy changes between review and checkout require another explicit review.
- Direct insertion of a paid reservation is blocked. Non-staff cannot bypass checkout by naming a paid court allocation another event type.
- Paid reservation times/courts/payer cannot be edited or deleted through ordinary browser writes.
- Refund amounts are monotonic and account-scoped. Pending refunds retain the reservation; cancellation without refund is separately recorded.
- Only paid invoices extend monthly access. A subscription's current period is not treated as evidence that it was paid.
- Test payments never create real bookings or grant real venue capabilities. Payment testing is restricted to explicitly allowlisted test user IDs.
- CORS and redirect destinations are constrained. Processor errors do not expose Stripe authentication error text. No request bodies, card details, keys or hosted session URLs are logged by the new functions.
- Payment queries are not on the persistent browser-cache allowlist. The existing sign-out cache reset still applies.

The older league verification flow also now verifies product purpose, price, quantity, currency, buyer and live mode, and commits the ledger plus slot increment together. The older tournament webhook no longer activates a tournament from an unpaid or test checkout.

## Full SQL migration

The complete, copy/paste SQL file is:

`supabase/migrations/20260918100000_payment_foundation.sql`

It was **applied to production** through the established migration runner before the dependent functions. It depends on the already-deployed verified-free-venue foundation and existing league schema. The file is supplied in full for review/copy-paste on an unmigrated environment; do not rerun it on production or manually paste fragments. New billing tables have RLS and server-only writes; no payment collection is enabled by applying this file.

Financial references deliberately prevent deleting courts/venues/users while their retained payment records reference them. A formal retention/anonymization and account-deletion policy must be finalized before live launch; this implementation does not claim legal compliance or silently erase accounting history.

## Required configuration — do not put secrets in chat or frontend env files

Use Supabase server-side function secrets:

| Name | Purpose |
| --- | --- |
| `PULSE_PAYMENTS_MODE` | `off` by default; `test` for controlled QA; `live` only after launch approval |
| `PULSE_MODULE_BILLING` | Optional; only `monthly` is accepted. Code defaults to the confirmed monthly cadence; any conflicting value fails closed. This does not enable checkout. |
| `PULSE_STRIPE_SECRET_KEY` | Dedicated Stripe secret key; test/live prefix must match the selected mode |
| `PULSE_STRIPE_ACCOUNT_ID` | Verified PULSE platform account ID; checked against the key's account |
| `PULSE_STRIPE_WEBHOOK_SECRET` | Signing secret for PULSE-account events |
| `PULSE_STRIPE_CONNECT_WEBHOOK_SECRET` | Separate signing secret for connected-account events |
| `PULSE_PAYMENT_TEST_USER_IDS` | Comma-separated auth IDs permitted to use test checkout |
| `PULSE_PAYMENT_RECONCILE_SECRET` | Strong random server-only secret of at least 32 characters |
| `PULSE_PAYMENTS_LIVE_APPROVED` | Must be explicitly `true` in addition to live mode/key; leave unset now |

Deploy functions: `payments`, `payment-webhook`, `payment-reconcile`, plus the updated `verify-league-slot-purchase` and `tournament-stripe-webhook`. The three new endpoints validate their own user/signature/scheduler authentication. Both existing league payment endpoints now explicitly defer JWT validation to their authenticated handlers so the project's current signing scheme is supported.

Set up both Stripe platform and Connect event destinations to the payment-webhook URL. Required event families include Checkout completion/expiration/asynchronous success or failure, account updates, paid invoices, subscription updates/deletion, charge refunds and disputes. Use the pinned Basil API schema matching the deployed Stripe SDK. Configure the legacy webhook separately until its migration is complete.

Run `payment-reconcile` every five minutes from an authenticated server-side scheduler using `x-payment-reconcile-secret`. Alert on its non-2xx response; Stripe should retry failed webhook responses. The function and recovery logic exist, but the hosted scheduler has **not** been installed or exercised.

Configure PULSE's hosted customer portal for card management, invoices and cancellation at period end. Each directly charged venue also needs a usable customer portal configuration on its Stripe account. Do not enable arbitrary subscription price/quantity changes, promotion codes, account credits or additional payment methods without extending the reconciliation rules and testing them.

## Defaults and limits requiring product review

- Initial rental checkout: USD cards only; rates include any applicable taxes. Neither automatic tax calculation nor legal tax determination is implemented. PULSE and each venue must establish their own tax treatment before collection.
- Paid rentals currently use 30-minute increments, a maximum of four hours, a 35-minute minimum lead time and a 180-day booking horizon. These protect the 31-minute hosted checkout window; review the desired operational policy before release.
- The existing venue grid is device-local, while the new server validates the venue's configured time zone. Cross-time-zone/DST grid presentation must be brought into alignment and tested before enabling real paid reservations for traveling players; server validation fails closed rather than accepting an out-of-hours purchase.
- Two pending checkouts and ten rental attempts per hour per player. Finishing or safely canceling previous attempts frees capacity.
- Public slot projections exclude test holds. Test rental payments simulate fulfillment and do not insert a real reservation.
- Existing venue module grants remain enabled without requiring payment; a free/test venue with an unenabled module is needed to test add-on activation end to end.
- Stripe full-dashboard/controller accounts are used. Existing external Stripe accounts/OAuth linking and financial ownership transfers need a reviewed connection path; do not replace an existing business account blindly.

## Work still required before claiming complete payments

1. **Decision resolved:** $10 USD per feature per month. The signed-in Stripe dashboard identifies the business as Pulse Pickleball (`acct_1ShZSOG2WbAqAcDM`). No new Stripe products, keys, settings or charges have been created. Runtime verification of the server key's account is still required during configuration.
2. Connect/test the actual PULSE and venue Stripe configuration, portal, signing secrets and scheduled reconciliation. The actual venue owner must complete its Stripe onboarding and business verification.
3. Run Stripe end-to-end tests: success, decline, 3DS, repeated submission, lost response, abandoned checkout, overlapping bookings from two clients, customer portal/save/remove/default card, cancellation/refund failure and success, renewal failure, paid-period expiry and financial ownership change.
4. Reconcile historical Stripe data. Legacy league records and tournament checkout references are shown separately in Profile, but old tournament amounts and some division purchases were never recorded locally. Those must not be invented. The older tournament/division checkout and fulfillment flows still require full migration onto the shared ledger/webhook before “history across the entire app” is complete.
5. Complete payment-record retention/account deletion, venue refund/support policies, tax treatment and production operational monitoring. Add refund/dispute recovery exercises with actual Stripe sandbox events.
6. Review other paid venue services such as clinic/event registration: the common ledger is extensible, but their capacity/registration fulfillment is **not implemented by this court-rental pass**.
7. Enable payment collection only after the above release gates are resolved. The user approved publishing the disabled foundation in order: database → functions → frontend. Native Android publishing remains out of scope.

## Verification performed

Monthly-pricing follow-up (September 9): 23 payment tests passed, the three new payment functions passed Deno type checks, and the production web build passed in 30.28 seconds. New assertions reject one-time feature orders, non-$10 feature prices, recurring rental orders, missing subscription paid periods and incorrect renewal amounts. Monthly pricing is shown even while checkout is disabled; the purchase button still requires ready payment configuration and explicit renewal consent. This follow-up did not rerun the full suite or perform Stripe end-to-end testing, and did not deploy the migration, functions or frontend.

Earlier foundation verification:

- Full test suite: 871 passed, 32 skipped, 10 todo (66 passing test files).
- Includes 21 new payment/helper/PGlite tests using the actual migration: authorization, private rows, price and policy changes, overlap/holds, transaction rollback, duplicate fulfillment, refunds, test/live isolation, paid-period renewal and legacy league fulfillment.
- Deno type checks passed for all three new payment functions and the two updated legacy functions.
- Final production web build passed (35.84 seconds). Existing large-bundle warnings remain; no new eager payment bundle is added to the home page because the payment page is lazy-loaded.
- The repository-wide TypeScript check still has pre-existing diagnostics outside this payment implementation. No new payment-screen diagnostics were reported; the touched venue-day query's dynamic-select typing issue was corrected.
- Local read-only visual fixture reviewed at desktop and 390-pixel mobile widths. Profile payments and venue finance forms had no horizontal overflow or controls outside the viewport. These are sample-data UI checks, **not** authenticated Stripe or live database end-to-end tests.
- No production purchase, booking, refund or payout was made.

## Primary implementation references

- [Stripe direct charges](https://docs.stripe.com/connect/direct-charges)
- [Stripe account controller properties](https://docs.stripe.com/connect/migrate-to-controller-properties)
- [Hosted Checkout sessions](https://docs.stripe.com/api/checkout/sessions/create)
- [Customer self-service portal](https://docs.stripe.com/customer-management)
- [Webhook verification, retries and delivery behavior](https://docs.stripe.com/webhooks)
- [Subscription cancellation and paid-period behavior](https://docs.stripe.com/billing/subscriptions/cancel)
- [Invoice payment references](https://docs.stripe.com/api/invoice-payment/object)
