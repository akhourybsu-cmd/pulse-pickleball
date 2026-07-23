-- =====================================================================
-- Harden ladder_generate_batch against the multi-unique-constraint
-- ON CONFLICT gotcha.
--
-- ladder_batches has TWO unique constraints: (idempotency_key) and
-- (season_id, week_number, batch_number). The generator inserted with
-- `ON CONFLICT (idempotency_key) DO NOTHING`, which only swallows a clash
-- on that ONE key. If a batch for the same (season, week, batch) already
-- exists under a DIFFERENT idempotency_key — e.g. a row left by an earlier
-- version of the finalize/generate RPCs during testing — the INSERT trips
-- the (season,week,batch) constraint and raises 23505 instead of being a
-- no-op. That surfaces as an error when generating "the next batch."
--
-- Fix: look the batch up by (season, week, batch) FIRST and return it if it
-- already exists (true idempotency, regardless of how it was keyed). Only
-- insert when nothing is there. Everything else is unchanged from
-- 20260719170000.
-- =====================================================================

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
  v_user      UUID := auth.uid();
  v_league_id UUID;
  v_batch_id  UUID;
  v_fb        JSONB := p_plan -> 'batch';
  v_week      INT   := (v_fb ->> 'week')::int;
  v_batch     INT   := (v_fb ->> 'batch')::int;
  v_group     JSONB;
  v_game      JSONB;
  v_group_id  UUID;
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
  IF NOT EXISTS (SELECT 1 FROM public.ladder_snapshots
                  WHERE id = p_start_snapshot_id AND season_id = p_season_id) THEN
    RAISE EXCEPTION 'Start snapshot not found for this season' USING ERRCODE = '22023';
  END IF;

  -- Idempotency by the natural key: if this stage already exists (under ANY
  -- idempotency_key), return it instead of tripping the unique constraint.
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
                         'source_snapshot_id', p_start_snapshot_id)
    );
  END IF;

  RETURN jsonb_build_object('batch_id', v_batch_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.ladder_generate_batch(UUID, UUID, JSONB) TO authenticated;
