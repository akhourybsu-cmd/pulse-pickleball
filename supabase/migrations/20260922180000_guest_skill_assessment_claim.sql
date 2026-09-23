-- Anonymous assessments stay in the browser. Only the authenticated edge
-- function can import validated raw answers and its independently computed score.
CREATE OR REPLACE FUNCTION public.import_guest_skill_assessment(
  p_player_id UUID, p_attempt_id UUID, p_responses JSONB, p_snapshot JSONB
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inserted UUID;
  v_attempt public.skill_assessment_attempts%ROWTYPE;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;
  IF p_player_id IS NULL OR p_attempt_id IS NULL OR
     jsonb_typeof(p_responses) IS DISTINCT FROM 'object' OR
     (p_snapshot->>'scoringModelVersion')::INTEGER IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'Invalid import' USING ERRCODE = '22023';
  END IF;

  -- Use a non-draft state inside this transaction to preserve the player's
  -- existing in_progress draft and its partial unique index. Finalization below
  -- changes this row to completed before anything becomes visible. On any
  -- failure the whole import rolls back, including this temporary row.
  INSERT INTO public.skill_assessment_attempts
    (id, player_id, assessment_version, assessment_type, status)
  VALUES (p_attempt_id, p_player_id, 2, 'full', 'abandoned')
  ON CONFLICT (id) DO NOTHING RETURNING id INTO v_inserted;

  SELECT * INTO v_attempt FROM public.skill_assessment_attempts
    WHERE id = p_attempt_id FOR UPDATE;
  IF v_attempt.player_id <> p_player_id THEN
    RAISE EXCEPTION 'Assessment belongs to another account' USING ERRCODE = '42501';
  END IF;
  IF v_inserted IS NULL THEN
    IF v_attempt.status = 'completed' THEN RETURN v_attempt.scoring_snapshot; END IF;
    RAISE EXCEPTION 'Assessment ID already in use' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.skill_assessment_responses
    (attempt_id, item_key, response_key, response_value, was_skipped)
  SELECT p_attempt_id, key, value,
    CASE value WHEN 'not_yet' THEN 0 WHEN 'drill_only' THEN 0.2
      WHEN 'occasionally' THEN 0.4 WHEN 'sometimes' THEN 0.6
      WHEN 'usually' THEN 0.8 WHEN 'reliably' THEN 1 ELSE NULL END, false
  FROM jsonb_each_text(p_responses);

  -- New skill profiles start private. Existing visibility preferences survive.
  INSERT INTO public.player_skill_profiles (player_id, visibility)
    VALUES (p_player_id, 'private') ON CONFLICT (player_id) DO NOTHING;
  PERFORM public.apply_skill_scoring_snapshot(p_attempt_id, p_snapshot);
  RETURN (SELECT scoring_snapshot FROM public.skill_assessment_attempts WHERE id = p_attempt_id);
END; $$;
REVOKE ALL ON FUNCTION public.import_guest_skill_assessment(UUID, UUID, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.import_guest_skill_assessment(UUID, UUID, JSONB, JSONB) TO service_role;
