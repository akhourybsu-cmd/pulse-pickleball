-- =====================================================================
-- Track B/8: server-side aggregation for SeasonsTab
--
-- The C/10 season analytics computed match/member counts on the
-- client by pulling every league_matches + league_members row for
-- the league and grouping in JavaScript. That's fine at 10-30
-- matches per season but drags at 100+.
--
-- This RPC returns the same aggregates directly, one row per season,
-- computed in Postgres. Admin-only via has_role gate; SECURITY DEFINER
-- so the client doesn't need to see every match row to render the
-- analytics rail.
--
-- Client can migrate to this when it wants — the RPC is additive.
-- The existing client-side grouping still works and is left in place
-- until the client swap lands.
-- =====================================================================


CREATE OR REPLACE FUNCTION public.get_league_season_aggregates(
  p_league_id UUID
) RETURNS TABLE (
  season_id           UUID,
  matches             INT,
  verified            INT,
  awaiting_confirm    INT,
  pending             INT,
  disputed            INT,
  forfeits            INT,
  members             INT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH allowed AS (
    -- Admins see every season; no need to filter by user membership.
    -- The has_role() gate below limits the whole function to admins,
    -- so this CTE is really just "seasons of this league".
    SELECT id FROM public.league_seasons WHERE league_id = p_league_id
  ),
  match_counts AS (
    SELECT
      lm.season_id,
      COUNT(*)::INT AS matches,
      COUNT(*) FILTER (WHERE lm.status = 'verified')::INT AS verified,
      COUNT(*) FILTER (WHERE lm.status = 'score_submitted')::INT AS awaiting_confirm,
      COUNT(*) FILTER (WHERE lm.status IN ('scheduled', 'in_progress'))::INT AS pending,
      COUNT(*) FILTER (WHERE lm.status = 'disputed')::INT AS disputed,
      COUNT(*) FILTER (WHERE lm.status = 'forfeit')::INT AS forfeits
    FROM public.league_matches lm
    WHERE lm.league_id = p_league_id
      AND lm.season_id IN (SELECT id FROM allowed)
    GROUP BY lm.season_id
  ),
  member_counts AS (
    SELECT
      m.season_id,
      COUNT(*)::INT AS members
    FROM public.league_members m
    WHERE m.league_id = p_league_id
      AND m.status = 'active'
      AND m.season_id IN (SELECT id FROM allowed)
    GROUP BY m.season_id
  )
  SELECT
    a.id AS season_id,
    COALESCE(mc.matches, 0),
    COALESCE(mc.verified, 0),
    COALESCE(mc.awaiting_confirm, 0),
    COALESCE(mc.pending, 0),
    COALESCE(mc.disputed, 0),
    COALESCE(mc.forfeits, 0),
    COALESCE(memc.members, 0)
  FROM allowed a
  LEFT JOIN match_counts mc ON mc.season_id = a.id
  LEFT JOIN member_counts memc ON memc.season_id = a.id
  -- Gate: admin-only. Non-admins get zero rows.
  WHERE public.has_role(auth.uid(), 'admin'::app_role);
$$;

GRANT EXECUTE ON FUNCTION public.get_league_season_aggregates(UUID)
  TO authenticated;

COMMENT ON FUNCTION public.get_league_season_aggregates IS
  'Admin-only. One row per season with match state counts + active '
  'member count. Backs SeasonsTab analytics without shipping every '
  'row to the client. Non-admins see zero rows via the has_role gate.';
