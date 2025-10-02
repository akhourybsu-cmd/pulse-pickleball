-- Add updated_at trigger for match_tickets
CREATE TRIGGER update_match_tickets_updated_at
  BEFORE UPDATE ON public.match_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Add index for faster session queries
CREATE INDEX IF NOT EXISTS idx_sessions_status ON public.sessions(status);
CREATE INDEX IF NOT EXISTS idx_match_tickets_session_status ON public.match_tickets(session_id, status);
CREATE INDEX IF NOT EXISTS idx_queue_entries_session_status ON public.queue_entries(session_id, status);
CREATE INDEX IF NOT EXISTS idx_check_ins_session_status ON public.check_ins(session_id, status);

-- Function to clean up completed matches and return players to queue
CREATE OR REPLACE FUNCTION cleanup_completed_match(match_ticket_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id UUID;
  v_player_ids UUID[];
BEGIN
  -- Get session and player IDs
  SELECT 
    session_id,
    ARRAY[team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id]
  INTO v_session_id, v_player_ids
  FROM match_tickets
  WHERE id = match_ticket_id;

  -- Return players to waiting status
  UPDATE queue_entries
  SET status = 'waiting'
  WHERE session_id = v_session_id
    AND player_id = ANY(v_player_ids)
    AND status = 'playing';
END;
$$;

-- Function to prevent duplicate court assignments
CREATE OR REPLACE FUNCTION check_court_availability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if court is already in use for this session
  IF EXISTS (
    SELECT 1 
    FROM match_tickets 
    WHERE session_id = NEW.session_id 
      AND court_number = NEW.court_number 
      AND status IN ('live', 'on-deck')
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) THEN
    RAISE EXCEPTION 'Court % is already in use for this session', NEW.court_number;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Add trigger to prevent court conflicts
DROP TRIGGER IF EXISTS check_court_conflict ON public.match_tickets;
CREATE TRIGGER check_court_conflict
  BEFORE INSERT OR UPDATE ON public.match_tickets
  FOR EACH ROW
  WHEN (NEW.status IN ('live', 'on-deck'))
  EXECUTE FUNCTION check_court_availability();