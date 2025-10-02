-- Fix the recompute_ratings_from_week function to properly qualify column references
CREATE OR REPLACE FUNCTION public.recompute_ratings_from_week(start_week date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  match_record RECORD;
  week_cursor date;
  current_week date;
  
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
BEGIN
  -- Get distinct weeks that need recomputation
  week_cursor := start_week;
  current_week := get_week_start(CURRENT_DATE);
  
  -- Loop through each week from start_week to current week
  WHILE week_cursor <= current_week LOOP
    -- Freeze ratings at the start of this week
    PERFORM freeze_week_ratings(week_cursor);
    
    -- Process all matches in this week in chronological order
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
        AND m.week_start = week_cursor
      GROUP BY m.id, m.match_date, m.team1_score, m.team2_score, m.match_type, m.week_start
      HAVING COUNT(*) = 4
      ORDER BY m.match_date, m.created_at
    LOOP
      -- Get week-start ratings for all 4 players with fully qualified column names
      SELECT p.week_start_rating, p.total_matches INTO p1_rating, p1_matches
      FROM profiles p WHERE p.id = match_record.player_ids[1];
      
      SELECT p.week_start_rating, p.total_matches INTO p2_rating, p2_matches
      FROM profiles p WHERE p.id = match_record.player_ids[2];
      
      SELECT p.week_start_rating, p.total_matches INTO p3_rating, p3_matches
      FROM profiles p WHERE p.id = match_record.player_ids[3];
      
      SELECT p.week_start_rating, p.total_matches INTO p4_rating, p4_matches
      FROM profiles p WHERE p.id = match_record.player_ids[4];
      
      -- Calculate rating change for team 1 players
      rating_change := calculate_pulse_rating_change(
        p1_rating, p2_rating, p3_rating, p4_rating,
        match_record.team1_score, match_record.team2_score,
        match_record.team1_score > match_record.team2_score,
        match_record.match_type,
        p1_matches
      );
      
      -- Update match participants with new rating changes
      UPDATE match_participants mp
      SET 
        rating_before = p1_rating,
        rating_after = p1_rating + rating_change,
        rating_change = rating_change
      WHERE mp.match_id = match_record.match_id AND mp.player_id = match_record.player_ids[1];
      
      UPDATE match_participants mp
      SET 
        rating_before = p2_rating,
        rating_after = p2_rating + rating_change,
        rating_change = rating_change
      WHERE mp.match_id = match_record.match_id AND mp.player_id = match_record.player_ids[2];
      
      UPDATE match_participants mp
      SET 
        rating_before = p3_rating,
        rating_after = p3_rating - rating_change,
        rating_change = -rating_change
      WHERE mp.match_id = match_record.match_id AND mp.player_id = match_record.player_ids[3];
      
      UPDATE match_participants mp
      SET 
        rating_before = p4_rating,
        rating_after = p4_rating - rating_change,
        rating_change = -rating_change
      WHERE mp.match_id = match_record.match_id AND mp.player_id = match_record.player_ids[4];
      
      -- Update current_rating in profiles (live rating, not week-start)
      UPDATE profiles SET current_rating = p1_rating + rating_change WHERE id = match_record.player_ids[1];
      UPDATE profiles SET current_rating = p2_rating + rating_change WHERE id = match_record.player_ids[2];
      UPDATE profiles SET current_rating = p3_rating - rating_change WHERE id = match_record.player_ids[3];
      UPDATE profiles SET current_rating = p4_rating - rating_change WHERE id = match_record.player_ids[4];
    END LOOP;
    
    -- Move to next week
    week_cursor := week_cursor + 7;
  END LOOP;
  
  -- Recalculate all player stats (including total matches)
  PERFORM recalculate_all_player_stats();
END;
$function$;