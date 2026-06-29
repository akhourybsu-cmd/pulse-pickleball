-- Close two role-escalation gaps on public.group_members.
--
-- The original RLS policies (20251228132633) wrote:
--   * "Admins can update members"      USING is_group_admin(...)
--   * "Users can update own membership" USING auth.uid() = user_id
-- Neither had a WITH CHECK clause. Postgres RLS UPDATE without a
-- WITH CHECK allows any column on the NEW row to be set to any
-- value, as long as the USING clause matched the OLD row. That left
-- two ways to mint a new owner without being one:
--
--   1. Moderator escalation. is_group_admin() returns true for owner
--      OR moderator. A moderator passes the USING and could UPDATE
--      another member's row SET role='owner' — promoting anyone, or
--      themselves on someone else's row by proxy.
--
--   2. Self-escalation. Any active member passes
--      auth.uid() = user_id on their own row and could UPDATE
--      SET role='owner' on themselves directly.
--
-- This migration closes both:
--
--   * Policy "Admins can update members" gets a WITH CHECK that
--     additionally requires the caller to be the owner if the new
--     role is 'owner'. Non-owner admins can still update everything
--     else (status, role demotions to moderator/member, etc.).
--
--   * A BEFORE UPDATE trigger guards self-updates by non-admins:
--     role, status, group_id, user_id, and joined_at are pinned to
--     their OLD values. The "soft" fields (last_read_at, etc.) are
--     still freely updatable. Admin updates fall through the trigger
--     because admins are gated by the RLS policy above with its own
--     WITH CHECK.

-- 1. Replace "Admins can update members" with a WITH-CHECKed variant.
DROP POLICY IF EXISTS "Admins can update members" ON public.group_members;

CREATE POLICY "Admins can update members"
  ON public.group_members
  FOR UPDATE
  USING (public.is_group_admin(auth.uid(), group_id))
  WITH CHECK (
    public.is_group_admin(auth.uid(), group_id)
    AND (
      role <> 'owner'
      OR public.has_group_role(auth.uid(), group_id, 'owner')
    )
  );

-- 2. BEFORE UPDATE trigger to pin privileged columns for non-admin
--    self-updates. Admins still pass through because their RLS path
--    is the policy above, and the trigger short-circuits when the
--    caller is an admin of this group.
CREATE OR REPLACE FUNCTION public.group_members_self_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  -- If the caller is updating someone else's row, they must be an
  -- admin — and the "Admins can update members" RLS policy above is
  -- already enforcing role-escalation rules. Let it through.
  IF NEW.user_id IS DISTINCT FROM v_caller THEN
    RETURN NEW;
  END IF;

  -- Admins updating their own row are fine — same path as above.
  IF public.is_group_admin(v_caller, NEW.group_id) THEN
    RETURN NEW;
  END IF;

  -- Non-admin self-update: pin privileged columns to their OLD value.
  -- This blocks the "any member sets own role='owner'" escalation.
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Cannot change own role' USING ERRCODE = '42501';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Cannot change own status' USING ERRCODE = '42501';
  END IF;
  IF NEW.group_id IS DISTINCT FROM OLD.group_id THEN
    RAISE EXCEPTION 'Cannot change own group_id' USING ERRCODE = '42501';
  END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Cannot change own user_id' USING ERRCODE = '42501';
  END IF;
  IF NEW.joined_at IS DISTINCT FROM OLD.joined_at THEN
    RAISE EXCEPTION 'Cannot change joined_at' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_group_members_self_update_guard ON public.group_members;
CREATE TRIGGER trigger_group_members_self_update_guard
  BEFORE UPDATE ON public.group_members
  FOR EACH ROW
  EXECUTE FUNCTION public.group_members_self_update_guard();
