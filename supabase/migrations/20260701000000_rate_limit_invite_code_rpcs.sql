-- Rate-limit invite-code RPCs.
--
-- Two SECURITY DEFINER functions sit between anonymous / arbitrary
-- authenticated callers and the groups table:
--
--   * find_group_by_invite_code(p_code) — anon + authenticated, used
--     by the invite-link landing page to preview a group before sign-in.
--   * join_group_by_code(p_code)        — authenticated only.
--
-- The invite-code format is XXXX-YYYY (8 hex chars, ~4.3B combinations).
-- That's enough entropy that random brute-force is impractical at
-- normal QPS, but a determined authenticated attacker could still
-- enumerate at high request rate and pull tens of thousands of group
-- IDs / names out of the lookup function. There's no friction today.
--
-- This migration adds a small generic rate-limit helper backed by a
-- log table and gates both RPCs through it. The authenticated path
-- hard-blocks once the per-user threshold is crossed; the anon path
-- (no auth.uid()) is logged but not blocked — true anon rate-limiting
-- needs an IP-aware layer (edge function / reverse proxy) which is
-- out of scope for this migration. Even so, the log gives a paper
-- trail if anonymous floods need to be investigated later.

-- =====================================================================
-- 1. rate-limit log table
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.rpc_rate_limit_log (
  id          bigserial    PRIMARY KEY,
  caller_id   uuid,                 -- null for anon callers
  action      text         NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

-- Index supports the per-(caller, action, window) count query below.
CREATE INDEX IF NOT EXISTS idx_rpc_rate_limit_log_caller_action_time
  ON public.rpc_rate_limit_log (caller_id, action, attempted_at DESC);

-- The log is admin-only — no direct client read/write. SECURITY
-- DEFINER functions own all writes; admin/cron jobs own cleanup.
ALTER TABLE public.rpc_rate_limit_log ENABLE ROW LEVEL SECURITY;
-- (No policies = no client access. The SECURITY DEFINER functions
-- below bypass RLS as the table owner.)

-- =====================================================================
-- 2. helper function — enforce_rpc_rate_limit
-- =====================================================================
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
    -- Anon caller: log for observability, don't block. See header.
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
      USING ERRCODE = '54000';  -- program_limit_exceeded
  END IF;

  INSERT INTO public.rpc_rate_limit_log (caller_id, action)
  VALUES (v_caller, p_action);
END;
$$;

-- Authenticated execute. (Anon paths reach the helper transitively
-- through the calling RPCs, both of which are SECURITY DEFINER and
-- run as the function owner.)
REVOKE ALL ON FUNCTION public.enforce_rpc_rate_limit(text, int, int) FROM public;
GRANT EXECUTE ON FUNCTION public.enforce_rpc_rate_limit(text, int, int) TO authenticated;

-- =====================================================================
-- 3. opportunistic cleanup — drop logs older than 24h, run from any
--    rate-limit-gated RPC once we're inside its transaction. Kept as
--    a separate function so the cost is bounded and explicit.
-- =====================================================================
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

-- =====================================================================
-- 4. Rebuild find_group_by_invite_code to invoke the rate-limit helper
--    on each call. Function flips from `language sql stable` to
--    `language plpgsql` because the helper inserts (a side effect),
--    which a STABLE function isn't allowed to have. The table-return
--    shape is preserved.
-- =====================================================================
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
  -- Generous limit — invite-link landings are usually one per visit;
  -- a real human shouldn't hit 60/min. Anon callers fall through
  -- (logged, not blocked) per enforce_rpc_rate_limit's contract.
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

-- Re-grant in case Postgres dropped the prior grants when the function
-- signature was implicitly redefined. (Same grants as the original
-- 20260619003106 migration.)
GRANT EXECUTE ON FUNCTION public.find_group_by_invite_code(text) TO authenticated, anon;

-- =====================================================================
-- 5. Rebuild join_group_by_code with the rate-limit helper. Tighter
--    limit than find — actual joining is a one-and-done; nobody joins
--    20 groups by code in a minute organically. Brute-forcing this
--    one is also worse than find because it can spam membership rows
--    in pending state.
-- =====================================================================
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

  -- Invite codes bypass invite_only (the code IS the invite).
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
