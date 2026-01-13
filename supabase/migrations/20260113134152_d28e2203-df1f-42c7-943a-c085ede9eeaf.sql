-- Add columns to track inquiry intent and link to converted venues
ALTER TABLE public.venue_inquiries 
  ADD COLUMN IF NOT EXISTS intent TEXT DEFAULT 'info_request' CHECK (intent IN ('create_now', 'info_request')),
  ADD COLUMN IF NOT EXISTS converted_venue_id UUID REFERENCES public.venues(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'converted', 'info_requested', 'contacted'));

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_venue_inquiries_status ON public.venue_inquiries(status);
CREATE INDEX IF NOT EXISTS idx_venue_inquiries_converted_venue_id ON public.venue_inquiries(converted_venue_id);

-- Update RLS policy to allow updating intent and status
DROP POLICY IF EXISTS "Anyone can insert venue inquiries" ON public.venue_inquiries;
CREATE POLICY "Anyone can insert venue inquiries" 
  ON public.venue_inquiries 
  FOR INSERT 
  WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update their own inquiry" ON public.venue_inquiries;
CREATE POLICY "Anyone can update inquiry by id" 
  ON public.venue_inquiries 
  FOR UPDATE 
  USING (true)
  WITH CHECK (true);