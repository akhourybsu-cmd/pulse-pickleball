-- Operational setup, not an automatic schema migration. Run only after deploying
-- payment-reconcile and storing the SAME random secret in Supabase Edge secrets
-- (PULSE_PAYMENT_RECONCILE_SECRET) and Vault (pulse_payment_reconcile_secret).
-- Add the secret through the Vault UI; never paste its value into source control.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM vault.decrypted_secrets WHERE name='pulse_payment_reconcile_secret' AND length(decrypted_secret)>=32) THEN
    RAISE EXCEPTION 'Store the matching payment recovery secret in Vault before installing the job';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.invoke_payment_reconciliation()
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE recovery_secret text; request_id bigint;
BEGIN
  SELECT decrypted_secret INTO recovery_secret FROM vault.decrypted_secrets WHERE name='pulse_payment_reconcile_secret';
  IF recovery_secret IS NULL OR length(recovery_secret)<32 THEN RAISE EXCEPTION 'Payment recovery is not configured'; END IF;
  SELECT net.http_post(
    url:='https://rqfqwavhtfwwtmfjnxkx.supabase.co/functions/v1/payment-reconcile',
    headers:=jsonb_build_object('Content-Type','application/json','x-payment-reconcile-secret',recovery_secret),
    body:='{}'::jsonb,
    timeout_milliseconds:=120000
  ) INTO request_id;
  RETURN request_id;
END $$;
REVOKE ALL ON FUNCTION public.invoke_payment_reconciliation() FROM PUBLIC,anon,authenticated,service_role;

-- Re-running with the same name updates the job rather than duplicating it.
SELECT cron.schedule('pulse-payment-reconciliation','*/5 * * * *','SELECT public.invoke_payment_reconciliation()');
COMMIT;

-- As the database administrator, verify cron.job_run_details AND the associated
-- net._http_response record. Cron success means queued, not payment recovery success.
-- Stop only this job if necessary:
-- SELECT cron.unschedule('pulse-payment-reconciliation');
