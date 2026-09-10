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
- The later rental checkout/full-refund acceptance is recorded below. Two-venue browser isolation, renewal, failure/3DS/expiry scenarios and installed Android PWA returns remain pending.

## Separate venue account and initial onboarding checkpoint

- Palace's separate account is `acct_1UE7L695bZHXUHuu`, distinct from PULSE's platform account. Hosted SQL confirms `livemode=false`, `connected_by` matches Palace's owner, and only one Palace mapping exists.
- At the initial checkpoint, the app reached Stripe's **Get started with Stripe** email/sign-in page. No password, actual identity/bank information, or real-business verification was submitted by the agent. At that point `details_submitted`, `charges_enabled` and `payouts_enabled` were all false. The subsequent owner-assisted completion and rental acceptance are recorded below.
- Signed Connect event `evt_1UE7MC95bZHXUHuuAS5RVJJl` (`account.updated`, test) processed at `2026-09-10 12:45:38 UTC` against that account. This verifies the separately signed connected-account destination and mapped-account update path; it does not prove rental fulfillment/refunds.
- Final hosted safeguards: group private; venue unpublished and unsearchable; real-business verification null; test eligibility true; live eligibility false; accepting payments false. The onboarding tab is preserved for the owner to continue sign-in. Do not activate a real business or enter real banking information for this fictional venue.

## Owner-assisted completion and rental/refund acceptance — September 10, 2026

- The owner completed the Stripe sign-in and agreement/confirmation steps. The agent configured fictional business/service details, Stripe's documented test website and public support values, and Stripe's built-in dummy bank. Optional Climate contributions and Stripe Tax enrollment were declined. The account remained explicitly marked as a test account.
- After confirmation, the exact server-synchronized blocker was `individual.verification.document` with `requirements.past_due`. Used Stripe's hosted **Start verification → Simulate → Successful verification → Submit result** test tool. No real identity document was uploaded. The signed `account.updated` flow enabled test capabilities; PULSE subsequently showed **Stripe connected, 5 of 5 setup checks**.
- Through the real player UI, selected Court 6 for September 11, 2026, 10:00–11:00 AM America/New_York. The server quote clearly named Pickleball Palace as merchant, $10 USD total, the saved cancellation policy and venue-local time. The owner accepted the previously defined sandbox workflow; the agent accepted the explicitly fictional test rental policy in the test checkout.
- Stripe-hosted checkout showed **Sandbox**, **Court 6 · 60 minutes**, **$10**, and **Sold by Pickleball Palace**. Used Stripe's published Visa test card and fictional cardholder/ZIP values. Optional future-card saving remained unchecked and Link signup was not used.
- Order `a4c730f9-7a45-45c9-97b7-e6b6065a2d61`; session `cs_test_a14eZJV63Uc09jhHoW2YTwecZWvabBGSFhUOQHuTqmhOUQH9DuBYbyqCIX`; intent `pi_3UEFQQ95bZHXUHuu1x4WCaRX`. Checkout returned to the signed-in app and automatically displayed **Paid** without a manual recovery action.
- Signed connected-account event `evt_1UEFQS95bZHXUHuurcrM4sFm` (`checkout.session.completed`) processed at `2026-09-10 21:22:34 UTC`. Hosted SQL confirmed `livemode=false`, merchant account `acct_1UE7L695bZHXUHuu` (not PULSE), 1,000 cents paid, and **zero real reservations created**.
- Player submitted a clearly labeled sandbox cancellation request. The owner payment panel surfaced it under **Requests to resolve**, required an explanatory response and a separate refund confirmation. Request ID `76a43b5d-eb01-48a3-a4a4-4bc58f972769`.
- Executed **Cancel & refund** for the full test amount through PULSE. Both owner and refreshed player history showed **Canceled · refunded**, **$10 refunded**, the approved request and the owner's explanation. No open request remained. SQL confirmed `status=refunded`, `refunded_cents=1000`, still test-only and zero real reservations.
- Signed refund events processed at approximately `21:24:26 UTC`: `evt_3UEFQQ95bZHXUHuu1dgE6EPo` (`refund.created`), `evt_3UEFQQ95bZHXUHuu14jDEXE1` (`refund.updated`), `evt_3UEFQQ95bZHXUHuu1JjRmYNj` (`charge.refunded`).
- **View receipt** opened Stripe's sandbox **Refund from Pickleball Palace**, receipt `3363-3841`, $10 returned to test Visa ending 4242, adjusted total $0. No reusable receipt/portal session URLs are retained here.
- Merchant selector separately listed PULSE Pickleball and Pickleball Palace. Palace's portal opened with its own name, no saved payment method and no PULSE subscription/invoices. SQL independently confirmed two distinct merchant/customer scopes. This verifies platform-versus-venue separation; it is not the full two-venue adversarial isolation test.
- Final hosted safeguards: Palace private, unpublished/unsearchable, one active member, two included staff-grant features, real venue verification null, live eligibility false, accepting live payments false. Its test account is ready; ELEVENO still has zero enabled add-ons. No real money, real reservation, live banking setup, Android Studio or Google Play changes.

### Remaining acceptance and UX follow-ups

- Still required before live launch: second dedicated venue isolation, declined/3DS/canceled/expired checkout, partial/pending/failed refunds, subscription renewal, actual pending-order recovery, and installed Android PWA returns. The initial platform subscription checkout event's replay remains unconfirmed, although the connected rental checkout event above is verified.
- Observed non-blocking copy/accessibility follow-ups: named court/time labels for grid buttons; neutral loading button text before price verification; human-readable Stripe requirement names and a distinct pending-review headline; test-mode copy that never implies a real reservation is created; localized venue times in Stripe checkout descriptions. These are observations, not changes deployed in this acceptance pass.
- This pass changed only test configuration/test transactions and this evidence record. No app source, database migration or payment security controls were changed.

## Failure-path acceptance and launch blockers — September 10, 2026

Scope: the user requested all necessary checks. Only existing Palace sandbox transactions, read-only production queries and local tests were used. No app source, migration, live setting or financial security control was changed in this pass.

### Passed hosted checks

- Court 6, September 11, 11 AM–noon venue time: order `64fb9e59-6a12-4388-a457-bc4c1d9702ae`, session `cs_test_a1rOFcOI4dP7yeeuDoP96L3X5O4ZtQEFhKpBHsEjmIQJYGRN40phziVZlE`.
- Stripe's insufficient-funds card ending 9995 produced an explicit decline. SQL confirmed the order remained pending, refunded amount zero, test mode and zero real reservations.
- Switched the same checkout to the 3DS card ending 3220. **FAIL** produced an authentication error; retrying and choosing **COMPLETE** returned to the signed-in PULSE app as Paid. The same order and session were retained, with one successful intent `pi_3UEFg095bZHXUHuu1qJ9UOE0`. Signed event `evt_1UEFi995bZHXUHuuHBpagAPK` processed at `21:40:51 UTC`. No manual payment reconciliation was needed.
- Court 6, September 11, noon–1 PM: order `fb27e362-094e-49aa-b58d-5316fac11c9f`. Leaving Stripe via its Back link returned to **Awaiting payment**, with Continue checkout, Check payment and Cancel unpaid checkout available. Continue checkout returned to the **same** order. This checks exit/resume, not processor-confirmed expiration.
- That resumed order was paid using Stripe's asynchronous-refund-failure fixture ending 5126. Intent `pi_3UEFlT95bZHXUHuu1Xg1Nope`; signed checkout event `evt_1UEFlW95bZHXUHuuiGlJrx7Y` processed at `21:44:21 UTC`.
- All payment forms remained Sandbox/$10/Palace. Fictional cardholder details were used; card saving was unchecked and Link signup was not used.
- Focused local suite: **115 passed across 7 files** (`npm test -- tests/payments tests/venues/payment-timezone.test.ts tests/venues/payment-panel-ui.test.tsx tests/venues/payment-draft.test.ts tests/venues/private-venue-sandbox.test.ts`). These include automated account/owner isolation, partial refunds, overlapping buyers, timezone and subscription invariants; they are not substitutes for the remaining hosted acceptance cases.

### Confirmed launch blocker: later failed refund remains reported as returned money

1. Player requested cancellation of order `fb27e362-094e-49aa-b58d-5316fac11c9f`, with an explicitly labeled refund-failure test note. Request `59fecdac-4369-4195-bf6b-8a3f57c51e3f`.
2. Owner approved the simulated $10 refund through PULSE's separate confirmation. The initial refund succeeded; PULSE recorded `canceled_at=2026-09-10T21:46:16.890576Z`, `status=refunded`, `refunded_cents=1000`, request approved.
3. Stripe then failed that refund. Its payment details explicitly showed a $10 refund attempted but failed because the card was expired/canceled. Signed `refund.failed` event `evt_3UEFlT95bZHXUHuu1Ynk9dWx` was processed by PULSE at `21:46:23 UTC`.
4. After full reloads and independent SQL checks, both player and owner history still said **Canceled · refunded / Refunded $10**, the request stayed approved, and **Requests to resolve** said no open requests. This is an actual Stripe/PULSE discrepancy, not just a stale page.
5. The `21:50:02 UTC` scheduled recovery returned HTTP 200, `checked:0`, `refunds_checked:0`, `failed:0`; it did not correct this false success. The affected test order created zero real reservations.

Cause: `payment_record_charge` in migration `20260918100000_payment_foundation.sql` uses `greatest(p_refunded,o.refunded_cents)`, so a previously recorded refund can never decrease even when fresh Stripe data proves failure. Its zero-refund branch also retains the previous status, and approved requests never return to the owner queue. `payment-reconcile` only scans requests still marked `refund_pending`, so it misses approved-then-failed refunds. The current unit test intentionally preserves a higher prior refund total and does not cover a legitimate succeeded-to-failed transition.

Required correction before launch: model processor refund attempts/status transitions explicitly, reconcile authenticated fresh state without accepting stale snapshots, represent failed refunds honestly in the ledger and both UIs, restore an actionable owner review item, and cover recovery after a missed failure notification. Do not simply reduce totals without race/out-of-order safeguards, silently rebook an already released court, issue a second refund, or patch the test ledger by hand. No fix or corrective migration has been applied in this checks-only pass.

### Confirmed UI issue: owner Refresh does not refresh the request queue

- With the owner page already open, the player submitted the request above. Clicking the page-header Refresh repeatedly updated purchase history to show `Cancellation: requested`, while **Requests to resolve** still said no open requests.
- A full browser reload surfaced the request and its resolution controls. The page header in `src/pages/player/Payments.tsx` refetches only `history`; the separately mounted `venue-payment-requests` query in `VenuePaymentsPanel.tsx` is not refreshed. Owner actions refetch it, but the header button does not.
- The player can also still open Request cancellation while a request is already pending. The database deduplicates by order, but the UI should show the existing request instead of inviting another submission.

### Recovery evidence and remaining scope

- Scheduled invocation at `21:40:00 UTC` returned HTTP 200 with `checked:1, refunds_checked:0, failed:0` while the first new checkout was pending. This confirms the scheduler can inspect an actual order; it does **not** prove recovery of a paid order after missed fulfillment.
- Still unproven end-to-end: a second distinct venue account and other-owner/staff browser access; OAuth disconnect/reconnect edge cases; actual checkout expiration; delayed successful and partial refunds, insufficient balance and alternate cancellation decisions; original platform checkout replay and renewal; duplicate/out-of-order app event replay; recovery after missed notifications; installed Android PWA return and cross-device timezone behavior.
- Live launch remains blocked. Palace stays private and test-only; no real money/reservation was involved. The failed-refund fixture is deliberately retained as evidence for a corrective regression test, rather than made to look successful by manual data edits.
- Official fixtures: [Stripe test cards and asynchronous refund scenarios](https://docs.stripe.com/testing?testing-method=card-numbers).

## Corrective implementation — prepared locally, not deployed

The owner authorized investigation and fixes after the failed-refund findings.

- Complete new migration: `supabase/migrations/20260921120000_refund_failure_recovery.sql`. It adds sanitized refund-attempt snapshots, a pending/failed indicator, check versions/timestamps, and a reopened `refund_failed` owner-review status. It does not create a charge/refund, rewrite the hosted fixture or enable live payments.
- Each refund reconciliation claims a database version **before** reading current merchant-scoped Stripe state. A later-started read supersedes older in-flight results. The new snapshot routine permits legitimate refund decreases and recalculates paid/partial/full-refund amounts. The old aggregate-only RPC is no longer executable by Edge service code, so an old deployment retries rather than overwriting a corrected snapshot.
- A formerly approved refund that later fails returns to the owner queue, and both owner/player views clearly distinguish failed money return from court cancellation. A canceled court is never recreated. A refund review initiated outside the cancellation workflow cannot silently authorize canceling a still-active reservation.
- Recovery rotates through settled orders, including approved/refunded orders, in bounded batches. It records attempted-check time before processor access so inaccessible accounts do not starve later orders. This covers missed failure notifications and the existing hosted false-success record once deployed and reconciled.
- Owner UX: Requests to resolve appears before setup/rates; failed items sort first; desktop uses two columns and mobile stacks cards; player names and venue-local time appear with exact paid/refunded amounts. A direct link opens the specific payment in that venue's Stripe account. Pending/failed requests offer **Check refund status**, not a second refund action. The header refresh covers history, requests and settings; the queue and history refresh every 30 seconds while visible.
- Player UX: clear failure/processing notices, explicit canceled-versus-active wording, no duplicate cancellation form while a request exists, and an on-demand refund check. After an external refund review completes, an active court can still be canceled; fully refunded payments offer the owner **Cancel reservation**, not another refund.
- Verification: final full suite **1,132 passed**, 32 skipped, 10 todo (87 passing files, 3 skipped), using `npm test -- --maxWorkers=2`. The initial unrestricted worker run exhausted local memory; the bounded run completed without test errors. All three payment Edge Functions passed Deno type checking. The final production build passed (4,702 modules; existing bundle-size/Browserslist warnings remain). Local mobile 390px fixture and desktop preview were visually inspected, including wrapped long names and in-bounds action buttons. These are browser previews, not installed Android PWA acceptance.
- No live transaction, new connected account, ELEVENO change, Android Studio/Google Play change, Git push or database deployment occurred in this implementation pass.

### Publish and hosted verification sequence

1. Apply the complete migration and deploy `payments`, `payment-webhook`, and `payment-reconcile` together, before publishing the new frontend. The retired RPC deliberately fails closed during the short migration/Edge transition; signed events retry. Do not leave the old Edge version running against the migrated database.
2. Deploy the web/PWA frontend, still in test mode. Reconcile existing test order `fb27e362-094e-49aa-b58d-5316fac11c9f` using the normal processor-backed flow or scheduled pass; never edit its refunded amount or request status by hand.
3. Confirm refunded amount zero, failed-refund notice and reopened owner review, while preserving its existing cancellation timestamp and zero real reservations. Verify both header refresh and automatic queue updates across the two signed-in views.
4. Re-run pending-to-success, failed-refund follow-up, stale/concurrent webhook and missed-notification recovery checks. The remaining two-venue, renewal, expiry and installed-PWA acceptance matrix still applies. Do not enable live payments merely because this corrective release passes.

## Corrective publication — September 10, 2026

- Explicit user approval: publish all pending. Backend commit `9d1a817a89e762f1afaddd5a5acfcb136dd16702` was pushed to main first. [Supabase run `34539452226`](https://github.com/akhourybsu-cmd/pulse-pickleball/actions/runs/34539452226) succeeded, including migration runner checks, pending migration application and Edge Function deployment. Logs confirm the new migration applied at `22:51:39 UTC` and all three payment handlers deployed afterward.
- Web/PWA commit `08498530680ed4b53a86f3cbbcedf46e77239d25` was pushed only after backend success. [Firebase run `34539979268`](https://github.com/akhourybsu-cmd/pulse-pickleball/actions/runs/34539979268) passed: 1,132 tests, 32 skipped, 10 todo; production build and hosting deployment succeeded. The local implementation evidence above remains a historical pre-deployment checkpoint.
- Before any manual status check, scheduled recovery at `22:55:01 UTC` returned HTTP 200 with `checked:0, refunds_checked:4, failed:0`. An independent read-only SQL query confirmed the original failure fixture `fb27e362-094e-49aa-b58d-5316fac11c9f` was corrected at `22:55:03 UTC`: `status=paid`, `refund_state=failed`, `refunded_cents=0`, original failed Stripe attempt retained, request `refund_failed`, `refund_review_only=false`. Its original `canceled_at=2026-09-10T21:46:16.890576Z` remained unchanged, with zero real reservations. No manual ledger mutation or second refund was used.
- Hosted owner view now shows **1 payment item needs attention** and **Requests to resolve** before setup/rates. The card identifies Alex Khoury, Court 6, September 11 at noon venue time, **Paid $10 / Refunded $0**, and **Refund needs attention**, with test-only wording. The Stripe review link targets the exact original payment under Palace's own account. **Check refund status** returned **Latest refund status checked — no new refund issued**. Header Refresh completed and retained the corrected request and history.
- Reloaded player purchase history shows **Canceled · refund needs attention**, explains that the refund did not complete, offers a status check and does not offer duplicate cancellation for that order. The original successful refund order `a4c730f9-7a45-45c9-97b7-e6b6065a2d61` still shows **Canceled · refunded / Refunded $10**; SQL independently confirmed `status=refunded`, `refund_state=none`, `refunded_cents=1000`.
- Published owner desktop screenshot was inspected; content width and viewport were both 1,279px, with no horizontal overflow. Earlier 390px mobile preview verification remains recorded above. Installed Android PWA return behavior and a fresh cross-view request transition remain separate acceptance cases; this publication check did not simulate another purchase/request solely to exercise polling.
- Final read-only safeguards: Palace private, unpublished, unsearchable, real verification null, test eligibility true, live eligibility false, accepting payments false, zero live orders and zero real payment reservations. ELEVENO still has zero enabled add-ons. No live-payment activation, real transaction, Android Studio or Google Play deployment occurred.

## Complete copy/paste SQL

- [Full schema migration](../../supabase/migrations/20260921110000_private_venue_test_payments.sql) — applied through the normal migration workflow.
- [Full Palace-only opt-in script](../../supabase/operations/enable-palace-stripe-sandbox.sql) — applied once, safe to repeat with matching preconditions.
- [Full corrective refund migration](../../supabase/migrations/20260921120000_refund_failure_recovery.sql) — complete copy/paste file; applied by successful Supabase run `34539452226`.

The opt-in does not set prices or create a Stripe account. It never enables the live-collection switch. Do not delete Palace's private registry row or mark it verified to make payment tests pass.

## Remaining live-launch gate

Complete the [two-venue acceptance matrix](../payments/stripe-launch.md), including actual connected-account events, successful/failed/canceled/expired checkout, merchant isolation, refunds, subscription renewal/cancellation, recovery, and installed PWA returns. Stripe documents test accounts and test-only onboarding separately from live financial setup: [Testing Stripe Connect](https://docs.stripe.com/connect/testing).
