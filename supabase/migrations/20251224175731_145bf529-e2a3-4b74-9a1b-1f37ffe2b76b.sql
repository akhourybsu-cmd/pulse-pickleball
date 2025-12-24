-- Create venue_inquiries table for public lead capture
CREATE TABLE public.venue_inquiries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  venue_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  city TEXT,
  state TEXT,
  court_count TEXT,
  facility_type TEXT,
  current_booking_method TEXT,
  message TEXT,
  referral_source TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.venue_inquiries ENABLE ROW LEVEL SECURITY;

-- Allow public inserts (no auth required for lead capture)
CREATE POLICY "Anyone can submit venue inquiry"
ON public.venue_inquiries
FOR INSERT
WITH CHECK (true);

-- Only admins can view inquiries
CREATE POLICY "Admins can view venue inquiries"
ON public.venue_inquiries
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Only admins can update inquiries (for status changes)
CREATE POLICY "Admins can update venue inquiries"
ON public.venue_inquiries
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_venue_inquiries_updated_at
BEFORE UPDATE ON public.venue_inquiries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();