-- =====================================================================
-- New-player self-assessment during onboarding
--
-- Adds `profiles.initial_self_rating` — a one-shot seed value the
-- player picks during onboarding (2.0 = brand new, 4.5 = advanced).
-- Everywhere the recalc previously fell back to the hardcoded 3.00
-- starting rating, it now falls back to `COALESCE(initial_self_rating,
-- 3.00)`. So:
--   • players who pick a level start there and calibrate faster,
--   • players who skip stay at 3.00 exactly as before.
--
-- This migration REDEFINES `recalculate_all_ratings` with the same body
-- as 20260703120000 (the algorithm-correctness fixes) plus the new
-- fallback. If Supabase applies these two migrations in timestamp
-- order (which it does), the later definition wins and everything is
-- consistent. If they land on main in either merge order, the newer
-- timestamp still wins — safe against merge ordering.
--
-- Fully additive: an existing player whose initial_self_rating stays
-- NULL sees no behavior change. Only new signups who choose a level
-- get the different starting rating.
-- =====================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS initial_self_rating NUMERIC
    CHECK (initial_self_rating IS NULL
        OR (initial_self_rating >= 2.0 AND initial_self_rating <= 5.5));

COMMENT ON COLUMN public.profiles.initial_self_rating IS
  'One-shot self-assessment set during onboarding. Used as the starting '
  'rating in recalculate_all_ratings. Never re-editable by the player '
  '(would let them re-seed after a losing streak).';


CREATE OR REPLACE FUNCTION public.recalculate_all_ratings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  match_record  RECORD;
  player_record RECORD;
  v_params      RECORD;
  p_ids         UUID[];
  p_teams       INT[];
  p_ratings     NUMERIC[] := ARRAY[NULL, NULL, NULL, NULL]::NUMERIC[];
  p_matches     INT[]     := ARRAY[0, 0, 0, 0];
  i             INT;
  j             INT;
  v_my_team     INT;
  v_won         BOOLEAN;
  v_my_score    INT;
  v_opp_score   INT;
  v_my_partner  NUMERIC;
  v_my_opps     NUMERIC[];
  v_delta       NUMERIC;
  v_new_rating  NUMERIC;
  v_snap_rating NUMERIC;
  v_snap_count  INT;
  current_week  DATE;
BEGIN
  SELECT * INTO v_params
    FROM rating_parameters
   WHERE id = '00000000-0000-0000-0000-000000000001';

  current_week := get_week_start(CURRENT_DATE);

  -- Reset every profile back to their starting rating: their self-
  -- assessed level if they picked one, otherwise 3.00 (unchanged
  -- behavior for players who never set a self rating).
  UPDATE profiles
     SET current_rating    = COALESCE(initial_self_rating, 3.00),
         week_start_rating = COALESCE(initial_self_rating, 3.00),
         week_start_date   = current_week
   WHERE id IS NOT NULL;

  FOR match_record IN
    SELECT m.id AS match_id, m.match_date, m.team1_score, m.team2_score,
           m.match_type, m.week_start, m.created_at,
           array_agg(mp.player_id ORDER BY mp.team, mp.id) AS player_ids,
           array_agg(mp.team      ORDER BY mp.team, mp.id) AS teams
      FROM matches m
      JOIN match_participants mp ON mp.match_id = m.id
     WHERE m.status = 'approved'
       AND COALESCE(m.voided, false) = false
       AND COALESCE(m.count_for_rating, true) = true
     GROUP BY m.id
     HAVING COUNT(*) = 4
        AND bool_and(mp.player_id IS NOT NULL)
     ORDER BY m.match_date, m.created_at, m.id
  LOOP
    p_ids   := match_record.player_ids;
    p_teams := match_record.teams;

    FOR i IN 1..4 LOOP
      -- Prior rating_after if any, otherwise the player's starting
      -- rating (self-assessment or 3.00). initial_self_rating is
      -- stable across the loop, so this fallback is safe.
      SELECT COALESCE(
        (SELECT mp_sub.rating_after
           FROM match_participants mp_sub
           JOIN matches m_sub ON mp_sub.match_id = m_sub.id
          WHERE mp_sub.player_id = p_ids[i]
            AND m_sub.status = 'approved'
            AND COALESCE(m_sub.voided, false) = false
            AND COALESCE(m_sub.count_for_rating, true) = true
            AND (m_sub.match_date <  match_record.match_date
              OR (m_sub.match_date = match_record.match_date AND m_sub.created_at <  match_record.created_at)
              OR (m_sub.match_date = match_record.match_date AND m_sub.created_at = match_record.created_at AND m_sub.id < match_record.match_id))
          ORDER BY m_sub.match_date DESC, m_sub.created_at DESC, m_sub.id DESC
          LIMIT 1),
        (SELECT COALESCE(initial_self_rating, 3.00)
           FROM profiles
          WHERE id = p_ids[i]))
      INTO v_snap_rating;
      p_ratings[i] := v_snap_rating;

      SELECT COUNT(*)::INT
        FROM match_participants mp_sub
        JOIN matches m_sub ON mp_sub.match_id = m_sub.id
       WHERE mp_sub.player_id = p_ids[i]
         AND m_sub.status = 'approved'
         AND COALESCE(m_sub.voided, false) = false
         AND COALESCE(m_sub.count_for_rating, true) = true
         AND (m_sub.match_date <  match_record.match_date
           OR (m_sub.match_date = match_record.match_date AND m_sub.created_at <  match_record.created_at)
           OR (m_sub.match_date = match_record.match_date AND m_sub.created_at = match_record.created_at AND m_sub.id < match_record.match_id))
      INTO v_snap_count;
      p_matches[i] := v_snap_count;
    END LOOP;

    FOR i IN 1..4 LOOP
      v_my_team := p_teams[i];
      v_won := (v_my_team = 1 AND match_record.team1_score > match_record.team2_score)
            OR (v_my_team = 2 AND match_record.team2_score > match_record.team1_score);
      v_my_score  := CASE v_my_team WHEN 1 THEN match_record.team1_score ELSE match_record.team2_score END;
      v_opp_score := CASE v_my_team WHEN 1 THEN match_record.team2_score ELSE match_record.team1_score END;

      v_my_partner := NULL;
      v_my_opps    := ARRAY[]::NUMERIC[];
      FOR j IN 1..4 LOOP
        IF j = i THEN CONTINUE; END IF;
        IF p_teams[j] = v_my_team THEN
          v_my_partner := p_ratings[j];
        ELSE
          v_my_opps := array_append(v_my_opps, p_ratings[j]);
        END IF;
      END LOOP;

      v_delta := calculate_pulse_rating_change(
        p_ratings[i],
        COALESCE(v_my_partner, p_ratings[i]),
        v_my_opps[1],
        v_my_opps[2],
        v_my_score, v_opp_score, v_won,
        match_record.match_type,
        p_matches[i]
      );

      v_new_rating := LEAST(v_params.clamp_max,
                        GREATEST(v_params.clamp_min, p_ratings[i] + v_delta));
      v_delta := v_new_rating - p_ratings[i];

      UPDATE match_participants
         SET rating_before = p_ratings[i],
             rating_after  = v_new_rating,
             rating_change = v_delta
       WHERE match_id = match_record.match_id
         AND player_id = p_ids[i];

      UPDATE profiles
         SET current_rating = v_new_rating
       WHERE id = p_ids[i];
    END LOOP;
  END LOOP;

  -- Week-start rating: prior week's last rating_after if any, otherwise
  -- fall back to the player's starting rating.
  FOR player_record IN SELECT id FROM profiles LOOP
    UPDATE profiles p
       SET week_start_rating = COALESCE(
             (SELECT mp_sub.rating_after
                FROM match_participants mp_sub
                JOIN matches m_sub ON mp_sub.match_id = m_sub.id
               WHERE mp_sub.player_id = player_record.id
                 AND m_sub.status = 'approved'
                 AND COALESCE(m_sub.voided, false) = false
                 AND COALESCE(m_sub.count_for_rating, true) = true
                 AND m_sub.week_start < current_week
               ORDER BY m_sub.match_date DESC, m_sub.created_at DESC, m_sub.id DESC
               LIMIT 1),
             COALESCE(p.initial_self_rating, 3.00)),
           week_start_date = current_week
     WHERE p.id = player_record.id;
  END LOOP;

  PERFORM recalculate_all_player_stats();
END;
$function$;


-- Rebuild ratings once so any players who set initial_self_rating
-- before the recalc trigger fires next take effect immediately.
SELECT public.recalculate_all_ratings();
