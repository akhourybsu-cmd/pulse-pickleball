-- Add other_location column to matches table to store custom location label
ALTER TABLE public.matches ADD COLUMN other_location TEXT;

-- Add other_location column to events table to store custom location label
ALTER TABLE public.events ADD COLUMN other_location TEXT;