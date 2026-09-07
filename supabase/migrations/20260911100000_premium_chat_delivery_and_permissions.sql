-- Premium chat reliability and permission enforcement.
--
-- Sender-generated UUIDs let the client safely reconcile the optimistic row,
-- the HTTP response, and Realtime. They also make a retry idempotent after an
-- ambiguous network failure.

ALTER TABLE public.direct_messages
  ADD COLUMN IF NOT EXISTS client_id UUID;

ALTER TABLE public.group_messages
  ADD COLUMN IF NOT EXISTS client_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'direct_messages_sender_client_id_key'
      AND conrelid = 'public.direct_messages'::regclass
  ) THEN
    ALTER TABLE public.direct_messages
      ADD CONSTRAINT direct_messages_sender_client_id_key
      UNIQUE (sender_id, client_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'group_messages_user_client_id_key'
      AND conrelid = 'public.group_messages'::regclass
  ) THEN
    ALTER TABLE public.group_messages
      ADD CONSTRAINT group_messages_user_client_id_key
      UNIQUE (user_id, client_id);
  END IF;
END;
$$;

COMMENT ON COLUMN public.direct_messages.client_id IS
  'Sender-generated UUID used for optimistic delivery reconciliation and idempotent retries.';

COMMENT ON COLUMN public.group_messages.client_id IS
  'Sender-generated UUID used for optimistic delivery reconciliation and idempotent retries.';

-- A participant who left a conversation cannot continue inserting messages by
-- calling the API directly. The existing SELECT behavior remains unchanged so
-- historical data can still be retained safely.
DROP POLICY IF EXISTS "Users can send messages to their conversations"
  ON public.direct_messages;

CREATE POLICY "Users can send messages to their conversations"
  ON public.direct_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1
      FROM public.conversation_participants cp
      WHERE cp.conversation_id = direct_messages.conversation_id
        AND cp.user_id = auth.uid()
        AND cp.left_at IS NULL
    )
  );

-- Enforce the same chat controls in Postgres that the venue UI presents.
-- Owners/moderators may send when member chat is disabled, but nobody may send
-- while the chat feature itself is disabled.
DROP POLICY IF EXISTS "Members can send messages"
  ON public.group_messages;

CREATE POLICY "Members can send messages"
  ON public.group_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.group_members gm
      JOIN public.groups g ON g.id = gm.group_id
      WHERE gm.group_id = group_messages.group_id
        AND gm.user_id = auth.uid()
        AND gm.status = 'active'
        AND COALESCE((g.settings->>'chat_enabled')::BOOLEAN, TRUE)
        AND (
          gm.role IN ('owner', 'moderator')
          OR COALESCE((g.settings->>'allow_member_chat')::BOOLEAN, TRUE)
        )
    )
  );

-- Muted or departed DM participants should not receive message notifications.
CREATE OR REPLACE FUNCTION public.notify_direct_message_new()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor TEXT;
  v_participant RECORD;
BEGIN
  v_actor := public.notif_actor_name(NEW.sender_id);

  FOR v_participant IN
    SELECT cp.user_id
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = NEW.conversation_id
      AND cp.user_id <> NEW.sender_id
      AND cp.left_at IS NULL
      AND COALESCE(cp.is_muted, FALSE) = FALSE
  LOOP
    PERFORM public.enqueue_notification(
      v_participant.user_id,
      'direct_message_new',
      'messages',
      v_actor,
      public.notif_preview(COALESCE(NULLIF(NEW.content, ''), 'Shared a message')),
      '/player/messages/' || NEW.conversation_id::TEXT,
      NEW.sender_id,
      jsonb_build_object(
        'conversation_id', NEW.conversation_id,
        'message_id', NEW.id
      )
    );
  END LOOP;
  RETURN NEW;
END;
$$;

-- A venue/group message notification now opens the chat itself rather than the
-- venue home tab. Existing group notification preferences remain authoritative.
CREATE OR REPLACE FUNCTION public.notify_group_message_new()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_name TEXT;
  v_actor TEXT;
  v_member RECORD;
BEGIN
  SELECT name INTO v_group_name
  FROM public.groups
  WHERE id = NEW.group_id;

  v_actor := public.notif_actor_name(NEW.user_id);

  FOR v_member IN
    SELECT gm.user_id
    FROM public.group_members gm
    LEFT JOIN public.group_notification_prefs gnp
      ON gnp.group_id = gm.group_id
     AND gnp.user_id = gm.user_id
    WHERE gm.group_id = NEW.group_id
      AND gm.status = 'active'
      AND gm.user_id <> NEW.user_id
      AND COALESCE(gnp.muted_all, FALSE) = FALSE
      AND COALESCE(gnp.chat, TRUE) = TRUE
  LOOP
    PERFORM public.enqueue_notification(
      v_member.user_id,
      'group_message_new',
      'messages',
      v_actor || ' in ' || COALESCE(v_group_name, 'group chat'),
      public.notif_preview(COALESCE(NULLIF(NEW.content, ''), 'Shared a photo')),
      '/player/community/group/' || NEW.group_id::TEXT || '?tab=chat',
      NEW.user_id,
      jsonb_build_object(
        'group_id', NEW.group_id,
        'message_id', NEW.id
      )
    );
  END LOOP;
  RETURN NEW;
END;
$$;
