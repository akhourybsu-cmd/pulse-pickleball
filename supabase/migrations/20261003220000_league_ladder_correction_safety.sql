-- A processed ladder order depends on its games. Correct it through Reopen,
-- which invalidates downstream draws, rather than silently changing history.
BEGIN;

CREATE OR REPLACE FUNCTION public.guard_processed_ladder_game()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_old_group uuid;
  v_new_group uuid;
  v_batch record;
BEGIN
  IF TG_OP <> 'INSERT' THEN v_old_group := OLD.ladder_batch_group_id; END IF;
  IF TG_OP <> 'DELETE' THEN v_new_group := NEW.ladder_batch_group_id; END IF;
  IF TG_OP = 'UPDATE' AND
    ROW(NEW.ladder_batch_group_id, NEW.ladder_game_number, NEW.status,
        NEW.team_a_score, NEW.team_b_score, NEW.team_a_id, NEW.team_b_id,
        NEW.player_a_id, NEW.player_b_id, NEW.player_c_id, NEW.player_d_id)
    IS NOT DISTINCT FROM
    ROW(OLD.ladder_batch_group_id, OLD.ladder_game_number, OLD.status,
        OLD.team_a_score, OLD.team_b_score, OLD.team_a_id, OLD.team_b_id,
        OLD.player_a_id, OLD.player_b_id, OLD.player_c_id, OLD.player_d_id) THEN
    RETURN NEW;
  END IF;
  -- Hold the batch against concurrent finalization while a game is changed.
  -- During a cascading batch removal the parent is already gone, so Reopen
  -- can still remove downstream games atomically after its result warning.
  FOR v_batch IN
    SELECT b.id, b.status FROM public.ladder_batches b
    WHERE b.id IN (SELECT g.batch_id FROM public.ladder_batch_groups g
                   WHERE g.id IN (v_old_group, v_new_group))
    ORDER BY b.id FOR SHARE
  LOOP
    IF v_batch.status = 'finalized' THEN
      RAISE EXCEPTION 'Reopen this ladder batch before changing its games; the saved standings and later rounds depend on these results'
        USING ERRCODE = '22023';
    END IF;
  END LOOP;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_processed_ladder_game ON public.league_matches;
CREATE TRIGGER trg_guard_processed_ladder_game
  BEFORE INSERT OR UPDATE OR DELETE ON public.league_matches
  FOR EACH ROW EXECUTE FUNCTION public.guard_processed_ladder_game();


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

  -- Back out ratings for the downstream games we're about to discard: their
  -- bridged `matches` rows would otherwise linger as approved + rated (the
  -- ladder→matches bridge has no DELETE path, and league_matches.linked_match_id
  -- is FK'd the wrong way to help). Delete them, then replay ratings.
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

  -- Wipe downstream batches (cascades groups → games → movements).
  DELETE FROM public.ladder_batches b
   WHERE b.season_id = v_batch.season_id
     AND (b.week_number, b.batch_number) > (v_batch.week_number, v_batch.batch_number);

  DELETE FROM public.ladder_snapshots s
   WHERE s.season_id = v_batch.season_id
     AND s.kind = 'batch_result'
     AND (s.week_number, s.batch_number) > (v_batch.week_number, v_batch.batch_number);

  -- A reopened round may still have all its verified scores. Pause the
  -- automation before exposing it, otherwise a refresh can process the old
  -- scores again before the manager makes the correction.
  UPDATE public.ladder_settings SET auto_advance = false
   WHERE season_id = v_batch.season_id;
  -- Tiebreak decisions were made against the old scores. Require a fresh
  -- decision if corrected play still produces a tie.
  DELETE FROM public.ladder_tiebreaks WHERE batch_id = p_batch_id;

  DELETE FROM public.ladder_movements WHERE batch_id = p_batch_id;
  IF v_batch.result_snapshot_id IS NOT NULL THEN
    DELETE FROM public.ladder_snapshots WHERE id = v_batch.result_snapshot_id;
  END IF;
  UPDATE public.ladder_batches
     SET status = 'in_progress', result_snapshot_id = NULL,
         finalized_at = NULL, schedule_version = schedule_version + 1,
         updated_at = now()
   WHERE id = p_batch_id;

  -- Replay ratings from the surviving approved matches (only if we removed
  -- any bridged rows — reopening a season with no rated downstream is free).
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
      'auto_advance_paused', true,
      'forced', p_force
    )
  );

  RETURN jsonb_build_object(
    'batch_id', p_batch_id,
    'downstream_batches_removed', v_down_batches,
    'downstream_played_games_discarded', CASE WHEN p_force THEN v_played ELSE 0 END,
    'rating_rows_removed', v_rating_rows,
    'auto_advance_paused', true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ladder_reopen_batch(UUID, BOOLEAN) TO authenticated;


COMMIT;
