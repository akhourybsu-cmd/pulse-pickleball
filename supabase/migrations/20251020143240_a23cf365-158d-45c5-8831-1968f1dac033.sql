-- Fix infinite recursion in round_robin_players RLS policies

-- Drop existing policies
DROP POLICY IF EXISTS "Participants can view event players" ON public.round_robin_players;
DROP POLICY IF EXISTS "Organizers can manage event players" ON public.round_robin_players;

-- Simplified policy: participants can view players in events they're part of
CREATE POLICY "Participants can view event players"
ON public.round_robin_players
FOR SELECT
TO authenticated
USING (
  player_id = auth.uid() OR
  EXISTS (
    SELECT 1
    FROM public.round_robin_events
    WHERE round_robin_events.id = round_robin_players.event_id
      AND round_robin_events.organizer_id = auth.uid()
  )
);

-- Organizers can manage their event players
CREATE POLICY "Organizers can manage event players"
ON public.round_robin_players
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.round_robin_events
    WHERE round_robin_events.id = round_robin_players.event_id
      AND round_robin_events.organizer_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.round_robin_events
    WHERE round_robin_events.id = round_robin_players.event_id
      AND round_robin_events.organizer_id = auth.uid()
  )
);