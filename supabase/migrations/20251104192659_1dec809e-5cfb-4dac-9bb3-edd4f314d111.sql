-- Enhance sessions table for Who's Up Board functionality
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS qr_join_url TEXT;

-- Add index for faster queue queries
CREATE INDEX IF NOT EXISTS idx_queue_entries_session_status 
ON queue_entries(session_id, status, joined_at);

-- Create function to auto-assign players to courts
CREATE OR REPLACE FUNCTION assign_players_to_courts(p_session_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_num_courts INTEGER;
  v_free_courts INTEGER[];
  v_waiting_players UUID[];
  v_court_num INTEGER;
  v_players UUID[];
BEGIN
  -- Get session info
  SELECT num_courts INTO v_num_courts
  FROM sessions
  WHERE id = p_session_id AND status = 'active';
  
  IF v_num_courts IS NULL THEN
    RETURN;
  END IF;
  
  -- Find free courts (not in use by live or on-deck matches)
  SELECT array_agg(court_num)
  INTO v_free_courts
  FROM generate_series(1, v_num_courts) AS court_num
  WHERE NOT EXISTS (
    SELECT 1 FROM match_tickets
    WHERE session_id = p_session_id
      AND court_number = court_num
      AND status IN ('live', 'on-deck')
  );
  
  -- Get waiting players (ordered by join time)
  SELECT array_agg(player_id ORDER BY joined_at)
  INTO v_waiting_players
  FROM queue_entries
  WHERE session_id = p_session_id
    AND status = 'waiting';
  
  -- Assign players to free courts (4 players per court)
  IF v_free_courts IS NOT NULL AND array_length(v_waiting_players, 1) >= 4 THEN
    FOREACH v_court_num IN ARRAY v_free_courts
    LOOP
      EXIT WHEN array_length(v_waiting_players, 1) < 4;
      
      -- Take first 4 players
      v_players := v_waiting_players[1:4];
      v_waiting_players := v_waiting_players[5:array_length(v_waiting_players, 1)];
      
      -- Create match ticket
      INSERT INTO match_tickets (
        session_id,
        court_number,
        team1_player1_id,
        team1_player2_id,
        team2_player1_id,
        team2_player2_id,
        status
      ) VALUES (
        p_session_id,
        v_court_num,
        v_players[1],
        v_players[2],
        v_players[3],
        v_players[4],
        'on-deck'
      );
      
      -- Update queue entries to 'playing' status
      UPDATE queue_entries
      SET status = 'playing'
      WHERE session_id = p_session_id
        AND player_id = ANY(v_players);
    END LOOP;
  END IF;
END;
$$;

-- Trigger function for queue changes
CREATE OR REPLACE FUNCTION trigger_assign_players()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM assign_players_to_courts(NEW.session_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS queue_entry_assignment_trigger ON queue_entries;
CREATE TRIGGER queue_entry_assignment_trigger
AFTER INSERT ON queue_entries
FOR EACH ROW
WHEN (NEW.status = 'waiting')
EXECUTE FUNCTION trigger_assign_players();

-- Trigger function for match completion
CREATE OR REPLACE FUNCTION trigger_reassign_on_match_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Mark players as 'done' when match completes
  IF NEW.status = 'completed' AND OLD.status IN ('live', 'on-deck') THEN
    UPDATE queue_entries
    SET status = 'done'
    WHERE session_id = NEW.session_id
      AND player_id IN (
        NEW.team1_player1_id,
        NEW.team1_player2_id,
        NEW.team2_player1_id,
        NEW.team2_player2_id
      )
      AND status = 'playing';
    
    -- Run assignment engine
    PERFORM assign_players_to_courts(NEW.session_id);
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS match_complete_reassignment_trigger ON match_tickets;
CREATE TRIGGER match_complete_reassignment_trigger
AFTER UPDATE OF status ON match_tickets
FOR EACH ROW
WHEN (NEW.status = 'completed')
EXECUTE FUNCTION trigger_reassign_on_match_complete();