-- =====================================================================
-- Remove the League Division system
--
-- A league is now a single implicit division. Skill-level info moves up to
-- the league itself (shown/edited on the Overview). To create a different
-- skill tier you create a separate league.
--
-- This removes divisions as a FEATURE — the league_divisions table, its FKs,
-- and the division_* output of get_my_leagues_with_context. The now-inert
-- nullable `division_id` columns on league_members/teams/sessions/matches/
-- substitutes are intentionally LEFT in place (always NULL): several DB
-- functions (ladder generators, create_league, bulk_add_league_members)
-- insert division_id => NULL, and dropping the columns would force rewriting
-- all of them. They're invisible to users and can be dropped in a later
-- cleanup migration.
--
-- Tournament divisions (tournaments_divisions, etc.) are unrelated and
-- untouched.
-- =====================================================================

-- ---- 1. Skill level moves onto the league ---------------------------
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

-- Best-effort: lift each league's skill range from an existing division so
-- current leagues keep their range. One division per league (the common case).
UPDATE public.leagues l
   SET skill_min = d.skill_min, skill_max = d.skill_max
  FROM (
    SELECT DISTINCT ON (league_id) league_id, skill_min, skill_max
      FROM public.league_divisions
     ORDER BY league_id, created_at ASC
  ) d
 WHERE d.league_id = l.id
   AND l.skill_min IS NULL AND l.skill_max IS NULL;

-- ---- 2. Drop every FK that references league_divisions --------------
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT conrelid::regclass AS tbl, conname
      FROM pg_constraint
     WHERE confrelid = 'public.league_divisions'::regclass
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT IF EXISTS %I', r.tbl, r.conname);
  END LOOP;
END $$;

-- ---- 3. Drop the table (+ its policies/trigger) and helper fn -------
DROP TABLE IF EXISTS public.league_divisions CASCADE;
DROP FUNCTION IF EXISTS public.update_divisions_updated_at() CASCADE;

-- ---- 4. Rewrite get_my_leagues_with_context (no division fields) ----
-- Return type changes, so drop + recreate. Adds league skill_min/max.
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

COMMENT ON FUNCTION public.get_my_leagues_with_context IS
  'Single-round-trip fetch for the Dashboard MyLeaguesCard + the '
  '/player/leagues hub. Returns joined membership + league (incl. skill '
  'range) + (optional) season for auth.uid() only. Drops admin_only leagues.';
