-- =====================================================================
-- Tournaments: add a bracket discriminator to matches.
--
-- Single elimination needs no extra columns — the winner of round r match m
-- always feeds round r+1 match ceil(m/2), so advancement is pure arithmetic on
-- (round_number, match_number).
--
-- Double elimination breaks that assumption: the winners and losers brackets
-- are separate ladders that both start at round 1 match 1, so
-- (division_id, round_number, match_number) is no longer unique within a
-- division and cannot identify a match. A discriminator is unavoidable.
--
-- Nullable on purpose:
--   • existing rows (round robin, and single-elim draws generated before this)
--     stay valid as NULL,
--   • round robin never sets it — it has no bracket,
--   • elimination generation from here on always sets it, so lookups by
--     (division, bracket, round, match) are unambiguous.
-- =====================================================================

BEGIN;

ALTER TABLE public.tournaments_matches
  ADD COLUMN IF NOT EXISTS bracket text;

ALTER TABLE public.tournaments_matches
  DROP CONSTRAINT IF EXISTS tournaments_matches_bracket_check;

ALTER TABLE public.tournaments_matches
  ADD CONSTRAINT tournaments_matches_bracket_check
  CHECK (bracket IS NULL OR bracket IN ('winners', 'losers', 'grand_final'));

COMMENT ON COLUMN public.tournaments_matches.bracket IS
  'Elimination bracket this match belongs to: winners | losers | grand_final. '
  'NULL for formats without brackets (round robin) and for legacy rows. '
  'Required to disambiguate double elimination, where the winners and losers '
  'ladders share round/match numbering.';

-- Advancement looks a match up by its position within a bracket; make that
-- lookup an index hit rather than a scan of the division's matches.
CREATE INDEX IF NOT EXISTS idx_tournaments_matches_bracket_position
  ON public.tournaments_matches (division_id, bracket, round_number, match_number);

COMMIT;
