# Venue Stripe launch checklist

Status: backend migration and Edge Functions deployed successfully in commit `3655049222e3d5f2f2d18613821888e705877de2` (Supabase run `34468994469`), then web/PWA commit `e3b18171ec7b480b426c9674ec54800b0d5ff106` deployed successfully (Firebase run `34469652725`). With subsequent explicit approval, test-mode secrets, test OAuth/redirect, both event destinations and the five-minute recovery scheduler are configured. Platform signed-event delivery, duplicate replay and recovery HTTP checks passed; see the [sandbox setup evidence](../reports/2026-09-10-stripe-sandbox-setup.md). The approved [Palace follow-up](../reports/2026-09-10-palace-payment-sandbox.md) additionally verifies a $10/month test checkout, reconciliation to Paid, billing portal and cancellation sync, a separate mapped test account, and signed Connect account updates. No live-payment approval or real-money transactions. Stripe onboarding and the remaining rental/full acceptance matrix are still pending.

## Money ownership

| Purchase | Merchant/account | Owner controls |
| --- | --- | --- |
| Court booking feature | PULSE platform; $10 USD/month | PULSE subscription, canceled by purchaser in Payments & purchases |
| Facility operations feature | PULSE platform; $10 USD/month | Same separate subscription model |
| Court rental | That venue's own Stripe connected account, direct charge | Venue bank details, payouts, rental rates, cancellation policy, refunds and disputes |

No PULSE rental commission is set. Stripe processing fees still apply. All currently implemented prices are USD and tax-inclusive; automatic tax calculation/remittance is not implemented. Venues must confirm their own tax treatment before activation. This is not a general-purpose paid-events, clinics, memberships or tournament-entry checkout system; those must not be advertised as paid workflows until separately implemented and tested.

Each venue gets its own connected account per environment. An account cannot be reused for another venue in PULSE. Customers, saved cards, portals, checkout sessions, receipts and refunds remain scoped to the original merchant and test/live environment. A community ownership transfer does not transfer ownership of the previous owner's Stripe funds; financial review is required. Never change connected_by/account_id manually to bypass that review.

## Owner workflow

1. Open the venue admin payment settings (Venue finances).
2. Complete venue ownership verification. Private sample venues cannot accept live payments. A separately approved, service-managed private test exception permits only the allowlisted owner to exercise Stripe test payments; it never verifies a real business or grants public access. See the [Palace sandbox record](../reports/2026-09-10-palace-payment-sandbox.md).
3. If the venue already uses Stripe, choose **Connect existing Stripe account**. Otherwise explicitly confirm **Create venue account**. Do not create a duplicate to work around a missing OAuth configuration.
4. Enter business, identity, bank and payout information only on Stripe-hosted pages. On return, PULSE retrieves the account; returning is not proof that onboarding completed. Outstanding requirements and pending review remain visible.
5. Enable the court booking add-on separately. It costs $10/month paid to PULSE, not to the venue.
6. Save active-court rates (minimum $1/hour for paid courts, $0 for free), support email, refund policy, venue time zone and tax acknowledgment. The calendar, staff closures and server quote use the same venue time zone. Saving a priced draft does not collect money, but it also must not allow free reservations on that court.
7. Only after live launch approval and all readiness checks pass, explicitly enable **Accept paid court reservations** and save. Each venue enables collections independently.
8. Process player requests in **Requests to resolve**. A requested or pending refund retains the reservation; only a successfully settled full refund releases it for a refund-based cancellation. A failed refund requires Stripe review. Cancel-without-refund is an explicit, separate decision.

## Deployment order

1. Keep `PULSE_PAYMENTS_MODE=off` during initial deployment. Do not erase or disable the existing payment infrastructure after real money is in flight.
2. Apply the complete schema migration: `supabase/migrations/20260921100000_venue_stripe_readiness.sql`. It adds private OAuth state, account-requirement flags and financial ownership/paid-court safeguards. It aligns existing payment-configured venues' calendar time zones with their saved checkout time zones. It does not turn on payments or alter charges.
3. Deploy `payments`, `payment-webhook`, and `payment-reconcile` together with their `_shared` dependencies. The existing Supabase workflow applies migrations before deploying functions. Keep `verify_jwt=false` for these three handlers; each has its own verified user/signature/recovery-secret authentication.
4. Deploy the frontend only after the backend migration/functions succeed. Frontend and backend main-branch CI workflows currently run independently, so coordinate this first rollout; do not assume a frontend green check proves backend readiness.
5. Configure sandbox secrets and destinations below. Run the read-only `npm run payments:check` with secrets already in a secure process environment. Never put Stripe secret keys or signing/recovery secrets in VITE variables, Git, chat, screenshots or committed .env files. This script does not load secret files or create anything.

## PULSE Stripe account configuration (sandbox configured; live still pending)

Use the verified PULSE business account, not a venue account. Existing project records identify PULSE as `acct_1ShZSOG2WbAqAcDM`; verify that in Stripe before using it. The preflight compares the key's authenticated account against `PULSE_STRIPE_ACCOUNT_ID`.

Server-only secrets/configuration:

| Name | Purpose |
| --- | --- |
| `PULSE_PAYMENTS_MODE` | `off`, then `test`; `live` only after explicit launch approval |
| `PULSE_MODULE_BILLING` | `monthly` |
| `PULSE_STRIPE_SECRET_KEY` | Environment-matched PULSE secret key (`sk_test_` or `sk_live_`) |
| `PULSE_STRIPE_ACCOUNT_ID` | Verified PULSE platform ID |
| `PULSE_STRIPE_CONNECT_CLIENT_ID` | Environment-matched `ca_` ID for existing-account OAuth |
| `PULSE_STRIPE_WEBHOOK_SECRET` | Platform event destination signing secret |
| `PULSE_STRIPE_CONNECT_WEBHOOK_SECRET` | Different signing secret for connected-account events |
| `PULSE_PAYMENT_TEST_USER_IDS` | Comma-separated approved user UUIDs; sandbox is hidden from others |
| `PULSE_PAYMENT_RECONCILE_SECRET` | Distinct random secret of at least 32 characters |
| `PULSE_PAYMENTS_LIVE_APPROVED` | Keep absent/false until live approval; then `true` |
| `PULSE_PAYMENTS_PAUSED` | `true` stops new checkout/setup actions without stopping reconciliation |

Enable Connect for independent venue-controlled accounts with the full Stripe dashboard. Register the exact OAuth redirect **https://pulsepb.com/player/payments** in the matching Stripe environment. OAuth state is hashed, owner/venue/environment-bound, expires in ten minutes and is consumed once before exchanging a code. A failed one-time exchange may require starting the connection again; do not reuse a captured code.

Configure **two separately signed snapshot event destinations** at:

`https://rqfqwavhtfwwtmfjnxkx.supabase.co/functions/v1/payment-webhook`

One receives PULSE platform events; the other receives **connected accounts** events. Use API version `2025-08-27.basil`, matching the server SDK. The complete required event lists are exported by `scripts/check-stripe-readiness.mjs`. Both need checkout completed/expired/async-success/async-failure, charge refunds, refund created/updated/failed, dispute created/closed. Platform also needs invoice.paid and customer.subscription.updated/deleted. Connect also needs account.updated and account.application.deauthorized.

The endpoint-listing preflight cannot prove the event-source scope, signing-secret correctness, delivery or fulfillment. Check those through actual signed Stripe sandbox events. Newer Workbench event destinations may require manual review if they are not returned by the legacy webhook-endpoint listing API.

## Recovery installation and operations

Store the same recovery secret in Edge Function secrets and Supabase Vault under `pulse_payment_reconcile_secret`. Use Vault's UI rather than placing the plaintext in a SQL script. Then run the entire file `supabase/operations/install-payment-reconciliation.sql` as the database administrator. This idempotently installs one five-minute job; it fails closed if Vault is not prepared. It is deliberately separate from the automatic migration.

Check `cron.job_run_details` and the corresponding `net._http_response` records. A green cron invocation only means the HTTP request was queued; verify HTTP 200 and `failed: 0` in the response. Monitor failures, oldest pending purchases, pending refund requests and Stripe event delivery failures. The current recovery pass handles up to 100 pending checkouts and 100 pending refunds per run. Invoice renewals and subscription status rely on signed webhook delivery; use Stripe event replay for missed renewals rather than assuming the checkout scheduler backfills all invoices.

To pause safely after launch, set `PULSE_PAYMENTS_PAUSED=true`; retain the active environment, credentials, webhooks and recovery job. This stops new PULSE checkout/resume/setup actions, but already-issued Stripe checkout links may still settle and must still be reconciled. Each venue can independently turn off accepting payments. A saved positive court price must never silently become free. Do not delete accounts, payment orders, subscriptions, holds or event evidence as a troubleshooting shortcut.

## Required sandbox acceptance (partially completed; see evidence above)

- Two actual, distinct connected sandbox venue accounts. Verify a venue cannot link the other account, access its finances, use its customer/card, open its receipt or refund its order. Verify PULSE's own account cannot be linked as a venue.
- New-account onboarding, existing-account OAuth, canceled/expired return, one-time state reuse rejection, wrong-owner/wrong-environment rejection, incomplete Stripe requirements, disconnect and reconnect of the same account.
- PULSE monthly add-on checkout and renewal/cancellation; venue funds remain untouched. A test purchase must not enable real modules or create real bookings.
- Paid rental with explicit merchant, total, USD, cancellation terms, venue time and consent; successful/declined/3DS/canceled/expired checkout, retry after a lost response, double-clicks and two players competing for one slot.
- A player in another device time zone sees the venue's actual court hours and occupied slots. Test midnight and spring/fall daylight-saving transitions. Staff closure times, grid and confirmed checkout must agree.
- Duplicate/out-of-order webhook delivery, delayed or failed fulfillment, scheduled recovery and refund notification arriving before checkout completion. Never manually mark an unpaid order paid to make a test pass.
- Partial/full/pending/failed refunds, insufficient venue balance, cancel without refund, decline request, purchase history and connected-account billing portals.
- Actual verified owner vs venue staff/community moderator; ownership transfer blocks access to the former owner's financial account. Private sample venues remain live-billing-disabled; only a separately authorized owner-only test exception is permitted.
- Web desktop, mobile browser and installed Android PWA navigation/return. No Android Studio or Google Play changes are part of this task.

After the above is recorded with evidence, request explicit live approval, verify live-mode destinations/keys/Connect client separately, and activate one verified venue first. Readiness checkmarks are setup assistance, not proof of a successful end-to-end payment or regulatory compliance.

## References

- [Stripe direct charges](https://docs.stripe.com/connect/direct-charges): connected-account payment ownership and account-scoped API calls.
- [Stripe Connect webhooks](https://docs.stripe.com/connect/webhooks): platform versus connected-account notifications.
- [Stripe hosted onboarding](https://docs.stripe.com/connect/hosted-onboarding): account links and rechecking account requirements after return.
- [Existing-account OAuth](https://docs.stripe.com/connect/oauth-standard-accounts): client IDs, redirects and one-time authorization exchange.
- [Supabase scheduled functions](https://supabase.com/docs/guides/functions/schedule-functions) and [Vault](https://supabase.com/docs/guides/database/vault): scheduled HTTP invocation and secure server-side credentials.
