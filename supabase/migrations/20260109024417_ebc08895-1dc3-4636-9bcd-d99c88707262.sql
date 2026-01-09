-- Add payment-related columns to tournaments_events
ALTER TABLE public.tournaments_events 
ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS divisions_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text,
ADD COLUMN IF NOT EXISTS paid_at timestamptz;

-- Add check constraint for payment_status
ALTER TABLE public.tournaments_events 
ADD CONSTRAINT tournaments_events_payment_status_check 
CHECK (payment_status IN ('draft', 'pending', 'paid', 'failed'));

-- Create function to auto-update divisions_count
CREATE OR REPLACE FUNCTION public.update_tournament_divisions_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.tournaments_events 
    SET divisions_count = (
      SELECT COUNT(*) FROM public.tournaments_divisions WHERE event_id = OLD.event_id
    ),
    updated_at = now()
    WHERE id = OLD.event_id;
    RETURN OLD;
  ELSE
    UPDATE public.tournaments_events 
    SET divisions_count = (
      SELECT COUNT(*) FROM public.tournaments_divisions WHERE event_id = NEW.event_id
    ),
    updated_at = now()
    WHERE id = NEW.event_id;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for auto-updating divisions_count
DROP TRIGGER IF EXISTS trigger_update_divisions_count ON public.tournaments_divisions;
CREATE TRIGGER trigger_update_divisions_count
AFTER INSERT OR UPDATE OR DELETE ON public.tournaments_divisions
FOR EACH ROW EXECUTE FUNCTION public.update_tournament_divisions_count();

-- RLS policies for tournaments_events
ALTER TABLE public.tournaments_events ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their own tournaments" ON public.tournaments_events;
DROP POLICY IF EXISTS "Users can view public tournaments" ON public.tournaments_events;
DROP POLICY IF EXISTS "Users can create tournaments" ON public.tournaments_events;
DROP POLICY IF EXISTS "Users can update their own tournaments" ON public.tournaments_events;
DROP POLICY IF EXISTS "Users can delete their own draft tournaments" ON public.tournaments_events;

-- Users can view their own tournaments
CREATE POLICY "Users can view their own tournaments" 
ON public.tournaments_events 
FOR SELECT 
USING (auth.uid() = created_by);

-- Anyone can view public paid tournaments
CREATE POLICY "Users can view public tournaments" 
ON public.tournaments_events 
FOR SELECT 
USING (is_public = true AND payment_status = 'paid');

-- Authenticated users can create tournaments
CREATE POLICY "Users can create tournaments" 
ON public.tournaments_events 
FOR INSERT 
WITH CHECK (auth.uid() = created_by);

-- Users can update their own tournaments (except payment_status to 'paid')
CREATE POLICY "Users can update their own tournaments" 
ON public.tournaments_events 
FOR UPDATE 
USING (auth.uid() = created_by);

-- Users can delete their own draft tournaments
CREATE POLICY "Users can delete their own draft tournaments" 
ON public.tournaments_events 
FOR DELETE 
USING (auth.uid() = created_by AND payment_status = 'draft');

-- RLS for tournaments_divisions
ALTER TABLE public.tournaments_divisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view divisions of their tournaments" ON public.tournaments_divisions;
DROP POLICY IF EXISTS "Users can view divisions of public tournaments" ON public.tournaments_divisions;
DROP POLICY IF EXISTS "Users can create divisions for their tournaments" ON public.tournaments_divisions;
DROP POLICY IF EXISTS "Users can update divisions of their tournaments" ON public.tournaments_divisions;
DROP POLICY IF EXISTS "Users can delete divisions of their tournaments" ON public.tournaments_divisions;

-- Users can view divisions of their own tournaments
CREATE POLICY "Users can view divisions of their tournaments" 
ON public.tournaments_divisions 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.tournaments_events 
    WHERE id = tournaments_divisions.event_id 
    AND created_by = auth.uid()
  )
);

-- Anyone can view divisions of public paid tournaments
CREATE POLICY "Users can view divisions of public tournaments" 
ON public.tournaments_divisions 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.tournaments_events 
    WHERE id = tournaments_divisions.event_id 
    AND is_public = true 
    AND payment_status = 'paid'
  )
);

-- Users can create divisions for their own tournaments
CREATE POLICY "Users can create divisions for their tournaments" 
ON public.tournaments_divisions 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tournaments_events 
    WHERE id = tournaments_divisions.event_id 
    AND created_by = auth.uid()
  )
);

-- Users can update divisions of their own tournaments
CREATE POLICY "Users can update divisions of their tournaments" 
ON public.tournaments_divisions 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.tournaments_events 
    WHERE id = tournaments_divisions.event_id 
    AND created_by = auth.uid()
  )
);

-- Users can delete divisions of their own tournaments
CREATE POLICY "Users can delete divisions of their tournaments" 
ON public.tournaments_divisions 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.tournaments_events 
    WHERE id = tournaments_divisions.event_id 
    AND created_by = auth.uid()
  )
);