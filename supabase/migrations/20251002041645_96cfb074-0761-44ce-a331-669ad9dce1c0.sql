-- Drop and recreate recalculate_all_ratings to use cumulative model
DROP FUNCTION IF EXISTS public.recalculate_current_ratings();
DROP FUNCTION IF EXISTS public.recompute_ratings_from_week(date);

-- New function: Recalculate ALL ratings using cumulative model
CREATE OR REPLACE FUNCTION public.recalculate_all_ratings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  match_record RECORD;
  player_record RECORD;
  
  -- Rating calculation variables
  p1_id UUID;
  p2_id UUID;
  p3_id UUID;
  p4_id UUID;
  
  p1_rating NUMERIC;
  p2_rating NUMERIC;
  p3_rating NUMERIC;
  p4_rating NUMERIC;
  
  p1_matches INTEGER;
  p2_matches INTEGER;
  p3_matches INTEGER;
  p4_matches INTEGER;
  
  rating_change NUMERIC;
  current_week DATE;
BEGIN
  current_week := get_week_start(CURRENT_DATE);
  
  -- Reset all players to starting rating
  UPDATE profiles
  SET current_rating = 3.00,
      week_start_rating = 3.00,
      week_start_date = current_week;
  
  -- Process ALL approved matches in strict chronological order (timestamp order, tie-break by ID)
  FOR match_record IN 
    SELECT 
      m.id as match_id,
      m.match_date,
      m.team1_score,
      m.team2_score,
      m.match_type,
      m.week_start,
      m.created_at,
      array_agg(mp.player_id ORDER BY mp.team, mp.id) as player_ids,
      array_agg(mp.team ORDER BY mp.team, mp.id) as teams
    FROM matches m
    JOIN match_participants mp ON mp.match_id = m.id
    WHERE m.status = 'approved'
    GROUP BY m.id, m.match_date, m.team1_score, m.team2_score, m.match_type, m.week_start, m.created_at
    HAVING COUNT(*) = 4
    ORDER BY m.match_date, m.created_at, m.id
  LOOP
    -- Get player IDs
    p1_id := match_record.player_ids[1];
    p2_id := match_record.player_ids[2];
    p3_id := match_record.player_ids[3];
    p4_id := match_record.player_ids[4];
    
    -- Get CURRENT cumulative rating for each player (their last rating_after, or 3.00 if none)
    SELECT COALESCE(
      (SELECT mp.rating_after 
       FROM match_participants mp
       JOIN matches m ON mp.match_id = m.id
       WHERE mp.player_id = p1_id
         AND m.status = 'approved'
         AND (m.match_date < match_record.match_date 
              OR (m.match_date = match_record.match_date AND m.created_at < match_record.created_at)
              OR (m.match_date = match_record.match_date AND m.created_at = match_record.created_at AND m.id < match_record.match_id))
       ORDER BY m.match_date DESC, m.created_at DESC, m.id DESC
       LIMIT 1),
      3.00
    ), p.total_matches INTO p1_rating, p1_matches
    FROM profiles p WHERE p.id = p1_id;
    
    SELECT COALESCE(
      (SELECT mp.rating_after 
       FROM match_participants mp
       JOIN matches m ON mp.match_id = m.id
       WHERE mp.player_id = p2_id
         AND m.status = 'approved'
         AND (m.match_date < match_record.match_date 
              OR (m.match_date = match_record.match_date AND m.created_at < match_record.created_at)
              OR (m.match_date = match_record.match_date AND m.created_at = match_record.created_at AND m.id < match_record.match_id))
       ORDER BY m.match_date DESC, m.created_at DESC, m.id DESC
       LIMIT 1),
      3.00
    ), p.total_matches INTO p2_rating, p2_matches
    FROM profiles p WHERE p.id = p2_id;
    
    SELECT COALESCE(
      (SELECT mp.rating_after 
       FROM match_participants mp
       JOIN matches m ON mp.match_id = m.id
       WHERE mp.player_id = p3_id
         AND m.status = 'approved'
         AND (m.match_date < match_record.match_date 
              OR (m.match_date = match_record.match_date AND m.created_at < match_record.created_at)
              OR (m.match_date = match_record.match_date AND m.created_at = match_record.created_at AND m.id < match_record.match_id))
       ORDER BY m.match_date DESC, m.created_at DESC, m.id DESC
       LIMIT 1),
      3.00
    ), p.total_matches INTO p3_rating, p3_matches
    FROM profiles p WHERE p.id = p3_id;
    
    SELECT COALESCE(
      (SELECT mp.rating_after 
       FROM match_participants mp
       JOIN matches m ON mp.match_id = m.id
       WHERE mp.player_id = p4_id
         AND m.status = 'approved'
         AND (m.match_date < match_record.match_date 
              OR (m.match_date = match_record.match_date AND m.created_at < match_record.created_at)
              OR (m.match_date = match_record.match_date AND m.created_at = match_record.created_at AND m.id < match_record.match_id))
       ORDER BY m.match_date DESC, m.created_at DESC, m.id DESC
       LIMIT 1),
      3.00
    ), p.total_matches INTO p4_rating, p4_matches
    FROM profiles p WHERE p.id = p4_id;
    
    -- Calculate rating change using cumulative ratings (not week_start)
    rating_change := calculate_pulse_rating_change(
      p1_rating, p2_rating, p3_rating, p4_rating,
      match_record.team1_score, match_record.team2_score,
      match_record.team1_score > match_record.team2_score,
      match_record.match_type,
      p1_matches
    );
    
    -- Update match participants with rating changes (cumulative model)
    UPDATE match_participants
    SET 
      rating_before = p1_rating,
      rating_after = p1_rating + rating_change,
      rating_change = rating_change
    WHERE match_id = match_record.match_id AND player_id = p1_id;
    
    UPDATE match_participants
    SET 
      rating_before = p2_rating,
      rating_after = p2_rating + rating_change,
      rating_change = rating_change
    WHERE match_id = match_record.match_id AND player_id = p2_id;
    
    UPDATE match_participants
    SET 
      rating_before = p3_rating,
      rating_after = p3_rating - rating_change,
      rating_change = -rating_change
    WHERE match_id = match_record.match_id AND player_id = p3_id;
    
    UPDATE match_participants
    SET 
      rating_before = p4_rating,
      rating_after = p4_rating - rating_change,
      rating_change = -rating_change
    WHERE match_id = match_record.match_id AND player_id = p4_id;
    
    -- Update current_rating (live cumulative rating)
    UPDATE profiles SET current_rating = p1_rating + rating_change WHERE id = p1_id;
    UPDATE profiles SET current_rating = p2_rating + rating_change WHERE id = p2_id;
    UPDATE profiles SET current_rating = p3_rating - rating_change WHERE id = p3_id;
    UPDATE profiles SET current_rating = p4_rating - rating_change WHERE id = p4_id;
  END LOOP;
  
  -- Now set week_start_rating as a SNAPSHOT (for display only, not used in calc)
  FOR player_record IN SELECT id FROM profiles
  LOOP
    UPDATE profiles
    SET week_start_rating = COALESCE(
      (SELECT mp.rating_after
       FROM match_participants mp
       JOIN matches m ON mp.match_id = m.id
       WHERE mp.player_id = player_record.id
         AND m.status = 'approved'
         AND m.week_start < current_week
       ORDER BY m.match_date DESC, m.created_at DESC, m.id DESC
       LIMIT 1),
      3.00
    ),
    week_start_date = current_week
    WHERE id = player_record.id;
  END LOOP;
  
  -- Recalculate all player stats (total matches, wins, losses, points)
  PERFORM recalculate_all_player_stats();
END;
$$;

-- Update the match insert/update triggers to call the new function
CREATE OR REPLACE FUNCTION public.handle_match_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Recalculate all ratings when a new match is added
  IF NEW.status = 'approved' THEN
    PERFORM recalculate_all_ratings();
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_match_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Recalculate all ratings if status changed from or to approved
  IF (OLD.status = 'approved' AND NEW.status != 'approved') OR 
     (OLD.status != 'approved' AND NEW.status = 'approved') THEN
    PERFORM recalculate_all_ratings();
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_match_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Recalculate all ratings when a match is deleted
  PERFORM recalculate_all_ratings();
  RETURN OLD;
END;
$$;