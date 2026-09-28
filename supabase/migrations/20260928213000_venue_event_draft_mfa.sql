-- New tables must participate in PULSE's existing session-MFA policy gate.
-- The global Data API pre-request guard already protects the management RPCs.
BEGIN;
CREATE POLICY pulse_required_mfa ON public.venue_event_drafts
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.pulse_has_required_mfa()))
  WITH CHECK ((SELECT public.pulse_has_required_mfa()));
COMMIT;
