-- =====================================================================
-- user_roles last-admin guard (Phase 3.B.2).
--
-- The existing "Admins can manage all roles" policy (FOR ALL USING
-- (has_role(...,'admin'))) is convenient but leaves one operational
-- footgun: a sole admin who removes their own admin role — or deletes
-- their own user_roles row entirely — leaves the system with ZERO
-- admins and no way to grant the role back without a service-role
-- query in the Supabase SQL editor.
--
-- This trigger blocks any DELETE / UPDATE that would reduce the total
-- number of admins to zero. It does NOT change RLS — the existing
-- policy stays as-is; this is a row-level integrity guard.
--
-- Net behavior:
--   • Two or more admins exist → any single demotion/removal proceeds.
--   • Exactly one admin exists → demoting / deleting them is rejected.
--   • Bootstrap edge case (no admin rows yet) → trigger no-ops because
--     no admin row is being touched.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.prevent_last_admin_removal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_count_after INT;
  v_old_was_admin     BOOLEAN;
  v_new_is_admin      BOOLEAN;
BEGIN
  v_old_was_admin := COALESCE(OLD.role::text = 'admin', false);
  IF TG_OP = 'DELETE' THEN
    v_new_is_admin := false;
  ELSE
    v_new_is_admin := COALESCE(NEW.role::text = 'admin', false);
  END IF;

  -- If the operation doesn't touch an admin row (or keeps it as
  -- admin), nothing to check.
  IF NOT v_old_was_admin OR v_new_is_admin THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Count admins *after* the operation: subtract this row.
  SELECT COUNT(*) INTO v_admin_count_after
    FROM public.user_roles
   WHERE role = 'admin'::app_role
     AND id <> OLD.id;

  IF v_admin_count_after = 0 THEN
    RAISE EXCEPTION
      'Cannot remove the last admin — promote another user to admin first'
      USING ERRCODE = '42501';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS prevent_last_admin_removal ON public.user_roles;
CREATE TRIGGER prevent_last_admin_removal
BEFORE UPDATE OR DELETE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_last_admin_removal();

COMMENT ON TRIGGER prevent_last_admin_removal ON public.user_roles IS
  'Phase 3.B.2 — refuses to demote / delete the last remaining admin '
  'so the system can never be locked out without service-role access.';
