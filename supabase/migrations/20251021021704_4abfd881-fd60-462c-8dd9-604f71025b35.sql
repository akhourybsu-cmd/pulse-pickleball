-- Add voiding support to round_robin_events
ALTER TABLE public.round_robin_events 
ADD COLUMN IF NOT EXISTS voided BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS voided_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS void_reason TEXT;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_round_robin_events_status ON public.round_robin_events(status);
CREATE INDEX IF NOT EXISTS idx_round_robin_schedule_event_round ON public.round_robin_schedule(event_id, round_no);

-- Function to void a round robin event (keeps data but marks as voided)
CREATE OR REPLACE FUNCTION public.void_round_robin_event(
  p_event_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_organizer_id UUID;
BEGIN
  -- Check if user is organizer or admin
  SELECT organizer_id INTO v_organizer_id
  FROM round_robin_events
  WHERE id = p_event_id;
  
  IF v_organizer_id != auth.uid() AND NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only organizer or admin can void event';
  END IF;
  
  -- Mark event as voided
  UPDATE round_robin_events
  SET 
    voided = TRUE,
    voided_by = auth.uid(),
    voided_at = NOW(),
    void_reason = p_reason,
    status = 'voided'
  WHERE id = p_event_id;
  
  -- Mark all associated matches as voided (if they exist)
  UPDATE matches
  SET 
    voided = TRUE,
    voided_by = auth.uid(),
    voided_at = NOW(),
    void_reason = COALESCE(p_reason, 'Round Robin event voided')
  WHERE event_id = p_event_id
    AND voided = FALSE;
END;
$$;

-- Function to hard delete a round robin event
CREATE OR REPLACE FUNCTION public.delete_round_robin_event(
  p_event_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_organizer_id UUID;
  v_has_scores BOOLEAN;
BEGIN
  -- Check if user is organizer or admin
  SELECT organizer_id INTO v_organizer_id
  FROM round_robin_events
  WHERE id = p_event_id;
  
  IF v_organizer_id != auth.uid() AND NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only organizer or admin can delete event';
  END IF;
  
  -- Check if event has saved scores
  SELECT EXISTS(
    SELECT 1 FROM round_robin_schedule
    WHERE event_id = p_event_id
      AND (team1_score IS NOT NULL OR team2_score IS NOT NULL)
  ) INTO v_has_scores;
  
  IF v_has_scores AND NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Events with scores can only be hard deleted by admins. Use void instead.';
  END IF;
  
  -- Delete match participants for any matches from this event
  DELETE FROM match_participants
  WHERE match_id IN (
    SELECT id FROM matches WHERE event_id = p_event_id
  );
  
  -- Delete matches
  DELETE FROM matches WHERE event_id = p_event_id;
  
  -- Delete schedule
  DELETE FROM round_robin_schedule WHERE event_id = p_event_id;
  
  -- Delete players
  DELETE FROM round_robin_players WHERE event_id = p_event_id;
  
  -- Delete event
  DELETE FROM round_robin_events WHERE id = p_event_id;
  
  -- Recalculate ratings if matches were deleted
  IF v_has_scores THEN
    PERFORM recalculate_all_ratings();
  END IF;
END;
$$;