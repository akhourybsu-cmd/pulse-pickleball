-- Bundle: apply league migrations 20260703230000 → 20260703310000

ALTER TABLE public.league_matches
  ADD COLUMN IF NOT EXISTS forfeit_winner_team_id UUID
    REFERENCES public.league_teams(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.league_matches.forfeit_winner_team_id IS
  'For status = forfeit: which team gets credited the win. Must equal team_a_id or team_b_id. NULL for any non-forfeit match.';

CREATE OR REPLACE FUNCTION public.assert_forfeit_winner_is_participant()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.forfeit_winner_team_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.team_a_id IS NULL OR NEW.team_b_id IS NULL THEN
    RAISE EXCEPTION 'Both team_a_id and team_b_id must be set before recording a forfeit winner' USING ERRCODE = '22023';
  END IF;
  IF NEW.forfeit_winner_team_id IS DISTINCT FROM NEW.team_a_id
     AND NEW.forfeit_winner_team_id IS DISTINCT FROM NEW.team_b_id THEN
    RAISE EXCEPTION 'forfeit_winner_team_id must equal team_a_id or team_b_id (got %)', NEW.forfeit_winner_team_id USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assert_forfeit_winner ON public.league_matches;
CREATE TRIGGER trg_assert_forfeit_winner
  BEFORE INSERT OR UPDATE ON public.league_matches
  FOR EACH ROW EXECUTE FUNCTION public.assert_forfeit_winner_is_participant();

-- resolve_league_match_dispute (final version from 240000)
CREATE OR REPLACE FUNCTION public.resolve_league_match_dispute(
  p_match_id UUID, p_team_a_score INTEGER, p_team_b_score INTEGER, p_note TEXT DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user UUID := auth.uid(); v_match RECORD;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000'; END IF;
  IF NOT public.has_role(v_user, 'admin'::app_role) THEN RAISE EXCEPTION 'Admin role required' USING ERRCODE = '42501'; END IF;
  IF p_team_a_score IS NULL OR p_team_b_score IS NULL OR p_team_a_score < 0 OR p_team_b_score < 0 THEN
    RAISE EXCEPTION 'Scores must be non-negative integers' USING ERRCODE = '22023'; END IF;
  IF p_team_a_score = p_team_b_score THEN RAISE EXCEPTION 'Pickleball scores cannot be tied' USING ERRCODE = '22023'; END IF;

  SELECT * INTO v_match FROM public.league_matches WHERE id = p_match_id FOR UPDATE;
  IF v_match.id IS NULL THEN RAISE EXCEPTION 'Match not found' USING ERRCODE = '02000'; END IF;
  IF v_match.status NOT IN ('disputed', 'score_submitted', 'forfeit') THEN
    RAISE EXCEPTION 'Match is not in a resolvable state (status: %)', v_match.status USING ERRCODE = '22023'; END IF;

  UPDATE public.league_matches
     SET team_a_score=p_team_a_score, team_b_score=p_team_b_score, status='verified',
         verified_by=ARRAY[v_user]::UUID[], dispute_reason=NULL, forfeit_winner_team_id=NULL, updated_at=NOW()
   WHERE id = p_match_id;

  INSERT INTO public.league_audit_log (league_id, actor_user_id, action, entity_type, entity_id, old_value, new_value)
  VALUES (v_match.league_id, v_user, 'match.dispute_resolved', 'league_match', p_match_id,
    jsonb_build_object('previous_status', v_match.status, 'previous_a', v_match.team_a_score,
      'previous_b', v_match.team_b_score, 'previous_reason', v_match.dispute_reason,
      'previous_forfeit_winner', v_match.forfeit_winner_team_id),
    jsonb_build_object('team_a_score', p_team_a_score, 'team_b_score', p_team_b_score,
      'admin_note', COALESCE(NULLIF(TRIM(COALESCE(p_note, '')), ''), '(none)')));
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_league_match_dispute(UUID, INTEGER, INTEGER, TEXT) TO authenticated;

-- forfeit_league_match
CREATE OR REPLACE FUNCTION public.forfeit_league_match(
  p_match_id UUID, p_winner_team_id UUID DEFAULT NULL, p_reason TEXT DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user UUID := auth.uid(); v_match RECORD; v_is_admin BOOLEAN;
        v_is_captain_a BOOLEAN; v_is_captain_b BOOLEAN; v_winner_team UUID;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000'; END IF;
  SELECT * INTO v_match FROM public.league_matches WHERE id = p_match_id FOR UPDATE;
  IF v_match.id IS NULL THEN RAISE EXCEPTION 'Match not found' USING ERRCODE = '02000'; END IF;
  IF v_match.status IN ('verified', 'forfeit', 'canceled') THEN
    RAISE EXCEPTION 'Match is already % — cannot forfeit', v_match.status USING ERRCODE = '22023'; END IF;
  IF v_match.team_a_id IS NULL OR v_match.team_b_id IS NULL THEN
    RAISE EXCEPTION 'Both teams must be set to record a forfeit' USING ERRCODE = '22023'; END IF;

  v_is_admin := public.has_role(v_user, 'admin'::app_role);
  v_is_captain_a := EXISTS (SELECT 1 FROM public.league_teams t WHERE t.id = v_match.team_a_id AND t.captain_user_id = v_user);
  v_is_captain_b := EXISTS (SELECT 1 FROM public.league_teams t WHERE t.id = v_match.team_b_id AND t.captain_user_id = v_user);

  IF NOT v_is_admin AND NOT v_is_captain_a AND NOT v_is_captain_b THEN
    RAISE EXCEPTION 'Only an admin or the captain of a participating team can forfeit' USING ERRCODE = '42501'; END IF;

  IF v_is_admin THEN
    IF p_winner_team_id IS NULL THEN RAISE EXCEPTION 'Admins must specify the winning team id when calling forfeit' USING ERRCODE = '22023'; END IF;
    IF p_winner_team_id NOT IN (v_match.team_a_id, v_match.team_b_id) THEN
      RAISE EXCEPTION 'Winning team must be team_a or team_b of this match' USING ERRCODE = '22023'; END IF;
    v_winner_team := p_winner_team_id;
  ELSIF v_is_captain_a THEN v_winner_team := v_match.team_b_id;
  ELSE v_winner_team := v_match.team_a_id;
  END IF;

  UPDATE public.league_matches
     SET status='forfeit', forfeit_winner_team_id=v_winner_team, team_a_score=NULL, team_b_score=NULL,
         verified_by=ARRAY[]::UUID[], dispute_reason=NULLIF(TRIM(COALESCE(p_reason,'')),''),
         score_submitted_by=NULL, score_submitted_at=NULL, updated_at=NOW()
   WHERE id = p_match_id;

  INSERT INTO public.league_audit_log (league_id, actor_user_id, action, entity_type, entity_id, old_value, new_value)
  VALUES (v_match.league_id, v_user, 'match.forfeited', 'league_match', p_match_id,
    jsonb_build_object('previous_status', v_match.status, 'previous_a', v_match.team_a_score, 'previous_b', v_match.team_b_score),
    jsonb_build_object('winner_team_id', v_winner_team, 'source', CASE WHEN v_is_admin THEN 'admin' ELSE 'captain' END,
      'reason', COALESCE(NULLIF(TRIM(COALESCE(p_reason,'')),''),'(none)')));
END;
$$;

GRANT EXECUTE ON FUNCTION public.forfeit_league_match(UUID, UUID, TEXT) TO authenticated;

-- sync_league_season_statuses
CREATE OR REPLACE FUNCTION public.sync_league_season_statuses(p_league_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user UUID := auth.uid(); v_today DATE := CURRENT_DATE;
        v_activated INT := 0; v_completed INT := 0;
        v_ids_activated UUID[]; v_ids_completed UUID[];
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000'; END IF;
  IF NOT public.has_role(v_user, 'admin'::app_role) THEN RAISE EXCEPTION 'Admin role required' USING ERRCODE = '42501'; END IF;

  WITH updated AS (
    UPDATE public.league_seasons SET status='active', updated_at=NOW()
     WHERE league_id=p_league_id AND status='draft' AND start_date IS NOT NULL
       AND start_date <= v_today AND (end_date IS NULL OR end_date >= v_today)
     RETURNING id
  ) SELECT array_agg(id), count(*) INTO v_ids_activated, v_activated FROM updated;

  WITH updated AS (
    UPDATE public.league_seasons SET status='completed', updated_at=NOW()
     WHERE league_id=p_league_id AND status='active' AND end_date IS NOT NULL AND end_date < v_today
     RETURNING id
  ) SELECT array_agg(id), count(*) INTO v_ids_completed, v_completed FROM updated;

  IF v_activated > 0 OR v_completed > 0 THEN
    INSERT INTO public.league_audit_log (league_id, actor_user_id, action, entity_type, entity_id, new_value)
    VALUES (p_league_id, v_user, 'season.lifecycle_synced', 'league', p_league_id,
      jsonb_build_object('activated_count', v_activated, 'completed_count', v_completed,
        'activated_ids', COALESCE(v_ids_activated, ARRAY[]::UUID[]),
        'completed_ids', COALESCE(v_ids_completed, ARRAY[]::UUID[])));
  END IF;

  RETURN jsonb_build_object('activated', v_activated, 'completed', v_completed);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_league_season_statuses(UUID) TO authenticated;

-- get_my_leagues_with_context (final: no invite_code)
DROP FUNCTION IF EXISTS public.get_my_leagues_with_context();
CREATE FUNCTION public.get_my_leagues_with_context()
RETURNS TABLE (
  membership_id UUID, membership_league_id UUID, membership_season_id UUID, membership_division_id UUID,
  membership_user_id UUID, membership_role TEXT, membership_status TEXT,
  membership_joined_at TIMESTAMPTZ, membership_created_at TIMESTAMPTZ, membership_updated_at TIMESTAMPTZ,
  league_id UUID, league_name TEXT, league_description TEXT, league_location TEXT, league_community_id UUID,
  league_created_by UUID, league_status TEXT, league_visibility TEXT, league_league_type TEXT,
  league_rating_eligible BOOLEAN, league_guests_allowed BOOLEAN,
  league_created_at TIMESTAMPTZ, league_updated_at TIMESTAMPTZ,
  season_id UUID, season_league_id UUID, season_name TEXT, season_start_date DATE, season_end_date DATE,
  season_registration_deadline DATE, season_status TEXT, season_created_at TIMESTAMPTZ, season_updated_at TIMESTAMPTZ,
  division_id UUID, division_league_id UUID, division_season_id UUID, division_name TEXT,
  division_skill_min NUMERIC, division_skill_max NUMERIC, division_description TEXT, division_status TEXT,
  division_created_at TIMESTAMPTZ, division_updated_at TIMESTAMPTZ
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.id, m.league_id, m.season_id, m.division_id, m.user_id,
    m.role::TEXT, m.status::TEXT, m.joined_at, m.created_at, m.updated_at,
    l.id, l.name, l.description, l.location, l.community_id, l.created_by,
    l.status::TEXT, l.visibility::TEXT, l.league_type::TEXT,
    l.rating_eligible, l.guests_allowed, l.created_at, l.updated_at,
    s.id, s.league_id, s.name, s.start_date, s.end_date,
    s.registration_deadline, s.status::TEXT, s.created_at, s.updated_at,
    d.id, d.league_id, d.season_id, d.name, d.skill_min, d.skill_max,
    d.description, d.status::TEXT, d.created_at, d.updated_at
  FROM public.league_members m
  JOIN public.leagues l ON l.id = m.league_id
  LEFT JOIN public.league_seasons s ON s.id = m.season_id
  LEFT JOIN public.league_divisions d ON d.id = m.division_id
  WHERE m.user_id = auth.uid() AND m.status = 'active' AND l.visibility <> 'admin_only'
  ORDER BY l.name ASC, m.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_leagues_with_context() TO authenticated;

-- get_my_upcoming_league_matches (final with l.location)
CREATE OR REPLACE FUNCTION public.get_my_upcoming_league_matches(p_limit INT DEFAULT 3)
RETURNS TABLE (
  match_id UUID, league_id UUID, league_name TEXT, league_type TEXT,
  season_id UUID, season_name TEXT, scheduled_time TIMESTAMPTZ,
  court_number INT, location TEXT, status TEXT,
  team_a_id UUID, team_a_name TEXT, team_b_id UUID, team_b_name TEXT
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT lm.id, lm.league_id, l.name, l.league_type::TEXT,
    lm.season_id, s.name, lm.scheduled_time, lm.court_number,
    l.location, lm.status::TEXT,
    lm.team_a_id, ta.name, lm.team_b_id, tb.name
  FROM public.league_matches lm
  JOIN public.leagues l ON l.id = lm.league_id
  LEFT JOIN public.league_seasons s ON s.id = lm.season_id
  LEFT JOIN public.league_teams ta ON ta.id = lm.team_a_id
  LEFT JOIN public.league_teams tb ON tb.id = lm.team_b_id
  WHERE lm.status IN ('scheduled', 'in_progress')
    AND lm.scheduled_time IS NOT NULL AND lm.scheduled_time >= NOW()
    AND l.visibility <> 'admin_only'
    AND (
      auth.uid() IN (lm.player_a_id, lm.player_b_id, lm.player_c_id, lm.player_d_id)
      OR EXISTS (SELECT 1 FROM public.league_team_members ltm WHERE ltm.team_id = lm.team_a_id AND ltm.user_id = auth.uid() AND ltm.status = 'active')
      OR EXISTS (SELECT 1 FROM public.league_team_members ltm WHERE ltm.team_id = lm.team_b_id AND ltm.user_id = auth.uid() AND ltm.status = 'active')
    )
  ORDER BY lm.scheduled_time ASC
  LIMIT GREATEST(p_limit, 0);
$$;

GRANT EXECUTE ON FUNCTION public.get_my_upcoming_league_matches(INT) TO authenticated;

-- get_league_season_aggregates
CREATE OR REPLACE FUNCTION public.get_league_season_aggregates(p_league_id UUID)
RETURNS TABLE (
  season_id UUID, matches INT, verified INT, awaiting_confirm INT,
  pending INT, disputed INT, forfeits INT, members INT
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH allowed AS (SELECT id FROM public.league_seasons WHERE league_id = p_league_id),
  match_counts AS (
    SELECT lm.season_id, COUNT(*)::INT AS matches,
      COUNT(*) FILTER (WHERE lm.status='verified')::INT AS verified,
      COUNT(*) FILTER (WHERE lm.status='score_submitted')::INT AS awaiting_confirm,
      COUNT(*) FILTER (WHERE lm.status IN ('scheduled','in_progress'))::INT AS pending,
      COUNT(*) FILTER (WHERE lm.status='disputed')::INT AS disputed,
      COUNT(*) FILTER (WHERE lm.status='forfeit')::INT AS forfeits
    FROM public.league_matches lm
    WHERE lm.league_id = p_league_id AND lm.season_id IN (SELECT id FROM allowed)
    GROUP BY lm.season_id
  ),
  member_counts AS (
    SELECT m.season_id, COUNT(*)::INT AS members
    FROM public.league_members m
    WHERE m.league_id = p_league_id AND m.status='active' AND m.season_id IN (SELECT id FROM allowed)
    GROUP BY m.season_id
  )
  SELECT a.id, COALESCE(mc.matches,0), COALESCE(mc.verified,0), COALESCE(mc.awaiting_confirm,0),
         COALESCE(mc.pending,0), COALESCE(mc.disputed,0), COALESCE(mc.forfeits,0), COALESCE(memc.members,0)
  FROM allowed a
  LEFT JOIN match_counts mc ON mc.season_id = a.id
  LEFT JOIN member_counts memc ON memc.season_id = a.id
  WHERE public.has_role(auth.uid(), 'admin'::app_role);
$$;

GRANT EXECUTE ON FUNCTION public.get_league_season_aggregates(UUID) TO authenticated;

-- bulk_add_league_members
CREATE OR REPLACE FUNCTION public.bulk_add_league_members(
  p_league_id UUID, p_season_id UUID DEFAULT NULL, p_division_id UUID DEFAULT NULL,
  p_emails TEXT[] DEFAULT ARRAY[]::TEXT[], p_dry_run BOOLEAN DEFAULT TRUE
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user UUID := auth.uid(); v_email TEXT; v_norm TEXT; v_profile RECORD;
        v_existing UUID; v_new_mem UUID; v_resolved JSONB := '[]'::JSONB;
        v_unmatched TEXT[] := ARRAY[]::TEXT[]; v_added_count INT := 0;
        v_reactivated_count INT := 0; v_already_count INT := 0;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000'; END IF;
  IF NOT public.has_role(v_user, 'admin'::app_role) THEN RAISE EXCEPTION 'Admin role required' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.leagues WHERE id = p_league_id) THEN
    RAISE EXCEPTION 'League not found' USING ERRCODE = '02000'; END IF;
  IF p_season_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.league_seasons WHERE id=p_season_id AND league_id=p_league_id) THEN
    RAISE EXCEPTION 'Season does not belong to this league' USING ERRCODE = '22023'; END IF;
  IF p_division_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.league_divisions WHERE id=p_division_id AND league_id=p_league_id) THEN
    RAISE EXCEPTION 'Division does not belong to this league' USING ERRCODE = '22023'; END IF;
  IF p_emails IS NULL OR array_length(p_emails, 1) IS NULL THEN
    RETURN jsonb_build_object('resolved', v_resolved, 'unmatched', v_unmatched,
      'added_count', 0, 'reactivated_count', 0, 'already_active_count', 0, 'dry_run', p_dry_run);
  END IF;

  FOREACH v_email IN ARRAY p_emails LOOP
    v_norm := lower(trim(v_email));
    IF v_norm = '' THEN CONTINUE; END IF;
    SELECT id, COALESCE(display_name, full_name, email) AS name, email
      INTO v_profile FROM public.profiles WHERE lower(email) = v_norm LIMIT 1;
    IF v_profile.id IS NULL THEN v_unmatched := array_append(v_unmatched, v_email); CONTINUE; END IF;

    SELECT id INTO v_existing FROM public.league_members
     WHERE league_id=p_league_id AND user_id=v_profile.id
       AND ((p_season_id IS NOT NULL AND season_id=p_season_id) OR (p_season_id IS NULL AND season_id IS NULL))
     LIMIT 1;

    IF v_existing IS NOT NULL THEN
      DECLARE v_status TEXT;
      BEGIN
        SELECT status INTO v_status FROM public.league_members WHERE id = v_existing;
        IF v_status = 'active' THEN
          v_already_count := v_already_count + 1;
          v_resolved := v_resolved || jsonb_build_object('email', v_email, 'user_id', v_profile.id, 'name', v_profile.name, 'outcome', 'already_active');
        ELSE
          IF NOT p_dry_run THEN
            UPDATE public.league_members SET status='active', division_id=COALESCE(p_division_id, division_id), updated_at=NOW() WHERE id=v_existing;
          END IF;
          v_reactivated_count := v_reactivated_count + 1;
          v_resolved := v_resolved || jsonb_build_object('email', v_email, 'user_id', v_profile.id, 'name', v_profile.name, 'outcome', 'reactivated');
        END IF;
      END;
    ELSE
      IF NOT p_dry_run THEN
        INSERT INTO public.league_members (league_id, season_id, division_id, user_id, role, status)
        VALUES (p_league_id, p_season_id, p_division_id, v_profile.id, 'player', 'active')
        RETURNING id INTO v_new_mem;
      END IF;
      v_added_count := v_added_count + 1;
      v_resolved := v_resolved || jsonb_build_object('email', v_email, 'user_id', v_profile.id, 'name', v_profile.name, 'outcome', 'added');
    END IF;
  END LOOP;

  IF NOT p_dry_run AND (v_added_count > 0 OR v_reactivated_count > 0) THEN
    INSERT INTO public.league_audit_log (league_id, season_id, actor_user_id, action, entity_type, entity_id, new_value)
    VALUES (p_league_id, p_season_id, v_user, 'members.bulk_added', 'league_members', p_league_id,
      jsonb_build_object('added_count', v_added_count, 'reactivated_count', v_reactivated_count,
        'already_active_count', v_already_count, 'unmatched_count', COALESCE(array_length(v_unmatched,1),0), 'division_id', p_division_id));
  END IF;

  RETURN jsonb_build_object('resolved', v_resolved, 'unmatched', v_unmatched,
    'added_count', v_added_count, 'reactivated_count', v_reactivated_count,
    'already_active_count', v_already_count, 'dry_run', p_dry_run);
END;
$$;

GRANT EXECUTE ON FUNCTION public.bulk_add_league_members(UUID, UUID, UUID, TEXT[], BOOLEAN) TO authenticated;

-- join_league_by_code serialize
CREATE OR REPLACE FUNCTION public.join_league_by_code(p_code TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE v_user UUID := auth.uid(); v_league_id UUID; v_existing_id UUID;
        v_existing_status TEXT; v_new_member_id UUID; v_registration_open BOOLEAN;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000'; END IF;

  SELECT id INTO v_league_id FROM public.leagues
   WHERE LOWER(invite_code) = LOWER(p_code) AND visibility <> 'admin_only'
   LIMIT 1 FOR UPDATE;

  IF v_league_id IS NULL THEN RAISE EXCEPTION 'No league matches that code' USING ERRCODE = '02000'; END IF;

  SELECT id, status INTO v_existing_id, v_existing_status
    FROM public.league_members WHERE league_id = v_league_id AND user_id = v_user
    ORDER BY joined_at DESC LIMIT 1;

  IF v_existing_id IS NULL THEN
    SELECT COALESCE(
      NOT EXISTS (SELECT 1 FROM public.league_seasons s WHERE s.league_id=v_league_id AND s.status='active')
      OR EXISTS (SELECT 1 FROM public.league_seasons s WHERE s.league_id=v_league_id AND s.status='active'
                   AND (s.registration_deadline IS NULL OR s.registration_deadline >= CURRENT_DATE)),
      TRUE) INTO v_registration_open;

    IF NOT v_registration_open THEN RAISE EXCEPTION 'Registration for this league has closed' USING ERRCODE = '22023'; END IF;

    INSERT INTO public.league_members (league_id, user_id, role, status)
    VALUES (v_league_id, v_user, 'player', 'active') RETURNING id INTO v_new_member_id;

    INSERT INTO public.league_audit_log (league_id, actor_user_id, action, entity_type, entity_id, new_value)
    VALUES (v_league_id, v_user, 'member.joined_by_code', 'member', v_new_member_id, jsonb_build_object('via', 'invite_code'));

  ELSIF v_existing_status <> 'active' THEN
    UPDATE public.league_members SET status='active', updated_at=NOW() WHERE id = v_existing_id;
    INSERT INTO public.league_audit_log (league_id, actor_user_id, action, entity_type, entity_id, old_value, new_value)
    VALUES (v_league_id, v_user, 'member.rejoined_by_code', 'member', v_existing_id,
      jsonb_build_object('status', v_existing_status),
      jsonb_build_object('status', 'active', 'via', 'invite_code'));
  END IF;

  RETURN v_league_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.join_league_by_code(TEXT) TO authenticated;

-- League match state notifications
CREATE OR REPLACE FUNCTION public.league_match_participant_user_ids(
  p_match_id UUID, p_exclude_user UUID DEFAULT NULL
) RETURNS TABLE(user_id UUID) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH direct AS (
    SELECT UNNEST(ARRAY[lm.player_a_id, lm.player_b_id, lm.player_c_id, lm.player_d_id]) AS uid
    FROM public.league_matches lm WHERE lm.id = p_match_id
  ),
  team_a AS (SELECT ltm.user_id AS uid FROM public.league_matches lm
    JOIN public.league_team_members ltm ON ltm.team_id = lm.team_a_id
    WHERE lm.id = p_match_id AND ltm.status = 'active'),
  team_b AS (SELECT ltm.user_id AS uid FROM public.league_matches lm
    JOIN public.league_team_members ltm ON ltm.team_id = lm.team_b_id
    WHERE lm.id = p_match_id AND ltm.status = 'active')
  SELECT DISTINCT uid FROM (SELECT uid FROM direct UNION ALL SELECT uid FROM team_a UNION ALL SELECT uid FROM team_b) x
   WHERE uid IS NOT NULL AND (p_exclude_user IS NULL OR uid <> p_exclude_user);
$$;

GRANT EXECUTE ON FUNCTION public.league_match_participant_user_ids(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_league_match_state_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_recipient RECORD; v_league_name TEXT; v_actor_name TEXT; v_link TEXT;
        v_team_a_name TEXT; v_team_b_name TEXT; v_score TEXT; v_winner_team_name TEXT;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  SELECT name INTO v_league_name FROM public.leagues WHERE id = NEW.league_id;
  IF v_league_name IS NULL THEN RETURN NEW; END IF;
  v_link := '/player/leagues/' || NEW.league_id;
  SELECT name INTO v_team_a_name FROM public.league_teams WHERE id = NEW.team_a_id;
  SELECT name INTO v_team_b_name FROM public.league_teams WHERE id = NEW.team_b_id;

  IF NEW.status = 'score_submitted' THEN
    IF NEW.score_submitted_by IS NOT NULL THEN
      SELECT display_name INTO v_actor_name FROM public.profiles WHERE id = NEW.score_submitted_by;
    END IF;
    v_score := COALESCE(NEW.team_a_score::TEXT, '?') || '–' || COALESCE(NEW.team_b_score::TEXT, '?');
    FOR v_recipient IN SELECT * FROM public.league_match_participant_user_ids(NEW.id, NEW.score_submitted_by) LOOP
      PERFORM public.create_notification(v_recipient.user_id, 'league_score_submitted', 'leagues',
        'Confirm league score',
        COALESCE(v_actor_name, 'A teammate') || ' submitted ' || v_score || ' in ' || v_league_name || '. Tap to confirm.',
        v_link, 'normal',
        jsonb_build_object('league_id', NEW.league_id, 'match_id', NEW.id, 'season_id', NEW.season_id),
        NEW.score_submitted_by, NULL);
    END LOOP;
    RETURN NEW;
  END IF;

  IF NEW.status = 'verified' THEN
    v_score := COALESCE(NEW.team_a_score::TEXT, '?') || '–' || COALESCE(NEW.team_b_score::TEXT, '?');
    FOR v_recipient IN SELECT * FROM public.league_match_participant_user_ids(NEW.id, NULL) LOOP
      IF OLD.status = 'disputed' THEN
        PERFORM public.create_notification(v_recipient.user_id, 'league_dispute_resolved', 'leagues',
          'Dispute resolved',
          'An admin resolved the disputed match in ' || v_league_name || '. Final: ' || v_score || '.',
          v_link, 'normal',
          jsonb_build_object('league_id', NEW.league_id, 'match_id', NEW.id, 'season_id', NEW.season_id), NULL, NULL);
      ELSE
        PERFORM public.create_notification(v_recipient.user_id, 'league_match_verified', 'leagues',
          'Match verified',
          'Your ' || v_league_name || ' match is locked in — ' || v_score || '.',
          v_link, 'low',
          jsonb_build_object('league_id', NEW.league_id, 'match_id', NEW.id, 'season_id', NEW.season_id), NULL, NULL);
      END IF;
    END LOOP;
    RETURN NEW;
  END IF;

  IF NEW.status = 'disputed' THEN
    FOR v_recipient IN SELECT * FROM public.league_match_participant_user_ids(NEW.id, NULL) LOOP
      PERFORM public.create_notification(v_recipient.user_id, 'league_match_disputed', 'leagues',
        'Score disputed',
        'A ' || v_league_name || ' match score was disputed. An admin will review shortly.',
        v_link, 'high',
        jsonb_build_object('league_id', NEW.league_id, 'match_id', NEW.id, 'season_id', NEW.season_id), NULL, NULL);
    END LOOP;
    RETURN NEW;
  END IF;

  IF NEW.status = 'forfeit' THEN
    v_winner_team_name := NULL;
    IF NEW.forfeit_winner_team_id IS NOT NULL THEN
      SELECT name INTO v_winner_team_name FROM public.league_teams WHERE id = NEW.forfeit_winner_team_id;
    END IF;
    FOR v_recipient IN SELECT * FROM public.league_match_participant_user_ids(NEW.id, NULL) LOOP
      PERFORM public.create_notification(v_recipient.user_id, 'league_match_forfeited', 'leagues',
        'Match forfeited',
        'Your ' || v_league_name || ' match was recorded as a forfeit' || COALESCE(' — ' || v_winner_team_name || ' wins.', '.'),
        v_link, 'normal',
        jsonb_build_object('league_id', NEW.league_id, 'match_id', NEW.id, 'season_id', NEW.season_id), NULL, NULL);
    END LOOP;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_league_match_state_change ON public.league_matches;
CREATE TRIGGER trg_notify_league_match_state_change
  AFTER UPDATE OF status ON public.league_matches
  FOR EACH ROW EXECUTE FUNCTION public.notify_league_match_state_change();
