-- =====================================================================
-- League Management foundation (admin-only)
--
-- Adds the schema, RLS, and audit helper for League Play. Everything
-- created here is invisible to non-admins:
--   • Every table has RLS enabled with a single admin-gated policy
--     (has_role(auth.uid(), 'admin'::app_role) = true).
--   • Public/player routes cannot read or write these tables until we
--     add per-role policies in a future phase.
--   • Rating engine is untouched. league_matches carry rating_status
--     = 'not_connected' by default; no trigger references them.
--   • linked_match_id on league_matches is a placeholder FK to
--     matches(id) for future rating hookup — nullable, no cascade
--     behavior that would surprise the existing match flow.
--
-- Naming mirrors existing PULSE conventions (UUID PKs, created_by,
-- created_at, updated_at, snake_case column names).
-- =====================================================================

-- ---------- 1. leagues ---------------------------------------------------
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

-- ---------- 2. league_seasons -------------------------------------------
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

-- ---------- 3. league_divisions -----------------------------------------
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

-- ---------- 4. league_members -------------------------------------------
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

-- ---------- 5. league_teams ---------------------------------------------
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

-- ---------- 6. league_team_members --------------------------------------
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

-- ---------- 7. league_sessions ------------------------------------------
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

-- ---------- 8. league_matches (placeholder) -----------------------------
--
-- Placeholder scaffold. linked_match_id will connect to the existing
-- `matches` table when we activate rating hookup — for now it stays
-- NULL and no trigger references these rows.
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

-- ---------- 9. league_audit_log -----------------------------------------
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


-- =====================================================================
-- Row-level security — admin-only across the board.
--
-- One policy per table, USING/WITH CHECK the same helper the rest of
-- the app uses. Non-admin sessions get an empty result set for every
-- SELECT and errors for every write. If a future phase needs member-
-- level reads (e.g., a captain seeing their own team), we add per-
-- role policies alongside this admin-catchall.
-- =====================================================================

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


-- =====================================================================
-- updated_at trigger — reuse the existing update_updated_at() function.
-- =====================================================================

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


-- =====================================================================
-- Audit helper — admins call log_league_action() to record any change
-- worth auditing. Not a trigger, so the caller controls what gets
-- captured (avoids noisy audits on every UPDATE).
-- =====================================================================

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

COMMENT ON FUNCTION public.log_league_action IS
  'Admin-only audit logging for League Management. Callers pass what '
  'they want captured; no automatic triggers, no accidental leakage.';
