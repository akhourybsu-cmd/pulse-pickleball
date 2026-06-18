
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_notification_prefs TO authenticated;
GRANT ALL ON public.group_notification_prefs TO service_role;

ALTER TABLE public.group_notification_prefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read their own group prefs" ON public.group_notification_prefs;
CREATE POLICY "Users read their own group prefs"
  ON public.group_notification_prefs FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert their own group prefs" ON public.group_notification_prefs;
CREATE POLICY "Users insert their own group prefs"
  ON public.group_notification_prefs FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update their own group prefs" ON public.group_notification_prefs;
CREATE POLICY "Users update their own group prefs"
  ON public.group_notification_prefs FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete their own group prefs" ON public.group_notification_prefs;
CREATE POLICY "Users delete their own group prefs"
  ON public.group_notification_prefs FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.is_group_channel_enabled(
  p_user_id UUID, p_group_id UUID, p_channel TEXT
) RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_prefs RECORD;
BEGIN
  SELECT * INTO v_prefs FROM public.group_notification_prefs
   WHERE user_id = p_user_id AND group_id = p_group_id;
  IF NOT FOUND THEN RETURN TRUE; END IF;
  IF p_channel = 'announcements' THEN RETURN COALESCE(v_prefs.announcements, true); END IF;
  IF v_prefs.muted_all THEN RETURN FALSE; END IF;
  RETURN CASE p_channel
    WHEN 'posts'  THEN COALESCE(v_prefs.posts,  true)
    WHEN 'events' THEN COALESCE(v_prefs.events, true)
    WHEN 'chat'   THEN COALESCE(v_prefs.chat,   true)
    ELSE true END;
END; $$;

GRANT EXECUTE ON FUNCTION public.is_group_channel_enabled(UUID,UUID,TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_group_notification_pref(
  p_group_id UUID, p_channel TEXT, p_enabled BOOLEAN
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  INSERT INTO public.group_notification_prefs (user_id, group_id)
       VALUES (v_user_id, p_group_id)
  ON CONFLICT (user_id, group_id) DO NOTHING;
  IF p_channel = 'all' THEN
    UPDATE public.group_notification_prefs
       SET muted_all = NOT p_enabled, updated_at = now()
     WHERE user_id = v_user_id AND group_id = p_group_id;
    RETURN;
  END IF;
  IF p_channel NOT IN ('posts','events','chat','announcements') THEN
    RAISE EXCEPTION 'Unknown notification channel: %', p_channel USING ERRCODE = '22023';
  END IF;
  EXECUTE format('UPDATE public.group_notification_prefs SET %I = $1, updated_at = now() WHERE user_id = $2 AND group_id = $3', p_channel)
    USING p_enabled, v_user_id, p_group_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.set_group_notification_pref(UUID,TEXT,BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_group_post_created()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_member RECORD; v_author_name text; v_group_name text;
        v_notif_type text; v_title text; v_message text; v_channel text;
BEGIN
  SELECT display_name INTO v_author_name FROM profiles WHERE id = NEW.user_id;
  SELECT name INTO v_group_name FROM groups WHERE id = NEW.group_id;
  IF NEW.type = 'lfg' THEN
    v_notif_type := 'group_lfg_new';
    v_title := 'Looking for Players';
    v_message := COALESCE(v_author_name,'Someone') || ' is looking for players in ' || COALESCE(v_group_name,'your group');
    v_channel := 'posts';
  ELSIF NEW.type = 'announcement' OR COALESCE(NEW.pinned,false) THEN
    v_notif_type := 'group_announcement';
    v_title := 'Announcement in ' || COALESCE(v_group_name,'Group');
    v_message := COALESCE(v_author_name,'Someone') || ' posted an announcement';
    v_channel := 'announcements';
  ELSE
    v_notif_type := 'group_post_new';
    v_title := 'New Post in ' || COALESCE(v_group_name,'Group');
    v_message := COALESCE(v_author_name,'Someone') || ' posted in ' || COALESCE(v_group_name,'the group');
    v_channel := 'posts';
  END IF;
  FOR v_member IN
    SELECT gm.user_id FROM group_members gm
     WHERE gm.group_id = NEW.group_id AND gm.user_id != NEW.user_id AND gm.status = 'active'
  LOOP
    IF public.is_group_channel_enabled(v_member.user_id, NEW.group_id, v_channel) THEN
      PERFORM create_notification(
        v_member.user_id, v_notif_type, 'community', v_title, v_message,
        '/community/' || NEW.group_id || '/post/' || NEW.id,
        CASE WHEN v_channel = 'announcements' THEN 'high' ELSE 'normal' END,
        jsonb_build_object('group_id', NEW.group_id, 'post_id', NEW.id, 'post_type', NEW.type, 'channel', v_channel),
        NEW.user_id, now() + interval '7 days'
      );
    END IF;
  END LOOP;
  RETURN NEW;
END; $$;
