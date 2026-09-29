BEGIN;
-- Match PULSE's defense-in-depth requirement for every public table.
-- Browser grants remain revoked; these restrictive policies grant no access.
DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['venue_email_connections','venue_email_preferences','venue_email_campaigns','venue_email_outbox'] LOOP
  EXECUTE format('CREATE POLICY pulse_required_mfa ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.pulse_has_required_mfa())) WITH CHECK ((SELECT public.pulse_has_required_mfa()))',t);
 END LOOP;
END $$;
COMMIT;
