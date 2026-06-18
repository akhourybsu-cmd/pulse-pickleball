-- =====================================================================
-- Push dispatch (Community Phase 3.3).
--
-- Wires user_notifications → push-send edge function via pg_net's async
-- HTTP client. We do NOT block the INSERT on the network call — pg_net
-- queues the request and a background worker delivers it.
--
-- Setup the deployer must do once:
--   1. Generate VAPID keys ( npx web-push generate-vapid-keys )
--   2. Set Supabase secrets:
--        VAPID_PUBLIC_KEY   — public part
--        VAPID_PRIVATE_KEY  — private part
--        VAPID_CONTACT      — mailto:you@…
--   3. Set the Postgres GUC `app.settings.push_send_url` to the
--      deployed push-send function URL. Example:
--        ALTER DATABASE postgres SET app.settings.push_send_url =
--          'https://<project>.supabase.co/functions/v1/push-send';
--   4. Set the GUC `app.settings.service_role_key` to the service role
--      key so pg_net can authenticate.
--
-- Without those settings the trigger silently no-ops (we read NULL and
-- skip the http call) so the in-app notification still works.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.dispatch_push_for_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url   text;
  v_key   text;
BEGIN
  -- Resolve URL + auth from the GUCs. Either being NULL = push not
  -- configured → no-op (in-app notification still landed).
  BEGIN
    v_url := current_setting('app.settings.push_send_url', true);
    v_key := current_setting('app.settings.service_role_key', true);
  EXCEPTION WHEN OTHERS THEN
    v_url := NULL;
  END;

  IF v_url IS NULL OR v_url = '' OR v_key IS NULL OR v_key = '' THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || v_key
               ),
    body    := jsonb_build_object(
                 'user_id', NEW.user_id,
                 'title',   NEW.title,
                 'body',    NEW.message,
                 'url',     NEW.link,
                 'tag',     COALESCE(NEW.notification_type, 'pulse'),
                 'priority', COALESCE(NEW.priority, 'normal')
               )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_user_notification_dispatch_push ON public.user_notifications;
CREATE TRIGGER on_user_notification_dispatch_push
AFTER INSERT ON public.user_notifications
FOR EACH ROW
EXECUTE FUNCTION public.dispatch_push_for_notification();
