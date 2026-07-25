-- Reactivation path should also set season_id to the currently-active season
CREATE OR REPLACE FUNCTION public.join_league_by_code(p_code TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user              UUID := auth.uid();
  v_league_id         UUID;
  v_existing_id       UUID;
  v_existing_status   TEXT;
  v_existing_season   UUID;
  v_new_member_id     UUID;
  v_registration_open BOOLEAN;
  v_default_season    UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT id INTO v_league_id
    FROM public.leagues
   WHERE LOWER(invite_code) = LOWER(p_code)
     AND visibility <> 'admin_only'
   LIMIT 1
   FOR UPDATE;

  IF v_league_id IS NULL THEN
    RAISE EXCEPTION 'No league matches that code' USING ERRCODE = '02000';
  END IF;

  SELECT id, status, season_id
    INTO v_existing_id, v_existing_status, v_existing_season
    FROM public.league_members
   WHERE league_id = v_league_id AND user_id = v_user
   ORDER BY joined_at DESC
   LIMIT 1;

  -- Resolve the currently-active season (preferred: still open for reg).
  SELECT id INTO v_default_season
    FROM public.league_seasons
   WHERE league_id = v_league_id
     AND status = 'active'
     AND (registration_deadline IS NULL
          OR registration_deadline >= CURRENT_DATE)
   ORDER BY start_date DESC NULLS LAST, created_at DESC
   LIMIT 1;
  IF v_default_season IS NULL THEN
    SELECT id INTO v_default_season
      FROM public.league_seasons
     WHERE league_id = v_league_id AND status = 'active'
     ORDER BY start_date DESC NULLS LAST, created_at DESC
     LIMIT 1;
  END IF;

  IF v_existing_id IS NULL THEN
    SELECT COALESCE(
      NOT EXISTS (
        SELECT 1 FROM public.league_seasons s
        WHERE s.league_id = v_league_id AND s.status = 'active'
      )
      OR EXISTS (
        SELECT 1 FROM public.league_seasons s
        WHERE s.league_id = v_league_id
          AND s.status = 'active'
          AND (s.registration_deadline IS NULL
               OR s.registration_deadline >= CURRENT_DATE)
      ),
      TRUE
    ) INTO v_registration_open;

    IF NOT v_registration_open THEN
      RAISE EXCEPTION 'Registration for this league has closed'
        USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.league_members (league_id, season_id, user_id, role, status)
    VALUES (v_league_id, v_default_season, v_user, 'player', 'active')
    RETURNING id INTO v_new_member_id;

    INSERT INTO public.league_audit_log
      (league_id, season_id, actor_user_id, action, entity_type, entity_id, new_value)
    VALUES (
      v_league_id, v_default_season, v_user, 'member.joined_by_code',
      'member', v_new_member_id,
      jsonb_build_object('via', 'invite_code', 'season_id', v_default_season)
    );

  ELSIF v_existing_status <> 'active' THEN
    -- Reactivating a removed member: also snap them to the current
    -- active season so they show up in the right season-scoped views.
    UPDATE public.league_members
       SET status = 'active',
           season_id = COALESCE(v_default_season, season_id),
           updated_at = NOW()
     WHERE id = v_existing_id;

    INSERT INTO public.league_audit_log
      (league_id, season_id, actor_user_id, action, entity_type, entity_id,
       old_value, new_value)
    VALUES (
      v_league_id, v_default_season, v_user, 'member.rejoined_by_code',
      'member', v_existing_id,
      jsonb_build_object('status', v_existing_status, 'season_id', v_existing_season),
      jsonb_build_object('status', 'active', 'via', 'invite_code',
                         'season_id', v_default_season)
    );
  END IF;
  -- else: already-active member — no-op.

  RETURN v_league_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_league_by_code(TEXT) TO authenticated;