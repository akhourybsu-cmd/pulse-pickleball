-- Add organizer_pin column to round_robin_events table
ALTER TABLE public.round_robin_events 
ADD COLUMN organizer_pin text DEFAULT '1234';