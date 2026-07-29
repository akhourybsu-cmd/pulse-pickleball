-- ============================================================================
-- PULSE Skill Assessment — completion-authorization HARDENING (defect fix)
--
-- Invariant being enforced: the `skill-complete` edge function (which calls
-- apply_skill_scoring_snapshot under the service role) must be the ONLY path
-- that produces an AUTHORITATIVE result. A player must never be able to write
-- their own score.
--
-- Defect this closes (found in the release-candidate audit): the earlier
-- foundation granted the `authenticated` role TABLE-LEVEL INSERT/UPDATE on
-- both authoritative surfaces with only a row-level RLS predicate
-- (`player_id = auth.uid()`) and no COLUMN restriction. Combined with the
-- completed-attempt immutability trigger only firing on OLD.status =
-- 'completed', an authenticated owner could:
--   (A) UPDATE their own in_progress attempt to status='completed' with a
--       forged scoring_snapshot / estimated_level_* (capped only at raw<=4.7),
--       finalizing WITHOUT the server recompute; and
--   (B) upsert player_skill_profiles.self_assessed_level (and band/confidence/
--       provisional_status) directly.
-- Either bypasses skill-complete entirely, and the edge function's idempotent
-- branch would then launder the forged attempt row back as "authoritative".
--
-- Fix strategy: COLUMN-LEVEL privileges. The client keeps exactly the writes
-- its real flow needs (create an in_progress draft; bump last_activity_at;
-- delete its own draft) and loses the ability to touch any scoring column or
-- to set status='completed'. player_skill_profiles becomes read-only to the
-- client (its flow never wrote it). This is deliberately NOT a trigger that
-- inspects auth.role(): apply_skill_scoring_snapshot is SECURITY DEFINER and
-- runs as the table owner, so column privileges granted to `authenticated`
-- never constrain it — the server finalize path is provably unaffected.
--
-- Does not touch scoring, the question bank, the mirror, or the PULSE
-- Performance Rating. No data is modified; only privileges/policies change.
-- Idempotent and safe to re-run.
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
