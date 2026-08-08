-- =====================================================================
-- Re-assert public.profiles_public as a SECURITY DEFINER view.
--
-- Symptom (reported live on a non-admin testing account): other users'
-- names/avatars render as "Player" / "Someone" / "TBD" / blank across
-- friends, chat, community, round robin, and leagues.
--
-- Root cause: those surfaces already resolve names through
-- public.profiles_public (correct). But profiles_public only returns other
-- users' rows when it is a SECURITY DEFINER view (security_invoker=off) —
-- otherwise it evaluates under the caller's own-row RLS on public.profiles
-- and a non-admin sees exactly one row (their own). The intended fix lives
-- in 20260805120000_fix_profiles_public_cross_user.sql, but if that
-- migration was not applied to a given database the view is still in
-- security_invoker mode and every cross-user name breaks.
--
-- This migration is idempotent and safe to run anywhere: it simply
-- (re)defines the view with security_invoker=off and the same curated,
-- NON-PII column set. PII (email/phone/DOB/emergency contacts/location) is
-- NOT in this view; the base table's own-row + admin policies remain the
-- only way to read PII. An auth.uid() guard keeps it authenticated-only.
-- =====================================================================

CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker=off) AS
SELECT id, full_name, display_name, first_name, last_name, avatar_url,
       current_rating, total_matches, wins, losses, handedness, play_side,
       paddle_brand, paddle_model, handle, created_at, gender
FROM public.profiles
WHERE auth.uid() IS NOT NULL;

GRANT SELECT ON public.profiles_public TO authenticated, anon;
