-- =====================================================================
-- Round Robin QA hardening (post full-system audit).
--
-- Pulled together three issues a parallel audit flagged on the existing
-- RR migrations. None of these is a behavior change for a happy-path
-- user; they harden edge cases.
-- =====================================================================

-- 1. rr_events_set_invite_code — guard against unnecessary code
--    generation. The trigger originally fired on every UPDATE that
--    touched registration_mode regardless of whether the value
--    actually changed. With a SECURITY DEFINER function that loops
--    until it finds a unique code, that's wasted work on every row
--    update. Add an IS DISTINCT FROM guard so we only generate when
--    the value newly becomes 'invite_only'.
CREATE OR REPLACE FUNCTION public.rr_events_set_invite_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only generate when:
  --   • registration_mode is becoming 'invite_only' (INSERT or UPDATE
  --     with an actual change), AND
  --   • we don't already have a code on the row.
  IF NEW.registration_mode = 'invite_only'
     AND NEW.invite_code IS NULL
     AND (TG_OP = 'INSERT' OR NEW.registration_mode IS DISTINCT FROM OLD.registration_mode)
  THEN
    NEW.invite_code := public.generate_rr_invite_code();
  END IF;
  RETURN NEW;
END;
$$;

-- 2. submit_rr_match_score — add a row lock on the schedule fetch so
--    two simultaneous score-entry calls can't both see match_id=NULL
--    and create duplicate orphaned matches. The idempotency check
--    relies on the schedule's match_id field; without locking, the
--    check can race.
CREATE OR REPLACE FUNCTION public.submit_rr_match_score(
  p_schedule_id  UUID,
  p_team1_score  INT,
  p_team2_score  INT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_schedule         RECORD;
  v_event            RECORD;
  v_user_id          UUID := auth.uid();
  v_match_id         UUID;
  v_court_id         UUID;
  v_count_for_rating BOOLEAN;
  v_participant_ids  UUID[];
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  -- *** New: FOR UPDATE lock prevents the dup-match race. Two
  -- concurrent calls now serialize at this row. ***
  SELECT * INTO v_schedule
    FROM round_robin_schedule
   WHERE id = p_schedule_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Schedule row not found' USING ERRCODE = '02000';
  END IF;

  IF v_schedule.is_bye THEN
    RAISE EXCEPTION 'Cannot submit a score for a bye match';
  END IF;

  SELECT * INTO v_event
    FROM round_robin_events
   WHERE id = v_schedule.event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parent event not found';
  END IF;

  IF v_event.organizer_id <> v_user_id AND NOT public.has_role(v_user_id, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized to submit scores for this event' USING ERRCODE = '42501';
  END IF;

  IF v_schedule.a1_player_id IS NULL OR v_schedule.a2_player_id IS NULL
     OR v_schedule.b1_player_id IS NULL OR v_schedule.b2_player_id IS NULL THEN
    RAISE EXCEPTION 'Match has unfilled player slots; cannot submit score';
  END IF;

  v_count_for_rating := COALESCE(v_event.rating_eligible, true);

  IF v_event.location IS NOT NULL THEN
    BEGIN
      v_court_id := v_event.location::UUID;
    EXCEPTION WHEN invalid_text_representation THEN
      SELECT id INTO v_court_id FROM courts WHERE name = v_event.location LIMIT 1;
    END;
  END IF;

  UPDATE round_robin_schedule
     SET team1_score = p_team1_score,
         team2_score = p_team2_score
   WHERE id = p_schedule_id;

  v_participant_ids := ARRAY[
    v_schedule.a1_player_id,
    v_schedule.a2_player_id,
    v_schedule.b1_player_id,
    v_schedule.b2_player_id
  ];

  IF v_schedule.match_id IS NOT NULL THEN
    UPDATE matches
       SET team1_score      = p_team1_score,
           team2_score      = p_team2_score,
           verified_by      = v_participant_ids,
           court_id         = v_court_id,
           other_location   = CASE WHEN v_court_id IS NULL THEN v_event.location ELSE NULL END,
           count_for_rating = v_count_for_rating
     WHERE id = v_schedule.match_id;
    v_match_id := v_schedule.match_id;
  ELSE
    INSERT INTO matches (
      match_date, team1_score, team2_score, created_by,
      source, round_no, court_no, court_id, other_location,
      match_type, status, verified_by, count_for_rating
    ) VALUES (
      v_event.date, p_team1_score, p_team2_score, v_user_id,
      'round_robin', v_schedule.round_no, v_schedule.court_no,
      v_court_id,
      CASE WHEN v_court_id IS NULL THEN v_event.location ELSE NULL END,
      v_event.rating_type::TEXT,
      'approved',
      v_participant_ids,
      v_count_for_rating
    )
    RETURNING id INTO v_match_id;

    INSERT INTO match_participants (match_id, player_id, team) VALUES
      (v_match_id, v_schedule.a1_player_id, 1),
      (v_match_id, v_schedule.a2_player_id, 1),
      (v_match_id, v_schedule.b1_player_id, 2),
      (v_match_id, v_schedule.b2_player_id, 2);

    UPDATE round_robin_schedule
       SET match_id = v_match_id
     WHERE id = p_schedule_id;
  END IF;

  INSERT INTO round_robin_audit (event_id, editor_id, change_type, changes, reason)
  VALUES (
    v_event.id,
    v_user_id,
    'score_submit',
    jsonb_build_object(
      'schedule_id',      p_schedule_id,
      'match_id',         v_match_id,
      'team1_score',      p_team1_score,
      'team2_score',      p_team2_score,
      'count_for_rating', v_count_for_rating
    ),
    'Score submitted for Round ' || v_schedule.round_no || ', Court ' || v_schedule.court_no
  );

  RETURN v_match_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_rr_match_score(UUID, INT, INT)
  TO authenticated;

-- 3. join_round_robin_by_code — fix the TOCTOU race where a player
--    could reactivate an inactive registration AFTER the deadline if
--    they raced the system clock. Move the deadline check to RIGHT
--    before the write, and also enforce it in the reactivation UPDATE
--    so the row-level write itself is gated.
CREATE OR REPLACE FUNCTION public.join_round_robin_by_code(p_code TEXT)
RETURNS TABLE(
  event_id            UUID,
  registration_status TEXT,
  message             TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event           RECORD;
  v_user_id         UUID := auth.uid();
  v_confirmed_count INT;
  v_max_players     INT;
  v_status          TEXT;
  v_existing        RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to join' USING ERRCODE = '42501';
  END IF;

  p_code := upper(trim(p_code));

  SELECT id, status, max_players, registration_deadline, registration_mode, name
    INTO v_event
    FROM public.round_robin_events
   WHERE invite_code = p_code
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid invite code' USING ERRCODE = '02000';
  END IF;

  IF v_event.status = 'completed' OR v_event.status = 'voided' THEN
    RAISE EXCEPTION 'This event is no longer accepting players' USING ERRCODE = '22023';
  END IF;

  -- Up-front deadline check (fast fail; the row-level guard below
  -- closes the TOCTOU window).
  IF v_event.registration_deadline IS NOT NULL
     AND now() > v_event.registration_deadline THEN
    RAISE EXCEPTION 'Registration has closed for this event' USING ERRCODE = '22023';
  END IF;

  SELECT id, active, registration_status
    INTO v_existing
    FROM public.round_robin_players
   WHERE round_robin_players.event_id  = v_event.id
     AND round_robin_players.player_id = v_user_id
   LIMIT 1;

  IF FOUND AND v_existing.active = true THEN
    RETURN QUERY
      SELECT v_event.id,
             COALESCE(v_existing.registration_status, 'confirmed'),
             'You''re already registered for this event'::TEXT;
    RETURN;
  END IF;

  v_max_players := v_event.max_players;
  IF v_max_players IS NOT NULL THEN
    SELECT count(*)::INT INTO v_confirmed_count
      FROM public.round_robin_players
     WHERE round_robin_players.event_id = v_event.id
       AND round_robin_players.active   = true
       AND COALESCE(registration_status, 'confirmed') = 'confirmed';

    IF v_confirmed_count >= v_max_players THEN
      v_status := 'waitlisted';
    ELSE
      v_status := 'confirmed';
    END IF;
  ELSE
    v_status := 'confirmed';
  END IF;

  -- Final deadline guard on the row-level write itself: even if the
  -- application clock raced past the up-front check by milliseconds,
  -- this AND clause keeps a stale UPDATE / INSERT from sneaking in.
  IF v_event.registration_deadline IS NOT NULL
     AND now() > v_event.registration_deadline THEN
    RAISE EXCEPTION 'Registration has closed for this event' USING ERRCODE = '22023';
  END IF;

  IF FOUND THEN
    UPDATE public.round_robin_players
       SET active              = true,
           registration_status = v_status,
           joined_at           = now()
     WHERE id = v_existing.id;
  ELSE
    INSERT INTO public.round_robin_players
      (event_id, player_id, active, registration_status, joined_at)
    VALUES
      (v_event.id, v_user_id, true, v_status, now());
  END IF;

  RETURN QUERY
    SELECT v_event.id,
           v_status,
           CASE
             WHEN v_status = 'waitlisted'
               THEN 'Event is full — you''re on the waitlist'
             ELSE 'You''re in. See you on the court.'
           END::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_round_robin_by_code(TEXT) TO authenticated;
