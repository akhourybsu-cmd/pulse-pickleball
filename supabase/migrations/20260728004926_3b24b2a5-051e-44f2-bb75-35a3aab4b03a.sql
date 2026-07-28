-- =====================================================================
-- Combined pending migrations: divisions removal, weekly substitutions,
-- ladder service-role bypass, league invite auto-gen + public teaser,
-- ladder week sit-outs, player sub requests + resolutions, and the
-- ladder → rating engine bridge.
-- =====================================================================

-- ---- Skill level moves onto the league ------------------------------
ALTER TABLE public.leagues
  ADD COLUMN IF NOT EXISTS skill_min NUMERIC
    CHECK (skill_min IS NULL OR (skill_min >= 2.0 AND skill_min <= 6.0)),
  ADD COLUMN IF NOT EXISTS skill_max NUMERIC
    CHECK (skill_max IS NULL OR (skill_max >= 2.0 AND skill_max <= 6.0));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
     WHERE table_name = 'leagues' AND constraint_name = 'leagues_skill_range_chk'
  ) THEN
    ALTER TABLE public.leagues
      ADD CONSTRAINT leagues_skill_range_chk
      CHECK (skill_max IS NULL OR skill_min IS NULL OR skill_max >= skill_min);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.league_divisions') IS NOT NULL THEN
    UPDATE public.leagues l
       SET skill_min = d.skill_min, skill_max = d.skill_max
      FROM (
        SELECT DISTINCT ON (league_id) league_id, skill_min, skill_max
          FROM public.league_divisions
         ORDER BY league_id, created_at ASC
      ) d
     WHERE d.league_id = l.id
       AND l.skill_min IS NULL AND l.skill_max IS NULL;
  END IF;
END $$;

DO $$
DECLARE r RECORD;
BEGIN
  IF to_regclass('public.league_divisions') IS NOT NULL THEN
    FOR r IN
      SELECT conrelid::regclass AS tbl, conname
        FROM pg_constraint
       WHERE confrelid = 'public.league_divisions'::regclass
    LOOP
      EXECUTE format('ALTER TABLE %s DROP CONSTRAINT IF EXISTS %I', r.tbl, r.conname);
    END LOOP;
  END IF;
END $$;

DROP TABLE IF EXISTS public.league_divisions CASCADE;
DROP FUNCTION IF EXISTS public.update_divisions_updated_at() CASCADE;

DROP FUNCTION IF EXISTS public.get_my_leagues_with_context();

CREATE FUNCTION public.get_my_leagues_with_context()
RETURNS TABLE (
  membership_id             UUID,
  membership_league_id      UUID,
  membership_season_id      UUID,
  membership_user_id        UUID,
  membership_role           TEXT,
  membership_status         TEXT,
  membership_joined_at      TIMESTAMPTZ,
  membership_created_at     TIMESTAMPTZ,
  membership_updated_at     TIMESTAMPTZ,
  league_id                 UUID,
  league_name               TEXT,
  league_description        TEXT,
  league_location           TEXT,
  league_community_id       UUID,
  league_created_by         UUID,
  league_status             TEXT,
  league_visibility         TEXT,
  league_league_type        TEXT,
  league_rating_eligible    BOOLEAN,
  league_guests_allowed     BOOLEAN,
  league_skill_min          NUMERIC,
  league_skill_max          NUMERIC,
  league_created_at         TIMESTAMPTZ,
  league_updated_at         TIMESTAMPTZ,
  season_id                 UUID,
  season_league_id          UUID,
  season_name               TEXT,
  season_start_date         DATE,
  season_end_date           DATE,
  season_registration_deadline DATE,
  season_status             TEXT,
  season_created_at         TIMESTAMPTZ,
  season_updated_at         TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    m.id, m.league_id, m.season_id, m.user_id,
    m.role::TEXT, m.status::TEXT, m.joined_at, m.created_at, m.updated_at,
    l.id, l.name, l.description, l.location, l.community_id, l.created_by,
    l.status::TEXT, l.visibility::TEXT, l.league_type::TEXT,
    l.rating_eligible, l.guests_allowed, l.skill_min, l.skill_max,
    l.created_at, l.updated_at,
    s.id, s.league_id, s.name, s.start_date, s.end_date,
    s.registration_deadline, s.status::TEXT, s.created_at, s.updated_at
  FROM public.league_members m
  JOIN public.leagues l ON l.id = m.league_id
  LEFT JOIN public.league_seasons s ON s.id = m.season_id
  WHERE m.user_id = auth.uid()
    AND m.status = 'active'
    AND l.visibility <> 'admin_only'
  ORDER BY l.name ASC, m.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_leagues_with_context() TO authenticated;

-- =====================================================================
-- Weekly, individual-player substitutions
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.league_match_substitutions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id      UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  season_id      UUID NOT NULL REFERENCES public.league_seasons(id) ON DELETE CASCADE,
  match_id       UUID NOT NULL REFERENCES public.league_matches(id) ON DELETE CASCADE,
  slot           TEXT NOT NULL CHECK (slot IN ('a','b','c','d')),
  out_player_id  UUID NOT NULL REFERENCES public.profiles(id),
  in_player_id   UUID NOT NULL REFERENCES public.profiles(id),
  note           TEXT,
  created_by     UUID REFERENCES public.profiles(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (match_id, slot)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.league_match_substitutions TO authenticated;
GRANT ALL ON public.league_match_substitutions TO service_role;
CREATE INDEX IF NOT EXISTS idx_league_match_subs_match ON public.league_match_substitutions(match_id);
CREATE INDEX IF NOT EXISTS idx_league_match_subs_season ON public.league_match_substitutions(season_id);
ALTER TABLE public.league_match_substitutions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "League admins full access" ON public.league_match_substitutions;
CREATE POLICY "League admins full access" ON public.league_match_substitutions
  FOR ALL USING (public.is_league_admin(league_id, auth.uid()))
  WITH CHECK (public.is_league_admin(league_id, auth.uid()));
DROP POLICY IF EXISTS "Members read subs of own leagues" ON public.league_match_substitutions;
CREATE POLICY "Members read subs of own leagues" ON public.league_match_substitutions
  FOR SELECT USING (public.player_can_view_league(league_id));

CREATE OR REPLACE FUNCTION public.swap_league_week_player(
  p_league_id      UUID,
  p_season_id      UUID,
  p_out_player_id  UUID,
  p_in_player_id   UUID,
  p_note           TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user    UUID := auth.uid();
  v_is_sub  BOOLEAN;
  v_is_mem  BOOLEAN;
  v_m       RECORD;
  v_count   INT := 0;
  v_slot    TEXT;
  v_orig    UUID;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000'; END IF;
  IF NOT public.is_league_admin(p_league_id, v_user) THEN
    RAISE EXCEPTION 'League admin privileges required' USING ERRCODE = '42501';
  END IF;
  IF p_out_player_id IS NULL OR p_in_player_id IS NULL THEN
    RAISE EXCEPTION 'Both players are required' USING ERRCODE = '22023';
  END IF;
  IF p_out_player_id = p_in_player_id THEN
    RAISE EXCEPTION 'Pick a different fill-in player' USING ERRCODE = '22023';
  END IF;
  SELECT EXISTS (SELECT 1 FROM public.league_substitutes s
     WHERE s.league_id = p_league_id AND s.season_id = p_season_id
       AND s.user_id = p_in_player_id AND s.status = 'active') INTO v_is_sub;
  SELECT EXISTS (SELECT 1 FROM public.league_members m
     WHERE m.league_id = p_league_id AND m.season_id = p_season_id
       AND m.user_id = p_in_player_id AND m.status = 'active') INTO v_is_mem;
  IF NOT v_is_sub AND NOT v_is_mem THEN
    RAISE EXCEPTION 'The fill-in must be an active substitute or member of this season' USING ERRCODE = '22023';
  END IF;
  FOR v_m IN
    SELECT * FROM public.league_matches
     WHERE league_id = p_league_id AND season_id = p_season_id
       AND status IN ('scheduled', 'in_progress')
       AND p_out_player_id IN (player_a_id, player_b_id, player_c_id, player_d_id)
     FOR UPDATE
  LOOP
    IF p_in_player_id IN (v_m.player_a_id, v_m.player_b_id, v_m.player_c_id, v_m.player_d_id) THEN
      RAISE EXCEPTION 'That player is already in one of these games — pick another fill-in' USING ERRCODE = '22023';
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
  INSERT INTO public.league_audit_log
    (league_id, season_id, actor_user_id, action, entity_type, entity_id, new_value)
  VALUES (p_league_id, p_season_id, v_user, 'league.week_player_swapped', 'league_season', p_season_id,
    jsonb_build_object('out_player_id', p_out_player_id, 'in_player_id', p_in_player_id,
                       'was_substitute', v_is_sub, 'games', v_count,
                       'note', COALESCE(NULLIF(TRIM(COALESCE(p_note, '')), ''), '(none)')));
  RETURN jsonb_build_object('matches_updated', v_count);
END;
$$;
GRANT EXECUTE ON FUNCTION public.swap_league_week_player(UUID, UUID, UUID, UUID, TEXT) TO authenticated;

-- =====================================================================
-- ladder_finalize_batch + service_role bypass
-- =====================================================================
CREATE OR REPLACE FUNCTION public.ladder_finalize_batch(
  p_batch_id UUID,
  p_plan     JSONB
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  SELECT * INTO v_batch FROM public.ladder_batches WHERE id = p_batch_id FOR UPDATE;
  IF v_batch.id IS NULL THEN RAISE EXCEPTION 'Batch not found' USING ERRCODE = '02000'; END IF;
  IF NOT v_is_service AND NOT public.is_league_admin(v_batch.league_id, v_user) THEN
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
    jsonb_build_object('week', v_batch.week_number, 'batch', v_batch.batch_number, 'result_snapshot_id', v_result_snap_id,
                       'via', CASE WHEN v_is_service THEN 'auto_advance' ELSE 'organizer' END));
  RETURN jsonb_build_object('success', true, 'batch_id', p_batch_id, 'result_snapshot_id', v_result_snap_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.ladder_generate_batch(
  p_season_id        UUID,
  p_start_snapshot_id UUID,
  p_plan             JSONB
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  IF v_league_id IS NULL THEN RAISE EXCEPTION 'Season not found' USING ERRCODE = '02000'; END IF;
  IF NOT v_is_service AND NOT public.is_league_admin(v_league_id, v_user) THEN
    RAISE EXCEPTION 'League admin privileges required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ladder_snapshots
                  WHERE id = p_start_snapshot_id AND season_id = p_season_id) THEN
    RAISE EXCEPTION 'Start snapshot not found for this season' USING ERRCODE = '22023';
  END IF;
  SELECT id INTO v_batch_id FROM public.ladder_batches
   WHERE season_id = p_season_id AND week_number = v_week AND batch_number = v_batch;
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

GRANT EXECUTE ON FUNCTION public.ladder_finalize_batch(UUID, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ladder_generate_batch(UUID, UUID, JSONB) TO authenticated, service_role;

-- =====================================================================
-- League invite code auto-gen + public teaser
-- =====================================================================
CREATE OR REPLACE FUNCTION public.generate_league_invite_code()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code TEXT; v_exists BOOLEAN;
BEGIN
  LOOP
    v_code := UPPER(SUBSTR(md5(random()::text), 1, 4) || '-' || SUBSTR(md5(random()::text), 1, 4));
    SELECT EXISTS (SELECT 1 FROM public.leagues WHERE LOWER(invite_code) = LOWER(v_code)) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  RETURN v_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_league_invite_code()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (NEW.invite_code IS NULL OR TRIM(NEW.invite_code) = '')
     AND COALESCE(NEW.visibility, 'private') <> 'admin_only' THEN
    NEW.invite_code := public.generate_league_invite_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_league_invite_code ON public.leagues;
CREATE TRIGGER trg_set_league_invite_code
  BEFORE INSERT ON public.leagues
  FOR EACH ROW EXECUTE FUNCTION public.set_league_invite_code();

UPDATE public.leagues
   SET invite_code = public.generate_league_invite_code()
 WHERE (invite_code IS NULL OR TRIM(invite_code) = '')
   AND COALESCE(visibility, 'private') <> 'admin_only';

CREATE OR REPLACE FUNCTION public.find_league_by_invite_code(p_code TEXT)
RETURNS TABLE (
  id UUID, name TEXT, description TEXT, location TEXT, league_type TEXT,
  visibility TEXT, guests_allowed BOOLEAN, registration_open BOOLEAN,
  registration_closes_at DATE
) LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $function$
BEGIN
  RETURN QUERY
    WITH matched AS (
      SELECT l.* FROM public.leagues l
       WHERE LOWER(l.invite_code) = LOWER(p_code)
         AND l.visibility <> 'admin_only'
       LIMIT 1
    ),
    season_state AS (
      SELECT m.id AS league_id,
        bool_or(s.registration_deadline IS NULL OR s.registration_deadline >= CURRENT_DATE)
          FILTER (WHERE s.status = 'active') AS any_open,
        bool_or(s.status = 'active') AS any_active,
        MIN(s.registration_deadline) FILTER (
          WHERE s.status = 'active' AND s.registration_deadline IS NOT NULL
            AND s.registration_deadline >= CURRENT_DATE
        ) AS next_deadline
      FROM matched m
      LEFT JOIN public.league_seasons s ON s.league_id = m.id
      GROUP BY m.id
    )
    SELECT m.id, m.name, m.description, m.location,
      m.league_type::TEXT, m.visibility::TEXT, m.guests_allowed,
      COALESCE(NOT ss.any_active OR ss.any_open, TRUE) AS registration_open,
      ss.next_deadline AS registration_closes_at
    FROM matched m
    LEFT JOIN season_state ss ON ss.league_id = m.id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.generate_league_invite_code() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.find_league_by_invite_code(TEXT) TO anon, authenticated;

-- =====================================================================
-- Ladder week sit-outs
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.ladder_week_sitouts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id    UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  season_id    UUID NOT NULL REFERENCES public.league_seasons(id) ON DELETE CASCADE,
  week_number  INTEGER NOT NULL CHECK (week_number >= 1),
  player_id    UUID NOT NULL REFERENCES public.profiles(id),
  note         TEXT,
  created_by   UUID REFERENCES public.profiles(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (season_id, week_number, player_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ladder_week_sitouts TO authenticated;
GRANT ALL ON public.ladder_week_sitouts TO service_role;
CREATE INDEX IF NOT EXISTS idx_ladder_week_sitouts_week
  ON public.ladder_week_sitouts(season_id, week_number);
ALTER TABLE public.ladder_week_sitouts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "League admins full access" ON public.ladder_week_sitouts;
CREATE POLICY "League admins full access" ON public.ladder_week_sitouts
  FOR ALL USING (public.is_league_admin(league_id, auth.uid()))
  WITH CHECK (public.is_league_admin(league_id, auth.uid()));
DROP POLICY IF EXISTS "Members read sitouts of own leagues" ON public.ladder_week_sitouts;
CREATE POLICY "Members read sitouts of own leagues" ON public.ladder_week_sitouts
  FOR SELECT USING (public.player_can_view_league(league_id));

-- =====================================================================
-- Sub requests: sessions week binding + capacity, table, RPCs.
-- =====================================================================
ALTER TABLE public.league_sessions
  ADD COLUMN IF NOT EXISTS week_number INTEGER
    CHECK (week_number IS NULL OR week_number >= 1),
  ADD COLUMN IF NOT EXISTS capacity INTEGER
    CHECK (capacity IS NULL OR capacity >= 0);

CREATE UNIQUE INDEX IF NOT EXISTS idx_league_sessions_season_week
  ON public.league_sessions(season_id, week_number)
  WHERE week_number IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.ladder_sub_requests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id      UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  season_id      UUID NOT NULL REFERENCES public.league_seasons(id) ON DELETE CASCADE,
  session_id     UUID NOT NULL REFERENCES public.league_sessions(id) ON DELETE CASCADE,
  week_number    INTEGER NOT NULL CHECK (week_number >= 1),
  player_id      UUID NOT NULL REFERENCES public.profiles(id),
  note           TEXT,
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','sub','sitout','declined','canceled')),
  assigned_sub_id UUID REFERENCES public.profiles(id),
  resolved_by    UUID REFERENCES public.profiles(id),
  resolved_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, player_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ladder_sub_requests TO authenticated;
GRANT ALL ON public.ladder_sub_requests TO service_role;
CREATE INDEX IF NOT EXISTS idx_ladder_sub_requests_season_week
  ON public.ladder_sub_requests(season_id, week_number);
CREATE INDEX IF NOT EXISTS idx_ladder_sub_requests_session
  ON public.ladder_sub_requests(session_id);
ALTER TABLE public.ladder_sub_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "League admins full access" ON public.ladder_sub_requests;
CREATE POLICY "League admins full access" ON public.ladder_sub_requests
  FOR ALL USING (public.is_league_admin(league_id, auth.uid()))
  WITH CHECK (public.is_league_admin(league_id, auth.uid()));
DROP POLICY IF EXISTS "Members read sub-requests of own leagues" ON public.ladder_sub_requests;
CREATE POLICY "Members read sub-requests of own leagues" ON public.ladder_sub_requests
  FOR SELECT USING (public.player_can_view_league(league_id));

CREATE OR REPLACE FUNCTION public.schedule_ladder_week(
  p_league_id      UUID,
  p_season_id      UUID,
  p_week_number    INTEGER,
  p_scheduled_date DATE    DEFAULT NULL,
  p_start_time     TIME    DEFAULT NULL,
  p_end_time       TIME    DEFAULT NULL,
  p_location       TEXT    DEFAULT NULL,
  p_court_count    INTEGER DEFAULT NULL,
  p_capacity       INTEGER DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user UUID := auth.uid(); v_session_id UUID;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000'; END IF;
  IF NOT public.is_league_admin(p_league_id, v_user) THEN
    RAISE EXCEPTION 'League admin privileges required' USING ERRCODE = '42501';
  END IF;
  IF p_week_number IS NULL OR p_week_number < 1 THEN
    RAISE EXCEPTION 'A valid week number is required' USING ERRCODE = '22023';
  END IF;
  SELECT id INTO v_session_id FROM public.league_sessions
   WHERE season_id = p_season_id AND week_number = p_week_number;
  IF v_session_id IS NULL THEN
    INSERT INTO public.league_sessions
      (league_id, season_id, week_number, name, scheduled_date, start_time,
       end_time, location, court_count, capacity, status)
    VALUES (p_league_id, p_season_id, p_week_number, 'Week ' || p_week_number,
            p_scheduled_date, p_start_time, p_end_time,
            NULLIF(TRIM(COALESCE(p_location, '')), ''),
            p_court_count, p_capacity, 'published')
    RETURNING id INTO v_session_id;
  ELSE
    UPDATE public.league_sessions
       SET scheduled_date = p_scheduled_date,
           start_time     = p_start_time,
           end_time       = p_end_time,
           location       = NULLIF(TRIM(COALESCE(p_location, '')), ''),
           court_count    = p_court_count,
           capacity       = p_capacity,
           status         = CASE WHEN status = 'draft' THEN 'published' ELSE status END,
           updated_at     = now()
     WHERE id = v_session_id;
  END IF;
  INSERT INTO public.league_audit_log
    (league_id, season_id, actor_user_id, action, entity_type, entity_id, new_value)
  VALUES (p_league_id, p_season_id, v_user, 'ladder.week_scheduled',
          'league_session', v_session_id,
          jsonb_build_object('week', p_week_number, 'date', p_scheduled_date));
  RETURN jsonb_build_object('session_id', v_session_id, 'week_number', p_week_number);
END;
$$;
GRANT EXECUTE ON FUNCTION public.schedule_ladder_week(UUID, UUID, INTEGER, DATE, TIME, TIME, TEXT, INTEGER, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_ladder_sub_request(p_request_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user UUID := auth.uid(); v_req RECORD;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000'; END IF;
  SELECT * INTO v_req FROM public.ladder_sub_requests WHERE id = p_request_id;
  IF v_req.id IS NULL THEN RAISE EXCEPTION 'Request not found' USING ERRCODE = '02000'; END IF;
  IF v_req.player_id <> v_user AND NOT public.is_league_admin(v_req.league_id, v_user) THEN
    RAISE EXCEPTION 'You can only cancel your own request' USING ERRCODE = '42501';
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

-- Request a sub (final version with all guards).
CREATE OR REPLACE FUNCTION public.request_ladder_sub(
  p_season_id  UUID,
  p_session_id UUID,
  p_note       TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user      UUID := auth.uid();
  v_league_id UUID;
  v_week      INTEGER;
  v_date      DATE;
  v_owner     UUID;
  v_req_id    UUID;
  v_name      TEXT;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000'; END IF;
  SELECT s.league_id, s.week_number, s.scheduled_date
    INTO v_league_id, v_week, v_date
    FROM public.league_sessions s
   WHERE s.id = p_session_id AND s.season_id = p_season_id;
  IF v_league_id IS NULL THEN
    RAISE EXCEPTION 'That week could not be found' USING ERRCODE = '02000';
  END IF;
  IF v_week IS NULL THEN
    RAISE EXCEPTION 'That session is not a scheduled ladder week' USING ERRCODE = '22023';
  END IF;
  IF v_week < 2 THEN
    RAISE EXCEPTION 'Week 1 is set by the initial ladder — you can''t request a sub for it' USING ERRCODE = '22023';
  END IF;
  IF v_date IS NOT NULL AND v_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'That week has already passed' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.league_members
     WHERE league_id = v_league_id AND season_id = p_season_id
       AND user_id = v_user AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Only active members can request a sub' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.ladder_batches
     WHERE season_id = p_season_id AND week_number = v_week
  ) THEN
    RAISE EXCEPTION 'That week has already started — contact the organizer' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.ladder_sub_requests
    (league_id, season_id, session_id, week_number, player_id, note, status)
  VALUES (v_league_id, p_season_id, p_session_id, v_week, v_user,
          NULLIF(TRIM(COALESCE(p_note, '')), ''), 'pending')
  ON CONFLICT (session_id, player_id) DO UPDATE
    SET status = 'pending', note = EXCLUDED.note, assigned_sub_id = NULL,
        resolved_by = NULL, resolved_at = NULL, updated_at = now()
  RETURNING id INTO v_req_id;
  SELECT created_by INTO v_owner FROM public.leagues WHERE id = v_league_id;
  SELECT COALESCE(display_name, full_name, 'A player')
    INTO v_name FROM public.profiles WHERE id = v_user;
  IF v_owner IS NOT NULL AND v_owner <> v_user THEN
    PERFORM public.create_notification(
      v_owner, 'league_sub_request', 'leagues',
      'Sub requested',
      COALESCE(v_name, 'A player') || ' can''t make Week ' || v_week || ' and needs a sub.',
      '/player/leagues/' || v_league_id || '/manage',
      'normal',
      jsonb_build_object('season_id', p_season_id, 'week', v_week,
                         'session_id', p_session_id, 'request_id', v_req_id),
      v_user
    );
  END IF;
  INSERT INTO public.league_audit_log
    (league_id, season_id, actor_user_id, action, entity_type, entity_id, new_value)
  VALUES (v_league_id, p_season_id, v_user, 'ladder.sub_requested',
          'ladder_sub_request', v_req_id,
          jsonb_build_object('week', v_week, 'session_id', p_session_id));
  RETURN jsonb_build_object('request_id', v_req_id, 'week_number', v_week, 'status', 'pending');
END;
$$;
GRANT EXECUTE ON FUNCTION public.request_ladder_sub(UUID, UUID, TEXT) TO authenticated;

-- Resolve a sub request (final version: fill-in uniqueness + requester notify).
CREATE OR REPLACE FUNCTION public.resolve_ladder_sub_request(
  p_request_id     UUID,
  p_resolution     TEXT,
  p_assigned_sub_id UUID DEFAULT NULL,
  p_note           TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user  UUID := auth.uid();
  v_req   RECORD;
  v_ok    BOOLEAN;
  v_order UUID[];
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000'; END IF;
  IF p_resolution NOT IN ('sub','sitout','declined') THEN
    RAISE EXCEPTION 'Invalid resolution %', p_resolution USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_req FROM public.ladder_sub_requests WHERE id = p_request_id;
  IF v_req.id IS NULL THEN RAISE EXCEPTION 'Request not found' USING ERRCODE = '02000'; END IF;
  IF NOT public.is_league_admin(v_req.league_id, v_user) THEN
    RAISE EXCEPTION 'League admin privileges required' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.ladder_batches
     WHERE season_id = v_req.season_id AND week_number = v_req.week_number
  ) THEN
    RAISE EXCEPTION 'Week % is already generated — use the per-week swap instead',
      v_req.week_number USING ERRCODE = '22023';
  END IF;
  DELETE FROM public.ladder_week_sitouts
   WHERE season_id = v_req.season_id AND week_number = v_req.week_number
     AND player_id = v_req.player_id;
  IF p_resolution = 'sub' THEN
    IF p_assigned_sub_id IS NULL THEN
      RAISE EXCEPTION 'Pick a fill-in to assign' USING ERRCODE = '22023';
    END IF;
    IF p_assigned_sub_id = v_req.player_id THEN
      RAISE EXCEPTION 'The fill-in must be someone else' USING ERRCODE = '22023';
    END IF;
    SELECT (
      EXISTS (SELECT 1 FROM public.league_substitutes s
               WHERE s.league_id = v_req.league_id AND s.season_id = v_req.season_id
                 AND s.user_id = p_assigned_sub_id AND s.status = 'active')
      OR EXISTS (SELECT 1 FROM public.league_members m
               WHERE m.league_id = v_req.league_id AND m.season_id = v_req.season_id
                 AND m.user_id = p_assigned_sub_id AND m.status = 'active')
    ) INTO v_ok;
    IF NOT v_ok THEN
      RAISE EXCEPTION 'The fill-in must be an active substitute or member of this season'
        USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.ladder_sub_requests
       WHERE session_id = v_req.session_id AND id <> p_request_id
         AND status = 'sub' AND assigned_sub_id = p_assigned_sub_id
    ) THEN
      RAISE EXCEPTION 'That fill-in is already covering another player this week'
        USING ERRCODE = '22023';
    END IF;
    SELECT player_ids INTO v_order FROM public.ladder_snapshots
     WHERE season_id = v_req.season_id
     ORDER BY week_number DESC, batch_number DESC LIMIT 1;
    IF v_order IS NOT NULL AND p_assigned_sub_id = ANY (v_order) THEN
      RAISE EXCEPTION 'That player is already on the ladder this week — pick a fill-in who isn''t playing'
        USING ERRCODE = '22023';
    END IF;
    UPDATE public.ladder_sub_requests
       SET status = 'sub', assigned_sub_id = p_assigned_sub_id,
           note = COALESCE(NULLIF(TRIM(COALESCE(p_note, '')), ''), note),
           resolved_by = v_user, resolved_at = now(), updated_at = now()
     WHERE id = p_request_id;
  ELSIF p_resolution = 'sitout' THEN
    IF v_req.week_number < 2 THEN
      RAISE EXCEPTION 'Sit-outs apply from week 2 onward' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.ladder_week_sitouts
      (league_id, season_id, week_number, player_id, note, created_by)
    VALUES (v_req.league_id, v_req.season_id, v_req.week_number, v_req.player_id,
            NULLIF(TRIM(COALESCE(p_note, '')), ''), v_user)
    ON CONFLICT (season_id, week_number, player_id) DO UPDATE SET note = EXCLUDED.note;
    UPDATE public.ladder_sub_requests
       SET status = 'sitout', assigned_sub_id = NULL,
           resolved_by = v_user, resolved_at = now(), updated_at = now()
     WHERE id = p_request_id;
  ELSE
    UPDATE public.ladder_sub_requests
       SET status = 'declined', assigned_sub_id = NULL,
           note = COALESCE(NULLIF(TRIM(COALESCE(p_note, '')), ''), note),
           resolved_by = v_user, resolved_at = now(), updated_at = now()
     WHERE id = p_request_id;
  END IF;
  IF v_req.player_id <> v_user THEN
    PERFORM public.create_notification(
      v_req.player_id, 'league_sub_resolved', 'leagues',
      CASE p_resolution WHEN 'sub' THEN 'Sub arranged'
                        WHEN 'sitout' THEN 'You''re sitting out'
                        ELSE 'Sub request declined' END,
      CASE p_resolution
        WHEN 'sub' THEN 'A sub will cover Week ' || v_req.week_number || ' — you keep your ladder spot.'
        WHEN 'sitout' THEN 'You''re set to sit out Week ' || v_req.week_number
                           || ' — you keep your position and return next week.'
        ELSE 'Your sub request for Week ' || v_req.week_number
             || ' couldn''t be arranged — please plan to play.' END,
      '/player/leagues/' || v_req.league_id,
      'normal',
      jsonb_build_object('week', v_req.week_number, 'resolution', p_resolution),
      v_user
    );
  END IF;
  INSERT INTO public.league_audit_log
    (league_id, season_id, actor_user_id, action, entity_type, entity_id, new_value)
  VALUES (v_req.league_id, v_req.season_id, v_user, 'ladder.sub_request_resolved',
          'ladder_sub_request', p_request_id,
          jsonb_build_object('week', v_req.week_number, 'resolution', p_resolution,
                             'player_id', v_req.player_id, 'assigned_sub_id', p_assigned_sub_id));
  RETURN jsonb_build_object('request_id', p_request_id, 'resolution', p_resolution);
END;
$$;
GRANT EXECUTE ON FUNCTION public.resolve_ladder_sub_request(UUID, TEXT, UUID, TEXT) TO authenticated;

-- set_ladder_week_sitout (final: reopens a sitout-resolved request on un-sit)
CREATE OR REPLACE FUNCTION public.set_ladder_week_sitout(
  p_season_id   UUID,
  p_week_number INTEGER,
  p_player_id   UUID,
  p_sitting     BOOLEAN,
  p_note        TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user      UUID := auth.uid();
  v_league_id UUID;
  v_is_mem    BOOLEAN;
  v_count     INTEGER;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000'; END IF;
  IF p_week_number IS NULL OR p_week_number < 2 THEN
    RAISE EXCEPTION 'Sit-outs apply from week 2 onward' USING ERRCODE = '22023';
  END IF;
  SELECT league_id INTO v_league_id FROM public.league_seasons WHERE id = p_season_id;
  IF v_league_id IS NULL THEN RAISE EXCEPTION 'Season not found' USING ERRCODE = '02000'; END IF;
  IF NOT public.is_league_admin(v_league_id, v_user) THEN
    RAISE EXCEPTION 'League admin privileges required' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.ladder_batches
     WHERE season_id = p_season_id AND week_number = p_week_number
  ) THEN
    RAISE EXCEPTION 'Week % is already generated — its roster is locked', p_week_number
      USING ERRCODE = '22023';
  END IF;
  IF p_sitting THEN
    SELECT EXISTS (
      SELECT 1 FROM public.league_members
       WHERE league_id = v_league_id AND season_id = p_season_id
         AND user_id = p_player_id AND status = 'active'
    ) INTO v_is_mem;
    IF NOT v_is_mem THEN
      RAISE EXCEPTION 'Only an active member of this season can be sat out' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.ladder_week_sitouts
      (league_id, season_id, week_number, player_id, note, created_by)
    VALUES (v_league_id, p_season_id, p_week_number, p_player_id,
            NULLIF(TRIM(COALESCE(p_note, '')), ''), v_user)
    ON CONFLICT (season_id, week_number, player_id) DO UPDATE
      SET note = EXCLUDED.note;
  ELSE
    DELETE FROM public.ladder_week_sitouts
     WHERE season_id = p_season_id AND week_number = p_week_number
       AND player_id = p_player_id;
    UPDATE public.ladder_sub_requests
       SET status = 'pending', assigned_sub_id = NULL,
           resolved_by = NULL, resolved_at = NULL, updated_at = now()
     WHERE season_id = p_season_id AND week_number = p_week_number
       AND player_id = p_player_id AND status = 'sitout';
  END IF;
  SELECT count(*) INTO v_count FROM public.ladder_week_sitouts
   WHERE season_id = p_season_id AND week_number = p_week_number;
  INSERT INTO public.league_audit_log
    (league_id, season_id, actor_user_id, action, entity_type, entity_id, new_value)
  VALUES (v_league_id, p_season_id, v_user,
    CASE WHEN p_sitting THEN 'ladder.player_sat_out' ELSE 'ladder.player_unsat' END,
    'league_season', p_season_id,
    jsonb_build_object('week', p_week_number, 'player_id', p_player_id,
                       'sitting', p_sitting, 'sitout_count', v_count));
  RETURN jsonb_build_object('week_number', p_week_number, 'sitout_count', v_count, 'sitting', p_sitting);
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_ladder_week_sitout(UUID, INTEGER, UUID, BOOLEAN, TEXT) TO authenticated;

-- unschedule_ladder_week
CREATE OR REPLACE FUNCTION public.unschedule_ladder_week(
  p_season_id   UUID,
  p_week_number INTEGER
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user      UUID := auth.uid();
  v_league_id UUID;
  v_session   UUID;
  v_canceled  INTEGER := 0;
  v_rec       RECORD;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000'; END IF;
  SELECT league_id INTO v_league_id FROM public.league_seasons WHERE id = p_season_id;
  IF v_league_id IS NULL THEN RAISE EXCEPTION 'Season not found' USING ERRCODE = '02000'; END IF;
  IF NOT public.is_league_admin(v_league_id, v_user) THEN
    RAISE EXCEPTION 'League admin privileges required' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.ladder_batches
     WHERE season_id = p_season_id AND week_number = p_week_number
  ) THEN
    RAISE EXCEPTION 'Week % is already generated and can''t be unscheduled', p_week_number
      USING ERRCODE = '22023';
  END IF;
  SELECT id INTO v_session FROM public.league_sessions
   WHERE season_id = p_season_id AND week_number = p_week_number;
  IF v_session IS NULL THEN
    RETURN jsonb_build_object('removed', false);
  END IF;
  FOR v_rec IN
    SELECT DISTINCT player_id FROM public.ladder_sub_requests
     WHERE session_id = v_session AND status <> 'canceled'
  LOOP
    IF v_rec.player_id <> v_user THEN
      PERFORM public.create_notification(
        v_rec.player_id, 'league_week_removed', 'leagues',
        'Week removed',
        'Week ' || p_week_number || ' was removed from the schedule; your sub request was canceled.',
        '/player/leagues/' || v_league_id,
        'normal',
        jsonb_build_object('week', p_week_number),
        v_user
      );
    END IF;
  END LOOP;
  SELECT count(*)::int INTO v_canceled FROM public.ladder_sub_requests
   WHERE session_id = v_session AND status <> 'canceled';
  DELETE FROM public.ladder_week_sitouts
   WHERE season_id = p_season_id AND week_number = p_week_number;
  DELETE FROM public.league_sessions WHERE id = v_session;
  INSERT INTO public.league_audit_log
    (league_id, season_id, actor_user_id, action, entity_type, entity_id, new_value)
  VALUES (v_league_id, p_season_id, v_user, 'ladder.week_unscheduled',
          'league_session', v_session,
          jsonb_build_object('week', p_week_number, 'canceled_requests', v_canceled));
  RETURN jsonb_build_object('removed', true, 'canceled_requests', v_canceled);
END;
$$;
GRANT EXECUTE ON FUNCTION public.unschedule_ladder_week(UUID, INTEGER) TO authenticated;

-- =====================================================================
-- Ladder → PULSE rating bridge
-- =====================================================================
CREATE OR REPLACE FUNCTION public.bridge_ladder_match_rating()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rated      BOOLEAN;
  v_eligible   BOOLEAN;
  v_created_by UUID;
  v_date       DATE;
  v_ids        UUID[];
  v_match_id   UUID;
BEGIN
  IF NEW.ladder_batch_group_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE'
     AND NEW.team_a_score IS NOT DISTINCT FROM OLD.team_a_score
     AND NEW.team_b_score IS NOT DISTINCT FROM OLD.team_b_score
     AND NEW.status       IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  v_rated := (NEW.status = 'verified'
    AND NEW.team_a_score IS NOT NULL AND NEW.team_b_score IS NOT NULL
    AND NEW.team_a_score <> NEW.team_b_score
    AND NEW.player_a_id IS NOT NULL AND NEW.player_b_id IS NOT NULL
    AND NEW.player_c_id IS NOT NULL AND NEW.player_d_id IS NOT NULL);
  SELECT COALESCE(rating_eligible, false) INTO v_eligible
    FROM public.leagues WHERE id = NEW.league_id;
  IF NOT v_rated AND NEW.linked_match_id IS NULL THEN RETURN NEW; END IF;
  IF v_rated AND NOT v_eligible AND NEW.linked_match_id IS NULL THEN RETURN NEW; END IF;
  v_ids := ARRAY[NEW.player_a_id, NEW.player_b_id, NEW.player_c_id, NEW.player_d_id];
  v_created_by := COALESCE(NEW.score_submitted_by, NEW.player_a_id);
  SELECT scheduled_date INTO v_date FROM public.league_sessions WHERE id = NEW.session_id;
  v_date := COALESCE(v_date, CURRENT_DATE);
  IF NEW.linked_match_id IS NULL THEN
    INSERT INTO public.matches
      (match_date, team1_score, team2_score, created_by, source,
       court_no, match_type, status, verified_by, count_for_rating)
    VALUES
      (v_date, NEW.team_a_score, NEW.team_b_score, v_created_by, 'ladder',
       NEW.court_number, 'ladder', 'pending', v_ids, v_eligible)
    RETURNING id INTO v_match_id;
    INSERT INTO public.match_participants (match_id, player_id, team) VALUES
      (v_match_id, NEW.player_a_id, 1),
      (v_match_id, NEW.player_b_id, 1),
      (v_match_id, NEW.player_c_id, 2),
      (v_match_id, NEW.player_d_id, 2);
    UPDATE public.matches SET status = 'approved' WHERE id = v_match_id;
    UPDATE public.league_matches SET linked_match_id = v_match_id WHERE id = NEW.id;
  ELSIF v_rated THEN
    DELETE FROM public.match_participants WHERE match_id = NEW.linked_match_id;
    INSERT INTO public.match_participants (match_id, player_id, team) VALUES
      (NEW.linked_match_id, NEW.player_a_id, 1),
      (NEW.linked_match_id, NEW.player_b_id, 1),
      (NEW.linked_match_id, NEW.player_c_id, 2),
      (NEW.linked_match_id, NEW.player_d_id, 2);
    UPDATE public.matches
       SET team1_score      = NEW.team_a_score,
           team2_score      = NEW.team_b_score,
           verified_by      = v_ids,
           count_for_rating = v_eligible,
           voided           = false,
           void_reason      = NULL,
           status           = 'approved'
     WHERE id = NEW.linked_match_id;
  ELSE
    UPDATE public.matches
       SET voided = true, void_reason = 'ladder game reopened'
     WHERE id = NEW.linked_match_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bridge_ladder_match_rating ON public.league_matches;
CREATE TRIGGER trg_bridge_ladder_match_rating
  AFTER INSERT OR UPDATE ON public.league_matches
  FOR EACH ROW EXECUTE FUNCTION public.bridge_ladder_match_rating();