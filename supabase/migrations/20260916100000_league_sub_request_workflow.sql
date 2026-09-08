-- Substitute-request workflow: preserve both notes, serialize decisions with
-- cancellation/draw, prevent duplicate requests from undoing coverage, and
-- notify the owner plus active assistant managers with a direct Actions link.
ALTER TABLE public.ladder_sub_requests ADD COLUMN IF NOT EXISTS resolution_note text;

CREATE OR REPLACE FUNCTION public.request_ladder_sub(
  p_season_id uuid, p_session_id uuid, p_note text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid(); v_session record; v_req record; v_id uuid;
  v_manager uuid; v_name text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000'; END IF;
  SELECT * INTO v_session FROM public.league_sessions
    WHERE id = p_session_id AND season_id = p_season_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That week could not be found' USING ERRCODE = '02000'; END IF;
  IF v_session.week_number IS NULL OR v_session.week_number < 2 THEN
    RAISE EXCEPTION 'Sub requests open from Week 2' USING ERRCODE = '22023'; END IF;
  IF v_session.status <> 'published' OR v_session.scheduled_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'That week is not open for requests' USING ERRCODE = '22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.league_seasons s JOIN public.leagues l ON l.id = s.league_id
    WHERE s.id = p_season_id AND l.id = v_session.league_id AND s.status = 'active'
      AND l.status = 'active' AND l.league_type = 'ladder') THEN
    RAISE EXCEPTION 'The league and season must be active' USING ERRCODE = '22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.league_members WHERE league_id = v_session.league_id
    AND season_id = p_season_id AND user_id = v_user AND status = 'active') THEN
    RAISE EXCEPTION 'Only active season members can request a sub' USING ERRCODE = '42501'; END IF;
  IF EXISTS (SELECT 1 FROM public.ladder_batches WHERE season_id = p_season_id AND week_number = v_session.week_number) THEN
    RAISE EXCEPTION 'The week is already drawn. Contact your organizer for a late replacement.' USING ERRCODE = '22023'; END IF;
  IF length(COALESCE(p_note, '')) > 1000 THEN RAISE EXCEPTION 'Keep the note to 1000 characters' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_req FROM public.ladder_sub_requests WHERE session_id = p_session_id AND player_id = v_user FOR UPDATE;
  -- Retrying a pending submission must not send a second notification. A retry
  -- arriving after resolution must never clear its assigned substitute/sit-out.
  IF v_req.status = 'pending' THEN
    RETURN jsonb_build_object('request_id', v_req.id, 'week_number', v_session.week_number, 'status', 'pending');
  ELSIF v_req.status IN ('sub', 'sitout') THEN
    RAISE EXCEPTION 'Coverage is already arranged. Contact your organizer to change it.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.ladder_sub_requests (league_id, season_id, session_id, week_number, player_id, note)
    VALUES (v_session.league_id, p_season_id, p_session_id, v_session.week_number, v_user, NULLIF(trim(p_note), ''))
    ON CONFLICT (session_id, player_id) DO UPDATE SET status = 'pending', note = EXCLUDED.note,
      assigned_sub_id = NULL, resolution_note = NULL, resolved_by = NULL, resolved_at = NULL,
      created_at = now(), updated_at = now()
    RETURNING id INTO v_id;
  SELECT COALESCE(display_name, full_name, 'A player') INTO v_name FROM public.profiles WHERE id = v_user;
  FOR v_manager IN
    SELECT created_by FROM public.leagues WHERE id = v_session.league_id
    UNION SELECT user_id FROM public.league_members WHERE league_id = v_session.league_id AND role = 'manager' AND status = 'active'
  LOOP
    IF v_manager <> v_user THEN
      PERFORM public.create_notification(v_manager, 'league_sub_request', 'leagues', 'Sub requested',
        COALESCE(v_name, 'A player') || ' needs coverage for Week ' || v_session.week_number || '.',
        '/player/leagues/' || v_session.league_id || '/manage?tab=actions&season=' || p_season_id,
        'normal', jsonb_build_object('request_id', v_id, 'season_id', p_season_id, 'week', v_session.week_number), v_user);
    END IF;
  END LOOP;
  INSERT INTO public.league_audit_log (league_id, season_id, actor_user_id, action, entity_type, entity_id, new_value)
    VALUES (v_session.league_id, p_season_id, v_user, 'ladder.sub_requested', 'ladder_sub_request', v_id,
      jsonb_build_object('week', v_session.week_number));
  RETURN jsonb_build_object('request_id', v_id, 'week_number', v_session.week_number, 'status', 'pending');
END; $$;

CREATE OR REPLACE FUNCTION public.resolve_ladder_sub_request(
  p_request_id uuid, p_resolution text, p_assigned_sub_id uuid DEFAULT NULL, p_note text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid(); v_req record; v_session uuid; v_order uuid[]; v_sub_name text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000'; END IF;
  IF p_resolution IS NULL OR p_resolution NOT IN ('sub', 'sitout', 'declined') THEN
    RAISE EXCEPTION 'Choose a valid decision' USING ERRCODE = '22023'; END IF;
  SELECT session_id INTO v_session FROM public.ladder_sub_requests WHERE id = p_request_id;
  PERFORM 1 FROM public.league_sessions WHERE id = v_session FOR UPDATE;
  SELECT * INTO v_req FROM public.ladder_sub_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found' USING ERRCODE = '02000'; END IF;
  IF NOT public.is_league_admin(v_req.league_id, v_user) THEN
    RAISE EXCEPTION 'League manager privileges required' USING ERRCODE = '42501'; END IF;
  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'This request has changed or was already resolved. Refresh before continuing.' USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM public.ladder_batches WHERE season_id = v_req.season_id AND week_number = v_req.week_number) THEN
    RAISE EXCEPTION 'The week is already drawn. Use Substitutes to swap unplayed games.' USING ERRCODE = '22023'; END IF;
  IF length(COALESCE(p_note, '')) > 1000 THEN RAISE EXCEPTION 'Keep the note to 1000 characters' USING ERRCODE = '22023'; END IF;
  IF p_resolution <> 'declined' AND NOT EXISTS (SELECT 1 FROM public.league_members
    WHERE league_id = v_req.league_id AND season_id = v_req.season_id AND user_id = v_req.player_id AND status = 'active') THEN
    RAISE EXCEPTION 'The requesting player is no longer active in this season. Decline or cancel the request.' USING ERRCODE = '22023'; END IF;
  IF p_resolution = 'sub' THEN
    IF p_assigned_sub_id IS NULL OR p_assigned_sub_id = v_req.player_id THEN
      RAISE EXCEPTION 'Choose a different fill-in player' USING ERRCODE = '22023'; END IF;
    IF NOT (EXISTS (SELECT 1 FROM public.league_substitutes WHERE league_id = v_req.league_id AND season_id = v_req.season_id AND user_id = p_assigned_sub_id AND status = 'active')
      OR EXISTS (SELECT 1 FROM public.league_members WHERE league_id = v_req.league_id AND season_id = v_req.season_id AND user_id = p_assigned_sub_id AND status = 'active')) THEN
      RAISE EXCEPTION 'The fill-in must be an active substitute or member of this season' USING ERRCODE = '22023'; END IF;
    SELECT player_ids INTO v_order FROM public.ladder_snapshots WHERE season_id = v_req.season_id ORDER BY week_number DESC, batch_number DESC LIMIT 1;
    IF p_assigned_sub_id = ANY(COALESCE(v_order, ARRAY[]::uuid[])) THEN
      RAISE EXCEPTION 'That player is already on the ladder' USING ERRCODE = '22023'; END IF;
    IF EXISTS (SELECT 1 FROM public.ladder_sub_requests WHERE session_id = v_session
      AND ((status = 'sub' AND assigned_sub_id = p_assigned_sub_id)
        OR (player_id = p_assigned_sub_id AND status IN ('pending', 'sub', 'sitout'))))
      OR EXISTS (SELECT 1 FROM public.ladder_week_sitouts WHERE season_id = v_req.season_id AND week_number = v_req.week_number AND player_id = p_assigned_sub_id) THEN
      RAISE EXCEPTION 'That fill-in is absent or already covering another player this week' USING ERRCODE = '22023'; END IF;
  END IF;
  DELETE FROM public.ladder_week_sitouts WHERE season_id = v_req.season_id AND week_number = v_req.week_number AND player_id = v_req.player_id;
  IF p_resolution = 'sitout' THEN
    IF v_req.week_number < 2 THEN RAISE EXCEPTION 'Sit-outs open from Week 2' USING ERRCODE = '22023'; END IF;
    INSERT INTO public.ladder_week_sitouts (league_id, season_id, week_number, player_id, note, created_by)
      VALUES (v_req.league_id, v_req.season_id, v_req.week_number, v_req.player_id, NULLIF(trim(p_note), ''), v_user);
  END IF;
  UPDATE public.ladder_sub_requests SET status = p_resolution,
    assigned_sub_id = CASE WHEN p_resolution = 'sub' THEN p_assigned_sub_id END,
    resolution_note = NULLIF(trim(p_note), ''), resolved_by = v_user, resolved_at = now(), updated_at = now()
    WHERE id = p_request_id;
  IF v_req.player_id <> v_user THEN
    SELECT COALESCE(display_name, full_name, 'A substitute') INTO v_sub_name FROM public.profiles WHERE id = p_assigned_sub_id;
    PERFORM public.create_notification(v_req.player_id, 'league_sub_resolved', 'leagues',
      CASE p_resolution WHEN 'sub' THEN 'Substitute arranged' WHEN 'sitout' THEN 'Sit-out arranged' ELSE 'Sub request not arranged' END,
      CASE p_resolution WHEN 'sub' THEN COALESCE(v_sub_name, 'A substitute') || ' will cover Week ' || v_req.week_number || '. You keep your ladder position.'
        WHEN 'sitout' THEN 'You are sitting out Week ' || v_req.week_number || ' and keep your position.'
        ELSE 'Coverage was not arranged for Week ' || v_req.week_number || '. Check your league for the next step.' END,
      '/player/leagues/' || v_req.league_id || '?season=' || v_req.season_id,
      'normal', jsonb_build_object('request_id', p_request_id, 'season_id', v_req.season_id, 'resolution', p_resolution), v_user);
  END IF;
  INSERT INTO public.league_audit_log (league_id, season_id, actor_user_id, action, entity_type, entity_id, old_value, new_value)
    VALUES (v_req.league_id, v_req.season_id, v_user, 'ladder.sub_request_resolved', 'ladder_sub_request', p_request_id,
      jsonb_build_object('status', v_req.status), jsonb_build_object('week', v_req.week_number, 'resolution', p_resolution,
      'player_id', v_req.player_id, 'assigned_sub_id', CASE WHEN p_resolution = 'sub' THEN p_assigned_sub_id END));
  RETURN jsonb_build_object('request_id', p_request_id, 'resolution', p_resolution);
END; $$;

CREATE OR REPLACE FUNCTION public.cancel_ladder_sub_request(p_request_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_req record; v_session uuid; v_admin boolean;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000'; END IF;
  SELECT session_id INTO v_session FROM public.ladder_sub_requests WHERE id = p_request_id;
  PERFORM 1 FROM public.league_sessions WHERE id = v_session FOR UPDATE;
  SELECT * INTO v_req FROM public.ladder_sub_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found' USING ERRCODE = '02000'; END IF;
  v_admin := public.is_league_admin(v_req.league_id, v_user);
  IF v_req.player_id <> v_user AND NOT v_admin THEN
    RAISE EXCEPTION 'You can only cancel your own request' USING ERRCODE = '42501'; END IF;
  IF v_req.status = 'canceled' THEN RETURN; END IF;
  IF NOT v_admin AND v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'Your organizer has already handled this request. Contact them to change the arrangement.' USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM public.ladder_batches WHERE season_id = v_req.season_id AND week_number = v_req.week_number) THEN
    RAISE EXCEPTION 'The week is already drawn. Contact your organizer for a late replacement.' USING ERRCODE = '22023'; END IF;
  DELETE FROM public.ladder_week_sitouts WHERE season_id = v_req.season_id AND week_number = v_req.week_number AND player_id = v_req.player_id;
  UPDATE public.ladder_sub_requests SET status = 'canceled', assigned_sub_id = NULL, resolved_by = v_user, resolved_at = now(), updated_at = now() WHERE id = p_request_id;
  IF v_admin AND v_req.player_id <> v_user THEN
    PERFORM public.create_notification(v_req.player_id, 'league_sub_resolved', 'leagues', 'Sub arrangement canceled',
      'Your organizer canceled the request for Week ' || v_req.week_number || '. Check with them about your availability.',
      '/player/leagues/' || v_req.league_id || '?season=' || v_req.season_id, 'normal', jsonb_build_object('request_id', p_request_id), v_user);
  END IF;
  INSERT INTO public.league_audit_log (league_id, season_id, actor_user_id, action, entity_type, entity_id, old_value, new_value)
    VALUES (v_req.league_id, v_req.season_id, v_user, 'ladder.sub_request_canceled', 'ladder_sub_request', p_request_id,
      jsonb_build_object('status', v_req.status), jsonb_build_object('status', 'canceled', 'week', v_req.week_number));
END; $$;

-- Explicitly reopen an existing arrangement for review. Never resurrect a
-- player-canceled request, and never edit a roster already frozen into games.
CREATE OR REPLACE FUNCTION public.reopen_ladder_sub_request(p_request_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_req record; v_session uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000'; END IF;
  SELECT session_id INTO v_session FROM public.ladder_sub_requests WHERE id = p_request_id;
  PERFORM 1 FROM public.league_sessions WHERE id = v_session FOR UPDATE;
  SELECT * INTO v_req FROM public.ladder_sub_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found' USING ERRCODE = '02000'; END IF;
  IF NOT public.is_league_admin(v_req.league_id, v_user) THEN RAISE EXCEPTION 'League manager privileges required' USING ERRCODE = '42501'; END IF;
  IF v_req.status NOT IN ('sub', 'sitout', 'declined') THEN RAISE EXCEPTION 'Only a resolved request can be reopened' USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM public.ladder_batches WHERE season_id = v_req.season_id AND week_number = v_req.week_number) THEN
    RAISE EXCEPTION 'The week is already drawn. Use Substitutes to swap unplayed games.' USING ERRCODE = '22023'; END IF;
  DELETE FROM public.ladder_week_sitouts WHERE season_id = v_req.season_id AND week_number = v_req.week_number AND player_id = v_req.player_id;
  UPDATE public.ladder_sub_requests SET status = 'pending', assigned_sub_id = NULL,
    resolution_note = NULL, resolved_at = NULL, resolved_by = NULL, updated_at = now() WHERE id = p_request_id;
  IF v_req.player_id <> v_user THEN
    PERFORM public.create_notification(v_req.player_id, 'league_sub_resolved', 'leagues', 'Sub request back under review',
      'Your Week ' || v_req.week_number || ' arrangement is being changed. Coverage is not yet confirmed.',
      '/player/leagues/' || v_req.league_id || '?season=' || v_req.season_id, 'normal', jsonb_build_object('request_id', p_request_id), v_user);
  END IF;
  INSERT INTO public.league_audit_log (league_id, season_id, actor_user_id, action, entity_type, entity_id, old_value, new_value)
    VALUES (v_req.league_id, v_req.season_id, v_user, 'ladder.sub_request_reopened', 'ladder_sub_request', p_request_id,
      jsonb_build_object('status', v_req.status, 'assigned_sub_id', v_req.assigned_sub_id, 'resolution_note', v_req.resolution_note),
      jsonb_build_object('status', 'pending', 'week', v_req.week_number));
END; $$;

-- The edge function also checks pending requests, but a database guard closes
-- the gap between that read and creation of the actual draw. All three RPCs
-- above take this same session lock before testing or changing request state.
CREATE OR REPLACE FUNCTION public.guard_ladder_draw_requests() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM 1 FROM public.league_sessions WHERE season_id = NEW.season_id AND week_number = NEW.week_number FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.ladder_sub_requests WHERE season_id = NEW.season_id AND week_number = NEW.week_number AND status = 'pending') THEN
    RAISE EXCEPTION 'Resolve pending substitute requests before drawing this week' USING ERRCODE = '22023'; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_guard_ladder_draw_requests ON public.ladder_batches;
CREATE TRIGGER trg_guard_ladder_draw_requests BEFORE INSERT ON public.ladder_batches
  FOR EACH ROW EXECUTE FUNCTION public.guard_ladder_draw_requests();

REVOKE ALL ON FUNCTION public.request_ladder_sub(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resolve_ladder_sub_request(uuid, text, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_ladder_sub_request(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reopen_ladder_sub_request(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.guard_ladder_draw_requests() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_ladder_sub(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_ladder_sub_request(uuid, text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_ladder_sub_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reopen_ladder_sub_request(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
