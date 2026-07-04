-- =====================================================================
-- Launch polish: two RPC fixes from the pre-launch audit
--
-- 1. get_my_upcoming_league_matches referenced s.location, but
--    league_seasons has no `location` column — that field lives on
--    the parent `leagues` row. Fix: read l.location (or NULL when
--    the league itself has none set).
--
-- 2. get_my_leagues_with_context returned league.invite_code to every
--    caller. Non-admins don't need it (they received the code via the
--    invite link) and it's admin-controlled metadata that shouldn't
--    leave the DB tier for player consumption. Fix: drop the column
--    from the return signature.
--
-- Both use CREATE OR REPLACE — safe to run on top of the existing
-- 20260703250000 + 20260703290000 migrations.
-- =====================================================================


-- ---------- 1. Fix location column reference ---------------------------
CREATE OR REPLACE FUNCTION public.get_my_upcoming_league_matches(
  p_limit INT DEFAULT 3
) RETURNS TABLE (
  match_id           UUID,
  league_id          UUID,
  league_name        TEXT,
  league_type        TEXT,
  season_id          UUID,
  season_name        TEXT,
  scheduled_time     TIMESTAMPTZ,
  court_number       INT,
  location           TEXT,
  status             TEXT,
  team_a_id          UUID,
  team_a_name        TEXT,
  team_b_id          UUID,
  team_b_name        TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    lm.id, lm.league_id, l.name, l.league_type::TEXT,
    lm.season_id, s.name AS season_name,
    lm.scheduled_time, lm.court_number,
    l.location,                        -- <— was s.location (nonexistent)
    lm.status::TEXT,
    lm.team_a_id, ta.name, lm.team_b_id, tb.name
  FROM public.league_matches lm
  JOIN public.leagues l ON l.id = lm.league_id
  LEFT JOIN public.league_seasons s ON s.id = lm.season_id
  LEFT JOIN public.league_teams ta ON ta.id = lm.team_a_id
  LEFT JOIN public.league_teams tb ON tb.id = lm.team_b_id
  WHERE lm.status IN ('scheduled', 'in_progress')
    AND lm.scheduled_time IS NOT NULL
    AND lm.scheduled_time >= NOW()
    AND l.visibility <> 'admin_only'
    AND (
      auth.uid() IN (
        lm.player_a_id, lm.player_b_id, lm.player_c_id, lm.player_d_id
      )
      OR EXISTS (
        SELECT 1 FROM public.league_team_members ltm
         WHERE ltm.team_id = lm.team_a_id
           AND ltm.user_id = auth.uid()
           AND ltm.status = 'active'
      )
      OR EXISTS (
        SELECT 1 FROM public.league_team_members ltm
         WHERE ltm.team_id = lm.team_b_id
           AND ltm.user_id = auth.uid()
           AND ltm.status = 'active'
      )
    )
  ORDER BY lm.scheduled_time ASC
  LIMIT GREATEST(p_limit, 0);
$$;

GRANT EXECUTE ON FUNCTION public.get_my_upcoming_league_matches(INT)
  TO authenticated;


-- ---------- 2. Drop invite_code from the my-leagues context RPC --------
-- Non-admin callers don't need the invite code — they already used it
-- (or received the deep-link) to become members. Stripping it removes
-- an unnecessary bit of admin-owned metadata from the wire.
--
-- NOTE: return signature changes → we DROP first, then re-create, since
-- CREATE OR REPLACE cannot alter the output columns of a function.
DROP FUNCTION IF EXISTS public.get_my_leagues_with_context();

CREATE OR REPLACE FUNCTION public.get_my_leagues_with_context()
RETURNS TABLE (
  membership_id             UUID,
  membership_league_id      UUID,
  membership_season_id      UUID,
  membership_division_id    UUID,
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
  -- invite_code intentionally omitted — see doc.
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
  season_updated_at         TIMESTAMPTZ,

  division_id               UUID,
  division_league_id        UUID,
  division_season_id        UUID,
  division_name             TEXT,
  division_skill_min        NUMERIC,
  division_skill_max        NUMERIC,
  division_description      TEXT,
  division_status           TEXT,
  division_created_at       TIMESTAMPTZ,
  division_updated_at       TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.id, m.league_id, m.season_id, m.division_id, m.user_id,
    m.role::TEXT, m.status::TEXT, m.joined_at, m.created_at, m.updated_at,

    l.id, l.name, l.description, l.location, l.community_id, l.created_by,
    l.status::TEXT, l.visibility::TEXT, l.league_type::TEXT,
    l.rating_eligible, l.guests_allowed,
    l.created_at, l.updated_at,

    s.id, s.league_id, s.name, s.start_date, s.end_date,
    s.registration_deadline, s.status::TEXT, s.created_at, s.updated_at,

    d.id, d.league_id, d.season_id, d.name, d.skill_min, d.skill_max,
    d.description, d.status::TEXT, d.created_at, d.updated_at
  FROM public.league_members m
  JOIN public.leagues l ON l.id = m.league_id
  LEFT JOIN public.league_seasons s ON s.id = m.season_id
  LEFT JOIN public.league_divisions d ON d.id = m.division_id
  WHERE m.user_id = auth.uid()
    AND m.status = 'active'
    AND l.visibility <> 'admin_only'
  ORDER BY l.name ASC, m.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_leagues_with_context() TO authenticated;
