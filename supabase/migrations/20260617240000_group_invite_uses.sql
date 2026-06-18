-- =====================================================================
-- Community Phase 4.2 — invite code usage analytics.
--
-- One row per (user, code, group) attempt. Records who tried to join
-- with which code and the outcome, so a host can see whether the link
-- they texted actually worked.
--
-- outcome:
--   'joined'   — landed in group_members.status = 'active'
--   'pending'  — request_to_join, awaiting approval
--   'duplicate'— already a member; no action taken
--   'failed'   — bad code, banned, invite-only without code, etc.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.group_invite_uses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  outcome     TEXT NOT NULL,
  used_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS group_invite_uses_group_idx
  ON public.group_invite_uses (group_id, used_at DESC);

ALTER TABLE public.group_invite_uses ENABLE ROW LEVEL SECURITY;

-- The viewer's own attempts (read).
DROP POLICY IF EXISTS "Users read their own invite uses" ON public.group_invite_uses;
CREATE POLICY "Users read their own invite uses"
  ON public.group_invite_uses FOR SELECT
  USING (auth.uid() = user_id);

-- Group owners / moderators can read every attempt against their group.
DROP POLICY IF EXISTS "Admins read group invite uses" ON public.group_invite_uses;
CREATE POLICY "Admins read group invite uses"
  ON public.group_invite_uses FOR SELECT
  USING (
    group_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.group_members gm
       WHERE gm.group_id = group_invite_uses.group_id
         AND gm.user_id = auth.uid()
         AND gm.status = 'active'
         AND gm.role IN ('owner', 'moderator')
    )
  );

-- Authenticated users can insert their own attempt.
DROP POLICY IF EXISTS "Users record their own invite use" ON public.group_invite_uses;
CREATE POLICY "Users record their own invite use"
  ON public.group_invite_uses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- group_invite_summary — convenience aggregate for the admin UI. Counts
-- per outcome across all the group's codes, plus the most recent
-- attempt. Wrapped in a SECURITY DEFINER function so the RLS check
-- happens once at function-entry rather than per row.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.group_invite_summary(p_group_id UUID)
RETURNS TABLE(
  joined     INTEGER,
  pending    INTEGER,
  duplicate  INTEGER,
  failed     INTEGER,
  total      INTEGER,
  last_used  TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.group_members gm
     WHERE gm.group_id = p_group_id
       AND gm.user_id  = auth.uid()
       AND gm.status   = 'active'
       AND gm.role IN ('owner', 'moderator')
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT
      COUNT(*) FILTER (WHERE outcome = 'joined')::INT,
      COUNT(*) FILTER (WHERE outcome = 'pending')::INT,
      COUNT(*) FILTER (WHERE outcome = 'duplicate')::INT,
      COUNT(*) FILTER (WHERE outcome = 'failed')::INT,
      COUNT(*)::INT,
      MAX(used_at)
      FROM public.group_invite_uses
     WHERE group_id = p_group_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.group_invite_summary(UUID) TO authenticated;
