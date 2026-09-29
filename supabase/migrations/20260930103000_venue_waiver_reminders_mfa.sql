BEGIN;
-- Every public table participates in PULSE's session-MFA release invariant,
-- including internal tracking tables without browser grants.
CREATE POLICY pulse_required_mfa ON public.venue_waiver_reminders
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.pulse_has_required_mfa()))
  WITH CHECK ((SELECT public.pulse_has_required_mfa()));
COMMIT;
