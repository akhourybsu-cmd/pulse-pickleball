DROP FUNCTION IF EXISTS public.merge_guest_players(uuid, uuid);

CREATE FUNCTION public.merge_guest_players(_keep_id uuid, _remove_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_keep public.guest_players%ROWTYPE;
  v_rm public.guest_players%ROWTYPE;
  v_authorized boolean;
BEGIN
  IF _keep_id = _remove_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'same_id');
  END IF;
  SELECT * INTO v_keep FROM public.guest_players WHERE id = _keep_id;
  SELECT * INTO v_rm FROM public.guest_players WHERE id = _remove_id;
  IF v_keep.id IS NULL OR v_rm.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  v_authorized :=
    v_keep.created_by = auth.uid()
    AND v_rm.created_by = auth.uid();

  IF NOT v_authorized AND v_keep.group_id IS NOT NULL AND v_keep.group_id = v_rm.group_id THEN
    SELECT EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_id = v_keep.group_id AND user_id = auth.uid()
        AND role IN ('owner','moderator')
    ) INTO v_authorized;
  END IF;

  IF NOT v_authorized THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  DELETE FROM public.round_robin_players rrp_rm
    USING public.round_robin_players rrp_keep
    WHERE rrp_rm.guest_player_id = _remove_id
      AND rrp_keep.guest_player_id = _keep_id
      AND rrp_keep.event_id = rrp_rm.event_id;

  UPDATE public.round_robin_players
    SET guest_player_id = _keep_id
    WHERE guest_player_id = _remove_id;

  UPDATE public.round_robin_schedule SET a1_guest_id = _keep_id WHERE a1_guest_id = _remove_id;
  UPDATE public.round_robin_schedule SET a2_guest_id = _keep_id WHERE a2_guest_id = _remove_id;
  UPDATE public.round_robin_schedule SET b1_guest_id = _keep_id WHERE b1_guest_id = _remove_id;
  UPDATE public.round_robin_schedule SET b2_guest_id = _keep_id WHERE b2_guest_id = _remove_id;

  UPDATE public.match_participants
    SET guest_player_id = _keep_id
    WHERE guest_player_id = _remove_id;

  IF v_keep.linked_user_id IS NULL AND v_rm.linked_user_id IS NOT NULL THEN
    UPDATE public.guest_players
      SET linked_user_id = v_rm.linked_user_id, linked_at = coalesce(v_rm.linked_at, now())
      WHERE id = _keep_id;
  END IF;

  DELETE FROM public.guest_players WHERE id = _remove_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.merge_guest_players(uuid, uuid) TO authenticated;