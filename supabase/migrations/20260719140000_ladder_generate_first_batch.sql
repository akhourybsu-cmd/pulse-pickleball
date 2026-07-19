-- =====================================================================
-- Ladder (Phase 4b): start-of-season generation
--
-- Creates the immutable INITIAL ladder snapshot and Week 1 / Batch 1
-- (groups + the three rotating-partner games each) in one transaction.
-- Idempotent via the same unique keys as finalization, so a retry never
-- creates a second initial snapshot or a duplicate first batch.
--
-- The ordered player list + the batch's group/game structure are computed
-- by the ladder-generate-first-batch edge function using the tested pure
-- engine (groupIntoFours + batchMatchups). This RPC persists + guards it.
--
-- Plan shape:
-- {
--   "order": [uuid…],                    initial ladder order
--   "initial_idempotency_key": "init:<season>",
--   "first_batch": {
--     "week":1,"batch":1,"session_id":null,"court_waves":1,
--     "idempotency_key":"batch:<season>:1:1",
--     "groups": [ { "group_index","court_number","wave",
--                   "player_ids":[a,b,c,d],
--                   "games":[ {"game_number","side_a":[a,b],"side_b":[c,d]} … ] } … ]
--   }
-- }
-- =====================================================================

CREATE OR REPLACE FUNCTION public.ladder_generate_first_batch(
  p_season_id UUID,
  p_plan      JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user        UUID := auth.uid();
  v_league_id   UUID;
  v_init_id     UUID;
  v_batch_id    UUID;
  v_fb          JSONB := p_plan -> 'first_batch';
  v_group       JSONB;
  v_game        JSONB;
  v_group_id    UUID;
  v_order       UUID[];
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT league_id INTO v_league_id FROM public.league_seasons WHERE id = p_season_id;
  IF v_league_id IS NULL THEN
    RAISE EXCEPTION 'Season not found' USING ERRCODE = '02000';
  END IF;
  IF NOT public.is_league_admin(v_league_id, v_user) THEN
    RAISE EXCEPTION 'League admin privileges required' USING ERRCODE = '42501';
  END IF;

  v_order := ARRAY(SELECT jsonb_array_elements_text(p_plan -> 'order')::uuid);
  IF v_order IS NULL OR array_length(v_order, 1) IS NULL
     OR array_length(v_order, 1) % 4 <> 0 THEN
    RAISE EXCEPTION 'Initial order must be a non-empty list divisible by four'
      USING ERRCODE = '22023';
  END IF;

  -- ---- initial snapshot (idempotent) --------------------------------
  INSERT INTO public.ladder_snapshots
    (league_id, season_id, week_number, batch_number, kind, player_ids,
     reason, schedule_version, idempotency_key, finalized_at)
  VALUES (
    v_league_id, p_season_id, 0, 0, 'initial', v_order,
    'initial ladder order', 1,
    p_plan ->> 'initial_idempotency_key', now()
  )
  ON CONFLICT (idempotency_key) DO NOTHING;
  SELECT id INTO v_init_id FROM public.ladder_snapshots
   WHERE idempotency_key = p_plan ->> 'initial_idempotency_key';

  -- ---- Week 1 / Batch 1 (idempotent) --------------------------------
  INSERT INTO public.ladder_batches
    (league_id, season_id, session_id, week_number, batch_number,
     start_snapshot_id, status, court_waves, schedule_version, idempotency_key)
  VALUES (
    v_league_id, p_season_id,
    NULLIF(v_fb ->> 'session_id', '')::uuid,
    (v_fb ->> 'week')::int, (v_fb ->> 'batch')::int,
    v_init_id, 'generated',
    COALESCE((v_fb ->> 'court_waves')::int, 1), 1,
    v_fb ->> 'idempotency_key'
  )
  ON CONFLICT (idempotency_key) DO NOTHING;
  SELECT id INTO v_batch_id FROM public.ladder_batches
   WHERE idempotency_key = v_fb ->> 'idempotency_key';

  -- ---- groups + games (only if this call created the batch) ----------
  IF v_batch_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.ladder_batch_groups WHERE batch_id = v_batch_id)
  THEN
    FOR v_group IN SELECT * FROM jsonb_array_elements(v_fb -> 'groups')
    LOOP
      INSERT INTO public.ladder_batch_groups
        (batch_id, group_index, court_number, wave, player_ids)
      VALUES (
        v_batch_id,
        (v_group ->> 'group_index')::int,
        NULLIF(v_group ->> 'court_number', '')::int,
        COALESCE((v_group ->> 'wave')::int, 1),
        ARRAY(SELECT jsonb_array_elements_text(v_group -> 'player_ids')::uuid)
      )
      RETURNING id INTO v_group_id;

      FOR v_game IN SELECT * FROM jsonb_array_elements(v_group -> 'games')
      LOOP
        INSERT INTO public.league_matches
          (league_id, season_id, division_id, session_id, court_number,
           status, rating_status,
           player_a_id, player_b_id, player_c_id, player_d_id,
           ladder_batch_group_id, ladder_game_number)
        VALUES (
          v_league_id, p_season_id, NULL,
          NULLIF(v_fb ->> 'session_id', '')::uuid,
          NULLIF(v_group ->> 'court_number', '')::int,
          'scheduled', 'not_connected',
          (v_game -> 'side_a' ->> 0)::uuid,
          (v_game -> 'side_a' ->> 1)::uuid,
          (v_game -> 'side_b' ->> 0)::uuid,
          (v_game -> 'side_b' ->> 1)::uuid,
          v_group_id,
          (v_game ->> 'game_number')::int
        );
      END LOOP;
    END LOOP;

    -- Flip settings to active on first generation.
    UPDATE public.ladder_settings
       SET status = 'active', updated_at = now()
     WHERE season_id = p_season_id AND status = 'setup';

    INSERT INTO public.league_audit_log
      (league_id, season_id, actor_user_id, action, entity_type, entity_id, new_value)
    VALUES (
      v_league_id, p_season_id, v_user,
      'ladder.season_started', 'ladder_batch', v_batch_id,
      jsonb_build_object('players', array_length(v_order, 1))
    );
  END IF;

  RETURN jsonb_build_object(
    'initial_snapshot_id', v_init_id,
    'first_batch_id', v_batch_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ladder_generate_first_batch(UUID, JSONB) TO authenticated;

COMMENT ON FUNCTION public.ladder_generate_first_batch IS
  'Transactional, idempotent start-of-season generation: writes the '
  'initial ladder snapshot + Week 1/Batch 1 groups and games. Plan is '
  'computed by the ladder-generate-first-batch edge function via the '
  'tested pure engine.';
