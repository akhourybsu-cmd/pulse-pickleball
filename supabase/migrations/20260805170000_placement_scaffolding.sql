-- =====================================================================
-- Preliminary / Placement rating — Phase 1 scaffolding (feature OFF)
--
-- Adds the configurable knobs and the materialized profile outputs the
-- placement engine needs, WITHOUT changing any rating behavior. The master
-- flag `placement_enabled` defaults FALSE, and this migration deliberately
-- does NOT touch `recalculate_all_ratings` — the engine branch is wired in a
-- later phase, only after the simulator sign-off. Until then every value here
-- is inert.
--
-- Placement determines a new player's TRUE starting level from their first
-- `placement_matches` results (prior-anchored, reliability-weighted), instead
-- of slowly drifting from a self-guess. See src/lib/rating/* for the reference
-- implementation and the simulator comparison.
-- =====================================================================

-- ---- Configurable parameters (single global row) --------------------
ALTER TABLE public.rating_parameters
  ADD COLUMN IF NOT EXISTS placement_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS placement_matches INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS placement_prior_weight NUMERIC NOT NULL DEFAULT 1.0,
  -- team-level result offset per unit of (capped) score margin. The
  -- team→individual conversion doubles this, so keep it modest; the
  -- simulator selects the final value (evaluated ~0.18–0.25).
  ADD COLUMN IF NOT EXISTS placement_team_result_constant NUMERIC NOT NULL DEFAULT 0.20,
  -- K reduction applied to an established/provisional player when an OPPONENT
  -- is still placing, so an uncalibrated newcomer can't wreck real ratings
  -- (simulator evaluated ~0.25–0.50).
  ADD COLUMN IF NOT EXISTS placing_opponent_elo_multiplier NUMERIC NOT NULL DEFAULT 0.35,
  -- Evidence weight of a participant by their own state, used when weighting a
  -- placing player's per-match observation.
  ADD COLUMN IF NOT EXISTS reliability_placing NUMERIC NOT NULL DEFAULT 0.50,
  ADD COLUMN IF NOT EXISTS reliability_provisional NUMERIC NOT NULL DEFAULT 0.75,
  ADD COLUMN IF NOT EXISTS reliability_established NUMERIC NOT NULL DEFAULT 1.00,
  -- Bumped when the placement formula changes, so materialized outputs can be
  -- audited / recomputed.
  ADD COLUMN IF NOT EXISTS placement_model_version INTEGER NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.rating_parameters.placement_enabled IS
  'Master flag for the placement engine. FALSE = current ELO behavior exactly.';

-- ---- Materialized profile outputs (NOT authoritative inputs) --------
-- These are written by the replay when placement completes and must be
-- overwritten/cleared whenever match history changes (delete, void, backdate).
-- Recalculation is the source of truth; never treat these as inputs.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS placed_rating NUMERIC
    CHECK (placed_rating IS NULL OR (placed_rating >= 2.0 AND placed_rating <= 4.5)),
  ADD COLUMN IF NOT EXISTS placement_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS placement_model_version INTEGER;

COMMENT ON COLUMN public.profiles.placed_rating IS
  'Materialized replay output: the rating a player was placed at on their '
  'placement_matches-th match. Overwritten/cleared by recalc when history '
  'changes — not an authoritative input.';
COMMENT ON COLUMN public.profiles.placement_completed_at IS
  'Materialized replay output: date of the match that completed placement.';
