-- Create calendar_events table for facility reservations
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('open_play', 'private', 'league', 'lesson')),
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  court_number INTEGER NOT NULL,
  capacity INTEGER,
  current_registrations INTEGER DEFAULT 0,
  price NUMERIC(10,2) DEFAULT 0,
  instructor TEXT,
  skill_level TEXT CHECK (skill_level IN ('beginner', 'intermediate', 'advanced', 'all')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- Anyone can view events
CREATE POLICY "Anyone can view calendar events"
  ON public.calendar_events
  FOR SELECT
  USING (true);

-- Admins can create events
CREATE POLICY "Admins can create calendar events"
  ON public.calendar_events
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update events
CREATE POLICY "Admins can update calendar events"
  ON public.calendar_events
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete events
CREATE POLICY "Admins can delete calendar events"
  ON public.calendar_events
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for better query performance
CREATE INDEX idx_calendar_events_facility_time ON public.calendar_events(facility_id, start_time);
CREATE INDEX idx_calendar_events_time ON public.calendar_events(start_time, end_time);