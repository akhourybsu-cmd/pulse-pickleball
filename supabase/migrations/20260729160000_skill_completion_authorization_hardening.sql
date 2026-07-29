-- ============================================================================
-- PULSE Skill Assessment — completion-authorization (idempotent re-assertion)
--
-- STATUS: As of the folded foundation, the secure column-level privileges are
-- installed by 20260729123000_skill_assessment_foundation.sql from FIRST
-- deployment, so a fresh environment never passes through the pre-hardening
-- (client-forgeable) state — not even transiently. This migration is RETAINED
-- as an idempotent, defense-in-depth re-assertion of that secure state, so any
-- environment that had already applied an OLDER (table-level-grant) version of
-- the foundation is still brought to the secured state when this runs. On a
-- fresh, folded install it is a harmless no-op.
--
-- Invariant enforced (here and in the foundation): the `skill-complete` edge
-- function (→ apply_skill_scoring_snapshot under the service role) is the ONLY
-- path that produces an AUTHORITATIVE result. A player can never:
--   • mark an assessment completed,
--   • write authoritative estimated levels / a scoring snapshot,
--   • directly update self-assessed profile values, or
--   • invoke apply_skill_scoring_snapshot.
--
-- Mechanism: COLUMN-LEVEL privileges (not an auth.role()-sniffing trigger).
-- apply_skill_scoring_snapshot is SECURITY DEFINER and runs as the table owner,
-- so column privileges granted to `authenticated` never constrain it — the
-- server finalize path is provably unaffected.
--
-- Does not touch scoring, the question bank, the mirror, or the PULSE
-- Performance Rating. No data is modified; only privileges/policies change.
-- Every statement is idempotent and safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) skill_assessment_attempts — client may create a draft and keep it fresh,
--    but may never write scoring columns or flip status to 'completed'.
-- ----------------------------------------------------------------------------
-- Drop the broad table-level write privileges granted by the foundation.
REVOKE INSERT, UPDATE ON public.skill_assessment_attempts FROM authenticated;

-- Re-grant only what the real client flow uses:
--   • INSERT: the exact columns the draft-create sets (see useSkillAssessment
--     `start()`); the RLS insert policy still pins status='in_progress' and
--     player_id=auth.uid(), and the column grant makes scoring columns
--     un-settable on insert too.
--   • UPDATE: last_activity_at ONLY (save-and-resume ordering). status and
--     every scoring column are now un-writable by the client, so the
--     in_progress→completed transition and any forged snapshot are impossible.
-- (SELECT and DELETE grants from the foundation are intentionally retained;
--  DELETE is still bounded by the own-draft RLS policy.)
GRANT INSERT (player_id, assessment_version, assessment_type, status)
  ON public.skill_assessment_attempts TO authenticated;
GRANT UPDATE (last_activity_at)
  ON public.skill_assessment_attempts TO authenticated;

-- ----------------------------------------------------------------------------
-- 2) player_skill_profiles — the client only ever SELECTs this table; the
--    summary is written solely by apply_skill_scoring_snapshot (service role).
--    Remove client write privileges entirely and drop the now-misleading
--    owner-write policy so the posture is explicit. SELECT is unaffected
--    (governed by skill_profiles_select / can_view_player_skill).
-- ----------------------------------------------------------------------------
REVOKE INSERT, UPDATE ON public.player_skill_profiles FROM authenticated;
DROP POLICY IF EXISTS skill_profiles_upsert_own ON public.player_skill_profiles;

COMMENT ON TABLE public.player_skill_profiles IS
  'PULSE Self-Assessed Level + Observed Skill summary. Written ONLY by apply_skill_scoring_snapshot (service role) via the skill-complete edge function; client-readable, not client-writable. Separate from profiles.current_rating (Performance Rating), which this never modifies.';
