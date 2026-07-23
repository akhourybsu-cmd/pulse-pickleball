-- =====================================================================
-- Ladder auto-advance (move on without the organizer present)
--
-- Adds an opt-out per-season setting and lets a TRUSTED SERVER (the
-- ladder-advance edge function, running with the service role) process a
-- complete batch and generate the next batch IN THE SAME WEEK without a
-- league admin present.
--
-- Design guardrails (enforced in the edge function; re-checked here):
--   • Auto-advance only fires when a batch is fully complete and has NO
--     movement-deciding tie. Ties still wait for a human.
--   • It never crosses a WEEK boundary — the next week is still an explicit
--     organizer action, matching the sequential-progression rule.
--
-- Security: ladder_finalize_batch / ladder_generate_batch still require a
-- league admin for normal (authenticated) callers. The ONLY added path is
-- auth.role() = 'service_role' — a claim a regular user's JWT can never
-- carry — so players cannot force progression by calling the RPCs directly.
-- =====================================================================

ALTER TABLE public.ladder_settings
  ADD COLUMN IF NOT EXISTS auto_advance BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.ladder_settings.auto_advance IS
  'When true, a complete + tie-free batch auto-processes and the next batch '
  'in the same week is generated without an organizer. Never crosses a week '
  'boundary. Turn off for fully-manual progression.';

-- ---- PROCESS-ONLY finalize, now callable by the trusted server ------
CREATE OR REPLACE FUNCTION public.ladder_finalize_batch(
  p_batch_id UUID,
  p_plan     JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user            UUID    := auth.uid();
  v_is_service      BOOLEAN := (COALESCE(auth.role(), '') = 'service_role');
  v_batch           RECORD;
  v_start_snap      RECORD;
  v_result_snap_id  UUID;
  v_incomplete      INTEGER;
  v_result_players  UUID[];
  v_mv              JSONB;
BEGIN
  IF NOT v_is_service AND v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_batch FROM public.ladder_batches
   WHERE id = p_batch_id FOR UPDATE;
  IF v_batch.id IS NULL THEN
    RAISE EXCEPTION 'Batch not found' USING ERRCODE = '02000';
  END IF;
  IF NOT v_is_service AND NOT public.is_league_admin(v_batch.league_id, v_user) THEN
    RAISE EXCEPTION 'League admin privileges required' USING ERRCODE = '42501';
  END IF;

  IF v_batch.status = 'finalized' THEN
    RETURN jsonb_build_object(
      'already_finalized', true,
      'batch_id', v_batch.id,
      'result_snapshot_id', v_batch.result_snapshot_id
    );
  END IF;

  SELECT count(*) INTO v_incomplete
    FROM public.league_matches m
    JOIN public.ladder_batch_groups g ON g.id = m.ladder_batch_group_id
   WHERE g.batch_id = p_batch_id
     AND (m.team_a_score IS NULL OR m.team_b_score IS NULL
          OR m.team_a_score = m.team_b_score
          OR m.status NOT IN ('verified','score_submitted'));
  IF v_incomplete > 0 THEN
    RAISE EXCEPTION 'Batch is not complete (% game(s) unscored/unverified)', v_incomplete
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_start_snap FROM public.ladder_snapshots
   WHERE id = v_batch.start_snapshot_id;
  v_result_players := ARRAY(
    SELECT jsonb_array_elements_text(p_plan -> 'result_snapshot' -> 'player_ids')::uuid
  );
  IF v_result_players IS NULL OR array_length(v_result_players, 1) IS DISTINCT FROM
       array_length(v_start_snap.player_ids, 1) THEN
    RAISE EXCEPTION 'Result snapshot player count differs from batch start'
      USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM (
       SELECT unnest(v_result_players) EXCEPT SELECT unnest(v_start_snap.player_ids)) x)
     OR EXISTS (SELECT 1 FROM (
       SELECT unnest(v_start_snap.player_ids) EXCEPT SELECT unnest(v_result_players)) y)
  THEN
    RAISE EXCEPTION 'Result snapshot player set differs from batch start'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.ladder_snapshots
    (league_id, season_id, week_number, batch_number, kind, player_ids,
     source_snapshot_id, reason, schedule_version, idempotency_key, finalized_at)
  VALUES (
    v_batch.league_id, v_batch.season_id,
    (p_plan -> 'result_snapshot' ->> 'week')::int,
    (p_plan -> 'result_snapshot' ->> 'batch')::int,
    'batch_result', v_result_players,
    v_batch.start_snapshot_id,
    COALESCE(p_plan -> 'result_snapshot' ->> 'reason', 'batch processed'),
    v_batch.schedule_version,
    p_plan -> 'result_snapshot' ->> 'idempotency_key',
    now()
  )
  ON CONFLICT (idempotency_key) DO NOTHING;
  SELECT id INTO v_result_snap_id FROM public.ladder_snapshots
   WHERE idempotency_key = p_plan -> 'result_snapshot' ->> 'idempotency_key';

  FOR v_mv IN SELECT * FROM jsonb_array_elements(COALESCE(p_plan -> 'movements', '[]'::jsonb))
  LOOP
    INSERT INTO public.ladder_movements
      (batch_id, group_id, player_id, start_position, finish_position,
       direction, capped, wins, losses, points_for, points_against)
    VALUES (
      p_batch_id, (v_mv ->> 'group_id')::uuid, (v_mv ->> 'player_id')::uuid,
      (v_mv ->> 'start_position')::int, (v_mv ->> 'finish_position')::int,
      v_mv ->> 'direction', NULLIF(v_mv ->> 'capped', ''),
      COALESCE((v_mv ->> 'wins')::int, 0), COALESCE((v_mv ->> 'losses')::int, 0),
      COALESCE((v_mv ->> 'points_for')::int, 0), COALESCE((v_mv ->> 'points_against')::int, 0)
    )
    ON CONFLICT (batch_id, player_id) DO NOTHING;
  END LOOP;

  UPDATE public.ladder_batches
     SET status = 'finalized', result_snapshot_id = v_result_snap_id,
         finalized_at = now(), updated_at = now()
   WHERE id = p_batch_id;

  INSERT INTO public.league_audit_log
    (league_id, season_id, actor_user_id, action, entity_type, entity_id, new_value)
  VALUES (
    v_batch.league_id, v_batch.season_id, v_user,
    'ladder.batch_processed', 'ladder_batch', p_batch_id,
    jsonb_build_object('week', v_batch.week_number, 'batch', v_batch.batch_number,
                       'result_snapshot_id', v_result_snap_id,
                       'via', CASE WHEN v_is_service THEN 'auto_advance' ELSE 'organizer' END)
  );

  RETURN jsonb_build_object(
    'already_finalized', false,
    'batch_id', p_batch_id,
    'result_snapshot_id', v_result_snap_id
  );
END;
$$;

-- ---- generic generator, now callable by the trusted server ----------
CREATE OR REPLACE FUNCTION public.ladder_generate_batch(
  p_season_id        UUID,
  p_start_snapshot_id UUID,
  p_plan             JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user       UUID    := auth.uid();
  v_is_service BOOLEAN := (COALESCE(auth.role(), '') = 'service_role');
  v_league_id  UUID;
  v_batch_id   UUID;
  v_fb         JSONB := p_plan -> 'batch';
  v_week       INT   := (v_fb ->> 'week')::int;
  v_batch      INT   := (v_fb ->> 'batch')::int;
  v_group      JSONB;
  v_game       JSONB;
  v_group_id   UUID;
BEGIN
  IF NOT v_is_service AND v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  SELECT league_id INTO v_league_id FROM public.league_seasons WHERE id = p_season_id;
  IF v_league_id IS NULL THEN
    RAISE EXCEPTION 'Season not found' USING ERRCODE = '02000';
  END IF;
  IF NOT v_is_service AND NOT public.is_league_admin(v_league_id, v_user) THEN
    RAISE EXCEPTION 'League admin privileges required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ladder_snapshots
                  WHERE id = p_start_snapshot_id AND season_id = p_season_id) THEN
    RAISE EXCEPTION 'Start snapshot not found for this season' USING ERRCODE = '22023';
  END IF;

  -- Idempotency by the natural key.
  SELECT id INTO v_batch_id FROM public.ladder_batches
   WHERE season_id = p_season_id
     AND week_number = v_week AND batch_number = v_batch;
  IF v_batch_id IS NOT NULL THEN
    RETURN jsonb_build_object('batch_id', v_batch_id, 'already_existed', true);
  END IF;

  INSERT INTO public.ladder_batches
    (league_id, season_id, session_id, week_number, batch_number,
     start_snapshot_id, status, court_waves, schedule_version, idempotency_key)
  VALUES (
    v_league_id, p_season_id,
    NULLIF(v_fb ->> 'session_id', '')::uuid,
    v_week, v_batch,
    p_start_snapshot_id, 'generated',
    COALESCE((v_fb ->> 'court_waves')::int, 1), 1,
    v_fb ->> 'idempotency_key'
  )
  ON CONFLICT (idempotency_key) DO NOTHING;
  SELECT id INTO v_batch_id FROM public.ladder_batches
   WHERE idempotency_key = v_fb ->> 'idempotency_key';

  IF v_batch_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.ladder_batch_groups WHERE batch_id = v_batch_id)
  THEN
    FOR v_group IN SELECT * FROM jsonb_array_elements(v_fb -> 'groups')
    LOOP
      INSERT INTO public.ladder_batch_groups
        (batch_id, group_index, court_number, wave, player_ids)
      VALUES (
        v_batch_id, (v_group ->> 'group_index')::int,
        NULLIF(v_group ->> 'court_number', '')::int,
        COALESCE((v_group ->> 'wave')::int, 1),
        ARRAY(SELECT jsonb_array_elements_text(v_group -> 'player_ids')::uuid)
      )
      RETURNING id INTO v_group_id;

      FOR v_game IN SELECT * FROM jsonb_array_elements(v_group -> 'games')
      LOOP
        INSERT INTO public.league_matches
          (league_id, season_id, division_id, session_id, court_number,
           status, rating_status, player_a_id, player_b_id, player_c_id, player_d_id,
           ladder_batch_group_id, ladder_game_number)
        VALUES (
          v_league_id, p_season_id, NULL,
          NULLIF(v_fb ->> 'session_id', '')::uuid,
          NULLIF(v_group ->> 'court_number', '')::int,
          'scheduled', 'not_connected',
          (v_game -> 'side_a' ->> 0)::uuid, (v_game -> 'side_a' ->> 1)::uuid,
          (v_game -> 'side_b' ->> 0)::uuid, (v_game -> 'side_b' ->> 1)::uuid,
          v_group_id, (v_game ->> 'game_number')::int
        );
      END LOOP;
    END LOOP;

    INSERT INTO public.league_audit_log
      (league_id, season_id, actor_user_id, action, entity_type, entity_id, new_value)
    VALUES (
      v_league_id, p_season_id, v_user, 'ladder.batch_generated', 'ladder_batch', v_batch_id,
      jsonb_build_object('week', v_week, 'batch', v_batch,
                         'source_snapshot_id', p_start_snapshot_id,
                         'via', CASE WHEN v_is_service THEN 'auto_advance' ELSE 'organizer' END)
    );
  END IF;

  RETURN jsonb_build_object('batch_id', v_batch_id);
END;
$$;

-- Admins keep their grant; the trusted server role is added for auto-advance.
GRANT EXECUTE ON FUNCTION public.ladder_finalize_batch(UUID, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ladder_generate_batch(UUID, UUID, JSONB) TO authenticated, service_role;
