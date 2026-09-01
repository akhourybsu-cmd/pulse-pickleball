-- =====================================================================
-- Venue ownership and premium group chat.
--
-- Ownership was previously transferred with two independent client UPDATEs.
-- That could leave two group owners when the second request failed, and a
-- venue community never moved venues.owner_id or venue_staff at all. This RPC
-- makes the entire handoff one transaction and keeps the community and venue
-- authority models in lockstep.
--
-- Chat used group_members.last_read_at for both feed and chat activity. Opening
-- a feed therefore marked unseen messages as read. Give chat its own marker,
-- and add first-class message reactions rather than rendering a picker whose
-- choices were never persisted.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- One atomic ownership transfer for ordinary and venue communities.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.transfer_group_ownership(
  p_group_id uuid,
  p_new_owner_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_venue_id uuid;
  v_group_name text;
  v_group_type public.group_type;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF p_new_owner_id IS NULL OR p_new_owner_id = v_caller THEN
    RAISE EXCEPTION 'Choose another active member as the new owner'
      USING ERRCODE = '22023';
  END IF;

  -- Lock the group first so simultaneous transfers serialize. Ownership is
  -- checked in a separate statement after the lock is acquired; that second
  -- statement gets a fresh READ COMMITTED snapshot and cannot authorize a
  -- queued transfer using the ownership state from before the first one.
  SELECT g.venue_id, g.name, g.type
    INTO v_venue_id, v_group_name, v_group_type
  FROM public.groups g
  WHERE g.id = p_group_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Community not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = p_group_id
      AND gm.user_id = v_caller
      AND gm.status = 'active'
      AND gm.role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Only the current owner can transfer ownership'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = p_group_id
      AND gm.user_id = p_new_owner_id
      AND gm.status = 'active'
  ) THEN
    RAISE EXCEPTION 'The new owner must be an active community member'
      USING ERRCODE = '22023';
  END IF;

  -- Demote every stale owner row first, then promote exactly one. The function
  -- is atomic, so no client can observe an ownerless intermediate state.
  UPDATE public.group_members
  SET role = 'moderator'
  WHERE group_id = p_group_id
    AND role = 'owner'
    AND user_id <> p_new_owner_id;

  UPDATE public.group_members
  SET role = 'owner', status = 'active'
  WHERE group_id = p_group_id
    AND user_id = p_new_owner_id;

  IF v_venue_id IS NOT NULL AND v_group_type = 'venue_official' THEN
    -- venues.owner_id is still consulted directly by legacy RLS policies, so
    -- changing only venue_staff is not an ownership transfer.
    UPDATE public.venues
    SET owner_id = p_new_owner_id
    WHERE id = v_venue_id;

    -- Keep one authoritative venue owner. Former owners retain manager access,
    -- matching the community handoff where the former owner becomes moderator.
    UPDATE public.venue_staff
    SET role = 'manager'
    WHERE venue_id = v_venue_id
      AND role = 'owner'
      AND user_id <> p_new_owner_id;

    -- Legacy venues may rely on venues.owner_id without a matching staff row.
    -- Materialize the former owner's promised manager access either way.
    INSERT INTO public.venue_staff (
      venue_id, user_id, role, invited_by, accepted_at, is_active, status
    )
    VALUES (
      v_venue_id, v_caller, 'manager', v_caller, now(), true, 'active'
    )
    ON CONFLICT (venue_id, user_id) DO UPDATE
    SET role = 'manager',
        accepted_at = COALESCE(public.venue_staff.accepted_at, now()),
        is_active = true,
        status = 'active';

    INSERT INTO public.venue_staff (
      venue_id, user_id, role, invited_by, accepted_at, is_active, status
    )
    VALUES (
      v_venue_id, p_new_owner_id, 'owner', v_caller, now(), true, 'active'
    )
    ON CONFLICT (venue_id, user_id) DO UPDATE
    SET role = 'owner',
        accepted_at = COALESCE(public.venue_staff.accepted_at, now()),
        is_active = true,
        status = 'active';
  END IF;

  RETURN jsonb_build_object(
    'group_id', p_group_id,
    'group_name', v_group_name,
    'venue_id', v_venue_id,
    'venue_transferred', v_venue_id IS NOT NULL AND v_group_type = 'venue_official',
    'previous_owner_id', v_caller,
    'new_owner_id', p_new_owner_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.transfer_group_ownership(uuid, uuid)
  FROM public, anon;
GRANT EXECUTE ON FUNCTION public.transfer_group_ownership(uuid, uuid)
  TO authenticated;

COMMENT ON FUNCTION public.transfer_group_ownership(uuid, uuid) IS
  'Atomically transfers a community to an active member. For venue communities '
  'it also transfers venues.owner_id and the venue_staff owner role.';

-- ---------------------------------------------------------------------
-- Chat read state is independent from feed read state.
-- ---------------------------------------------------------------------
ALTER TABLE public.group_members
  ADD COLUMN IF NOT EXISTS last_chat_read_at timestamptz;

UPDATE public.group_members
SET last_chat_read_at = last_read_at
WHERE last_chat_read_at IS NULL;

ALTER TABLE public.group_members
  ALTER COLUMN last_chat_read_at SET DEFAULT now();

COMMENT ON COLUMN public.group_members.last_chat_read_at IS
  'Most recent group-chat position read by this member. Kept separate from '
  'last_read_at so opening the community feed does not clear chat unread state.';

-- ---------------------------------------------------------------------
-- Persistent message reactions.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.group_message_reactions (
  message_id uuid NOT NULL
    REFERENCES public.group_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL
    REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL CHECK (char_length(emoji) BETWEEN 1 AND 16),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_group_message_reactions_message
  ON public.group_message_reactions(message_id);

ALTER TABLE public.group_message_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view group message reactions"
  ON public.group_message_reactions;
CREATE POLICY "Members can view group message reactions"
  ON public.group_message_reactions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.group_messages msg
      JOIN public.group_members gm ON gm.group_id = msg.group_id
      WHERE msg.id = group_message_reactions.message_id
        AND gm.user_id = auth.uid()
        AND gm.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Members can add own group message reactions"
  ON public.group_message_reactions;
CREATE POLICY "Members can add own group message reactions"
  ON public.group_message_reactions FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.group_messages msg
      JOIN public.group_members gm ON gm.group_id = msg.group_id
      WHERE msg.id = group_message_reactions.message_id
        AND gm.user_id = auth.uid()
        AND gm.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Members can remove own group message reactions"
  ON public.group_message_reactions;
CREATE POLICY "Members can remove own group message reactions"
  ON public.group_message_reactions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.toggle_group_message_reaction(
  p_message_id uuid,
  p_emoji text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_emoji text := btrim(p_emoji);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF v_emoji = '' OR char_length(v_emoji) > 16 THEN
    RAISE EXCEPTION 'Invalid reaction' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.group_messages msg
    JOIN public.group_members gm ON gm.group_id = msg.group_id
    WHERE msg.id = p_message_id
      AND gm.user_id = v_user_id
      AND gm.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Message is not available to this member'
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.group_message_reactions
  WHERE message_id = p_message_id
    AND user_id = v_user_id
    AND emoji = v_emoji;

  IF FOUND THEN
    RETURN false;
  END IF;

  INSERT INTO public.group_message_reactions(message_id, user_id, emoji)
  VALUES (p_message_id, v_user_id, v_emoji);
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.toggle_group_message_reaction(uuid, text)
  FROM public, anon;
GRANT EXECUTE ON FUNCTION public.toggle_group_message_reaction(uuid, text)
  TO authenticated;

-- Make reaction changes available to the existing chat realtime channel.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'group_message_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime
      ADD TABLE public.group_message_reactions;
  END IF;
END;
$$;

COMMIT;
