-- Every public table participates in the session-MFA release invariant,
-- including audit tables that have no browser grants or permissive policies.
BEGIN;
REVOKE ALL ON public.venue_attendance_audit FROM PUBLIC, anon, authenticated;
CREATE POLICY pulse_required_mfa ON public.venue_attendance_audit
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.pulse_has_required_mfa()))
  WITH CHECK ((SELECT public.pulse_has_required_mfa()));
COMMIT;
