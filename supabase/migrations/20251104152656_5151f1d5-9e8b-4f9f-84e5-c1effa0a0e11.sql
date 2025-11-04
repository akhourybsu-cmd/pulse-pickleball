-- Create calendar event registrations table
CREATE TABLE IF NOT EXISTS public.calendar_event_registrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  registered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'confirmed',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- Enable RLS
ALTER TABLE public.calendar_event_registrations ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view registrations"
  ON public.calendar_event_registrations
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create registrations"
  ON public.calendar_event_registrations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own registrations"
  ON public.calendar_event_registrations
  FOR DELETE
  USING (auth.uid() = user_id);

-- Index for faster lookups
CREATE INDEX idx_calendar_event_registrations_event_id ON public.calendar_event_registrations(event_id);
CREATE INDEX idx_calendar_event_registrations_user_id ON public.calendar_event_registrations(user_id);

-- Function to update current_registrations count
CREATE OR REPLACE FUNCTION update_calendar_event_registrations_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE calendar_events
    SET current_registrations = (
      SELECT COUNT(*) FROM calendar_event_registrations
      WHERE event_id = NEW.event_id AND status = 'confirmed'
    )
    WHERE id = NEW.event_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE calendar_events
    SET current_registrations = (
      SELECT COUNT(*) FROM calendar_event_registrations
      WHERE event_id = OLD.event_id AND status = 'confirmed'
    )
    WHERE id = OLD.event_id;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE calendar_events
    SET current_registrations = (
      SELECT COUNT(*) FROM calendar_event_registrations
      WHERE event_id = NEW.event_id AND status = 'confirmed'
    )
    WHERE id = NEW.event_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to auto-update counts
CREATE TRIGGER trigger_update_calendar_event_registrations_count
  AFTER INSERT OR UPDATE OR DELETE ON public.calendar_event_registrations
  FOR EACH ROW
  EXECUTE FUNCTION update_calendar_event_registrations_count();