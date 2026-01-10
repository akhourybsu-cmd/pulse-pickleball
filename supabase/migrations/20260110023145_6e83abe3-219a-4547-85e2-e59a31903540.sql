-- Add onboarding tracking to venues table
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS tagline TEXT;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS onboarding_step TEXT DEFAULT 'welcome';