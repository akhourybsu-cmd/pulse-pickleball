-- COMPREHENSIVE FIX: Break circular RLS dependency with security definer function

-- 1. Create security definer function to check event participation (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_event_participant(_event_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.round_robin_players
    WHERE event_id = _event_id
      AND player_id = _user_id
      AND active = true
  );
$$;

-- 2. Drop ALL existing policies on round_robin_events
DROP POLICY IF EXISTS "Admins can view all events" ON public.round_robin_events;
DROP POLICY IF EXISTS "Admins can manage all events" ON public.round_robin_events;
DROP POLICY IF EXISTS "Organizers can create events" ON public.round_robin_events;
DROP POLICY IF EXISTS "Organizers can update their events" ON public.round_robin_events;
DROP POLICY IF EXISTS "Organizers can delete their events" ON public.round_robin_events;
DROP POLICY IF EXISTS "Users can view their events" ON public.round_robin_events;

-- 3. Create NEW policies for round_robin_events (using security definer function)
CREATE POLICY "Admins can manage all events"
ON public.round_robin_events
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Organizers can create events"
ON public.round_robin_events
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = organizer_id);

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

-- SELECT: Use security definer function to avoid circular dependency
CREATE POLICY "Users can view their events"
ON public.round_robin_events
FOR SELECT
TO authenticated
USING (
  auth.uid() = organizer_id OR
  public.is_event_participant(id, auth.uid())
);

-- 4. Drop ALL existing policies on round_robin_players
DROP POLICY IF EXISTS "Participants can view event players" ON public.round_robin_players;
DROP POLICY IF EXISTS "Organizers can manage event players" ON public.round_robin_players;

-- 5. Create NEW policies for round_robin_players (simpler, no circular check)
CREATE POLICY "Players can view event players"
ON public.round_robin_players
FOR SELECT
TO authenticated
USING (
  player_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.round_robin_events
    WHERE id = round_robin_players.event_id
      AND organizer_id = auth.uid()
  )
);

CREATE POLICY "Organizers can manage event players"
ON public.round_robin_players
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.round_robin_events
    WHERE id = round_robin_players.event_id
      AND organizer_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.round_robin_events
    WHERE id = round_robin_players.event_id
      AND organizer_id = auth.uid()
  )
);

-- 6. Similarly fix round_robin_schedule policies
DROP POLICY IF EXISTS "Organizers can manage event schedule" ON public.round_robin_schedule;
DROP POLICY IF EXISTS "Participants can view event schedule" ON public.round_robin_schedule;

CREATE POLICY "Organizers can manage event schedule"
ON public.round_robin_schedule
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.round_robin_events
    WHERE id = round_robin_schedule.event_id
      AND organizer_id = auth.uid()
  )
);

CREATE POLICY "Participants can view event schedule"
ON public.round_robin_schedule
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.round_robin_events
    WHERE id = round_robin_schedule.event_id
      AND organizer_id = auth.uid()
  ) OR
  public.is_event_participant(event_id, auth.uid())
);