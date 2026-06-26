
DROP FUNCTION IF EXISTS public.merge_guest_players(uuid, uuid);

-- 1. Defensive rating guard: skip RR matches whose parent event allows guests.
CREATE OR REPLACE FUNCTION public.recalculate_all_ratings()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  match_record    RECORD;
  player_record   RECORD;
  p1_id UUID; p2_id UUID; p3_id UUID; p4_id UUID;
  p1_rating NUMERIC; p2_rating NUMERIC; p3_rating NUMERIC; p4_rating NUMERIC;
  p1_matches INTEGER; p2_matches INTEGER; p3_matches INTEGER; p4_matches INTEGER;
  v_rating_change NUMERIC;
  current_week    DATE;
BEGIN
  current_week := get_week_start(CURRENT_DATE);
  UPDATE profiles SET current_rating = 3.00, week_start_rating = 3.00, week_start_date = current_week WHERE id IS NOT NULL;
  FOR match_record IN
    SELECT m.id AS match_id, m.match_date, m.team1_score, m.team2_score, m.match_type, m.week_start, m.created_at,
           array_agg(mp.player_id ORDER BY mp.team, mp.id) AS player_ids,
           array_agg(mp.team ORDER BY mp.team, mp.id) AS teams
    FROM matches m JOIN match_participants mp ON mp.match_id = m.id
    WHERE m.status = 'approved'
      AND COALESCE(m.voided, false) = false
      AND COALESCE(m.count_for_rating, true) = true
      AND NOT EXISTS (
        SELECT 1
        FROM round_robin_schedule rs
        JOIN round_robin_events re ON re.id = rs.event_id
        WHERE rs.match_id = m.id AND COALESCE(re.allow_guests, false) = true
      )
      AND NOT EXISTS (
        SELECT 1 FROM match_participants mp2
        WHERE mp2.match_id = m.id AND mp2.player_id IS NULL
      )
    GROUP BY m.id, m.match_date, m.team1_score, m.team2_score, m.match_type, m.week_start, m.created_at
    HAVING COUNT(*) = 4
    ORDER BY m.match_date, m.created_at, m.id
  LOOP
    p1_id := match_record.player_ids[1]; p2_id := match_record.player_ids[2];
    p3_id := match_record.player_ids[3]; p4_id := match_record.player_ids[4];
    SELECT COALESCE((SELECT mp_sub.rating_after FROM match_participants mp_sub JOIN matches m_sub ON mp_sub.match_id = m_sub.id
      WHERE mp_sub.player_id = p1_id AND m_sub.status = 'approved'
        AND COALESCE(m_sub.voided, false) = false AND COALESCE(m_sub.count_for_rating, true) = true
        AND (m_sub.match_date < match_record.match_date OR (m_sub.match_date = match_record.match_date AND m_sub.created_at < match_record.created_at)
             OR (m_sub.match_date = match_record.match_date AND m_sub.created_at = match_record.created_at AND m_sub.id < match_record.match_id))
      ORDER BY m_sub.match_date DESC, m_sub.created_at DESC, m_sub.id DESC LIMIT 1), 3.00), p.total_matches
    INTO p1_rating, p1_matches FROM profiles p WHERE p.id = p1_id;
    SELECT COALESCE((SELECT mp_sub.rating_after FROM match_participants mp_sub JOIN matches m_sub ON mp_sub.match_id = m_sub.id
      WHERE mp_sub.player_id = p2_id AND m_sub.status = 'approved'
        AND COALESCE(m_sub.voided, false) = false AND COALESCE(m_sub.count_for_rating, true) = true
        AND (m_sub.match_date < match_record.match_date OR (m_sub.match_date = match_record.match_date AND m_sub.created_at < match_record.created_at)
             OR (m_sub.match_date = match_record.match_date AND m_sub.created_at = match_record.created_at AND m_sub.id < match_record.match_id))
      ORDER BY m_sub.match_date DESC, m_sub.created_at DESC, m_sub.id DESC LIMIT 1), 3.00), p.total_matches
    INTO p2_rating, p2_matches FROM profiles p WHERE p.id = p2_id;
    SELECT COALESCE((SELECT mp_sub.rating_after FROM match_participants mp_sub JOIN matches m_sub ON mp_sub.match_id = m_sub.id
      WHERE mp_sub.player_id = p3_id AND m_sub.status = 'approved'
        AND COALESCE(m_sub.voided, false) = false AND COALESCE(m_sub.count_for_rating, true) = true
        AND (m_sub.match_date < match_record.match_date OR (m_sub.match_date = match_record.match_date AND m_sub.created_at < match_record.created_at)
             OR (m_sub.match_date = match_record.match_date AND m_sub.created_at = match_record.created_at AND m_sub.id < match_record.match_id))
      ORDER BY m_sub.match_date DESC, m_sub.created_at DESC, m_sub.id DESC LIMIT 1), 3.00), p.total_matches
    INTO p3_rating, p3_matches FROM profiles p WHERE p.id = p3_id;
    SELECT COALESCE((SELECT mp_sub.rating_after FROM match_participants mp_sub JOIN matches m_sub ON mp_sub.match_id = m_sub.id
      WHERE mp_sub.player_id = p4_id AND m_sub.status = 'approved'
        AND COALESCE(m_sub.voided, false) = false AND COALESCE(m_sub.count_for_rating, true) = true
        AND (m_sub.match_date < match_record.match_date OR (m_sub.match_date = match_record.match_date AND m_sub.created_at < match_record.created_at)
             OR (m_sub.match_date = match_record.match_date AND m_sub.created_at = match_record.created_at AND m_sub.id < match_record.match_id))
      ORDER BY m_sub.match_date DESC, m_sub.created_at DESC, m_sub.id DESC LIMIT 1), 3.00), p.total_matches
    INTO p4_rating, p4_matches FROM profiles p WHERE p.id = p4_id;
    v_rating_change := calculate_pulse_rating_change(p1_rating, p2_rating, p3_rating, p4_rating,
      match_record.team1_score, match_record.team2_score, match_record.team1_score > match_record.team2_score,
      match_record.match_type, p1_matches);
    UPDATE match_participants SET rating_before = p1_rating, rating_after = p1_rating + v_rating_change, rating_change = v_rating_change
      WHERE match_id = match_record.match_id AND player_id = p1_id;
    UPDATE match_participants SET rating_before = p2_rating, rating_after = p2_rating + v_rating_change, rating_change = v_rating_change
      WHERE match_id = match_record.match_id AND player_id = p2_id;
    UPDATE match_participants SET rating_before = p3_rating, rating_after = p3_rating - v_rating_change, rating_change = -v_rating_change
      WHERE match_id = match_record.match_id AND player_id = p3_id;
    UPDATE match_participants SET rating_before = p4_rating, rating_after = p4_rating - v_rating_change, rating_change = -v_rating_change
      WHERE match_id = match_record.match_id AND player_id = p4_id;
    UPDATE profiles SET current_rating = p1_rating + v_rating_change WHERE id = p1_id;
    UPDATE profiles SET current_rating = p2_rating + v_rating_change WHERE id = p2_id;
    UPDATE profiles SET current_rating = p3_rating - v_rating_change WHERE id = p3_id;
    UPDATE profiles SET current_rating = p4_rating - v_rating_change WHERE id = p4_id;
  END LOOP;
  FOR player_record IN SELECT id FROM profiles LOOP
    UPDATE profiles SET week_start_rating = COALESCE(
      (SELECT mp_sub.rating_after FROM match_participants mp_sub JOIN matches m_sub ON mp_sub.match_id = m_sub.id
        WHERE mp_sub.player_id = player_record.id AND m_sub.status = 'approved'
          AND COALESCE(m_sub.voided, false) = false AND COALESCE(m_sub.count_for_rating, true) = true
          AND m_sub.week_start < current_week
        ORDER BY m_sub.match_date DESC, m_sub.created_at DESC, m_sub.id DESC LIMIT 1), 3.00),
      week_start_date = current_week WHERE id = player_record.id;
  END LOOP;
  PERFORM recalculate_all_player_stats();
END;
$function$;

-- 2. Merge duplicate guests.
CREATE FUNCTION public.merge_guest_players(p_keep_id uuid, p_remove_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_keep    record;
  v_remove  record;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_keep_id = p_remove_id THEN
    RAISE EXCEPTION 'Cannot merge a guest into itself';
  END IF;
  SELECT * INTO v_keep FROM guest_players WHERE id = p_keep_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Kept guest not found'; END IF;
  SELECT * INTO v_remove FROM guest_players WHERE id = p_remove_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Removed guest not found'; END IF;

  IF NOT public.has_role(v_user_id, 'admin'::app_role) THEN
    IF v_keep.created_by <> v_user_id OR v_remove.created_by <> v_user_id THEN
      RAISE EXCEPTION 'Not authorized to merge these guests' USING ERRCODE = '42501';
    END IF;
  END IF;
  IF v_keep.created_by <> v_remove.created_by THEN
    RAISE EXCEPTION 'Guests must share the same creator to be merged';
  END IF;

  DELETE FROM round_robin_players rrp_dup
   WHERE rrp_dup.guest_player_id = p_remove_id
     AND EXISTS (
       SELECT 1 FROM round_robin_players rrp_keep
       WHERE rrp_keep.event_id = rrp_dup.event_id
         AND rrp_keep.guest_player_id = p_keep_id
     );
  UPDATE round_robin_players
     SET guest_player_id = p_keep_id
   WHERE guest_player_id = p_remove_id;

  UPDATE guest_claim_invites
     SET guest_player_id = p_keep_id
   WHERE guest_player_id = p_remove_id;

  IF v_remove.linked_user_id IS NOT NULL AND v_keep.linked_user_id IS NULL THEN
    UPDATE guest_players
       SET linked_user_id = v_remove.linked_user_id,
           linked_at = COALESCE(v_remove.linked_at, now())
     WHERE id = p_keep_id;
  END IF;

  DELETE FROM guest_players WHERE id = p_remove_id;

  RETURN p_keep_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.merge_guest_players(uuid, uuid) TO authenticated;
