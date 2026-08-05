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
  SELECT COALESCE(mp.rating_after, 3.00)
  INTO v_current_rating
  FROM match_participants mp
  JOIN matches m ON mp.match_id = m.id
  WHERE mp.player_id = p_player_id
    AND m.status = 'approved'
    AND COALESCE(m.voided, false) = false
  ORDER BY m.match_date DESC, m.created_at DESC
  LIMIT 1;

  SELECT COUNT(DISTINCT mp.match_id)
  INTO v_total_matches
  FROM match_participants mp
  JOIN matches m ON mp.match_id = m.id
  WHERE mp.player_id = p_player_id
    AND m.status = 'approved'
    AND COALESCE(m.voided, false) = false;

  SELECT COUNT(DISTINCT mp.match_id)
  INTO v_wins
  FROM match_participants mp
  JOIN matches m ON mp.match_id = m.id
  WHERE mp.player_id = p_player_id
    AND m.status = 'approved'
    AND COALESCE(m.voided, false) = false
    AND (
      (mp.team = 1 AND m.team1_score > m.team2_score)
      OR (mp.team = 2 AND m.team2_score > m.team1_score)
    );

  v_losses := v_total_matches - v_wins;

  SELECT
    COALESCE(SUM(CASE WHEN mp.team = 1 THEN m.team1_score ELSE m.team2_score END), 0),
    COALESCE(SUM(CASE WHEN mp.team = 1 THEN m.team2_score ELSE m.team1_score END), 0)
  INTO v_points_for, v_points_against
  FROM match_participants mp
  JOIN matches m ON mp.match_id = m.id
  WHERE mp.player_id = p_player_id
    AND m.status = 'approved'
    AND COALESCE(m.voided, false) = false;

  UPDATE profiles
  SET
    current_rating = COALESCE(v_current_rating, current_rating),
    total_matches = v_total_matches,
    wins = v_wins,
    losses = v_losses,
    total_points_for = v_points_for,
    total_points_against = v_points_against,
    updated_at = NOW()
  WHERE id = p_player_id;
END;
$$;

COMMENT ON FUNCTION public.recalculate_player_stats IS
  'Player win/loss/points from approved, non-voided matches. Wins counted by SCORE (not rating direction), so placement and non-ranked games are counted correctly and the record matches the Matches page.';

SELECT public.recalculate_all_player_stats();