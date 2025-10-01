-- Function to recalculate player statistics from match history
CREATE OR REPLACE FUNCTION public.recalculate_player_stats(p_player_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_total_matches INTEGER;
  v_wins INTEGER;
  v_losses INTEGER;
  v_points_for INTEGER;
  v_points_against INTEGER;
  v_current_rating NUMERIC;
BEGIN
  -- Get the most recent approved match rating, or default to 3.00
  SELECT COALESCE(mp.rating_after, 3.00)
  INTO v_current_rating
  FROM match_participants mp
  JOIN matches m ON mp.match_id = m.id
  WHERE mp.player_id = p_player_id
    AND m.status = 'approved'
  ORDER BY m.match_date DESC, m.created_at DESC
  LIMIT 1;

  -- Count total approved matches
  SELECT COUNT(DISTINCT mp.match_id)
  INTO v_total_matches
  FROM match_participants mp
  JOIN matches m ON mp.match_id = m.id
  WHERE mp.player_id = p_player_id
    AND m.status = 'approved';

  -- Count wins (rating_change > 0)
  SELECT COUNT(DISTINCT mp.match_id)
  INTO v_wins
  FROM match_participants mp
  JOIN matches m ON mp.match_id = m.id
  WHERE mp.player_id = p_player_id
    AND m.status = 'approved'
    AND mp.rating_change > 0;

  -- Count losses
  v_losses := v_total_matches - v_wins;

  -- Calculate total points for and against
  SELECT 
    COALESCE(SUM(CASE WHEN mp.team = 1 THEN m.team1_score ELSE m.team2_score END), 0),
    COALESCE(SUM(CASE WHEN mp.team = 1 THEN m.team2_score ELSE m.team1_score END), 0)
  INTO v_points_for, v_points_against
  FROM match_participants mp
  JOIN matches m ON mp.match_id = m.id
  WHERE mp.player_id = p_player_id
    AND m.status = 'approved';

  -- Update the profile
  UPDATE profiles
  SET 
    current_rating = v_current_rating,
    total_matches = v_total_matches,
    wins = v_wins,
    losses = v_losses,
    total_points_for = v_points_for,
    total_points_against = v_points_against,
    updated_at = NOW()
  WHERE id = p_player_id;
END;
$$;

-- Function to recalculate all player stats
CREATE OR REPLACE FUNCTION public.recalculate_all_player_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  player_record RECORD;
BEGIN
  FOR player_record IN SELECT id FROM profiles
  LOOP
    PERFORM recalculate_player_stats(player_record.id);
  END LOOP;
END;
$$;

-- Trigger to recalculate stats when a match is deleted
CREATE OR REPLACE FUNCTION public.handle_match_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  participant_record RECORD;
BEGIN
  -- Recalculate stats for all participants of the deleted match
  FOR participant_record IN 
    SELECT DISTINCT player_id 
    FROM match_participants 
    WHERE match_id = OLD.id
  LOOP
    PERFORM recalculate_player_stats(participant_record.player_id);
  END LOOP;
  
  RETURN OLD;
END;
$$;

-- Create trigger for match deletion
DROP TRIGGER IF EXISTS on_match_delete ON matches;
CREATE TRIGGER on_match_delete
  AFTER DELETE ON matches
  FOR EACH ROW
  EXECUTE FUNCTION handle_match_deletion();

-- Trigger to recalculate stats when match status changes from approved to rejected/pending
CREATE OR REPLACE FUNCTION public.handle_match_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  participant_record RECORD;
BEGIN
  -- Only recalculate if status changed from or to approved
  IF (OLD.status = 'approved' AND NEW.status != 'approved') OR 
     (OLD.status != 'approved' AND NEW.status = 'approved') THEN
    
    FOR participant_record IN 
      SELECT DISTINCT player_id 
      FROM match_participants 
      WHERE match_id = NEW.id
    LOOP
      PERFORM recalculate_player_stats(participant_record.player_id);
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for match status changes
DROP TRIGGER IF EXISTS on_match_status_change ON matches;
CREATE TRIGGER on_match_status_change
  AFTER UPDATE OF status ON matches
  FOR EACH ROW
  EXECUTE FUNCTION handle_match_status_change();