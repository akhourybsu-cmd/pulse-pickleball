-- =====================================================================
-- Individual Doubles Ladder — schema foundation (Phase 4a)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.ladder_settings (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id          UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  season_id          UUID NOT NULL REFERENCES public.league_seasons(id) ON DELETE CASCADE,
  batches_per_week   INTEGER NOT NULL DEFAULT 1 CHECK (batches_per_week BETWEEN 1 AND 6),
  court_count        INTEGER NOT NULL DEFAULT 1 CHECK (court_count >= 1),
  total_weeks        INTEGER CHECK (total_weeks IS NULL OR total_weeks >= 1),
  movement_rule      TEXT NOT NULL DEFAULT 'one_up_one_down'
                       CHECK (movement_rule IN ('one_up_one_down')),
  scoring_format     TEXT NOT NULL DEFAULT 'to_11_win_by_2',
  tiebreakers        JSONB NOT NULL DEFAULT
                       '["wins","point_diff","points_for","head_to_head","start_position"]'::jsonb,
  initial_order_source TEXT NOT NULL DEFAULT 'manual'
                       CHECK (initial_order_source IN ('manual','pulse_rating','random','prior_season')),
  status             TEXT NOT NULL DEFAULT 'setup'
                       CHECK (status IN ('setup','active','paused','complete')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (season_id)
);
CREATE INDEX IF NOT EXISTS idx_ladder_settings_league ON public.ladder_settings(league_id);

CREATE TABLE IF NOT EXISTS public.ladder_snapshots (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id          UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  season_id          UUID NOT NULL REFERENCES public.league_seasons(id) ON DELETE CASCADE,
  week_number        INTEGER NOT NULL,
  batch_number       INTEGER NOT NULL,
  kind               TEXT NOT NULL DEFAULT 'batch_result'
                       CHECK (kind IN ('initial','batch_result')),
  player_ids         UUID[] NOT NULL,
  source_snapshot_id UUID REFERENCES public.ladder_snapshots(id) ON DELETE SET NULL,
  reason             TEXT,
  schedule_version   INTEGER NOT NULL DEFAULT 1,
  idempotency_key    TEXT NOT NULL,
  finalized_at       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (idempotency_key),
  UNIQUE (season_id, week_number, batch_number, kind)
);
CREATE INDEX IF NOT EXISTS idx_ladder_snapshots_season ON public.ladder_snapshots(season_id, week_number, batch_number);

CREATE TABLE IF NOT EXISTS public.ladder_batches (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id          UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  season_id          UUID NOT NULL REFERENCES public.league_seasons(id) ON DELETE CASCADE,
  session_id         UUID REFERENCES public.league_sessions(id) ON DELETE SET NULL,
  week_number        INTEGER NOT NULL,
  batch_number       INTEGER NOT NULL,
  start_snapshot_id  UUID NOT NULL REFERENCES public.ladder_snapshots(id) ON DELETE RESTRICT,
  result_snapshot_id UUID REFERENCES public.ladder_snapshots(id) ON DELETE SET NULL,
  status             TEXT NOT NULL DEFAULT 'generated'
                       CHECK (status IN ('generated','in_progress','complete','finalized','invalidated')),
  court_waves        INTEGER NOT NULL DEFAULT 1 CHECK (court_waves >= 1),
  schedule_version   INTEGER NOT NULL DEFAULT 1,
  idempotency_key    TEXT NOT NULL,
  finalized_at       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (idempotency_key),
  UNIQUE (season_id, week_number, batch_number)
);
CREATE INDEX IF NOT EXISTS idx_ladder_batches_season ON public.ladder_batches(season_id, week_number, batch_number);

CREATE TABLE IF NOT EXISTS public.ladder_batch_groups (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id      UUID NOT NULL REFERENCES public.ladder_batches(id) ON DELETE CASCADE,
  group_index   INTEGER NOT NULL,
  court_number  INTEGER,
  wave          INTEGER NOT NULL DEFAULT 1,
  player_ids    UUID[] NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (batch_id, group_index)
);
CREATE INDEX IF NOT EXISTS idx_ladder_batch_groups_batch ON public.ladder_batch_groups(batch_id);

CREATE TABLE IF NOT EXISTS public.ladder_movements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id        UUID NOT NULL REFERENCES public.ladder_batches(id) ON DELETE CASCADE,
  group_id        UUID NOT NULL REFERENCES public.ladder_batch_groups(id) ON DELETE CASCADE,
  player_id       UUID NOT NULL REFERENCES public.profiles(id),
  start_position  INTEGER NOT NULL,
  finish_position INTEGER NOT NULL,
  direction       TEXT NOT NULL CHECK (direction IN ('up','stay','down')),
  capped          TEXT CHECK (capped IN ('top','bottom')),
  wins            INTEGER NOT NULL DEFAULT 0,
  losses          INTEGER NOT NULL DEFAULT 0,
  points_for      INTEGER NOT NULL DEFAULT 0,
  points_against  INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (batch_id, player_id)
);
CREATE INDEX IF NOT EXISTS idx_ladder_movements_batch ON public.ladder_movements(batch_id);

ALTER TABLE public.league_matches
  ADD COLUMN IF NOT EXISTS ladder_batch_group_id UUID
    REFERENCES public.ladder_batch_groups(id) ON DELETE CASCADE;
ALTER TABLE public.league_matches
  ADD COLUMN IF NOT EXISTS ladder_game_number INTEGER;
CREATE INDEX IF NOT EXISTS idx_league_matches_ladder_group
  ON public.league_matches(ladder_batch_group_id);

DO $migbody$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ladder_settings','ladder_snapshots','ladder_batches',
    'ladder_batch_groups','ladder_movements'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "League admins full access" ON public.%I', t);
  END LOOP;
END $migbody$;

CREATE POLICY "League admins full access" ON public.ladder_settings
  FOR ALL USING (public.is_league_admin(league_id, auth.uid()))
  WITH CHECK (public.is_league_admin(league_id, auth.uid()));
CREATE POLICY "League admins full access" ON public.ladder_snapshots
  FOR ALL USING (public.is_league_admin(league_id, auth.uid()))
  WITH CHECK (public.is_league_admin(league_id, auth.uid()));
CREATE POLICY "League admins full access" ON public.ladder_batches
  FOR ALL USING (public.is_league_admin(league_id, auth.uid()))
  WITH CHECK (public.is_league_admin(league_id, auth.uid()));

CREATE POLICY "League admins full access" ON public.ladder_batch_groups
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.ladder_batches b
     WHERE b.id = batch_id AND public.is_league_admin(b.league_id, auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.ladder_batches b
     WHERE b.id = batch_id AND public.is_league_admin(b.league_id, auth.uid())
  ));
CREATE POLICY "League admins full access" ON public.ladder_movements
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.ladder_batches b
     WHERE b.id = batch_id AND public.is_league_admin(b.league_id, auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.ladder_batches b
     WHERE b.id = batch_id AND public.is_league_admin(b.league_id, auth.uid())
  ));

DO $migbody$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['ladder_settings','ladder_batches'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON public.%I '
      'FOR EACH ROW EXECUTE FUNCTION public.update_updated_at()', t, t);
  END LOOP;
END $migbody$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ladder_settings TO authenticated;
GRANT ALL ON public.ladder_settings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ladder_snapshots TO authenticated;
GRANT ALL ON public.ladder_snapshots TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ladder_batches TO authenticated;
GRANT ALL ON public.ladder_batches TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ladder_batch_groups TO authenticated;
GRANT ALL ON public.ladder_batch_groups TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ladder_movements TO authenticated;
GRANT ALL ON public.ladder_movements TO service_role;

-- =====================================================================
-- ladder_finalize_batch
-- =====================================================================
CREATE OR REPLACE FUNCTION public.ladder_finalize_batch(
  p_batch_id UUID,
  p_plan     JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
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

  SELECT * INTO v_batch FROM public.ladder_batches
   WHERE id = p_batch_id FOR UPDATE;
  IF v_batch.id IS NULL THEN
    RAISE EXCEPTION 'Batch not found' USING ERRCODE = '02000';
  END IF;
  IF NOT public.is_league_admin(v_batch.league_id, v_user) THEN
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

  UPDATE public.ladder_batches
     SET status = 'finalized', result_snapshot_id = v_result_snap_id,
         finalized_at = now(), updated_at = now()
   WHERE id = p_batch_id;

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
$fn$;

GRANT EXECUTE ON FUNCTION public.ladder_finalize_batch(UUID, JSONB) TO authenticated;

-- =====================================================================
-- ladder_generate_first_batch
-- =====================================================================
CREATE OR REPLACE FUNCTION public.ladder_generate_first_batch(
  p_season_id UUID,
  p_plan      JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
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
$fn$;

GRANT EXECUTE ON FUNCTION public.ladder_generate_first_batch(UUID, JSONB) TO authenticated;

-- =====================================================================
-- ladder_reopen_batch
-- =====================================================================
CREATE OR REPLACE FUNCTION public.ladder_reopen_batch(
  p_batch_id UUID,
  p_force    BOOLEAN DEFAULT FALSE
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
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
$fn$;

GRANT EXECUTE ON FUNCTION public.ladder_reopen_batch(UUID, BOOLEAN) TO authenticated;

-- =====================================================================
-- create_league fix — restore cast-free body + slot quota + auto-enroll
-- =====================================================================
CREATE OR REPLACE FUNCTION public.create_league(
  p_name        TEXT,
  p_description TEXT DEFAULT NULL,
  p_location    TEXT DEFAULT NULL,
  p_league_type TEXT DEFAULT 'doubles'
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
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
    RAISE EXCEPTION 'Invalid league_type %', p_league_type
      USING ERRCODE = '22023';
  END IF;

  v_is_admin := public.has_role(v_user, 'admin'::app_role);

  IF NOT v_is_admin THEN
    SELECT COUNT(*)::INT INTO v_owned
      FROM public.leagues WHERE created_by = v_user;
    SELECT additional_league_slots INTO v_slots
      FROM public.profiles WHERE id = v_user;
    IF v_slots IS NULL THEN v_slots := 0; END IF;
    v_max := 1 + v_slots;

    IF v_owned >= v_max THEN
      RAISE EXCEPTION
        'League quota reached (owned %, max %). Buy a slot to add more.',
        v_owned, v_max
        USING ERRCODE = '53300',
              HINT   = 'league_quota_exceeded';
    END IF;
  END IF;

  INSERT INTO public.leagues
    (name, description, location, created_by, league_type,
     status, visibility)
  VALUES (
    v_trimmed,
    NULLIF(TRIM(COALESCE(p_description, '')), ''),
    NULLIF(TRIM(COALESCE(p_location, '')), ''),
    v_user,
    p_league_type,
    'draft',
    'private'
  ) RETURNING id INTO v_new_id;

  INSERT INTO public.league_members
    (league_id, season_id, division_id, user_id, role, status)
  VALUES
    (v_new_id, NULL, NULL, v_user, 'manager', 'active')
  ON CONFLICT (league_id, season_id, user_id) DO NOTHING;

  INSERT INTO public.league_audit_log
    (league_id, actor_user_id, action, entity_type, entity_id, new_value)
  VALUES (
    v_new_id, v_user, 'league.created', 'league', v_new_id,
    jsonb_build_object(
      'name', v_trimmed,
      'league_type', p_league_type,
      'via', 'self_serve',
      'owner_enrolled_as', 'manager'
    )
  );

  RETURN v_new_id;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.create_league(TEXT, TEXT, TEXT, TEXT) TO authenticated;