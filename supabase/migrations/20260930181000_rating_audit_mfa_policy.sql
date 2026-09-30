-- All public tables carry the platform's restrictive MFA policy, including
-- service-only audit tables. This grants no additional client access.
CREATE POLICY pulse_required_mfa ON public.rating_cache_repair_audit
AS RESTRICTIVE FOR ALL TO authenticated
USING ((SELECT public.pulse_has_required_mfa()))
WITH CHECK ((SELECT public.pulse_has_required_mfa()));
