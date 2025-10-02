-- Fix the recalculate_current_ratings function to use WHERE clauses
CREATE OR REPLACE FUNCTION public.recalculate_current_ratings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  match_record RECORD;
  current_week date;
  player_record RECORD;
  
  -- Rating calculation variables
  p1_rating NUMERIC;
  p2_rating NUMERIC;
  p3_rating NUMERIC;
  p4_rating NUMERIC;
  rating_change NUMERIC;
  
  p1_matches INTEGER;
  p2_matches INTEGER;
  p3_matches INTEGER;
  p4_matches INTEGER;
  
  p1_week_start NUMERIC;
  p2_week_start NUMERIC;
  p3_week_start NUMERIC;
  p4_week_start NUMERIC;
BEGIN
  current_week := get_week_start(CURRENT_DATE);
  
  -- Reset all players' current_rating to their week_start_rating with WHERE clauses
  FOR player_record IN SELECT id, week_start_rating FROM profiles
  LOOP
    UPDATE profiles
    SET current_rating = player_record.week_start_rating
    WHERE id = player_record.id;
  END LOOP;
  
  -- Process all matches in the current week in chronological order
  FOR match_record IN 
    SELECT 
      m.id as match_id,
      m.match_date,
      m.team1_score,
      m.team2_score,
      m.match_type,
      m.week_start,
      array_agg(mp.player_id ORDER BY mp.team, mp.id) as player_ids,
      array_agg(mp.team ORDER BY mp.team, mp.id) as teams
    FROM matches m
    JOIN match_participants mp ON mp.match_id = m.id
    WHERE m.status = 'approved'
      AND m.week_start = current_week
    GROUP BY m.id, m.match_date, m.team1_score, m.team2_score, m.match_type, m.week_start
    HAVING COUNT(*) = 4
    ORDER BY m.match_date, m.created_at
  LOOP
    -- Get current ratings (which start as week_start_rating) for all 4 players
    SELECT p.current_rating, p.week_start_rating, p.total_matches 
    INTO p1_rating, p1_week_start, p1_matches
    FROM profiles p WHERE p.id = match_record.player_ids[1];
    
    SELECT p.current_rating, p.week_start_rating, p.total_matches 
    INTO p2_rating, p2_week_start, p2_matches
    FROM profiles p WHERE p.id = match_record.player_ids[2];
    
    SELECT p.current_rating, p.week_start_rating, p.total_matches 
    INTO p3_rating, p3_week_start, p3_matches
    FROM profiles p WHERE p.id = match_record.player_ids[3];
    
    SELECT p.current_rating, p.week_start_rating, p.total_matches 
    INTO p4_rating, p4_week_start, p4_matches
    FROM profiles p WHERE p.id = match_record.player_ids[4];
    
    -- Calculate rating change based on week_start ratings
    rating_change := calculate_pulse_rating_change(
      p1_week_start, p2_week_start, p3_week_start, p4_week_start,
      match_record.team1_score, match_record.team2_score,
      match_record.team1_score > match_record.team2_score,
      match_record.match_type,
      p1_matches
    );
    
    -- Update match participants with rating calculations
    UPDATE match_participants mp
    SET 
      rating_before = p1_week_start,
      rating_after = p1_week_start + rating_change,
      rating_change = rating_change
    WHERE mp.match_id = match_record.match_id AND mp.player_id = match_record.player_ids[1];
    
    UPDATE match_participants mp
    SET 
      rating_before = p2_week_start,
      rating_after = p2_week_start + rating_change,
      rating_change = rating_change
    WHERE mp.match_id = match_record.match_id AND mp.player_id = match_record.player_ids[2];
    
    UPDATE match_participants mp
    SET 
      rating_before = p3_week_start,
      rating_after = p3_week_start - rating_change,
      rating_change = -rating_change
    WHERE mp.match_id = match_record.match_id AND mp.player_id = match_record.player_ids[3];
    
    UPDATE match_participants mp
    SET 
      rating_before = p4_week_start,
      rating_after = p4_week_start - rating_change,
      rating_change = -rating_change
    WHERE mp.match_id = match_record.match_id AND mp.player_id = match_record.player_ids[4];
    
    -- Update ONLY current_rating (not week_start_rating - that stays official)
    UPDATE profiles SET current_rating = p1_rating + rating_change WHERE id = match_record.player_ids[1];
    UPDATE profiles SET current_rating = p2_rating + rating_change WHERE id = match_record.player_ids[2];
    UPDATE profiles SET current_rating = p3_rating - rating_change WHERE id = match_record.player_ids[3];
    UPDATE profiles SET current_rating = p4_rating - rating_change WHERE id = match_record.player_ids[4];
  END LOOP;
  
  -- Recalculate all player stats (total matches, wins, losses, etc.)
  PERFORM recalculate_all_player_stats();
END;
$function$;