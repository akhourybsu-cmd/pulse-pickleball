CREATE OR REPLACE FUNCTION public.ladder_replace_player(
  p_season_id   UUID,
  p_out_user_id UUID,
  p_in_user_id  UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user      UUID := auth.uid();
  v_league_id UUID;
  v_snap_id   UUID;
  v_order     UUID[];
  v_new_order UUID[];
  v_is_mem    BOOLEAN;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  IF p_out_user_id IS NULL OR p_in_user_id IS NULL OR p_out_user_id = p_in_user_id THEN
    RAISE EXCEPTION 'Pick a different player to bring in' USING ERRCODE = '22023';
  END IF;

  SELECT league_id INTO v_league_id FROM public.league_seasons WHERE id = p_season_id;
  IF v_league_id IS NULL THEN
    RAISE EXCEPTION 'Season not found' USING ERRCODE = '02000';
  END IF;
  IF NOT public.is_league_admin(v_league_id, v_user) THEN
    RAISE EXCEPTION 'League admin privileges required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.ladder_batches WHERE season_id = p_season_id) THEN
    RAISE EXCEPTION 'Start the ladder first — before Week 1, edit the roster on the Players tab'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.ladder_batches
     WHERE season_id = p_season_id
       AND status IN ('generated', 'in_progress', 'complete')
  ) THEN
    RAISE EXCEPTION 'Process (or reopen) the current round before replacing a player'
      USING ERRCODE = '22023';
  END IF;

  SELECT id, player_ids INTO v_snap_id, v_order
    FROM public.ladder_snapshots
   WHERE season_id = p_season_id
   ORDER BY week_number DESC, batch_number DESC, (kind = 'batch_result') DESC
   LIMIT 1
   FOR UPDATE;
  IF v_snap_id IS NULL THEN
    RAISE EXCEPTION 'This ladder has no standings yet' USING ERRCODE = '22023';
  END IF;

  IF NOT (p_out_user_id = ANY(v_order)) THEN
    RAISE EXCEPTION 'That player is not on the ladder' USING ERRCODE = '22023';
  END IF;
  IF p_in_user_id = ANY(v_order) THEN
    RAISE EXCEPTION 'The replacement is already on the ladder' USING ERRCODE = '22023';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.league_members
     WHERE league_id = v_league_id AND season_id = p_season_id
       AND user_id = p_in_user_id AND status = 'active'
  ) INTO v_is_mem;
  IF NOT v_is_mem THEN
    RAISE EXCEPTION 'The replacement must be an active member of this season'
      USING ERRCODE = '22023';
  END IF;

  v_new_order := array_replace(v_order, p_out_user_id, p_in_user_id);
  UPDATE public.ladder_snapshots SET player_ids = v_new_order WHERE id = v_snap_id;

  UPDATE public.league_members
     SET status = 'removed', updated_at = now()
   WHERE league_id = v_league_id AND season_id = p_season_id
     AND user_id = p_out_user_id AND status = 'active';

  INSERT INTO public.league_audit_log
    (league_id, season_id, actor_user_id, action, entity_type, entity_id, new_value)
  VALUES (
    v_league_id, p_season_id, v_user,
    'ladder.player_replaced', 'ladder_season', p_season_id,
    jsonb_build_object('out_user_id', p_out_user_id, 'in_user_id', p_in_user_id)
  );

  RETURN jsonb_build_object('ok', true, 'order', to_jsonb(v_new_order));
END;
$$;

GRANT EXECUTE ON FUNCTION public.ladder_replace_player(UUID, UUID, UUID) TO authenticated;

COMMENT ON FUNCTION public.ladder_replace_player IS
  'Swap a mid-season dropout for an active-member replacement in the current ladder order (latest snapshot), preserving rung and the multiple-of-four count. Allowed only between rounds (no un-finalized batch). Takes effect from the next generated batch.';