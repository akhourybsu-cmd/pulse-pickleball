-- League operations: organizer permissions, season-safe enrollment, and
-- invariant checks shared by the UI, RPCs, and ladder workers.
-- No existing memberships, schedules, scores, or ratings are rewritten.
BEGIN;

CREATE OR REPLACE FUNCTION public.is_league_admin(
  p_league_id uuid, p_user_id uuid DEFAULT auth.uid()
) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_user_id IS NOT NULL AND (
    public.has_role(p_user_id, 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.leagues WHERE id = p_league_id AND created_by = p_user_id)
    OR EXISTS (SELECT 1 FROM public.league_members
      WHERE league_id = p_league_id AND user_id = p_user_id
        AND role = 'manager' AND status = 'active')
  );
$$;

-- Assistant managers can operate the league, but cannot take its ownership.
CREATE OR REPLACE FUNCTION public.guard_league_owner() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.created_by IS DISTINCT FROM OLD.created_by
     AND auth.uid() IS NOT NULL AND auth.uid() <> OLD.created_by
     AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only the owner can transfer league ownership' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_guard_league_owner ON public.leagues;
CREATE TRIGGER trg_guard_league_owner BEFORE UPDATE ON public.leagues
  FOR EACH ROW EXECUTE FUNCTION public.guard_league_owner();

-- Serialize on the league, choose one open active season, and never move an
-- old membership into a new season or restore previously revoked privileges.
CREATE OR REPLACE FUNCTION public.join_league_by_code(p_code text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid(); v_league uuid; v_season uuid; v_member record; v_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000'; END IF;
  SELECT id INTO v_league FROM public.leagues
    WHERE lower(invite_code) = lower(trim(p_code)) AND visibility <> 'admin_only'
      AND status = 'active' FOR UPDATE;
  IF v_league IS NULL THEN RAISE EXCEPTION 'This league is not accepting invitations' USING ERRCODE = '02000'; END IF;
  SELECT id INTO v_season FROM public.league_seasons
    WHERE league_id = v_league AND status = 'active'
      AND (registration_deadline IS NULL OR registration_deadline >= CURRENT_DATE)
    ORDER BY start_date DESC NULLS LAST, created_at DESC, id LIMIT 1;
  IF v_season IS NULL THEN
    -- Existing active members can still open their league after registration.
    IF EXISTS (SELECT 1 FROM public.league_members WHERE league_id = v_league
      AND user_id = v_user AND status = 'active' AND
      (season_id IS NULL OR season_id IN (SELECT id FROM public.league_seasons
        WHERE league_id = v_league AND status = 'active'))) THEN RETURN v_league; END IF;
    RAISE EXCEPTION 'Registration is not open. Ask the organizer about the next season.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_member FROM public.league_members
    WHERE league_id = v_league AND season_id = v_season AND user_id = v_user FOR UPDATE;
  IF v_member.id IS NOT NULL THEN
    IF v_member.status = 'active' THEN RETURN v_league; END IF;
    RAISE EXCEPTION 'Ask the organizer to approve or restore your membership for this season' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.league_members (league_id, season_id, user_id, role, status)
    VALUES (v_league, v_season, v_user, 'player', 'active') RETURNING id INTO v_id;
  INSERT INTO public.league_audit_log (league_id, season_id, actor_user_id, action, entity_type, entity_id, new_value)
    VALUES (v_league, v_season, v_user, 'member.joined_by_code', 'member', v_id,
      jsonb_build_object('via', 'invite_code', 'season_id', v_season));
  RETURN v_league;
END; $$;

CREATE OR REPLACE FUNCTION public.find_league_by_invite_code(p_code text)
RETURNS TABLE (id uuid, name text, description text, location text, league_type text,
  visibility text, guests_allowed boolean, registration_open boolean, registration_closes_at date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT l.id, l.name, l.description, l.location, l.league_type::text, l.visibility::text, l.guests_allowed,
    EXISTS (SELECT 1 FROM public.league_seasons s WHERE s.league_id = l.id AND s.status = 'active'
      AND (s.registration_deadline IS NULL OR s.registration_deadline >= CURRENT_DATE)),
    (SELECT min(s.registration_deadline) FROM public.league_seasons s WHERE s.league_id = l.id
      AND s.status = 'active' AND s.registration_deadline >= CURRENT_DATE)
  FROM public.leagues l WHERE lower(l.invite_code) = lower(trim(p_code))
    AND l.visibility <> 'admin_only' AND l.status = 'active';
$$;

-- A retired player cannot keep scoring using an old slot/team id. Substitutes
-- remain eligible even when they have no ordinary league membership row.
CREATE OR REPLACE FUNCTION public.player_is_in_league_match(p_match_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.league_matches m
    JOIN public.leagues l ON l.id = m.league_id
    JOIN public.league_seasons s ON s.id = m.season_id AND s.league_id = l.id
    WHERE m.id = p_match_id AND l.visibility <> 'admin_only' AND l.status = 'active' AND s.status = 'active'
      AND (m.session_id IS NULL OR EXISTS (SELECT 1 FROM public.league_sessions ls
        WHERE ls.id = m.session_id AND ls.status = 'published'))
      AND (EXISTS (SELECT 1 FROM public.league_members lm WHERE lm.league_id = l.id
        AND lm.season_id = s.id AND lm.user_id = auth.uid() AND lm.status = 'active')
        OR EXISTS (SELECT 1 FROM public.league_substitutes sub WHERE sub.league_id = l.id
          AND sub.season_id = s.id AND sub.user_id = auth.uid() AND sub.status = 'active'))
      AND (auth.uid() IN (m.player_a_id, m.player_b_id, m.player_c_id, m.player_d_id)
        OR EXISTS (SELECT 1 FROM public.league_team_members tm JOIN public.league_teams t ON t.id = tm.team_id
          WHERE t.id IN (m.team_a_id, m.team_b_id) AND t.status = 'active'
            AND tm.user_id = auth.uid() AND tm.status = 'active')
        OR EXISTS (SELECT 1 FROM public.league_teams t WHERE t.id IN (m.team_a_id, m.team_b_id)
          AND t.status = 'active' AND t.captain_user_id = auth.uid())));
$$;

-- Draft sessions and their matches stay private until published. Restrictive
-- policies also protect against older, more permissive SELECT policies.
DROP POLICY IF EXISTS "League session publication gate" ON public.league_sessions;
CREATE POLICY "League session publication gate" ON public.league_sessions AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.is_league_admin(league_id) OR status <> 'draft');
DROP POLICY IF EXISTS "League match publication gate" ON public.league_matches;
CREATE POLICY "League match publication gate" ON public.league_matches AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.is_league_admin(league_id) OR session_id IS NULL OR EXISTS
    (SELECT 1 FROM public.league_sessions s WHERE s.id = session_id AND s.status <> 'draft'));
-- Fill-ins need to see their assigned matches, not just submit to a known id.
DROP POLICY IF EXISTS "Substitutes see assigned matches" ON public.league_matches;
CREATE POLICY "Substitutes see assigned matches" ON public.league_matches FOR SELECT TO authenticated
  USING (public.player_is_in_league_match(id));
DROP POLICY IF EXISTS "Substitutes see league" ON public.leagues;
CREATE POLICY "Substitutes see league" ON public.leagues FOR SELECT TO authenticated
  USING (visibility <> 'admin_only' AND EXISTS (SELECT 1 FROM public.league_substitutes s
    WHERE s.league_id = leagues.id AND s.user_id = auth.uid() AND s.status = 'active'));
DROP POLICY IF EXISTS "Substitutes see season" ON public.league_seasons;
CREATE POLICY "Substitutes see season" ON public.league_seasons FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.league_substitutes s WHERE s.season_id = league_seasons.id
    AND s.user_id = auth.uid() AND s.status = 'active'));
DROP POLICY IF EXISTS "Substitutes see session" ON public.league_sessions;
CREATE POLICY "Substitutes see session" ON public.league_sessions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.league_substitutes s WHERE s.season_id = league_sessions.season_id
    AND s.user_id = auth.uid() AND s.status = 'active'));

CREATE OR REPLACE FUNCTION public.guard_league_season_scope() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_league uuid;
BEGIN
  IF NEW.season_id IS NOT NULL THEN
    SELECT league_id INTO v_league FROM public.league_seasons WHERE id = NEW.season_id;
    IF v_league IS DISTINCT FROM NEW.league_id THEN
      RAISE EXCEPTION 'The season must belong to this league' USING ERRCODE = '22023';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['league_members','league_teams','league_sessions','league_matches','league_substitutes','ladder_settings'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_guard_league_season_scope ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_guard_league_season_scope BEFORE INSERT OR UPDATE OF league_id, season_id ON public.%I FOR EACH ROW EXECUTE FUNCTION public.guard_league_season_scope()', t);
  END LOOP;
END; $$;

CREATE OR REPLACE FUNCTION public.guard_league_match_inputs() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_session record; v_players uuid[];
BEGIN
  IF NEW.court_number IS NOT NULL AND NEW.court_number < 1 THEN
    RAISE EXCEPTION 'Court number must be a positive whole number' USING ERRCODE = '22023'; END IF;
  IF NEW.session_id IS NOT NULL THEN
    SELECT * INTO v_session FROM public.league_sessions WHERE id = NEW.session_id;
    IF v_session.season_id IS DISTINCT FROM NEW.season_id OR v_session.league_id IS DISTINCT FROM NEW.league_id THEN
      RAISE EXCEPTION 'The session must belong to the selected season and league' USING ERRCODE = '22023'; END IF;
    IF (TG_OP = 'INSERT' OR NEW.court_number IS DISTINCT FROM OLD.court_number OR NEW.session_id IS DISTINCT FROM OLD.session_id)
       AND NEW.court_number > v_session.court_count THEN
      RAISE EXCEPTION 'Court number exceeds this session''s available courts' USING ERRCODE = '22023'; END IF;
  END IF;
  IF TG_OP = 'INSERT' AND EXISTS (SELECT 1 FROM public.league_seasons
    WHERE id = NEW.season_id AND status IN ('completed','archived')) THEN
    RAISE EXCEPTION 'Reopen the season before adding matches' USING ERRCODE = '22023'; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'verified' AND NEW.status = 'verified' AND
    ROW(NEW.team_a_id, NEW.team_b_id, NEW.player_a_id, NEW.player_b_id, NEW.player_c_id, NEW.player_d_id)
      IS DISTINCT FROM ROW(OLD.team_a_id, OLD.team_b_id, OLD.player_a_id, OLD.player_b_id, OLD.player_c_id, OLD.player_d_id) THEN
    RAISE EXCEPTION 'Reopen the result before changing its participants, then verify the corrected score' USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM public.league_teams t WHERE t.id IN (NEW.team_a_id, NEW.team_b_id)
    AND (t.season_id <> NEW.season_id OR t.league_id <> NEW.league_id)) THEN
    RAISE EXCEPTION 'Both teams must belong to the selected season' USING ERRCODE = '22023'; END IF;
  IF NEW.team_a_id IS NOT NULL AND NEW.team_a_id = NEW.team_b_id THEN
    RAISE EXCEPTION 'A team cannot play itself' USING ERRCODE = '22023'; END IF;
  v_players := array_remove(ARRAY[NEW.player_a_id, NEW.player_b_id, NEW.player_c_id, NEW.player_d_id], NULL);
  IF cardinality(v_players) <> (SELECT count(DISTINCT p) FROM unnest(v_players) p) THEN
    RAISE EXCEPTION 'Each player can appear only once in a match' USING ERRCODE = '22023'; END IF;
  IF (NEW.team_a_score IS NULL) <> (NEW.team_b_score IS NULL)
     OR NEW.team_a_score < 0 OR NEW.team_b_score < 0 OR NEW.team_a_score = NEW.team_b_score THEN
    RAISE EXCEPTION 'Enter two non-negative, untied whole-number scores, or leave both blank' USING ERRCODE = '22023'; END IF;
  IF NEW.status IN ('verified', 'score_submitted') AND (NEW.team_a_score IS NULL OR NEW.team_b_score IS NULL) THEN
    RAISE EXCEPTION 'A scored match requires both scores' USING ERRCODE = '22023'; END IF;
  IF NEW.status IN ('verified', 'score_submitted') AND NOT (
    (NEW.team_a_id IS NOT NULL AND NEW.team_b_id IS NOT NULL) OR
    ((NEW.player_a_id IS NOT NULL OR NEW.player_b_id IS NOT NULL) AND (NEW.player_c_id IS NOT NULL OR NEW.player_d_id IS NOT NULL))) THEN
    RAISE EXCEPTION 'Assign both sides before recording a result' USING ERRCODE = '22023'; END IF;
  IF NEW.status = 'forfeit' AND (NEW.forfeit_winner_team_id IS NULL
    OR NEW.team_a_id IS NULL OR NEW.team_b_id IS NULL
    OR NEW.forfeit_winner_team_id NOT IN (NEW.team_a_id, NEW.team_b_id)) THEN
    RAISE EXCEPTION 'Choose the winning team using Mark forfeit' USING ERRCODE = '22023'; END IF;
  IF NEW.status <> 'forfeit' THEN NEW.forfeit_winner_team_id := NULL; END IF;
  -- Scores changed by an organizer must not carry someone else's confirmations.
  IF TG_OP = 'UPDATE' AND (NEW.team_a_score IS DISTINCT FROM OLD.team_a_score
      OR NEW.team_b_score IS DISTINCT FROM OLD.team_b_score)
      AND NEW.score_submitted_at IS NOT DISTINCT FROM OLD.score_submitted_at THEN
    NEW.verified_by := '{}'; NEW.score_submitted_by := NULL; NEW.score_submitted_at := NULL;
  END IF;
  IF NEW.status <> 'disputed' THEN NEW.dispute_reason := NULL; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_guard_league_match_inputs ON public.league_matches;
CREATE TRIGGER trg_guard_league_match_inputs BEFORE INSERT OR UPDATE OF
  league_id, season_id, session_id, court_number, team_a_id, team_b_id,
  player_a_id, player_b_id, player_c_id, player_d_id, team_a_score, team_b_score, status
  ON public.league_matches FOR EACH ROW EXECUTE FUNCTION public.guard_league_match_inputs();

CREATE OR REPLACE FUNCTION public.guard_league_session_inputs() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF trim(NEW.name) = '' THEN RAISE EXCEPTION 'Session name is required' USING ERRCODE = '22023'; END IF;
  IF NEW.end_time IS NOT NULL AND (NEW.start_time IS NULL OR NEW.end_time <= NEW.start_time) THEN
    RAISE EXCEPTION 'End time must be later than start time on the same day' USING ERRCODE = '22023'; END IF;
  IF TG_OP = 'UPDATE' AND NEW.court_count IS DISTINCT FROM OLD.court_count AND EXISTS
    (SELECT 1 FROM public.league_matches WHERE session_id = NEW.id
      AND status IN ('scheduled','in_progress','score_submitted','disputed') AND court_number > NEW.court_count) THEN
    RAISE EXCEPTION 'Reassign the open matches on higher courts before reducing the court count' USING ERRCODE = '22023'; END IF;
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('completed','canceled') AND EXISTS
    (SELECT 1 FROM public.league_matches WHERE session_id = NEW.id AND status NOT IN ('verified','canceled','forfeit')) THEN
    RAISE EXCEPTION 'Finish, resolve, or cancel the open matches before closing this session' USING ERRCODE = '22023'; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_guard_league_session_inputs ON public.league_sessions;
CREATE TRIGGER trg_guard_league_session_inputs BEFORE INSERT OR UPDATE ON public.league_sessions
  FOR EACH ROW EXECUTE FUNCTION public.guard_league_session_inputs();

CREATE OR REPLACE FUNCTION public.guard_league_season_completion() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF trim(NEW.name) = '' THEN RAISE EXCEPTION 'Season name is required' USING ERRCODE = '22023'; END IF;
  IF NEW.registration_deadline > NEW.end_date THEN
    RAISE EXCEPTION 'Registration cannot close after the season ends' USING ERRCODE = '22023'; END IF;
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('completed','archived') THEN
    IF EXISTS (SELECT 1 FROM public.league_matches WHERE season_id = NEW.id AND status NOT IN ('verified','canceled','forfeit')) THEN
      RAISE EXCEPTION 'Finish, resolve, or cancel all open matches before closing this season' USING ERRCODE = '22023'; END IF;
    IF EXISTS (SELECT 1 FROM public.ladder_batches WHERE season_id = NEW.id AND status NOT IN ('finalized','invalidated')) THEN
      RAISE EXCEPTION 'Process all remaining ladder results before closing this season' USING ERRCODE = '22023'; END IF;
    UPDATE public.ladder_settings SET status = 'complete', auto_advance = false WHERE season_id = NEW.id;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_guard_league_season_completion ON public.league_seasons;
CREATE TRIGGER trg_guard_league_season_completion BEFORE INSERT OR UPDATE ON public.league_seasons
  FOR EACH ROW EXECUTE FUNCTION public.guard_league_season_completion();

CREATE OR REPLACE FUNCTION public.guard_ladder_active_season() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'ladder_settings' AND NEW.status <> 'active' THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.league_seasons s JOIN public.leagues l ON l.id = s.league_id
    WHERE s.id = NEW.season_id AND s.status = 'active' AND l.status = 'active') THEN
    RAISE EXCEPTION 'Activate the league and season before starting or advancing its ladder' USING ERRCODE = '22023'; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_guard_ladder_active_season ON public.ladder_batches;
CREATE TRIGGER trg_guard_ladder_active_season BEFORE INSERT ON public.ladder_batches
  FOR EACH ROW EXECUTE FUNCTION public.guard_ladder_active_season();
DROP TRIGGER IF EXISTS trg_guard_ladder_active_season ON public.ladder_settings;
CREATE TRIGGER trg_guard_ladder_active_season BEFORE INSERT OR UPDATE OF status ON public.ladder_settings
  FOR EACH ROW EXECUTE FUNCTION public.guard_ladder_active_season();

CREATE OR REPLACE FUNCTION public.guard_ladder_confirmed_results() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'finalized' AND OLD.status <> 'finalized' AND EXISTS (
    SELECT 1 FROM public.league_matches m JOIN public.ladder_batch_groups g ON g.id = m.ladder_batch_group_id
    WHERE g.batch_id = NEW.id AND (m.status <> 'verified' OR m.team_a_score IS NULL OR m.team_b_score IS NULL)
  ) THEN
    RAISE EXCEPTION 'Confirm or resolve every game before processing this ladder batch' USING ERRCODE = '22023'; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_guard_ladder_confirmed_results ON public.ladder_batches;
CREATE TRIGGER trg_guard_ladder_confirmed_results BEFORE UPDATE OF status ON public.ladder_batches
  FOR EACH ROW EXECUTE FUNCTION public.guard_ladder_confirmed_results();

-- Date-based synchronization must not hide unfinished play, nor let one
-- unfinished season abort updates to every other eligible season.
CREATE OR REPLACE FUNCTION public.sync_league_season_statuses(p_league_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_season record; v_activated integer := 0; v_completed integer := 0;
  v_attention integer := 0; v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_league_admin(p_league_id) THEN
    RAISE EXCEPTION 'League admin privileges required' USING ERRCODE = '42501'; END IF;
  UPDATE public.league_seasons SET status = 'active', updated_at = now()
    WHERE league_id = p_league_id AND status = 'draft' AND start_date <= CURRENT_DATE
      AND (end_date IS NULL OR end_date >= CURRENT_DATE);
  GET DIAGNOSTICS v_activated = ROW_COUNT;
  FOR v_season IN SELECT id FROM public.league_seasons
    WHERE league_id = p_league_id AND status = 'active' AND end_date < CURRENT_DATE
    ORDER BY id FOR UPDATE LOOP
    BEGIN
      UPDATE public.league_seasons SET status = 'completed', updated_at = now() WHERE id = v_season.id;
      v_completed := v_completed + 1;
    EXCEPTION WHEN invalid_parameter_value THEN
      v_attention := v_attention + 1;
    END;
  END LOOP;
  v_result := jsonb_build_object('activated', v_activated, 'completed', v_completed, 'needs_attention', v_attention);
  IF v_activated > 0 OR v_completed > 0 THEN
    INSERT INTO public.league_audit_log (league_id, actor_user_id, action, entity_type, entity_id, new_value)
      VALUES (p_league_id, auth.uid(), 'season.lifecycle_synced', 'league', p_league_id, v_result);
  END IF;
  RETURN v_result;
END; $$;
REVOKE ALL ON FUNCTION public.sync_league_season_statuses(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_league_season_statuses(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_league_match_score(
  p_match_id uuid, p_team_a_score integer, p_team_b_score integer
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid(); v_match record; v_admin boolean; v_self_report boolean;
  v_start timestamptz;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000'; END IF;
  IF p_team_a_score IS NULL OR p_team_b_score IS NULL OR p_team_a_score < 0 OR p_team_b_score < 0
    OR p_team_a_score = p_team_b_score THEN
    RAISE EXCEPTION 'Enter two non-negative, untied whole-number scores' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_match FROM public.league_matches WHERE id = p_match_id FOR UPDATE;
  IF v_match.id IS NULL THEN RAISE EXCEPTION 'Match not found' USING ERRCODE = '02000'; END IF;
  v_admin := public.is_league_admin(v_match.league_id, v_user);
  IF NOT v_admin AND NOT public.player_is_in_league_match(p_match_id) THEN
    RAISE EXCEPTION 'Only active participants in published play can submit scores' USING ERRCODE = '42501'; END IF;
  IF v_match.status IN ('verified','canceled','forfeit') OR (v_match.status = 'disputed' AND NOT v_admin) THEN
    RAISE EXCEPTION 'Ask the organizer to resolve or reopen this match' USING ERRCODE = '22023'; END IF;
  -- The match's exact timestamp takes precedence over the session's start.
  -- Legacy date/time-only sessions retain their existing UTC interpretation.
  v_start := v_match.scheduled_time;
  IF v_start IS NULL AND v_match.session_id IS NOT NULL THEN
    SELECT (scheduled_date + COALESCE(start_time, '00:00'::time)) AT TIME ZONE 'UTC'
      INTO v_start FROM public.league_sessions WHERE id = v_match.session_id;
  END IF;
  IF NOT v_admin AND v_start > now() THEN
    RAISE EXCEPTION 'Scores cannot be entered before the scheduled start' USING ERRCODE = '22023'; END IF;
  SELECT self_report_scoring INTO v_self_report FROM public.ladder_settings WHERE season_id = v_match.season_id;
  UPDATE public.league_matches SET team_a_score = p_team_a_score, team_b_score = p_team_b_score,
    status = CASE WHEN v_admin OR COALESCE(v_self_report, false) THEN 'verified' ELSE 'score_submitted' END,
    score_submitted_by = v_user, score_submitted_at = clock_timestamp(),
    verified_by = ARRAY[v_user], dispute_reason = NULL, updated_at = now() WHERE id = p_match_id;
  INSERT INTO public.league_audit_log (league_id, season_id, actor_user_id, action, entity_type, entity_id, old_value, new_value)
    VALUES (v_match.league_id, v_match.season_id, v_user, 'match.score_submitted', 'league_match', p_match_id,
      jsonb_build_object('team_a_score', v_match.team_a_score, 'team_b_score', v_match.team_b_score, 'status', v_match.status),
      jsonb_build_object('team_a_score', p_team_a_score, 'team_b_score', p_team_b_score));
END; $$;

-- Confirm exactly the score the player saw, not a concurrent replacement.
CREATE OR REPLACE FUNCTION public.confirm_league_match_score(
  p_match_id uuid, p_team_a_score integer, p_team_b_score integer
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_match record;
BEGIN
  IF NOT public.player_is_in_league_match(p_match_id) THEN
    RAISE EXCEPTION 'Only active participants can confirm this score' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_match FROM public.league_matches WHERE id = p_match_id FOR UPDATE;
  IF v_match.team_a_score IS DISTINCT FROM p_team_a_score OR v_match.team_b_score IS DISTINCT FROM p_team_b_score THEN
    RAISE EXCEPTION 'The score changed. Refresh and review the latest score before confirming.' USING ERRCODE = '40001'; END IF;
  IF v_match.status = 'verified' AND auth.uid() = ANY(v_match.verified_by) THEN RETURN; END IF;
  PERFORM public.verify_league_match(p_match_id);
END; $$;

REVOKE ALL ON FUNCTION public.confirm_league_match_score(uuid, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_league_match_score(uuid, integer, integer) TO authenticated;
REVOKE ALL ON FUNCTION public.is_league_admin(uuid, uuid), public.join_league_by_code(text),
  public.player_is_in_league_match(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_league_admin(uuid, uuid), public.join_league_by_code(text),
  public.player_is_in_league_match(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.find_league_by_invite_code(text) TO anon, authenticated, service_role;
DO $$ DECLARE t text; BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY['league_members','league_matches','league_seasons','league_sessions','league_teams','league_substitutes'] LOOP
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END LOOP;
  END IF;
END; $$;
COMMIT;
