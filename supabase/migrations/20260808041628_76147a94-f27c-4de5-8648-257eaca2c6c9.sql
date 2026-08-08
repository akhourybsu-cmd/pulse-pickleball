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

  v_lock_key := hashtextextended(
    LEAST(v_user_id, p_friend_id)::text || '|' ||
    GREATEST(v_user_id, p_friend_id)::text,
    0
  );
  PERFORM pg_advisory_xact_lock(v_lock_key);

  SELECT id, user_id, friend_id, status INTO v_existing
    FROM public.friendships
   WHERE (user_id = v_user_id   AND friend_id = p_friend_id)
      OR (user_id = p_friend_id AND friend_id = v_user_id)
   LIMIT 1;

  IF FOUND THEN
    IF v_existing.status = 'blocked' THEN
      RAISE EXCEPTION 'Unable to send friend request' USING ERRCODE = '42501';
    END IF;

    IF v_existing.status = 'pending'
       AND v_existing.user_id = p_friend_id THEN
      UPDATE public.friendships
         SET status = 'accepted', accepted_at = now()
       WHERE id = v_existing.id;
      RETURN 'accepted';
    END IF;

    RETURN v_existing.status;
  END IF;

  INSERT INTO public.friendships (user_id, friend_id, status)
  VALUES (v_user_id, p_friend_id, 'pending');

  RETURN 'pending';
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_friend_request(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_or_create_dm_conversation(other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_existing uuid;
  v_new uuid;
  v_their_privacy text;
  v_lock_key bigint;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF other_user_id IS NULL OR other_user_id = v_me THEN
    RAISE EXCEPTION 'Invalid recipient' USING ERRCODE = '22023';
  END IF;

  IF public.is_blocked_between(v_me, other_user_id) THEN
    RAISE EXCEPTION 'You can''t message this user' USING ERRCODE = '42501';
  END IF;

  IF NOT public.are_friends(v_me, other_user_id) THEN
    RAISE EXCEPTION 'You can only message friends' USING ERRCODE = '42501';
  END IF;

  SELECT dm_privacy INTO v_their_privacy
    FROM public.user_messaging_prefs WHERE user_id = other_user_id;
  IF v_their_privacy = 'nobody' THEN
    RAISE EXCEPTION 'This user is not accepting messages' USING ERRCODE = '42501';
  END IF;

  v_lock_key := hashtextextended(
    'dm|' || LEAST(v_me, other_user_id)::text || '|' ||
    GREATEST(v_me, other_user_id)::text,
    0
  );
  PERFORM pg_advisory_xact_lock(v_lock_key);

  SELECT cp1.conversation_id INTO v_existing
    FROM public.conversation_participants cp1
    JOIN public.conversation_participants cp2
      ON cp2.conversation_id = cp1.conversation_id
   WHERE cp1.user_id = v_me
     AND cp2.user_id = other_user_id
     AND (SELECT count(*) FROM public.conversation_participants
           WHERE conversation_id = cp1.conversation_id) = 2
   LIMIT 1;

  IF v_existing IS NOT NULL THEN
    UPDATE public.conversation_participants
       SET left_at = NULL
     WHERE conversation_id = v_existing
       AND user_id IN (v_me, other_user_id)
       AND left_at IS NOT NULL;
    RETURN v_existing;
  END IF;

  INSERT INTO public.conversations DEFAULT VALUES RETURNING id INTO v_new;
  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES (v_new, v_me), (v_new, other_user_id);
  RETURN v_new;
END;
$$;

DROP POLICY IF EXISTS "Users can create conversation participations"
  ON public.conversation_participants;

CREATE OR REPLACE FUNCTION public.lookup_player_by_handle(_handle text)
RETURNS TABLE (
  id uuid,
  display_name text,
  full_name text,
  avatar_url text,
  current_rating numeric,
  handle text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.display_name, p.full_name, p.avatar_url, p.current_rating, p.handle
  FROM public.profiles p
  WHERE lower(p.handle) = lower(regexp_replace(coalesce(_handle, ''), '^@', ''))
    AND p.id <> auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.user_blocks ub
       WHERE (ub.blocker_id = auth.uid() AND ub.blocked_id = p.id)
          OR (ub.blocker_id = p.id AND ub.blocked_id = auth.uid())
    )
  LIMIT 1;
$$;