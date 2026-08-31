CREATE OR REPLACE FUNCTION public.rr_kiosk_participant_names(_event_id uuid)
 RETURNS TABLE(participant_id uuid, name text, is_guest boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH ev AS (
    SELECT id FROM round_robin_events
    WHERE id = _event_id AND status IN ('live', 'completed')
  ),
  seats AS (
    SELECT s.a1_player_id AS pid, s.a1_guest_id AS gid FROM round_robin_schedule s JOIN ev ON ev.id = s.event_id
    UNION SELECT s.a2_player_id, s.a2_guest_id FROM round_robin_schedule s JOIN ev ON ev.id = s.event_id
    UNION SELECT s.b1_player_id, s.b1_guest_id FROM round_robin_schedule s JOIN ev ON ev.id = s.event_id
    UNION SELECT s.b2_player_id, s.b2_guest_id FROM round_robin_schedule s JOIN ev ON ev.id = s.event_id
  )
  SELECT p.id, COALESCE(NULLIF(btrim(p.full_name), ''), NULLIF(btrim(p.display_name), ''), 'Player'), false
  FROM profiles p
  WHERE p.id IN (SELECT pid FROM seats WHERE pid IS NOT NULL)
  UNION ALL
  SELECT g.id, COALESCE(NULLIF(btrim(g.display_name), ''), 'Guest'), true
  FROM guest_players g
  WHERE g.id IN (SELECT gid FROM seats WHERE gid IS NOT NULL);
$function$;