-- Use central notif_actor_name() so missing display_name falls through to full_name then 'Someone',
-- avoiding any chance of an "Unknown user" or empty actor in notification copy or push payloads.

CREATE OR REPLACE FUNCTION public.notify_post_comment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_post_author_id uuid; v_group_id uuid; v_group_name text; v_commenter_name text;
BEGIN
  SELECT gp.user_id, gp.group_id INTO v_post_author_id, v_group_id
  FROM group_posts gp WHERE gp.id = NEW.post_id;
  IF v_post_author_id IS NULL OR v_post_author_id = NEW.user_id THEN RETURN NEW; END IF;
  IF NOT public.is_group_channel_enabled(v_post_author_id, v_group_id, 'posts') THEN RETURN NEW; END IF;

  SELECT name INTO v_group_name FROM groups WHERE id = v_group_id;
  v_commenter_name := public.notif_actor_name(NEW.user_id);

  PERFORM create_notification(
    v_post_author_id, 'post_comment', 'community',
    'New reply in ' || COALESCE(v_group_name, 'your group'),
    v_commenter_name || ' replied to your post',
    '/player/community/group/' || v_group_id, 'normal',
    jsonb_build_object('group_id', v_group_id, 'post_id', NEW.post_id, 'comment_id', NEW.id),
    NEW.user_id, now() + interval '7 days'
  );
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.notify_comment_reply()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_parent_author_id uuid; v_post_author_id uuid; v_group_id uuid; v_group_name text; v_replier_name text;
BEGIN
  IF NEW.parent_comment_id IS NULL THEN RETURN NEW; END IF;
  SELECT user_id INTO v_parent_author_id FROM group_post_comments WHERE id = NEW.parent_comment_id;
  IF v_parent_author_id IS NULL OR v_parent_author_id = NEW.user_id THEN RETURN NEW; END IF;
  SELECT gp.user_id, gp.group_id INTO v_post_author_id, v_group_id FROM group_posts gp WHERE gp.id = NEW.post_id;
  IF v_parent_author_id = v_post_author_id THEN RETURN NEW; END IF;
  IF NOT public.is_group_channel_enabled(v_parent_author_id, v_group_id, 'posts') THEN RETURN NEW; END IF;

  SELECT name INTO v_group_name FROM groups WHERE id = v_group_id;
  v_replier_name := public.notif_actor_name(NEW.user_id);

  PERFORM create_notification(
    v_parent_author_id, 'comment_reply', 'community',
    'New reply in ' || COALESCE(v_group_name, 'your group'),
    v_replier_name || ' replied to your comment',
    '/player/community/group/' || v_group_id, 'normal',
    jsonb_build_object('group_id', v_group_id, 'post_id', NEW.post_id, 'comment_id', NEW.id, 'parent_comment_id', NEW.parent_comment_id),
    NEW.user_id, now() + interval '7 days'
  );
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.notify_mentions_post()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_group_name text; v_author_name text; v_handle text; v_mention_user uuid;
  v_seen uuid[] := ARRAY[NEW.user_id];
BEGIN
  IF NEW.content IS NULL OR position('@' in NEW.content) = 0 THEN RETURN NEW; END IF;
  SELECT name INTO v_group_name FROM groups WHERE id = NEW.group_id;
  v_author_name := public.notif_actor_name(NEW.user_id);

  FOR v_handle IN
    SELECT DISTINCT lower(m[1]) FROM regexp_matches(NEW.content, '@([A-Za-z0-9_\.]{2,30})', 'g') AS m
  LOOP
    SELECT p.id INTO v_mention_user FROM profiles p
    JOIN group_members gm ON gm.user_id = p.id AND gm.group_id = NEW.group_id AND gm.status = 'active'
    WHERE lower(p.display_name) = v_handle OR lower(replace(COALESCE(p.full_name,''),' ','')) = v_handle
    LIMIT 1;
    IF v_mention_user IS NULL OR v_mention_user = ANY(v_seen) THEN CONTINUE; END IF;
    v_seen := v_seen || v_mention_user;
    IF NOT public.is_group_channel_enabled(v_mention_user, NEW.group_id, 'posts') THEN CONTINUE; END IF;
    PERFORM create_notification(
      v_mention_user, 'mention', 'community',
      'You were mentioned in ' || COALESCE(v_group_name, 'a group'),
      v_author_name || ' mentioned you in a post',
      '/player/community/group/' || NEW.group_id, 'normal',
      jsonb_build_object('group_id', NEW.group_id, 'post_id', NEW.id),
      NEW.user_id, now() + interval '7 days'
    );
  END LOOP;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.notify_mentions_comment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_group_id uuid; v_post_author uuid; v_parent_author uuid;
  v_group_name text; v_author_name text; v_handle text; v_mention_user uuid; v_seen uuid[];
BEGIN
  IF NEW.content IS NULL OR position('@' in NEW.content) = 0 THEN RETURN NEW; END IF;
  SELECT gp.group_id, gp.user_id INTO v_group_id, v_post_author FROM group_posts gp WHERE gp.id = NEW.post_id;
  IF v_group_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.parent_comment_id IS NOT NULL THEN
    SELECT user_id INTO v_parent_author FROM group_post_comments WHERE id = NEW.parent_comment_id;
  END IF;
  v_seen := ARRAY[NEW.user_id];
  IF v_post_author IS NOT NULL THEN v_seen := v_seen || v_post_author; END IF;
  IF v_parent_author IS NOT NULL THEN v_seen := v_seen || v_parent_author; END IF;

  SELECT name INTO v_group_name FROM groups WHERE id = v_group_id;
  v_author_name := public.notif_actor_name(NEW.user_id);

  FOR v_handle IN
    SELECT DISTINCT lower(m[1]) FROM regexp_matches(NEW.content, '@([A-Za-z0-9_\.]{2,30})', 'g') AS m
  LOOP
    SELECT p.id INTO v_mention_user FROM profiles p
    JOIN group_members gm ON gm.user_id = p.id AND gm.group_id = v_group_id AND gm.status = 'active'
    WHERE lower(p.display_name) = v_handle OR lower(replace(COALESCE(p.full_name,''),' ','')) = v_handle
    LIMIT 1;
    IF v_mention_user IS NULL OR v_mention_user = ANY(v_seen) THEN CONTINUE; END IF;
    v_seen := v_seen || v_mention_user;
    IF NOT public.is_group_channel_enabled(v_mention_user, v_group_id, 'posts') THEN CONTINUE; END IF;
    PERFORM create_notification(
      v_mention_user, 'mention', 'community',
      'You were mentioned in ' || COALESCE(v_group_name, 'a group'),
      v_author_name || ' mentioned you in a comment',
      '/player/community/group/' || v_group_id, 'normal',
      jsonb_build_object('group_id', v_group_id, 'post_id', NEW.post_id, 'comment_id', NEW.id),
      NEW.user_id, now() + interval '7 days'
    );
  END LOOP;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.notify_group_post_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_member RECORD; v_author_name text; v_group_name text;
        v_notif_type text; v_title text; v_message text; v_channel text;
BEGIN
  v_author_name := public.notif_actor_name(NEW.user_id);
  SELECT name INTO v_group_name FROM groups WHERE id = NEW.group_id;
  IF NEW.type = 'lfg' THEN
    v_notif_type := 'group_lfg_new'; v_title := 'Looking for Players';
    v_message := v_author_name || ' is looking for players in ' || COALESCE(v_group_name,'your group');
    v_channel := 'posts';
  ELSIF NEW.type = 'announcement' OR COALESCE(NEW.pinned,false) THEN
    v_notif_type := 'group_announcement';
    v_title := 'Announcement in ' || COALESCE(v_group_name,'Group');
    v_message := v_author_name || ' posted an announcement';
    v_channel := 'announcements';
  ELSE
    v_notif_type := 'group_post_new';
    v_title := 'New Post in ' || COALESCE(v_group_name,'Group');
    v_message := v_author_name || ' posted in ' || COALESCE(v_group_name,'the group');
    v_channel := 'posts';
  END IF;
  FOR v_member IN
    SELECT gm.user_id FROM group_members gm
     WHERE gm.group_id = NEW.group_id AND gm.user_id != NEW.user_id AND gm.status = 'active'
  LOOP
    IF public.is_group_channel_enabled(v_member.user_id, NEW.group_id, v_channel) THEN
      PERFORM create_notification(
        v_member.user_id, v_notif_type, 'community', v_title, v_message,
        '/player/community/group/' || NEW.group_id,
        CASE WHEN v_channel = 'announcements' THEN 'high' ELSE 'normal' END,
        jsonb_build_object('group_id', NEW.group_id, 'post_id', NEW.id, 'post_type', NEW.type, 'channel', v_channel),
        NEW.user_id, now() + interval '7 days'
      );
    END IF;
  END LOOP;
  RETURN NEW;
END; $$;