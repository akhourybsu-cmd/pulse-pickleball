-- Add citi_admins array to courts table
ALTER TABLE public.courts
ADD COLUMN IF NOT EXISTS citi_admins uuid[] DEFAULT '{}';

-- Create events table for Pickleball Citi
CREATE TABLE IF NOT EXISTS public.citi_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id uuid NOT NULL REFERENCES public.courts(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone NOT NULL,
  max_players integer NOT NULL,
  waitlist_enabled boolean NOT NULL DEFAULT true,
  waitlist_max integer,
  skill_tag text,
  price_label text,
  is_published boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create event attendees table
CREATE TABLE IF NOT EXISTS public.citi_event_attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.citi_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('attending', 'waitlisted', 'checked_in')),
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  promoted_at timestamp with time zone,
  checkin_timestamp timestamp with time zone,
  UNIQUE(event_id, user_id)
);

-- Enable RLS
ALTER TABLE public.citi_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.citi_event_attendees ENABLE ROW LEVEL SECURITY;

-- RLS policies for citi_events
CREATE POLICY "Anyone can view published events"
  ON public.citi_events FOR SELECT
  USING (is_published = true OR auth.uid() = ANY(
    SELECT unnest(citi_admins) FROM courts WHERE courts.id = citi_events.court_id
  ));

CREATE POLICY "Citi admins can create events"
  ON public.citi_events FOR INSERT
  WITH CHECK (auth.uid() = ANY(
    SELECT unnest(citi_admins) FROM courts WHERE courts.id = court_id
  ));

CREATE POLICY "Citi admins can update events"
  ON public.citi_events FOR UPDATE
  USING (auth.uid() = ANY(
    SELECT unnest(citi_admins) FROM courts WHERE courts.id = court_id
  ));

CREATE POLICY "Citi admins can delete events"
  ON public.citi_events FOR DELETE
  USING (auth.uid() = ANY(
    SELECT unnest(citi_admins) FROM courts WHERE courts.id = court_id
  ));

-- RLS policies for citi_event_attendees
CREATE POLICY "Anyone can view attendees"
  ON public.citi_event_attendees FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can join events"
  ON public.citi_event_attendees FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own attendance"
  ON public.citi_event_attendees FOR UPDATE
  USING (auth.uid() = user_id OR auth.uid() = ANY(
    SELECT unnest(c.citi_admins) 
    FROM citi_events e 
    JOIN courts c ON e.court_id = c.id 
    WHERE e.id = event_id
  ));

CREATE POLICY "Users can leave events"
  ON public.citi_event_attendees FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_citi_events_court_id ON public.citi_events(court_id);
CREATE INDEX IF NOT EXISTS idx_citi_events_start_time ON public.citi_events(start_time);
CREATE INDEX IF NOT EXISTS idx_citi_event_attendees_event_id ON public.citi_event_attendees(event_id);
CREATE INDEX IF NOT EXISTS idx_citi_event_attendees_user_id ON public.citi_event_attendees(user_id);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_citi_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_citi_events_updated_at
BEFORE UPDATE ON public.citi_events
FOR EACH ROW
EXECUTE FUNCTION update_citi_events_updated_at();