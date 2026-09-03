-- The July audit migration used CREATE TABLE IF NOT EXISTS with a different
-- shape from the existing June table. Its triggers referenced nonexistent
-- actor_id/before/after columns and blocked joins, transfers, and settings.
-- Keep the canonical June schema and membership audit; preserve all old rows.
BEGIN;

DROP TRIGGER IF EXISTS trigger_audit_group_members_changes ON public.group_members;
DROP FUNCTION IF EXISTS public.audit_group_members_changes();

CREATE OR REPLACE FUNCTION public.audit_groups_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before jsonb;
  v_after jsonb;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    v_before := jsonb_build_object(
      'name', OLD.name, 'description', OLD.description, 'type', OLD.type,
      'visibility', OLD.visibility, 'join_method', OLD.join_method,
      'icon_url', OLD.icon_url, 'cover_url', OLD.cover_url,
      'settings', OLD.settings
    );
    v_after := jsonb_build_object(
      'name', NEW.name, 'description', NEW.description, 'type', NEW.type,
      'visibility', NEW.visibility, 'join_method', NEW.join_method,
      'icon_url', NEW.icon_url, 'cover_url', NEW.cover_url,
      'settings', NEW.settings
    );
    IF v_before IS DISTINCT FROM v_after THEN
      INSERT INTO public.group_audit_log (group_id, actor_user_id, action, metadata)
      VALUES (NEW.id, auth.uid(), 'settings_changed',
              jsonb_build_object('before', v_before, 'after', v_after));
    END IF;

    IF NEW.invite_code IS DISTINCT FROM OLD.invite_code
       OR NEW.invite_code_expires_at IS DISTINCT FROM OLD.invite_code_expires_at THEN
      INSERT INTO public.group_audit_log (group_id, actor_user_id, action, metadata)
      VALUES (NEW.id, auth.uid(), 'invite_code_rotated', jsonb_build_object(
        'before', jsonb_build_object('expires_at', OLD.invite_code_expires_at),
        'after', jsonb_build_object('expires_at', NEW.invite_code_expires_at)
      ));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;
