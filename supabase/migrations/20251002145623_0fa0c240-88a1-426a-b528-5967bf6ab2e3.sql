-- Create function to safely clear all match history for beta testing
CREATE OR REPLACE FUNCTION public.clear_all_match_history()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Delete contested matches first (references matches)
  DELETE FROM contested_matches;
  
  -- Delete match approvals (references matches)
  DELETE FROM match_approvals;
  
  -- Delete match participants (references matches)
  DELETE FROM match_participants;
  
  -- Delete all matches
  DELETE FROM matches;
  
  -- Reset all player profiles to initial state
  UPDATE profiles
  SET 
    current_rating = 3.00,
    week_start_rating = 3.00,
    week_start_date = CURRENT_DATE,
    total_matches = 0,
    wins = 0,
    losses = 0,
    total_points_for = 0,
    total_points_against = 0,
    avg_opponent_rating = 3.00,
    last_rating_update = NOW(),
    updated_at = NOW();
END;
$function$;

-- Create authenticated wrapper function
CREATE OR REPLACE FUNCTION public.clear_all_match_history_authenticated()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only allow authenticated users to trigger cleanup
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  PERFORM clear_all_match_history();
END;
$function$;