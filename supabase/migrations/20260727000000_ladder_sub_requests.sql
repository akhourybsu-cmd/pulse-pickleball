-- =====================================================================
-- Player-requested subs + ladder week scheduling.
--
-- Players can request a sub for a specific (dated) upcoming week they
-- can't make. The organizer resolves each request while preparing that
-- week — either by FINDING A SUB (assign a specific fill-in; the absent
-- player keeps their ladder rung and the sub is seeded into their slots
-- at generation via the existing stand-in swap) or by SITTING THEM OUT
-- (removed from the week; feeds the divisible-by-four gate).
--
-- A "week" is a league_sessions row (its date/time/location) bound to a
-- ladder week_number. Organizers pre-schedule these week shells; future
-- weeks stay Scheduled — Not Generated until the prior week is processed.
-- =====================================================================

-- ---- 1) Bind sessions to ladder weeks + optional capacity -----------
ALTER TABLE public.league_sessions
  ADD COLUMN IF NOT EXISTS week_number INTEGER
    CHECK (week_number IS NULL OR week_number >= 1),
  ADD COLUMN IF NOT EXISTS capacity INTEGER
    CHECK (capacity IS NULL OR capacity >= 0);

-- One session per (season, week) for the ladder's scheduled weeks.
CREATE UNIQUE INDEX IF NOT EXISTS idx_league_sessions_season_week
  ON public.league_sessions(season_id, week_number)
  WHERE week_number IS NOT NULL;

-- ---- 2) Player sub-requests -----------------------------------------
CREATE TABLE IF NOT EXISTS public.ladder_sub_requests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id      UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  season_id      UUID NOT NULL REFERENCES public.league_seasons(id) ON DELETE CASCADE,
  session_id     UUID NOT NULL REFERENCES public.league_sessions(id) ON DELETE CASCADE,
  -- Denormalized from the session so generation/sit-out can key on it.
  week_number    INTEGER NOT NULL CHECK (week_number >= 1),
  player_id      UUID NOT NULL REFERENCES public.profiles(id),
  note           TEXT,
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','sub','sitout','declined','canceled')),
  -- The specific fill-in when status = 'sub'.
  assigned_sub_id UUID REFERENCES public.profiles(id),
  resolved_by    UUID REFERENCES public.profiles(id),
  resolved_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, player_id)
);
CREATE INDEX IF NOT EXISTS idx_ladder_sub_requests_season_week
  ON public.ladder_sub_requests(season_id, week_number);
CREATE INDEX IF NOT EXISTS idx_ladder_sub_requests_session
  ON public.ladder_sub_requests(session_id);

ALTER TABLE public.ladder_sub_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "League admins full access" ON public.ladder_sub_requests;
CREATE POLICY "League admins full access" ON public.ladder_sub_requests
  FOR ALL USING (public.is_league_admin(league_id, auth.uid()))
  WITH CHECK (public.is_league_admin(league_id, auth.uid()));

-- Members can read requests for leagues they're in (see their own state +
-- who's out this week). Not sensitive.
DROP POLICY IF EXISTS "Members read sub-requests of own leagues" ON public.ladder_sub_requests;
CREATE POLICY "Members read sub-requests of own leagues" ON public.ladder_sub_requests
  FOR SELECT USING (public.player_can_view_league(league_id));

-- ---- 3) Schedule (or reschedule) a ladder week shell ----------------
-- Upserts the league_sessions row bound to (season, week_number). One
-- scheduling system: this is the only way the ladder makes week sessions.
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

-- ---- 4) Player requests a sub for a scheduled week ------------------
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
  v_owner     UUID;
  v_req_id    UUID;
  v_name      TEXT;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT s.league_id, s.week_number
    INTO v_league_id, v_week
    FROM public.league_sessions s
   WHERE s.id = p_session_id AND s.season_id = p_season_id;
  IF v_league_id IS NULL THEN
    RAISE EXCEPTION 'That week could not be found' USING ERRCODE = '02000';
  END IF;
  IF v_week IS NULL THEN
    RAISE EXCEPTION 'That session is not a scheduled ladder week' USING ERRCODE = '22023';
  END IF;

  -- Must be an active member of the season.
  IF NOT EXISTS (
    SELECT 1 FROM public.league_members
     WHERE league_id = v_league_id AND season_id = p_season_id
       AND user_id = v_user AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Only active members can request a sub' USING ERRCODE = '42501';
  END IF;

  -- Requests are for weeks not yet generated. Once a week's batch exists the
  -- roster is set; a late drop is an organizer swap, not a request.
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
    SET status = 'pending',
        note = EXCLUDED.note,
        assigned_sub_id = NULL,
        resolved_by = NULL,
        resolved_at = NULL,
        updated_at = now()
  RETURNING id INTO v_req_id;

  -- Notify the organizer (league owner).
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

-- ---- 5) Player cancels their own pending request --------------------
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
  -- If the organizer had already sat them out, undo that too.
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

-- ---- 6) Organizer resolves a request --------------------------------
-- 'sub'      -> assign a specific fill-in (kept in the ladder; seeded at
--               generation via the stand-in swap).
-- 'sitout'   -> remove the player from the week (writes ladder_week_sitouts).
-- 'declined' -> the player must play; no change to the roster.
-- Re-resolving first clears the prior resolution's side effects.
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
  v_user UUID := auth.uid();
  v_req  RECORD;
  v_ok   BOOLEAN;
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

  -- Must resolve before the week is generated.
  IF EXISTS (
    SELECT 1 FROM public.ladder_batches
     WHERE season_id = v_req.season_id AND week_number = v_req.week_number
  ) THEN
    RAISE EXCEPTION 'Week % is already generated — use the per-week swap instead',
      v_req.week_number USING ERRCODE = '22023';
  END IF;

  -- Clear prior side-effects (a re-resolution).
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

    UPDATE public.ladder_sub_requests
       SET status = 'sub', assigned_sub_id = p_assigned_sub_id,
           note = COALESCE(NULLIF(TRIM(COALESCE(p_note, '')), ''), note),
           resolved_by = v_user, resolved_at = now(), updated_at = now()
     WHERE id = p_request_id;

  ELSIF p_resolution = 'sitout' THEN
    -- Only from week 2 (week 1 is the starting roster).
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
