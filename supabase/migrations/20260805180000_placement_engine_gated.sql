-- =====================================================================
-- Placement engine — SQL port (Phase 1), GATED OFF.
--
-- Ports the tested TS reference engine (src/lib/rating/*) into the
-- authoritative recalc. Everything here is inert until
-- rating_parameters.placement_enabled flips true, so applying this migration
-- changes NO ratings. Enabling + the one-time recalc is a separate, manual
-- runbook step (docs/placement-golive.md) to run AFTER staging validation
-- against the TS golden fixture.
--
-- Placement (per player, independent within a mixed match):
--   • matches 0..(placement_matches-1): "placing" — rating_after is a
--     prior-anchored, reliability-weighted running estimate of implied
--     individual rating; NO ELO delta. The match that reaches
--     placement_matches writes placed_rating / placement_completed_at.
--   • otherwise: steady-state ELO. An established/provisional player facing a
--     PLACING opponent gets K reduced by placing_opponent_elo_multiplier.
-- =====================================================================

-- 1) Reliability of a participant by their pre-match count (evidence weight).
CREATE OR REPLACE FUNCTION public.pulse_participant_reliability(p_count INTEGER)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN p_count < rp.placement_matches  THEN rp.reliability_placing
    WHEN p_count < rp.provisional_matches THEN rp.reliability_provisional
    ELSE rp.reliability_established
  END
  FROM rating_parameters rp
  WHERE rp.id = '00000000-0000-0000-0000-000000000001';
$$;

-- 2) Extend the per-match ELO delta with an optional K multiplier (default 1.0
--    keeps every existing caller byte-identical). Used for established-player
--    protection when facing a placing opponent.
CREATE OR REPLACE FUNCTION public.calculate_pulse_rating_change(
  p_player_rating numeric, p_partner_rating numeric,
  p_opponent1_rating numeric, p_opponent2_rating numeric,
  p_team_score integer, p_opponent_score integer, p_won boolean,
  p_match_type text DEFAULT 'league'::text, p_player_matches integer DEFAULT 0,
  p_k_multiplier numeric DEFAULT 1.0)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_params RECORD;
  v_team_avg NUMERIC; v_opponent_avg NUMERIC; v_expected_score NUMERIC;
  v_k_base NUMERIC; v_k_factor NUMERIC; v_mov NUMERIC; v_mov_multiplier NUMERIC;
  v_actual_score NUMERIC; v_rating_change NUMERIC; v_provisional_mult NUMERIC := 1.0;
BEGIN
  SELECT * INTO v_params FROM public.rating_parameters
   WHERE id = '00000000-0000-0000-0000-000000000001';

  v_team_avg     := (p_player_rating + p_partner_rating) / 2.0;
  v_opponent_avg := (p_opponent1_rating + p_opponent2_rating) / 2.0;
  v_expected_score := 1.0 / (1.0 + POWER(10, (v_opponent_avg - v_team_avg) / v_params.tau));

  v_k_base := CASE p_match_type
    WHEN 'ladder'   THEN v_params.k_ladder
    WHEN 'league'   THEN v_params.k_league
    WHEN 'playoffs' THEN v_params.k_playoffs
    WHEN 'casual'   THEN v_params.k_ladder * 0.5
    ELSE v_params.k_league
  END;
  v_k_factor := v_k_base;

  IF p_player_matches < v_params.provisional_matches THEN
    v_provisional_mult := 1.0 + v_params.provisional_bonus;
  END IF;
  v_k_factor := v_k_factor * v_provisional_mult * COALESCE(p_k_multiplier, 1.0);

  v_mov := ABS(p_team_score - p_opponent_score)::NUMERIC / v_params.points_per_game;
  v_mov := LEAST(v_mov, v_params.mov_cap);
  v_mov_multiplier := 1.0 + v_mov;

  v_actual_score := CASE WHEN p_won THEN 1.0 ELSE 0.0 END;
  v_rating_change := v_k_factor * v_mov_multiplier * (v_actual_score - v_expected_score);
  RETURN ROUND(v_rating_change, 4);
END;
$function$;

-- 3) Recalc with the gated placement branch.
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
  v_placement_on BOOLEAN;
  p_ids         UUID[];
  p_teams       INT[];
  p_ratings     NUMERIC[] := ARRAY[NULL, NULL, NULL, NULL]::NUMERIC[];
  p_matches     INT[]     := ARRAY[0, 0, 0, 0];
  i INT; j INT;
  v_my_team     INT;
  v_won         BOOLEAN;
  v_my_score    INT;
  v_opp_score   INT;
  v_my_partner  NUMERIC;
  v_my_partner_ct INT;
  v_my_opps     NUMERIC[];
  v_my_opps_ct  INT[];
  v_delta       NUMERIC;
  v_new_rating  NUMERIC;
  v_snap_rating NUMERIC;
  v_snap_count  INT;
  current_week  DATE;
  -- placement locals
  v_margin_factor NUMERIC; v_g NUMERIC; v_impl_team NUMERIC; v_implied NUMERIC;
  v_wobs NUMERIC; v_accw NUMERIC; v_acca NUMERIC; v_running NUMERIC;
  v_start_rating NUMERIC; v_kmult NUMERIC;
BEGIN
  SELECT * INTO v_params FROM rating_parameters
   WHERE id = '00000000-0000-0000-0000-000000000001';
  v_placement_on := COALESCE(v_params.placement_enabled, false);
  current_week := get_week_start(CURRENT_DATE);

  -- Reset ratings to the starting point AND clear materialized placement
  -- outputs (they are recomputed below, never trusted as inputs).
  UPDATE profiles
     SET current_rating    = COALESCE(initial_self_rating, 3.00),
         week_start_rating = COALESCE(initial_self_rating, 3.00),
         week_start_date   = current_week,
         placed_rating           = NULL,
         placement_completed_at  = NULL,
         placement_model_version = NULL
   WHERE id IS NOT NULL;

  -- Per-player placement accumulators for this replay.
  IF v_placement_on THEN
    CREATE TEMP TABLE IF NOT EXISTS _plc_state
      (player_id UUID PRIMARY KEY, accw NUMERIC, acca NUMERIC);
    TRUNCATE _plc_state;
  END IF;

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
     HAVING COUNT(*) = 4 AND bool_and(mp.player_id IS NOT NULL)
     ORDER BY m.match_date, m.created_at, m.id
  LOOP
    p_ids   := match_record.player_ids;
    p_teams := match_record.teams;

    -- Pre-match rating + count for each participant (chronological snapshot).
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
        (SELECT COALESCE(initial_self_rating, 3.00) FROM profiles WHERE id = p_ids[i]))
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

      v_my_partner := NULL; v_my_partner_ct := NULL;
      v_my_opps := ARRAY[]::NUMERIC[]; v_my_opps_ct := ARRAY[]::INT[];
      FOR j IN 1..4 LOOP
        IF j = i THEN CONTINUE; END IF;
        IF p_teams[j] = v_my_team THEN
          v_my_partner := p_ratings[j]; v_my_partner_ct := p_matches[j];
        ELSE
          v_my_opps := array_append(v_my_opps, p_ratings[j]);
          v_my_opps_ct := array_append(v_my_opps_ct, p_matches[j]);
        END IF;
      END LOOP;

      IF v_placement_on AND p_matches[i] < v_params.placement_matches THEN
        -- Placement observation → running weighted estimate, no ELO.
        v_margin_factor := LEAST(ABS(v_my_score - v_opp_score)::NUMERIC / v_params.points_per_game, v_params.mov_cap)
                           / v_params.mov_cap;
        v_g := (CASE WHEN v_won THEN 1 ELSE -1 END) * v_params.placement_team_result_constant * v_margin_factor;
        v_impl_team := ((v_my_opps[1] + v_my_opps[2]) / 2.0) + v_g;
        v_implied := LEAST(v_params.clamp_max, GREATEST(v_params.clamp_min,
                       2 * v_impl_team - COALESCE(v_my_partner, p_ratings[i])));
        v_wobs := (pulse_participant_reliability(COALESCE(v_my_partner_ct, 0))
                 + pulse_participant_reliability(v_my_opps_ct[1])
                 + pulse_participant_reliability(v_my_opps_ct[2])) / 3.0;

        SELECT accw, acca INTO v_accw, v_acca FROM _plc_state WHERE player_id = p_ids[i];
        IF NOT FOUND THEN
          v_start_rating := COALESCE((SELECT initial_self_rating FROM profiles WHERE id = p_ids[i]), 3.00);
          v_accw := v_params.placement_prior_weight;
          v_acca := v_params.placement_prior_weight * v_start_rating;
        END IF;
        v_accw := v_accw + v_wobs;
        v_acca := v_acca + v_wobs * v_implied;
        INSERT INTO _plc_state (player_id, accw, acca) VALUES (p_ids[i], v_accw, v_acca)
          ON CONFLICT (player_id) DO UPDATE SET accw = EXCLUDED.accw, acca = EXCLUDED.acca;

        v_running := LEAST(v_params.clamp_max, GREATEST(v_params.clamp_min, v_acca / v_accw));
        v_new_rating := v_running;
        v_delta := v_new_rating - p_ratings[i];

        IF p_matches[i] + 1 = v_params.placement_matches THEN
          UPDATE profiles
             SET placed_rating = v_running,
                 placement_completed_at = match_record.match_date::timestamptz,
                 placement_model_version = v_params.placement_model_version
           WHERE id = p_ids[i];
        END IF;
      ELSE
        -- Steady-state ELO, with established-player protection vs placing opps.
        v_kmult := 1.0;
        IF v_placement_on
           AND (v_my_opps_ct[1] < v_params.placement_matches
                OR v_my_opps_ct[2] < v_params.placement_matches) THEN
          v_kmult := v_params.placing_opponent_elo_multiplier;
        END IF;
        v_delta := calculate_pulse_rating_change(
          p_ratings[i], COALESCE(v_my_partner, p_ratings[i]),
          v_my_opps[1], v_my_opps[2], v_my_score, v_opp_score, v_won,
          match_record.match_type, p_matches[i], v_kmult);
        v_new_rating := LEAST(v_params.clamp_max, GREATEST(v_params.clamp_min, p_ratings[i] + v_delta));
        v_delta := v_new_rating - p_ratings[i];
      END IF;

      UPDATE match_participants
         SET rating_before = p_ratings[i], rating_after = v_new_rating, rating_change = v_delta
       WHERE match_id = match_record.match_id AND player_id = p_ids[i];
      UPDATE profiles SET current_rating = v_new_rating WHERE id = p_ids[i];
    END LOOP;
  END LOOP;

  -- Week-start rating: prior week's last rating_after, else starting rating.
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

-- 4) Incremental path: the O(1) per-match update is only valid when it equals
--    a full replay. Placement (running accumulators + established protection)
--    breaks that whenever a placing player is involved, so when placement is
--    on and any participant is still placing, delegate to a full recalc.
CREATE OR REPLACE FUNCTION public.placement_forces_full_recalc(p_match_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE((SELECT placement_enabled FROM rating_parameters
                    WHERE id = '00000000-0000-0000-0000-000000000001'), false)
     AND EXISTS (
       SELECT 1
         FROM match_participants mp
        WHERE mp.match_id = p_match_id
          AND (
            SELECT COUNT(*)
              FROM match_participants mp2
              JOIN matches m2 ON mp2.match_id = m2.id
             WHERE mp2.player_id = mp.player_id
               AND m2.status = 'approved'
               AND COALESCE(m2.voided, false) = false
               AND COALESCE(m2.count_for_rating, true) = true
               AND m2.id <> p_match_id
          ) < (SELECT placement_matches FROM rating_parameters
                WHERE id = '00000000-0000-0000-0000-000000000001')
     );
$$;

-- 5) Incremental update with the placement delegate guard at the top. Body is
--    the existing O(1) path verbatim; only the guard is added, so with
--    placement OFF (or no placing participant) behavior is byte-identical.
CREATE OR REPLACE FUNCTION public.apply_match_rating_incremental(p_match_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_match       RECORD;
  v_params      RECORD;
  v_participant_count INT;
  v_has_null_player   BOOLEAN;
  v_has_later_match   BOOLEAN;
  p_ids         UUID[];
  p_teams       INT[];
  p_ratings     NUMERIC[] := ARRAY[NULL, NULL, NULL, NULL]::NUMERIC[];
  p_matches     INT[]     := ARRAY[0, 0, 0, 0];
  i INT; j INT;
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
BEGIN
  SELECT * INTO v_match FROM matches WHERE id = p_match_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF v_match.status <> 'approved'
     OR COALESCE(v_match.voided, false) = true
     OR COALESCE(v_match.count_for_rating, true) = false THEN
    RETURN;
  END IF;

  -- PLACEMENT GUARD: the O(1) path is only valid when it equals a full replay.
  -- A still-placing participant breaks that (running estimate + protection).
  IF placement_forces_full_recalc(p_match_id) THEN
    PERFORM recalculate_all_ratings();
    RETURN;
  END IF;

  SELECT COUNT(*), bool_or(player_id IS NULL)
    INTO v_participant_count, v_has_null_player
    FROM match_participants
   WHERE match_id = p_match_id;
  IF v_participant_count <> 4 OR v_has_null_player THEN RETURN; END IF;

  SELECT array_agg(player_id ORDER BY team, id),
         array_agg(team      ORDER BY team, id)
    INTO p_ids, p_teams
    FROM match_participants
   WHERE match_id = p_match_id;

  SELECT EXISTS (
    SELECT 1
      FROM match_participants mp2
      JOIN matches m2 ON mp2.match_id = m2.id
     WHERE mp2.player_id = ANY(p_ids)
       AND m2.id <> p_match_id
       AND m2.status = 'approved'
       AND COALESCE(m2.voided, false) = false
       AND COALESCE(m2.count_for_rating, true) = true
       AND (m2.match_date >  v_match.match_date
         OR (m2.match_date = v_match.match_date AND m2.created_at >  v_match.created_at)
         OR (m2.match_date = v_match.match_date AND m2.created_at = v_match.created_at AND m2.id > p_match_id))
  ) INTO v_has_later_match;

  IF v_has_later_match THEN
    PERFORM recalculate_all_ratings();
    RETURN;
  END IF;

  SELECT * INTO v_params FROM rating_parameters
   WHERE id = '00000000-0000-0000-0000-000000000001';

  FOR i IN 1..4 LOOP
    SELECT current_rating INTO v_snap_rating FROM profiles WHERE id = p_ids[i];
    p_ratings[i] := v_snap_rating;

    SELECT COUNT(*)::INT INTO v_snap_count
      FROM match_participants mp_sub
      JOIN matches m_sub ON mp_sub.match_id = m_sub.id
     WHERE mp_sub.player_id = p_ids[i]
       AND m_sub.id <> p_match_id
       AND m_sub.status = 'approved'
       AND COALESCE(m_sub.voided, false) = false
       AND COALESCE(m_sub.count_for_rating, true) = true;
    p_matches[i] := v_snap_count;
  END LOOP;

  FOR i IN 1..4 LOOP
    v_my_team := p_teams[i];
    v_won := (v_my_team = 1 AND v_match.team1_score > v_match.team2_score)
          OR (v_my_team = 2 AND v_match.team2_score > v_match.team1_score);
    v_my_score  := CASE v_my_team WHEN 1 THEN v_match.team1_score ELSE v_match.team2_score END;
    v_opp_score := CASE v_my_team WHEN 1 THEN v_match.team2_score ELSE v_match.team1_score END;

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
      p_ratings[i], COALESCE(v_my_partner, p_ratings[i]),
      v_my_opps[1], v_my_opps[2], v_my_score, v_opp_score, v_won,
      v_match.match_type, p_matches[i]);

    v_new_rating := LEAST(v_params.clamp_max, GREATEST(v_params.clamp_min, p_ratings[i] + v_delta));
    v_delta := v_new_rating - p_ratings[i];

    UPDATE match_participants
       SET rating_before = p_ratings[i], rating_after = v_new_rating, rating_change = v_delta
     WHERE match_id = p_match_id AND player_id = p_ids[i];
    UPDATE profiles SET current_rating = v_new_rating WHERE id = p_ids[i];
  END LOOP;

  FOR i IN 1..4 LOOP
    PERFORM recalculate_player_stats(p_ids[i]);
  END LOOP;
END;
$function$;

COMMENT ON FUNCTION public.recalculate_all_ratings IS
  'Full sequential rating replay. Placement branch is gated by '
  'rating_parameters.placement_enabled (default false → current ELO exactly).';
COMMENT ON FUNCTION public.placement_forces_full_recalc IS
  'True when placement is enabled and the match involves a still-placing '
  'player, so the incremental path must delegate to recalculate_all_ratings().';
