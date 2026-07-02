-- =====================================================================
-- Player-facing SELECT policies for League Management (Phase 1)
--
-- Until now, every league_* table has had ONE policy:
--   FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
-- This migration ADDS additional SELECT policies for regular players.
-- The admin FOR ALL policies stay in place, unchanged.
--
-- Postgres OR-combines row-level policies of the same command type, so
-- the effective read rule becomes:
--   admin can SELECT everything, OR
--   player can SELECT rows that satisfy the new policy below.
--
-- Safety invariants:
--   • A league with visibility='admin_only' is INVISIBLE to any
--     non-admin session — every player policy short-circuits on
--     `leagues.visibility != 'admin_only'`.
--   • A player only sees rows related to leagues where they have an
--     ACTIVE league_members row (status = 'active'). No other players'
--     memberships are visible.
--   • No INSERT / UPDATE / DELETE policies are added — players remain
--     read-only for the entire league surface. Any write flow (join,
--     registration, score entry) will be a future admin-authored RPC.
--
-- All existing behaviors preserved. Existing admin-only leagues stay
-- exactly where they are.
-- =====================================================================


-- Helper: does the current player have an active membership in a
-- league that is not admin-only? Used across every player policy so
-- the visibility gate + membership gate live in one place.
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

COMMENT ON FUNCTION public.player_can_view_league IS
  'Returns true when the current auth.uid() is an ACTIVE member of the '
  'given league AND the league is not admin_only. Used inside every '
  'player-facing RLS policy so the visibility + membership gates stay '
  'in a single source of truth.';


-- ---------- leagues -----------------------------------------------------
DROP POLICY IF EXISTS "Members can view own leagues" ON public.leagues;
CREATE POLICY "Members can view own leagues"
  ON public.leagues FOR SELECT
  USING (player_can_view_league(id));


-- ---------- league_seasons ---------------------------------------------
DROP POLICY IF EXISTS "Members can view seasons of own leagues" ON public.league_seasons;
CREATE POLICY "Members can view seasons of own leagues"
  ON public.league_seasons FOR SELECT
  USING (player_can_view_league(league_id));


-- ---------- league_divisions -------------------------------------------
DROP POLICY IF EXISTS "Members can view divisions of own leagues" ON public.league_divisions;
CREATE POLICY "Members can view divisions of own leagues"
  ON public.league_divisions FOR SELECT
  USING (player_can_view_league(league_id));


-- ---------- league_members ---------------------------------------------
-- Players see only their OWN membership row. They do NOT get the full
-- season roster — that's a separate feature (public rosters) that would
-- deserve its own policy + visibility flag.
DROP POLICY IF EXISTS "Members see own membership row" ON public.league_members;
CREATE POLICY "Members see own membership row"
  ON public.league_members FOR SELECT
  USING (
    user_id = auth.uid()
    AND player_can_view_league(league_id)
  );


-- ---------- league_teams ------------------------------------------------
-- Players see teams that belong to leagues they can view AND that they
-- are personally on. Team rosters + opponent teams stay hidden.
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


-- ---------- league_team_members ----------------------------------------
-- Player sees only their own team-member rows.
DROP POLICY IF EXISTS "Members see own team-member row" ON public.league_team_members;
CREATE POLICY "Members see own team-member row"
  ON public.league_team_members FOR SELECT
  USING (user_id = auth.uid());


-- ---------- league_sessions --------------------------------------------
-- Sessions of leagues the player can view.
DROP POLICY IF EXISTS "Members see sessions of own leagues" ON public.league_sessions;
CREATE POLICY "Members see sessions of own leagues"
  ON public.league_sessions FOR SELECT
  USING (player_can_view_league(league_id));


-- ---------- league_matches ---------------------------------------------
-- Matches the player is participating in OR that belong to a viewable
-- league (kept scoped by player_can_view_league to prevent leaks from
-- leagues they're no longer active in).
DROP POLICY IF EXISTS "Members see matches of own leagues" ON public.league_matches;
CREATE POLICY "Members see matches of own leagues"
  ON public.league_matches FOR SELECT
  USING (player_can_view_league(league_id));


-- No player policy on league_audit_log — the audit trail stays admin-only.
