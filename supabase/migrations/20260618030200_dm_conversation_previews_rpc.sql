-- =====================================================================
-- DM inbox: single-call preview list (Phase 3.C).
--
-- useDirectMessages.fetchConversations was issuing 4 sequential queries
-- per conversation (other participant → profile → last message →
-- unread count). For a user with 30 conversations that's 120
-- round-trips on every inbox load. This RPC collapses the work into a
-- single statement.
--
-- Returns one row per conversation the caller participates in, with
-- the fields needed to render ConversationPreview.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.list_dm_conversation_previews()
RETURNS TABLE(
  conversation_id          UUID,
  conversation_updated_at  TIMESTAMPTZ,
  other_user_id            UUID,
  other_display_name       TEXT,
  other_full_name          TEXT,
  other_avatar_url         TEXT,
  other_current_rating     NUMERIC,
  last_message_id          UUID,
  last_message_content     TEXT,
  last_message_created_at  TIMESTAMPTZ,
  last_message_sender_id   UUID,
  unread_count             INT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH my_convos AS (
    SELECT cp.conversation_id, cp.last_read_at
      FROM public.conversation_participants cp
     WHERE cp.user_id = v_user_id
  ),
  other_participant AS (
    -- For 1:1 conversations there is exactly one "other" row. For any
    -- legacy multi-party row this picks an arbitrary stable peer; the
    -- UI today is 1:1-only so this is acceptable.
    SELECT DISTINCT ON (cp.conversation_id)
           cp.conversation_id,
           cp.user_id AS other_user_id
      FROM public.conversation_participants cp
      JOIN my_convos m ON m.conversation_id = cp.conversation_id
     WHERE cp.user_id <> v_user_id
     ORDER BY cp.conversation_id, cp.joined_at
  )
  SELECT
    c.id                                                      AS conversation_id,
    c.updated_at                                              AS conversation_updated_at,
    op.other_user_id,
    p.display_name                                            AS other_display_name,
    p.full_name                                               AS other_full_name,
    p.avatar_url                                              AS other_avatar_url,
    p.current_rating                                          AS other_current_rating,
    lm.id                                                     AS last_message_id,
    lm.content                                                AS last_message_content,
    lm.created_at                                             AS last_message_created_at,
    lm.sender_id                                              AS last_message_sender_id,
    COALESCE(uc.unread_count, 0)::INT                         AS unread_count
  FROM public.conversations c
  JOIN my_convos m ON m.conversation_id = c.id
  LEFT JOIN other_participant op ON op.conversation_id = c.id
  LEFT JOIN public.profiles p   ON p.id = op.other_user_id
  LEFT JOIN LATERAL (
    SELECT id, content, created_at, sender_id
      FROM public.direct_messages dm
     WHERE dm.conversation_id = c.id
     ORDER BY created_at DESC
     LIMIT 1
  ) lm ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS unread_count
      FROM public.direct_messages dm
     WHERE dm.conversation_id = c.id
       AND dm.sender_id <> v_user_id
       AND dm.created_at > COALESCE(m.last_read_at, '1970-01-01'::timestamptz)
  ) uc ON true
  ORDER BY c.updated_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_dm_conversation_previews() TO authenticated;
