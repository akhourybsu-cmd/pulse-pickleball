CREATE OR REPLACE FUNCTION public.admin_score_ladder_batch(p_batch_id uuid, p_scores jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user    UUID := auth.uid();
  v_batch   RECORD;
  v_row     JSONB;
  v_count   INT := 0;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='28000'; END IF;
  SELECT * INTO v_batch FROM public.ladder_batches WHERE id = p_batch_id;
  IF v_batch.id IS NULL THEN RAISE EXCEPTION 'Batch not found' USING ERRCODE='02000'; END IF;
  IF NOT public.is_league_admin(v_batch.league_id, v_user) THEN
    RAISE EXCEPTION 'League admin privileges required' USING ERRCODE='42501';
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_scores)
  LOOP
    UPDATE public.league_matches m
       SET team_a_score = (v_row->>'a')::int,
           team_b_score = (v_row->>'b')::int,
           status = 'verified',
           score_submitted_by = v_user,
           score_submitted_at = now(),
           verified_by = v_user,
           verified_at = now(),
           updated_at = now()
     WHERE m.id = (v_row->>'id')::uuid
       AND m.ladder_batch_group_id IN (SELECT id FROM public.ladder_batch_groups WHERE batch_id = p_batch_id);
    IF FOUND THEN v_count := v_count + 1; END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_score_ladder_batch(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_score_ladder_batch(uuid, jsonb) TO authenticated, service_role;