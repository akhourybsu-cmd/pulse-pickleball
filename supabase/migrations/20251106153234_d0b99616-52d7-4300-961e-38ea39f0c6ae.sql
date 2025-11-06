-- Add registration mode columns to round_robin_events
ALTER TABLE round_robin_events
ADD COLUMN registration_mode text DEFAULT 'immediate' CHECK (registration_mode IN ('immediate', 'open_registration')),
ADD COLUMN registration_deadline timestamp with time zone,
ADD COLUMN max_players integer,
ADD COLUMN is_published boolean DEFAULT false;

-- Add registration status to round_robin_players
ALTER TABLE round_robin_players
ADD COLUMN registration_status text DEFAULT 'confirmed' CHECK (registration_status IN ('confirmed', 'waitlisted', 'withdrawn'));

-- Add index for querying published events
CREATE INDEX idx_rr_events_published ON round_robin_events(is_published, registration_deadline) WHERE is_published = true;

-- Update RLS policy to allow viewing published events
DROP POLICY IF EXISTS "Users can view their events" ON round_robin_events;
CREATE POLICY "Users can view their events" ON round_robin_events
FOR SELECT
USING (
  auth.uid() = organizer_id 
  OR is_event_participant(id, auth.uid())
  OR (is_published = true AND registration_mode = 'open_registration')
);

-- Allow authenticated users to register for published events
CREATE POLICY "Authenticated users can register for published events"
ON round_robin_players FOR INSERT
WITH CHECK (
  auth.uid() = player_id AND
  EXISTS (
    SELECT 1 FROM round_robin_events
    WHERE id = round_robin_players.event_id
    AND is_published = true
    AND registration_mode = 'open_registration'
    AND NOW() < registration_deadline
  )
);

-- Allow users to withdraw from events before deadline
DROP POLICY IF EXISTS "Organizers can manage event players" ON round_robin_players;
CREATE POLICY "Organizers can manage event players"
ON round_robin_players FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM round_robin_events
    WHERE round_robin_events.id = round_robin_players.event_id
    AND round_robin_events.organizer_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM round_robin_events
    WHERE round_robin_events.id = round_robin_players.event_id
    AND round_robin_events.organizer_id = auth.uid()
  )
);

-- Allow users to withdraw their own registrations before deadline
CREATE POLICY "Users can withdraw before deadline"
ON round_robin_players FOR UPDATE
USING (
  auth.uid() = player_id AND
  EXISTS (
    SELECT 1 FROM round_robin_events
    WHERE id = round_robin_players.event_id
    AND NOW() < registration_deadline
  )
);