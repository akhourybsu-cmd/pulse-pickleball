-- =====================================================================
-- Helper: insert a user_notifications row, respecting per-category
-- in_app_enabled preference (default ON when no row exists).
-- Push fan-out happens automatically via the existing
-- on_user_notification_dispatch_push trigger.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.enqueue_notification(
  p_user_id uuid,
  p_type text,
  p_category text,
  p_title text,
  p_message text,
  p_link text DEFAULT NULL,
  p_actor_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled boolean;
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;
  IF p_actor_id IS NOT NULL AND p_actor_id = p_user_id THEN RETURN; END IF;

  SELECT in_app_enabled INTO v_enabled
  FROM public.notification_preferences
  WHERE user_id = p_user_id AND category = p_category
  LIMIT 1;

  IF v_enabled IS NOT NULL AND v_enabled = false THEN
    RETURN;
  END IF;

  INSERT INTO public.user_notifications
    (user_id, notification_type, category, priority, title, message, link, actor_id, metadata, read)
  VALUES
    (p_user_id, p_type, p_category, 'normal', p_title, p_message,
     p_link, p_actor_id, COALESCE(p_metadata, '{}'::jsonb), false);
END;
$$;

-- =====================================================================
-- Helper: short preview from message text (first 80 chars, single line)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.notif_preview(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_text IS NULL THEN ''
    WHEN length(regexp_replace(p_text, E'[\\n\\r]+', ' ', 'g')) > 80
      THEN substring(regexp_replace(p_text, E'[\\n\\r]+', ' ', 'g') from 1 for 80) || '…'
    ELSE regexp_replace(p_text, E'[\\n\\r]+', ' ', 'g')
  END;
$$;

-- =====================================================================
-- Helper: best-effort display name for an actor
-- =====================================================================
CREATE OR REPLACE FUNCTION public.notif_actor_name(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(NULLIF(display_name, ''), NULLIF(full_name, ''), 'Someone')
  FROM public.profiles WHERE id = p_user_id;
$$;

-- =====================================================================
-- 1) New group post → notify all other active group members
-- =====================================================================
CREATE OR REPLACE FUNCTION public.notify_group_post_new()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_name text;
  v_actor text;
  v_member record;
BEGIN
  SELECT name INTO v_group_name FROM public.groups WHERE id = NEW.group_id;
  v_actor := public.notif_actor_name(NEW.user_id);

  FOR v_member IN
    SELECT gm.user_id
    FROM public.group_members gm
    LEFT JOIN public.group_notification_prefs gnp
      ON gnp.group_id = gm.group_id AND gnp.user_id = gm.user_id
    WHERE gm.group_id = NEW.group_id
      AND gm.status = 'active'
      AND gm.user_id <> NEW.user_id
      AND COALESCE(gnp.posts_enabled, true) = true
  LOOP
    PERFORM public.enqueue_notification(
      v_member.user_id,
      'group_post_new',
      'community',
      'New post in ' || COALESCE(v_group_name, 'your group'),
      v_actor || ': ' || public.notif_preview(COALESCE(NEW.title, NEW.content, '')),
      '/player/community/group/' || NEW.group_id::text,
      NEW.user_id,
      jsonb_build_object('group_id', NEW.group_id, 'post_id', NEW.id)
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_group_post_new ON public.group_posts;
CREATE TRIGGER trg_notify_group_post_new
AFTER INSERT ON public.group_posts
FOR EACH ROW EXECUTE FUNCTION public.notify_group_post_new();

-- =====================================================================
-- 2) New group event → notify all other active group members
-- =====================================================================
CREATE OR REPLACE FUNCTION public.notify_group_event_new()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_name text;
  v_member record;
  v_when text;
BEGIN
  SELECT name INTO v_group_name FROM public.groups WHERE id = NEW.group_id;
  v_when := to_char(NEW.start_time AT TIME ZONE 'UTC', 'Mon DD');

  FOR v_member IN
    SELECT gm.user_id
    FROM public.group_members gm
    LEFT JOIN public.group_notification_prefs gnp
      ON gnp.group_id = gm.group_id AND gnp.user_id = gm.user_id
    WHERE gm.group_id = NEW.group_id
      AND gm.status = 'active'
      AND gm.user_id <> NEW.created_by
      AND COALESCE(gnp.events_enabled, true) = true
  LOOP
    PERFORM public.enqueue_notification(
      v_member.user_id,
      'group_event_new',
      'community',
      'New event in ' || COALESCE(v_group_name, 'your group'),
      COALESCE(NEW.title, 'Untitled event') || ' • ' || v_when,
      '/player/community/group/' || NEW.group_id::text,
      NEW.created_by,
      jsonb_build_object('group_id', NEW.group_id, 'event_id', NEW.id)
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_group_event_new ON public.group_events;
CREATE TRIGGER trg_notify_group_event_new
AFTER INSERT ON public.group_events
FOR EACH ROW EXECUTE FUNCTION public.notify_group_event_new();

-- =====================================================================
-- 3) Friend request received (INSERT with status pending)
-- 4) Friend request accepted (UPDATE pending → accepted)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.notify_friendship_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor text;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    v_actor := public.notif_actor_name(NEW.user_id);
    PERFORM public.enqueue_notification(
      NEW.friend_id,
      'friend_request_received',
      'social',
      'New friend request',
      v_actor || ' sent you a friend request',
      '/player/friends',
      NEW.user_id,
      jsonb_build_object('friendship_id', NEW.id)
    );
  ELSIF TG_OP = 'UPDATE'
        AND NEW.status = 'accepted'
        AND COALESCE(OLD.status, '') <> 'accepted' THEN
    -- Notify the original requester (user_id) that friend_id accepted
    v_actor := public.notif_actor_name(NEW.friend_id);
    PERFORM public.enqueue_notification(
      NEW.user_id,
      'friend_request_accepted',
      'social',
      'Friend request accepted',
      v_actor || ' accepted your friend request',
      '/player/friends',
      NEW.friend_id,
      jsonb_build_object('friendship_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_friendship_insert ON public.friendships;
CREATE TRIGGER trg_notify_friendship_insert
AFTER INSERT ON public.friendships
FOR EACH ROW EXECUTE FUNCTION public.notify_friendship_event();

DROP TRIGGER IF EXISTS trg_notify_friendship_update ON public.friendships;
CREATE TRIGGER trg_notify_friendship_update
AFTER UPDATE ON public.friendships
FOR EACH ROW EXECUTE FUNCTION public.notify_friendship_event();

-- =====================================================================
-- 5) New direct message → notify all other conversation participants
-- =====================================================================
CREATE OR REPLACE FUNCTION public.notify_direct_message_new()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor text;
  v_participant record;
BEGIN
  v_actor := public.notif_actor_name(NEW.sender_id);

  FOR v_participant IN
    SELECT user_id
    FROM public.conversation_participants
    WHERE conversation_id = NEW.conversation_id
      AND user_id <> NEW.sender_id
  LOOP
    PERFORM public.enqueue_notification(
      v_participant.user_id,
      'direct_message_new',
      'messages',
      v_actor,
      public.notif_preview(NEW.content),
      '/player/messages/' || NEW.conversation_id::text,
      NEW.sender_id,
      jsonb_build_object('conversation_id', NEW.conversation_id, 'message_id', NEW.id)
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_direct_message_new ON public.direct_messages;
CREATE TRIGGER trg_notify_direct_message_new
AFTER INSERT ON public.direct_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_direct_message_new();

-- =====================================================================
-- 6) New group chat message → notify other active group members
-- =====================================================================
CREATE OR REPLACE FUNCTION public.notify_group_message_new()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_name text;
  v_actor text;
  v_member record;
BEGIN
  SELECT name INTO v_group_name FROM public.groups WHERE id = NEW.group_id;
  v_actor := public.notif_actor_name(NEW.user_id);

  FOR v_member IN
    SELECT gm.user_id
    FROM public.group_members gm
    LEFT JOIN public.group_notification_prefs gnp
      ON gnp.group_id = gm.group_id AND gnp.user_id = gm.user_id
    WHERE gm.group_id = NEW.group_id
      AND gm.status = 'active'
      AND gm.user_id <> NEW.user_id
      AND COALESCE(gnp.messages_enabled, true) = true
  LOOP
    PERFORM public.enqueue_notification(
      v_member.user_id,
      'group_message_new',
      'messages',
      v_actor || ' in ' || COALESCE(v_group_name, 'group chat'),
      public.notif_preview(NEW.content),
      '/player/community/group/' || NEW.group_id::text,
      NEW.user_id,
      jsonb_build_object('group_id', NEW.group_id, 'message_id', NEW.id)
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_group_message_new ON public.group_messages;
CREATE TRIGGER trg_notify_group_message_new
AFTER INSERT ON public.group_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_group_message_new();
