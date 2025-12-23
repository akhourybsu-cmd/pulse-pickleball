-- Add court type and premium fee columns to venue_courts
ALTER TABLE public.venue_courts 
ADD COLUMN IF NOT EXISTS court_type text DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS premium_fee numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_premium boolean DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.venue_courts.court_type IS 'Type of court: standard, championship, premium';
COMMENT ON COLUMN public.venue_courts.premium_fee IS 'Extra fee for selecting this specific court';
COMMENT ON COLUMN public.venue_courts.is_premium IS 'Flag indicating if this is a premium court';