-- Fix infinite recursion in round_robin_events RLS policies

-- Drop all existing policies on round_robin_events
DROP POLICY IF EXISTS "Admins can view all events" ON public.round_robin_events;
DROP POLICY IF EXISTS "Organizers can manage their events" ON public.round_robin_events;
DROP POLICY IF EXISTS "Participants can view their events" ON public.round_robin_events;

-- Admins can do everything
CREATE POLICY "Admins can view all events"
ON public.round_robin_events
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage all events"
ON public.round_robin_events
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Organizers can INSERT their own events (no circular check needed at creation)
CREATE POLICY "Organizers can create events"
ON public.round_robin_events
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = organizer_id);

-- Organizers can UPDATE/DELETE their own events
CREATE POLICY "Organizers can update their events"
ON public.round_robin_events
FOR UPDATE
TO authenticated
USING (auth.uid() = organizer_id)
WITH CHECK (auth.uid() = organizer_id);

CREATE POLICY "Organizers can delete their events"
ON public.round_robin_events
FOR DELETE
TO authenticated
USING (auth.uid() = organizer_id);

-- For SELECT: organizers and participants can view (safe to check participants on SELECT)
CREATE POLICY "Users can view their events"
ON public.round_robin_events
FOR SELECT
TO authenticated
USING (
  auth.uid() = organizer_id OR
  EXISTS (
    SELECT 1
    FROM public.round_robin_players
    WHERE round_robin_players.event_id = round_robin_events.id
      AND round_robin_players.player_id = auth.uid()
  )
);