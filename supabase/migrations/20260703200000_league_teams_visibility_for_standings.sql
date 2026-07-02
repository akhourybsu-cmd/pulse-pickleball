-- =====================================================================
-- Phase 4: broaden league_teams visibility so standings work
--
-- Existing policy narrows league_teams to teams the player is on or
-- captains. That worked for Phase 1 (roster view) but breaks Phase 4
-- (standings) — a player standing at the top of the season needs to
-- see the names of the teams below them.
--
-- What we swap:
--   • DROP the existing narrow policy.
--   • ADD a policy that lets any active member of the league see any
--     team in that league.
--
-- What stays private (unchanged):
--   • league_team_members rosters — Phase 3 policy still narrows those
--     to only teams the player is on. Opposing team rosters remain
--     invisible.
--   • league_audit_log — admin-only, unchanged.
--   • admin_only leagues — invisible to non-admins, unchanged.
--
-- Admin FOR ALL policies on league_teams are untouched.
-- =====================================================================

DROP POLICY IF EXISTS "Members see own teams" ON public.league_teams;

DROP POLICY IF EXISTS "Members see teams of own leagues" ON public.league_teams;
CREATE POLICY "Members see teams of own leagues"
  ON public.league_teams FOR SELECT
  USING (player_can_view_league(league_id));
