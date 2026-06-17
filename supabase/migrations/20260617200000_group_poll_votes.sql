-- =====================================================================
-- Group poll voting (Community Phase 1.1).
--
-- group_posts.poll_options (jsonb) already exists and stores the
-- options as a JSON array of {idx, text}. This migration adds the
-- vote table and the RPC the client uses to cast or change a vote.
--
-- A user can have at most ONE active vote per poll (post). Re-voting
-- updates the existing row; voting the same option a second time
-- removes the vote (toggle-off).
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.group_poll_votes (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID    NOT NULL REFERENCES public.group_posts(id) ON DELETE CASCADE,
  user_id     UUID    NOT NULL REFERENCES auth.users(id)         ON DELETE CASCADE,
  option_idx  INTEGER NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS group_poll_votes_post_idx
  ON public.group_poll_votes (post_id);

ALTER TABLE public.group_poll_votes ENABLE ROW LEVEL SECURITY;

-- Members of the group can see every vote on every poll in that group.
-- (Reuses the same membership check used elsewhere — RLS via subselect
-- on group_members for the post's group_id.)
DROP POLICY IF EXISTS "Group members can view poll votes" ON public.group_poll_votes;
CREATE POLICY "Group members can view poll votes"
  ON public.group_poll_votes FOR SELECT
  USING (
    EXISTS (
      SELECT 1
        FROM public.group_posts p
        JOIN public.group_members gm ON gm.group_id = p.group_id
       WHERE p.id = group_poll_votes.post_id
         AND gm.user_id = auth.uid()
         AND gm.status = 'active'
    )
  );

-- Members can only insert / update / delete THEIR OWN votes.
DROP POLICY IF EXISTS "Members can cast their own poll vote" ON public.group_poll_votes;
CREATE POLICY "Members can cast their own poll vote"
  ON public.group_poll_votes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
        FROM public.group_posts p
        JOIN public.group_members gm ON gm.group_id = p.group_id
       WHERE p.id = group_poll_votes.post_id
         AND gm.user_id = auth.uid()
         AND gm.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Members can update their own poll vote" ON public.group_poll_votes;
CREATE POLICY "Members can update their own poll vote"
  ON public.group_poll_votes FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Members can delete their own poll vote" ON public.group_poll_votes;
CREATE POLICY "Members can delete their own poll vote"
  ON public.group_poll_votes FOR DELETE
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- cast_group_poll_vote — atomic upsert / toggle.
--
--   • First vote: INSERT.
--   • Different option: UPDATE the existing row to the new option_idx.
--   • Same option again (toggle): DELETE the row.
--
-- Returns the user's resulting option_idx (NULL if toggled off).
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cast_group_poll_vote(
  p_post_id    UUID,
  p_option_idx INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id     UUID := auth.uid();
  v_existing    INTEGER;
  v_is_member   BOOLEAN;
  v_options_len INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  -- Membership + option-range check in one shot.
  SELECT EXISTS (
           SELECT 1
             FROM public.group_posts p
             JOIN public.group_members gm ON gm.group_id = p.group_id
            WHERE p.id = p_post_id
              AND gm.user_id = v_user_id
              AND gm.status = 'active'
         ),
         COALESCE(jsonb_array_length((SELECT poll_options FROM public.group_posts WHERE id = p_post_id)), 0)
    INTO v_is_member, v_options_len;

  IF NOT v_is_member THEN
    RAISE EXCEPTION 'You must be a group member to vote' USING ERRCODE = '42501';
  END IF;
  IF p_option_idx < 0 OR p_option_idx >= v_options_len THEN
    RAISE EXCEPTION 'Option index out of range' USING ERRCODE = '22023';
  END IF;

  SELECT option_idx INTO v_existing
    FROM public.group_poll_votes
   WHERE post_id = p_post_id AND user_id = v_user_id;

  IF v_existing IS NULL THEN
    INSERT INTO public.group_poll_votes (post_id, user_id, option_idx)
    VALUES (p_post_id, v_user_id, p_option_idx);
    RETURN p_option_idx;
  ELSIF v_existing = p_option_idx THEN
    DELETE FROM public.group_poll_votes
     WHERE post_id = p_post_id AND user_id = v_user_id;
    RETURN NULL;
  ELSE
    UPDATE public.group_poll_votes
       SET option_idx = p_option_idx, created_at = now()
     WHERE post_id = p_post_id AND user_id = v_user_id;
    RETURN p_option_idx;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cast_group_poll_vote(UUID, INTEGER) TO authenticated;
