CREATE TABLE IF NOT EXISTS public.rpc_rate_limit_log (
  id          bigserial    PRIMARY KEY,
  caller_id   uuid,
  action      text         NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rpc_rate_limit_log_caller_action_time
  ON public.rpc_rate_limit_log (caller_id, action, attempted_at DESC);

ALTER TABLE public.rpc_rate_limit_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.enforce_rpc_rate_limit(
  p_action          text,
  p_max_attempts    int,
  p_window_seconds  int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_recent int;
BEGIN
  IF v_caller IS NULL THEN
    INSERT INTO public.rpc_rate_limit_log (caller_id, action)
    VALUES (NULL, p_action);
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_recent
  FROM public.rpc_rate_limit_log
  WHERE caller_id = v_caller
    AND action = p_action
    AND attempted_at >= now() - make_interval(secs => p_window_seconds);

  IF v_recent >= p_max_attempts THEN
    RAISE EXCEPTION 'Too many attempts. Please try again in a minute.'
      USING ERRCODE = '54000';
  END IF;

  INSERT INTO public.rpc_rate_limit_log (caller_id, action)
  VALUES (v_caller, p_action);
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_rpc_rate_limit(text, int, int) FROM public;
GRANT EXECUTE ON FUNCTION public.enforce_rpc_rate_limit(text, int, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.cleanup_rpc_rate_limit_log()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.rpc_rate_limit_log
  WHERE attempted_at < now() - INTERVAL '24 hours';
END;
$$;

CREATE OR REPLACE FUNCTION public.find_group_by_invite_code(p_code text)
RETURNS TABLE (
  id uuid, name text, description text, type text, visibility text,
  join_method text, cover_url text, icon_url text, member_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.enforce_rpc_rate_limit('find_group_by_invite_code', 60, 60);

  RETURN QUERY
  SELECT g.id, g.name, g.description, g.type::text, g.visibility::text,
         g.join_method::text, g.cover_url, g.icon_url, g.member_count
  FROM public.groups g
  WHERE g.invite_code IS NOT NULL
    AND public.normalize_invite_code(g.invite_code) = public.normalize_invite_code(p_code)
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

  SELECT * INTO v_group FROM public.groups
  WHERE invite_code IS NOT NULL
    AND public.normalize_invite_code(invite_code) = public.normalize_invite_code(p_code)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found', 'message', 'Invalid invite code');
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