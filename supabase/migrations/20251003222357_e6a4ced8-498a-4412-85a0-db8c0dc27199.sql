-- Create events table
CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  organizer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  location TEXT,
  event_date DATE,
  start_time TIME,
  end_time TIME,
  num_courts INTEGER,
  points_to INTEGER DEFAULT 11,
  win_by_2 BOOLEAN DEFAULT true,
  rating_type TEXT DEFAULT 'ladder',
  rating_eligible BOOLEAN DEFAULT true,
  visibility TEXT DEFAULT 'public',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for events
CREATE POLICY "Anyone can view public/unlisted events"
  ON public.events FOR SELECT
  USING (visibility IN ('public', 'unlisted') OR auth.uid() = organizer_id);

CREATE POLICY "Authenticated users can create events"
  ON public.events FOR INSERT
  WITH CHECK (auth.uid() = organizer_id);

CREATE POLICY "Organizers can update their events"
  ON public.events FOR UPDATE
  USING (auth.uid() = organizer_id);

CREATE POLICY "Organizers can delete their events"
  ON public.events FOR DELETE
  USING (auth.uid() = organizer_id);

-- Add event fields to matches table
ALTER TABLE public.matches
  ADD COLUMN event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  ADD COLUMN round_number TEXT,
  ADD COLUMN event_court_number INTEGER;

-- Create index for event queries
CREATE INDEX idx_matches_event_id ON public.matches(event_id);

-- Add trigger for events updated_at
CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Update match insert policy to allow organizers to create event matches
CREATE POLICY "Event organizers can create matches for their events"
  ON public.matches FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND (
      created_by = auth.uid() OR
      EXISTS (
        SELECT 1 FROM public.events
        WHERE events.id = matches.event_id
          AND events.organizer_id = auth.uid()
      )
    )
  );