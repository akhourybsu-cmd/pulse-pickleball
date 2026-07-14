-- Slice 2a corrective (additive): exclude voided matches from player-stat
-- aggregates.
--
-- Bug: public.recalculate_player_stats() filtered only `status = 'approved'`,
-- so a voided match still inflated total_matches / wins / losses /
-- total_points_for / total_points_against on the profile. PULSE *rating*
-- recompute already excludes voided (recalculate_all_ratings), but this
-- profile-stats path did not — producing user-visible stat/leaderboard drift.
--
-- Fix: add `AND COALESCE(m.voided, false) = false` to every match scan. This
-- is a straight CREATE OR REPLACE of the existing function body with only the
-- voided predicate added; no signature, security, or behavior change beyond
-- the exclusion. Idempotent and safe to re-run.
--
-- NOTE (out of scope, tracked separately): wins are still derived from
-- `rating_change > 0`, which mislabels zero/null-delta wins. That is a
-- pre-existing issue and is intentionally NOT changed here to keep this
-- corrective minimal and reviewable.

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
  -- Most recent approved, non-voided match rating, or default 3.00.
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
    AND mp.rating_change > 0;

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
