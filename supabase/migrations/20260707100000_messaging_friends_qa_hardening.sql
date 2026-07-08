-- =====================================================================
-- Messaging + Friends QA hardening (2026-07-07 audit).
--
-- 1. get_or_create_dm_conversation: serialize concurrent calls for the
--    same user pair under an advisory lock. The SELECT-then-INSERT in
--    the current version races — two simultaneous calls (double-tap,
--    two tabs) both miss the existing-conversation check and create
--    two conversations for the same pair, fragmenting message history.
--    Same canonical-pair lock pattern as send_friend_request.
--
-- 2. conversation_participants INSERT policy: the original policy was
--    WITH CHECK (true), letting any authenticated user insert
--    themselves into any conversation_id they learn. All legitimate
--    participant rows are created by the SECURITY DEFINER RPC (which
--    bypasses RLS), and the client never inserts directly — so drop
--    the policy entirely. No INSERT policy = direct inserts denied.
--
-- 3. suggest_friends / search_connectable_users /
--    lookup_player_by_handle: none of these checked user_blocks, so a
--    user you blocked (or who blocked you) still appeared in
--    suggestions, search, and @handle lookup. blockUser deletes the
--    friendships row and records the block in user_blocks, so the
--    friendships.status = 'blocked' exclusion never matches. Add a
--    user_blocks check (both directions) to all three.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. DM conversation dedupe under concurrency
-- ---------------------------------------------------------------------
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

  -- Canonical-pair advisory lock: concurrent calls for the same pair
  -- (either direction) serialize here, so the existence check below is
  -- race-free and at most one conversation per pair is ever created.
  v_lock_key := hashtextextended(
    'dm|' || LEAST(v_me, other_user_id)::text || '|' ||
    GREATEST(v_me, other_user_id)::text,
    0
  );
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Reuse existing 1-on-1 conversation
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
    -- If either side previously "left", re-activate.
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

-- ---------------------------------------------------------------------
-- 2. Close the open conversation_participants INSERT policy
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can create conversation participations"
  ON public.conversation_participants;

-- ---------------------------------------------------------------------
-- 3a. suggest_friends — exclude blocked users (either direction)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.suggest_friends()
RETURNS TABLE (
  id uuid,
  display_name text,
  full_name text,
  avatar_url text,
  current_rating numeric,
  handle text,
  reason text,
  weight int
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT mp2.player_id AS uid, 'Played together'::text AS reason, 10 AS weight
    FROM public.match_participants mp1
    JOIN public.match_participants mp2
      ON mp2.match_id = mp1.match_id AND mp2.player_id <> me
    WHERE mp1.player_id = me
    UNION ALL
    SELECT rp2.player_id AS uid, 'Played round robin'::text AS reason, 9 AS weight
    FROM public.round_robin_players rp1
    JOIN public.round_robin_players rp2
      ON rp2.event_id = rp1.event_id AND rp2.player_id <> me
    WHERE rp1.player_id = me
      AND rp1.active = true
      AND rp2.active = true
    UNION ALL
    SELECT CASE WHEN f2.user_id IN (fr.user_id, fr.friend_id) THEN f2.friend_id ELSE f2.user_id END,
           'Mutual friend'::text, 8
    FROM public.friendships fr
    JOIN public.friendships f2
      ON f2.status = 'accepted'
     AND (f2.user_id IN (fr.user_id, fr.friend_id) OR f2.friend_id IN (fr.user_id, fr.friend_id))
    WHERE fr.status = 'accepted'
      AND (fr.user_id = me OR fr.friend_id = me)
    UNION ALL
    SELECT gm2.user_id, 'Shared group'::text, 5
    FROM public.group_members gm1
    JOIN public.group_members gm2 ON gm2.group_id = gm1.group_id AND gm2.user_id <> me
    WHERE gm1.user_id = me
    UNION ALL
    SELECT tr2.user_id, 'Shared tournament'::text, 4
    FROM public.tournament_registrations tr1
    JOIN public.tournament_registrations tr2
      ON tr2.tournament_event_id = tr1.tournament_event_id AND tr2.user_id <> me
    WHERE tr1.user_id = me
    UNION ALL
    SELECT er2.user_id, 'Shared event'::text, 3
    FROM public.calendar_event_registrations er1
    JOIN public.calendar_event_registrations er2
      ON er2.event_id = er1.event_id AND er2.user_id <> me
    WHERE er1.user_id = me
  ),
  excluded AS (
    SELECT CASE WHEN user_id = me THEN friend_id ELSE user_id END AS uid
    FROM public.friendships
    WHERE (user_id = me OR friend_id = me)
      AND status IN ('accepted', 'pending', 'blocked')
    UNION
    SELECT dismissed_user_id AS uid
    FROM public.friend_suggestion_dismissals
    WHERE user_id = me
    UNION
    -- Blocks live in user_blocks, not friendships (blockUser deletes
    -- the friendship row), so they must be excluded here explicitly.
    SELECT CASE WHEN blocker_id = me THEN blocked_id ELSE blocker_id END AS uid
    FROM public.user_blocks
    WHERE blocker_id = me OR blocked_id = me
  ),
  aggregated AS (
    SELECT uid, sum(weight)::int AS total_weight, count(*)::int AS hits
    FROM candidates
    WHERE uid IS NOT NULL
      AND uid NOT IN (SELECT uid FROM excluded WHERE uid IS NOT NULL)
    GROUP BY uid
  )
  SELECT p.id, p.display_name, p.full_name, p.avatar_url, p.current_rating, p.handle,
         (SELECT c.reason FROM candidates c WHERE c.uid = a.uid ORDER BY c.weight DESC LIMIT 1) AS reason,
         a.total_weight AS weight
  FROM aggregated a
  JOIN public.profiles p ON p.id = a.uid
  ORDER BY a.total_weight DESC, a.hits DESC
  LIMIT 24;
END;
$$;

-- ---------------------------------------------------------------------
-- 3b. search_connectable_users — exclude blocked users
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_connectable_users(_query text)
RETURNS TABLE (
  id uuid,
  display_name text,
  full_name text,
  avatar_url text,
  current_rating numeric,
  handle text,
  reason text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE me uuid := auth.uid(); q text;
BEGIN
  IF me IS NULL THEN RETURN; END IF;
  q := trim(coalesce(_query, ''));
  IF length(q) < 2 THEN RETURN; END IF;

  RETURN QUERY
  WITH connected AS (
    SELECT DISTINCT CASE WHEN f2.user_id = fr.friend_id THEN f2.friend_id ELSE f2.user_id END AS uid,
           'Mutual friend'::text AS reason
    FROM public.friendships fr
    JOIN public.friendships f2
      ON f2.status = 'accepted'
     AND (f2.user_id IN (fr.user_id, fr.friend_id) OR f2.friend_id IN (fr.user_id, fr.friend_id))
    WHERE fr.status = 'accepted'
      AND (fr.user_id = me OR fr.friend_id = me)
    UNION
    SELECT DISTINCT gm2.user_id, 'Shared group'::text
    FROM public.group_members gm1
    JOIN public.group_members gm2 ON gm2.group_id = gm1.group_id AND gm2.user_id <> me
    WHERE gm1.user_id = me
    UNION
    SELECT DISTINCT er2.user_id, 'Shared event'::text
    FROM public.calendar_event_registrations er1
    JOIN public.calendar_event_registrations er2 ON er2.event_id = er1.event_id AND er2.user_id <> me
    WHERE er1.user_id = me
    UNION
    SELECT DISTINCT tr2.user_id, 'Shared tournament'::text
    FROM public.tournament_registrations tr1
    JOIN public.tournament_registrations tr2 ON tr2.tournament_event_id = tr1.tournament_event_id AND tr2.user_id <> me
    WHERE tr1.user_id = me
    UNION
    SELECT DISTINCT mp2.player_id, 'Played together'::text
    FROM public.match_participants mp1
    JOIN public.match_participants mp2
      ON mp2.match_id = mp1.match_id AND mp2.player_id <> me
    WHERE mp1.player_id = me
  )
  SELECT p.id, p.display_name, p.full_name, p.avatar_url, p.current_rating, p.handle,
         min(c.reason) AS reason
  FROM connected c
  JOIN public.profiles p ON p.id = c.uid
  WHERE p.id <> me
    AND NOT EXISTS (
      SELECT 1 FROM public.user_blocks ub
       WHERE (ub.blocker_id = me AND ub.blocked_id = p.id)
          OR (ub.blocker_id = p.id AND ub.blocked_id = me)
    )
    AND (
      p.display_name ILIKE '%' || q || '%'
      OR p.full_name ILIKE '%' || q || '%'
      OR p.handle ILIKE '%' || regexp_replace(q, '^@', '') || '%'
    )
  GROUP BY p.id, p.display_name, p.full_name, p.avatar_url, p.current_rating, p.handle
  LIMIT 20;
END;
$$;

-- ---------------------------------------------------------------------
-- 3c. lookup_player_by_handle — exclude blocked users
-- ---------------------------------------------------------------------
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
