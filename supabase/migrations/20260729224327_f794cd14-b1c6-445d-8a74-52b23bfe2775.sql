REVOKE ALL ON FUNCTION public.apply_skill_scoring_snapshot(UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_skill_scoring_snapshot(UUID, JSONB) TO service_role;