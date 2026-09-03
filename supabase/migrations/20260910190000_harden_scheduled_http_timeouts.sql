-- Give scheduled Edge Function calls enough time to survive cold starts and
-- short processing spikes. pg_net defaults to 5 seconds, which produced
-- intermittent transport timeouts even though subsequent runs succeeded.

DO $$
DECLARE
  v_job_id bigint;
BEGIN
  FOR v_job_id IN
    SELECT jobid
    FROM cron.job
    WHERE jobname = ANY (ARRAY[
      'send-event-reminders',
      'process-waitlist',
      'process-email-queue',
      'cleanup-old-messages',
      'delete-old-posts'
    ])
  LOOP
    PERFORM cron.unschedule(v_job_id);
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'send-event-reminders',
  '*/10 * * * *',
  $job$
    SELECT net.http_post(
      url := (SELECT value FROM private.app_config WHERE key = 'edge_functions_base_url') || '/send-event-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-dispatch-secret', (SELECT value FROM private.app_config WHERE key = 'scheduled_task_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 20000
    );
  $job$
);

SELECT cron.schedule(
  'process-waitlist',
  '*/5 * * * *',
  $job$
    SELECT net.http_post(
      url := (SELECT value FROM private.app_config WHERE key = 'edge_functions_base_url') || '/process-waitlist',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-dispatch-secret', (SELECT value FROM private.app_config WHERE key = 'scheduled_task_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 20000
    );
  $job$
);

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
      body := '{}'::jsonb,
      timeout_milliseconds := 20000
    );
  $job$
);

SELECT cron.schedule(
  'cleanup-old-messages',
  '0 */6 * * *',
  $job$
    SELECT net.http_post(
      url := (SELECT value FROM private.app_config WHERE key = 'edge_functions_base_url') || '/cleanup-old-messages',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-dispatch-secret', (SELECT value FROM private.app_config WHERE key = 'scheduled_task_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 20000
    );
  $job$
);

SELECT cron.schedule(
  'delete-old-posts',
  '0 3 * * *',
  $job$
    SELECT net.http_post(
      url := (SELECT value FROM private.app_config WHERE key = 'edge_functions_base_url') || '/delete-old-posts',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-dispatch-secret', (SELECT value FROM private.app_config WHERE key = 'scheduled_task_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 20000
    );
  $job$
);
