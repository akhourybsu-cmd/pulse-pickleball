-- Atomic scoring and completion; no historical results are modified.
BEGIN;

CREATE OR REPLACE FUNCTION public.submit_rr_match_score(
  p_schedule_id UUID, p_team1_score INT, p_team2_score INT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_event_id uuid;
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

  IF NOT public.pulse_has_required_mfa() THEN RAISE EXCEPTION 'Complete verification before saving scores.' USING ERRCODE='42501'; END IF;
  IF p_team1_score IS NULL OR p_team2_score IS NULL OR p_team1_score NOT BETWEEN 0 AND 99 OR p_team2_score NOT BETWEEN 0 AND 99 THEN
    RAISE EXCEPTION 'Enter whole-number scores from 0 to 99.' USING ERRCODE='22023';
  END IF;
  IF abs(p_team1_score-p_team2_score)<2 THEN RAISE EXCEPTION 'The winning team must lead by at least 2 points.' USING ERRCODE='22023'; END IF;

  -- Resolve the parent without a row lock, then follow the same event ->
  -- schedule lock order as roster changes, rebuilding and round advancement.
  SELECT event_id INTO v_event_id FROM public.round_robin_schedule WHERE id=p_schedule_id;
  SELECT * INTO v_event FROM public.round_robin_events WHERE id=v_event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event or match no longer exists. Refresh the event.' USING ERRCODE='P0002'; END IF;
  IF NOT public.can_manage_round_robin(v_event.id,v_user_id) THEN
    RAISE EXCEPTION 'Not authorized to submit scores for this event' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_schedule FROM public.round_robin_schedule WHERE id=p_schedule_id AND event_id=v_event.id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'The schedule changed. Refresh before saving.' USING ERRCODE='40001'; END IF;
  IF v_schedule.is_bye OR coalesce(v_schedule.abandoned,false) OR v_schedule.voided_at IS NOT NULL OR v_schedule.superseded_by_schedule_id IS NOT NULL THEN
    RAISE EXCEPTION 'This match is no longer playable. Refresh the event.' USING ERRCODE='22023';
  END IF;
  IF coalesce(v_event.voided,false) OR v_event.status NOT IN ('live','completed') THEN
    RAISE EXCEPTION 'Scores can only be saved for an active or completed event.' USING ERRCODE='22023';
  END IF;
  IF v_event.status='completed' AND (v_schedule.team1_score IS NULL OR v_schedule.team2_score IS NULL) THEN
    RAISE EXCEPTION 'This event is complete. Only existing results can be corrected.' USING ERRCODE='22023';
  END IF;

  IF (v_schedule.a1_player_id IS NULL AND v_schedule.a1_guest_id IS NULL)
     OR (v_schedule.a2_player_id IS NULL AND v_schedule.a2_guest_id IS NULL)
     OR (v_schedule.b1_player_id IS NULL AND v_schedule.b1_guest_id IS NULL)
     OR (v_schedule.b2_player_id IS NULL AND v_schedule.b2_guest_id IS NULL) THEN
    RAISE EXCEPTION 'Match has unfilled player slots; cannot submit score';
  END IF;

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

  IF v_schedule.match_id IS NOT NULL THEN
    IF NOT EXISTS(SELECT 1 FROM public.matches WHERE id=v_schedule.match_id AND NOT coalesce(voided,false)) THEN
      RAISE EXCEPTION 'The linked result is missing or voided. Review this match before scoring.';
    END IF;
    -- A retry after a lost response should not rewrite history or repeat effects.
    IF v_schedule.team1_score IS NOT DISTINCT FROM p_team1_score AND v_schedule.team2_score IS NOT DISTINCT FROM p_team2_score
       AND EXISTS(SELECT 1 FROM public.matches WHERE id=v_schedule.match_id AND team1_score=p_team1_score AND team2_score=p_team2_score AND count_for_rating IS NOT DISTINCT FROM v_count_for_rating) THEN
      RETURN v_schedule.match_id;
    END IF;
  END IF;

  UPDATE round_robin_schedule SET team1_score = p_team1_score, team2_score = p_team2_score WHERE id = p_schedule_id;

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
      v_event.rating_type::TEXT, 'pending', v_participant_ids, v_count_for_rating)
    RETURNING id INTO v_match_id;

    INSERT INTO match_participants (match_id, player_id, guest_player_id, team) VALUES
      (v_match_id, v_schedule.a1_player_id, v_schedule.a1_guest_id, 1),
      (v_match_id, v_schedule.a2_player_id, v_schedule.a2_guest_id, 1),
      (v_match_id, v_schedule.b1_player_id, v_schedule.b1_guest_id, 2),
      (v_match_id, v_schedule.b2_player_id, v_schedule.b2_guest_id, 2);

    -- Approval must happen AFTER all four participants exist. Inserting an
    -- already-approved parent fired the rating trigger against zero players.
    UPDATE public.matches SET status='approved' WHERE id=v_match_id;

    UPDATE round_robin_schedule SET match_id = v_match_id WHERE id = p_schedule_id;
  END IF;

  -- Unranked/guest matches still belong in each registered player's totals.
  -- The incremental rating path deliberately skips these matches.
  IF NOT v_count_for_rating THEN
    PERFORM public.recalculate_player_stats(pid) FROM unnest(v_participant_ids) AS pid;
  END IF;

  INSERT INTO round_robin_audit (event_id, editor_id, change_type, changes, reason)
  VALUES (v_event.id, v_user_id, 'score_submit',
    jsonb_build_object('schedule_id', p_schedule_id, 'match_id', v_match_id,
      'team1_score', p_team1_score, 'team2_score', p_team2_score, 'count_for_rating', v_count_for_rating),
    'Score submitted for Round ' || v_schedule.round_no || ', Court ' || v_schedule.court_no);
  RETURN v_match_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.submit_rr_match_score(UUID, INT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_rr_match_score(UUID, INT, INT) TO authenticated;

-- Legacy triggers also replayed the entire rating history on RR insert/status
-- changes. The modern approval trigger owns RR rating effects; the RPC updates
-- unranked totals. The generic 30-second duplicate detector also mistook two
-- courts with identical scores for the same match. RR uses the locked schedule
-- row and linked match ID for idempotency. Leave other sources unchanged.
DO $$
DECLARE name text; definition text;
BEGIN
  FOREACH name IN ARRAY ARRAY['handle_match_insert','handle_match_status_change','prevent_duplicate_match_insert'] LOOP
    SELECT pg_get_functiondef(p.oid) INTO definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname=name AND p.pronargs=0;
    IF definition IS NULL THEN RAISE EXCEPTION 'Missing match trigger: %',name; END IF;
    IF position('RR_PIPELINE_HANDLES_THIS' IN definition)=0 THEN
      EXECUTE regexp_replace(definition, E'\\mBEGIN\\M', E'BEGIN\n  -- RR_PIPELINE_HANDLES_THIS\n  IF NEW.source = ''round_robin'' THEN RETURN NEW; END IF;', 'i');
    END IF;
  END LOOP;
END $$;

-- Keep the original three-argument API for installed clients. New clients
-- include their rendered schedule version to prevent scoring a replaced lineup.
CREATE OR REPLACE FUNCTION public.submit_rr_match_score(
  p_schedule_id uuid,p_team1_score integer,p_team2_score integer,p_expected_schedule_version integer
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_event public.round_robin_events%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.pulse_has_required_mfa() THEN RAISE EXCEPTION 'Sign in and complete verification.' USING ERRCODE='42501'; END IF;
  SELECT e.* INTO v_event FROM public.round_robin_events e
    WHERE e.id=(SELECT event_id FROM public.round_robin_schedule WHERE id=p_schedule_id) FOR UPDATE;
  IF NOT FOUND OR NOT public.can_manage_round_robin(v_event.id,auth.uid()) THEN RAISE EXCEPTION 'Event unavailable or not authorized.' USING ERRCODE='42501'; END IF;
  IF p_expected_schedule_version IS NULL OR p_expected_schedule_version IS DISTINCT FROM coalesce(v_event.schedule_version,0) THEN
    RAISE EXCEPTION 'The lineup or round changed. Refresh and review the players before saving this score.' USING ERRCODE='40001';
  END IF;
  RETURN public.submit_rr_match_score(p_schedule_id,p_team1_score,p_team2_score);
END $$;
REVOKE ALL ON FUNCTION public.submit_rr_match_score(uuid,integer,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_rr_match_score(uuid,integer,integer,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.rr_complete_event(
  p_event_id uuid,p_expected_version integer,p_expected_unscored integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_event public.round_robin_events%ROWTYPE; v_row record; v_scored integer; v_pending integer; v_backfilled integer:=0; v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.pulse_has_required_mfa() THEN RAISE EXCEPTION 'Sign in and complete verification.' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_event FROM public.round_robin_events WHERE id=p_event_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_manage_round_robin(p_event_id,auth.uid()) THEN RAISE EXCEPTION 'Event unavailable or not authorized.' USING ERRCODE='42501'; END IF;
  IF coalesce(v_event.voided,false) OR v_event.status NOT IN ('live','completed') THEN RAISE EXCEPTION 'Only a live event can be completed.'; END IF;
  IF v_event.status='completed' THEN
    SELECT changes INTO v_result FROM public.round_robin_audit WHERE event_id=p_event_id AND change_type='event_complete' LIMIT 1;
    RETURN coalesce(v_result,jsonb_build_object('already_completed',true));
  END IF;
  IF p_expected_version IS NULL OR p_expected_version IS DISTINCT FROM coalesce(v_event.schedule_version,0) THEN
    RAISE EXCEPTION 'The schedule changed. Refresh before completing the event.' USING ERRCODE='40001';
  END IF;
  PERFORM id FROM public.round_robin_schedule WHERE event_id=p_event_id ORDER BY id FOR UPDATE;
  SELECT count(*) FILTER(WHERE team1_score IS NOT NULL AND team2_score IS NOT NULL),
    count(*) FILTER(WHERE team1_score IS NULL OR team2_score IS NULL) INTO v_scored,v_pending
    FROM public.round_robin_schedule WHERE event_id=p_event_id AND NOT is_bye AND NOT coalesce(abandoned,false)
      AND voided_at IS NULL AND superseded_by_schedule_id IS NULL;
  IF v_scored+v_pending=0 THEN RAISE EXCEPTION 'This event has no playable matches.'; END IF;
  IF p_expected_unscored IS NULL OR p_expected_unscored<0 OR v_pending<>p_expected_unscored THEN
    RAISE EXCEPTION 'Scores changed. Review the remaining matches before completing the event.' USING ERRCODE='40001';
  END IF;
  FOR v_row IN SELECT * FROM public.round_robin_schedule WHERE event_id=p_event_id AND NOT is_bye AND NOT coalesce(abandoned,false)
    AND voided_at IS NULL AND superseded_by_schedule_id IS NULL AND team1_score IS NOT NULL AND team2_score IS NOT NULL AND match_id IS NULL ORDER BY round_no,court_no
  LOOP
    PERFORM public.submit_rr_match_score(v_row.id,v_row.team1_score,v_row.team2_score);
    v_backfilled:=v_backfilled+1;
  END LOOP;
  UPDATE public.round_robin_events SET status='completed',completed_at=now(),current_round=NULL,schedule_version=coalesce(schedule_version,0)+1 WHERE id=p_event_id;
  v_result:=jsonb_build_object('synced_total',v_scored,'backfilled',v_backfilled,'unscored',v_pending);
  INSERT INTO public.round_robin_audit(event_id,editor_id,change_type,changes,reason)
    VALUES(p_event_id,auth.uid(),'event_complete',v_result,'Event marked complete');
  RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.rr_complete_event(uuid,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.rr_complete_event(uuid,integer,integer) TO authenticated;
COMMIT;
