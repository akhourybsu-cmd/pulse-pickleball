-- Add branding and white-label fields to venues table
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#FF6B35';
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS secondary_color TEXT DEFAULT '#004E64';
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS banner_url TEXT;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS tagline TEXT;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS show_pulse_branding BOOLEAN DEFAULT true;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS social_facebook TEXT;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS social_instagram TEXT;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS hours_of_operation JSONB;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS amenities TEXT[];

-- Add index for slug lookups on public pages
CREATE INDEX IF NOT EXISTS idx_venues_slug ON public.venues(slug) WHERE slug IS NOT NULL;