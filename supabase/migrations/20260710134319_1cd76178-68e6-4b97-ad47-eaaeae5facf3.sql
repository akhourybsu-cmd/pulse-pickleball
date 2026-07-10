-- =====================================================================
-- Fix 1: Restore ownership-aware admin gates on league RPCs.
-- Bundle 20260704122312 CREATE OR REPLACEd these functions with the
-- old has_role('admin') gate, silently reverting the is_league_admin
-- refactor from 20260703320000. Re-apply the ownership-aware bodies
-- so league OWNERS (leagues.created_by) can run their own league.
--
-- Fix 2: join_league_by_code now defaults season_id (and matching
-- division_id when unambiguous) to the currently-active season, so
-- invite-code joiners appear in season-scoped admin lists.
-- =====================================================================

-- ---------- resolve_league_match_dispute ------------------------------
CREATE OR REPLACE FUNCTION public.resolve_league_match_dispute(
  p_match_id     UUID,
  p_team_a_score INTEGER,
  p_team_b_score INTEGER,
  p_note         TEXT DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user  UUID := auth.uid();
  v_match RECORD;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  IF p_team_a_score IS NULL OR p_team_b_score IS NULL
     OR p_team_a_score < 0 OR p_team_b_score < 0 THEN
    RAISE EXCEPTION 'Scores must be non-negative integers' USING ERRCODE = '22023';
  END IF;
  IF p_team_a_score = p_team_b_score THEN
    RAISE EXCEPTION 'Pickleball scores cannot be tied' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_match FROM public.league_matches WHERE id = p_match_id FOR UPDATE;
  IF v_match.id IS NULL THEN
    RAISE EXCEPTION 'Match not found' USING ERRCODE = '02000';
  END IF;
  IF NOT public.is_league_admin(v_match.league_id, v_user) THEN
    RAISE EXCEPTION 'League admin privileges required' USING ERRCODE = '42501';
  END IF;
  IF v_match.status NOT IN ('disputed', 'score_submitted', 'forfeit') THEN
    RAISE EXCEPTION 'Match is not in a resolvable state (status: %)',
      v_match.status USING ERRCODE = '22023';
  END IF;

  UPDATE public.league_matches
     SET team_a_score           = p_team_a_score,
         team_b_score           = p_team_b_score,
         status                 = 'verified',
         verified_by            = ARRAY[v_user]::UUID[],
         dispute_reason         = NULL,
         forfeit_winner_team_id = NULL,
         updated_at             = NOW()
   WHERE id = p_match_id;

  INSERT INTO public.league_audit_log
    (league_id, actor_user_id, action, entity_type, entity_id, old_value, new_value)
  VALUES (
    v_match.league_id, v_user, 'match.dispute_resolved', 'league_match', p_match_id,
    jsonb_build_object(
      'previous_status', v_match.status,
      'previous_a', v_match.team_a_score,
      'previous_b', v_match.team_b_score,
      'previous_reason', v_match.dispute_reason,
      'previous_forfeit_winner', v_match.forfeit_winner_team_id
    ),
    jsonb_build_object(
      'team_a_score', p_team_a_score,
      'team_b_score', p_team_b_score,
      'admin_note', COALESCE(NULLIF(TRIM(COALESCE(p_note, '')), ''), '(none)')
    )
  );
END;
$$;

-- ---------- forfeit_league_match --------------------------------------
CREATE OR REPLACE FUNCTION public.forfeit_league_match(
  p_match_id       UUID,
  p_winner_team_id UUID DEFAULT NULL,
  p_reason         TEXT DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user         UUID := auth.uid();
  v_match        RECORD;
  v_is_admin     BOOLEAN;
  v_is_captain_a BOOLEAN;
  v_is_captain_b BOOLEAN;
  v_winner_team  UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_match FROM public.league_matches WHERE id = p_match_id FOR UPDATE;
  IF v_match.id IS NULL THEN
    RAISE EXCEPTION 'Match not found' USING ERRCODE = '02000';
  END IF;
  IF v_match.status IN ('verified', 'forfeit', 'canceled') THEN
    RAISE EXCEPTION 'Match is already % — cannot forfeit', v_match.status USING ERRCODE = '22023';
  END IF;
  IF v_match.team_a_id IS NULL OR v_match.team_b_id IS NULL THEN
    RAISE EXCEPTION 'Both teams must be set to record a forfeit' USING ERRCODE = '22023';
  END IF;

  v_is_admin := public.is_league_admin(v_match.league_id, v_user);

  v_is_captain_a := EXISTS (SELECT 1 FROM public.league_teams t
    WHERE t.id = v_match.team_a_id AND t.captain_user_id = v_user);
  v_is_captain_b := EXISTS (SELECT 1 FROM public.league_teams t
    WHERE t.id = v_match.team_b_id AND t.captain_user_id = v_user);

  IF NOT v_is_admin AND NOT v_is_captain_a AND NOT v_is_captain_b THEN
    RAISE EXCEPTION 'Only a league admin or the captain of a participating team can forfeit'
      USING ERRCODE = '42501';
  END IF;

  IF v_is_admin THEN
    IF p_winner_team_id IS NULL THEN
      RAISE EXCEPTION 'Admins must specify the winning team id when calling forfeit' USING ERRCODE = '22023';
    END IF;
    IF p_winner_team_id NOT IN (v_match.team_a_id, v_match.team_b_id) THEN
      RAISE EXCEPTION 'Winning team must be team_a or team_b of this match' USING ERRCODE = '22023';
    END IF;
    v_winner_team := p_winner_team_id;
  ELSIF v_is_captain_a THEN
    v_winner_team := v_match.team_b_id;
  ELSE
    v_winner_team := v_match.team_a_id;
  END IF;

  UPDATE public.league_matches
     SET status                 = 'forfeit',
         forfeit_winner_team_id = v_winner_team,
         team_a_score           = NULL,
         team_b_score           = NULL,
         verified_by            = ARRAY[]::UUID[],
         dispute_reason         = NULLIF(TRIM(COALESCE(p_reason, '')), ''),
         score_submitted_by     = NULL,
         score_submitted_at     = NULL,
         updated_at             = NOW()
   WHERE id = p_match_id;

  INSERT INTO public.league_audit_log
    (league_id, actor_user_id, action, entity_type, entity_id, old_value, new_value)
  VALUES (
    v_match.league_id, v_user, 'match.forfeited', 'league_match', p_match_id,
    jsonb_build_object(
      'previous_status', v_match.status,
      'previous_a', v_match.team_a_score,
      'previous_b', v_match.team_b_score
    ),
    jsonb_build_object(
      'winner_team_id', v_winner_team,
      'source', CASE WHEN v_is_admin THEN 'admin' ELSE 'captain' END,
      'reason', COALESCE(NULLIF(TRIM(COALESCE(p_reason, '')), ''), '(none)')
    )
  );
END;
$$;

-- ---------- sync_league_season_statuses -------------------------------
CREATE OR REPLACE FUNCTION public.sync_league_season_statuses(p_league_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user     UUID := auth.uid();
  v_today    DATE := CURRENT_DATE;
  v_activated INTEGER := 0;
  v_completed INTEGER := 0;
  v_ids_activated UUID[];
  v_ids_completed UUID[];
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  IF NOT public.is_league_admin(p_league_id, v_user) THEN
    RAISE EXCEPTION 'League admin privileges required' USING ERRCODE = '42501';
  END IF;

  WITH updated AS (
    UPDATE public.league_seasons
       SET status = 'active', updated_at = NOW()
     WHERE league_id = p_league_id
       AND status = 'draft'
       AND start_date IS NOT NULL
       AND start_date <= v_today
       AND (end_date IS NULL OR end_date >= v_today)
     RETURNING id
  )
  SELECT array_agg(id), count(*) INTO v_ids_activated, v_activated FROM updated;

  WITH updated AS (
    UPDATE public.league_seasons
       SET status = 'completed', updated_at = NOW()
     WHERE league_id = p_league_id
       AND status = 'active'
       AND end_date IS NOT NULL
       AND end_date < v_today
     RETURNING id
  )
  SELECT array_agg(id), count(*) INTO v_ids_completed, v_completed FROM updated;

  IF v_activated > 0 OR v_completed > 0 THEN
    INSERT INTO public.league_audit_log
      (league_id, actor_user_id, action, entity_type, entity_id, new_value)
    VALUES (
      p_league_id, v_user, 'season.lifecycle_synced', 'league', p_league_id,
      jsonb_build_object(
        'activated_count', v_activated,
        'completed_count', v_completed,
        'activated_ids', COALESCE(v_ids_activated, ARRAY[]::UUID[]),
        'completed_ids', COALESCE(v_ids_completed, ARRAY[]::UUID[])
      )
    );
  END IF;

  RETURN jsonb_build_object('activated', v_activated, 'completed', v_completed);
END;
$$;

-- ---------- get_league_season_aggregates ------------------------------
CREATE OR REPLACE FUNCTION public.get_league_season_aggregates(p_league_id UUID)
RETURNS TABLE (
  season_id           UUID,
  matches             INT,
  verified            INT,
  awaiting_confirm    INT,
  pending             INT,
  disputed            INT,
  forfeits            INT,
  members             INT
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH allowed AS (
    SELECT id FROM public.league_seasons WHERE league_id = p_league_id
  ),
  match_counts AS (
    SELECT lm.season_id,
      COUNT(*)::INT AS matches,
      COUNT(*) FILTER (WHERE lm.status = 'verified')::INT AS verified,
      COUNT(*) FILTER (WHERE lm.status = 'score_submitted')::INT AS awaiting_confirm,
      COUNT(*) FILTER (WHERE lm.status IN ('scheduled', 'in_progress'))::INT AS pending,
      COUNT(*) FILTER (WHERE lm.status = 'disputed')::INT AS disputed,
      COUNT(*) FILTER (WHERE lm.status = 'forfeit')::INT AS forfeits
    FROM public.league_matches lm
    WHERE lm.league_id = p_league_id
      AND lm.season_id IN (SELECT id FROM allowed)
    GROUP BY lm.season_id
  ),
  member_counts AS (
    SELECT m.season_id, COUNT(*)::INT AS members
    FROM public.league_members m
    WHERE m.league_id = p_league_id
      AND m.status = 'active'
      AND m.season_id IN (SELECT id FROM allowed)
    GROUP BY m.season_id
  )
  SELECT a.id AS season_id,
    COALESCE(mc.matches, 0),
    COALESCE(mc.verified, 0),
    COALESCE(mc.awaiting_confirm, 0),
    COALESCE(mc.pending, 0),
    COALESCE(mc.disputed, 0),
    COALESCE(mc.forfeits, 0),
    COALESCE(memc.members, 0)
  FROM allowed a
  LEFT JOIN match_counts mc ON mc.season_id = a.id
  LEFT JOIN member_counts memc ON memc.season_id = a.id
  WHERE public.is_league_admin(p_league_id, auth.uid());
$$;

-- ---------- bulk_add_league_members -----------------------------------
CREATE OR REPLACE FUNCTION public.bulk_add_league_members(
  p_league_id   UUID,
  p_season_id   UUID DEFAULT NULL,
  p_division_id UUID DEFAULT NULL,
  p_emails      TEXT[]  DEFAULT ARRAY[]::TEXT[],
  p_dry_run     BOOLEAN DEFAULT TRUE
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user   UUID := auth.uid();
  v_email  TEXT;
  v_norm   TEXT;
  v_profile RECORD;
  v_existing UUID;
  v_new_mem UUID;
  v_resolved JSONB := '[]'::JSONB;
  v_unmatched TEXT[] := ARRAY[]::TEXT[];
  v_added_count INT := 0;
  v_reactivated_count INT := 0;
  v_already_count INT := 0;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  IF NOT public.is_league_admin(p_league_id, v_user) THEN
    RAISE EXCEPTION 'League admin privileges required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.leagues WHERE id = p_league_id) THEN
    RAISE EXCEPTION 'League not found' USING ERRCODE = '02000';
  END IF;

  IF p_season_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.league_seasons
       WHERE id = p_season_id AND league_id = p_league_id
    ) THEN
      RAISE EXCEPTION 'Season does not belong to this league' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF p_division_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.league_divisions
       WHERE id = p_division_id AND league_id = p_league_id
    ) THEN
      RAISE EXCEPTION 'Division does not belong to this league' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF p_emails IS NULL OR array_length(p_emails, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'resolved', v_resolved, 'unmatched', v_unmatched,
      'added_count', 0, 'reactivated_count', 0,
      'already_active_count', 0, 'dry_run', p_dry_run);
  END IF;

  FOREACH v_email IN ARRAY p_emails LOOP
    v_norm := lower(trim(v_email));
    IF v_norm = '' THEN CONTINUE; END IF;

    SELECT id, COALESCE(display_name, full_name, email) AS name, email
      INTO v_profile
      FROM public.profiles
     WHERE lower(email) = v_norm
     LIMIT 1;

    IF v_profile.id IS NULL THEN
      v_unmatched := array_append(v_unmatched, v_email);
      CONTINUE;
    END IF;

    SELECT id INTO v_existing
      FROM public.league_members
     WHERE league_id = p_league_id
       AND user_id = v_profile.id
       AND (
         (p_season_id IS NOT NULL AND season_id = p_season_id)
         OR (p_season_id IS NULL AND season_id IS NULL)
       )
     LIMIT 1;

    IF v_existing IS NOT NULL THEN
      DECLARE v_status TEXT;
      BEGIN
        SELECT status INTO v_status FROM public.league_members WHERE id = v_existing;
        IF v_status = 'active' THEN
          v_already_count := v_already_count + 1;
          v_resolved := v_resolved || jsonb_build_object(
            'email', v_email, 'user_id', v_profile.id, 'name', v_profile.name,
            'outcome', 'already_active');
        ELSE
          IF NOT p_dry_run THEN
            UPDATE public.league_members
               SET status = 'active',
                   division_id = COALESCE(p_division_id, division_id),
                   updated_at = NOW()
             WHERE id = v_existing;
          END IF;
          v_reactivated_count := v_reactivated_count + 1;
          v_resolved := v_resolved || jsonb_build_object(
            'email', v_email, 'user_id', v_profile.id, 'name', v_profile.name,
            'outcome', 'reactivated');
        END IF;
      END;
    ELSE
      IF NOT p_dry_run THEN
        INSERT INTO public.league_members
          (league_id, season_id, division_id, user_id, role, status)
        VALUES
          (p_league_id, p_season_id, p_division_id, v_profile.id, 'player', 'active')
        RETURNING id INTO v_new_mem;
      END IF;
      v_added_count := v_added_count + 1;
      v_resolved := v_resolved || jsonb_build_object(
        'email', v_email, 'user_id', v_profile.id, 'name', v_profile.name,
        'outcome', 'added');
    END IF;
  END LOOP;

  IF NOT p_dry_run AND (v_added_count > 0 OR v_reactivated_count > 0) THEN
    INSERT INTO public.league_audit_log
      (league_id, season_id, actor_user_id, action, entity_type, entity_id, new_value)
    VALUES (
      p_league_id, p_season_id, v_user, 'members.bulk_added',
      'league_members', p_league_id,
      jsonb_build_object(
        'added_count', v_added_count,
        'reactivated_count', v_reactivated_count,
        'already_active_count', v_already_count,
        'unmatched_count', COALESCE(array_length(v_unmatched, 1), 0),
        'division_id', p_division_id));
  END IF;

  RETURN jsonb_build_object(
    'resolved', v_resolved, 'unmatched', v_unmatched,
    'added_count', v_added_count,
    'reactivated_count', v_reactivated_count,
    'already_active_count', v_already_count,
    'dry_run', p_dry_run);
END;
$$;

-- ---------- log_league_action -----------------------------------------
CREATE OR REPLACE FUNCTION public.log_league_action(
  p_league_id   UUID,
  p_season_id   UUID,
  p_action      TEXT,
  p_entity_type TEXT,
  p_entity_id   UUID,
  p_old_value   JSONB DEFAULT NULL,
  p_new_value   JSONB DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_id    UUID;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  IF NOT public.is_league_admin(p_league_id, v_actor) THEN
    RAISE EXCEPTION 'League admin privileges required' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.league_audit_log
    (league_id, season_id, actor_user_id, action, entity_type, entity_id, old_value, new_value)
  VALUES
    (p_league_id, p_season_id, v_actor, p_action, p_entity_type, p_entity_id, p_old_value, p_new_value)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- =====================================================================
-- Fix 2: join_league_by_code — default season_id to the currently-active
-- season (newest by start_date) so invite-code joiners appear in the
-- admin's season-scoped Members/Teams/Matches tabs. Leaves season_id
-- NULL only when the league has no active season yet.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.join_league_by_code(p_code TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user              UUID := auth.uid();
  v_league_id         UUID;
  v_existing_id       UUID;
  v_existing_status   TEXT;
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

  SELECT id, status INTO v_existing_id, v_existing_status
    FROM public.league_members
   WHERE league_id = v_league_id AND user_id = v_user
   ORDER BY joined_at DESC
   LIMIT 1;

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

    -- Pick the currently-active season that is still accepting
    -- registrations (newest by start_date). Falls back to any active
    -- season if none have an open deadline, then to the newest season
    -- of any status. NULL only if the league has no seasons yet.
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
    UPDATE public.league_members
       SET status = 'active', updated_at = NOW()
     WHERE id = v_existing_id;

    INSERT INTO public.league_audit_log
      (league_id, actor_user_id, action, entity_type, entity_id, old_value, new_value)
    VALUES (
      v_league_id, v_user, 'member.rejoined_by_code', 'member', v_existing_id,
      jsonb_build_object('status', v_existing_status),
      jsonb_build_object('status', 'active', 'via', 'invite_code')
    );
  END IF;

  RETURN v_league_id;
END;
$$;

-- Backfill: existing invite-code joiners with NULL season_id get moved
-- to the league's currently-active season so admins can see them.
UPDATE public.league_members m
   SET season_id = s.id
  FROM (
    SELECT DISTINCT ON (league_id) league_id, id
      FROM public.league_seasons
     WHERE status = 'active'
     ORDER BY league_id, start_date DESC NULLS LAST, created_at DESC
  ) s
 WHERE m.season_id IS NULL
   AND m.league_id = s.league_id;