-- External Supabase production bootstrap for PULSE Pickleball.
--
-- This migration replaces Lovable-managed cron metadata with portable
-- pg_cron + pg_net jobs. A database-generated secret authenticates scheduled
-- calls without embedding a Supabase API key in source control.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS private.app_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO private.app_config (key, value)
VALUES
  ('edge_functions_base_url', 'https://rqfqwavhtfwwtmfjnxkx.supabase.co/functions/v1'),
  ('push_send_url', 'https://rqfqwavhtfwwtmfjnxkx.supabase.co/functions/v1/push-send')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();

INSERT INTO private.app_config (key, value)
VALUES ('scheduled_task_secret', encode(extensions.gen_random_bytes(32), 'hex'))
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_valid_scheduled_task_secret(p_secret text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT COALESCE(p_secret, '') <> ''
    AND EXISTS (
      SELECT 1
      FROM private.app_config
      WHERE key = 'scheduled_task_secret'
        AND value = p_secret
    );
$$;

REVOKE ALL ON FUNCTION public.is_valid_scheduled_task_secret(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_valid_scheduled_task_secret(text) TO service_role;

DO $$
DECLARE
  v_job_id bigint;
BEGIN
  SELECT jobid INTO v_job_id
  FROM cron.job
  WHERE jobname = 'cleanup-old-court-messages';

  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;
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
      body := '{}'::jsonb
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
      body := '{}'::jsonb
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
      body := '{}'::jsonb
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
      body := '{}'::jsonb
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
      body := '{}'::jsonb
    );
  $job$
);
