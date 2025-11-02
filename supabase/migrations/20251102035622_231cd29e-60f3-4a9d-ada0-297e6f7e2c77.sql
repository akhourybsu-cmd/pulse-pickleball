-- Add new policy fields to tournament_customization table
ALTER TABLE public.tournament_customization 
ADD COLUMN IF NOT EXISTS refund_policy TEXT,
ADD COLUMN IF NOT EXISTS weather_policy TEXT,
ADD COLUMN IF NOT EXISTS conduct_policy TEXT,
ADD COLUMN IF NOT EXISTS liability_policy TEXT,
ADD COLUMN IF NOT EXISTS extra_notes TEXT;