-- ============ Migration 2: enum value (must be before functions using it) ============
ALTER TYPE public.round_robin_status ADD VALUE IF NOT EXISTS 'voided';

-- ============ Migration 3: RR score pipeline ============
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS count_for_rating BOOLEAN DEFAULT true;

UPDATE public.matches m
   SET count_for_rating = false
  FROM public.round_robin_schedule s
  JOIN public.round_robin_events e ON e.id = s.event_id
 WHERE s.match_id    = m.id
   AND e.rating_eligible = false
   AND m.count_for_rating IS DISTINCT FROM false;

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
    WHERE m.status = 'approved' AND COALESCE(m.voided, false) = false AND COALESCE(m.count_for_rating, true) = true
    GROUP BY m.id, m.match_date, m.team1_score, m.team2_score, m.match_type, m.week_start, m.created_at
    HAVING COUNT(*) = 4
    ORDER BY m.match_date, m.created_at, m.id
  LOOP
    p1_id := match_record.player_ids[1]; p2_id := match_record.player_ids[2];
    p3_id := match_record.player_ids[3]; p4_id := match_record.player_ids[4];
    SELECT COALESCE((SELECT mp_sub.rating_after FROM match_participants mp_sub JOIN matches m_sub ON mp_sub.match_id = m_sub.id
      WHERE mp_sub.player_id = p1_id AND m_sub.status = 'approved' AND COALESCE(m_sub.voided, false) = false AND COALESCE(m_sub.count_for_rating, true) = true
        AND (m_sub.match_date < match_record.match_date OR (m_sub.match_date = match_record.match_date AND m_sub.created_at < match_record.created_at)
             OR (m_sub.match_date = match_record.match_date AND m_sub.created_at = match_record.created_at AND m_sub.id < match_record.match_id))
      ORDER BY m_sub.match_date DESC, m_sub.created_at DESC, m_sub.id DESC LIMIT 1), 3.00), p.total_matches INTO p1_rating, p1_matches
    FROM profiles p WHERE p.id = p1_id;
    SELECT COALESCE((SELECT mp_sub.rating_after FROM match_participants mp_sub JOIN matches m_sub ON mp_sub.match_id = m_sub.id
      WHERE mp_sub.player_id = p2_id AND m_sub.status = 'approved' AND COALESCE(m_sub.voided, false) = false AND COALESCE(m_sub.count_for_rating, true) = true
        AND (m_sub.match_date < match_record.match_date OR (m_sub.match_date = match_record.match_date AND m_sub.created_at < match_record.created_at)
             OR (m_sub.match_date = match_record.match_date AND m_sub.created_at = match_record.created_at AND m_sub.id < match_record.match_id))
      ORDER BY m_sub.match_date DESC, m_sub.created_at DESC, m_sub.id DESC LIMIT 1), 3.00), p.total_matches INTO p2_rating, p2_matches
    FROM profiles p WHERE p.id = p2_id;
    SELECT COALESCE((SELECT mp_sub.rating_after FROM match_participants mp_sub JOIN matches m_sub ON mp_sub.match_id = m_sub.id
      WHERE mp_sub.player_id = p3_id AND m_sub.status = 'approved' AND COALESCE(m_sub.voided, false) = false AND COALESCE(m_sub.count_for_rating, true) = true
        AND (m_sub.match_date < match_record.match_date OR (m_sub.match_date = match_record.match_date AND m_sub.created_at < match_record.created_at)
             OR (m_sub.match_date = match_record.match_date AND m_sub.created_at = match_record.created_at AND m_sub.id < match_record.match_id))
      ORDER BY m_sub.match_date DESC, m_sub.created_at DESC, m_sub.id DESC LIMIT 1), 3.00), p.total_matches INTO p3_rating, p3_matches
    FROM profiles p WHERE p.id = p3_id;
    SELECT COALESCE((SELECT mp_sub.rating_after FROM match_participants mp_sub JOIN matches m_sub ON mp_sub.match_id = m_sub.id
      WHERE mp_sub.player_id = p4_id AND m_sub.status = 'approved' AND COALESCE(m_sub.voided, false) = false AND COALESCE(m_sub.count_for_rating, true) = true
        AND (m_sub.match_date < match_record.match_date OR (m_sub.match_date = match_record.match_date AND m_sub.created_at < match_record.created_at)
             OR (m_sub.match_date = match_record.match_date AND m_sub.created_at = match_record.created_at AND m_sub.id < match_record.match_id))
      ORDER BY m_sub.match_date DESC, m_sub.created_at DESC, m_sub.id DESC LIMIT 1), 3.00), p.total_matches INTO p4_rating, p4_matches
    FROM profiles p WHERE p.id = p4_id;
    v_rating_change := calculate_pulse_rating_change(p1_rating, p2_rating, p3_rating, p4_rating,
      match_record.team1_score, match_record.team2_score, match_record.team1_score > match_record.team2_score, match_record.match_type, p1_matches);
    UPDATE match_participants SET rating_before = p1_rating, rating_after = p1_rating + v_rating_change, rating_change = v_rating_change WHERE match_id = match_record.match_id AND player_id = p1_id;
    UPDATE match_participants SET rating_before = p2_rating, rating_after = p2_rating + v_rating_change, rating_change = v_rating_change WHERE match_id = match_record.match_id AND player_id = p2_id;
    UPDATE match_participants SET rating_before = p3_rating, rating_after = p3_rating - v_rating_change, rating_change = -v_rating_change WHERE match_id = match_record.match_id AND player_id = p3_id;
    UPDATE match_participants SET rating_before = p4_rating, rating_after = p4_rating - v_rating_change, rating_change = -v_rating_change WHERE match_id = match_record.match_id AND player_id = p4_id;
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

CREATE OR REPLACE FUNCTION public.submit_rr_match_score(
  p_schedule_id UUID, p_team1_score INT, p_team2_score INT
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_schedule RECORD; v_event RECORD; v_user_id UUID := auth.uid();
  v_match_id UUID; v_court_id UUID; v_count_for_rating BOOLEAN; v_participant_ids UUID[];
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_schedule FROM round_robin_schedule WHERE id = p_schedule_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Schedule row not found' USING ERRCODE = '02000'; END IF;
  IF v_schedule.is_bye THEN RAISE EXCEPTION 'Cannot submit a score for a bye match'; END IF;
  SELECT * INTO v_event FROM round_robin_events WHERE id = v_schedule.event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Parent event not found'; END IF;
  IF v_event.organizer_id <> v_user_id AND NOT public.has_role(v_user_id, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized to submit scores for this event' USING ERRCODE = '42501';
  END IF;
  IF v_schedule.a1_player_id IS NULL OR v_schedule.a2_player_id IS NULL
     OR v_schedule.b1_player_id IS NULL OR v_schedule.b2_player_id IS NULL THEN
    RAISE EXCEPTION 'Match has unfilled player slots; cannot submit score';
  END IF;
  v_count_for_rating := COALESCE(v_event.rating_eligible, true);
  IF v_event.location IS NOT NULL THEN
    BEGIN v_court_id := v_event.location::UUID;
    EXCEPTION WHEN invalid_text_representation THEN
      SELECT id INTO v_court_id FROM courts WHERE name = v_event.location LIMIT 1;
    END;
  END IF;
  UPDATE round_robin_schedule SET team1_score = p_team1_score, team2_score = p_team2_score WHERE id = p_schedule_id;
  v_participant_ids := ARRAY[v_schedule.a1_player_id, v_schedule.a2_player_id, v_schedule.b1_player_id, v_schedule.b2_player_id];
  IF v_schedule.match_id IS NOT NULL THEN
    UPDATE matches SET team1_score = p_team1_score, team2_score = p_team2_score, verified_by = v_participant_ids,
      court_id = v_court_id, other_location = CASE WHEN v_court_id IS NULL THEN v_event.location ELSE NULL END,
      count_for_rating = v_count_for_rating WHERE id = v_schedule.match_id;
    v_match_id := v_schedule.match_id;
  ELSE
    INSERT INTO matches (match_date, team1_score, team2_score, created_by, source, round_no, court_no, court_id, other_location, match_type, status, verified_by, count_for_rating)
    VALUES (v_event.date, p_team1_score, p_team2_score, v_user_id, 'round_robin', v_schedule.round_no, v_schedule.court_no, v_court_id,
      CASE WHEN v_court_id IS NULL THEN v_event.location ELSE NULL END, v_event.rating_type::TEXT, 'approved', v_participant_ids, v_count_for_rating)
    RETURNING id INTO v_match_id;
    INSERT INTO match_participants (match_id, player_id, team) VALUES
      (v_match_id, v_schedule.a1_player_id, 1), (v_match_id, v_schedule.a2_player_id, 1),
      (v_match_id, v_schedule.b1_player_id, 2), (v_match_id, v_schedule.b2_player_id, 2);
    UPDATE round_robin_schedule SET match_id = v_match_id WHERE id = p_schedule_id;
  END IF;
  INSERT INTO round_robin_audit (event_id, editor_id, change_type, changes, reason) VALUES (
    v_event.id, v_user_id, 'score_submit',
    jsonb_build_object('schedule_id', p_schedule_id, 'match_id', v_match_id, 'team1_score', p_team1_score, 'team2_score', p_team2_score, 'count_for_rating', v_count_for_rating),
    'Score submitted for Round ' || v_schedule.round_no || ', Court ' || v_schedule.court_no);
  RETURN v_match_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.submit_rr_match_score(UUID, INT, INT) TO authenticated;

-- ============ Migration 4: void/delete RR helpers ============
CREATE OR REPLACE FUNCTION public.void_round_robin_event(p_event_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_organizer_id UUID; v_already_voided BOOLEAN;
BEGIN
  SELECT organizer_id, COALESCE(voided, false) INTO v_organizer_id, v_already_voided FROM round_robin_events WHERE id = p_event_id;
  IF v_organizer_id IS NULL THEN RAISE EXCEPTION 'Event not found' USING ERRCODE = '02000'; END IF;
  IF v_organizer_id <> auth.uid() AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only the host or an admin can void this event' USING ERRCODE = '42501';
  END IF;
  IF v_already_voided THEN RETURN; END IF;
  UPDATE round_robin_events SET voided = TRUE, voided_by = auth.uid(), voided_at = NOW(), void_reason = p_reason, status = 'voided' WHERE id = p_event_id;
  UPDATE matches SET voided = TRUE, voided_by = auth.uid(), voided_at = NOW(), void_reason = COALESCE(p_reason, 'Round Robin event voided')
  WHERE source = 'round_robin' AND id IN (SELECT match_id FROM round_robin_schedule WHERE event_id = p_event_id AND match_id IS NOT NULL)
    AND COALESCE(voided, false) = false;
  PERFORM recalculate_all_ratings();
END; $$;

GRANT EXECUTE ON FUNCTION public.void_round_robin_event(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_round_robin_event(p_event_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_organizer_id UUID; v_has_scores BOOLEAN;
BEGIN
  SELECT organizer_id INTO v_organizer_id FROM round_robin_events WHERE id = p_event_id;
  IF v_organizer_id IS NULL THEN RAISE EXCEPTION 'Event not found' USING ERRCODE = '02000'; END IF;
  IF v_organizer_id <> auth.uid() AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only the host or an admin can delete this event' USING ERRCODE = '42501';
  END IF;
  SELECT EXISTS (SELECT 1 FROM round_robin_schedule WHERE event_id = p_event_id AND (team1_score IS NOT NULL OR team2_score IS NOT NULL)) INTO v_has_scores;
  IF v_has_scores AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'This event has saved scores — void it to keep the record, or contact an admin to hard-delete' USING ERRCODE = '23000';
  END IF;
  DELETE FROM match_participants WHERE match_id IN (SELECT match_id FROM round_robin_schedule WHERE event_id = p_event_id AND match_id IS NOT NULL);
  DELETE FROM matches WHERE id IN (SELECT match_id FROM round_robin_schedule WHERE event_id = p_event_id AND match_id IS NOT NULL);
  DELETE FROM round_robin_schedule WHERE event_id = p_event_id;
  DELETE FROM round_robin_players WHERE event_id = p_event_id;
  DELETE FROM round_robin_audit WHERE event_id = p_event_id;
  DELETE FROM round_robin_events WHERE id = p_event_id;
  IF v_has_scores THEN PERFORM recalculate_all_ratings(); END IF;
END; $$;

GRANT EXECUTE ON FUNCTION public.delete_round_robin_event(UUID) TO authenticated;

-- ============ Migration 5: backfill num_rounds drift ============
UPDATE round_robin_events e
SET num_rounds = s.actual_rounds
FROM (SELECT event_id, MAX(round_no) AS actual_rounds FROM round_robin_schedule GROUP BY event_id) s
WHERE e.id = s.event_id AND s.actual_rounds > 0 AND e.num_rounds <> s.actual_rounds;

-- ============ Migration 6: regenerate_group_invite_code RPC ============
CREATE OR REPLACE FUNCTION public.regenerate_group_invite_code(p_group_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_caller uuid := auth.uid(); v_is_owner boolean; v_new_code text;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.group_members WHERE group_id = p_group_id AND user_id = v_caller AND role = 'owner' AND status = 'active') INTO v_is_owner;
  IF NOT v_is_owner THEN RAISE EXCEPTION 'Only the group owner can regenerate the invite code' USING ERRCODE = '42501'; END IF;
  v_new_code := public.generate_group_invite_code();
  UPDATE public.groups SET invite_code = v_new_code WHERE id = p_group_id;
  RETURN v_new_code;
END; $$;

GRANT EXECUTE ON FUNCTION public.regenerate_group_invite_code(uuid) TO authenticated;

-- ============ Migration 7: group_members role escalation guard ============
DROP POLICY IF EXISTS "Admins can update members" ON public.group_members;

CREATE POLICY "Admins can update members"
  ON public.group_members FOR UPDATE
  USING (public.is_group_admin(auth.uid(), group_id))
  WITH CHECK (
    public.is_group_admin(auth.uid(), group_id)
    AND (role <> 'owner' OR public.has_group_role(auth.uid(), group_id, 'owner'))
  );

CREATE OR REPLACE FUNCTION public.group_members_self_update_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_caller uuid := auth.uid();
BEGIN
  IF NEW.user_id IS DISTINCT FROM v_caller THEN RETURN NEW; END IF;
  IF public.is_group_admin(v_caller, NEW.group_id) THEN RETURN NEW; END IF;
  IF NEW.role IS DISTINCT FROM OLD.role THEN RAISE EXCEPTION 'Cannot change own role' USING ERRCODE = '42501'; END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN RAISE EXCEPTION 'Cannot change own status' USING ERRCODE = '42501'; END IF;
  IF NEW.group_id IS DISTINCT FROM OLD.group_id THEN RAISE EXCEPTION 'Cannot change own group_id' USING ERRCODE = '42501'; END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN RAISE EXCEPTION 'Cannot change own user_id' USING ERRCODE = '42501'; END IF;
  IF NEW.joined_at IS DISTINCT FROM OLD.joined_at THEN RAISE EXCEPTION 'Cannot change joined_at' USING ERRCODE = '42501'; END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trigger_group_members_self_update_guard ON public.group_members;
CREATE TRIGGER trigger_group_members_self_update_guard
  BEFORE UPDATE ON public.group_members
  FOR EACH ROW EXECUTE FUNCTION public.group_members_self_update_guard();
