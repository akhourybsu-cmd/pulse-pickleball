-- Create venue_event_registrations table for player event sign-ups
CREATE TABLE public.venue_event_registrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.venue_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'waitlisted', 'cancelled', 'attended')),
  registered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  cancelled_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- Enable RLS
ALTER TABLE public.venue_event_registrations ENABLE ROW LEVEL SECURITY;

-- Anyone can view registrations (for participant counts)
CREATE POLICY "Anyone can view event registrations"
  ON public.venue_event_registrations FOR SELECT
  USING (true);

-- Authenticated users can register for events
CREATE POLICY "Users can register for events"
  ON public.venue_event_registrations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own registrations
CREATE POLICY "Users can update own registrations"
  ON public.venue_event_registrations FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can cancel their own registrations
CREATE POLICY "Users can delete own registrations"
  ON public.venue_event_registrations FOR DELETE
  USING (auth.uid() = user_id);

-- Allow venue staff to manage registrations
CREATE POLICY "Venue staff can manage registrations"
  ON public.venue_event_registrations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.venue_events ve
      JOIN public.venue_staff vs ON ve.venue_id = vs.venue_id
      WHERE ve.id = venue_event_registrations.event_id
      AND vs.user_id = auth.uid()
    )
  );

-- Create index for faster lookups
CREATE INDEX idx_venue_event_registrations_event ON public.venue_event_registrations(event_id);
CREATE INDEX idx_venue_event_registrations_user ON public.venue_event_registrations(user_id);

-- Add user_id column to venue_bookings for player bookings (optional customer_user_id)
ALTER TABLE public.venue_bookings ADD COLUMN IF NOT EXISTS user_id UUID;

-- Update RLS on venue_bookings to allow players to create their own bookings
CREATE POLICY "Players can create own bookings"
  ON public.venue_bookings FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Players can view their own bookings
CREATE POLICY "Players can view own bookings"
  ON public.venue_bookings FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

-- Players can cancel their own bookings
CREATE POLICY "Players can update own bookings"
  ON public.venue_bookings FOR UPDATE
  USING (auth.uid() = user_id);

-- Add linked_court_id to venue_courts for integration with existing courts table
ALTER TABLE public.venue_courts ADD COLUMN IF NOT EXISTS linked_court_id UUID REFERENCES public.courts(id);

-- Create index for linked courts
CREATE INDEX IF NOT EXISTS idx_venue_courts_linked ON public.venue_courts(linked_court_id);

-- Update trigger for updated_at on venue_event_registrations
CREATE TRIGGER update_venue_event_registrations_updated_at
  BEFORE UPDATE ON public.venue_event_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();