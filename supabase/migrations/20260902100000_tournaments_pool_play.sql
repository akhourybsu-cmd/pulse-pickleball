-- =====================================================================
-- Tournaments: pool play.
--
-- "Pool Play" has been selectable in both division dialogs since the
-- tournament tables were created, with nothing behind it — the division's
-- generate button fell through to the elimination dialog and produced a plain
-- single-elimination bracket. It is also the format the large majority of
-- pickleball tournaments actually run, so it needs real storage.
--
-- The format has two stages inside one division:
--
--   POOL stage    — teams are split into pools and play a round robin inside
--                   their own pool. Those matches carry `pool` and no
--                   `bracket`.
--   BRACKET stage — the top finishers cross over into a single elimination
--                   draw. Those matches carry `bracket` and no `pool`.
--
-- So `pool IS NOT NULL` and `bracket IS NOT NULL` are mutually exclusive, and
-- the two stages of a division are separable with an indexed predicate rather
-- than by inspecting round numbers.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- Which pool a team was drawn into. NULL for every other format.
-- ---------------------------------------------------------------------
ALTER TABLE public.tournaments_teams
  ADD COLUMN IF NOT EXISTS pool text;

COMMENT ON COLUMN public.tournaments_teams.pool IS
  'Pool label (A, B, C, ...) for pool play divisions. NULL for other formats. '
  'Assigned serpentine from seed order so every pool gets a comparable spread.';

CREATE INDEX IF NOT EXISTS idx_tournaments_teams_division_pool
  ON public.tournaments_teams (division_id, pool);

-- ---------------------------------------------------------------------
-- Which pool a match belongs to, and the stage invariant.
-- ---------------------------------------------------------------------
ALTER TABLE public.tournaments_matches
  ADD COLUMN IF NOT EXISTS pool text;

COMMENT ON COLUMN public.tournaments_matches.pool IS
  'Pool label for a pool-stage match. NULL for bracket-stage and non-pool '
  'formats. Mutually exclusive with `bracket`.';

-- A match is in a pool or in a bracket, never both. Without this a
-- half-written generation could produce rows that count into a pool table AND
-- advance through a draw.
ALTER TABLE public.tournaments_matches
  DROP CONSTRAINT IF EXISTS tournaments_matches_stage_check;

ALTER TABLE public.tournaments_matches
  ADD CONSTRAINT tournaments_matches_stage_check
  CHECK (pool IS NULL OR bracket IS NULL);

CREATE INDEX IF NOT EXISTS idx_tournaments_matches_division_pool
  ON public.tournaments_matches (division_id, pool, round_number, match_number);

-- ---------------------------------------------------------------------
-- Division-level pool configuration.
--
-- Stored rather than recomputed because the organizer can override the
-- suggested shape, and because the bracket stage has to be generated later
-- from the same numbers the pools were built with.
-- ---------------------------------------------------------------------
ALTER TABLE public.tournaments_divisions
  ADD COLUMN IF NOT EXISTS pool_count integer;

ALTER TABLE public.tournaments_divisions
  ADD COLUMN IF NOT EXISTS advancers_per_pool integer;

ALTER TABLE public.tournaments_divisions
  DROP CONSTRAINT IF EXISTS tournaments_divisions_pool_shape_check;

ALTER TABLE public.tournaments_divisions
  ADD CONSTRAINT tournaments_divisions_pool_shape_check
  CHECK (
    (pool_count IS NULL OR pool_count BETWEEN 1 AND 26)
    AND (advancers_per_pool IS NULL OR advancers_per_pool BETWEEN 1 AND 8)
  );

COMMENT ON COLUMN public.tournaments_divisions.pool_count IS
  'Number of pools for a pool play division. NULL until the pools are drawn.';

COMMENT ON COLUMN public.tournaments_divisions.advancers_per_pool IS
  'How many teams from each pool reach the elimination bracket.';

COMMIT;
