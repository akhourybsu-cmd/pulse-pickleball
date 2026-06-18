-- =====================================================================
-- Community Phase 3.1 — per-group + per-channel notification mute.
--
-- Global notification_preferences (matches / events / community /
-- achievements / system) already gates the category. This adds a
-- finer-grained layer scoped to a single group so a player can mute
-- the noisy Friday Crew without losing community alerts overall.
--
-- Channels:
--   • posts          — group_posts (incl. LFG)
--   • events         — group_events RSVPs + reminders
--   • chat           — group_messages (push only — chat is in-app realtime)
--   • announcements  — pinned posts + critical broadcasts (kept on by
--                       default; the "override" channel for organizers)
--   • muted_all      — short-circuit for "mute the whole group"
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.group_notification_prefs (
  user_id        UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id       UUID    NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  muted_all      BOOLEAN NOT NULL DEFAULT false,
  posts          BOOLEAN NOT NULL DEFAULT true,
  events         BOOLEAN NOT NULL DEFAULT true,
  chat           BOOLEAN NOT NULL DEFAULT true,
  announcements  BOOLEAN NOT NULL DEFAULT true,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, group_id)
);

ALTER TABLE public.group_notification_prefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read their own group prefs" ON public.group_notification_prefs;
CREATE POLICY "Users read their own group prefs"
  ON public.group_notification_prefs FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert their own group prefs" ON public.group_notification_prefs;
CREATE POLICY "Users insert their own group prefs"
  ON public.group_notification_prefs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update their own group prefs" ON public.group_notification_prefs;
CREATE POLICY "Users update their own group prefs"
  ON public.group_notification_prefs FOR UPDATE
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- is_group_channel_enabled — single source of truth that the
-- notification triggers call before writing to user_notifications.
--
-- Default = TRUE (no row in group_notification_prefs means "no mutes").
-- Once a row exists, the channel column AND muted_all are checked.
-- 'announcements' intentionally bypasses muted_all so the organizer's
-- critical broadcasts still reach a muted member (this matches Slack's
-- "everyone-mention" override semantics).
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_group_channel_enabled(
  p_user_id  UUID,
  p_group_id UUID,
  p_channel  TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefs RECORD;
BEGIN
  SELECT * INTO v_prefs
    FROM public.group_notification_prefs
   WHERE user_id = p_user_id AND group_id = p_group_id;

  -- No row → defaults (everything enabled).
  IF NOT FOUND THEN RETURN TRUE; END IF;

  -- Announcements always pass even when muted_all is set.
  IF p_channel = 'announcements' THEN
    RETURN COALESCE(v_prefs.announcements, true);
  END IF;

  IF v_prefs.muted_all THEN RETURN FALSE; END IF;

  RETURN CASE p_channel
    WHEN 'posts'   THEN COALESCE(v_prefs.posts,   true)
    WHEN 'events'  THEN COALESCE(v_prefs.events,  true)
    WHEN 'chat'    THEN COALESCE(v_prefs.chat,    true)
    ELSE true
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_group_channel_enabled(UUID, UUID, TEXT) TO authenticated;

-- ---------------------------------------------------------------------
-- set_group_notification_pref — atomic upsert. Lets the client toggle
-- a single channel (or the whole group) without round-tripping the
-- entire row.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_group_notification_pref(
  p_group_id UUID,
  p_channel  TEXT,   -- 'all' | 'posts' | 'events' | 'chat' | 'announcements'
  p_enabled  BOOLEAN
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  -- Ensure a row exists with defaults before flipping the field.
  INSERT INTO public.group_notification_prefs (user_id, group_id)
       VALUES (v_user_id, p_group_id)
  ON CONFLICT (user_id, group_id) DO NOTHING;

  -- 'all' is stored as muted_all (inverse of enabled).
  IF p_channel = 'all' THEN
    UPDATE public.group_notification_prefs
       SET muted_all = NOT p_enabled, updated_at = now()
     WHERE user_id = v_user_id AND group_id = p_group_id;
    RETURN;
  END IF;

  IF p_channel NOT IN ('posts', 'events', 'chat', 'announcements') THEN
    RAISE EXCEPTION 'Unknown notification channel: %', p_channel
      USING ERRCODE = '22023';
  END IF;

  EXECUTE format(
    'UPDATE public.group_notification_prefs SET %I = $1, updated_at = now() WHERE user_id = $2 AND group_id = $3',
    p_channel
  ) USING p_enabled, v_user_id, p_group_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_group_notification_pref(UUID, TEXT, BOOLEAN) TO authenticated;

-- ---------------------------------------------------------------------
-- Update notify_group_post_created to honor the per-group preference.
--
-- LFG and pinned-announcement posts route through the 'announcements'
-- channel (which bypasses muted_all). All other post types use 'posts'.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notify_group_post_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member       RECORD;
  v_author_name  text;
  v_group_name   text;
  v_notif_type   text;
  v_title        text;
  v_message      text;
  v_channel      text;
BEGIN
  SELECT display_name INTO v_author_name FROM profiles WHERE id = NEW.user_id;
  SELECT name INTO v_group_name FROM groups WHERE id = NEW.group_id;

  IF NEW.type = 'lfg' THEN
    v_notif_type := 'group_lfg_new';
    v_title := 'Looking for Players';
    v_message := COALESCE(v_author_name, 'Someone') || ' is looking for players in ' || COALESCE(v_group_name, 'your group');
    v_channel := 'posts';
  ELSIF NEW.type = 'announcement' OR COALESCE(NEW.pinned, false) THEN
    v_notif_type := 'group_announcement';
    v_title := 'Announcement in ' || COALESCE(v_group_name, 'Group');
    v_message := COALESCE(v_author_name, 'Someone') || ' posted an announcement';
    v_channel := 'announcements';
  ELSE
    v_notif_type := 'group_post_new';
    v_title := 'New Post in ' || COALESCE(v_group_name, 'Group');
    v_message := COALESCE(v_author_name, 'Someone') || ' posted in ' || COALESCE(v_group_name, 'the group');
    v_channel := 'posts';
  END IF;

  FOR v_member IN
    SELECT gm.user_id
      FROM group_members gm
     WHERE gm.group_id = NEW.group_id
       AND gm.user_id != NEW.user_id
       AND gm.status = 'active'
  LOOP
    -- New gate: only notify if the per-group channel is enabled.
    IF public.is_group_channel_enabled(v_member.user_id, NEW.group_id, v_channel) THEN
      PERFORM create_notification(
        v_member.user_id,
        v_notif_type,
        'community',
        v_title,
        v_message,
        '/community/' || NEW.group_id || '/post/' || NEW.id,
        CASE WHEN v_channel = 'announcements' THEN 'high' ELSE 'normal' END,
        jsonb_build_object('group_id', NEW.group_id, 'post_id', NEW.id, 'post_type', NEW.type, 'channel', v_channel),
        NEW.user_id,
        now() + interval '7 days'
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;
