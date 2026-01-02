-- Add rating_eligible column to matches table
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS rating_eligible BOOLEAN DEFAULT true;