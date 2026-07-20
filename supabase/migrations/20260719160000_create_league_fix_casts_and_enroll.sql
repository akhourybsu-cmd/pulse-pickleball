-- =====================================================================
-- Fix create_league regression + keep owner auto-enroll.
--
-- 20260718120000 (auto-enroll owner) was mistakenly rebuilt from the OLD
-- 20260703330000 body, which:
--   1. cast to nonexistent enum types (p_league_type::league_type,
--      'draft'::league_status, 'private'::league_visibility) — the
--      leagues columns are TEXT + CHECK, so EVERY create_league call
--      fails with `type "league_type" does not exist` (SQLSTATE 42704).
--      This is the "league type doesn't exist" error when creating a
--      league of ANY type, including the doubles ladder.
--   2. replaced the freemium quota (1 + purchased additional_league_slots
--      from 20260708110000) with a hard 1-league cap.
--
-- This migration restores the correct cast-free body + slot-aware quota
-- (from 20260708110000) AND keeps the owner-as-manager auto-enroll so a
-- newly created league still shows up in the owner's My Leagues.
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
  v_slots      INT := 0;
  v_max        INT;
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

  -- Freemium quota: first league free, plus any purchased slots. Platform
  -- admins skip the check.
  IF NOT v_is_admin THEN
    SELECT COUNT(*)::INT INTO v_owned
      FROM public.leagues WHERE created_by = v_user;
    SELECT additional_league_slots INTO v_slots
      FROM public.profiles WHERE id = v_user;
    IF v_slots IS NULL THEN v_slots := 0; END IF;
    v_max := 1 + v_slots;

    IF v_owned >= v_max THEN
      RAISE EXCEPTION
        'League quota reached (owned %, max %). Buy a slot to add more.',
        v_owned, v_max
        USING ERRCODE = '53300',
              HINT   = 'league_quota_exceeded';
    END IF;
  END IF;

  -- Plain TEXT values — the columns are TEXT + CHECK, not enums.
  INSERT INTO public.leagues
    (name, description, location, created_by, league_type,
     status, visibility)
  VALUES (
    v_trimmed,
    NULLIF(TRIM(COALESCE(p_description, '')), ''),
    NULLIF(TRIM(COALESCE(p_location, '')), ''),
    v_user,
    p_league_type,
    'draft',
    'private'
  ) RETURNING id INTO v_new_id;

  -- Auto-enroll the creator as an active manager so the league appears in
  -- their own My Leagues list (get_my_leagues_with_context is membership-
  -- based). Season/division attach later.
  INSERT INTO public.league_members
    (league_id, season_id, division_id, user_id, role, status)
  VALUES
    (v_new_id, NULL, NULL, v_user, 'manager', 'active')
  ON CONFLICT (league_id, season_id, user_id) DO NOTHING;

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

GRANT EXECUTE ON FUNCTION public.create_league(TEXT, TEXT, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.create_league IS
  'Self-serve league creation. Cast-free (TEXT columns), slot-aware '
  'freemium quota (1 + additional_league_slots), and auto-enrolls the '
  'creator as an active manager so the league shows in their My Leagues.';
