## Problem

Two league migrations sit unapplied on the live database:

- `20260703320000_league_ownership_and_self_serve.sql` — self-serve league ownership, `is_league_admin()` helper, refactored RLS policies on all league tables, and the `create_league()` RPC.
- `20260703330000_league_paid_slots.sql` — `profiles.additional_league_slots` column, `league_slot_purchases` ledger table, `get_league_creation_capacity()` and `increment_league_slots()` RPCs, and the updated `create_league()` that honors purchased slots.

Verified against `pg_proc` / `information_schema` on the live DB:

- `create_league`, `get_league_creation_capacity`, `is_league_admin`, `increment_league_slots` — all missing.
- `public.league_slot_purchases` table — missing.
- `profiles.additional_league_slots` column — missing.

Frontend/edge code that will fail today because of this:

- `src/components/leagues/CreateLeagueDialog.tsx` → `supabase.rpc("create_league")` → **users cannot create leagues at all**.
- `src/hooks/useLeagueCreationCapacity.ts` → `get_league_creation_capacity` → paywall/quota card in dialog shows nothing.
- `supabase/functions/verify-league-slot-purchase/index.ts` → touches `increment_league_slots` and `league_slot_purchases` → paid slot fulfillment crashes.
- `src/pages/admin/AdminLeagueDetail.tsx` → depends on `is_league_admin`-based RLS so league creators can manage their own league without the platform-admin role.

Same failure mode as last time (the 230000–310000 bundle): the file exists in the repo but Supabase never picked it up, so it needs to be re-issued under a fresh timestamp.

Everything else about the league feature is already live and working: the 17 league RPCs listed in `pg_proc` cover join by code, score submission, verification, disputes, forfeits, notifications, upcoming-matches widget, season aggregates, bulk add, and the audit log.

## Plan

Ship one new bundled migration that concatenates the two unapplied files verbatim. Both are already idempotent (`CREATE OR REPLACE FUNCTION`, `IF NOT EXISTS`, `DROP POLICY IF EXISTS` before each `CREATE POLICY`), so re-running is safe even if part of them ever ran.

### Migration contents (in order)

1. `is_league_admin(league_id, user_id)` SECURITY DEFINER helper + grant to `authenticated`.
2. Drop `"Admins full access"` / `"League admins full access"` policies on the 9 league tables and re-create using `is_league_admin`. Leagues table's `WITH CHECK` also allows `created_by = auth.uid()` so INSERT works.
3. Re-issue admin-gated RPCs so they accept league-scoped admins: `log_league_action`, `resolve_league_match_dispute`, `forfeit_league_match` (also accepts captains), `sync_league_season_statuses`, `bulk_add_league_members`, `get_league_season_aggregates`.
4. `create_league(name, description, location, league_type)` self-serve entrypoint. Non-admins limited to `1 + additional_league_slots`; over-quota raises SQLSTATE 53300 with hint `league_quota_exceeded` so the client opens the paywall.
5. `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS additional_league_slots INT NOT NULL DEFAULT 0`.
6. `CREATE TABLE IF NOT EXISTS public.league_slot_purchases` (id, user_id → profiles, stripe_session_id UNIQUE, stripe_customer_id, amount_cents, currency, slots_granted, status, timestamps) with:
   - `GRANT SELECT, INSERT, UPDATE, DELETE ON ... TO authenticated`
   - `GRANT ALL ... TO service_role`
   - `ENABLE ROW LEVEL SECURITY`
   - policy: users see own rows; admins full access. Writes gated to service role only via the edge function.
7. `get_league_creation_capacity(user_id)` — returns `(owned, max_leagues, remaining, is_admin)`. Grant to `authenticated`.
8. `increment_league_slots(user_id, delta)` — SECURITY DEFINER, REVOKE from PUBLIC, GRANT only to `service_role` (called by the Stripe verify edge function).
9. Final `create_league()` re-definition that honors purchased slots (supersedes step 4's stub).

### Verification after apply

- `pg_proc` contains `create_league`, `get_league_creation_capacity`, `is_league_admin`, `increment_league_slots`.
- `to_regclass('public.league_slot_purchases')` returns non-null.
- `profiles.additional_league_slots` column exists.
- Manual smoke via the Create League dialog: dialog renders capacity, submitting creates a draft/private league, second attempt as a non-admin raises the paywall (SQLSTATE 53300).
- Join-by-code, score submit, and dashboard "Up next in leagues" continue to work (they already do — 17 league RPCs live).

### Not in scope

No frontend changes. `src/integrations/supabase/types.ts` will regenerate automatically after the migration lands. No edits to `create_league_checkout` or `verify-league-slot-purchase` edge functions — they were already coded against these RPCs.
