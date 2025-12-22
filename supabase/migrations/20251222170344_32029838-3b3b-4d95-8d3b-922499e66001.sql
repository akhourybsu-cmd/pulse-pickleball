-- Create update_updated_at function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create venue_courts table for court management
CREATE TABLE public.venue_courts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  court_number INTEGER NOT NULL,
  surface_type TEXT DEFAULT 'indoor',
  is_active BOOLEAN DEFAULT true,
  hourly_rate DECIMAL(10,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(venue_id, court_number)
);

-- Enable RLS
ALTER TABLE public.venue_courts ENABLE ROW LEVEL SECURITY;

-- Policy: Venue staff can view their venue's courts
CREATE POLICY "Venue staff can view courts"
ON public.venue_courts
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.venue_staff
    WHERE venue_staff.venue_id = venue_courts.venue_id
    AND venue_staff.user_id = auth.uid()
  )
);

-- Policy: Venue owners/managers can manage courts
CREATE POLICY "Venue managers can manage courts"
ON public.venue_courts
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.venue_staff
    WHERE venue_staff.venue_id = venue_courts.venue_id
    AND venue_staff.user_id = auth.uid()
    AND venue_staff.role IN ('owner', 'manager')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.venue_staff
    WHERE venue_staff.venue_id = venue_courts.venue_id
    AND venue_staff.user_id = auth.uid()
    AND venue_staff.role IN ('owner', 'manager')
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_venue_courts_updated_at
BEFORE UPDATE ON public.venue_courts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();