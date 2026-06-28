-- =====================================================================
-- group_messages — UPDATE policy + pin-column protection trigger.
--
-- Background:
--   The original group_messages migration (20260101003009) defined
--   SELECT, INSERT, and DELETE policies but no UPDATE policy. With RLS
--   enabled this implicitly denies every UPDATE — including the chat
--   "edit" flow shipped in Community Phase 2.2 — so the feature would
--   fail in production with a generic "0 rows updated" / RLS-deny.
--
-- Fix:
--   1. Add an UPDATE policy: authors can update their own message
--      (USING + WITH CHECK both gate on auth.uid() = user_id).
--   2. Add a BEFORE UPDATE trigger that prevents unauthorized
--      modification of the pin columns (`is_pinned`, `pinned_by`,
--      `pinned_at`). The trigger mirrors the role check in
--      `set_group_message_pin` so direct-SQL pin attempts go through
--      the same gate as the RPC.
--
-- Result:
--   • Author can edit their own content + edited_at via direct UPDATE.
--   • Pin columns can only change when the caller is the message
--     author OR an owner/moderator of the group.
--   • Non-author, non-admin members still cannot touch the row at all
--     (UPDATE policy denies before the trigger runs).
-- =====================================================================

DROP POLICY IF EXISTS "Users can update own messages" ON public.group_messages;
CREATE POLICY "Users can update own messages"
  ON public.group_messages
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- protect_group_message_pin_columns
--
-- Defense-in-depth for the pin columns. Even though the SECURITY
-- DEFINER `set_group_message_pin` RPC enforces the role check, an
-- author could otherwise call .update({ is_pinned: true }) directly
-- through the UPDATE policy above. The trigger re-asserts the rule
-- at the row level.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.protect_group_message_pin_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Fast-exit when no pin column actually changed — the common case
  -- for content edits.
  IF NEW.is_pinned IS NOT DISTINCT FROM OLD.is_pinned
     AND NEW.pinned_by IS NOT DISTINCT FROM OLD.pinned_by
     AND NEW.pinned_at IS NOT DISTINCT FROM OLD.pinned_at THEN
    RETURN NEW;
  END IF;

  -- Pin columns are changing → caller must be owner / moderator /
  -- the message author. Same predicate set_group_message_pin uses.
  SELECT gm.role INTO v_role
    FROM public.group_members gm
   WHERE gm.group_id = NEW.group_id
     AND gm.user_id  = auth.uid()
     AND gm.status   = 'active';

  IF v_role IN ('owner', 'moderator') OR NEW.user_id = auth.uid() THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Pin columns can only be modified by the author, owner, or moderator'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS protect_group_message_pin_columns ON public.group_messages;
CREATE TRIGGER protect_group_message_pin_columns
BEFORE UPDATE ON public.group_messages
FOR EACH ROW
EXECUTE FUNCTION public.protect_group_message_pin_columns();
