-- =====================================================================
-- Group notification triggers honor per-group mute (Phase 2.C.2).
--
-- The Community Phase 3.1 migration wrapped notify_group_post_created
-- in `is_group_channel_enabled(...)` so per-group mutes affect new
-- post notifications. The other group-scoped notify_* triggers were
-- left as-is and still notify recipients even when they've muted the
-- group — defeating the mute UI for comments and LFG joins.
--
-- This migration adds the same gate to:
--   • notify_post_comment           → 'posts' channel (LFG/post replies)
--   • notify_lfg_participant_joined → 'posts' channel (LFG join pings)
--
-- Both pass through the 'posts' channel (LFG join is a community post
-- engagement, not an event RSVP). The recipient's mute pref decides
-- whether the notification lands.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.notify_post_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_author_id uuid;
  v_commenter_name text;
  v_group_id       uuid;
BEGIN
  SELECT gp.user_id, gp.group_id
    INTO v_post_author_id, v_group_id
    FROM group_posts gp
   WHERE gp.id = NEW.post_id;

  -- Don't notify if commenting on own post.
  IF v_post_author_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Per-group mute gate (Phase 2.C.2). Same channel/predicate the
  -- post-creation trigger uses.
  IF NOT public.is_group_channel_enabled(v_post_author_id, v_group_id, 'posts') THEN
    RETURN NEW;
  END IF;

  SELECT display_name INTO v_commenter_name FROM profiles WHERE id = NEW.user_id;

  PERFORM create_notification(
    v_post_author_id,
    'post_comment',
    'community',
    'New Comment',
    COALESCE(v_commenter_name, 'Someone') || ' commented on your post',
    '/community/' || v_group_id || '/post/' || NEW.post_id,
    'normal',
    jsonb_build_object('post_id', NEW.post_id, 'comment_id', NEW.id, 'group_id', v_group_id, 'channel', 'posts'),
    NEW.user_id,
    now() + interval '7 days'
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_lfg_participant_joined()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_creator_id uuid;
  v_joiner_name     text;
  v_post_title      text;
  v_group_id        uuid;
BEGIN
  SELECT gp.user_id, gp.title, gp.group_id
    INTO v_post_creator_id, v_post_title, v_group_id
    FROM group_posts gp
   WHERE gp.id = NEW.post_id;

  IF v_post_creator_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Per-group mute gate (Phase 2.C.2).
  IF NOT public.is_group_channel_enabled(v_post_creator_id, v_group_id, 'posts') THEN
    RETURN NEW;
  END IF;

  SELECT display_name INTO v_joiner_name FROM profiles WHERE id = NEW.user_id;

  PERFORM create_notification(
    v_post_creator_id,
    'group_lfg_joined',
    'community',
    'Player Joined Your Session',
    COALESCE(v_joiner_name, 'Someone') || ' joined your session',
    '/community/' || v_group_id || '/post/' || NEW.post_id,
    'high',
    jsonb_build_object('post_id', NEW.post_id, 'joiner_id', NEW.user_id, 'group_id', v_group_id, 'channel', 'posts'),
    NEW.user_id,
    now() + interval '3 days'
  );

  RETURN NEW;
END;
$$;
