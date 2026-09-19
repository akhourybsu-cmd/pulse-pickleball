-- INSERT ... RETURNING must pass the SELECT policy too. The existing
-- can_view_guest_player(id) STABLE helper reads guest_players using the
-- statement's original snapshot, where the newly inserted row is absent.
-- Authorize creators/group managers from the candidate row's values instead.
-- Keep the existing policy for RR participants and anonymous live kiosks.
DROP POLICY IF EXISTS "Creators and group managers can read guest rows" ON public.guest_players;

CREATE POLICY "Creators and group managers can read guest rows"
  ON public.guest_players
  FOR SELECT
  TO authenticated
  USING (public.can_create_guest_player(created_by, group_id));

COMMENT ON POLICY "Creators and group managers can read guest rows" ON public.guest_players IS
  'Uses candidate-row ownership for INSERT RETURNING; preserves existing creator and group-manager access.';
