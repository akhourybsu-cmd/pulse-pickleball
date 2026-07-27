-- =====================================================================
-- Sub-request follow-ups.
--
--  #14 resolve_ladder_sub_request notifies the REQUESTING PLAYER of the
--      outcome (sub arranged / sitting out / declined) — the reciprocal of
--      the organizer notification on request.
--  #6  unschedule_ladder_week: safely remove a not-yet-generated week's
--      session. It cancels + notifies that week's outstanding requests and
--      clears its sit-outs BEFORE deleting the session, so requests are
--      handled explicitly instead of vanishing via ON DELETE CASCADE.
-- =====================================================================

-- ---- #14: notify the requester on resolution ------------------------
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

  ELSE -- declined
    UPDATE public.ladder_sub_requests
       SET status = 'declined', assigned_sub_id = NULL,
           note = COALESCE(NULLIF(TRIM(COALESCE(p_note, '')), ''), note),
           resolved_by = v_user, resolved_at = now(), updated_at = now()
     WHERE id = p_request_id;
  END IF;

  -- Tell the requester what happened.
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

-- ---- #6: safe unschedule of a not-yet-generated week ----------------
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

  -- Can't unschedule a week that's already been generated.
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

  -- Notify players with an outstanding request, then cancel them (the
  -- session delete would cascade the rows away — do it explicitly so the
  -- requesters hear about it first).
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

  -- Clear this week's sit-outs (keyed by week_number, not FK-linked).
  DELETE FROM public.ladder_week_sitouts
   WHERE season_id = p_season_id AND week_number = p_week_number;

  -- Deleting the session cascades its ladder_sub_requests.
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
