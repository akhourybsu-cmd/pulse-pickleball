-- Remove the recursive/expensive RLS plan on guest_players.
--
-- The previous SELECT policies joined round_robin_players, round_robin_events,
-- round_robin_schedule, and group_members directly from a guest_players policy.
-- On the external Supabase project those nested policy checks made every
-- authenticated guest lookup take several seconds or hit statement_timeout.
-- Security-definer predicates evaluate the same authorization rules without
-- recursively invoking RLS on every joined table.

DO $$
DECLARE
  unexpected_policies text[];
BEGIN
  SELECT array_agg(policy.polname ORDER BY policy.polname)
    INTO unexpected_policies
    FROM pg_policy AS policy
   WHERE policy.polrelid = 'public.guest_players'::regclass
     AND policy.polname <> ALL (ARRAY[
       'Creators manage own guests',
       'Group admins manage group guests',
       'RR participants can view guests in their events',
       'Kiosk can view guests in live or completed events'
     ]::name[]);

  IF unexpected_policies IS NOT NULL THEN
    RAISE EXCEPTION
      'Refusing to replace guest_players policies; unexpected policies found: %',
      unexpected_policies;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_create_guest_player(
  _created_by uuid,
  _group_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL
     AND (
       _created_by = auth.uid()
       OR (
         _group_id IS NOT NULL
         AND EXISTS (
           SELECT 1
             FROM public.group_members AS member
            WHERE member.group_id = _group_id
              AND member.user_id = auth.uid()
              AND member.role IN ('owner', 'moderator')
         )
       )
     );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_guest_player(_guest_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.guest_players AS guest
     WHERE guest.id = _guest_id
       AND public.can_create_guest_player(guest.created_by, guest.group_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_guest_player(_guest_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.guest_players AS guest
     WHERE guest.id = _guest_id
       AND (
         public.can_create_guest_player(guest.created_by, guest.group_id)
         OR EXISTS (
           SELECT 1
             FROM public.round_robin_players AS registration
             JOIN public.round_robin_events AS event
               ON event.id = registration.event_id
            WHERE registration.guest_player_id = guest.id
              AND (
                event.organizer_id = auth.uid()
                OR EXISTS (
                  SELECT 1
                    FROM public.round_robin_players AS viewer_registration
                   WHERE viewer_registration.event_id = event.id
                     AND viewer_registration.player_id = auth.uid()
                )
              )
         )
         OR EXISTS (
           SELECT 1
             FROM public.round_robin_schedule AS schedule
             JOIN public.round_robin_events AS event
               ON event.id = schedule.event_id
            WHERE event.status IN ('live', 'completed')
              AND guest.id IN (
                schedule.a1_guest_id,
                schedule.a2_guest_id,
                schedule.b1_guest_id,
                schedule.b2_guest_id
              )
         )
       )
  );
$$;

REVOKE ALL ON FUNCTION public.can_create_guest_player(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_guest_player(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_view_guest_player(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.can_create_guest_player(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_guest_player(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_guest_player(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "Creators manage own guests" ON public.guest_players;
DROP POLICY IF EXISTS "Group admins manage group guests" ON public.guest_players;
DROP POLICY IF EXISTS "RR participants can view guests in their events" ON public.guest_players;
DROP POLICY IF EXISTS "Kiosk can view guests in live or completed events" ON public.guest_players;

CREATE POLICY "Authorized users can view guest players"
  ON public.guest_players
  FOR SELECT
  TO anon, authenticated
  USING (public.can_view_guest_player(id));

CREATE POLICY "Authorized users can create guest players"
  ON public.guest_players
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_create_guest_player(created_by, group_id));

CREATE POLICY "Authorized users can update guest players"
  ON public.guest_players
  FOR UPDATE
  TO authenticated
  USING (public.can_manage_guest_player(id))
  WITH CHECK (public.can_create_guest_player(created_by, group_id));

CREATE POLICY "Authorized users can delete guest players"
  ON public.guest_players
  FOR DELETE
  TO authenticated
  USING (public.can_manage_guest_player(id));

COMMENT ON FUNCTION public.can_view_guest_player(uuid) IS
  'RLS-safe guest visibility check for creators, group admins, RR participants, and live/completed kiosks.';

ANALYZE public.guest_players;
