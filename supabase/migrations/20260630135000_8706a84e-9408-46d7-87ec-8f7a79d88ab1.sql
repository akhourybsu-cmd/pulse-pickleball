
ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS invite_code_expires_at timestamptz;

DROP FUNCTION IF EXISTS public.regenerate_group_invite_code(uuid);

CREATE OR REPLACE FUNCTION public.regenerate_group_invite_code(
  p_group_id uuid,
  p_ttl_hours integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_is_owner boolean;
  v_new_code text;
  v_expires_at timestamptz;
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

  v_new_code := public.generate_group_invite_code();

  IF p_ttl_hours IS NOT NULL AND p_ttl_hours > 0 THEN
    v_expires_at := now() + make_interval(hours => p_ttl_hours);
  ELSE
    v_expires_at := NULL;
  END IF;

  UPDATE public.groups
  SET invite_code = v_new_code,
      invite_code_expires_at = v_expires_at
  WHERE id = p_group_id;

  RETURN jsonb_build_object(
    'invite_code', v_new_code,
    'expires_at', v_expires_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.regenerate_group_invite_code(uuid, integer) TO authenticated;

DROP FUNCTION IF EXISTS public.find_group_by_invite_code(text);

CREATE OR REPLACE FUNCTION public.find_group_by_invite_code(p_code text)
RETURNS TABLE(
  id uuid,
  name text,
  description text,
  type text,
  visibility text,
  join_method text,
  cover_url text,
  icon_url text,
  member_count integer,
  invite_code_expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.enforce_rpc_rate_limit('find_group_by_invite_code', 60, 60);

  RETURN QUERY
  SELECT g.id, g.name, g.description, g.type::text, g.visibility::text,
         g.join_method::text, g.cover_url, g.icon_url, g.member_count,
         g.invite_code_expires_at
  FROM public.groups g
  WHERE g.invite_code IS NOT NULL
    AND public.normalize_invite_code(g.invite_code) = public.normalize_invite_code(p_code)
    AND (g.invite_code_expires_at IS NULL OR g.invite_code_expires_at > now())
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_group_by_invite_code(text) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.join_group_by_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_group public.groups%ROWTYPE;
  v_existing public.group_members%ROWTYPE;
  v_status text;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Not authenticated');
  END IF;

  PERFORM public.enforce_rpc_rate_limit('join_group_by_code', 10, 60);

  SELECT * INTO v_group
  FROM public.groups
  WHERE invite_code IS NOT NULL
    AND public.normalize_invite_code(invite_code) = public.normalize_invite_code(p_code)
  LIMIT 1;

  IF v_group.id IS NULL THEN
    RETURN jsonb_build_object('status', 'not_found', 'message', 'Invite code not found');
  END IF;

  IF v_group.invite_code_expires_at IS NOT NULL AND v_group.invite_code_expires_at <= now() THEN
    RETURN jsonb_build_object('status', 'expired', 'message', 'This invite code has expired');
  END IF;

  SELECT * INTO v_existing
  FROM public.group_members
  WHERE group_id = v_group.id AND user_id = v_user
  LIMIT 1;

  IF v_existing.user_id IS NOT NULL THEN
    IF v_existing.status = 'active' THEN
      RETURN jsonb_build_object('status', 'already_member', 'group_id', v_group.id);
    ELSIF v_existing.status = 'banned' THEN
      RETURN jsonb_build_object('status', 'banned', 'message', 'You are banned from this group');
    ELSE
      UPDATE public.group_members
      SET status = 'active', role = COALESCE(role, 'member'::group_role)
      WHERE group_id = v_group.id AND user_id = v_user;
      RETURN jsonb_build_object('status', 'joined', 'group_id', v_group.id);
    END IF;
  END IF;

  IF v_group.join_method = 'request' THEN
    v_status := 'pending';
  ELSE
    v_status := 'active';
  END IF;

  INSERT INTO public.group_members (group_id, user_id, role, status)
  VALUES (v_group.id, v_user, 'member'::group_role, v_status);

  RETURN jsonb_build_object(
    'status', CASE WHEN v_status = 'pending' THEN 'requested' ELSE 'joined' END,
    'group_id', v_group.id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_group_by_code(text) TO authenticated;

CREATE TABLE IF NOT EXISTS public.group_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL,
  actor_user_id uuid,
  target_user_id uuid,
  action text NOT NULL,
  old_role text,
  new_role text,
  old_status text,
  new_status text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.group_audit_log TO authenticated;
GRANT ALL ON public.group_audit_log TO service_role;

CREATE INDEX IF NOT EXISTS idx_group_audit_log_group_created
  ON public.group_audit_log (group_id, created_at DESC);

ALTER TABLE public.group_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners and moderators read audit log" ON public.group_audit_log;
CREATE POLICY "Owners and moderators read audit log"
ON public.group_audit_log
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = group_audit_log.group_id
      AND gm.user_id = auth.uid()
      AND gm.role IN ('owner'::group_role, 'moderator'::group_role)
      AND gm.status = 'active'
  )
);

CREATE OR REPLACE FUNCTION public.log_group_member_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.group_audit_log (group_id, actor_user_id, target_user_id, action, new_role, new_status)
    VALUES (NEW.group_id, v_actor, NEW.user_id,
            CASE WHEN NEW.status = 'pending' THEN 'requested' ELSE 'joined' END,
            NEW.role::text, NEW.status::text);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.role IS DISTINCT FROM OLD.role OR NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.group_audit_log (
        group_id, actor_user_id, target_user_id, action,
        old_role, new_role, old_status, new_status
      ) VALUES (
        NEW.group_id, v_actor, NEW.user_id,
        CASE
          WHEN NEW.role IS DISTINCT FROM OLD.role THEN 'role_changed'
          ELSE 'status_changed'
        END,
        OLD.role::text, NEW.role::text,
        OLD.status::text, NEW.status::text
      );
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.group_audit_log (group_id, actor_user_id, target_user_id, action, old_role, old_status)
    VALUES (OLD.group_id, v_actor, OLD.user_id, 'left', OLD.role::text, OLD.status::text);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_group_member_change ON public.group_members;
CREATE TRIGGER trg_log_group_member_change
AFTER INSERT OR UPDATE OR DELETE ON public.group_members
FOR EACH ROW EXECUTE FUNCTION public.log_group_member_change();
