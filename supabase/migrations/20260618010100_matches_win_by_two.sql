-- =====================================================================
-- Enforce the pickleball "win by 2" rule at the database level.
--
-- The client (ScoreEntryStep.tsx) now blocks 11-10 / 21-20 etc.
-- submissions, but a DB-level CHECK keeps the rule honored across:
--   • RR matches inserted via submit_rr_match_score
--   • Tournament match writes
--   • Direct .insert() / future code paths
--   • Migrations / data imports
--
-- Rule:
--   Either side may be NULL (game in progress / unfilled) — allowed.
--   Both set → |team1_score - team2_score| must be >= 2.
--
-- NOT VALID ensures the constraint applies only to NEW writes; we don't
-- want a constraint failure on a historical 11-10 row to block this
-- migration. A separate operational pass can `VALIDATE CONSTRAINT` once
-- historical scores are audited / cleaned.
-- =====================================================================

ALTER TABLE public.matches
  ADD CONSTRAINT matches_win_by_two_chk
  CHECK (
    team1_score IS NULL
    OR team2_score IS NULL
    OR ABS(team1_score - team2_score) >= 2
  )
  NOT VALID;

COMMENT ON CONSTRAINT matches_win_by_two_chk ON public.matches IS
  'Pickleball win-by-2 rule. NOT VALID so historical rows are exempt; '
  'enforced for every new INSERT / UPDATE. To audit and validate '
  'against existing rows, run ALTER TABLE matches VALIDATE CONSTRAINT '
  'matches_win_by_two_chk after fixing any nonconforming history.';
