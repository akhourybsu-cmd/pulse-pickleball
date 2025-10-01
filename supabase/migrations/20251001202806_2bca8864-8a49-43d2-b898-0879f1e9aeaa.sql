-- Fix search_path for existing functions that don't have it set

-- Fix calculate_rating_change function
CREATE OR REPLACE FUNCTION public.calculate_rating_change(player_rating numeric, partner_rating numeric, opponent1_rating numeric, opponent2_rating numeric, won boolean)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  team_avg DECIMAL;
  opponent_avg DECIMAL;
  expected_score DECIMAL;
  k_factor DECIMAL := 32;
  rating_change DECIMAL;
BEGIN
  team_avg := (player_rating + partner_rating) / 2.0;
  opponent_avg := (opponent1_rating + opponent2_rating) / 2.0;
  
  -- Calculate expected score using simplified Elo formula
  expected_score := 1.0 / (1.0 + POWER(10, (opponent_avg - team_avg) / 0.5));
  
  -- Calculate rating change
  rating_change := k_factor * ((CASE WHEN won THEN 1.0 ELSE 0.0 END) - expected_score);
  
  RETURN ROUND(rating_change::numeric, 2);
END;
$function$;

-- Fix calculate_pulse_rating_change function
CREATE OR REPLACE FUNCTION public.calculate_pulse_rating_change(p_player_rating numeric, p_partner_rating numeric, p_opponent1_rating numeric, p_opponent2_rating numeric, p_team_score integer, p_opponent_score integer, p_won boolean, p_match_type text DEFAULT 'league'::text, p_player_matches integer DEFAULT 0)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_params RECORD;
  v_team_avg NUMERIC;
  v_opponent_avg NUMERIC;
  v_expected_score NUMERIC;
  v_k_base NUMERIC;
  v_k_format NUMERIC := 1.0; -- doubles
  v_k_factor NUMERIC;
  v_mov NUMERIC;
  v_mov_multiplier NUMERIC;
  v_actual_score NUMERIC;
  v_rating_change NUMERIC;
  v_provisional_mult NUMERIC := 1.0;
BEGIN
  -- Get rating parameters
  SELECT * INTO v_params 
  FROM public.rating_parameters 
  WHERE id = '00000000-0000-0000-0000-000000000001';
  
  -- Calculate team averages
  v_team_avg := (p_player_rating + p_partner_rating) / 2.0;
  v_opponent_avg := (p_opponent1_rating + p_opponent2_rating) / 2.0;
  
  -- Calculate expected score using logistic curve (tau parameter)
  -- Expected = 1 / (1 + 10^((opponent_avg - team_avg) / tau))
  v_expected_score := 1.0 / (1.0 + POWER(10, (v_opponent_avg - v_team_avg) / v_params.tau));
  
  -- Get base K-factor based on match type
  v_k_base := CASE p_match_type
    WHEN 'ladder' THEN v_params.k_ladder
    WHEN 'league' THEN v_params.k_league
    WHEN 'playoffs' THEN v_params.k_playoffs
    WHEN 'casual' THEN v_params.k_ladder * 0.5  -- reduced for casual
    ELSE v_params.k_league
  END;
  
  -- Apply format multiplier (doubles = 1.0)
  v_k_factor := v_k_base * v_k_format;
  
  -- Apply provisional bonus if under provisional match threshold
  IF p_player_matches < v_params.provisional_matches THEN
    v_provisional_mult := 1.0 + v_params.provisional_bonus;
  END IF;
  
  v_k_factor := v_k_factor * v_provisional_mult;
  
  -- Calculate margin of victory effect
  v_mov := ABS(p_team_score - p_opponent_score)::NUMERIC / v_params.points_per_game;
  v_mov := LEAST(v_mov, v_params.mov_cap); -- cap MoV
  v_mov_multiplier := 1.0 + v_mov;
  
  -- Actual score (1 for win, 0 for loss)
  v_actual_score := CASE WHEN p_won THEN 1.0 ELSE 0.0 END;
  
  -- Calculate rating change: K * MoV_mult * (Actual - Expected)
  v_rating_change := v_k_factor * v_mov_multiplier * (v_actual_score - v_expected_score);
  
  RETURN ROUND(v_rating_change, 4);
END;
$function$;

-- Fix update_updated_at function
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;