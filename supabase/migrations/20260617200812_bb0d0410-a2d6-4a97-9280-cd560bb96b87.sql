CREATE OR REPLACE FUNCTION public.notify_match_participants()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_participant RECORD;
  v_recorder_name text;
  v_match_date text;
BEGIN
  SELECT display_name INTO v_recorder_name
  FROM profiles
  WHERE id = NEW.created_by;

  v_match_date := to_char(NEW.created_at, 'Mon DD');

  FOR v_participant IN
    SELECT mp.player_id
    FROM match_participants mp
    WHERE mp.match_id = NEW.id
      AND mp.player_id IS DISTINCT FROM NEW.created_by
  LOOP
    PERFORM create_notification(
      v_participant.player_id,
      'match_recorded',
      'matches',
      'Match Recorded',
      COALESCE(v_recorder_name, 'Someone') || ' recorded a match with you',
      '/matches/' || NEW.id,
      'high',
      jsonb_build_object('match_id', NEW.id, 'team1_score', NEW.team1_score, 'team2_score', NEW.team2_score),
      NEW.created_by,
      now() + interval '7 days'
    );
  END LOOP;

  RETURN NEW;
END;
$function$;