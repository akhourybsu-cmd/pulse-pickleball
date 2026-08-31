-- =====================================================================
-- Tournaments: allow storing a full bracket, and let organizers manage
-- their own teams/matches.
--
-- (1) BRACKET STORAGE
-- tournaments_matches.team1_id / team2_id are NOT NULL, so only matches whose
-- participants are already known can be stored. A real elimination bracket has
-- to exist in full before it is played — round 2+ slots are empty until
-- winners advance into them, and you want the whole draw visible (and
-- schedulable onto courts/times) from the moment it is generated. Make the two
-- columns nullable so the generator can lay out every round up front.
--
-- The existing `different_teams_check (team1_id != team2_id)` stays valid:
-- a CHECK only fails on FALSE, and NULL != NULL evaluates to NULL.
--
-- (2) ORGANIZER ACCESS
-- tournaments_teams and tournaments_matches only ever received *admin*
-- policies (has_role(auth.uid(),'admin')) for SELECT/INSERT/UPDATE/DELETE.
-- Meanwhile tournaments_events/_divisions were later opened up to their
-- creators. The result: a non-platform-admin organizer can create a tournament
-- and its divisions but cannot add teams or generate a bracket — the writes
-- fail silently. Reads used to work only by accident, via the public
-- `public_view_enabled` policies that were just removed to close anon access,
-- so without this an organizer can no longer see their own draw either.
--
-- Grant the event's creator (and admins) full control of the teams and matches
-- underneath their own tournament. Policies are permissive, so these are OR'd
-- with the existing admin ones.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Bracket storage
-- ---------------------------------------------------------------------
ALTER TABLE public.tournaments_matches ALTER COLUMN team1_id DROP NOT NULL;
ALTER TABLE public.tournaments_matches ALTER COLUMN team2_id DROP NOT NULL;

COMMENT ON COLUMN public.tournaments_matches.team1_id IS
  'Nullable: an unplayed later-round bracket slot has no team until a winner advances into it.';
COMMENT ON COLUMN public.tournaments_matches.team2_id IS
  'Nullable: an unplayed later-round bracket slot has no team until a winner advances into it.';

-- ---------------------------------------------------------------------
-- 2. Helper: may the current user manage this division?
--    SECURITY DEFINER so the policy can read the parent event without
--    needing its own RLS to pass.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_manage_tournament_division(_division_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tournaments_divisions d
    JOIN public.tournaments_events e ON e.id = d.event_id
    WHERE d.id = _division_id
      AND (e.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  );
$$;

REVOKE ALL ON FUNCTION public.can_manage_tournament_division(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_tournament_division(uuid) TO authenticated;

-- ---------------------------------------------------------------------
-- 3. Organizer policies — teams
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Organizers manage teams in their divisions" ON public.tournaments_teams;
CREATE POLICY "Organizers manage teams in their divisions"
ON public.tournaments_teams
FOR ALL
TO authenticated
USING (public.can_manage_tournament_division(division_id))
WITH CHECK (public.can_manage_tournament_division(division_id));

-- ---------------------------------------------------------------------
-- 4. Organizer policies — matches
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Organizers manage matches in their divisions" ON public.tournaments_matches;
CREATE POLICY "Organizers manage matches in their divisions"
ON public.tournaments_matches
FOR ALL
TO authenticated
USING (public.can_manage_tournament_division(division_id))
WITH CHECK (public.can_manage_tournament_division(division_id));

COMMIT;
