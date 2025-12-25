-- Add round_robin_event_id to venue_events to link them
ALTER TABLE venue_events 
ADD COLUMN round_robin_event_id UUID REFERENCES round_robin_events(id) ON DELETE SET NULL;

-- Update event_type to include round_robin (using check constraint if exists, or just rely on application validation)
-- The column is TEXT so no constraint update needed, just add 'round_robin' as a valid type in the app