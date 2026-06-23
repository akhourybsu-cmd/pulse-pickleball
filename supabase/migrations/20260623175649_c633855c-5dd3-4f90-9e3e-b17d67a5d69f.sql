
-- 1. Tighten notify_post_comment: respect per-group mute, better copy, link to post.
CREATE OR REPLACE FUNCTION public.notify_post_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_author_id uuid;
  v_group_id uuid;
  v_group_name text;
  v_commenter_name text;
BEGIN
  SELECT gp.user_id, gp.group_id INTO v_post_author_id, v_group_id
  FROM group_posts gp WHERE gp.id = NEW.post_id;

  IF v_post_author_id IS NULL OR v_post_author_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  IF NOT public.is_group_channel_enabled(v_post_author_id, v_group_id, 'posts') THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_group_name FROM groups WHERE id = v_group_id;
  SELECT display_name INTO v_commenter_name FROM profiles WHERE id = NEW.user_id;

  PERFORM create_notification(
    v_post_author_id,
    'post_comment',
    'community',
    'New reply in ' || COALESCE(v_group_name, 'your group'),
    COALESCE(v_commenter_name, 'Someone') || ' replied to your post',
    '/community/' || v_group_id || '/post/' || NEW.post_id,
    'normal',
    jsonb_build_object('group_id', v_group_id, 'post_id', NEW.post_id, 'comment_id', NEW.id),
    NEW.user_id,
    now() + interval '7 days'
  );
  RETURN NEW;
END;
$$;

-- 2. New: notify the parent comment's author on a threaded reply.
CREATE OR REPLACE FUNCTION public.notify_comment_reply()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_author_id uuid;
  v_post_author_id uuid;
  v_group_id uuid;
  v_group_name text;
  v_replier_name text;
BEGIN
  IF NEW.parent_comment_id IS NULL THEN RETURN NEW; END IF;

  SELECT user_id INTO v_parent_author_id
  FROM group_post_comments WHERE id = NEW.parent_comment_id;

  -- skip self-reply
  IF v_parent_author_id IS NULL OR v_parent_author_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT gp.user_id, gp.group_id INTO v_post_author_id, v_group_id
  FROM group_posts gp WHERE gp.id = NEW.post_id;

  -- avoid double ping: notify_post_comment already pinged the post author
  IF v_parent_author_id = v_post_author_id THEN
    RETURN NEW;
  END IF;

  IF NOT public.is_group_channel_enabled(v_parent_author_id, v_group_id, 'posts') THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_group_name FROM groups WHERE id = v_group_id;
  SELECT display_name INTO v_replier_name FROM profiles WHERE id = NEW.user_id;

  PERFORM create_notification(
    v_parent_author_id,
    'comment_reply',
    'community',
    'New reply in ' || COALESCE(v_group_name, 'your group'),
    COALESCE(v_replier_name, 'Someone') || ' replied to your comment',
    '/community/' || v_group_id || '/post/' || NEW.post_id,
    'normal',
    jsonb_build_object('group_id', v_group_id, 'post_id', NEW.post_id, 'comment_id', NEW.id, 'parent_comment_id', NEW.parent_comment_id),
    NEW.user_id,
    now() + interval '7 days'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_comment_reply_notify ON public.group_post_comments;
CREATE TRIGGER on_comment_reply_notify
AFTER INSERT ON public.group_post_comments
FOR EACH ROW EXECUTE FUNCTION public.notify_comment_reply();

-- 3. New: @mention notifications for group posts and comments.
CREATE OR REPLACE FUNCTION public.notify_mentions_post()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_name text;
  v_author_name text;
  v_handle text;
  v_mention_user uuid;
  v_seen uuid[] := ARRAY[NEW.user_id];
BEGIN
  IF NEW.content IS NULL OR position('@' in NEW.content) = 0 THEN RETURN NEW; END IF;

  SELECT name INTO v_group_name FROM groups WHERE id = NEW.group_id;
  SELECT display_name INTO v_author_name FROM profiles WHERE id = NEW.user_id;

  FOR v_handle IN
    SELECT DISTINCT lower(m[1])
    FROM regexp_matches(NEW.content, '@([A-Za-z0-9_\.]{2,30})', 'g') AS m
  LOOP
    SELECT p.id INTO v_mention_user
    FROM profiles p
    JOIN group_members gm ON gm.user_id = p.id AND gm.group_id = NEW.group_id AND gm.status = 'active'
    WHERE lower(p.display_name) = v_handle OR lower(replace(COALESCE(p.full_name,''),' ','')) = v_handle
    LIMIT 1;

    IF v_mention_user IS NULL OR v_mention_user = ANY(v_seen) THEN CONTINUE; END IF;
    v_seen := v_seen || v_mention_user;

    IF NOT public.is_group_channel_enabled(v_mention_user, NEW.group_id, 'posts') THEN CONTINUE; END IF;

    PERFORM create_notification(
      v_mention_user,
      'mention',
      'community',
      'You were mentioned in ' || COALESCE(v_group_name, 'a group'),
      COALESCE(v_author_name,'Someone') || ' mentioned you in a post',
      '/community/' || NEW.group_id || '/post/' || NEW.id,
      'normal',
      jsonb_build_object('group_id', NEW.group_id, 'post_id', NEW.id),
      NEW.user_id,
      now() + interval '7 days'
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_group_post_mentions ON public.group_posts;
CREATE TRIGGER on_group_post_mentions
AFTER INSERT ON public.group_posts
FOR EACH ROW EXECUTE FUNCTION public.notify_mentions_post();

CREATE OR REPLACE FUNCTION public.notify_mentions_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_id uuid;
  v_post_author uuid;
  v_parent_author uuid;
  v_group_name text;
  v_author_name text;
  v_handle text;
  v_mention_user uuid;
  v_seen uuid[];
BEGIN
  IF NEW.content IS NULL OR position('@' in NEW.content) = 0 THEN RETURN NEW; END IF;

  SELECT gp.group_id, gp.user_id INTO v_group_id, v_post_author
  FROM group_posts gp WHERE gp.id = NEW.post_id;
  IF v_group_id IS NULL THEN RETURN NEW; END IF;

  IF NEW.parent_comment_id IS NOT NULL THEN
    SELECT user_id INTO v_parent_author FROM group_post_comments WHERE id = NEW.parent_comment_id;
  END IF;

  -- skip people already notified by post-comment or comment-reply triggers
  v_seen := ARRAY[NEW.user_id];
  IF v_post_author IS NOT NULL THEN v_seen := v_seen || v_post_author; END IF;
  IF v_parent_author IS NOT NULL THEN v_seen := v_seen || v_parent_author; END IF;

  SELECT name INTO v_group_name FROM groups WHERE id = v_group_id;
  SELECT display_name INTO v_author_name FROM profiles WHERE id = NEW.user_id;

  FOR v_handle IN
    SELECT DISTINCT lower(m[1])
    FROM regexp_matches(NEW.content, '@([A-Za-z0-9_\.]{2,30})', 'g') AS m
  LOOP
    SELECT p.id INTO v_mention_user
    FROM profiles p
    JOIN group_members gm ON gm.user_id = p.id AND gm.group_id = v_group_id AND gm.status = 'active'
    WHERE lower(p.display_name) = v_handle OR lower(replace(COALESCE(p.full_name,''),' ','')) = v_handle
    LIMIT 1;

    IF v_mention_user IS NULL OR v_mention_user = ANY(v_seen) THEN CONTINUE; END IF;
    v_seen := v_seen || v_mention_user;

    IF NOT public.is_group_channel_enabled(v_mention_user, v_group_id, 'posts') THEN CONTINUE; END IF;

    PERFORM create_notification(
      v_mention_user,
      'mention',
      'community',
      'You were mentioned in ' || COALESCE(v_group_name, 'a group'),
      COALESCE(v_author_name,'Someone') || ' mentioned you in a comment',
      '/community/' || v_group_id || '/post/' || NEW.post_id,
      'normal',
      jsonb_build_object('group_id', v_group_id, 'post_id', NEW.post_id, 'comment_id', NEW.id),
      NEW.user_id,
      now() + interval '7 days'
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_group_comment_mentions ON public.group_post_comments;
CREATE TRIGGER on_group_comment_mentions
AFTER INSERT ON public.group_post_comments
FOR EACH ROW EXECUTE FUNCTION public.notify_mentions_comment();
