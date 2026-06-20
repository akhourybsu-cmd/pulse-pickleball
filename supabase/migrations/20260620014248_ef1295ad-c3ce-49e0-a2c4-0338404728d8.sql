-- =========================================================
-- 1. user_blocks
-- =========================================================
CREATE TABLE IF NOT EXISTS public.user_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_blocks_not_self CHECK (blocker_id <> blocked_id),
  CONSTRAINT user_blocks_unique UNIQUE (blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS user_blocks_blocker_idx ON public.user_blocks (blocker_id);
CREATE INDEX IF NOT EXISTS user_blocks_blocked_idx ON public.user_blocks (blocked_id);

GRANT SELECT, INSERT, DELETE ON public.user_blocks TO authenticated;
GRANT ALL ON public.user_blocks TO service_role;

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see blocks involving themselves"
  ON public.user_blocks FOR SELECT TO authenticated
  USING (auth.uid() = blocker_id OR auth.uid() = blocked_id);

CREATE POLICY "Users can create their own blocks"
  ON public.user_blocks FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "Users can remove their own blocks"
  ON public.user_blocks FOR DELETE TO authenticated
  USING (auth.uid() = blocker_id);

-- =========================================================
-- 2. message_reports
-- =========================================================
CREATE TABLE IF NOT EXISTS public.message_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  message_id uuid REFERENCES public.direct_messages(id) ON DELETE SET NULL,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id),
  CONSTRAINT message_reports_not_self CHECK (reporter_id <> reported_user_id)
);

CREATE INDEX IF NOT EXISTS message_reports_reporter_idx ON public.message_reports (reporter_id);
CREATE INDEX IF NOT EXISTS message_reports_reported_idx ON public.message_reports (reported_user_id);
CREATE INDEX IF NOT EXISTS message_reports_status_idx ON public.message_reports (status);

GRANT SELECT, INSERT ON public.message_reports TO authenticated;
GRANT ALL ON public.message_reports TO service_role;

ALTER TABLE public.message_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reporters can see their own reports"
  ON public.message_reports FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can file reports"
  ON public.message_reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Admins can update reports"
  ON public.message_reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- 3. user_messaging_prefs
-- =========================================================
CREATE TABLE IF NOT EXISTS public.user_messaging_prefs (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  dm_privacy text NOT NULL DEFAULT 'friends',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_messaging_prefs_dm_privacy_check
    CHECK (dm_privacy IN ('friends', 'nobody'))
);

GRANT SELECT, INSERT, UPDATE ON public.user_messaging_prefs TO authenticated;
GRANT ALL ON public.user_messaging_prefs TO service_role;

ALTER TABLE public.user_messaging_prefs ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated may read another user's privacy choice so the UI/RPC
-- can show "this user is not accepting messages". Only the field itself is
-- exposed.
CREATE POLICY "Authenticated users can read messaging prefs"
  ON public.user_messaging_prefs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users manage their own messaging prefs"
  ON public.user_messaging_prefs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update their own messaging prefs"
  ON public.user_messaging_prefs FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER user_messaging_prefs_updated_at
  BEFORE UPDATE ON public.user_messaging_prefs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 4. conversation_participants: mute + leave
-- =========================================================
ALTER TABLE public.conversation_participants
  ADD COLUMN IF NOT EXISTS is_muted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS left_at timestamptz;

-- =========================================================
-- 5. Helper functions
-- =========================================================
CREATE OR REPLACE FUNCTION public.is_blocked_between(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_blocks
     WHERE (blocker_id = _a AND blocked_id = _b)
        OR (blocker_id = _b AND blocked_id = _a)
  );
$$;

CREATE OR REPLACE FUNCTION public.are_friends(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships
     WHERE status = 'accepted'
       AND ((user_id = _a AND friend_id = _b)
         OR (user_id = _b AND friend_id = _a))
  );
$$;

-- =========================================================
-- 6. Friend-only DM RPC (replaces existing one)
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_or_create_dm_conversation(other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_existing uuid;
  v_new uuid;
  v_their_privacy text;
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

-- =========================================================
-- 7. Tighten direct_messages INSERT policy
-- =========================================================
DROP POLICY IF EXISTS "Users can send messages to their conversations" ON public.direct_messages;

CREATE POLICY "Active, unblocked participants can send messages"
  ON public.direct_messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.conversation_participants cp
       WHERE cp.conversation_id = direct_messages.conversation_id
         AND cp.user_id = auth.uid()
         AND cp.left_at IS NULL
    )
    AND NOT EXISTS (
      SELECT 1
        FROM public.conversation_participants other
        JOIN public.user_blocks ub
          ON (ub.blocker_id = auth.uid() AND ub.blocked_id = other.user_id)
          OR (ub.blocker_id = other.user_id AND ub.blocked_id = auth.uid())
       WHERE other.conversation_id = direct_messages.conversation_id
         AND other.user_id <> auth.uid()
    )
  );

-- =========================================================
-- 8. Block existing DM notifications between blocked users
-- enqueue_notification already exits early on user prefs; add block check.
-- =========================================================
CREATE OR REPLACE FUNCTION public.enqueue_notification(
  p_user_id uuid, p_type text, p_category text, p_title text, p_message text,
  p_link text DEFAULT NULL, p_actor_id uuid DEFAULT NULL, p_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_enabled boolean;
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;
  IF p_actor_id IS NOT NULL AND p_actor_id = p_user_id THEN RETURN; END IF;

  -- Suppress notifications when either side has blocked the other.
  IF p_actor_id IS NOT NULL AND public.is_blocked_between(p_user_id, p_actor_id) THEN
    RETURN;
  END IF;

  SELECT in_app_enabled INTO v_enabled
    FROM public.notification_preferences
   WHERE user_id = p_user_id AND category = p_category
   LIMIT 1;

  IF v_enabled IS NOT NULL AND v_enabled = false THEN RETURN; END IF;

  INSERT INTO public.user_notifications
    (user_id, notification_type, category, priority, title, message, link, actor_id, metadata, read)
  VALUES
    (p_user_id, p_type, p_category, 'normal', p_title, p_message,
     p_link, p_actor_id, COALESCE(p_metadata, '{}'::jsonb), false);
END;
$$;