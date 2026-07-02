-- =====================================================================
-- League match scores — additive columns only.
--
-- Adds team_a_score / team_b_score to league_matches so admins can
-- capture the result of a placeholder league match. Rating engine
-- still ignores these rows entirely: no trigger, no reference from
-- calculate_pulse_rating_change / recalculate_all_ratings, and
-- rating_status stays 'not_connected' by default.
--
-- This is intentionally NOT the same shape as matches.team1_score /
-- matches.team2_score — we don't want a future author to blindly
-- copy the rating pipeline over. league_ prefix stays explicit.
-- =====================================================================

ALTER TABLE public.league_matches
  ADD COLUMN IF NOT EXISTS team_a_score INTEGER CHECK (team_a_score IS NULL OR team_a_score >= 0),
  ADD COLUMN IF NOT EXISTS team_b_score INTEGER CHECK (team_b_score IS NULL OR team_b_score >= 0);

COMMENT ON COLUMN public.league_matches.team_a_score IS
  'Optional score for team_a. Purely for display/reporting — never '
  'feeds the PULSE rating engine.';
COMMENT ON COLUMN public.league_matches.team_b_score IS
  'Optional score for team_b. Purely for display/reporting — never '
  'feeds the PULSE rating engine.';
