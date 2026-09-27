-- New public tables must retain the application-wide restrictive MFA policy.
-- Direct client grants remain closed; management uses the authorized RPCs.
BEGIN;

CREATE POLICY pulse_required_mfa
ON public.venue_address_connections
AS RESTRICTIVE FOR ALL TO authenticated
USING ((SELECT public.pulse_has_required_mfa()))
WITH CHECK ((SELECT public.pulse_has_required_mfa()));

COMMIT;
