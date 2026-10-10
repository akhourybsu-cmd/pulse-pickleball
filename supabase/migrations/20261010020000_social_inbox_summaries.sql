BEGIN;
-- Return one preview per conversation, never a shared window of message bodies.
-- SECURITY INVOKER retains membership, block, and session-MFA row policies.
CREATE OR REPLACE FUNCTION public.social_dm_inbox()
RETURNS TABLE(id uuid, updated_at timestamptz, participant jsonb, last_message jsonb, unread_count integer, is_muted boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT c.id, c.updated_at,
    jsonb_build_object('id', other.user_id, 'user_id', other.user_id,
      'display_name', p.display_name, 'full_name', p.full_name,
      'avatar_url', p.avatar_url, 'current_rating', p.current_rating),
    CASE WHEN latest.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', latest.id, 'conversation_id', latest.conversation_id, 'sender_id', latest.sender_id,
      'content', latest.content, 'created_at', latest.created_at) END,
    unread.amount, coalesce(mine.is_muted, false)
  FROM public.conversation_participants mine
  JOIN public.conversations c ON c.id = mine.conversation_id
  JOIN LATERAL (
    SELECT cp.user_id FROM public.conversation_participants cp
    WHERE cp.conversation_id = c.id AND cp.user_id <> (SELECT auth.uid())
    ORDER BY cp.user_id LIMIT 1
  ) other ON true
  LEFT JOIN public.profiles_public p ON p.id = other.user_id
  LEFT JOIN LATERAL (
    SELECT m.id, m.conversation_id, m.sender_id, m.content, m.created_at
    FROM public.direct_messages m WHERE m.conversation_id = c.id
    ORDER BY m.created_at DESC, m.id DESC LIMIT 1
  ) latest ON true
  CROSS JOIN LATERAL (
    SELECT count(*)::integer AS amount FROM (
      SELECT 1 FROM public.direct_messages m WHERE m.conversation_id = c.id
        AND m.sender_id <> (SELECT auth.uid())
        AND (mine.last_read_at IS NULL OR m.created_at > mine.last_read_at)
      LIMIT 100
    ) bounded
  ) unread
  WHERE mine.user_id = (SELECT auth.uid()) AND mine.left_at IS NULL
  ORDER BY coalesce(latest.created_at, c.updated_at) DESC, c.id;
$$;

CREATE OR REPLACE FUNCTION public.social_group_inbox()
RETURNS TABLE(id uuid, name text, icon_url text, member_count integer, updated_at timestamptz, last_message jsonb, unread_count integer)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT g.id, g.name, g.icon_url, coalesce(g.member_count, 0)::integer, coalesce(g.updated_at, 'epoch'::timestamptz),
    CASE WHEN latest.id IS NULL THEN NULL ELSE jsonb_build_object(
      'content', latest.content, 'image_url', latest.image_url, 'created_at', coalesce(latest.created_at, 'epoch'::timestamptz),
      'senderName', coalesce(p.display_name, p.full_name),
      'senderIsMe', latest.user_id = (SELECT auth.uid())) END,
    unread.amount
  FROM public.group_members mine
  JOIN public.groups g ON g.id = mine.group_id
  LEFT JOIN LATERAL (
    SELECT m.id, m.user_id, m.content, m.image_url, m.created_at FROM public.group_messages m
    WHERE m.group_id = g.id ORDER BY m.created_at DESC NULLS LAST, m.id DESC LIMIT 1
  ) latest ON true
  LEFT JOIN public.profiles_public p ON p.id = latest.user_id
  CROSS JOIN LATERAL (
    SELECT count(*)::integer AS amount FROM (
      SELECT 1 FROM public.group_messages m WHERE m.group_id = g.id
        AND m.user_id <> (SELECT auth.uid())
        AND (coalesce(mine.last_chat_read_at, mine.last_read_at) IS NULL
          OR m.created_at > coalesce(mine.last_chat_read_at, mine.last_read_at))
      LIMIT 100
    ) bounded
  ) unread
  WHERE mine.user_id = (SELECT auth.uid()) AND mine.status = 'active'
  ORDER BY coalesce(latest.created_at, g.updated_at, 'epoch'::timestamptz) DESC, g.id;
$$;
REVOKE ALL ON FUNCTION public.social_dm_inbox(), public.social_group_inbox() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.social_dm_inbox(), public.social_group_inbox() TO authenticated;
COMMENT ON FUNCTION public.social_dm_inbox() IS 'RLS-protected inbox previews; unread counts saturate at 100 for the 99+ badge.';
COMMENT ON FUNCTION public.social_group_inbox() IS 'RLS-protected group chat previews; unread counts saturate at 100 for the 99+ badge.';
-- Read/mute/leave changes must reach the other signed-in device as well as
-- message inserts. Existing SELECT policies constrain realtime visibility.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime' AND NOT puballtables)
    AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public' AND tablename = 'conversation_participants') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;
  END IF;
END $$;
NOTIFY pgrst, 'reload schema';
COMMIT;
