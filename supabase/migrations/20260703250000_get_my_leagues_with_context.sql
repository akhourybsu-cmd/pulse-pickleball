-- =====================================================================
-- Track B/5: kill the 3-query N+1 in useMyLeagues
--
-- Before: the client did three sequential Supabase calls per Dashboard
-- render — league_members → leagues (with IN) → seasons + divisions
-- (parallel pair). That's four round trips including the auth call
-- and it scales badly when a player joins several leagues.
--
-- After: one SECURITY DEFINER RPC does the whole join server-side and
-- returns a set of rows shaped like the client's MyLeagueRow. RLS is
-- unchanged — the function only ever queries for auth.uid()'s own
-- memberships and re-applies the same admin_only visibility filter
-- the RLS policies enforce, so returns are trivially safe.
-- =====================================================================


CREATE OR REPLACE FUNCTION public.get_my_leagues_with_context()
RETURNS TABLE (
  -- Membership fields (unqualified so the client can map cleanly)
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

  -- League (all fields the client's `League` interface needs)
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
  league_invite_code        TEXT,
  league_created_at         TIMESTAMPTZ,
  league_updated_at         TIMESTAMPTZ,

  -- Season (nullable)
  season_id                 UUID,
  season_league_id          UUID,
  season_name               TEXT,
  season_start_date         DATE,
  season_end_date           DATE,
  season_registration_deadline DATE,
  season_status             TEXT,
  season_created_at         TIMESTAMPTZ,
  season_updated_at         TIMESTAMPTZ,

  -- Division (nullable)
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
    l.rating_eligible, l.guests_allowed, l.invite_code,
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
    -- Same admin_only filter the client-side RLS applies. We drop the
    -- membership row entirely so the client doesn't see a league it
    -- cannot navigate to.
    AND l.visibility <> 'admin_only'
  ORDER BY l.name ASC, m.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_leagues_with_context() TO authenticated;

COMMENT ON FUNCTION public.get_my_leagues_with_context IS
  'Single-round-trip fetch for the Dashboard MyLeaguesCard + the '
  '/player/leagues hub. Returns joined membership + league + '
  '(optional) season + (optional) division rows for auth.uid() only. '
  'Drops rows whose parent league is admin_only, matching client RLS.';
