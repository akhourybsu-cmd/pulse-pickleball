-- =====================================================================
-- Ladder (Phase 4b): transactional, idempotent batch finalization
--
-- The MATH (ranking + movement) is computed by the tested pure engine in
-- the ladder-finalize-batch edge function, reading the REAL scores from
-- the DB (server-side, authoritative — the client never supplies ladder
-- positions). This RPC then PERSISTS that plan in a single locked
-- transaction, enforcing every safety invariant:
--
--   • row lock on the batch  → two near-simultaneous final scores can't
--     both advance it (one wins, the other sees 'finalized' and no-ops)
--   • idempotent             → re-running returns the existing result
--     instead of applying movement twice or duplicating the next batch
--   • integrity re-check      → the result snapshot must contain EXACTLY
--     the same players as the batch's start snapshot (none added/dropped)
--   • completeness re-check   → every game must be verified/submitted with
--     a valid score before movement is applied
--   • unique keys             → duplicate snapshots/batches are impossible
--     even under a race, because of the table-level unique constraints
--
-- Plan shape (built by the edge function):
-- {
--   "result_snapshot": { "week", "batch", "player_ids":[…], "reason",
--                        "idempotency_key" },
--   "movements": [ { "player_id","group_id","start_position",
--                    "finish_position","direction","capped",
--                    "wins","losses","points_for","points_against" } … ],
--   "next": null | {
--     "week","batch","session_id","idempotency_key","court_waves",
--     "groups": [ { "group_index","court_number","wave",
--                   "player_ids":[a,b,c,d],
--                   "games":[ {"game_number","side_a":[a,b],
--                              "side_b":[c,d]} … ] } … ]
--   }
-- }
-- =====================================================================

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
  v_next            JSONB := p_plan -> 'next';
  v_next_batch_id   UUID;
  v_group           JSONB;
  v_game            JSONB;
  v_group_id        UUID;
  v_incomplete      INTEGER;
  v_result_players  UUID[];
  v_mv              JSONB;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  -- ---- lock the batch (serializes concurrent finalizations) ----------
  SELECT * INTO v_batch FROM public.ladder_batches
   WHERE id = p_batch_id FOR UPDATE;
  IF v_batch.id IS NULL THEN
    RAISE EXCEPTION 'Batch not found' USING ERRCODE = '02000';
  END IF;
  IF NOT public.is_league_admin(v_batch.league_id, v_user) THEN
    RAISE EXCEPTION 'League admin privileges required' USING ERRCODE = '42501';
  END IF;

  -- ---- idempotency: already finalized → return existing result -------
  IF v_batch.status = 'finalized' THEN
    RETURN jsonb_build_object(
      'already_finalized', true,
      'batch_id', v_batch.id,
      'result_snapshot_id', v_batch.result_snapshot_id
    );
  END IF;

  -- ---- completeness re-check (server-side, not trusting the client) --
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

  -- ---- integrity: result snapshot must hold the same player set ------
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
  IF EXISTS (
    SELECT 1 FROM (
      SELECT unnest(v_result_players) EXCEPT SELECT unnest(v_start_snap.player_ids)
    ) x
  ) OR EXISTS (
    SELECT 1 FROM (
      SELECT unnest(v_start_snap.player_ids) EXCEPT SELECT unnest(v_result_players)
    ) y
  ) THEN
    RAISE EXCEPTION 'Result snapshot player set differs from batch start'
      USING ERRCODE = '22023';
  END IF;

  -- ---- write the result snapshot (idempotent on unique key) ----------
  INSERT INTO public.ladder_snapshots
    (league_id, season_id, week_number, batch_number, kind, player_ids,
     source_snapshot_id, reason, schedule_version, idempotency_key, finalized_at)
  VALUES (
    v_batch.league_id, v_batch.season_id,
    (p_plan -> 'result_snapshot' ->> 'week')::int,
    (p_plan -> 'result_snapshot' ->> 'batch')::int,
    'batch_result', v_result_players,
    v_batch.start_snapshot_id,
    COALESCE(p_plan -> 'result_snapshot' ->> 'reason', 'batch finalized'),
    v_batch.schedule_version,
    p_plan -> 'result_snapshot' ->> 'idempotency_key',
    now()
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  SELECT id INTO v_result_snap_id FROM public.ladder_snapshots
   WHERE idempotency_key = p_plan -> 'result_snapshot' ->> 'idempotency_key';

  -- ---- movements (per-player result + reasoning) --------------------
  FOR v_mv IN SELECT * FROM jsonb_array_elements(COALESCE(p_plan -> 'movements', '[]'::jsonb))
  LOOP
    INSERT INTO public.ladder_movements
      (batch_id, group_id, player_id, start_position, finish_position,
       direction, capped, wins, losses, points_for, points_against)
    VALUES (
      p_batch_id,
      (v_mv ->> 'group_id')::uuid,
      (v_mv ->> 'player_id')::uuid,
      (v_mv ->> 'start_position')::int,
      (v_mv ->> 'finish_position')::int,
      v_mv ->> 'direction',
      NULLIF(v_mv ->> 'capped', ''),
      COALESCE((v_mv ->> 'wins')::int, 0),
      COALESCE((v_mv ->> 'losses')::int, 0),
      COALESCE((v_mv ->> 'points_for')::int, 0),
      COALESCE((v_mv ->> 'points_against')::int, 0)
    )
    ON CONFLICT (batch_id, player_id) DO NOTHING;
  END LOOP;

  -- ---- finalize the batch -------------------------------------------
  UPDATE public.ladder_batches
     SET status = 'finalized', result_snapshot_id = v_result_snap_id,
         finalized_at = now(), updated_at = now()
   WHERE id = p_batch_id;

  -- ---- generate the next batch (same week or next week) -------------
  IF v_next IS NOT NULL AND jsonb_typeof(v_next) = 'object' THEN
    INSERT INTO public.ladder_batches
      (league_id, season_id, session_id, week_number, batch_number,
       start_snapshot_id, status, court_waves, schedule_version, idempotency_key)
    VALUES (
      v_batch.league_id, v_batch.season_id,
      NULLIF(v_next ->> 'session_id', '')::uuid,
      (v_next ->> 'week')::int,
      (v_next ->> 'batch')::int,
      v_result_snap_id,
      'generated',
      COALESCE((v_next ->> 'court_waves')::int, 1),
      v_batch.schedule_version,
      v_next ->> 'idempotency_key'
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    SELECT id INTO v_next_batch_id FROM public.ladder_batches
     WHERE idempotency_key = v_next ->> 'idempotency_key';

    -- Only seed groups/games if THIS call created the batch (no groups yet).
    IF v_next_batch_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.ladder_batch_groups WHERE batch_id = v_next_batch_id)
    THEN
      FOR v_group IN SELECT * FROM jsonb_array_elements(v_next -> 'groups')
      LOOP
        INSERT INTO public.ladder_batch_groups
          (batch_id, group_index, court_number, wave, player_ids)
        VALUES (
          v_next_batch_id,
          (v_group ->> 'group_index')::int,
          NULLIF(v_group ->> 'court_number', '')::int,
          COALESCE((v_group ->> 'wave')::int, 1),
          ARRAY(SELECT jsonb_array_elements_text(v_group -> 'player_ids')::uuid)
        )
        RETURNING id INTO v_group_id;

        FOR v_game IN SELECT * FROM jsonb_array_elements(v_group -> 'games')
        LOOP
          INSERT INTO public.league_matches
            (league_id, season_id, division_id, session_id,
             court_number, status, rating_status,
             player_a_id, player_b_id, player_c_id, player_d_id,
             ladder_batch_group_id, ladder_game_number)
          VALUES (
            v_batch.league_id, v_batch.season_id, NULL,
            NULLIF(v_next ->> 'session_id', '')::uuid,
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
    END IF;
  END IF;

  -- ---- audit --------------------------------------------------------
  INSERT INTO public.league_audit_log
    (league_id, season_id, actor_user_id, action, entity_type, entity_id, new_value)
  VALUES (
    v_batch.league_id, v_batch.season_id, v_user,
    'ladder.batch_finalized', 'ladder_batch', p_batch_id,
    jsonb_build_object(
      'week', v_batch.week_number, 'batch', v_batch.batch_number,
      'result_snapshot_id', v_result_snap_id,
      'next_batch_id', v_next_batch_id
    )
  );

  RETURN jsonb_build_object(
    'already_finalized', false,
    'batch_id', p_batch_id,
    'result_snapshot_id', v_result_snap_id,
    'next_batch_id', v_next_batch_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ladder_finalize_batch(UUID, JSONB) TO authenticated;

COMMENT ON FUNCTION public.ladder_finalize_batch IS
  'Transactional, idempotent ladder batch finalization. Locks the batch, '
  're-checks completeness + player-set integrity, writes the result '
  'snapshot + movements, finalizes the batch, and generates the next '
  'batch — all atomically. Safe against duplicate/racing calls via the '
  'row lock + snapshot/batch unique keys. The ranking/movement plan is '
  'computed server-side by the ladder-finalize-batch edge function using '
  'the tested pure engine; this function persists and guards it.';
