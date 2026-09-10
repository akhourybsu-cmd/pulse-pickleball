# Stripe sandbox configuration and verification

Completed with the user's explicit approval on September 10, 2026. This configures sandbox infrastructure, not a live payment launch or completed venue transaction acceptance.

## Configuration applied

- Verified the signed-in PULSE platform account `acct_1ShZSOG2WbAqAcDM` in Stripe test mode. Reused its existing test key; no live keys or account credentials were rotated.
- Saved eleven server-only PULSE settings in Supabase project `rqfqwavhtfwwtmfjnxkx`. Compared each saved SHA-256 digest with the supplied value. Final mode is `test`, new sandbox actions are unpaused, module billing is monthly, and live approval remains `false`.
- Sandbox access is limited to the verified application user `fff594fe-02ea-439c-a974-72e1f6295f08` (akhourybsu@gmail.com). Other users remain behind the existing server-side test allowlist.
- Enabled test OAuth for Stripe Dashboard accounts, with exact default redirect `https://pulsepb.com/player/payments` and test client ID `ca_TetF9Kw34iqzFwsRWddzocegNkJ7b82z`.
- Created two enabled, separately signed snapshot webhook endpoints, both using API version `2025-08-27.basil` and the deployed Supabase `payment-webhook` URL. Stripe's creation form did not offer that older API version, so its authenticated sandbox Shell was used with explicit parameters.

| Scope | Endpoint ID | Selected events |
| --- | --- | --- |
| PULSE / Your account | `we_1UE6JTG2WbAqAcDMjVsUL1cK` | 13 platform events from the launch checklist |
| Connected venues / Connected accounts | `we_1UE6JqG2WbAqAcDMYsit5g8W` | 12 Connect events from the launch checklist |

The Stripe UI independently confirmed the two event-source scopes. No existing webhook endpoints were present or replaced. Secret values were transferred through approved secret forms without being printed or committed.

## Recovery

- Generated a distinct cryptographically random recovery secret, stored it in Edge secrets and Vault (`pulse_payment_reconcile_secret`), and verified the Vault value matched using a digest-only SQL check.
- Applied the complete [recovery installer](../../supabase/operations/install-payment-reconciliation.sql). Before installation, the recovery function did not exist and no matching job existed.
- Confirmed exactly one active job: ID `26`, name `pulse-payment-reconciliation`, every five minutes, invoking `public.invoke_payment_reconciliation()`. Public, anonymous, authenticated and service-role invocation privileges were revoked by the installer.
- Manual HTTP request `10232` returned `200`, no timeout, and `{"checked":0,"refunds_checked":0,"failed":0}`. This exercised the real deployed handler and Stripe account verification, not only a queued SQL invocation.
- Cron run `14383` succeeded at `2026-09-10 11:50:00 UTC`; HTTP response `10237` in its execution window returned the same successful result. There were no pending orders or refunds to recover, so recovery of a real pending transaction remains untested.

## Verification performed

- The signed-in production Payments & purchases screen showed the test-only warning and enabled sandbox payment-method controls without an error. This is browser verification, not an installed Android PWA return test.
- Stripe's official sandbox fixture command generated `checkout.session.completed` event `evt_1UE6RmG2WbAqAcDMbzxqPuaU`. The platform endpoint returned HTTP `200` / `Processed` at `11:47:20 UTC`, and the matching test event was recorded in PULSE.
- Manual replay returned HTTP `200` / `Already processed` at `11:49:21 UTC`. The database retained exactly one copy. The fixture had no PULSE order metadata and did not activate an add-on or reserve a court. Stripe generated disposable test fixture objects, including a simulated $30 checkout; no real money moved.
- Unauthenticated negative probes: recovery without its secret returned `401`, webhook without a signature returned `400`, payments without sign-in returned `400`.
- ELEVENO remained a free venue. Its manager view correctly did not grant the current user owner-level subscription/financial authority. No ownership, verification, rates, access tier or live collection switches were changed.
- No app source code, Android Studio or Google Play changes were made in this configuration step. Existing deployed code remains the previously tested release.

## Remaining before live payment approval

At the end of this configuration phase, the connected-account endpoint had not received a linked-venue test event. ELEVENO identifies the tester as a manager, and Palace initially blocked all billing. The user subsequently explicitly authorized adapting private Pickleball Palace for test payments; the separately deployed sandbox-only permission and acceptance results are recorded in the [Palace sandbox follow-up](2026-09-10-palace-payment-sandbox.md). Its privacy and live-payment prohibitions remain intact.

Provision suitable dedicated test venues with explicit authorization, then execute the complete [two-venue acceptance matrix](../payments/stripe-launch.md): actual account onboarding/OAuth return, merchant isolation, add-on subscription lifecycle, venue checkout, failed/expired payments, refunds, pending-order recovery and installed PWA returns. The fixture event above does not prove any of those purchase workflows. Live keys, live event destinations and real venue collection activation still require separate approval after acceptance.
