-- =====================================================================
-- PULSE rating algorithm — correctness fixes
-- =====================================================================

CREATE OR REPLACE FUNCTION public.calculate_pulse_rating_change(
  p_player_rating numeric,
  p_partner_rating numeric,
  p_opponent1_rating numeric,
  p_opponent2_rating numeric,
  p_team_score integer,
  p_opponent_score integer,
  p_won boolean,
  p_match_type text DEFAULT 'league'::text,
  p_player_matches integer DEFAULT 0
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_params           RECORD;
  v_opp_avg          NUMERIC;
  v_expected         NUMERIC;
  v_k_base           NUMERIC;
  v_k_format         NUMERIC := 1.0;
  v_k_factor         NUMERIC;
  v_mov              NUMERIC;
  v_mov_multiplier   NUMERIC;
  v_actual           NUMERIC;
  v_rating_change    NUMERIC;
  v_provisional_mult NUMERIC := 1.0;
BEGIN
  SELECT * INTO v_params
    FROM public.rating_parameters
   WHERE id = '00000000-0000-0000-0000-000000000001';

  v_opp_avg  := (p_opponent1_rating + p_opponent2_rating) / 2.0;
  v_expected := 1.0 / (1.0 + POWER(10, (v_opp_avg - p_player_rating) / v_params.tau));

  v_k_base := CASE p_match_type
    WHEN 'ladder'   THEN v_params.k_ladder
    WHEN 'league'   THEN v_params.k_league
    WHEN 'playoffs' THEN v_params.k_playoffs
    WHEN 'casual'   THEN v_params.k_ladder * 0.5
    ELSE                 v_params.k_league
  END;
  v_k_factor := v_k_base * v_k_format;

  IF p_player_matches < v_params.provisional_matches THEN
    v_provisional_mult := 1.0 + v_params.provisional_bonus;
  END IF;
  v_k_factor := v_k_factor * v_provisional_mult;

  v_mov            := ABS(p_team_score - p_opponent_score)::NUMERIC / v_params.points_per_game;
  v_mov            := LEAST(v_mov, v_params.mov_cap);
  v_mov_multiplier := 1.0 + v_mov;

  v_actual        := CASE WHEN p_won THEN 1.0 ELSE 0.0 END;
  v_rating_change := v_k_factor * v_mov_multiplier * (v_actual - v_expected);

  RETURN ROUND(v_rating_change, 4);
END;
$function$;


-- =====================================================================
-- New-player self-assessment column (added before recalc redefinition
-- so the recalc body can reference it).
-- =====================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS initial_self_rating NUMERIC
    CHECK (initial_self_rating IS NULL
        OR (initial_self_rating >= 2.0 AND initial_self_rating <= 5.5));

COMMENT ON COLUMN public.profiles.initial_self_rating IS
  'One-shot self-assessment set during onboarding. Used as the starting '
  'rating in recalculate_all_ratings. Never re-editable by the player.';


CREATE OR REPLACE FUNCTION public.recalculate_all_ratings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  match_record  RECORD;
  player_record RECORD;
  v_params      RECORD;
  p_ids         UUID[];
  p_teams       INT[];
  p_ratings     NUMERIC[] := ARRAY[NULL, NULL, NULL, NULL]::NUMERIC[];
  p_matches     INT[]     := ARRAY[0, 0, 0, 0];
  i             INT;
  j             INT;
  v_my_team     INT;
  v_won         BOOLEAN;
  v_my_score    INT;
  v_opp_score   INT;
  v_my_partner  NUMERIC;
  v_my_opps     NUMERIC[];
  v_delta       NUMERIC;
  v_new_rating  NUMERIC;
  v_snap_rating NUMERIC;
  v_snap_count  INT;
  current_week  DATE;
BEGIN
  SELECT * INTO v_params
    FROM rating_parameters
   WHERE id = '00000000-0000-0000-0000-000000000001';

  current_week := get_week_start(CURRENT_DATE);

  UPDATE profiles
     SET current_rating    = COALESCE(initial_self_rating, 3.00),
         week_start_rating = COALESCE(initial_self_rating, 3.00),
         week_start_date   = current_week
   WHERE id IS NOT NULL;

  FOR match_record IN
    SELECT m.id AS match_id, m.match_date, m.team1_score, m.team2_score,
           m.match_type, m.week_start, m.created_at,
           array_agg(mp.player_id ORDER BY mp.team, mp.id) AS player_ids,
           array_agg(mp.team      ORDER BY mp.team, mp.id) AS teams
      FROM matches m
      JOIN match_participants mp ON mp.match_id = m.id
     WHERE m.status = 'approved'
       AND COALESCE(m.voided, false) = false
       AND COALESCE(m.count_for_rating, true) = true
     GROUP BY m.id
     HAVING COUNT(*) = 4
        AND bool_and(mp.player_id IS NOT NULL)
     ORDER BY m.match_date, m.created_at, m.id
  LOOP
    p_ids   := match_record.player_ids;
    p_teams := match_record.teams;

    FOR i IN 1..4 LOOP
      SELECT COALESCE(
        (SELECT mp_sub.rating_after
           FROM match_participants mp_sub
           JOIN matches m_sub ON mp_sub.match_id = m_sub.id
          WHERE mp_sub.player_id = p_ids[i]
            AND m_sub.status = 'approved'
            AND COALESCE(m_sub.voided, false) = false
            AND COALESCE(m_sub.count_for_rating, true) = true
            AND (m_sub.match_date <  match_record.match_date
              OR (m_sub.match_date = match_record.match_date AND m_sub.created_at <  match_record.created_at)
              OR (m_sub.match_date = match_record.match_date AND m_sub.created_at = match_record.created_at AND m_sub.id < match_record.match_id))
          ORDER BY m_sub.match_date DESC, m_sub.created_at DESC, m_sub.id DESC
          LIMIT 1),
        (SELECT COALESCE(initial_self_rating, 3.00)
           FROM profiles
          WHERE id = p_ids[i]))
      INTO v_snap_rating;
      p_ratings[i] := v_snap_rating;

      SELECT COUNT(*)::INT
        FROM match_participants mp_sub
        JOIN matches m_sub ON mp_sub.match_id = m_sub.id
       WHERE mp_sub.player_id = p_ids[i]
         AND m_sub.status = 'approved'
         AND COALESCE(m_sub.voided, false) = false
         AND COALESCE(m_sub.count_for_rating, true) = true
         AND (m_sub.match_date <  match_record.match_date
           OR (m_sub.match_date = match_record.match_date AND m_sub.created_at <  match_record.created_at)
           OR (m_sub.match_date = match_record.match_date AND m_sub.created_at = match_record.created_at AND m_sub.id < match_record.match_id))
      INTO v_snap_count;
      p_matches[i] := v_snap_count;
    END LOOP;

    FOR i IN 1..4 LOOP
      v_my_team := p_teams[i];
      v_won := (v_my_team = 1 AND match_record.team1_score > match_record.team2_score)
            OR (v_my_team = 2 AND match_record.team2_score > match_record.team1_score);
      v_my_score  := CASE v_my_team WHEN 1 THEN match_record.team1_score ELSE match_record.team2_score END;
      v_opp_score := CASE v_my_team WHEN 1 THEN match_record.team2_score ELSE match_record.team1_score END;

      v_my_partner := NULL;
      v_my_opps    := ARRAY[]::NUMERIC[];
      FOR j IN 1..4 LOOP
        IF j = i THEN CONTINUE; END IF;
        IF p_teams[j] = v_my_team THEN
          v_my_partner := p_ratings[j];
        ELSE
          v_my_opps := array_append(v_my_opps, p_ratings[j]);
        END IF;
      END LOOP;

      v_delta := calculate_pulse_rating_change(
        p_ratings[i],
        COALESCE(v_my_partner, p_ratings[i]),
        v_my_opps[1],
        v_my_opps[2],
        v_my_score, v_opp_score, v_won,
        match_record.match_type,
        p_matches[i]
      );

      v_new_rating := LEAST(v_params.clamp_max,
                        GREATEST(v_params.clamp_min, p_ratings[i] + v_delta));
      v_delta := v_new_rating - p_ratings[i];

      UPDATE match_participants
         SET rating_before = p_ratings[i],
             rating_after  = v_new_rating,
             rating_change = v_delta
       WHERE match_id = match_record.match_id
         AND player_id = p_ids[i];

      UPDATE profiles
         SET current_rating = v_new_rating
       WHERE id = p_ids[i];
    END LOOP;
  END LOOP;

  FOR player_record IN SELECT id FROM profiles LOOP
    UPDATE profiles p
       SET week_start_rating = COALESCE(
             (SELECT mp_sub.rating_after
                FROM match_participants mp_sub
                JOIN matches m_sub ON mp_sub.match_id = m_sub.id
               WHERE mp_sub.player_id = player_record.id
                 AND m_sub.status = 'approved'
                 AND COALESCE(m_sub.voided, false) = false
                 AND COALESCE(m_sub.count_for_rating, true) = true
                 AND m_sub.week_start < current_week
               ORDER BY m_sub.match_date DESC, m_sub.created_at DESC, m_sub.id DESC
               LIMIT 1),
             COALESCE(p.initial_self_rating, 3.00)),
           week_start_date = current_week
     WHERE p.id = player_record.id;
  END LOOP;

  PERFORM recalculate_all_player_stats();
END;
$function$;


-- =====================================================================
-- Incremental rating updates on match approval — perf fix
-- =====================================================================

CREATE OR REPLACE FUNCTION public.apply_match_rating_incremental(p_match_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_match       RECORD;
  v_params      RECORD;
  v_participant_count INT;
  v_has_null_player   BOOLEAN;
  v_has_later_match   BOOLEAN;
  p_ids         UUID[];
  p_teams       INT[];
  p_ratings     NUMERIC[] := ARRAY[NULL, NULL, NULL, NULL]::NUMERIC[];
  p_matches     INT[]     := ARRAY[0, 0, 0, 0];
  i             INT;
  j             INT;
  v_my_team     INT;
  v_won         BOOLEAN;
  v_my_score    INT;
  v_opp_score   INT;
  v_my_partner  NUMERIC;
  v_my_opps     NUMERIC[];
  v_delta       NUMERIC;
  v_new_rating  NUMERIC;
  v_snap_rating NUMERIC;
  v_snap_count  INT;
BEGIN
  SELECT * INTO v_match FROM matches WHERE id = p_match_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF v_match.status <> 'approved'
     OR COALESCE(v_match.voided, false) = true
     OR COALESCE(v_match.count_for_rating, true) = false THEN
    RETURN;
  END IF;

  SELECT COUNT(*), bool_or(player_id IS NULL)
    INTO v_participant_count, v_has_null_player
    FROM match_participants
   WHERE match_id = p_match_id;
  IF v_participant_count <> 4 OR v_has_null_player THEN RETURN; END IF;

  SELECT array_agg(player_id ORDER BY team, id),
         array_agg(team      ORDER BY team, id)
    INTO p_ids, p_teams
    FROM match_participants
   WHERE match_id = p_match_id;

  SELECT EXISTS (
    SELECT 1
      FROM match_participants mp2
      JOIN matches m2 ON mp2.match_id = m2.id
     WHERE mp2.player_id = ANY(p_ids)
       AND m2.id <> p_match_id
       AND m2.status = 'approved'
       AND COALESCE(m2.voided, false) = false
       AND COALESCE(m2.count_for_rating, true) = true
       AND (m2.match_date >  v_match.match_date
         OR (m2.match_date = v_match.match_date AND m2.created_at >  v_match.created_at)
         OR (m2.match_date = v_match.match_date AND m2.created_at = v_match.created_at AND m2.id > p_match_id))
  ) INTO v_has_later_match;

  IF v_has_later_match THEN
    PERFORM recalculate_all_ratings();
    RETURN;
  END IF;

  SELECT * INTO v_params
    FROM rating_parameters
   WHERE id = '00000000-0000-0000-0000-000000000001';

  FOR i IN 1..4 LOOP
    SELECT current_rating INTO v_snap_rating
      FROM profiles WHERE id = p_ids[i];
    p_ratings[i] := v_snap_rating;

    SELECT COUNT(*)::INT
      INTO v_snap_count
      FROM match_participants mp_sub
      JOIN matches m_sub ON mp_sub.match_id = m_sub.id
     WHERE mp_sub.player_id = p_ids[i]
       AND m_sub.id <> p_match_id
       AND m_sub.status = 'approved'
       AND COALESCE(m_sub.voided, false) = false
       AND COALESCE(m_sub.count_for_rating, true) = true;
    p_matches[i] := v_snap_count;
  END LOOP;

  FOR i IN 1..4 LOOP
    v_my_team := p_teams[i];
    v_won := (v_my_team = 1 AND v_match.team1_score > v_match.team2_score)
          OR (v_my_team = 2 AND v_match.team2_score > v_match.team1_score);
    v_my_score  := CASE v_my_team WHEN 1 THEN v_match.team1_score ELSE v_match.team2_score END;
    v_opp_score := CASE v_my_team WHEN 1 THEN v_match.team2_score ELSE v_match.team1_score END;

    v_my_partner := NULL;
    v_my_opps    := ARRAY[]::NUMERIC[];
    FOR j IN 1..4 LOOP
      IF j = i THEN CONTINUE; END IF;
      IF p_teams[j] = v_my_team THEN
        v_my_partner := p_ratings[j];
      ELSE
        v_my_opps := array_append(v_my_opps, p_ratings[j]);
      END IF;
    END LOOP;

    v_delta := calculate_pulse_rating_change(
      p_ratings[i],
      COALESCE(v_my_partner, p_ratings[i]),
      v_my_opps[1],
      v_my_opps[2],
      v_my_score, v_opp_score, v_won,
      v_match.match_type,
      p_matches[i]
    );

    v_new_rating := LEAST(v_params.clamp_max,
                      GREATEST(v_params.clamp_min, p_ratings[i] + v_delta));
    v_delta := v_new_rating - p_ratings[i];

    UPDATE match_participants
       SET rating_before = p_ratings[i],
           rating_after  = v_new_rating,
           rating_change = v_delta
     WHERE match_id = p_match_id
       AND player_id = p_ids[i];

    UPDATE profiles
       SET current_rating = v_new_rating
     WHERE id = p_ids[i];
  END LOOP;

  FOR i IN 1..4 LOOP
    PERFORM recalculate_player_stats(p_ids[i]);
  END LOOP;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.apply_match_rating_incremental(UUID) TO authenticated;


CREATE OR REPLACE FUNCTION public.handle_match_approval_recalc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'approved' AND COALESCE(NEW.voided, false) = false THEN
      PERFORM apply_match_rating_incremental(NEW.id);
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF (
         OLD.status IS DISTINCT FROM NEW.status
         AND OLD.status = 'approved'
         AND NEW.status <> 'approved'
       )
       OR (
         OLD.voided IS DISTINCT FROM NEW.voided
         AND NEW.status = 'approved'
       )
       OR (
         OLD.count_for_rating IS DISTINCT FROM NEW.count_for_rating
         AND NEW.status = 'approved'
       )
       OR (
         NEW.status = 'approved'
         AND OLD.status = 'approved'
         AND COALESCE(NEW.voided, false) = false
         AND (OLD.team1_score IS DISTINCT FROM NEW.team1_score
           OR OLD.team2_score IS DISTINCT FROM NEW.team2_score)
       )
    THEN
      PERFORM recalculate_all_ratings();
      RETURN NEW;
    END IF;

    IF OLD.status IS DISTINCT FROM NEW.status
       AND NEW.status = 'approved'
       AND COALESCE(NEW.voided, false) = false THEN
      PERFORM apply_match_rating_incremental(NEW.id);
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

-- Rebuild ratings once so the new algorithm + starting rating changes
-- take effect immediately.
SELECT public.recalculate_all_ratings();


-- =====================================================================
-- League Management foundation (admin-only)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.leagues (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  description    TEXT,
  location       TEXT,
  community_id   UUID REFERENCES public.groups(id) ON DELETE SET NULL,
  created_by     UUID NOT NULL REFERENCES public.profiles(id),
  status         TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'active', 'archived')),
  visibility     TEXT NOT NULL DEFAULT 'admin_only'
                   CHECK (visibility IN ('admin_only', 'private', 'public_future')),
  league_type    TEXT NOT NULL DEFAULT 'doubles'
                   CHECK (league_type IN ('singles', 'doubles', 'team', 'flex', 'ladder')),
  rating_eligible BOOLEAN NOT NULL DEFAULT false,
  guests_allowed  BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_leagues_status ON public.leagues(status);
CREATE INDEX IF NOT EXISTS idx_leagues_community_id ON public.leagues(community_id);

CREATE TABLE IF NOT EXISTS public.league_seasons (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id             UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  start_date            DATE,
  end_date              DATE,
  registration_deadline DATE,
  status                TEXT NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'active', 'completed', 'archived')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS idx_league_seasons_league_id ON public.league_seasons(league_id);

CREATE TABLE IF NOT EXISTS public.league_divisions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id   UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  season_id   UUID NOT NULL REFERENCES public.league_seasons(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  skill_min   NUMERIC CHECK (skill_min IS NULL OR (skill_min >= 2.0 AND skill_min <= 6.0)),
  skill_max   NUMERIC CHECK (skill_max IS NULL OR (skill_max >= 2.0 AND skill_max <= 6.0)),
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'archived')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (skill_max IS NULL OR skill_min IS NULL OR skill_max >= skill_min)
);
CREATE INDEX IF NOT EXISTS idx_league_divisions_season_id ON public.league_divisions(season_id);

CREATE TABLE IF NOT EXISTS public.league_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id   UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  season_id   UUID REFERENCES public.league_seasons(id) ON DELETE CASCADE,
  division_id UUID REFERENCES public.league_divisions(id) ON DELETE SET NULL,
  user_id     UUID NOT NULL REFERENCES public.profiles(id),
  role        TEXT NOT NULL DEFAULT 'player'
                CHECK (role IN ('player', 'captain', 'manager')),
  status      TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'pending', 'removed')),
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (league_id, season_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_league_members_league_season ON public.league_members(league_id, season_id);
CREATE INDEX IF NOT EXISTS idx_league_members_user ON public.league_members(user_id);

CREATE TABLE IF NOT EXISTS public.league_teams (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id        UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  season_id        UUID NOT NULL REFERENCES public.league_seasons(id) ON DELETE CASCADE,
  division_id      UUID REFERENCES public.league_divisions(id) ON DELETE SET NULL,
  name             TEXT NOT NULL,
  captain_user_id  UUID REFERENCES public.profiles(id),
  status           TEXT NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'archived')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_league_teams_season ON public.league_teams(season_id);

CREATE TABLE IF NOT EXISTS public.league_team_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    UUID NOT NULL REFERENCES public.league_teams(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id),
  role       TEXT NOT NULL DEFAULT 'player'
               CHECK (role IN ('player', 'captain', 'substitute')),
  status     TEXT NOT NULL DEFAULT 'active'
               CHECK (status IN ('active', 'removed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_league_team_members_team ON public.league_team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_league_team_members_user ON public.league_team_members(user_id);

CREATE TABLE IF NOT EXISTS public.league_sessions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id      UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  season_id      UUID NOT NULL REFERENCES public.league_seasons(id) ON DELETE CASCADE,
  division_id    UUID REFERENCES public.league_divisions(id) ON DELETE SET NULL,
  name           TEXT NOT NULL,
  scheduled_date DATE,
  start_time     TIME,
  end_time       TIME,
  court_count    INTEGER CHECK (court_count IS NULL OR court_count > 0),
  location       TEXT,
  status         TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'published', 'completed', 'canceled')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_league_sessions_season ON public.league_sessions(season_id);
CREATE INDEX IF NOT EXISTS idx_league_sessions_date ON public.league_sessions(scheduled_date);

CREATE TABLE IF NOT EXISTS public.league_matches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id       UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  season_id       UUID NOT NULL REFERENCES public.league_seasons(id) ON DELETE CASCADE,
  division_id     UUID REFERENCES public.league_divisions(id) ON DELETE SET NULL,
  session_id      UUID REFERENCES public.league_sessions(id) ON DELETE SET NULL,
  court_number    INTEGER,
  scheduled_time  TIMESTAMPTZ,
  team_a_id       UUID REFERENCES public.league_teams(id) ON DELETE SET NULL,
  team_b_id       UUID REFERENCES public.league_teams(id) ON DELETE SET NULL,
  player_a_id     UUID REFERENCES public.profiles(id),
  player_b_id     UUID REFERENCES public.profiles(id),
  player_c_id     UUID REFERENCES public.profiles(id),
  player_d_id     UUID REFERENCES public.profiles(id),
  linked_match_id UUID REFERENCES public.matches(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'scheduled'
                    CHECK (status IN ('scheduled', 'in_progress', 'score_submitted',
                                      'verified', 'disputed', 'canceled', 'forfeit')),
  rating_status   TEXT NOT NULL DEFAULT 'not_connected'
                    CHECK (rating_status IN ('not_connected', 'not_eligible', 'eligible_future')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_league_matches_session ON public.league_matches(session_id);
CREATE INDEX IF NOT EXISTS idx_league_matches_scheduled ON public.league_matches(scheduled_time);

CREATE TABLE IF NOT EXISTS public.league_audit_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id      UUID REFERENCES public.leagues(id) ON DELETE CASCADE,
  season_id      UUID REFERENCES public.league_seasons(id) ON DELETE CASCADE,
  actor_user_id  UUID NOT NULL REFERENCES public.profiles(id),
  action         TEXT NOT NULL,
  entity_type    TEXT NOT NULL,
  entity_id      UUID,
  old_value      JSONB,
  new_value      JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_league_audit_league ON public.league_audit_log(league_id);
CREATE INDEX IF NOT EXISTS idx_league_audit_created ON public.league_audit_log(created_at DESC);

-- Grants for every league_* table (required for PostgREST access)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leagues TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.league_seasons TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.league_divisions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.league_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.league_teams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.league_team_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.league_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.league_matches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.league_audit_log TO authenticated;
GRANT ALL ON public.leagues, public.league_seasons, public.league_divisions,
             public.league_members, public.league_teams, public.league_team_members,
             public.league_sessions, public.league_matches, public.league_audit_log
             TO service_role;

-- Admin-only RLS baseline
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'leagues', 'league_seasons', 'league_divisions', 'league_members',
    'league_teams', 'league_team_members', 'league_sessions',
    'league_matches', 'league_audit_log'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Admins full access" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "Admins full access" ON public.%I FOR ALL '
      'USING (has_role(auth.uid(), ''admin''::app_role)) '
      'WITH CHECK (has_role(auth.uid(), ''admin''::app_role))',
      t
    );
  END LOOP;
END $$;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'leagues', 'league_seasons', 'league_divisions', 'league_members',
    'league_teams', 'league_team_members', 'league_sessions',
    'league_matches'
  ] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%s_updated_at ON public.%I',
      t, t
    );
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON public.%I '
      'FOR EACH ROW EXECUTE FUNCTION public.update_updated_at()',
      t, t
    );
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.log_league_action(
  p_league_id   UUID,
  p_season_id   UUID,
  p_action      TEXT,
  p_entity_type TEXT,
  p_entity_id   UUID,
  p_old_value   JSONB DEFAULT NULL,
  p_new_value   JSONB DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_id    UUID;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  IF NOT has_role(v_actor, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin privileges required' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.league_audit_log
    (league_id, season_id, actor_user_id, action, entity_type, entity_id, old_value, new_value)
  VALUES
    (p_league_id, p_season_id, v_actor, p_action, p_entity_type, p_entity_id, p_old_value, p_new_value)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_league_action(UUID, UUID, TEXT, TEXT, UUID, JSONB, JSONB) TO authenticated;

-- League match scores
ALTER TABLE public.league_matches
  ADD COLUMN IF NOT EXISTS team_a_score INTEGER CHECK (team_a_score IS NULL OR team_a_score >= 0),
  ADD COLUMN IF NOT EXISTS team_b_score INTEGER CHECK (team_b_score IS NULL OR team_b_score >= 0);


-- =====================================================================
-- Player-facing SELECT policies (Phase 1)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.player_can_view_league(p_league_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.leagues l
     WHERE l.id = p_league_id
       AND l.visibility <> 'admin_only'
       AND EXISTS (
         SELECT 1
           FROM public.league_members m
          WHERE m.league_id = l.id
            AND m.user_id = auth.uid()
            AND m.status = 'active'
       )
  );
$$;

GRANT EXECUTE ON FUNCTION public.player_can_view_league(UUID) TO authenticated;

DROP POLICY IF EXISTS "Members can view own leagues" ON public.leagues;
CREATE POLICY "Members can view own leagues"
  ON public.leagues FOR SELECT
  USING (player_can_view_league(id));

DROP POLICY IF EXISTS "Members can view seasons of own leagues" ON public.league_seasons;
CREATE POLICY "Members can view seasons of own leagues"
  ON public.league_seasons FOR SELECT
  USING (player_can_view_league(league_id));

DROP POLICY IF EXISTS "Members can view divisions of own leagues" ON public.league_divisions;
CREATE POLICY "Members can view divisions of own leagues"
  ON public.league_divisions FOR SELECT
  USING (player_can_view_league(league_id));

DROP POLICY IF EXISTS "Members see own membership row" ON public.league_members;
CREATE POLICY "Members see own membership row"
  ON public.league_members FOR SELECT
  USING (
    user_id = auth.uid()
    AND player_can_view_league(league_id)
  );

DROP POLICY IF EXISTS "Members see own teams" ON public.league_teams;
CREATE POLICY "Members see own teams"
  ON public.league_teams FOR SELECT
  USING (
    player_can_view_league(league_id)
    AND (
      captain_user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.league_team_members ltm
        WHERE ltm.team_id = league_teams.id
          AND ltm.user_id = auth.uid()
          AND ltm.status = 'active'
      )
    )
  );

DROP POLICY IF EXISTS "Members see own team-member row" ON public.league_team_members;
CREATE POLICY "Members see own team-member row"
  ON public.league_team_members FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Members see sessions of own leagues" ON public.league_sessions;
CREATE POLICY "Members see sessions of own leagues"
  ON public.league_sessions FOR SELECT
  USING (player_can_view_league(league_id));

DROP POLICY IF EXISTS "Members see matches of own leagues" ON public.league_matches;
CREATE POLICY "Members see matches of own leagues"
  ON public.league_matches FOR SELECT
  USING (player_can_view_league(league_id));


-- =====================================================================
-- Phase 2: invite codes + public browse
-- =====================================================================

ALTER TABLE public.leagues
  ADD COLUMN IF NOT EXISTS invite_code TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_leagues_invite_code_ci_unique
  ON public.leagues (LOWER(invite_code))
  WHERE invite_code IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'leagues_invite_code_format'
       AND conrelid = 'public.leagues'::regclass
  ) THEN
    ALTER TABLE public.leagues
      ADD CONSTRAINT leagues_invite_code_format
      CHECK (invite_code IS NULL OR invite_code ~ '^[A-Za-z0-9_-]{4,32}$');
  END IF;
END $$;

DROP POLICY IF EXISTS "Signed-in users can browse public leagues" ON public.leagues;
CREATE POLICY "Signed-in users can browse public leagues"
  ON public.leagues FOR SELECT
  USING (
    visibility = 'public_future'
    AND auth.uid() IS NOT NULL
  );

CREATE OR REPLACE FUNCTION public.find_league_by_invite_code(p_code TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  location TEXT,
  league_type TEXT,
  visibility TEXT,
  guests_allowed BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  RETURN QUERY
    SELECT l.id,
           l.name,
           l.description,
           l.location,
           l.league_type::TEXT,
           l.visibility::TEXT,
           l.guests_allowed
      FROM public.leagues l
     WHERE LOWER(l.invite_code) = LOWER(p_code)
       AND l.visibility <> 'admin_only';
END;
$function$;

GRANT EXECUTE ON FUNCTION public.find_league_by_invite_code(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.join_league_by_code(p_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user     UUID := auth.uid();
  v_league_id UUID;
  v_existing_id UUID;
  v_existing_status TEXT;
  v_new_member_id UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT id INTO v_league_id
    FROM public.leagues
   WHERE LOWER(invite_code) = LOWER(p_code)
     AND visibility <> 'admin_only'
   LIMIT 1;

  IF v_league_id IS NULL THEN
    RAISE EXCEPTION 'No league matches that code' USING ERRCODE = '02000';
  END IF;

  SELECT id, status
    INTO v_existing_id, v_existing_status
    FROM public.league_members
   WHERE league_id = v_league_id
     AND user_id = v_user
   ORDER BY joined_at DESC
   LIMIT 1;

  IF v_existing_id IS NULL THEN
    INSERT INTO public.league_members (league_id, user_id, role, status)
    VALUES (v_league_id, v_user, 'player', 'active')
    RETURNING id INTO v_new_member_id;

    INSERT INTO public.league_audit_log
      (league_id, actor_user_id, action, entity_type, entity_id, new_value)
    VALUES (
      v_league_id, v_user, 'member.joined_by_code', 'member', v_new_member_id,
      jsonb_build_object('via', 'invite_code')
    );

  ELSIF v_existing_status <> 'active' THEN
    UPDATE public.league_members
       SET status = 'active', updated_at = NOW()
     WHERE id = v_existing_id;

    INSERT INTO public.league_audit_log
      (league_id, actor_user_id, action, entity_type, entity_id,
       old_value, new_value)
    VALUES (
      v_league_id, v_user, 'member.rejoined_by_code', 'member', v_existing_id,
      jsonb_build_object('status', v_existing_status),
      jsonb_build_object('status', 'active', 'via', 'invite_code')
    );
  END IF;

  RETURN v_league_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.join_league_by_code(TEXT) TO authenticated;


-- =====================================================================
-- Phase 3: teammate visibility
-- =====================================================================

CREATE OR REPLACE FUNCTION public.player_is_on_team(p_team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.league_team_members
     WHERE team_id = p_team_id
       AND user_id = auth.uid()
       AND status = 'active'
  );
$$;

GRANT EXECUTE ON FUNCTION public.player_is_on_team(UUID) TO authenticated;

DROP POLICY IF EXISTS "Teammates see active roster" ON public.league_team_members;
CREATE POLICY "Teammates see active roster"
  ON public.league_team_members FOR SELECT
  USING (
    status = 'active'
    AND player_is_on_team(team_id)
  );


-- =====================================================================
-- Phase 4: broaden league_teams visibility for standings
-- =====================================================================

DROP POLICY IF EXISTS "Members see own teams" ON public.league_teams;

DROP POLICY IF EXISTS "Members see teams of own leagues" ON public.league_teams;
CREATE POLICY "Members see teams of own leagues"
  ON public.league_teams FOR SELECT
  USING (player_can_view_league(league_id));


-- =====================================================================
-- Phase 5: score submit / verify / dispute RPCs
-- =====================================================================

ALTER TABLE public.league_matches
  ADD COLUMN IF NOT EXISTS verified_by UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS score_submitted_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS score_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispute_reason TEXT;

CREATE OR REPLACE FUNCTION public.player_is_in_league_match(p_match_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.league_matches lm
     WHERE lm.id = p_match_id
       AND (
         auth.uid() IN (
           lm.player_a_id, lm.player_b_id, lm.player_c_id, lm.player_d_id
         )
         OR
         EXISTS (
           SELECT 1 FROM public.league_team_members ltm
            WHERE ltm.team_id = lm.team_a_id
              AND ltm.user_id = auth.uid()
              AND ltm.status = 'active'
         )
         OR
         EXISTS (
           SELECT 1 FROM public.league_team_members ltm
            WHERE ltm.team_id = lm.team_b_id
              AND ltm.user_id = auth.uid()
              AND ltm.status = 'active'
         )
       )
  );
$$;

GRANT EXECUTE ON FUNCTION public.player_is_in_league_match(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_league_match_score(
  p_match_id UUID,
  p_team_a_score INTEGER,
  p_team_b_score INTEGER
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user  UUID := auth.uid();
  v_match RECORD;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  IF p_team_a_score IS NULL OR p_team_b_score IS NULL
     OR p_team_a_score < 0 OR p_team_b_score < 0 THEN
    RAISE EXCEPTION 'Scores must be non-negative integers'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_match
    FROM public.league_matches WHERE id = p_match_id FOR UPDATE;
  IF v_match.id IS NULL THEN
    RAISE EXCEPTION 'Match not found' USING ERRCODE = '02000';
  END IF;

  IF NOT player_is_in_league_match(p_match_id) THEN
    RAISE EXCEPTION 'Only participants can submit scores'
      USING ERRCODE = '42501';
  END IF;

  IF v_match.status IN ('verified', 'canceled', 'forfeit') THEN
    RAISE EXCEPTION 'Match is already % — ask an admin to edit',
      v_match.status USING ERRCODE = '22023';
  END IF;

  UPDATE public.league_matches
     SET team_a_score       = p_team_a_score,
         team_b_score       = p_team_b_score,
         status             = 'score_submitted',
         score_submitted_by = v_user,
         score_submitted_at = NOW(),
         verified_by        = ARRAY[v_user]::UUID[],
         dispute_reason     = NULL,
         updated_at         = NOW()
   WHERE id = p_match_id;

  INSERT INTO public.league_audit_log
    (league_id, actor_user_id, action, entity_type, entity_id,
     old_value, new_value)
  VALUES (
    v_match.league_id, v_user, 'match.score_submitted', 'league_match',
    p_match_id,
    jsonb_build_object(
      'previous_status', v_match.status,
      'previous_a', v_match.team_a_score,
      'previous_b', v_match.team_b_score
    ),
    jsonb_build_object(
      'team_a_score', p_team_a_score,
      'team_b_score', p_team_b_score
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_league_match_score(UUID, INTEGER, INTEGER)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.verify_league_match(p_match_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user         UUID := auth.uid();
  v_match        RECORD;
  v_new_verified UUID[];
  v_new_status   TEXT;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_match
    FROM public.league_matches WHERE id = p_match_id FOR UPDATE;
  IF v_match.id IS NULL THEN
    RAISE EXCEPTION 'Match not found' USING ERRCODE = '02000';
  END IF;

  IF NOT player_is_in_league_match(p_match_id) THEN
    RAISE EXCEPTION 'Only participants can verify a match'
      USING ERRCODE = '42501';
  END IF;

  IF v_match.status <> 'score_submitted' THEN
    RAISE EXCEPTION
      'Match is not awaiting verification (current status: %)',
      v_match.status USING ERRCODE = '22023';
  END IF;

  IF v_user = ANY(v_match.verified_by) THEN
    RETURN;
  END IF;

  v_new_verified := array_append(v_match.verified_by, v_user);
  v_new_status := CASE
    WHEN COALESCE(array_length(v_new_verified, 1), 0) >= 2 THEN 'verified'
    ELSE v_match.status
  END;

  UPDATE public.league_matches
     SET verified_by = v_new_verified,
         status      = v_new_status,
         updated_at  = NOW()
   WHERE id = p_match_id;

  INSERT INTO public.league_audit_log
    (league_id, actor_user_id, action, entity_type, entity_id, new_value)
  VALUES (
    v_match.league_id, v_user,
    CASE WHEN v_new_status = 'verified'
         THEN 'match.verified' ELSE 'match.confirmed' END,
    'league_match', p_match_id,
    jsonb_build_object(
      'verifications', COALESCE(array_length(v_new_verified, 1), 0),
      'status', v_new_status
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_league_match(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.dispute_league_match(
  p_match_id UUID,
  p_reason   TEXT DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user  UUID := auth.uid();
  v_match RECORD;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_match
    FROM public.league_matches WHERE id = p_match_id FOR UPDATE;
  IF v_match.id IS NULL THEN
    RAISE EXCEPTION 'Match not found' USING ERRCODE = '02000';
  END IF;

  IF NOT player_is_in_league_match(p_match_id) THEN
    RAISE EXCEPTION 'Only participants can dispute a match'
      USING ERRCODE = '42501';
  END IF;

  IF v_match.status NOT IN ('score_submitted', 'disputed') THEN
    RAISE EXCEPTION 'Cannot dispute a match in % status',
      v_match.status USING ERRCODE = '22023';
  END IF;

  UPDATE public.league_matches
     SET status         = 'disputed',
         dispute_reason = NULLIF(TRIM(COALESCE(p_reason, '')), ''),
         updated_at     = NOW()
   WHERE id = p_match_id;

  INSERT INTO public.league_audit_log
    (league_id, actor_user_id, action, entity_type, entity_id,
     old_value, new_value)
  VALUES (
    v_match.league_id, v_user, 'match.disputed', 'league_match',
    p_match_id,
    jsonb_build_object('previous_status', v_match.status),
    jsonb_build_object(
      'reason', COALESCE(NULLIF(TRIM(COALESCE(p_reason, '')), ''), '(none)')
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.dispute_league_match(UUID, TEXT) TO authenticated;
