-- =====================================================================
-- Track C/11: Dashboard "Up next in leagues" widget data
--
-- Returns the caller's next N scheduled/in-progress league matches
-- across every league they're an active participant in. Joins the
-- match row + league name/type + both team names in one round trip
-- so the Dashboard card renders without follow-up queries.
--
-- Participant resolution mirrors player_is_in_league_match:
--   * Direct player slots on the match
--   * Active member of team_a OR team_b
--
-- Filters:
--   * status IN ('scheduled', 'in_progress')
--   * scheduled_time IS NOT NULL AND scheduled_time >= now()
--     (matches with no time set are hidden — they can't be "up next")
--   * parent league.visibility != 'admin_only'  (matches client RLS)
--
-- Ordered by scheduled_time ASC so the soonest match is first.
-- =====================================================================


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
    lm.scheduled_time, lm.court_number, s.location,
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

COMMENT ON FUNCTION public.get_my_upcoming_league_matches IS
  'Dashboard widget backer. One round trip returns the caller''s next '
  'N upcoming league matches with the league name/type + both team '
  'names pre-joined. Filters to visible leagues only, matching RLS.';
