-- ============ Remove League Divisions ============
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
DECLARE r RECORD;
BEGIN
  -- A preceding migration may already have removed league_divisions. Only
  -- backfill and detach its foreign keys when the legacy table still exists.
  IF to_regclass('public.league_divisions') IS NOT NULL THEN
    EXECUTE $backfill$
      UPDATE public.leagues l
         SET skill_min = d.skill_min, skill_max = d.skill_max
        FROM (
          SELECT DISTINCT ON (league_id) league_id, skill_min, skill_max
            FROM public.league_divisions
           ORDER BY league_id, created_at ASC
        ) d
       WHERE d.league_id = l.id
         AND l.skill_min IS NULL AND l.skill_max IS NULL
    $backfill$;

    FOR r IN
      SELECT conrelid::regclass AS tbl, conname
        FROM pg_constraint
       WHERE confrelid = to_regclass('public.league_divisions')
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
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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

-- ============ Weekly Player Substitutions ============
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
CREATE INDEX IF NOT EXISTS idx_league_match_subs_match ON public.league_match_substitutions(match_id);
CREATE INDEX IF NOT EXISTS idx_league_match_subs_season ON public.league_match_substitutions(season_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.league_match_substitutions TO authenticated;
GRANT ALL ON public.league_match_substitutions TO service_role;

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
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user    UUID := auth.uid();
  v_is_sub  BOOLEAN;
  v_is_mem  BOOLEAN;
  v_m       RECORD;
  v_count   INT := 0;
  v_slot    TEXT;
  v_orig    UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
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
    RAISE EXCEPTION 'The fill-in must be an active substitute or member of this season'
      USING ERRCODE = '22023';
  END IF;

  FOR v_m IN
    SELECT * FROM public.league_matches
     WHERE league_id = p_league_id AND season_id = p_season_id
       AND status IN ('scheduled', 'in_progress')
       AND p_out_player_id IN (player_a_id, player_b_id, player_c_id, player_d_id)
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

  INSERT INTO public.league_audit_log
    (league_id, season_id, actor_user_id, action, entity_type, entity_id, new_value)
  VALUES (
    p_league_id, p_season_id, v_user, 'league.week_player_swapped', 'league_season', p_season_id,
    jsonb_build_object('out_player_id', p_out_player_id, 'in_player_id', p_in_player_id,
                       'was_substitute', v_is_sub, 'games', v_count,
                       'note', COALESCE(NULLIF(TRIM(COALESCE(p_note, '')), ''), '(none)'))
  );

  RETURN jsonb_build_object('matches_updated', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.swap_league_week_player(UUID, UUID, UUID, UUID, TEXT) TO authenticated;
