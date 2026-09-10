# Venue Stripe readiness pass

Prepared after published baseline `87146a9527b2b686d86115d3dfddd98728c662c7`. Backend commit `3655049222e3d5f2f2d18613821888e705877de2` is deployed: [Supabase run 34468994469](https://github.com/akhourybsu-cmd/pulse-pickleball/actions/runs/34468994469) passed its migration and Edge Function steps. The web/PWA release follows that successful backend rollout. No live payment configuration or venue funds were changed. Android Studio and Google Play were not touched.

## Changes

- Per-venue owner-only setup checklist; existing-account OAuth and explicitly confirmed new-account onboarding; Stripe account requirement status, reconnect flow and account-specific dashboard links.
- One-time hashed OAuth state bound to owner, venue and environment. Server-side current ownership checks, private-sample billing prohibition and transactional account binding prevent reuse/replacement across venues.
- Financial ownership remains separate from community ownership, including refund authority. PULSE $10/month feature billing stays separate from venue direct-charge rental revenue.
- Merchant-scoped billing portal configuration, customers and saved payment methods; no card numbers, security codes, bank credentials or OAuth tokens stored in PULSE.
- Paid-rate drafts and paused collections cannot fall through to free reservations. Minimum rates protect the shortest paid booking; explicit policy/merchant/total consent and double-submit protection remain in the player flow.
- Only succeeded refunds count as returned money. Pending refunds keep reservations in place, and recovery checks pending refund requests as well as checkouts.
- Account deauthorization blocks new collections; paused-new-checkout configuration preserves historical payment processing and recovery.
- Venue calendar query bounds, court grid, Today labels, staff availability/closures and booking confirmation use the configured venue time zone. Saving payment settings synchronizes the calendar time zone. Tests cover remote viewers, midnight and 23/25-hour DST days.
- Read-only Stripe preflight, complete rollout checklist and separately gated five-minute recovery installation SQL.

## Validation

- Final full suite: **1,103 passed, 32 skipped, 10 todo**; 86 passing files and 3 skipped files (89 total).
- Production Vite web/PWA build: **passed**, 4,701 modules. Existing bundle-size, outdated Browserslist and ambiguous Tailwind-duration warnings remain.
- Deno checks for `payments`, `payment-webhook`, `payment-reconcile`: **passed**.
- `git diff --check`: **passed**.
- Desktop and 390px phone finance previews inspected using non-personal sample data and blocked actions. This is layout QA, not a Stripe transaction test.
- The new preflight was run against the local process environment and correctly reported payment configuration unavailable/off. This does not inspect or prove the deployed Supabase secrets. No Stripe credentials were loaded or verified during this pass.
- Repository-wide TypeScript checking still reports pre-existing errors in tournament generated-schema types, chat/realtime types, round-robin `unusedCourts`, Dashboard profile typing and player preview callback types. No errors were reported in the changed venue/payment files. These unrelated errors were not changed as part of payment preparation.

## Still required before live charging

The migration and functions have deployed before the frontend. Configure and verify the PULSE Stripe sandbox account, Connect client/redirect, separate platform/Connect signing secrets and recovery job. The signed-in Stripe dashboard confirms the PULSE platform account `acct_1ShZSOG2WbAqAcDM`; that alone does not verify sandbox configuration. Execute the two-venue sandbox acceptance matrix, including failure/retry/refund/renewal and Android PWA return behavior. Only then approve live credentials and activate collections per venue.

For rental sandbox testing, use a verified, non-private test venue with court-booking access already provisioned. Test subscription purchases intentionally do not grant real feature access. Do not change ELEVENO's tier or use the private sample venue as a way around billing safeguards without a separate authorized setup decision.

Scheduled recovery does not automatically backfill every missed subscription renewal; failed invoice deliveries require Stripe event replay and monitoring as documented. The operational scheduler SQL is supplied but has not been executed against hosted pg_cron/pg_net/Vault.

## Complete files for copy/paste and setup

- Schema migration: [20260921100000_venue_stripe_readiness.sql](../../supabase/migrations/20260921100000_venue_stripe_readiness.sql)
- Optional recovery installation: [install-payment-reconciliation.sql](../../supabase/operations/install-payment-reconciliation.sql)
- Account setup, event lists and acceptance matrix: [Stripe launch checklist](../payments/stripe-launch.md)

Both SQL files are complete, not excerpts. The schema migration belongs in the normal migration history; the operational scheduler script requires its matching Vault secret before execution.
