
-- 1. Smarter approval trigger: majority + rejection handling
CREATE OR REPLACE FUNCTION public.auto_approve_match_on_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  approved_count INT;
  rejected_count INT;
  total_players INT;
  threshold INT;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE approved = true),
    COUNT(*) FILTER (WHERE approved = false),
    COUNT(*)
  INTO approved_count, rejected_count, total_players
  FROM match_approvals
  WHERE match_id = NEW.match_id;

  -- Any explicit rejection => mark rejected, do not finalize.
  IF rejected_count > 0 THEN
    UPDATE matches
       SET status = 'rejected',
           verification_status = 'rejected'
     WHERE id = NEW.match_id
       AND status = 'pending';
    RETURN NEW;
  END IF;

  -- Majority threshold: singles (≤2) requires all; doubles (4) requires 3.
  IF total_players <= 2 THEN
    threshold := total_players;
  ELSE
    threshold := CEIL(total_players * 0.75);
  END IF;

  IF approved_count >= threshold THEN
    UPDATE matches
       SET status = 'approved',
           verification_status = 'verified'
     WHERE id = NEW.match_id
       AND status = 'pending';
  END IF;

  RETURN NEW;
END;
$function$;

-- Fire on any approval change (true OR false) so rejections also trip the trigger.
DROP TRIGGER IF EXISTS trigger_auto_approve_match ON public.match_approvals;
CREATE TRIGGER trigger_auto_approve_match
AFTER INSERT OR UPDATE OF approved ON public.match_approvals
FOR EACH ROW
EXECUTE FUNCTION public.auto_approve_match_on_verification();

-- 2. Update verification-needed notification link to the real player route
CREATE OR REPLACE FUNCTION public.notify_match_verification_needed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.approved IS NULL OR NEW.approved = false THEN
    PERFORM create_notification(
      NEW.player_id,
      'match_verification_needed',
      'matches',
      'Verify Match Result',
      'Please verify your recent match result',
      '/player/matches?tab=pending',
      'high',
      jsonb_build_object('match_id', NEW.match_id, 'approval_id', NEW.id),
      NULL,
      now() + interval '3 days'
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- 3. 48h auto-finalize sweep
CREATE OR REPLACE FUNCTION public.finalize_stale_pending_matches()
RETURNS TABLE(match_id uuid, new_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT m.id,
           COUNT(ma.*) FILTER (WHERE ma.approved = true)  AS approved_count,
           COUNT(ma.*) FILTER (WHERE ma.approved = false) AS rejected_count,
           COUNT(ma.*)                                    AS total_players
      FROM matches m
      LEFT JOIN match_approvals ma ON ma.match_id = m.id
     WHERE m.status = 'pending'
       AND m.created_at < now() - interval '48 hours'
     GROUP BY m.id
  LOOP
    IF r.rejected_count > 0 THEN
      UPDATE matches
         SET status = 'rejected', verification_status = 'rejected'
       WHERE id = r.id AND status = 'pending';
      match_id := r.id; new_status := 'rejected'; RETURN NEXT;
    ELSIF r.approved_count >= 1 THEN
      UPDATE matches
         SET status = 'approved', verification_status = 'verified'
       WHERE id = r.id AND status = 'pending';
      match_id := r.id; new_status := 'approved'; RETURN NEXT;
    END IF;
  END LOOP;
END;
$function$;

-- 4. Nudge opponents (rate-limited to 1 per 24h per opponent per match)
CREATE OR REPLACE FUNCTION public.nudge_match_opponents(p_match_id uuid)
RETURNS TABLE(notified_user_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_is_participant boolean;
  rec RECORD;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM match_participants
     WHERE match_id = p_match_id AND player_id = v_caller
  ) INTO v_is_participant;

  IF NOT v_is_participant THEN
    RAISE EXCEPTION 'Not a participant of this match';
  END IF;

  FOR rec IN
    SELECT mp.player_id
      FROM match_participants mp
      LEFT JOIN match_approvals ma
        ON ma.match_id = mp.match_id AND ma.player_id = mp.player_id
     WHERE mp.match_id = p_match_id
       AND mp.player_id IS NOT NULL
       AND mp.player_id <> v_caller
       AND (ma.approved IS NULL)
  LOOP
    -- Rate limit: skip if a nudge for this match was sent in last 24h
    IF EXISTS (
      SELECT 1 FROM user_notifications
       WHERE user_id = rec.player_id
         AND notification_type = 'match_verification_nudge'
         AND (metadata->>'match_id')::uuid = p_match_id
         AND created_at > now() - interval '24 hours'
    ) THEN
      CONTINUE;
    END IF;

    PERFORM create_notification(
      rec.player_id,
      'match_verification_nudge',
      'matches',
      'Reminder: Verify Match Result',
      'A teammate is waiting on your verification.',
      '/player/matches?tab=pending',
      'high',
      jsonb_build_object('match_id', p_match_id),
      v_caller,
      now() + interval '3 days'
    );
    notified_user_id := rec.player_id;
    RETURN NEXT;
  END LOOP;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.nudge_match_opponents(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_stale_pending_matches() TO service_role;
