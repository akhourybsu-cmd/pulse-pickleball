-- =====================================================================
-- create_league: auto-enroll the creator as a league member (manager)
--
-- Why: get_my_leagues_with_context — the RPC behind the player-side
-- "My Leagues" list — only returns leagues where the caller is an
-- ACTIVE member (and visibility <> 'admin_only'). A self-serve owner
-- who created a league but was never added as a member therefore had
-- NO entry point back into their own league from the player surface:
-- the list was empty, and PlayerLeagueDetail (which surfaces the
-- "Manage" button) is only reachable from that list. Platform admins
-- could still reach it via /admin/leagues, but a non-admin owner —
-- exactly who the self-serve create path is for — hit a dead end.
--
-- Fix: when a user creates a league, immediately enroll them as an
-- active 'manager' member (season/division unset — they attach later).
-- This is idempotent-safe: the membership row is brand-new for a
-- brand-new league, and the UNIQUE(league_id, season_id, user_id)
-- constraint treats the NULL season_id as distinct.
--
-- Only the create path changes. Ownership/RLS (is_league_admin) is
-- untouched — the manager membership is purely so the league shows up
-- in the owner's own list.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.create_league(
  p_name        TEXT,
  p_description TEXT DEFAULT NULL,
  p_location    TEXT DEFAULT NULL,
  p_league_type TEXT DEFAULT 'doubles'
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user       UUID := auth.uid();
  v_is_admin   BOOLEAN;
  v_owned      INT;
  v_new_id     UUID;
  v_trimmed    TEXT;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  v_trimmed := TRIM(COALESCE(p_name, ''));
  IF v_trimmed = '' THEN
    RAISE EXCEPTION 'League name is required' USING ERRCODE = '22023';
  END IF;
  IF p_league_type NOT IN ('singles', 'doubles', 'team', 'flex', 'ladder') THEN
    RAISE EXCEPTION 'Invalid league_type %', p_league_type
      USING ERRCODE = '22023';
  END IF;

  v_is_admin := public.has_role(v_user, 'admin'::app_role);

  -- Freemium gate: non-admins may own at most 1 league until they
  -- subscribe. Platform admins skip the check entirely.
  IF NOT v_is_admin THEN
    SELECT COUNT(*)::INT INTO v_owned
      FROM public.leagues
     WHERE created_by = v_user;
    IF v_owned >= 1 THEN
      RAISE EXCEPTION
        'You already own a league. Upgrade to create more.'
        USING ERRCODE = '53300',
              HINT   = 'league_quota_exceeded';
    END IF;
  END IF;

  INSERT INTO public.leagues
    (name, description, location, created_by, league_type,
     status, visibility)
  VALUES (
    v_trimmed,
    NULLIF(TRIM(COALESCE(p_description, '')), ''),
    NULLIF(TRIM(COALESCE(p_location, '')), ''),
    v_user,
    p_league_type::league_type,
    -- Self-serve leagues default to draft + private so the creator
    -- can scaffold before flipping visibility.
    'draft'::league_status,
    'private'::league_visibility
  ) RETURNING id INTO v_new_id;

  -- Enroll the creator as an active manager so the league shows up in
  -- THEIR "My Leagues" list immediately (and, from there, the Manage
  -- button). Season/division stay NULL until they scaffold those.
  INSERT INTO public.league_members
    (league_id, season_id, division_id, user_id, role, status)
  VALUES
    (v_new_id, NULL, NULL, v_user, 'manager', 'active')
  ON CONFLICT (league_id, season_id, user_id) DO NOTHING;

  -- Auto-log the creation so the audit tab isn't empty on the
  -- creator's first visit.
  INSERT INTO public.league_audit_log
    (league_id, actor_user_id, action, entity_type, entity_id, new_value)
  VALUES (
    v_new_id, v_user, 'league.created', 'league', v_new_id,
    jsonb_build_object(
      'name', v_trimmed,
      'league_type', p_league_type,
      'via', 'self_serve',
      'owner_enrolled_as', 'manager'
    )
  );

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_league(TEXT, TEXT, TEXT, TEXT)
  TO authenticated;

COMMENT ON FUNCTION public.create_league IS
  'Self-serve entrypoint. Any authenticated user can create their '
  'first league for free; a 2nd+ raises SQLSTATE 53300 with HINT '
  'league_quota_exceeded so the client can open a paywall. Platform '
  'admins bypass the gate. New leagues default to (status=draft, '
  'visibility=private). The creator is auto-enrolled as an active '
  'manager member so the league appears in their own My Leagues list.';
