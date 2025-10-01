-- Add rating parameters table
CREATE TABLE IF NOT EXISTS public.rating_parameters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tau NUMERIC NOT NULL DEFAULT 0.4,
  mean_rating NUMERIC NOT NULL DEFAULT 3.5,
  clamp_min NUMERIC NOT NULL DEFAULT 2.0,
  clamp_max NUMERIC NOT NULL DEFAULT 4.5,
  inactivity_days INTEGER NOT NULL DEFAULT 60,
  regress_coeff NUMERIC NOT NULL DEFAULT 0.8,
  provisional_matches INTEGER NOT NULL DEFAULT 8,
  provisional_bonus NUMERIC NOT NULL DEFAULT 0.07,
  k_ladder NUMERIC NOT NULL DEFAULT 0.055,
  k_league NUMERIC NOT NULL DEFAULT 0.075,
  k_playoffs NUMERIC NOT NULL DEFAULT 0.095,
  mov_cap NUMERIC NOT NULL DEFAULT 0.4,
  points_per_game INTEGER NOT NULL DEFAULT 11,
  k_format_singles NUMERIC NOT NULL DEFAULT 1.1,
  k_format_doubles NUMERIC NOT NULL DEFAULT 1.0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default parameters
INSERT INTO public.rating_parameters (id)
VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Add match type to matches table
ALTER TABLE public.matches 
ADD COLUMN IF NOT EXISTS match_type TEXT DEFAULT 'league' 
CHECK (match_type IN ('ladder', 'league', 'playoffs', 'casual'));

-- Add week tracking to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS week_start_rating NUMERIC DEFAULT 3.00,
ADD COLUMN IF NOT EXISTS week_start_date DATE DEFAULT CURRENT_DATE;

-- Create advanced rating calculation function
CREATE OR REPLACE FUNCTION public.calculate_pulse_rating_change(
  p_player_rating NUMERIC,
  p_partner_rating NUMERIC,
  p_opponent1_rating NUMERIC,
  p_opponent2_rating NUMERIC,
  p_team_score INTEGER,
  p_opponent_score INTEGER,
  p_won BOOLEAN,
  p_match_type TEXT DEFAULT 'league',
  p_player_matches INTEGER DEFAULT 0
)
RETURNS NUMERIC
LANGUAGE plpgsql
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