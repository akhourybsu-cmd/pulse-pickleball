-- =====================================================================
-- Phase 3: teammate visibility
--
-- Player league detail pages need to show a team roster (who else is on
-- my team?). The existing SELECT policy on league_team_members is
-- scoped to `user_id = auth.uid()` — you only see your own row. This
-- migration adds an additional SELECT policy that lets a player see
-- OTHER active rows on any team they're active on.
--
-- Postgres OR-combines same-command policies, so the effective read
-- rule for a non-admin becomes:
--   - your own team_member row (existing policy), OR
--   - any team_member row on a team you're currently active on.
--
-- The admin FOR ALL policy is untouched.
--
-- No changes to league_matches — the Phase 1 policy already lets
-- members SELECT any match in a league they can view. The match-
-- schedule UI shipping alongside this migration filters client-side
-- to matches actually involving the player.
--
-- No new writes, no schema changes. RLS additions only.
-- =====================================================================


-- Helper: does the current player have an ACTIVE team_member row on
-- this team? Pulled into its own STABLE SECURITY DEFINER function so
-- the policy doesn't reference the same table it's guarding (avoids
-- policy-recursion surprises across Postgres versions).
CREATE OR REPLACE FUNCTION public.player_is_on_team(p_team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.league_team_members
     WHERE team_id = p_team_id
       AND user_id = auth.uid()
       AND status = 'active'
  );
$$;

GRANT EXECUTE ON FUNCTION public.player_is_on_team(UUID) TO authenticated;

COMMENT ON FUNCTION public.player_is_on_team IS
  'Returns true if auth.uid() has an ACTIVE team_member row on the '
  'given team. Used in league_team_members RLS so teammates can see '
  'each other, and by the client to check league membership scope.';


-- ---------- Teammate visibility on league_team_members ----------------
DROP POLICY IF EXISTS "Teammates see active roster" ON public.league_team_members;
CREATE POLICY "Teammates see active roster"
  ON public.league_team_members FOR SELECT
  USING (
    -- Only reveal ACTIVE roster rows. Removed team members stay
    -- private to the individual + admins.
    status = 'active'
    AND player_is_on_team(team_id)
  );
