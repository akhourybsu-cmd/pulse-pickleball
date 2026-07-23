-- Apply 20260719160000_create_league_fix_casts_and_enroll.sql + 20260719170000_ladder_explicit_progression.sql

CREATE OR REPLACE FUNCTION public.create_league(
  p_name        TEXT,
  p_description TEXT DEFAULT NULL,
  p_location    TEXT DEFAULT NULL,
  p_league_type TEXT DEFAULT 'doubles'
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user       UUID := auth.uid();
  v_is_admin   BOOLEAN;
  v_owned      INT;
  v_slots      INT := 0;
  v_max        INT;
  v_new_id     UUID;
  v_trimmed    TEXT;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  v_trimmed := TRIM(COALESCE(p_name, ''));
  IF v_trimmed = '' THEN
    RAISE EXCEPTION 'League name is required' USING ERRCODE = '22023';
  END IF;
  IF p_league_type NOT IN ('singles', 'doubles', 'team', 'flex', 'ladder') THEN
    RAISE EXCEPTION 'Invalid league_type %', p_league_type USING ERRCODE = '22023';
  END IF;
  v_is_admin := public.has_role(v_user, 'admin'::app_role);
  IF NOT v_is_admin THEN
    SELECT COUNT(*)::INT INTO v_owned FROM public.leagues WHERE created_by = v_user;
    SELECT additional_league_slots INTO v_slots FROM public.profiles WHERE id = v_user;
    IF v_slots IS NULL THEN v_slots := 0; END IF;
    v_max := 1 + v_slots;
    IF v_owned >= v_max THEN
      RAISE EXCEPTION 'League quota reached (owned %, max %). Buy a slot to add more.', v_owned, v_max
        USING ERRCODE = '53300', HINT = 'league_quota_exceeded';
    END IF;
  END IF;
  INSERT INTO public.leagues (name, description, location, created_by, league_type, status, visibility)
  VALUES (v_trimmed, NULLIF(TRIM(COALESCE(p_description, '')), ''), NULLIF(TRIM(COALESCE(p_location, '')), ''),
    v_user, p_league_type, 'draft', 'private') RETURNING id INTO v_new_id;
  INSERT INTO public.league_members (league_id, season_id, division_id, user_id, role, status)
  VALUES (v_new_id, NULL, NULL, v_user, 'manager', 'active')
  ON CONFLICT (league_id, season_id, user_id) DO NOTHING;
  INSERT INTO public.league_audit_log (league_id, actor_user_id, action, entity_type, entity_id, new_value)
  VALUES (v_new_id, v_user, 'league.created', 'league', v_new_id,
    jsonb_build_object('name', v_trimmed, 'league_type', p_league_type, 'via', 'self_serve', 'owner_enrolled_as', 'manager'));
  RETURN v_new_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_league(TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ladder_finalize_batch: PROCESS-ONLY
CREATE OR REPLACE FUNCTION public.ladder_finalize_batch(
  p_batch_id UUID,
  p_plan     JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user            UUID := auth.uid();
  v_batch           RECORD;
  v_start_snap      RECORD;
  v_result_snap_id  UUID;
  v_incomplete      INTEGER;
  v_result_players  UUID[];
  v_mv              JSONB;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000'; END IF;
  SELECT * INTO v_batch FROM public.ladder_batches WHERE id = p_batch_id FOR UPDATE;
  IF v_batch.id IS NULL THEN RAISE EXCEPTION 'Batch not found' USING ERRCODE = '02000'; END IF;
  IF NOT public.is_league_admin(v_batch.league_id, v_user) THEN
    RAISE EXCEPTION 'League admin privileges required' USING ERRCODE = '42501';
  END IF;
  IF v_batch.status = 'finalized' THEN
    RETURN jsonb_build_object('already_finalized', true, 'batch_id', v_batch.id, 'result_snapshot_id', v_batch.result_snapshot_id);
  END IF;
  SELECT count(*) INTO v_incomplete FROM public.league_matches m
    JOIN public.ladder_batch_groups g ON g.id = m.ladder_batch_group_id
   WHERE g.batch_id = p_batch_id
     AND (m.team_a_score IS NULL OR m.team_b_score IS NULL
          OR m.team_a_score = m.team_b_score
          OR m.status NOT IN ('verified','score_submitted'));
  IF v_incomplete > 0 THEN
    RAISE EXCEPTION 'Batch is not complete (% game(s) unscored/unverified)', v_incomplete USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_start_snap FROM public.ladder_snapshots WHERE id = v_batch.start_snapshot_id;
  v_result_players := ARRAY(SELECT jsonb_array_elements_text(p_plan -> 'result_snapshot' -> 'player_ids')::uuid);
  IF v_result_players IS NULL OR array_length(v_result_players, 1) IS DISTINCT FROM array_length(v_start_snap.player_ids, 1) THEN
    RAISE EXCEPTION 'Result snapshot player count differs from batch start' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM (SELECT unnest(v_result_players) EXCEPT SELECT unnest(v_start_snap.player_ids)) x)
     OR EXISTS (SELECT 1 FROM (SELECT unnest(v_start_snap.player_ids) EXCEPT SELECT unnest(v_result_players)) y) THEN
    RAISE EXCEPTION 'Result snapshot player set differs from batch start' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.ladder_snapshots
    (league_id, season_id, week_number, batch_number, kind, player_ids, source_snapshot_id, reason, schedule_version, idempotency_key, finalized_at)
  VALUES (v_batch.league_id, v_batch.season_id,
    (p_plan -> 'result_snapshot' ->> 'week')::int, (p_plan -> 'result_snapshot' ->> 'batch')::int,
    'batch_result', v_result_players, v_batch.start_snapshot_id,
    COALESCE(p_plan -> 'result_snapshot' ->> 'reason', 'batch processed'),
    v_batch.schedule_version, p_plan -> 'result_snapshot' ->> 'idempotency_key', now())
  ON CONFLICT (idempotency_key) DO NOTHING;
  SELECT id INTO v_result_snap_id FROM public.ladder_snapshots
   WHERE idempotency_key = p_plan -> 'result_snapshot' ->> 'idempotency_key';
  FOR v_mv IN SELECT * FROM jsonb_array_elements(COALESCE(p_plan -> 'movements', '[]'::jsonb))
  LOOP
    INSERT INTO public.ladder_movements
      (batch_id, group_id, player_id, start_position, finish_position, direction, capped, wins, losses, points_for, points_against)
    VALUES (p_batch_id, (v_mv ->> 'group_id')::uuid, (v_mv ->> 'player_id')::uuid,
      (v_mv ->> 'start_position')::int, (v_mv ->> 'finish_position')::int,
      v_mv ->> 'direction', NULLIF(v_mv ->> 'capped', ''),
      COALESCE((v_mv ->> 'wins')::int, 0), COALESCE((v_mv ->> 'losses')::int, 0),
      COALESCE((v_mv ->> 'points_for')::int, 0), COALESCE((v_mv ->> 'points_against')::int, 0))
    ON CONFLICT (batch_id, player_id) DO NOTHING;
  END LOOP;
  UPDATE public.ladder_batches SET status = 'finalized', result_snapshot_id = v_result_snap_id,
    finalized_at = now(), updated_at = now() WHERE id = p_batch_id;
  INSERT INTO public.league_audit_log (league_id, season_id, actor_user_id, action, entity_type, entity_id, new_value)
  VALUES (v_batch.league_id, v_batch.season_id, v_user, 'ladder.batch_processed', 'ladder_batch', p_batch_id,
    jsonb_build_object('week', v_batch.week_number, 'batch', v_batch.batch_number, 'result_snapshot_id', v_result_snap_id));
  RETURN jsonb_build_object('success', true, 'batch_id', p_batch_id, 'result_snapshot_id', v_result_snap_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.ladder_finalize_batch(UUID, JSONB) TO authenticated;

-- Generic ladder_generate_batch (new)
CREATE OR REPLACE FUNCTION public.ladder_generate_batch(
  p_season_id          UUID,
  p_start_snapshot_id  UUID,
  p_plan               JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user       UUID := auth.uid();
  v_league_id  UUID;
  v_snap       RECORD;
  v_batch_id   UUID;
  v_group_id   UUID;
  v_grp        JSONB;
  v_game       JSONB;
  v_week       INT;
  v_batch      INT;
  v_idem       TEXT;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000'; END IF;
  SELECT league_id INTO v_league_id FROM public.league_seasons WHERE id = p_season_id;
  IF v_league_id IS NULL THEN RAISE EXCEPTION 'Season not found' USING ERRCODE = '02000'; END IF;
  IF NOT public.is_league_admin(v_league_id, v_user) THEN
    RAISE EXCEPTION 'League admin privileges required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_snap FROM public.ladder_snapshots WHERE id = p_start_snapshot_id;
  IF v_snap.id IS NULL THEN RAISE EXCEPTION 'Start snapshot not found' USING ERRCODE = '02000'; END IF;

  v_week  := (p_plan -> 'batch' ->> 'week')::int;
  v_batch := (p_plan -> 'batch' ->> 'batch')::int;
  v_idem  := p_plan -> 'batch' ->> 'idempotency_key';

  -- Idempotent: if batch already exists, return it.
  SELECT id INTO v_batch_id FROM public.ladder_batches
   WHERE season_id = p_season_id AND idempotency_key = v_idem;
  IF v_batch_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'batch_id', v_batch_id, 'already_exists', true);
  END IF;

  INSERT INTO public.ladder_batches
    (league_id, season_id, week_number, batch_number, session_id, court_waves,
     start_snapshot_id, status, schedule_version, idempotency_key)
  VALUES (v_league_id, p_season_id, v_week, v_batch,
    NULLIF(p_plan -> 'batch' ->> 'session_id', '')::uuid,
    (p_plan -> 'batch' ->> 'court_waves')::int,
    p_start_snapshot_id, 'active', v_snap.schedule_version, v_idem)
  RETURNING id INTO v_batch_id;

  FOR v_grp IN SELECT * FROM jsonb_array_elements(p_plan -> 'batch' -> 'groups')
  LOOP
    INSERT INTO public.ladder_batch_groups
      (batch_id, group_index, court_number, wave, player_ids)
    VALUES (v_batch_id, (v_grp ->> 'group_index')::int,
      (v_grp ->> 'court_number')::int, (v_grp ->> 'wave')::int,
      ARRAY(SELECT jsonb_array_elements_text(v_grp -> 'player_ids')::uuid))
    RETURNING id INTO v_group_id;

    FOR v_game IN SELECT * FROM jsonb_array_elements(v_grp -> 'games')
    LOOP
      INSERT INTO public.league_matches
        (league_id, season_id, ladder_batch_group_id, ladder_game_number,
         player_a_id, player_b_id, player_c_id, player_d_id,
         status, rating_status, verified_by)
      VALUES (v_league_id, p_season_id, v_group_id, (v_game ->> 'game_number')::int,
        (v_game -> 'side_a' ->> 0)::uuid, (v_game -> 'side_a' ->> 1)::uuid,
        (v_game -> 'side_b' ->> 0)::uuid, (v_game -> 'side_b' ->> 1)::uuid,
        'scheduled', 'not_connected', '{}'::uuid[]);
    END LOOP;
  END LOOP;

  INSERT INTO public.league_audit_log (league_id, season_id, actor_user_id, action, entity_type, entity_id, new_value)
  VALUES (v_league_id, p_season_id, v_user, 'ladder.batch_generated', 'ladder_batch', v_batch_id,
    jsonb_build_object('week', v_week, 'batch', v_batch));

  RETURN jsonb_build_object('success', true, 'batch_id', v_batch_id, 'week', v_week, 'batch', v_batch);
END;
$$;
GRANT EXECUTE ON FUNCTION public.ladder_generate_batch(UUID, UUID, JSONB) TO authenticated;