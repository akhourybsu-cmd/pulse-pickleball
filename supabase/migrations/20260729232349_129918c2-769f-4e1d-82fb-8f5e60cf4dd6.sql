CREATE OR REPLACE FUNCTION public.apply_skill_scoring_snapshot(
  p_attempt_id UUID,
  p_snapshot   JSONB
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid        UUID := auth.uid();
  v_is_service BOOLEAN := (COALESCE(auth.role(),'') = 'service_role');
  v_att        public.skill_assessment_attempts%ROWTYPE;
  v_player     UUID;
  v_raw   NUMERIC := LEAST( (p_snapshot->>'estimatedLevelRaw')::NUMERIC, 4.7 );
  v_conf  INTEGER := (p_snapshot->'confidence'->>'total')::INTEGER;
  v_rec   JSONB;
BEGIN
  SELECT * INTO v_att FROM public.skill_assessment_attempts WHERE id = p_attempt_id FOR UPDATE;
  IF v_att.id IS NULL THEN RAISE EXCEPTION 'Attempt not found' USING ERRCODE = '02000'; END IF;
  IF NOT v_is_service AND (v_uid IS NULL OR v_att.player_id <> v_uid) THEN
    RAISE EXCEPTION 'Not authorized to finalize this attempt' USING ERRCODE = '42501';
  END IF;
  IF v_att.status = 'completed' THEN RETURN; END IF;

  -- Always derive the owner from the attempt row: auth.uid() is NULL when the
  -- service-role edge function finalizes on the player's behalf.
  v_player := v_att.player_id;

  UPDATE public.skill_assessment_attempts SET
    status                  = 'completed',
    completed_at            = now(),
    scoring_model_version   = (p_snapshot->>'scoringModelVersion')::INTEGER,
    estimated_level_raw     = v_raw,
    estimated_level_display = (p_snapshot->>'estimatedLevelDisplay')::NUMERIC,
    display_band            = p_snapshot->>'displayBand',
    lower_bound             = (p_snapshot->>'lowerBound')::NUMERIC,
    upper_bound             = (p_snapshot->>'upperBound')::NUMERIC,
    confidence_score        = v_conf,
    confidence_label        = p_snapshot->'confidence'->>'label',
    primary_style           = p_snapshot->'primaryStyle'->>'label',
    secondary_style         = p_snapshot->'secondaryStyle'->>'label',
    scoring_snapshot        = p_snapshot
  WHERE id = p_attempt_id;

  DELETE FROM public.player_skill_scores WHERE attempt_id = p_attempt_id;
  FOR v_rec IN SELECT * FROM jsonb_array_elements(COALESCE(p_snapshot->'subskills','[]'::jsonb)) LOOP
    INSERT INTO public.player_skill_scores
      (attempt_id, player_id, score_type, score_key, raw_score, display_score, confidence_score, evidence_count, scoring_details)
    VALUES
      (p_attempt_id, v_player, 'subskill', v_rec->>'subskill',
       (v_rec->>'rawLevel')::NUMERIC, (v_rec->>'displayLevel')::NUMERIC,
       (v_rec->>'confidence')::INTEGER, (v_rec->>'evidenceCount')::INTEGER, v_rec);
  END LOOP;

  INSERT INTO public.player_skill_profiles
    (player_id, self_assessed_level, self_assessed_band, self_assessed_at, self_assessment_confidence, provisional_status)
  VALUES (v_player, v_raw, p_snapshot->>'displayBand', now(), v_conf, true)
  ON CONFLICT (player_id) DO UPDATE SET
    self_assessed_level        = EXCLUDED.self_assessed_level,
    self_assessed_band         = EXCLUDED.self_assessed_band,
    self_assessed_at           = EXCLUDED.self_assessed_at,
    self_assessment_confidence = EXCLUDED.self_assessment_confidence,
    updated_at                 = now();

  INSERT INTO public.skill_evidence (player_id, evidence_type, source_id, level_value, confidence_value, submitted_by)
  VALUES (v_player, 'self_assessment', p_attempt_id, v_raw, v_conf, v_player);
END; $$;

REVOKE ALL ON FUNCTION public.apply_skill_scoring_snapshot(UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_skill_scoring_snapshot(UUID, JSONB) TO service_role;