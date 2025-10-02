-- Add week_start column to matches table to track which week each match belongs to
ALTER TABLE matches ADD COLUMN IF NOT EXISTS week_start date;

-- Function to get the Monday 00:00 of the week for a given date
CREATE OR REPLACE FUNCTION get_week_start(match_date date)
RETURNS date
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (match_date - (EXTRACT(DOW FROM match_date)::integer + 6) % 7)::date;
$$;

-- Function to freeze ratings at week boundaries
-- This should be called when a new week starts or when backfilling
CREATE OR REPLACE FUNCTION freeze_week_ratings(target_week_start date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  player_record RECORD;
  last_rating NUMERIC;
BEGIN
  -- For each player, set their week_start_rating to their rating at the end of the previous week
  FOR player_record IN SELECT id FROM profiles
  LOOP
    -- Get the player's rating after all matches before this week
    SELECT COALESCE(mp.rating_after, 3.00)
    INTO last_rating
    FROM match_participants mp
    JOIN matches m ON mp.match_id = m.id
    WHERE mp.player_id = player_record.id
      AND m.status = 'approved'
      AND m.week_start < target_week_start
    ORDER BY m.match_date DESC, m.created_at DESC
    LIMIT 1;

    -- If no rating found (new player), default to 3.00
    last_rating := COALESCE(last_rating, 3.00);

    -- Update the player's week_start_rating and week_start_date
    UPDATE profiles
    SET 
      week_start_rating = last_rating,
      week_start_date = target_week_start,
      updated_at = NOW()
    WHERE id = player_record.id;
  END LOOP;
END;
$$;

-- Function to recompute ratings from a specific week forward
CREATE OR REPLACE FUNCTION recompute_ratings_from_week(start_week date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  match_record RECORD;
  week_cursor date;
  current_week date;
  player_ids uuid[];
  player_id uuid;
  
  -- Rating calculation variables
  p1_rating NUMERIC;
  p2_rating NUMERIC;
  p3_rating NUMERIC;
  p4_rating NUMERIC;
  team1_avg NUMERIC;
  team2_avg NUMERIC;
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
      HAVING COUNT(*) = 4  -- Doubles only: must have exactly 4 players
      ORDER BY m.match_date, m.created_at
    LOOP
      -- Get the 4 player IDs (2 per team)
      player_ids := match_record.player_ids;
      
      -- Get week-start ratings for all 4 players
      SELECT week_start_rating, total_matches INTO p1_rating, p1_matches
      FROM profiles WHERE id = player_ids[1];
      
      SELECT week_start_rating, total_matches INTO p2_rating, p2_matches
      FROM profiles WHERE id = player_ids[2];
      
      SELECT week_start_rating, total_matches INTO p3_rating, p3_matches
      FROM profiles WHERE id = player_ids[3];
      
      SELECT week_start_rating, total_matches INTO p4_rating, p4_matches
      FROM profiles WHERE id = player_ids[4];
      
      -- Calculate team averages
      team1_avg := (p1_rating + p2_rating) / 2.0;
      team2_avg := (p3_rating + p4_rating) / 2.0;
      
      -- Calculate rating change for team 1 players
      rating_change := calculate_pulse_rating_change(
        p1_rating, p2_rating, p3_rating, p4_rating,
        match_record.team1_score, match_record.team2_score,
        match_record.team1_score > match_record.team2_score,
        match_record.match_type,
        p1_matches
      );
      
      -- Update match participants with new rating changes
      -- Team 1 players (winners or losers)
      UPDATE match_participants
      SET 
        rating_before = p1_rating,
        rating_after = p1_rating + rating_change,
        rating_change = rating_change
      WHERE match_id = match_record.match_id AND player_id = player_ids[1];
      
      UPDATE match_participants
      SET 
        rating_before = p2_rating,
        rating_after = p2_rating + rating_change,
        rating_change = rating_change
      WHERE match_id = match_record.match_id AND player_id = player_ids[2];
      
      -- Team 2 players (opposite result)
      UPDATE match_participants
      SET 
        rating_before = p3_rating,
        rating_after = p3_rating - rating_change,
        rating_change = -rating_change
      WHERE match_id = match_record.match_id AND player_id = player_ids[3];
      
      UPDATE match_participants
      SET 
        rating_before = p4_rating,
        rating_after = p4_rating - rating_change,
        rating_change = -rating_change
      WHERE match_id = match_record.match_id AND player_id = player_ids[4];
      
      -- Update current_rating in profiles (live rating, not week-start)
      UPDATE profiles SET current_rating = p1_rating + rating_change WHERE id = player_ids[1];
      UPDATE profiles SET current_rating = p2_rating + rating_change WHERE id = player_ids[2];
      UPDATE profiles SET current_rating = p3_rating - rating_change WHERE id = player_ids[3];
      UPDATE profiles SET current_rating = p4_rating - rating_change WHERE id = player_ids[4];
    END LOOP;
    
    -- Move to next week
    week_cursor := week_cursor + 7;
  END LOOP;
  
  -- Recalculate all player stats
  PERFORM recalculate_all_player_stats();
END;
$$;

-- Trigger to automatically set week_start when a match is inserted
CREATE OR REPLACE FUNCTION set_match_week_start()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.week_start := get_week_start(NEW.match_date);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_match_week_start_trigger ON matches;
CREATE TRIGGER set_match_week_start_trigger
  BEFORE INSERT OR UPDATE OF match_date ON matches
  FOR EACH ROW
  EXECUTE FUNCTION set_match_week_start();