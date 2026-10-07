-- The public broadcast needs roster status to avoid awarding departed players
-- a rank. Keep its data limited to canonical scheduled names and active status;
-- never grant public access to private profile or roster/contact columns.
CREATE OR REPLACE FUNCTION public.rr_kiosk_participants(_event_id uuid)
RETURNS TABLE(participant_id uuid, name text, is_guest boolean, active boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH ev AS (
    SELECT id FROM round_robin_events
    WHERE id = _event_id AND status IN ('live', 'completed') AND NOT coalesce(voided, false)
      AND public.can_access_private_venue(venue_id)
      AND public.can_access_private_group(group_id)
  ), seats AS (
    SELECT DISTINCT seat.pid, seat.gid
    FROM round_robin_schedule s JOIN ev ON ev.id = s.event_id
    CROSS JOIN LATERAL (VALUES
      (s.a1_player_id, s.a1_guest_id), (s.a2_player_id, s.a2_guest_id),
      (s.b1_player_id, s.b1_guest_id), (s.b2_player_id, s.b2_guest_id)
    ) seat(pid, gid)
    WHERE s.voided_at IS NULL AND s.superseded_by_schedule_id IS NULL
  ), names AS (
    SELECT p.id, coalesce(nullif(btrim(p.display_name), ''), nullif(btrim(p.full_name), ''), 'Player') AS name, false AS is_guest
    FROM profiles p WHERE p.id IN (SELECT pid FROM seats)
    UNION ALL
    SELECT g.id, coalesce(nullif(btrim(g.display_name), ''), 'Guest'), true
    FROM guest_players g WHERE g.id IN (SELECT gid FROM seats WHERE pid IS NULL)
  )
  SELECT n.id, n.name, n.is_guest, EXISTS (
    SELECT 1 FROM round_robin_players r WHERE r.event_id = _event_id
      AND r.active IS DISTINCT FROM false AND r.registration_status IS DISTINCT FROM 'waitlisted'
      AND ((NOT n.is_guest AND r.player_id = n.id) OR (n.is_guest AND r.guest_player_id = n.id))
  ) FROM names n;
$$;
REVOKE ALL ON FUNCTION public.rr_kiosk_participants(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rr_kiosk_participants(uuid) TO anon, authenticated, service_role;
