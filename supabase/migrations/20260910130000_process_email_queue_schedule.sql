-- Ensure queued transactional email is delivered on external Supabase.
--
-- The original Lovable setup installed this schedule out-of-band. This
-- portable replacement uses the database-generated dispatch secret from the
-- external Supabase bootstrap, so no service-role JWT is stored in SQL.

DO $$
DECLARE
  v_job_id bigint;
BEGIN
  SELECT jobid INTO v_job_id
  FROM cron.job
  WHERE jobname = 'process-email-queue';

  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;
END;
$$;

SELECT cron.schedule(
  'process-email-queue',
  '* * * * *',
  $job$
    SELECT net.http_post(
      url := (SELECT value FROM private.app_config WHERE key = 'edge_functions_base_url') || '/process-email-queue',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-dispatch-secret', (SELECT value FROM private.app_config WHERE key = 'scheduled_task_secret')
      ),
      body := '{}'::jsonb
    );
  $job$
);
