-- =====================================================================
-- Ladder (Phase 5c): reopen a finalized batch + guarded downstream cleanup
--
-- Corrections after finalization are the riskiest path — a wrong score in
-- an earlier batch means every batch generated AFTER it came from the
-- wrong ladder order. This RPC reopens a finalized batch for re-scoring
-- and clears the now-invalid downstream so a corrected re-finalize
-- regenerates it cleanly — WITHOUT silently destroying real results.
--
-- Safety:
--   • commissioner-only (is_league_admin), row-locked
--   • if any downstream batch already has PLAYED games (a real score),
--     it refuses unless p_force = true, returning a clear count so the UI
--     can present an explicit "this will discard N played games" decision
--   • deleting downstream ladder_batches cascades their groups → games
--     (league_matches) → movements; downstream result snapshots are
--     removed explicitly; this batch is un-finalized (its result snapshot
--     + movements removed) with its game scores left intact for editing
--
-- After reopening, the batch becomes the active (lowest unfinalized) batch
-- again; correct the score and finalize to regenerate everything forward.
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

  -- Downstream = batches later than this one in the same season.
  SELECT count(*) INTO v_down_batches
    FROM public.ladder_batches b
   WHERE b.season_id = v_batch.season_id
     AND (b.week_number, b.batch_number) > (v_batch.week_number, v_batch.batch_number);

  -- Played downstream games (a real, entered score) — protected.
  SELECT count(*) INTO v_played
    FROM public.league_matches m
    JOIN public.ladder_batch_groups g ON g.id = m.ladder_batch_group_id
    JOIN public.ladder_batches b      ON b.id = g.batch_id
   WHERE b.season_id = v_batch.season_id
     AND (b.week_number, b.batch_number) > (v_batch.week_number, v_batch.batch_number)
     AND m.team_a_score IS NOT NULL;

  IF v_played > 0 AND NOT p_force THEN
    -- Do NOT destroy real results without an explicit decision.
    RAISE EXCEPTION
      'Reopening will discard % already-played downstream game(s)', v_played
      USING ERRCODE = '22023', HINT = 'downstream_has_results';
  END IF;

  -- Wipe downstream batches (cascades groups → games → movements).
  DELETE FROM public.ladder_batches b
   WHERE b.season_id = v_batch.season_id
     AND (b.week_number, b.batch_number) > (v_batch.week_number, v_batch.batch_number);

  -- Remove downstream result snapshots (not FK-linked to batches).
  DELETE FROM public.ladder_snapshots s
   WHERE s.season_id = v_batch.season_id
     AND s.kind = 'batch_result'
     AND (s.week_number, s.batch_number) > (v_batch.week_number, v_batch.batch_number);

  -- Un-finalize THIS batch: drop its result snapshot + movements, keep
  -- the game rows (with scores) so the commissioner can edit + refinalize.
  DELETE FROM public.ladder_movements WHERE batch_id = p_batch_id;
  IF v_batch.result_snapshot_id IS NOT NULL THEN
    DELETE FROM public.ladder_snapshots WHERE id = v_batch.result_snapshot_id;
  END IF;
  UPDATE public.ladder_batches
     SET status = 'in_progress', result_snapshot_id = NULL,
         finalized_at = NULL, schedule_version = schedule_version + 1,
         updated_at = now()
   WHERE id = p_batch_id;

  INSERT INTO public.league_audit_log
    (league_id, season_id, actor_user_id, action, entity_type, entity_id, new_value)
  VALUES (
    v_batch.league_id, v_batch.season_id, v_user,
    'ladder.batch_reopened', 'ladder_batch', p_batch_id,
    jsonb_build_object(
      'week', v_batch.week_number, 'batch', v_batch.batch_number,
      'downstream_batches_removed', v_down_batches,
      'downstream_played_games_discarded', CASE WHEN p_force THEN v_played ELSE 0 END,
      'forced', p_force
    )
  );

  RETURN jsonb_build_object(
    'batch_id', p_batch_id,
    'downstream_batches_removed', v_down_batches,
    'downstream_played_games_discarded', CASE WHEN p_force THEN v_played ELSE 0 END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ladder_reopen_batch(UUID, BOOLEAN) TO authenticated;

COMMENT ON FUNCTION public.ladder_reopen_batch IS
  'Commissioner-only. Reopens a finalized ladder batch for correction and '
  'clears now-invalid downstream batches/snapshots so a re-finalize '
  'regenerates them. Refuses to discard already-played downstream games '
  'unless p_force = true (HINT downstream_has_results lets the UI ask '
  'first). Transactional + row-locked.';
