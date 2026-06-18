ALTER TABLE public.group_messages
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pinned_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS image_url TEXT;

CREATE INDEX IF NOT EXISTS group_messages_pinned_idx
  ON public.group_messages (group_id)
  WHERE is_pinned = true;

CREATE OR REPLACE FUNCTION public.set_group_message_pin(
  p_message_id UUID,
  p_pinned     BOOLEAN
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   UUID := auth.uid();
  v_group_id  UUID;
  v_author_id UUID;
  v_role      TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT group_id, user_id INTO v_group_id, v_author_id
    FROM public.group_messages WHERE id = p_message_id;
  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Message not found' USING ERRCODE = '02000';
  END IF;

  SELECT role INTO v_role
    FROM public.group_members
   WHERE group_id = v_group_id AND user_id = v_user_id AND status = 'active';
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'You are not a member of this group' USING ERRCODE = '42501';
  END IF;
  IF v_role NOT IN ('owner', 'moderator') AND v_author_id <> v_user_id THEN
    RAISE EXCEPTION 'Only the author, owner, or moderator can pin messages'
      USING ERRCODE = '42501';
  END IF;

  IF p_pinned THEN
    UPDATE public.group_messages
       SET is_pinned = false, pinned_by = NULL, pinned_at = NULL
     WHERE group_id = v_group_id AND is_pinned = true AND id <> p_message_id;
  END IF;

  UPDATE public.group_messages
     SET is_pinned = p_pinned,
         pinned_by = CASE WHEN p_pinned THEN v_user_id ELSE NULL END,
         pinned_at = CASE WHEN p_pinned THEN now()     ELSE NULL END
   WHERE id = p_message_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_group_message_pin(UUID, BOOLEAN) TO authenticated;