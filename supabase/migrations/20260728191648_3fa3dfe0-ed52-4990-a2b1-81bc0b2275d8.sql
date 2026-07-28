-- =====================================================================
-- Ladder hardening (deploy readiness). No feature changes.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.ladder_reopen_batch(
  p_batch_id UUID,
  p_force    BOOLEAN DEFAULT FALSE
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user      UUID := auth.uid();
  v_batch     RECORD;
  v_played    INTEGER;
  v_down_batches INTEGER;
  v_rating_rows INTEGER := 0;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_batch FROM public.ladder_batches
   WHERE id = p_batch_id FOR UPDATE;
  IF v_batch.id IS NULL THEN
    RAISE EXCEPTION 'Batch not found' USING ERRCODE = '02000';
  END IF;
  IF NOT public.is_league_admin(v_batch.league_id, v_user) THEN
    RAISE EXCEPTION 'League admin privileges required' USING ERRCODE = '42501';
  END IF;
  IF v_batch.status <> 'finalized' THEN
    RAISE EXCEPTION 'Only a finalized batch can be reopened' USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO v_down_batches
    FROM public.ladder_batches b
   WHERE b.season_id = v_batch.season_id
     AND (b.week_number, b.batch_number) > (v_batch.week_number, v_batch.batch_number);

  SELECT count(*) INTO v_played
    FROM public.league_matches m
    JOIN public.ladder_batch_groups g ON g.id = m.ladder_batch_group_id
    JOIN public.ladder_batches b      ON b.id = g.batch_id
   WHERE b.season_id = v_batch.season_id
     AND (b.week_number, b.batch_number) > (v_batch.week_number, v_batch.batch_number)
     AND m.team_a_score IS NOT NULL;

  IF v_played > 0 AND NOT p_force THEN
    RAISE EXCEPTION
      'Reopening will discard % already-played downstream game(s)', v_played
      USING ERRCODE = '22023', HINT = 'downstream_has_results';
  END IF;

  DELETE FROM public.matches mm
   WHERE mm.id IN (
     SELECT m.linked_match_id
       FROM public.league_matches m
       JOIN public.ladder_batch_groups g ON g.id = m.ladder_batch_group_id
       JOIN public.ladder_batches b      ON b.id = g.batch_id
      WHERE b.season_id = v_batch.season_id
        AND (b.week_number, b.batch_number) > (v_batch.week_number, v_batch.batch_number)
        AND m.linked_match_id IS NOT NULL
   );
  GET DIAGNOSTICS v_rating_rows = ROW_COUNT;

  DELETE FROM public.ladder_batches b
   WHERE b.season_id = v_batch.season_id
     AND (b.week_number, b.batch_number) > (v_batch.week_number, v_batch.batch_number);

  DELETE FROM public.ladder_snapshots s
   WHERE s.season_id = v_batch.season_id
     AND s.kind = 'batch_result'
     AND (s.week_number, s.batch_number) > (v_batch.week_number, v_batch.batch_number);

  DELETE FROM public.ladder_movements WHERE batch_id = p_batch_id;
  IF v_batch.result_snapshot_id IS NOT NULL THEN
    DELETE FROM public.ladder_snapshots WHERE id = v_batch.result_snapshot_id;
  END IF;
  UPDATE public.ladder_batches
     SET status = 'in_progress', result_snapshot_id = NULL,
         finalized_at = NULL, schedule_version = schedule_version + 1,
         updated_at = now()
   WHERE id = p_batch_id;

  IF v_rating_rows > 0 THEN
    PERFORM public.recalculate_all_ratings();
  END IF;

  INSERT INTO public.league_audit_log
    (league_id, season_id, actor_user_id, action, entity_type, entity_id, new_value)
  VALUES (
    v_batch.league_id, v_batch.season_id, v_user,
    'ladder.batch_reopened', 'ladder_batch', p_batch_id,
    jsonb_build_object(
      'week', v_batch.week_number, 'batch', v_batch.batch_number,
      'downstream_batches_removed', v_down_batches,
      'downstream_played_games_discarded', CASE WHEN p_force THEN v_played ELSE 0 END,
      'rating_rows_removed', v_rating_rows,
      'forced', p_force
    )
  );

  RETURN jsonb_build_object(
    'batch_id', p_batch_id,
    'downstream_batches_removed', v_down_batches,
    'downstream_played_games_discarded', CASE WHEN p_force THEN v_played ELSE 0 END,
    'rating_rows_removed', v_rating_rows
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ladder_reopen_batch(UUID, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_ladder_sub_request(p_request_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_req  RECORD;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  SELECT * INTO v_req FROM public.ladder_sub_requests WHERE id = p_request_id;
  IF v_req.id IS NULL THEN
    RAISE EXCEPTION 'Request not found' USING ERRCODE = '02000';
  END IF;
  IF v_req.player_id <> v_user AND NOT public.is_league_admin(v_req.league_id, v_user) THEN
    RAISE EXCEPTION 'You can only cancel your own request' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.ladder_batches
     WHERE season_id = v_req.season_id AND week_number = v_req.week_number
  ) THEN
    RAISE EXCEPTION 'Week % is already generated — its roster is locked', v_req.week_number
      USING ERRCODE = '22023';
  END IF;
  IF v_req.status = 'sitout' THEN
    DELETE FROM public.ladder_week_sitouts
     WHERE season_id = v_req.season_id AND week_number = v_req.week_number
       AND player_id = v_req.player_id;
  END IF;
  UPDATE public.ladder_sub_requests
     SET status = 'canceled', assigned_sub_id = NULL, updated_at = now()
   WHERE id = p_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_ladder_sub_request(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.swap_league_week_player(
  p_league_id     UUID,
  p_season_id     UUID,
  p_out_player_id UUID,
  p_in_player_id  UUID,
  p_note          TEXT DEFAULT NULL,
  p_batch_id      UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user       UUID    := auth.uid();
  v_is_service BOOLEAN := (COALESCE(auth.role(), '') = 'service_role');
  v_is_sub     BOOLEAN;
  v_is_mem     BOOLEAN;
  v_m          RECORD;
  v_count      INT := 0;
  v_slot       TEXT;
  v_orig       UUID;
  v_actor      UUID;
BEGIN
  IF NOT v_is_service AND v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  IF NOT v_is_service AND NOT public.is_league_admin(p_league_id, v_user) THEN
    RAISE EXCEPTION 'League admin privileges required' USING ERRCODE = '42501';
  END IF;
  IF p_out_player_id IS NULL OR p_in_player_id IS NULL THEN
    RAISE EXCEPTION 'Both players are required' USING ERRCODE = '22023';
  END IF;
  IF p_out_player_id = p_in_player_id THEN
    RAISE EXCEPTION 'Pick a different fill-in player' USING ERRCODE = '22023';
  END IF;

  IF p_batch_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.ladder_batches b
       WHERE b.id = p_batch_id AND b.league_id = p_league_id AND b.season_id = p_season_id
    ) THEN
      RAISE EXCEPTION 'Batch does not belong to this season' USING ERRCODE = '22023';
    END IF;
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.league_substitutes s
     WHERE s.league_id = p_league_id AND s.season_id = p_season_id
       AND s.user_id = p_in_player_id AND s.status = 'active') INTO v_is_sub;
  SELECT EXISTS (SELECT 1 FROM public.league_members m
     WHERE m.league_id = p_league_id AND m.season_id = p_season_id
       AND m.user_id = p_in_player_id AND m.status = 'active') INTO v_is_mem;
  IF NOT v_is_sub AND NOT v_is_mem THEN
    RAISE EXCEPTION 'The fill-in must be an active substitute or member of this season'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.league_matches lm
     WHERE lm.league_id = p_league_id AND lm.season_id = p_season_id
       AND lm.status IN ('scheduled', 'in_progress')
       AND p_in_player_id IN (lm.player_a_id, lm.player_b_id, lm.player_c_id, lm.player_d_id)
       AND (
         p_batch_id IS NULL
         OR lm.ladder_batch_group_id IN (
              SELECT g.id FROM public.ladder_batch_groups g WHERE g.batch_id = p_batch_id
            )
       )
  ) THEN
    RAISE EXCEPTION 'That fill-in is already scheduled to play %; pick someone else',
      CASE WHEN p_batch_id IS NULL THEN 'this week' ELSE 'in this batch' END
      USING ERRCODE = '22023';
  END IF;

  FOR v_m IN
    SELECT lm.* FROM public.league_matches lm
     WHERE lm.league_id = p_league_id AND lm.season_id = p_season_id
       AND lm.status IN ('scheduled', 'in_progress')
       AND p_out_player_id IN (lm.player_a_id, lm.player_b_id, lm.player_c_id, lm.player_d_id)
       AND (
         p_batch_id IS NULL
         OR lm.ladder_batch_group_id IN (
              SELECT g.id FROM public.ladder_batch_groups g WHERE g.batch_id = p_batch_id
            )
       )
     FOR UPDATE
  LOOP
    IF p_in_player_id IN (v_m.player_a_id, v_m.player_b_id, v_m.player_c_id, v_m.player_d_id) THEN
      RAISE EXCEPTION 'That player is already in one of these games — pick another fill-in'
        USING ERRCODE = '22023';
    END IF;

    v_slot := CASE p_out_player_id
      WHEN v_m.player_a_id THEN 'a' WHEN v_m.player_b_id THEN 'b'
      WHEN v_m.player_c_id THEN 'c' ELSE 'd' END;

    IF v_slot = 'a' THEN
      UPDATE public.league_matches SET player_a_id = p_in_player_id, updated_at = now() WHERE id = v_m.id;
    ELSIF v_slot = 'b' THEN
      UPDATE public.league_matches SET player_b_id = p_in_player_id, updated_at = now() WHERE id = v_m.id;
    ELSIF v_slot = 'c' THEN
      UPDATE public.league_matches SET player_c_id = p_in_player_id, updated_at = now() WHERE id = v_m.id;
    ELSE
      UPDATE public.league_matches SET player_d_id = p_in_player_id, updated_at = now() WHERE id = v_m.id;
    END IF;

    SELECT out_player_id INTO v_orig FROM public.league_match_substitutions
     WHERE match_id = v_m.id AND slot = v_slot;
    v_orig := COALESCE(v_orig, p_out_player_id);

    IF p_in_player_id = v_orig THEN
      DELETE FROM public.league_match_substitutions WHERE match_id = v_m.id AND slot = v_slot;
    ELSE
      INSERT INTO public.league_match_substitutions
        (league_id, season_id, match_id, slot, out_player_id, in_player_id, note, created_by)
      VALUES (p_league_id, p_season_id, v_m.id, v_slot, v_orig, p_in_player_id,
              NULLIF(TRIM(COALESCE(p_note, '')), ''), v_user)
      ON CONFLICT (match_id, slot) DO UPDATE
        SET in_player_id = EXCLUDED.in_player_id,
            out_player_id = EXCLUDED.out_player_id,
            note = EXCLUDED.note, updated_at = now();
    END IF;

    v_count := v_count + 1;
  END LOOP;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'That player has no upcoming games to fill in for' USING ERRCODE = '02000';
  END IF;

  v_actor := COALESCE(v_user, (SELECT created_by FROM public.leagues WHERE id = p_league_id));
  INSERT INTO public.league_audit_log
    (league_id, season_id, actor_user_id, action, entity_type, entity_id, new_value)
  VALUES (
    p_league_id, p_season_id, v_actor, 'league.week_player_swapped', 'league_season', p_season_id,
    jsonb_build_object('out_player_id', p_out_player_id, 'in_player_id', p_in_player_id,
                       'was_substitute', v_is_sub, 'games', v_count, 'batch_id', p_batch_id,
                       'via', CASE WHEN v_is_service THEN 'auto_advance' ELSE 'organizer' END,
                       'note', COALESCE(NULLIF(TRIM(COALESCE(p_note, '')), ''), '(none)'))
  );

  RETURN jsonb_build_object('matches_updated', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.swap_league_week_player(UUID, UUID, UUID, UUID, TEXT, UUID)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.submit_league_match_score(
  p_match_id     UUID,
  p_team_a_score INTEGER,
  p_team_b_score INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user           UUID := auth.uid();
  v_match          RECORD;
  v_self_report    BOOLEAN := false;
  v_scheduled_date DATE;
  v_start_time     TIME;
  v_scheduled_at   TIMESTAMPTZ;
  v_new_status     TEXT;
  v_is_admin       BOOLEAN := false;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  IF p_team_a_score IS NULL OR p_team_b_score IS NULL
     OR p_team_a_score < 0 OR p_team_b_score < 0 THEN
    RAISE EXCEPTION 'Scores must be non-negative integers'
      USING ERRCODE = '22023';
  END IF;
  IF p_team_a_score = p_team_b_score THEN
    RAISE EXCEPTION 'Scores can''t be tied' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_match
    FROM public.league_matches WHERE id = p_match_id FOR UPDATE;
  IF v_match.id IS NULL THEN
    RAISE EXCEPTION 'Match not found' USING ERRCODE = '02000';
  END IF;

  v_is_admin := public.is_league_admin(v_match.league_id, v_user);

  IF NOT v_is_admin AND NOT public.player_is_in_league_match(p_match_id) THEN
    RAISE EXCEPTION 'Only participants can submit scores'
      USING ERRCODE = '42501';
  END IF;

  IF v_match.status IN ('verified', 'canceled', 'forfeit') THEN
    RAISE EXCEPTION 'Match is already % — ask an admin to edit',
      v_match.status USING ERRCODE = '22023';
  END IF;

  IF NOT v_is_admin THEN
    IF v_match.session_id IS NOT NULL THEN
      SELECT scheduled_date, start_time
        INTO v_scheduled_date, v_start_time
        FROM public.league_sessions
       WHERE id = v_match.session_id;
      IF v_scheduled_date IS NOT NULL THEN
        v_scheduled_at :=
          (v_scheduled_date::timestamp + COALESCE(v_start_time, '00:00'::time))
          AT TIME ZONE 'UTC';
        IF NOW() < v_scheduled_at THEN
          RAISE EXCEPTION
            'Scores can''t be entered before the scheduled start (% %)',
            to_char(v_scheduled_date, 'Mon DD'),
            COALESCE(to_char(v_start_time, 'HH12:MI AM'), '')
            USING ERRCODE = '22023';
        END IF;
      END IF;
    ELSIF v_match.scheduled_time IS NOT NULL
          AND v_match.scheduled_time > NOW() THEN
      RAISE EXCEPTION
        'Scores can''t be entered before the scheduled start (%)',
        to_char(v_match.scheduled_time, 'Mon DD HH12:MI AM')
        USING ERRCODE = '22023';
    END IF;
  END IF;

  SELECT ls.self_report_scoring INTO v_self_report
    FROM public.ladder_settings ls
   WHERE ls.season_id = v_match.season_id;

  v_new_status := CASE
    WHEN v_is_admin OR COALESCE(v_self_report, false) THEN 'verified'
    ELSE 'score_submitted'
  END;

  UPDATE public.league_matches
     SET team_a_score       = p_team_a_score,
         team_b_score       = p_team_b_score,
         status             = v_new_status,
         score_submitted_by = v_user,
         score_submitted_at = NOW(),
         verified_by        = ARRAY[v_user]::UUID[],
         updated_at         = NOW()
   WHERE id = p_match_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_league_match_score(UUID, INTEGER, INTEGER) TO authenticated;