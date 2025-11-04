-- Add series_id to track recurring events that were created together
ALTER TABLE public.calendar_events 
ADD COLUMN series_id uuid;