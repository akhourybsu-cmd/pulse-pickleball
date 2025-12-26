-- Drop the old constraint and recreate with 'round_robin' included
ALTER TABLE venue_events DROP CONSTRAINT venue_events_event_type_check;

ALTER TABLE venue_events ADD CONSTRAINT venue_events_event_type_check 
CHECK (event_type = ANY (ARRAY['tournament'::text, 'clinic'::text, 'social'::text, 'league'::text, 'round_robin'::text, 'other'::text]));