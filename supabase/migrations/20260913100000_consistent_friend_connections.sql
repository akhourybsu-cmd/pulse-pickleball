-- Keep old clients compatible while enforcing recipient consent and blocks.
-- No friendship history or user accounts are removed by this migration.
BEGIN;

CREATE OR REPLACE FUNCTION public.guard_friendship_write()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
BEGIN
  IF TG_OP = 'UPDATE' AND (
    NEW.id IS DISTINCT FROM OLD.id OR NEW.user_id IS DISTINCT FROM OLD.user_id OR
    NEW.friend_id IS DISTINCT FROM OLD.friend_id OR NEW.created_at IS DISTINCT FROM OLD.created_at
  ) THEN
    RAISE EXCEPTION 'Connection participants cannot be changed' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    LEAST(NEW.user_id, NEW.friend_id)::text || '|' || GREATEST(NEW.user_id, NEW.friend_id)::text, 0));
  IF public.is_blocked_between(NEW.user_id, NEW.friend_id) THEN
    RAISE EXCEPTION 'This connection is not available' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF v_me IS NOT NULL AND (NEW.user_id <> v_me OR NEW.status <> 'pending') THEN
      RAISE EXCEPTION 'New connections require a friend request' USING ERRCODE = '42501';
    END IF;
    IF EXISTS (SELECT 1 FROM public.friendships f
      WHERE f.user_id = NEW.friend_id AND f.friend_id = NEW.user_id) THEN
      RAISE EXCEPTION 'A connection already exists. Refresh and try again.' USING ERRCODE = '23505';
    END IF;
    IF NEW.status = 'pending' THEN NEW.accepted_at := NULL; END IF;
  ELSE
    IF v_me IS NOT NULL AND NOT (
      OLD.status = 'pending' AND NEW.status = 'accepted' AND OLD.friend_id = v_me
    ) THEN
      RAISE EXCEPTION 'Only the recipient can accept a pending request' USING ERRCODE = '42501';
    END IF;
    IF OLD.status = 'pending' AND NEW.status = 'accepted' THEN NEW.accepted_at := now(); END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_friendship_write() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_guard_friendship_write ON public.friendships;
CREATE TRIGGER trg_guard_friendship_write BEFORE INSERT OR UPDATE ON public.friendships
FOR EACH ROW EXECUTE FUNCTION public.guard_friendship_write();

DROP POLICY IF EXISTS "Users can create friend requests" ON public.friendships;
CREATE POLICY "Users can create friend requests" ON public.friendships
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND status = 'pending');
DROP POLICY IF EXISTS "Users can update their friendships" ON public.friendships;
CREATE POLICY "Users can update their friendships" ON public.friendships
FOR UPDATE TO authenticated USING (auth.uid() = friend_id AND status = 'pending')
WITH CHECK (auth.uid() = friend_id AND status = 'accepted');
DROP POLICY IF EXISTS "Users can delete their friendships" ON public.friendships;
CREATE POLICY "Users can delete their friendships" ON public.friendships
FOR DELETE TO authenticated USING ((auth.uid() = user_id OR auth.uid() = friend_id) AND status <> 'blocked');

-- Direct block inserts from older clients use the same pair lock as requests.
-- Blocking and removing the connection commit together or roll back together.
CREATE OR REPLACE FUNCTION public.disconnect_blocked_players()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> NEW.blocker_id THEN
    RAISE EXCEPTION 'You can only manage your own blocks' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    LEAST(NEW.blocker_id, NEW.blocked_id)::text || '|' || GREATEST(NEW.blocker_id, NEW.blocked_id)::text, 0));
  DELETE FROM public.friendships
  WHERE (user_id = NEW.blocker_id AND friend_id = NEW.blocked_id)
     OR (user_id = NEW.blocked_id AND friend_id = NEW.blocker_id);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.disconnect_blocked_players() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_disconnect_blocked_players ON public.user_blocks;
CREATE TRIGGER trg_disconnect_blocked_players BEFORE INSERT ON public.user_blocks
FOR EACH ROW EXECUTE FUNCTION public.disconnect_blocked_players();

CREATE OR REPLACE FUNCTION public.block_player(p_user_id uuid, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_me uuid := auth.uid();
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF p_user_id IS NULL OR p_user_id = v_me THEN
    RAISE EXCEPTION 'Invalid player' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.user_blocks (blocker_id, blocked_id, reason)
  VALUES (v_me, p_user_id, left(p_reason, 1000))
  ON CONFLICT (blocker_id, blocked_id) DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION public.block_player(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.block_player(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.send_friend_request(p_friend_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_existing record;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF p_friend_id IS NULL OR p_friend_id = v_me THEN
    RAISE EXCEPTION 'Invalid player' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    LEAST(v_me, p_friend_id)::text || '|' || GREATEST(v_me, p_friend_id)::text, 0));
  IF public.is_blocked_between(v_me, p_friend_id) OR
     NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_friend_id) THEN
    RAISE EXCEPTION 'This connection is not available' USING ERRCODE = '42501';
  END IF;
  SELECT id, user_id, friend_id, status INTO v_existing
  FROM public.friendships
  WHERE (user_id = v_me AND friend_id = p_friend_id) OR (user_id = p_friend_id AND friend_id = v_me)
  ORDER BY CASE status WHEN 'blocked' THEN 0 WHEN 'accepted' THEN 1 ELSE 2 END, created_at, id
  LIMIT 1 FOR UPDATE;
  IF FOUND THEN
    IF v_existing.status = 'blocked' THEN
      RAISE EXCEPTION 'This connection is not available' USING ERRCODE = '42501';
    END IF;
    IF v_existing.status = 'pending' AND v_existing.user_id = p_friend_id THEN
      UPDATE public.friendships SET status = 'accepted', accepted_at = now() WHERE id = v_existing.id;
      RETURN 'accepted';
    END IF;
    RETURN v_existing.status;
  END IF;
  INSERT INTO public.friendships (user_id, friend_id, status) VALUES (v_me, p_friend_id, 'pending');
  RETURN 'pending';
END;
$$;
REVOKE ALL ON FUNCTION public.send_friend_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_friend_request(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_friendship_event()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    PERFORM public.enqueue_notification(NEW.friend_id, 'friend_request_received', 'social',
      'New friend request', public.notif_actor_name(NEW.user_id) || ' sent you a friend request',
      '/player/friends?tab=requests', NEW.user_id, jsonb_build_object('friendship_id', NEW.id));
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    UPDATE public.user_notifications SET read = true
    WHERE user_id = NEW.friend_id AND notification_type = 'friend_request_received'
      AND metadata->>'friendship_id' = NEW.id::text AND NOT read;
    PERFORM public.enqueue_notification(NEW.user_id, 'friend_request_accepted', 'social',
      'Friend request accepted', public.notif_actor_name(NEW.friend_id) || ' accepted your friend request',
      '/player/friends', NEW.friend_id, jsonb_build_object('friendship_id', NEW.id));
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_deleted_friend_request()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.user_notifications SET read = true
  WHERE user_id = OLD.friend_id AND notification_type = 'friend_request_received'
    AND metadata->>'friendship_id' = OLD.id::text AND NOT read;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION public.resolve_deleted_friend_request() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_resolve_deleted_friend_request ON public.friendships;
CREATE TRIGGER trg_resolve_deleted_friend_request AFTER DELETE ON public.friendships
FOR EACH ROW EXECUTE FUNCTION public.resolve_deleted_friend_request();

UPDATE public.user_notifications SET link = '/player/friends?tab=requests'
WHERE notification_type = 'friend_request_received' AND link = '/player/friends' AND NOT read;

-- Existing deployments did not consistently publish friendship changes.
-- Read policies continue to restrict inserts/updates to the two participants.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'friendships') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'user_blocks') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.user_blocks;
    END IF;
  END IF;
END;
$$;

COMMIT;
