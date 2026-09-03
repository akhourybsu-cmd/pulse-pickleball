-- Make in-app notification creation a trusted server-side responsibility.
--
-- Match approval rows already invoke notify_match_verification_needed(), so
-- the browser-side insert was both redundant and dependent on a dangerously
-- broad WITH CHECK (true) policy. Edge Functions use the service role and
-- database producers run in reviewed SECURITY DEFINER functions; neither
-- depends on grants to anon or authenticated.

CREATE OR REPLACE FUNCTION public.notify_match_verification_needed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_actor_id uuid;
BEGIN
  IF NEW.approved IS NULL OR NEW.approved = false THEN
    SELECT m.created_by
      INTO v_actor_id
      FROM public.matches AS m
     WHERE m.id = NEW.match_id;

    PERFORM public.create_notification(
      NEW.player_id,
      'match_verification_needed',
      'matches',
      'New match needs your verification',
      'A teammate submitted a match — tap to confirm the result.',
      '/player/matches?tab=pending',
      'high',
      jsonb_build_object(
        'match_id', NEW.match_id,
        'approval_id', NEW.id
      ),
      v_actor_id,
      now() + interval '3 days'
    );
  END IF;

  RETURN NEW;
END;
$function$;

DROP POLICY IF EXISTS "System can insert notifications"
  ON public.user_notifications;

REVOKE INSERT ON public.user_notifications FROM anon, authenticated;

GRANT INSERT ON public.user_notifications TO service_role;
