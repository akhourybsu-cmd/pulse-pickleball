-- =====================================================================
-- DM conversation dedupe (Phase 2.B.1).
--
-- Two concurrent calls to get_or_create_dm_conversation(other) — e.g.,
-- a user rapidly double-tapping "Message" or two browser tabs racing
-- — can both pass the existence check and create separate
-- conversation rows, leaving the user with phantom duplicate threads.
--
-- Schema can't UNIQUE-constraint the pair because participants live
-- on a child table. Instead, take a pg_advisory_xact_lock keyed on a
-- canonical hash of the two user_ids before doing the check / insert.
-- The lock is released automatically at transaction end (RPC return),
-- so the second caller sees the first caller's COMMIT and returns
-- the existing conversation_id.
--
-- Also: this CREATE OR REPLACE adds SET search_path = public — the
-- original function omitted it, which is a SECURITY DEFINER best-
-- practice gap.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_or_create_dm_conversation(other_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_conversation_id UUID;
  new_conversation_id      UUID;
  current_user_id          UUID;
  v_lock_key               BIGINT;
BEGIN
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF other_user_id IS NULL THEN
    RAISE EXCEPTION 'Recipient required' USING ERRCODE = '22023';
  END IF;
  IF other_user_id = current_user_id THEN
    RAISE EXCEPTION 'Cannot start a conversation with yourself' USING ERRCODE = '22023';
  END IF;

  -- Canonical hash of the ordered pair. hashtextextended is stable for
  -- the same input so both concurrent callers compute the same key
  -- and serialize at the lock.
  v_lock_key := hashtextextended(
    LEAST(current_user_id, other_user_id)::text || '|' ||
    GREATEST(current_user_id, other_user_id)::text,
    0
  );
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Re-check inside the locked transaction. The second caller's
  -- existence query now sees the row the first caller just inserted.
  SELECT cp1.conversation_id INTO existing_conversation_id
    FROM public.conversation_participants cp1
    JOIN public.conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
   WHERE cp1.user_id = current_user_id
     AND cp2.user_id = other_user_id
     AND (
       SELECT COUNT(*) FROM public.conversation_participants
        WHERE conversation_id = cp1.conversation_id
     ) = 2
   LIMIT 1;

  IF existing_conversation_id IS NOT NULL THEN
    RETURN existing_conversation_id;
  END IF;

  INSERT INTO public.conversations DEFAULT VALUES RETURNING id INTO new_conversation_id;

  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES
    (new_conversation_id, current_user_id),
    (new_conversation_id, other_user_id);

  RETURN new_conversation_id;
END;
$$;
