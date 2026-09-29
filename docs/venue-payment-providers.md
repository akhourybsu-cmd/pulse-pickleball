# Venue payment providers

PULSE now has one venue Payments hub. Connections, provider capabilities, account location, the front-desk default, transactions and policies are available from the same venue workspace.

## Current coverage

| Channel | Stripe | Square | Cash |
| --- | --- | --- | --- |
| Self-service court and event checkout | Existing support | Not implemented | Not applicable |
| One-time front-desk purchases, walk-ins and lesson/private-booking deposits | Supported | Adapter implemented; activation gated | Recorded by authorized staff |
| Recurring memberships and PULSE subscriptions | Existing support | Not implemented | Not recurring |
| Refunds, receipts and venue totals | Supported | Adapter implemented; activation gated | Recorded separately |
| Card terminal pairing | Not provided by this release | Not implemented | Not applicable |

Clover, PayPal, Authorize.net and Adyen are explicitly marked **Not yet available**. The venue can record interest; this does not connect an account or enable checkout. Add each adapter only after its onboarding, checkout, settlement, refund and webhook behavior is implemented and tested.

## Square platform configuration

Use the existing Square business through OAuth. Venue staff never enter access tokens in PULSE. Credentials are stored in Supabase Vault, with service-only access and ownership-bound connection records.

Configure the Square Developer application and Supabase runtime secrets through their secure settings. Do not paste credentials into chat, source files or workflow output.

| Runtime setting | Purpose |
| --- | --- |
| `PULSE_SQUARE_MODE` | `test` or `live`; absent disables Square |
| `PULSE_SQUARE_APPLICATION_ID` | Application ID for the selected environment |
| `PULSE_SQUARE_APPLICATION_SECRET` | Application secret for the selected environment |
| `PULSE_SQUARE_WEBHOOK_SIGNATURE_KEY` | Signing key for the selected environment and endpoint |
| `PULSE_SQUARE_LIVE_APPROVED` | Must be exactly `true` before live mode is accepted |
| `SUPABASE_URL` | Existing backend URL, also used in signature verification |

Register this exact OAuth redirect:
`https://pulsepb.com/player/payments?payment_provider=square`

Register this exact webhook notification URL for the production backend:
`https://rqfqwavhtfwwtmfjnxkx.supabase.co/functions/v1/square-webhook`

The adapter uses API version `2026-09-16`. OAuth requests merchant profile read, orders read/write, payments read/write and disputes read. Subscribe to payment, refund and order updates, dispute changes and OAuth authorization revocation. The handler verifies signatures on the raw body, then fetches authoritative payment state; event payloads alone never fulfill a purchase. The existing scheduled payment reconciler recovers missed notifications.

### Activation checks still required

No real Square account or charge was used during implementation. Local checks use mocked Square API responses and real isolated PostgreSQL migrations. They do not replace a provider sandbox run.

1. Configure a sandbox application first and verify OAuth, single-use state, location selection, revocation and reconnection. Sandbox connections are labeled and cannot become the live desk default. Production desk reservation RPCs intentionally require live mode; sandbox payment contract testing must use an isolated backend/provider harness, not live venue bookings.
2. Validate create-link, actual sandbox payment completion, cancellation, missed/duplicate webhook recovery, partial/full/pending/failed refunds and token refresh against Square. Confirm exact totals and the original merchant/location throughout.
3. Only after those pass, configure production credentials and the exact webhook URL, set the live approval flag and live mode, and have the venue owner connect their account. Select an active USD card-processing location, verify it and choose **Use at front desk**. Existing `PULSE_PAYMENTS_MODE=live` and the collection pause switch also apply.
4. A real-money smoke purchase requires explicit authorization for its amount. Verify receipt, venue totals and refund settlement before broad rollout.

## Operational behavior

Changing the desk default affects new one-time purchases. Existing orders retain their provider, merchant and location; recurring memberships continue through Stripe. A provider outage does not silently redirect funds to another account or cash. Pausing stops new Square checkouts but does not invalidate previously shared links; cancel those purchases individually when necessary.

PULSE confirms order reference, location, currency, amount and completed payment before fulfillment. It retains inventory and court holds when cancellation cannot be verified. Refund submission and refund settlement are separate; pending or failed refunds are not reported as money returned. Reports separate Stripe, Square and cash.

A financial ownership or payment location change after transaction history requires a managed transfer to retain refund access. Reconnecting the same merchant is supported. This release does not offer automatic merchant reassignment, multi-currency collections, terminal pairing or a Square saved-card wallet.

## Provider references

- [Square OAuth](https://developer.squareup.com/docs/oauth-api/overview)
- [Create payment links](https://developer.squareup.com/reference/square/checkout-api/create-payment-link)
- [Delete payment links](https://developer.squareup.com/reference/square/checkout-api/delete-payment-link)
- [Webhook signature verification](https://developer.squareup.com/docs/webhooks/step3validate)
- [Token management](https://developer.squareup.com/docs/oauth-api/receive-and-manage-tokens)
