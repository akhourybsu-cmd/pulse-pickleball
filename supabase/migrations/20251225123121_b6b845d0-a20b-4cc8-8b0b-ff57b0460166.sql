-- Add venue_id to round_robin_events for venue-specific round robins
ALTER TABLE round_robin_events 
ADD COLUMN venue_id UUID REFERENCES venues(id);

-- Create index for faster venue lookups
CREATE INDEX idx_round_robin_events_venue_id ON round_robin_events(venue_id);

-- Update RLS policy to allow venue staff to manage their venue's round robins
CREATE POLICY "Venue staff can manage venue round robins"
ON round_robin_events
FOR ALL
USING (
  venue_id IS NULL 
  OR EXISTS (
    SELECT 1 FROM venue_staff vs 
    WHERE vs.venue_id = round_robin_events.venue_id 
    AND vs.user_id = auth.uid() 
    AND vs.is_active = true
  )
  OR EXISTS (
    SELECT 1 FROM venues v 
    WHERE v.id = round_robin_events.venue_id 
    AND v.owner_id = auth.uid()
  )
)
WITH CHECK (
  venue_id IS NULL 
  OR EXISTS (
    SELECT 1 FROM venue_staff vs 
    WHERE vs.venue_id = round_robin_events.venue_id 
    AND vs.user_id = auth.uid() 
    AND vs.is_active = true
  )
  OR EXISTS (
    SELECT 1 FROM venues v 
    WHERE v.id = round_robin_events.venue_id 
    AND v.owner_id = auth.uid()
  )
);