-- Participants already have access to their event and schedule. Give them the
-- matching roster read access even when the host uses a private/manual event.
-- is_event_participant is the existing STABLE SECURITY DEFINER membership check;
-- querying round_robin_players directly here would recurse through its own RLS.
CREATE POLICY "Participants can read their complete event roster"
ON public.round_robin_players
FOR SELECT TO authenticated
USING (public.is_event_participant(event_id, (SELECT auth.uid())));

COMMENT ON POLICY "Participants can read their complete event roster"
ON public.round_robin_players IS
  'Active registered participants may read all roster rows in their own event, including guest and historical slots. Does not grant roster writes or access to unrelated private events.';
