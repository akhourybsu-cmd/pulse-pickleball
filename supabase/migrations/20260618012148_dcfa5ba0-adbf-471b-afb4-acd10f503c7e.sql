
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.app_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed config (idempotent). Shared secret is random; URL is the project's edge endpoint.
INSERT INTO private.app_config (key, value) VALUES
  ('push_send_url', 'https://ryxklkayezjnwwunuphn.supabase.co/functions/v1/push-send'),
  ('push_dispatch_secret', encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (key) DO NOTHING;

-- Trigger function: fire-and-forget HTTP POST to push-send for each new notification
CREATE OR REPLACE FUNCTION public.dispatch_push_for_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_url text;
  v_secret text;
BEGIN
  SELECT value INTO v_url FROM private.app_config WHERE key = 'push_send_url';
  SELECT value INTO v_secret FROM private.app_config WHERE key = 'push_dispatch_secret';

  IF v_url IS NULL OR v_secret IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-dispatch-secret', v_secret
    ),
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'title', NEW.title,
      'body', NEW.message,
      'url', NEW.link,
      'tag', COALESCE(NEW.notification_type, 'pulse'),
      'priority', COALESCE(NEW.priority, 'normal')
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block notification creation if push dispatch fails
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_user_notification_dispatch_push ON public.user_notifications;
CREATE TRIGGER on_user_notification_dispatch_push
AFTER INSERT ON public.user_notifications
FOR EACH ROW EXECUTE FUNCTION public.dispatch_push_for_notification();
