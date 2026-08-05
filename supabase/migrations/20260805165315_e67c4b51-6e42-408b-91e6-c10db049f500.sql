ALTER TABLE public.rating_parameters
  ADD COLUMN IF NOT EXISTS placement_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS placement_matches INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS placement_prior_weight NUMERIC NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS placement_team_result_constant NUMERIC NOT NULL DEFAULT 0.20,
  ADD COLUMN IF NOT EXISTS placing_opponent_elo_multiplier NUMERIC NOT NULL DEFAULT 0.35,
  ADD COLUMN IF NOT EXISTS reliability_placing NUMERIC NOT NULL DEFAULT 0.50,
  ADD COLUMN IF NOT EXISTS reliability_provisional NUMERIC NOT NULL DEFAULT 0.75,
  ADD COLUMN IF NOT EXISTS reliability_established NUMERIC NOT NULL DEFAULT 1.00,
  ADD COLUMN IF NOT EXISTS placement_model_version INTEGER NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.rating_parameters.placement_enabled IS
  'Master flag for the placement engine. FALSE = current ELO behavior exactly.';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS placed_rating NUMERIC
    CHECK (placed_rating IS NULL OR (placed_rating >= 2.0 AND placed_rating <= 4.5)),
  ADD COLUMN IF NOT EXISTS placement_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS placement_model_version INTEGER;

COMMENT ON COLUMN public.profiles.placed_rating IS
  'Materialized replay output: the rating a player was placed at on their placement_matches-th match. Overwritten/cleared by recalc when history changes - not an authoritative input.';
COMMENT ON COLUMN public.profiles.placement_completed_at IS
  'Materialized replay output: date of the match that completed placement.';