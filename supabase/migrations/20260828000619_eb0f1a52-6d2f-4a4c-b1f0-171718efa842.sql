-- Players need read access to the ladder's structural tables so the player
-- league page can show "you are position N" and "you're on Court 3 with X, Y, Z",
-- and so the sub-request card can tell an already-drawn week from an open one.
-- Writes stay organizer-only (the existing "League admins full access" policies).

GRANT SELECT ON public.ladder_batches TO authenticated;
GRANT SELECT ON public.ladder_batch_groups TO authenticated;
GRANT SELECT ON public.ladder_snapshots TO authenticated;
GRANT SELECT ON public.ladder_movements TO authenticated;
GRANT ALL ON public.ladder_batches TO service_role;
GRANT ALL ON public.ladder_batch_groups TO service_role;
GRANT ALL ON public.ladder_snapshots TO service_role;
GRANT ALL ON public.ladder_movements TO service_role;

DROP POLICY IF EXISTS "Members read ladder batches of own leagues" ON public.ladder_batches;
CREATE POLICY "Members read ladder batches of own leagues"
  ON public.ladder_batches FOR SELECT TO authenticated
  USING (public.player_can_view_league(league_id));

DROP POLICY IF EXISTS "Members read ladder groups of own leagues" ON public.ladder_batch_groups;
CREATE POLICY "Members read ladder groups of own leagues"
  ON public.ladder_batch_groups FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ladder_batches b
    WHERE b.id = ladder_batch_groups.batch_id
      AND public.player_can_view_league(b.league_id)
  ));

DROP POLICY IF EXISTS "Members read ladder snapshots of own leagues" ON public.ladder_snapshots;
CREATE POLICY "Members read ladder snapshots of own leagues"
  ON public.ladder_snapshots FOR SELECT TO authenticated
  USING (public.player_can_view_league(league_id));

DROP POLICY IF EXISTS "Members read ladder movements of own leagues" ON public.ladder_movements;
CREATE POLICY "Members read ladder movements of own leagues"
  ON public.ladder_movements FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ladder_batches b
    WHERE b.id = ladder_movements.batch_id
      AND public.player_can_view_league(b.league_id)
  ));