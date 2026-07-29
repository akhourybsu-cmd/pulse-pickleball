REVOKE INSERT, UPDATE ON public.skill_assessment_attempts FROM authenticated;

GRANT INSERT (player_id, assessment_version, assessment_type, status)
  ON public.skill_assessment_attempts TO authenticated;
GRANT UPDATE (last_activity_at)
  ON public.skill_assessment_attempts TO authenticated;

REVOKE INSERT, UPDATE ON public.player_skill_profiles FROM authenticated;
DROP POLICY IF EXISTS skill_profiles_upsert_own ON public.player_skill_profiles;

COMMENT ON TABLE public.player_skill_profiles IS
  'PULSE Self-Assessed Level + Observed Skill summary. Written ONLY by apply_skill_scoring_snapshot (service role) via the skill-complete edge function; client-readable, not client-writable. Separate from profiles.current_rating (Performance Rating), which this never modifies.';