-- MIGRATION: ladder_week_sitouts + ladder_sub_requests

CREATE TABLE IF NOT EXISTS public.ladder_week_sitouts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id    UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  season_id    UUID NOT NULL REFERENCES public.league_seasons(id) ON DELETE CASCADE,
  week_number  INTEGER NOT NULL CHECK (week_number >= 1),
  player_id    UUID NOT NULL REFERENCES public.profiles(id),
  note         TEXT,
  created_by   UUID REFERENCES public.profiles(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (season_id, week_number, player_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ladder_week_sitouts TO authenticated;
GRANT ALL ON public.ladder_week_sitouts TO service_role;
CREATE INDEX IF NOT EXISTS idx_ladder_week_sitouts_week
  ON public.ladder_week_sitouts(season_id, week_number);
ALTER TABLE public.ladder_week_sitouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "League admins full access" ON public.ladder_week_sitouts;
CREATE POLICY "League admins full access" ON public.ladder_week_sitouts
  FOR ALL USING (public.is_league_admin(league_id, auth.uid()))
  WITH CHECK (public.is_league_admin(league_id, auth.uid()));

DROP POLICY IF EXISTS "Members read sitouts of own leagues" ON public.ladder_week_sitouts;
CREATE POLICY "Members read sitouts of own leagues" ON public.ladder_week_sitouts
  FOR SELECT USING (public.player_can_view_league(league_id));

ALTER TABLE public.league_sessions
  ADD COLUMN IF NOT EXISTS week_number INTEGER
    CHECK (week_number IS NULL OR week_number >= 1),
  ADD COLUMN IF NOT EXISTS capacity INTEGER
    CHECK (capacity IS NULL OR capacity >= 0);

CREATE UNIQUE INDEX IF NOT EXISTS idx_league_sessions_season_week
  ON public.league_sessions(season_id, week_number)
  WHERE week_number IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.ladder_sub_requests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id      UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  season_id      UUID NOT NULL REFERENCES public.league_seasons(id) ON DELETE CASCADE,
  session_id     UUID NOT NULL REFERENCES public.league_sessions(id) ON DELETE CASCADE,
  week_number    INTEGER NOT NULL CHECK (week_number >= 1),
  player_id      UUID NOT NULL REFERENCES public.profiles(id),
  note           TEXT,
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','sub','sitout','declined','canceled')),
  assigned_sub_id UUID REFERENCES public.profiles(id),
  resolved_by    UUID REFERENCES public.profiles(id),
  resolved_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, player_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ladder_sub_requests TO authenticated;
GRANT ALL ON public.ladder_sub_requests TO service_role;
CREATE INDEX IF NOT EXISTS idx_ladder_sub_requests_season_week
  ON public.ladder_sub_requests(season_id, week_number);
CREATE INDEX IF NOT EXISTS idx_ladder_sub_requests_session
  ON public.ladder_sub_requests(session_id);
ALTER TABLE public.ladder_sub_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "League admins full access" ON public.ladder_sub_requests;
CREATE POLICY "League admins full access" ON public.ladder_sub_requests
  FOR ALL USING (public.is_league_admin(league_id, auth.uid()))
  WITH CHECK (public.is_league_admin(league_id, auth.uid()));

DROP POLICY IF EXISTS "Members read sub-requests of own leagues" ON public.ladder_sub_requests;
CREATE POLICY "Members read sub-requests of own leagues" ON public.ladder_sub_requests
  FOR SELECT USING (public.player_can_view_league(league_id));

CREATE OR REPLACE FUNCTION public.schedule_ladder_week(
  p_league_id      UUID,
  p_season_id      UUID,
  p_week_number    INTEGER,
  p_scheduled_date DATE    DEFAULT NULL,
  p_start_time     TIME    DEFAULT NULL,
  p_end_time       TIME    DEFAULT NULL,
  p_location       TEXT    DEFAULT NULL,
  p_court_count    INTEGER DEFAULT NULL,
  p_capacity       INTEGER DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user       UUID := auth.uid();
  v_session_id UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  IF NOT public.is_league_admin(p_league_id, v_user) THEN
    RAISE EXCEPTION 'League admin privileges required' USING ERRCODE = '42501';
  END IF;
  IF p_week_number IS NULL OR p_week_number < 1 THEN
    RAISE EXCEPTION 'A valid week number is required' USING ERRCODE = '22023';
  END IF;
  SELECT id INTO v_session_id FROM public.league_sessions
   WHERE season_id = p_season_id AND week_number = p_week_number;
  IF v_session_id IS NULL THEN
    INSERT INTO public.league_sessions
      (league_id, season_id, week_number, name, scheduled_date, start_time,
       end_time, location, court_count, capacity, status)
    VALUES (p_league_id, p_season_id, p_week_number, 'Week ' || p_week_number,
            p_scheduled_date, p_start_time, p_end_time,
            NULLIF(TRIM(COALESCE(p_location, '')), ''),
            p_court_count, p_capacity, 'published')
    RETURNING id INTO v_session_id;
  ELSE
    UPDATE public.league_sessions
       SET scheduled_date = p_scheduled_date,
           start_time     = p_start_time,
           end_time       = p_end_time,
           location       = NULLIF(TRIM(COALESCE(p_location, '')), ''),
           court_count    = p_court_count,
           capacity       = p_capacity,
           status         = CASE WHEN status = 'draft' THEN 'published' ELSE status END,
           updated_at     = now()
     WHERE id = v_session_id;
  END IF;
  INSERT INTO public.league_audit_log
    (league_id, season_id, actor_user_id, action, entity_type, entity_id, new_value)
  VALUES (p_league_id, p_season_id, v_user, 'ladder.week_scheduled',
          'league_session', v_session_id,
          jsonb_build_object('week', p_week_number, 'date', p_scheduled_date));
  RETURN jsonb_build_object('session_id', v_session_id, 'week_number', p_week_number);
END;
$$;
GRANT EXECUTE ON FUNCTION public.schedule_ladder_week(UUID, UUID, INTEGER, DATE, TIME, TIME, TEXT, INTEGER, INTEGER)
  TO authenticated;

-- request_ladder_sub (with #1 past-week and #2 week-1 guards)
CREATE OR REPLACE FUNCTION public.request_ladder_sub(
  p_season_id  UUID,
  p_session_id UUID,
  p_note       TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user      UUID := auth.uid();
  v_league_id UUID;
  v_week      INTEGER;
  v_date      DATE;
  v_owner     UUID;
  v_req_id    UUID;
  v_name      TEXT;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  SELECT s.league_id, s.week_number, s.scheduled_date
    INTO v_league_id, v_week, v_date
    FROM public.league_sessions s
   WHERE s.id = p_session_id AND s.season_id = p_season_id;
  IF v_league_id IS NULL THEN
    RAISE EXCEPTION 'That week could not be found' USING ERRCODE = '02000';
  END IF;
  IF v_week IS NULL THEN
    RAISE EXCEPTION 'That session is not a scheduled ladder week' USING ERRCODE = '22023';
  END IF;
  IF v_week < 2 THEN
    RAISE EXCEPTION 'Week 1 is set by the initial ladder — you can''t request a sub for it'
      USING ERRCODE = '22023';
  END IF;
  IF v_date IS NOT NULL AND v_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'That week has already passed' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.league_members
     WHERE league_id = v_league_id AND season_id = p_season_id
       AND user_id = v_user AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Only active members can request a sub' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.ladder_batches
     WHERE season_id = p_season_id AND week_number = v_week
  ) THEN
    RAISE EXCEPTION 'That week has already started — contact the organizer'
      USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.ladder_sub_requests
    (league_id, season_id, session_id, week_number, player_id, note, status)
  VALUES (v_league_id, p_season_id, p_session_id, v_week, v_user,
          NULLIF(TRIM(COALESCE(p_note, '')), ''), 'pending')
  ON CONFLICT (session_id, player_id) DO UPDATE
    SET status = 'pending', note = EXCLUDED.note, assigned_sub_id = NULL,
        resolved_by = NULL, resolved_at = NULL, updated_at = now()
  RETURNING id INTO v_req_id;
  SELECT created_by INTO v_owner FROM public.leagues WHERE id = v_league_id;
  SELECT COALESCE(display_name, full_name, 'A player')
    INTO v_name FROM public.profiles WHERE id = v_user;
  IF v_owner IS NOT NULL AND v_owner <> v_user THEN
    PERFORM public.create_notification(
      v_owner, 'league_sub_request', 'leagues',
      'Sub requested',
      COALESCE(v_name, 'A player') || ' can''t make Week ' || v_week || ' and needs a sub.',
      '/player/leagues/' || v_league_id || '/manage',
      'normal',
      jsonb_build_object('season_id', p_season_id, 'week', v_week,
                         'session_id', p_session_id, 'request_id', v_req_id),
      v_user
    );
  END IF;
  INSERT INTO public.league_audit_log
    (league_id, season_id, actor_user_id, action, entity_type, entity_id, new_value)
  VALUES (v_league_id, p_season_id, v_user, 'ladder.sub_requested',
          'ladder_sub_request', v_req_id,
          jsonb_build_object('week', v_week, 'session_id', p_session_id));
  RETURN jsonb_build_object('request_id', v_req_id, 'week_number', v_week, 'status', 'pending');
END;
$$;
GRANT EXECUTE ON FUNCTION public.request_ladder_sub(UUID, UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_ladder_sub_request(p_request_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_req  RECORD;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  SELECT * INTO v_req FROM public.ladder_sub_requests WHERE id = p_request_id;
  IF v_req.id IS NULL THEN
    RAISE EXCEPTION 'Request not found' USING ERRCODE = '02000';
  END IF;
  IF v_req.player_id <> v_user AND NOT public.is_league_admin(v_req.league_id, v_user) THEN
    RAISE EXCEPTION 'You can only cancel your own request' USING ERRCODE = '42501';
  END IF;
  IF v_req.status = 'sitout' THEN
    DELETE FROM public.ladder_week_sitouts
     WHERE season_id = v_req.season_id AND week_number = v_req.week_number
       AND player_id = v_req.player_id;
  END IF;
  UPDATE public.ladder_sub_requests
     SET status = 'canceled', assigned_sub_id = NULL, updated_at = now()
   WHERE id = p_request_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.cancel_ladder_sub_request(UUID) TO authenticated;

-- resolve_ladder_sub_request (final version with #4 fill-in uniqueness + #14 notify requester)
CREATE OR REPLACE FUNCTION public.resolve_ladder_sub_request(
  p_request_id     UUID,
  p_resolution     TEXT,
  p_assigned_sub_id UUID DEFAULT NULL,
  p_note           TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user  UUID := auth.uid();
  v_req   RECORD;
  v_ok    BOOLEAN;
  v_order UUID[];
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  IF p_resolution NOT IN ('sub','sitout','declined') THEN
    RAISE EXCEPTION 'Invalid resolution %', p_resolution USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_req FROM public.ladder_sub_requests WHERE id = p_request_id;
  IF v_req.id IS NULL THEN
    RAISE EXCEPTION 'Request not found' USING ERRCODE = '02000';
  END IF;
  IF NOT public.is_league_admin(v_req.league_id, v_user) THEN
    RAISE EXCEPTION 'League admin privileges required' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.ladder_batches
     WHERE season_id = v_req.season_id AND week_number = v_req.week_number
  ) THEN
    RAISE EXCEPTION 'Week % is already generated — use the per-week swap instead',
      v_req.week_number USING ERRCODE = '22023';
  END IF;
  DELETE FROM public.ladder_week_sitouts
   WHERE season_id = v_req.season_id AND week_number = v_req.week_number
     AND player_id = v_req.player_id;
  IF p_resolution = 'sub' THEN
    IF p_assigned_sub_id IS NULL THEN
      RAISE EXCEPTION 'Pick a fill-in to assign' USING ERRCODE = '22023';
    END IF;
    IF p_assigned_sub_id = v_req.player_id THEN
      RAISE EXCEPTION 'The fill-in must be someone else' USING ERRCODE = '22023';
    END IF;
    SELECT (
      EXISTS (SELECT 1 FROM public.league_substitutes s
               WHERE s.league_id = v_req.league_id AND s.season_id = v_req.season_id
                 AND s.user_id = p_assigned_sub_id AND s.status = 'active')
      OR EXISTS (SELECT 1 FROM public.league_members m
               WHERE m.league_id = v_req.league_id AND m.season_id = v_req.season_id
                 AND m.user_id = p_assigned_sub_id AND m.status = 'active')
    ) INTO v_ok;
    IF NOT v_ok THEN
      RAISE EXCEPTION 'The fill-in must be an active substitute or member of this season'
        USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.ladder_sub_requests
       WHERE session_id = v_req.session_id AND id <> p_request_id
         AND status = 'sub' AND assigned_sub_id = p_assigned_sub_id
    ) THEN
      RAISE EXCEPTION 'That fill-in is already covering another player this week'
        USING ERRCODE = '22023';
    END IF;
    SELECT player_ids INTO v_order FROM public.ladder_snapshots
     WHERE season_id = v_req.season_id
     ORDER BY week_number DESC, batch_number DESC LIMIT 1;
    IF v_order IS NOT NULL AND p_assigned_sub_id = ANY (v_order) THEN
      RAISE EXCEPTION 'That player is already on the ladder this week — pick a fill-in who isn''t playing'
        USING ERRCODE = '22023';
    END IF;
    UPDATE public.ladder_sub_requests
       SET status = 'sub', assigned_sub_id = p_assigned_sub_id,
           note = COALESCE(NULLIF(TRIM(COALESCE(p_note, '')), ''), note),
           resolved_by = v_user, resolved_at = now(), updated_at = now()
     WHERE id = p_request_id;
  ELSIF p_resolution = 'sitout' THEN
    IF v_req.week_number < 2 THEN
      RAISE EXCEPTION 'Sit-outs apply from week 2 onward' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.ladder_week_sitouts
      (league_id, season_id, week_number, player_id, note, created_by)
    VALUES (v_req.league_id, v_req.season_id, v_req.week_number, v_req.player_id,
            NULLIF(TRIM(COALESCE(p_note, '')), ''), v_user)
    ON CONFLICT (season_id, week_number, player_id) DO UPDATE SET note = EXCLUDED.note;
    UPDATE public.ladder_sub_requests
       SET status = 'sitout', assigned_sub_id = NULL,
           resolved_by = v_user, resolved_at = now(), updated_at = now()
     WHERE id = p_request_id;
  ELSE
    UPDATE public.ladder_sub_requests
       SET status = 'declined', assigned_sub_id = NULL,
           note = COALESCE(NULLIF(TRIM(COALESCE(p_note, '')), ''), note),
           resolved_by = v_user, resolved_at = now(), updated_at = now()
     WHERE id = p_request_id;
  END IF;
  IF v_req.player_id <> v_user THEN
    PERFORM public.create_notification(
      v_req.player_id, 'league_sub_resolved', 'leagues',
      CASE p_resolution WHEN 'sub' THEN 'Sub arranged'
                        WHEN 'sitout' THEN 'You''re sitting out'
                        ELSE 'Sub request declined' END,
      CASE p_resolution
        WHEN 'sub' THEN 'A sub will cover Week ' || v_req.week_number || ' — you keep your ladder spot.'
        WHEN 'sitout' THEN 'You''re set to sit out Week ' || v_req.week_number
                           || ' — you keep your position and return next week.'
        ELSE 'Your sub request for Week ' || v_req.week_number
             || ' couldn''t be arranged — please plan to play.' END,
      '/player/leagues/' || v_req.league_id,
      'normal',
      jsonb_build_object('week', v_req.week_number, 'resolution', p_resolution),
      v_user
    );
  END IF;
  INSERT INTO public.league_audit_log
    (league_id, season_id, actor_user_id, action, entity_type, entity_id, new_value)
  VALUES (v_req.league_id, v_req.season_id, v_user, 'ladder.sub_request_resolved',
          'ladder_sub_request', p_request_id,
          jsonb_build_object('week', v_req.week_number, 'resolution', p_resolution,
                             'player_id', v_req.player_id, 'assigned_sub_id', p_assigned_sub_id));
  RETURN jsonb_build_object('request_id', p_request_id, 'resolution', p_resolution);
END;
$$;
GRANT EXECUTE ON FUNCTION public.resolve_ladder_sub_request(UUID, TEXT, UUID, TEXT) TO authenticated;

-- set_ladder_week_sitout (with #10: un-sitting reopens a sitout-resolved request)
CREATE OR REPLACE FUNCTION public.set_ladder_week_sitout(
  p_season_id   UUID,
  p_week_number INTEGER,
  p_player_id   UUID,
  p_sitting     BOOLEAN,
  p_note        TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user      UUID := auth.uid();
  v_league_id UUID;
  v_is_mem    BOOLEAN;
  v_count     INTEGER;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  IF p_week_number IS NULL OR p_week_number < 2 THEN
    RAISE EXCEPTION 'Sit-outs apply from week 2 onward' USING ERRCODE = '22023';
  END IF;
  SELECT league_id INTO v_league_id FROM public.league_seasons WHERE id = p_season_id;
  IF v_league_id IS NULL THEN
    RAISE EXCEPTION 'Season not found' USING ERRCODE = '02000';
  END IF;
  IF NOT public.is_league_admin(v_league_id, v_user) THEN
    RAISE EXCEPTION 'League admin privileges required' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.ladder_batches
     WHERE season_id = p_season_id AND week_number = p_week_number
  ) THEN
    RAISE EXCEPTION 'Week % is already generated — its roster is locked', p_week_number
      USING ERRCODE = '22023';
  END IF;
  IF p_sitting THEN
    SELECT EXISTS (
      SELECT 1 FROM public.league_members
       WHERE league_id = v_league_id AND season_id = p_season_id
         AND user_id = p_player_id AND status = 'active'
    ) INTO v_is_mem;
    IF NOT v_is_mem THEN
      RAISE EXCEPTION 'Only an active member of this season can be sat out'
        USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.ladder_week_sitouts
      (league_id, season_id, week_number, player_id, note, created_by)
    VALUES (v_league_id, p_season_id, p_week_number, p_player_id,
            NULLIF(TRIM(COALESCE(p_note, '')), ''), v_user)
    ON CONFLICT (season_id, week_number, player_id) DO UPDATE
      SET note = EXCLUDED.note;
  ELSE
    DELETE FROM public.ladder_week_sitouts
     WHERE season_id = p_season_id AND week_number = p_week_number
       AND player_id = p_player_id;
    UPDATE public.ladder_sub_requests
       SET status = 'pending', assigned_sub_id = NULL,
           resolved_by = NULL, resolved_at = NULL, updated_at = now()
     WHERE season_id = p_season_id AND week_number = p_week_number
       AND player_id = p_player_id AND status = 'sitout';
  END IF;
  SELECT count(*) INTO v_count FROM public.ladder_week_sitouts
   WHERE season_id = p_season_id AND week_number = p_week_number;
  INSERT INTO public.league_audit_log
    (league_id, season_id, actor_user_id, action, entity_type, entity_id, new_value)
  VALUES (
    v_league_id, p_season_id, v_user,
    CASE WHEN p_sitting THEN 'ladder.player_sat_out' ELSE 'ladder.player_unsat' END,
    'league_season', p_season_id,
    jsonb_build_object('week', p_week_number, 'player_id', p_player_id,
                       'sitting', p_sitting, 'sitout_count', v_count)
  );
  RETURN jsonb_build_object('week_number', p_week_number, 'sitout_count', v_count,
                            'sitting', p_sitting);
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_ladder_week_sitout(UUID, INTEGER, UUID, BOOLEAN, TEXT)
  TO authenticated;

-- #6: safe unschedule of a not-yet-generated week
CREATE OR REPLACE FUNCTION public.unschedule_ladder_week(
  p_season_id   UUID,
  p_week_number INTEGER
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user      UUID := auth.uid();
  v_league_id UUID;
  v_session   UUID;
  v_canceled  INTEGER := 0;
  v_rec       RECORD;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  SELECT league_id INTO v_league_id FROM public.league_seasons WHERE id = p_season_id;
  IF v_league_id IS NULL THEN
    RAISE EXCEPTION 'Season not found' USING ERRCODE = '02000';
  END IF;
  IF NOT public.is_league_admin(v_league_id, v_user) THEN
    RAISE EXCEPTION 'League admin privileges required' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.ladder_batches
     WHERE season_id = p_season_id AND week_number = p_week_number
  ) THEN
    RAISE EXCEPTION 'Week % is already generated and can''t be unscheduled', p_week_number
      USING ERRCODE = '22023';
  END IF;
  SELECT id INTO v_session FROM public.league_sessions
   WHERE season_id = p_season_id AND week_number = p_week_number;
  IF v_session IS NULL THEN
    RETURN jsonb_build_object('removed', false);
  END IF;
  FOR v_rec IN
    SELECT DISTINCT player_id FROM public.ladder_sub_requests
     WHERE session_id = v_session AND status <> 'canceled'
  LOOP
    IF v_rec.player_id <> v_user THEN
      PERFORM public.create_notification(
        v_rec.player_id, 'league_week_removed', 'leagues',
        'Week removed',
        'Week ' || p_week_number || ' was removed from the schedule; your sub request was canceled.',
        '/player/leagues/' || v_league_id,
        'normal',
        jsonb_build_object('week', p_week_number),
        v_user
      );
    END IF;
  END LOOP;
  SELECT count(*)::int INTO v_canceled FROM public.ladder_sub_requests
   WHERE session_id = v_session AND status <> 'canceled';
  DELETE FROM public.ladder_week_sitouts
   WHERE season_id = p_season_id AND week_number = p_week_number;
  DELETE FROM public.league_sessions WHERE id = v_session;
  INSERT INTO public.league_audit_log
    (league_id, season_id, actor_user_id, action, entity_type, entity_id, new_value)
  VALUES (v_league_id, p_season_id, v_user, 'ladder.week_unscheduled',
          'league_session', v_session,
          jsonb_build_object('week', p_week_number, 'canceled_requests', v_canceled));
  RETURN jsonb_build_object('removed', true, 'canceled_requests', v_canceled);
END;
$$;
GRANT EXECUTE ON FUNCTION public.unschedule_ladder_week(UUID, INTEGER) TO authenticated;

-- #15: Ladder rating bridge — feed verified ladder games into the PULSE rating engine.
CREATE OR REPLACE FUNCTION public.bridge_ladder_match_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rated      BOOLEAN;
  v_eligible   BOOLEAN;
  v_created_by UUID;
  v_date       DATE;
  v_ids        UUID[];
  v_match_id   UUID;
BEGIN
  IF NEW.ladder_batch_group_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE'
     AND NEW.team_a_score IS NOT DISTINCT FROM OLD.team_a_score
     AND NEW.team_b_score IS NOT DISTINCT FROM OLD.team_b_score
     AND NEW.status       IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  v_rated := (NEW.status = 'verified'
    AND NEW.team_a_score IS NOT NULL AND NEW.team_b_score IS NOT NULL
    AND NEW.team_a_score <> NEW.team_b_score
    AND NEW.player_a_id IS NOT NULL AND NEW.player_b_id IS NOT NULL
    AND NEW.player_c_id IS NOT NULL AND NEW.player_d_id IS NOT NULL);
  SELECT COALESCE(rating_eligible, false) INTO v_eligible
    FROM public.leagues WHERE id = NEW.league_id;
  IF NOT v_rated AND NEW.linked_match_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF v_rated AND NOT v_eligible AND NEW.linked_match_id IS NULL THEN
    RETURN NEW;
  END IF;
  v_ids := ARRAY[NEW.player_a_id, NEW.player_b_id, NEW.player_c_id, NEW.player_d_id];
  v_created_by := COALESCE(NEW.score_submitted_by, NEW.player_a_id);
  SELECT scheduled_date INTO v_date FROM public.league_sessions WHERE id = NEW.session_id;
  v_date := COALESCE(v_date, CURRENT_DATE);
  IF NEW.linked_match_id IS NULL THEN
    INSERT INTO public.matches
      (match_date, team1_score, team2_score, created_by, source,
       court_no, match_type, status, verified_by, count_for_rating)
    VALUES
      (v_date, NEW.team_a_score, NEW.team_b_score, v_created_by, 'ladder',
       NEW.court_number, 'ladder', 'pending', v_ids, v_eligible)
    RETURNING id INTO v_match_id;
    INSERT INTO public.match_participants (match_id, player_id, team) VALUES
      (v_match_id, NEW.player_a_id, 1),
      (v_match_id, NEW.player_b_id, 1),
      (v_match_id, NEW.player_c_id, 2),
      (v_match_id, NEW.player_d_id, 2);
    UPDATE public.matches SET status = 'approved' WHERE id = v_match_id;
    UPDATE public.league_matches
       SET linked_match_id = v_match_id
     WHERE id = NEW.id;
  ELSIF v_rated THEN
    DELETE FROM public.match_participants WHERE match_id = NEW.linked_match_id;
    INSERT INTO public.match_participants (match_id, player_id, team) VALUES
      (NEW.linked_match_id, NEW.player_a_id, 1),
      (NEW.linked_match_id, NEW.player_b_id, 1),
      (NEW.linked_match_id, NEW.player_c_id, 2),
      (NEW.linked_match_id, NEW.player_d_id, 2);
    UPDATE public.matches
       SET team1_score      = NEW.team_a_score,
           team2_score      = NEW.team_b_score,
           verified_by      = v_ids,
           count_for_rating = v_eligible,
           voided           = false,
           void_reason      = NULL,
           status           = 'approved'
     WHERE id = NEW.linked_match_id;
  ELSE
    UPDATE public.matches
       SET voided = true, void_reason = 'ladder game reopened'
     WHERE id = NEW.linked_match_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bridge_ladder_match_rating ON public.league_matches;
CREATE TRIGGER trg_bridge_ladder_match_rating
  AFTER INSERT OR UPDATE ON public.league_matches
  FOR EACH ROW
  EXECUTE FUNCTION public.bridge_ladder_match_rating();