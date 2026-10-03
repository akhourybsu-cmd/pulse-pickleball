-- Legacy venue policy subqueries recursively expanded venue/community RLS into
-- every roster, schedule and guest read. The production roster EXPLAIN stalled
-- beyond 45 seconds before returning even one row. Keep the access decisions
-- in non-inlined predicates so planning no longer traverses that policy graph.
BEGIN;
CREATE OR REPLACE FUNCTION public.rr_venue_staff_access(p_venue uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT p_venue IS NOT NULL AND auth.uid() IS NOT NULL
    AND public.pulse_has_required_mfa()
    AND public.can_access_private_venue(p_venue)
    AND (EXISTS (SELECT 1 FROM public.venue_staff s
      WHERE s.venue_id=p_venue AND s.user_id=auth.uid() AND s.is_active)
      OR EXISTS (SELECT 1 FROM public.venues v WHERE v.id=p_venue AND v.owner_id=auth.uid()));
$$;
REVOKE ALL ON FUNCTION public.rr_venue_staff_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rr_venue_staff_access(uuid) TO authenticated,service_role;

-- A missing venue is not staff authorization. Standalone hosts, participants,
-- published events and kiosks retain their existing dedicated policies.
ALTER POLICY "Venue staff can manage venue round robins" ON public.round_robin_events
  TO authenticated
  USING (public.rr_venue_staff_access(venue_id))
  WITH CHECK (public.rr_venue_staff_access(venue_id));

CREATE OR REPLACE FUNCTION public.rr_can_read_managed_guest(p_guest uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT auth.uid() IS NOT NULL AND public.pulse_has_required_mfa()
    AND EXISTS (SELECT 1 FROM public.round_robin_players p
      WHERE p.guest_player_id=p_guest AND public.can_manage_round_robin(p.event_id));
$$;
REVOKE ALL ON FUNCTION public.rr_can_read_managed_guest(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.rr_can_read_managed_guest(uuid) TO authenticated,service_role;
ALTER POLICY venue_guest_roster_read ON public.guest_players
  USING (public.rr_can_read_managed_guest(id));
COMMIT;
