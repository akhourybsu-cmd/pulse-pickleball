
CREATE OR REPLACE FUNCTION public.notify_group_post_new()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
      AND COALESCE(gnp.muted_all, false) = false
      AND COALESCE(gnp.posts, true) = true
  LOOP
    PERFORM public.enqueue_notification(
      v_member.user_id, 'group_post_new', 'community',
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

CREATE OR REPLACE FUNCTION public.notify_group_event_new()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
      AND COALESCE(gnp.muted_all, false) = false
      AND COALESCE(gnp.events, true) = true
  LOOP
    PERFORM public.enqueue_notification(
      v_member.user_id, 'group_event_new', 'community',
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

CREATE OR REPLACE FUNCTION public.notify_group_message_new()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
      AND COALESCE(gnp.muted_all, false) = false
      AND COALESCE(gnp.chat, true) = true
  LOOP
    PERFORM public.enqueue_notification(
      v_member.user_id, 'group_message_new', 'messages',
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
