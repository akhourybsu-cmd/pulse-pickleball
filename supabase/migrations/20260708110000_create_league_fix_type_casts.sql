-- =====================================================================
-- Fix create_league: remove casts to nonexistent enum types.
--
-- The previous version (20260703330000) inserted
--   p_league_type::league_type, 'draft'::league_status,
--   'private'::league_visibility
-- but no migration ever creates those enum types — leagues.league_type,
-- .status, and .visibility are TEXT columns with CHECK constraints.
-- On any database built from these migrations, EVERY create_league call
-- fails with `type "league_type" does not exist` (SQLSTATE 42704),
-- regardless of the mode chosen. Plain text values satisfy the CHECKs.
--
-- Everything else (validation, admin bypass, freemium quota with
-- purchased slots, audit log) is unchanged from 20260703330000.
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

  INSERT INTO public.league_audit_log
    (league_id, actor_user_id, action, entity_type, entity_id, new_value)
  VALUES (
    v_new_id, v_user, 'league.created', 'league', v_new_id,
    jsonb_build_object(
      'name', v_trimmed,
      'league_type', p_league_type,
      'via', 'self_serve'
    )
  );

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_league(TEXT, TEXT, TEXT, TEXT) TO authenticated;
