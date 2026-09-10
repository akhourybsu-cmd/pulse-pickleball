# Pickleball Palace: approved private payment sandbox

User authorization: use Pickleball Palace as the test venue and adjust it accordingly.

## Scope and safeguards

- Venue `df0b7022-06eb-4bc4-b04c-eabd99ae76c1`, group `b7508c4d-5d37-4dd8-a623-019fa49d50cf`, owner `fff594fe-02ea-439c-a974-72e1f6295f08` (akhourybsu@gmail.com).
- Added service-managed `private_venue_sandboxes.test_payments_enabled`, default false. Applied an idempotent opt-in only after checking Palace's exact IDs, confirmed email, current venue/group ownership, private visibility and unverified status.
- Edge Functions additionally require payment mode `test` and the owner's presence in `PULSE_PAYMENT_TEST_USER_IDS`. Ordinary accounts cannot change the registry.
- Database checks reject live/null-mode payment records, wrong buyers/financial owners, account replacement/reuse, publication, ownership transfer, real verification, invitations and outside members. Existing restrictive RLS and public-upload protection remain intact.
- Included sample features remain included. Test subscriptions do not replace access grants; test rentals do not create real court reservations. Existing Stripe capability, price, schedule, consent and refund checks still apply.
- New owner navigation: Manage venue → Included features → Open sandbox payment setup. The finance page explains the sample's test-only scope and separates venue rental checkout from PULSE's $10/month test subscriptions.
- ELEVENO remains free and unchanged. No Android Studio / Google Play changes. No live credentials or real-money transactions.

## Deployment and verification

- Backend commit `e585543a1106e1b2cd881656f52806862c592f95`, Supabase run `34475566735`: succeeded. Migration applied at `2026-09-10 12:14:15 UTC`; all payment functions deployed.
- Frontend commit `72182231b44885f1326c583cf8c8108cd0c59e96`: Firebase run `34476058200` succeeded and independently reproduced the 1,112 passing tests.
- Full local suite: 1,112 passed, 32 skipped, 10 todo; 86 passing files, 3 skipped.
- Latest Firebase CI (`34478145316`, job `102873904718`): 1,116 passed, 32 skipped, 10 todo; 86 passing files, 3 skipped. Production web/PWA build and deployment passed. Deno checks of payments, webhook and reconciliation passed; the real-SDK options regression suite passed both tests. Existing build warnings remain.
- Hosted SQL after opt-in: Palace test allowed `true`, live allowed `false`, live connected accounts `0`; ELEVENO enabled add-ons `0`. Palace remains unpublished/unsearchable and its real-business verification timestamp remains null.
- Hosted navigation verified: Included features displays Open sandbox payment setup; the finance workspace displays the private test warning, approved-owner status and permanently disabled live switch.
- Saved Court 6 (`d9e916ba-c86f-4296-98e4-8a1f22b85ede`) at $10/hour for test checkout; five other courts remain $0. Sample support address `palace-sandbox@example.com`, time zone `America/New_York`, and explicitly fictional cancellation policy saved through the app. No changes to existing programs/reservations.

## Bugs found by hosted testing

1. Stripe rejected new account creation because `card_payments` also requires `transfers`. Corrected both capabilities without changing account ownership/liability or direct-charge routing. See [Stripe's capability requirements](https://docs.stripe.com/connect/account-capabilities#card-payments). Commit `d6e94dcb43df38a2fe7892916d63fd65f46198a5`; Supabase run `34476799683` and Firebase run `34476799686` succeeded.
2. The platform request helper returned `{}` without an idempotency key. The real Stripe 18.5 SDK rejected the unrecognized trailing options argument before sending GET checkout/subscription/invoice requests. Added the pinned API version to every request-options object. Commit `ad8556668da455859ea0833594aa27f246c093f0`; Supabase run `34477772880` and Firebase run `34477772758` succeeded. Two additional Deno regression tests exercise the actual deployed SDK with all HTTP intercepted, for platform and connected-account calls. All three payment handlers passed Deno checking after retrying an upstream dependency timeout.
3. Stripe retained the rejected account-creation idempotency key. A safe corrected retry now first scans for an existing account bound to the same venue/owner, refuses ambiguous or changed ownership, and only then uses the versioned capability-request key. Commit `eac3e6d42ea357f8a95e5f83d80d4eaa3f158c09`; Supabase run `34478145308` and Firebase run `34478145316` succeeded. The next app attempt created exactly one mapped test account and reached Stripe-hosted onboarding.

## Hosted subscription acceptance

- Real app-to-Stripe **test** checkout created order `0be84add-66c4-437e-b0dc-b1d09a572f20`, session `cs_test_a16mmR3yshG0UICrEuxzoMJYAC4eRenqy8DZMn4UfIFAn8H1SzVHdMBNwR`, subscription `sub_1UE77iG2WbAqAcDMsSzDJJso`.
- Stripe's published Visa test card was used with fictional test cardholder data. Optional Link signup/save was deselected. No real payment credentials were used.
- Hosted Checkout displayed Sandbox, $10/month and PULSE as merchant, then returned to the signed-in app. Initial confirmation exposed the request-options bug above; the **same** purchase reconciled to Paid after the fix without making another purchase.
- Database confirmed `livemode=false`, 1,000 cents, subscription active, two included staff-grant modules unchanged, and zero payment-created reservations.
- PULSE's merchant-scoped billing portal opened with the matching test subscription, test Visa ending 4242 and paid invoice. Cancellation was submitted and the portal confirmed **Cancels Oct 10, 2026**. SQL independently confirmed `cancel_at_period_end=true`; the test subscription will not renew. Included grants remain unchanged.
- Signed platform event `evt_1UE7JkG2WbAqAcDMT3WexbS9` (`customer.subscription.updated`, test) processed at `2026-09-10 12:43:06 UTC`. This proves actual subscription cancellation delivery, beyond the earlier unrelated fixture replay.
- The original app checkout's signed-event processing/replay has not been confirmed after the request-options fix. Paid status was recovered using the app's explicit reconciliation action. A later read-only Stripe event lookup encountered a browser-control timeout; no replay or second purchase was submitted. Inspect/replay that original checkout event before counting automatic checkout webhook fulfillment as accepted.
- Rental checkout/refund, multi-venue browser isolation, renewal and installed Android PWA returns remain pending.

## Separate venue account and remaining onboarding

- Palace's separate account is `acct_1UE7L695bZHXUHuu`, distinct from PULSE's platform account. Hosted SQL confirms `livemode=false`, `connected_by` matches Palace's owner, and only one Palace mapping exists.
- The app reached Stripe's **Get started with Stripe** email/sign-in page. No password, actual identity/bank information, or real-business verification was submitted. Account onboarding is not complete: `details_submitted`, `charges_enabled` and `payouts_enabled` are all false. Rental checkout must remain unavailable until Stripe's test requirements are completed.
- Signed Connect event `evt_1UE7MC95bZHXUHuuAS5RVJJl` (`account.updated`, test) processed at `2026-09-10 12:45:38 UTC` against that account. This verifies the separately signed connected-account destination and mapped-account update path; it does not prove rental fulfillment/refunds.
- Final hosted safeguards: group private; venue unpublished and unsearchable; real-business verification null; test eligibility true; live eligibility false; accepting payments false. The onboarding tab is preserved for the owner to continue sign-in. Do not activate a real business or enter real banking information for this fictional venue.

## Complete copy/paste SQL

- [Full schema migration](../../supabase/migrations/20260921110000_private_venue_test_payments.sql) — applied through the normal migration workflow.
- [Full Palace-only opt-in script](../../supabase/operations/enable-palace-stripe-sandbox.sql) — applied once, safe to repeat with matching preconditions.

The opt-in does not set prices or create a Stripe account. It never enables the live-collection switch. Do not delete Palace's private registry row or mark it verified to make payment tests pass.

## Remaining live-launch gate

Complete the [two-venue acceptance matrix](../payments/stripe-launch.md), including actual connected-account events, successful/failed/canceled/expired checkout, merchant isolation, refunds, subscription renewal/cancellation, recovery, and installed PWA returns. Stripe documents test accounts and test-only onboarding separately from live financial setup: [Testing Stripe Connect](https://docs.stripe.com/connect/testing).
