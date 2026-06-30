-- Two related security-tier additions, bundled for one deploy:
--   A) Invite-code expiration (audit item 13, tier A2)
--   B) Group admin audit log (audit item 16, tier B1)

-- =====================================================================
-- A) Invite-code expiration — hard expiry, owner-opt-in
-- =====================================================================
-- Today groups.invite_code lives forever after generation. A leaked
-- screenshot is permanently exploitable. This adds invite_code_expires_at
-- as a nullable timestamp:
--   * NULL  = never expires (preserves prior behavior, the default)
--   * !NULL = code rejected when now() > expires_at
--
-- The owner sets the expiry at rotate time via a new parameter on
-- regenerate_group_invite_code. find_group_by_invite_code surfaces an
-- is_expired flag so the landing UI can show distinct copy. join_group_by_code
-- returns status='expired' for the same reason.

ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS invite_code_expires_at timestamptz;

-- Drop the prior signature so we can add the new param.
DROP FUNCTION IF EXISTS public.regenerate_group_invite_code(uuid);

CREATE OR REPLACE FUNCTION public.regenerate_group_invite_code(
  p_group_id           uuid,
  p_expires_in_seconds int DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller   uuid := auth.uid();
  v_is_owner boolean;
  v_new_code text;
  v_expires  timestamptz;
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
  v_expires := CASE
    WHEN p_expires_in_seconds IS NULL OR p_expires_in_seconds <= 0
      THEN NULL
    ELSE now() + make_interval(secs => p_expires_in_seconds)
  END;

  UPDATE public.groups
  SET invite_code = v_new_code,
      invite_code_expires_at = v_expires
  WHERE id = p_group_id;

  RETURN jsonb_build_object(
    'invite_code', v_new_code,
    'expires_at', v_expires
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.regenerate_group_invite_code(uuid, int) TO authenticated;

-- find_group_by_invite_code now also returns is_expired so the landing
-- page can show "This code has expired" instead of conflating with the
-- "Invite not available" branch.
CREATE OR REPLACE FUNCTION public.find_group_by_invite_code(p_code text)
RETURNS TABLE (
  id uuid, name text, description text, type text, visibility text,
  join_method text, cover_url text, icon_url text, member_count integer,
  is_expired boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.enforce_rpc_rate_limit('find_group_by_invite_code', 60, 60);

  RETURN QUERY
  SELECT
    g.id, g.name, g.description,
    g.type::text, g.visibility::text, g.join_method::text,
    g.cover_url, g.icon_url, g.member_count,
    (g.invite_code_expires_at IS NOT NULL AND g.invite_code_expires_at < now()) AS is_expired
  FROM public.groups g
  WHERE g.invite_code IS NOT NULL
    AND public.normalize_invite_code(g.invite_code) = public.normalize_invite_code(p_code)
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_group_by_invite_code(text) TO authenticated, anon;

-- join_group_by_code rejects expired codes with status='expired'.
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

  SELECT * INTO v_group FROM public.groups
  WHERE invite_code IS NOT NULL
    AND public.normalize_invite_code(invite_code) = public.normalize_invite_code(p_code)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found', 'message', 'Invalid invite code');
  END IF;

  IF v_group.invite_code_expires_at IS NOT NULL
     AND v_group.invite_code_expires_at < now() THEN
    RETURN jsonb_build_object('status', 'expired', 'message', 'This invite code has expired');
  END IF;

  SELECT * INTO v_existing FROM public.group_members
  WHERE group_id = v_group.id AND user_id = v_user LIMIT 1;

  IF FOUND THEN
    IF v_existing.status = 'active' THEN
      RETURN jsonb_build_object('status', 'already_member', 'group_id', v_group.id, 'group_name', v_group.name);
    ELSIF v_existing.status = 'banned' THEN
      RETURN jsonb_build_object('status', 'banned', 'message', 'You have been banned from this group');
    ELSIF v_existing.status = 'pending' THEN
      RETURN jsonb_build_object('status', 'pending', 'group_id', v_group.id, 'group_name', v_group.name);
    END IF;
  END IF;

  IF v_group.join_method::text = 'request_to_join' THEN
    v_status := 'pending';
  ELSE
    v_status := 'active';
  END IF;

  IF v_existing.id IS NOT NULL THEN
    UPDATE public.group_members SET status = v_status WHERE id = v_existing.id;
  ELSE
    INSERT INTO public.group_members (group_id, user_id, role, status)
    VALUES (v_group.id, v_user, 'member', v_status);
  END IF;

  RETURN jsonb_build_object(
    'status', CASE WHEN v_status = 'active' THEN 'joined' ELSE 'pending' END,
    'group_id', v_group.id,
    'group_name', v_group.name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_group_by_code(text) TO authenticated;

-- =====================================================================
-- B) Group admin audit log — trigger-only (no admin UI yet)
-- =====================================================================
-- Captures every change to groups (settings) and group_members
-- (joins, leaves, role/status changes). Each row is one event.
-- Triggers run SECURITY DEFINER so they bypass RLS to write; the
-- table's own RLS restricts SELECT to owner+moderator of the group.

CREATE TABLE IF NOT EXISTS public.group_audit_log (
  id              bigserial    PRIMARY KEY,
  group_id        uuid         NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  actor_id        uuid,                  -- null when triggered by a system function
  action          text         NOT NULL, -- 'settings_changed' | 'member_added' | 'member_updated' | 'member_removed' | 'invite_code_rotated'
  target_user_id  uuid,                  -- the affected member, null for group-level events
  before          jsonb,                 -- relevant subset of OLD; null on INSERT
  after           jsonb,                 -- relevant subset of NEW; null on DELETE
  created_at      timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_group_audit_log_group_time
  ON public.group_audit_log (group_id, created_at DESC);

ALTER TABLE public.group_audit_log ENABLE ROW LEVEL SECURITY;

-- Admins (owner + moderator) of the group can read its audit log.
-- No INSERT/UPDATE/DELETE policies = no client writes; the triggers
-- below are the only path to add rows.
DROP POLICY IF EXISTS "Admins can read group audit log" ON public.group_audit_log;
CREATE POLICY "Admins can read group audit log"
  ON public.group_audit_log FOR SELECT
  USING (public.is_group_admin(auth.uid(), group_id));

-- ---- Trigger function for groups table changes ----
-- Captures setting edits to a curated set of columns. We exclude
-- invite_code rotations here — those go through their own RPC and
-- are audited in that RPC's wrapper trigger below.
CREATE OR REPLACE FUNCTION public.audit_groups_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before jsonb;
  v_after  jsonb;
  v_action text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Settings change — only log if a "meaningful" column actually moved.
    -- (member_count and updated_at churn shouldn't spam the log.)
    IF NEW.name              IS DISTINCT FROM OLD.name
       OR NEW.description    IS DISTINCT FROM OLD.description
       OR NEW.type           IS DISTINCT FROM OLD.type
       OR NEW.visibility     IS DISTINCT FROM OLD.visibility
       OR NEW.join_method    IS DISTINCT FROM OLD.join_method
       OR NEW.icon_url       IS DISTINCT FROM OLD.icon_url
       OR NEW.cover_url      IS DISTINCT FROM OLD.cover_url THEN
      v_action := 'settings_changed';
      v_before := jsonb_build_object(
        'name', OLD.name, 'description', OLD.description, 'type', OLD.type,
        'visibility', OLD.visibility, 'join_method', OLD.join_method,
        'icon_url', OLD.icon_url, 'cover_url', OLD.cover_url
      );
      v_after := jsonb_build_object(
        'name', NEW.name, 'description', NEW.description, 'type', NEW.type,
        'visibility', NEW.visibility, 'join_method', NEW.join_method,
        'icon_url', NEW.icon_url, 'cover_url', NEW.cover_url
      );
      INSERT INTO public.group_audit_log (group_id, actor_id, action, before, after)
      VALUES (NEW.id, auth.uid(), v_action, v_before, v_after);
    END IF;

    -- Invite code rotation captured as its own event (more useful for
    -- forensics than burying it in a "settings_changed" diff).
    IF NEW.invite_code IS DISTINCT FROM OLD.invite_code
       OR NEW.invite_code_expires_at IS DISTINCT FROM OLD.invite_code_expires_at THEN
      INSERT INTO public.group_audit_log (group_id, actor_id, action, before, after)
      VALUES (
        NEW.id,
        auth.uid(),
        'invite_code_rotated',
        jsonb_build_object('expires_at', OLD.invite_code_expires_at),
        jsonb_build_object('expires_at', NEW.invite_code_expires_at)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_audit_groups_changes ON public.groups;
CREATE TRIGGER trigger_audit_groups_changes
  AFTER UPDATE ON public.groups
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_groups_changes();

-- ---- Trigger function for group_members changes ----
-- Captures joins, leaves, role changes, status changes.
CREATE OR REPLACE FUNCTION public.audit_group_members_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.group_audit_log (group_id, actor_id, action, target_user_id, after)
    VALUES (
      NEW.group_id,
      auth.uid(),
      'member_added',
      NEW.user_id,
      jsonb_build_object('role', NEW.role, 'status', NEW.status)
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Only log when role or status actually moved (last_read_at churn
    -- happens on every chat / feed render — would be spam).
    IF NEW.role IS DISTINCT FROM OLD.role
       OR NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.group_audit_log (group_id, actor_id, action, target_user_id, before, after)
      VALUES (
        NEW.group_id,
        auth.uid(),
        'member_updated',
        NEW.user_id,
        jsonb_build_object('role', OLD.role, 'status', OLD.status),
        jsonb_build_object('role', NEW.role, 'status', NEW.status)
      );
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.group_audit_log (group_id, actor_id, action, target_user_id, before)
    VALUES (
      OLD.group_id,
      auth.uid(),
      'member_removed',
      OLD.user_id,
      jsonb_build_object('role', OLD.role, 'status', OLD.status)
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_audit_group_members_changes ON public.group_members;
CREATE TRIGGER trigger_audit_group_members_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.group_members
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_group_members_changes();
