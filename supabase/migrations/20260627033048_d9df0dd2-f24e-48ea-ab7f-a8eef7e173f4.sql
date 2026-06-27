CREATE OR REPLACE FUNCTION public.merge_guest_players(p_keep_id uuid, p_remove_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_keep    record;
  v_remove  record;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_keep_id = p_remove_id THEN
    RAISE EXCEPTION 'Cannot merge a guest into itself';
  END IF;
  SELECT * INTO v_keep FROM guest_players WHERE id = p_keep_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Kept guest not found'; END IF;
  SELECT * INTO v_remove FROM guest_players WHERE id = p_remove_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Removed guest not found'; END IF;

  IF NOT public.has_role(v_user_id, 'admin'::app_role) THEN
    IF v_keep.created_by <> v_user_id OR v_remove.created_by <> v_user_id THEN
      RAISE EXCEPTION 'Not authorized to merge these guests' USING ERRCODE = '42501';
    END IF;
  END IF;
  IF v_keep.created_by <> v_remove.created_by THEN
    RAISE EXCEPTION 'Guests must share the same creator to be merged';
  END IF;

  -- Round robin rosters: remove duplicate roster row in same event before remapping.
  DELETE FROM round_robin_players rrp_dup
   WHERE rrp_dup.guest_player_id = p_remove_id
     AND EXISTS (
       SELECT 1 FROM round_robin_players rrp_keep
       WHERE rrp_keep.event_id = rrp_dup.event_id
         AND rrp_keep.guest_player_id = p_keep_id
     );
  UPDATE round_robin_players
     SET guest_player_id = p_keep_id
   WHERE guest_player_id = p_remove_id;

  -- Round robin schedule seats: remap every seat that referenced the removed guest.
  UPDATE round_robin_schedule SET a1_guest_id = p_keep_id WHERE a1_guest_id = p_remove_id;
  UPDATE round_robin_schedule SET a2_guest_id = p_keep_id WHERE a2_guest_id = p_remove_id;
  UPDATE round_robin_schedule SET b1_guest_id = p_keep_id WHERE b1_guest_id = p_remove_id;
  UPDATE round_robin_schedule SET b2_guest_id = p_keep_id WHERE b2_guest_id = p_remove_id;

  -- Casual match participants.
  UPDATE match_participants
     SET guest_player_id = p_keep_id
   WHERE guest_player_id = p_remove_id;

  UPDATE guest_claim_invites
     SET guest_player_id = p_keep_id
   WHERE guest_player_id = p_remove_id;

  IF v_remove.linked_user_id IS NOT NULL AND v_keep.linked_user_id IS NULL THEN
    UPDATE guest_players
       SET linked_user_id = v_remove.linked_user_id,
           linked_at = COALESCE(v_remove.linked_at, now())
     WHERE id = p_keep_id;
  END IF;

  DELETE FROM guest_players WHERE id = p_remove_id;

  RETURN p_keep_id;
END;
$function$;