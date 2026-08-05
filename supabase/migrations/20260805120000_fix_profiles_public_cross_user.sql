-- =====================================================================
-- Fix cross-user profile name/avatar resolution (app-wide "TBD"/blank).
--
-- Regression:
--   Migration 20260201235224 dropped the cross-user SELECT policy
--   "Users can view limited public profile info" from public.profiles to
--   stop leaking PII (email / phone / DOB / emergency contacts) via direct
--   table reads. That intent was correct — BUT public.profiles_public is a
--   security_invoker view (flipped to invoker in 20251027141326), so it
--   evaluates under the CALLER's RLS on the base table. With only an
--   own-row SELECT policy left, a non-admin player can no longer resolve
--   ANY other player's name/avatar through profiles_public.
--
--   Symptom: league opponents & partners, teammates, leaderboards, and
--   other players' profile cards render as "TBD" / blank for everyone who
--   is not a platform admin. (Verified live: a non-admin session sees
--   exactly one row — its own — from profiles_public.)
--
-- Fix:
--   Make profiles_public a SECURITY DEFINER (security_invoker=off) view so
--   it bypasses the restrictive own-row policy and returns its curated,
--   NON-PII column set for every profile. This is exactly the behavior the
--   20260201235224 migration's own comment assumed ("or use the
--   profiles_public view for others"), and it is strictly safer than the
--   old cross-user policy: PII columns are NOT in this view, and the base
--   table's own-row + admin policies remain the ONLY way to read PII.
--
--   An auth.uid() guard keeps the view authenticated-only, preserving
--   today's behavior for anon (which already saw nothing through it — no
--   edge function or public page depends on anon reads here).
-- =====================================================================

CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker=off) AS
SELECT id, full_name, display_name, first_name, last_name, avatar_url,
       current_rating, total_matches, wins, losses, handedness, play_side,
       paddle_brand, paddle_model, handle, created_at, gender
FROM public.profiles
-- Authenticated callers only; anon keeps seeing nothing through this view.
WHERE auth.uid() IS NOT NULL;

GRANT SELECT ON public.profiles_public TO authenticated, anon;
