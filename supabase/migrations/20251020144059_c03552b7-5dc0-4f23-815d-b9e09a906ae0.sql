-- Add location field to round_robin_events table
ALTER TABLE public.round_robin_events
ADD COLUMN IF NOT EXISTS location TEXT;