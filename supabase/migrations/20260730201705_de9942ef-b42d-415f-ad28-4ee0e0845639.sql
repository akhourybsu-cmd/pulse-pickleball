CREATE OR REPLACE FUNCTION public.submit_league_match_score(
  p_match_id     UUID,
  p_team_a_score INTEGER,
  p_team_b_score INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user           UUID := auth.uid();
  v_match          RECORD;
  v_self_report    BOOLEAN := false;
  v_scheduled_date DATE;
  v_start_time     TIME;
  v_scheduled_at   TIMESTAMPTZ;
  v_new_status     TEXT;
  v_is_admin       BOOLEAN := false;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  IF p_team_a_score IS NULL OR p_team_b_score IS NULL
     OR p_team_a_score < 0 OR p_team_b_score < 0 THEN
    RAISE EXCEPTION 'Scores must be non-negative integers'
      USING ERRCODE = '22023';
  END IF;
  IF p_team_a_score = p_team_b_score THEN
    RAISE EXCEPTION 'Scores can''t be tied' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_match
    FROM public.league_matches WHERE id = p_match_id FOR UPDATE;
  IF v_match.id IS NULL THEN
    RAISE EXCEPTION 'Match not found' USING ERRCODE = '02000';
  END IF;

  v_is_admin := public.is_league_admin(v_match.league_id, v_user);

  IF NOT v_is_admin AND NOT public.player_is_in_league_match(p_match_id) THEN
    RAISE EXCEPTION 'Only participants can submit scores'
      USING ERRCODE = '42501';
  END IF;

  IF v_match.status IN ('verified', 'canceled', 'forfeit') THEN
    RAISE EXCEPTION 'Match is already % — ask an admin to edit',
      v_match.status USING ERRCODE = '22023';
  END IF;

  IF NOT v_is_admin THEN
    IF v_match.session_id IS NOT NULL THEN
      SELECT scheduled_date, start_time
        INTO v_scheduled_date, v_start_time
        FROM public.league_sessions
       WHERE id = v_match.session_id;
      IF v_scheduled_date IS NOT NULL THEN
        v_scheduled_at :=
          (v_scheduled_date::timestamp + COALESCE(v_start_time, '00:00'::time))
          AT TIME ZONE 'UTC';
        IF NOW() < v_scheduled_at THEN
          RAISE EXCEPTION
            'Scores can''t be entered before the scheduled start (% %)',
            to_char(v_scheduled_date, 'Mon DD'),
            COALESCE(to_char(v_start_time, 'HH12:MI AM'), '')
            USING ERRCODE = '22023';
        END IF;
      END IF;
    ELSIF v_match.scheduled_time IS NOT NULL
          AND v_match.scheduled_time > NOW() THEN
      RAISE EXCEPTION
        'Scores can''t be entered before the scheduled start (%)',
        to_char(v_match.scheduled_time, 'Mon DD HH12:MI AM')
        USING ERRCODE = '22023';
    END IF;
  END IF;

  SELECT ls.self_report_scoring INTO v_self_report
    FROM public.ladder_settings ls
   WHERE ls.season_id = v_match.season_id;

  v_new_status := CASE
    WHEN v_is_admin OR COALESCE(v_self_report, false) THEN 'verified'
    ELSE 'score_submitted'
  END;

  UPDATE public.league_matches
     SET team_a_score       = p_team_a_score,
         team_b_score       = p_team_b_score,
         status             = v_new_status,
         score_submitted_by = v_user,
         score_submitted_at = NOW(),
         verified_by        = ARRAY[v_user]::UUID[],
         updated_at         = NOW()
   WHERE id = p_match_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_league_match_score(UUID, INTEGER, INTEGER) TO authenticated;