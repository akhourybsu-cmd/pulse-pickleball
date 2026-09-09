# ELEVENO free tier and owner upgrade clarity

User request: reset the ELEVENO test venue to free community access and make the owner's upgrade path clear.

## Production data change

- Exact target: ELEVENO venue `4ee96566-4074-41c0-aa2b-2d767bdb50e1`, community `e3e97754-ac66-4814-94f3-ae3391de4e33`.
- Read-only preflight: both optional modules had enabled `existing_venue` grants; no live payment orders or active live subscriptions were found. The actual recorded owner remains Dhruv P. The current Alex Khoury session is management, not the financial owner.
- Disabled both existing grants without deleting the grant rows, courts, events, members, posts or staff. Updated only the product-model marker and disabled rental collections if a settings row existed. Ownership and verification were left unchanged.
- Reset fails closed if the target name/community changed or paid obligations appeared. Other venues are unaffected. On environments without the ELEVENO ID, only the general reactivation fix is installed.
- The database update deployed successfully through [Deploy Supabase](https://github.com/akhourybsu-cmd/pulse-pickleball/actions/runs/34397241904).

Complete copy/paste migration: `supabase/migrations/20260919100000_eleveno_free_tier_and_upgrade_reactivation.sql`. It has already been applied through the migration runner; do not rerun it on production after purchasing features.

## Upgrade experience

- Venue management entry reads **Manage venue**. An owner/manager shortcut opens **Plan & upgrades** directly; the free-venue management overview shows the same guide.
- Shows the current plan and free essentials, with $0/month clearly attributed to the community base rather than implying all add-ons are free.
- Explains verification → feature selection → secure Stripe checkout. One feature is $10 USD/month; both are $20/month, independently managed.
- Feature reviews remain usable before Stripe is enabled, and by managers previewing options. Purchasing still requires the actual `venues.owner_id`, verification, ready payment configuration and explicit renewal consent. Community-owner/staff labels alone do not unlock financial actions.
- Clearly states when checkout is unavailable. No live charging or Stripe account changes are part of this release.
- Disabled or expired legacy/staff grants can transition to a paid subscription after verified payment. Active included grants remain included and are not silently converted to subscriptions.

## Verification

- Full suite: 886 passed, 32 skipped, 10 todo. Includes reset scope/retention, paid-obligation guards, disabled-grant reactivation and owner/verification/checkout-state tests.
- All 10 migration-runner tests passed. Final production web build passed in 54.73 seconds; existing bundle warnings remain.
- No diagnostics for the touched upgrade/venue screens in the application TypeScript check; unrelated existing diagnostics remain elsewhere.
- Local owner preview: unverified-owner review routes to free verification; verified-owner review clearly shows checkout unavailable. Mobile preview uses a 390px iframe (388px inner width after border), with equal client/scroll width, readable feature cards and a bounded dialog. This is not live Stripe end-to-end testing.
- Website and Android PWA only; Android Studio / Google Play unchanged.
