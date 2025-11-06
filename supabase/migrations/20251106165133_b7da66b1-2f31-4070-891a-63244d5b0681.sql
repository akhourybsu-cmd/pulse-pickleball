-- Allow anyone to view round robin players for published events
DROP POLICY IF EXISTS "Players can view event players" ON public.round_robin_players;

CREATE POLICY "Users can view players for published events"
ON public.round_robin_players
FOR SELECT
USING (
  -- Player themselves
  (player_id = auth.uid()) 
  OR 
  -- Event organizer
  (EXISTS (
    SELECT 1 FROM round_robin_events
    WHERE round_robin_events.id = round_robin_players.event_id
    AND round_robin_events.organizer_id = auth.uid()
  ))
  OR
  -- Anyone can view players for published open registration events
  (EXISTS (
    SELECT 1 FROM round_robin_events
    WHERE round_robin_events.id = round_robin_players.event_id
    AND round_robin_events.is_published = true
    AND round_robin_events.registration_mode = 'open_registration'
  ))
);