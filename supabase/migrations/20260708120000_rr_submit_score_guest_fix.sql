-- =====================================================================
-- Round Robin QA pass: restore guest support in submit_rr_match_score.
--
-- Migration 20260629202559 (the consolidated RR pipeline batch) pasted
-- a pre-guest body over the guest-aware version from 20260627011458,
-- silently reverting three things:
--   1. The seat-filled check ignored guest seats, so ANY match with a
--      guest player raised "Match has unfilled player slots; cannot
--      submit score" — guests were schedulable but unscorable.
--   2. The match_participants insert dropped guest_player_id, so even
--      if the check passed, guest seats would insert player_id = NULL
--      with no guest reference.
--   3. The FOR UPDATE row lock was removed, letting a concurrent
--      schedule regeneration delete the row mid-submission (score
--      written to a deleted row, never reaching match history).
--
-- This restores the 20260627 behavior with one refinement:
-- count_for_rating is now decided PER MATCH (off only when the match
-- itself contains a guest seat) instead of per event. The current
-- rating engine (20260703120000+) NULL-filters guest participants, so
-- all-player matches in a guests-allowed event can safely count.
--
-- Also adds the composite audit index the detail page's history query
-- wants: it filters by event_id and orders by created_at DESC.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.submit_rr_match_score(
  p_schedule_id UUID, p_team1_score INT, p_team2_score INT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_schedule         RECORD;
  v_event            RECORD;
  v_user_id          UUID := auth.uid();
  v_match_id         UUID;
  v_court_id         UUID;
  v_count_for_rating BOOLEAN;
  v_has_guest        BOOLEAN;
  v_participant_ids  UUID[];
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;

  -- FOR UPDATE: serialize against schedule regeneration deleting this
  -- row mid-submission.
  SELECT * INTO v_schedule FROM round_robin_schedule WHERE id = p_schedule_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Schedule row not found' USING ERRCODE = '02000'; END IF;
  IF v_schedule.is_bye THEN RAISE EXCEPTION 'Cannot submit a score for a bye match'; END IF;

  SELECT * INTO v_event FROM round_robin_events WHERE id = v_schedule.event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Parent event not found'; END IF;
  IF v_event.organizer_id <> v_user_id AND NOT public.has_role(v_user_id, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized to submit scores for this event' USING ERRCODE = '42501';
  END IF;

  -- A seat is filled when EITHER player_id OR guest_id is present
  IF (v_schedule.a1_player_id IS NULL AND v_schedule.a1_guest_id IS NULL)
     OR (v_schedule.a2_player_id IS NULL AND v_schedule.a2_guest_id IS NULL)
     OR (v_schedule.b1_player_id IS NULL AND v_schedule.b1_guest_id IS NULL)
     OR (v_schedule.b2_player_id IS NULL AND v_schedule.b2_guest_id IS NULL) THEN
    RAISE EXCEPTION 'Match has unfilled player slots; cannot submit score';
  END IF;

  -- Per-match rating eligibility: a match with a guest seat never
  -- counts (the rating engine skips guest participants anyway); an
  -- all-player match counts whenever the event is rating-eligible.
  v_has_guest := v_schedule.a1_guest_id IS NOT NULL OR v_schedule.a2_guest_id IS NOT NULL
              OR v_schedule.b1_guest_id IS NOT NULL OR v_schedule.b2_guest_id IS NOT NULL;
  v_count_for_rating := COALESCE(v_event.rating_eligible, true) AND NOT v_has_guest;

  IF v_event.location IS NOT NULL THEN
    BEGIN
      v_court_id := v_event.location::UUID;
    EXCEPTION WHEN invalid_text_representation THEN
      SELECT id INTO v_court_id FROM courts WHERE name = v_event.location LIMIT 1;
    END;
  END IF;

  UPDATE round_robin_schedule SET team1_score = p_team1_score, team2_score = p_team2_score WHERE id = p_schedule_id;

  -- verified_by gets only real player UUIDs
  v_participant_ids := ARRAY(
    SELECT pid FROM unnest(ARRAY[
      v_schedule.a1_player_id, v_schedule.a2_player_id,
      v_schedule.b1_player_id, v_schedule.b2_player_id
    ]) AS pid WHERE pid IS NOT NULL
  );

  IF v_schedule.match_id IS NOT NULL THEN
    UPDATE matches
       SET team1_score = p_team1_score, team2_score = p_team2_score, verified_by = v_participant_ids,
           court_id = v_court_id,
           other_location = CASE WHEN v_court_id IS NULL THEN v_event.location ELSE NULL END,
           count_for_rating = v_count_for_rating
     WHERE id = v_schedule.match_id;
    v_match_id := v_schedule.match_id;
  ELSE
    INSERT INTO matches (match_date, team1_score, team2_score, created_by, source, round_no, court_no,
      court_id, other_location, match_type, status, verified_by, count_for_rating)
    VALUES (v_event.date, p_team1_score, p_team2_score, v_user_id, 'round_robin', v_schedule.round_no, v_schedule.court_no,
      v_court_id, CASE WHEN v_court_id IS NULL THEN v_event.location ELSE NULL END,
      v_event.rating_type::TEXT, 'approved', v_participant_ids, v_count_for_rating)
    RETURNING id INTO v_match_id;

    INSERT INTO match_participants (match_id, player_id, guest_player_id, team) VALUES
      (v_match_id, v_schedule.a1_player_id, v_schedule.a1_guest_id, 1),
      (v_match_id, v_schedule.a2_player_id, v_schedule.a2_guest_id, 1),
      (v_match_id, v_schedule.b1_player_id, v_schedule.b1_guest_id, 2),
      (v_match_id, v_schedule.b2_player_id, v_schedule.b2_guest_id, 2);

    UPDATE round_robin_schedule SET match_id = v_match_id WHERE id = p_schedule_id;
  END IF;

  INSERT INTO round_robin_audit (event_id, editor_id, change_type, changes, reason)
  VALUES (v_event.id, v_user_id, 'score_submit',
    jsonb_build_object('schedule_id', p_schedule_id, 'match_id', v_match_id,
      'team1_score', p_team1_score, 'team2_score', p_team2_score, 'count_for_rating', v_count_for_rating),
    'Score submitted for Round ' || v_schedule.round_no || ', Court ' || v_schedule.court_no);
  RETURN v_match_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.submit_rr_match_score(UUID, INT, INT) TO authenticated;

-- Audit history is fetched as (event_id = X ORDER BY created_at DESC);
-- the existing single-column indexes cover neither the combined
-- filter+order.
CREATE INDEX IF NOT EXISTS idx_round_robin_audit_event_created
  ON public.round_robin_audit(event_id, created_at DESC);
