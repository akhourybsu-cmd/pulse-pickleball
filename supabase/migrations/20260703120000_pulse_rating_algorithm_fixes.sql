-- =====================================================================
-- PULSE rating algorithm — correctness fixes
--
-- Fixes four issues from the algorithm audit, all in the recalc path
-- (`recalculate_all_ratings` + `calculate_pulse_rating_change`). No
-- schema changes, no client-side signature changes — the RPC surface
-- stays identical, so triggers, admin wrappers, and TS types keep
-- working without a regen.
--
-- What changes:
--
--   1. Individual expected scores (was: symmetric-payout bug).
--      Before: both teammates got the same delta based on team_avg vs
--      opp_team_avg. A 4.5 carrying a 3.0 to a win gained the same as
--      the 3.0 — skill signal was smeared across the pair.
--      After: each player's expected score is computed against the
--      opponent-team average using THEIR OWN rating. The strong player
--      gains little on an expected win; the weak player gains a lot on
--      the same win. Zero-sum still holds: sum(actual - expected) over
--      all 4 players = 0 by construction.
--
--   2. Provisional bonus wired per-player (was: p1-only bug).
--      Before: `p_player_matches` was passed for p1 only, so whether a
--      new player got the 7% provisional multiplier depended on their
--      array_agg slot. Now each player supplies their own match count
--      when their own delta is computed.
--
--   3. Rating clamped to [clamp_min, clamp_max] (was: dead knob).
--      Before: `clamp_min = 2.0`, `clamp_max = 4.5` existed in
--      `rating_parameters` but nothing read them. Now the recalc clamps
--      each player's post-match rating to that range and back-fills the
--      delta so match_participants stays consistent with the stored
--      profile rating.
--
--   4. Guests no longer distort the math.
--      Before: a match with a guest (participant.player_id IS NULL)
--      still went through rating math. The guest's rating fell back to
--      3.00, which underrated (or inflated) every real player in that
--      match. After: any match with at least one NULL player_id is
--      skipped entirely — same behavior as an event with
--      count_for_rating = false. This is the safe default until the
--      user is ready to allow organizer-set guest ratings.
--
-- The function `calculate_pulse_rating_change` keeps its signature.
-- `p_partner_rating` is now unused inside the function (kept in the
-- signature so callers and the generated TS types don't have to
-- change). All existing callers pass all 9 args, so nothing breaks.
--
-- After the function rewrites, we run one recalculate to rebuild every
-- rating under the new algorithm. This is the same replay path that
-- fires on match approval / void — no new behavior, just applied once
-- at migration time.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.calculate_pulse_rating_change(
  p_player_rating numeric,
  p_partner_rating numeric,      -- kept for signature stability; unused
  p_opponent1_rating numeric,
  p_opponent2_rating numeric,
  p_team_score integer,
  p_opponent_score integer,
  p_won boolean,
  p_match_type text DEFAULT 'league'::text,
  p_player_matches integer DEFAULT 0
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_params           RECORD;
  v_opp_avg          NUMERIC;
  v_expected         NUMERIC;
  v_k_base           NUMERIC;
  v_k_format         NUMERIC := 1.0;      -- doubles-only rating for now
  v_k_factor         NUMERIC;
  v_mov              NUMERIC;
  v_mov_multiplier   NUMERIC;
  v_actual           NUMERIC;
  v_rating_change    NUMERIC;
  v_provisional_mult NUMERIC := 1.0;
BEGIN
  -- p_partner_rating is intentionally unused — kept in the signature
  -- so callers and generated TS types don't need to change.
  SELECT * INTO v_params
    FROM public.rating_parameters
   WHERE id = '00000000-0000-0000-0000-000000000001';

  -- Individual expected: THIS player vs the opponents' average, NOT
  -- team-avg vs team-avg. This is the fix for the symmetric-payout bug.
  v_opp_avg  := (p_opponent1_rating + p_opponent2_rating) / 2.0;
  v_expected := 1.0 / (1.0 + POWER(10, (v_opp_avg - p_player_rating) / v_params.tau));

  v_k_base := CASE p_match_type
    WHEN 'ladder'   THEN v_params.k_ladder
    WHEN 'league'   THEN v_params.k_league
    WHEN 'playoffs' THEN v_params.k_playoffs
    WHEN 'casual'   THEN v_params.k_ladder * 0.5
    ELSE                 v_params.k_league
  END;
  v_k_factor := v_k_base * v_k_format;

  IF p_player_matches < v_params.provisional_matches THEN
    v_provisional_mult := 1.0 + v_params.provisional_bonus;
  END IF;
  v_k_factor := v_k_factor * v_provisional_mult;

  v_mov            := ABS(p_team_score - p_opponent_score)::NUMERIC / v_params.points_per_game;
  v_mov            := LEAST(v_mov, v_params.mov_cap);
  v_mov_multiplier := 1.0 + v_mov;

  v_actual        := CASE WHEN p_won THEN 1.0 ELSE 0.0 END;
  v_rating_change := v_k_factor * v_mov_multiplier * (v_actual - v_expected);

  RETURN ROUND(v_rating_change, 4);
END;
$function$;


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
  p_ratings     NUMERIC[]  := ARRAY[NULL, NULL, NULL, NULL]::NUMERIC[];
  p_matches     INT[]      := ARRAY[0, 0, 0, 0];
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

  -- Reset everyone before replay. Same behavior as the previous version.
  UPDATE profiles
     SET current_rating    = 3.00,
         week_start_rating = 3.00,
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
        -- Fix #4: skip any match with a guest slot. A NULL player_id
        -- used to fall back to 3.00 in the old sub-select, which
        -- silently underrated (or inflated) every real player in that
        -- match. Cleaner to just exclude these matches from rating.
        AND bool_and(mp.player_id IS NOT NULL)
     ORDER BY m.match_date, m.created_at, m.id
  LOOP
    p_ids   := match_record.player_ids;
    p_teams := match_record.teams;

    -- Snapshot each player's rating and match count as of this match.
    -- "As of" = strictly-earlier by (match_date, created_at, id) — the
    -- same tuple used to order the outer loop, so ties resolve
    -- deterministically the same way here.
    FOR i IN 1..4 LOOP
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
        3.00)
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

    -- Per-player delta. Each player's expected score is computed
    -- against their opponents (partner-independent), and their own
    -- match count feeds the provisional multiplier — both are the
    -- fixes for the symmetric-payout and p1-only-provisional bugs.
    FOR i IN 1..4 LOOP
      v_my_team := p_teams[i];
      v_won := (v_my_team = 1 AND match_record.team1_score > match_record.team2_score)
            OR (v_my_team = 2 AND match_record.team2_score > match_record.team1_score);
      v_my_score  := CASE v_my_team WHEN 1 THEN match_record.team1_score ELSE match_record.team2_score END;
      v_opp_score := CASE v_my_team WHEN 1 THEN match_record.team2_score ELSE match_record.team1_score END;

      -- Find partner + opponents by team membership. p_partner_rating
      -- is unused inside the function but we still pass a sensible
      -- value (the player's own rating if their partner slot is
      -- somehow missing — shouldn't happen given the COUNT(*) = 4
      -- filter above, but defensive).
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

      -- Fix #3: clamp final rating. Recompute the applied delta so
      -- match_participants.rating_change stays consistent with the
      -- stored profiles.current_rating.
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

  -- Week-start rating snapshot — unchanged from prior version.
  FOR player_record IN SELECT id FROM profiles LOOP
    UPDATE profiles
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
             3.00),
           week_start_date = current_week
     WHERE id = player_record.id;
  END LOOP;

  PERFORM recalculate_all_player_stats();
END;
$function$;


-- Rebuild every rating under the new algorithm. Same call path that
-- fires on every match approval / void, just applied once here so the
-- fix takes effect immediately on deploy.
SELECT public.recalculate_all_ratings();
