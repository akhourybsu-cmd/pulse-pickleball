-- =====================================================================
-- merge_guest_players: repoint ALL references before deleting.
--
-- The original version (20260626194346) repointed round_robin_players
-- rows and then deleted the removed guest_players record — but schedule
-- seats (round_robin_schedule.*_guest_id) and match history
-- (match_participants.guest_player_id) both reference guest_players
-- with ON DELETE SET NULL. If the removed record had any scored
-- matches, the merge silently nulled those seats and history rows,
-- destroying data. This version repoints both tables to the kept
-- guest first, so merging is safe regardless of which duplicate is
-- chosen as the keeper.
--
-- (The companion client fix corrects the RPC call in MyGuests, which
-- passed p_keep_id/p_remove_id against a (_keep_id, _remove_id)
-- signature — PostgREST resolves functions by named arguments, so the
-- merge button has never actually worked.)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.merge_guest_players(_keep_id uuid, _remove_id uuid)
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

  -- Roster rows: drop the removed guest's row wherever the kept guest is
  -- already registered for the same event, then repoint the rest.
  DELETE FROM public.round_robin_players rrp_rm
    USING public.round_robin_players rrp_keep
    WHERE rrp_rm.guest_player_id = _remove_id
      AND rrp_keep.guest_player_id = _keep_id
      AND rrp_keep.event_id = rrp_rm.event_id;

  UPDATE public.round_robin_players
    SET guest_player_id = _keep_id
    WHERE guest_player_id = _remove_id;

  -- Schedule seats: repoint every seat held by the removed guest. Without
  -- this, deleting the record SET NULLs the seat (empty slot in scored
  -- matches).
  UPDATE public.round_robin_schedule SET a1_guest_id = _keep_id WHERE a1_guest_id = _remove_id;
  UPDATE public.round_robin_schedule SET a2_guest_id = _keep_id WHERE a2_guest_id = _remove_id;
  UPDATE public.round_robin_schedule SET b1_guest_id = _keep_id WHERE b1_guest_id = _remove_id;
  UPDATE public.round_robin_schedule SET b2_guest_id = _keep_id WHERE b2_guest_id = _remove_id;

  -- Match history: repoint participant rows so past matches keep naming
  -- the merged guest instead of losing the reference.
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
