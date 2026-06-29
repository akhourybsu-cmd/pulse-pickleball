-- =====================================================================
-- Friend-request bidirectional race (Phase 2.B.2).
--
-- The current client-side useFriends.sendFriendRequest does:
--   1. SELECT to see if either direction exists
--   2. INSERT a pending row if not
-- which races when both users hit "Send" at the same time. The
-- existing UNIQUE(user_id, friend_id) constraint is directional, so
-- two rows in opposite directions both pass and the users see each
-- other as "pending sent" indefinitely.
--
-- This RPC consolidates the logic server-side under a canonical-pair
-- advisory lock. Behavior:
--   • Reverse-direction pending exists → accept it and return
--     'accepted' (instant mutual friend on the race).
--   • Same-direction pending exists → idempotent, return 'pending'.
--   • Either side accepted → return 'accepted'.
--   • Either side blocked → reject with a generic message.
--   • Otherwise → insert new pending row, return 'pending'.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.send_friend_request(p_friend_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    UUID := auth.uid();
  v_existing   RECORD;
  v_lock_key   BIGINT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_friend_id IS NULL THEN
    RAISE EXCEPTION 'Recipient required' USING ERRCODE = '22023';
  END IF;
  IF p_friend_id = v_user_id THEN
    RAISE EXCEPTION 'Cannot send a friend request to yourself' USING ERRCODE = '22023';
  END IF;

  -- Canonical-pair lock so concurrent A→B and B→A serialize.
  v_lock_key := hashtextextended(
    LEAST(v_user_id, p_friend_id)::text || '|' ||
    GREATEST(v_user_id, p_friend_id)::text,
    0
  );
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Look up any existing friendship in either direction.
  SELECT id, user_id, friend_id, status INTO v_existing
    FROM public.friendships
   WHERE (user_id = v_user_id   AND friend_id = p_friend_id)
      OR (user_id = p_friend_id AND friend_id = v_user_id)
   LIMIT 1;

  IF FOUND THEN
    IF v_existing.status = 'blocked' THEN
      RAISE EXCEPTION 'Unable to send friend request' USING ERRCODE = '42501';
    END IF;

    -- Reverse-direction pending → caller is accepting what the other
    -- side already sent. Flip to accepted in-place.
    IF v_existing.status = 'pending'
       AND v_existing.user_id = p_friend_id THEN
      UPDATE public.friendships
         SET status = 'accepted', accepted_at = now()
       WHERE id = v_existing.id;
      RETURN 'accepted';
    END IF;

    -- Same-direction pending or already accepted → idempotent no-op,
    -- report the current state so the client can show the right copy.
    RETURN v_existing.status;
  END IF;

  -- Fresh request.
  INSERT INTO public.friendships (user_id, friend_id, status)
  VALUES (v_user_id, p_friend_id, 'pending');

  RETURN 'pending';
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_friend_request(UUID) TO authenticated;
