BEGIN;
-- New public tables must also enforce PULSE's session verification policy.
-- This is restrictive: league membership is still required by the read policy.
DROP POLICY IF EXISTS pulse_required_mfa ON public.league_posts;
CREATE POLICY pulse_required_mfa ON public.league_posts AS RESTRICTIVE
  FOR ALL TO authenticated
  USING ((SELECT public.pulse_has_required_mfa()))
  WITH CHECK ((SELECT public.pulse_has_required_mfa()));
COMMIT;
