-- Server-side invite-code regeneration with uniqueness guarantee.
--
-- Pre-migration, GroupManage.regenerateInviteCode() generated a code
-- via Math.random() in the client and did a plain UPDATE on groups.
-- That had three problems:
--   1. No uniqueness check — two owners regenerating at the same
--      moment could collide (low probability but no formal guarantee).
--   2. No audit / authorization context — the client decided to call
--      it; the row's owner check came from RLS only, and the new
--      code's entropy/format wasn't centralized.
--   3. The trigger-driven generate_group_invite_code() already does
--      retry-until-unique for INSERT; the regenerate path skipped it.
--
-- This RPC wraps generate_group_invite_code() with an owner check and
-- updates the row in one transaction. The owner check is belt and
-- suspenders — RLS already gates UPDATE on groups to owners — but it
-- makes the failure mode an explicit "permission denied" instead of a
-- silent UPDATE that affects zero rows.

CREATE OR REPLACE FUNCTION public.regenerate_group_invite_code(p_group_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_is_owner boolean;
  v_new_code text;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT EXISTS(
    SELECT 1
    FROM public.group_members
    WHERE group_id = p_group_id
      AND user_id = v_caller
      AND role = 'owner'
      AND status = 'active'
  ) INTO v_is_owner;

  IF NOT v_is_owner THEN
    RAISE EXCEPTION 'Only the group owner can regenerate the invite code'
      USING ERRCODE = '42501';
  END IF;

  -- Reuses the existing helper which loops until the generated code
  -- is unique across all groups.invite_code values.
  v_new_code := public.generate_group_invite_code();

  UPDATE public.groups
  SET invite_code = v_new_code
  WHERE id = p_group_id;

  RETURN v_new_code;
END;
$$;

-- Authenticated users can call it; the function does its own owner
-- check above and refuses non-owners with a clear error.
GRANT EXECUTE ON FUNCTION public.regenerate_group_invite_code(uuid) TO authenticated;
