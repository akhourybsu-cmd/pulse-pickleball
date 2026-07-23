
ALTER TABLE public.ladder_settings
  ADD COLUMN IF NOT EXISTS auto_advance BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS self_report_scoring BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.submit_league_match_score(
  p_match_id uuid, p_team_a_score integer, p_team_b_score integer)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_user           UUID := auth.uid();
  v_match          RECORD;
  v_self_report    BOOLEAN := false;
  v_scheduled_date DATE;
  v_start_time     TIME;
  v_scheduled_at   TIMESTAMPTZ;
  v_new_status     TEXT;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  IF p_team_a_score IS NULL OR p_team_b_score IS NULL
     OR p_team_a_score < 0 OR p_team_b_score < 0 THEN
    RAISE EXCEPTION 'Scores must be non-negative integers'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_match
    FROM public.league_matches WHERE id = p_match_id FOR UPDATE;
  IF v_match.id IS NULL THEN
    RAISE EXCEPTION 'Match not found' USING ERRCODE = '02000';
  END IF;

  IF NOT public.player_is_in_league_match(p_match_id) THEN
    RAISE EXCEPTION 'Only participants can submit scores'
      USING ERRCODE = '42501';
  END IF;

  IF v_match.status IN ('verified', 'canceled', 'forfeit') THEN
    RAISE EXCEPTION 'Match is already % — ask an admin to edit',
      v_match.status USING ERRCODE = '22023';
  END IF;

  -- Enforce scheduled start (safeguard for self-scoring): players
  -- cannot enter scores before the week's scheduled date/time.
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

  -- Self-report mode: for ladder seasons whose organizer allows it,
  -- a submitted score is finalized immediately (no peer confirmation).
  SELECT ls.self_report_scoring INTO v_self_report
    FROM public.ladder_settings ls
   WHERE ls.season_id = v_match.season_id;

  v_new_status := CASE
    WHEN COALESCE(v_self_report, false) THEN 'verified'
    ELSE 'score_submitted'
  END;

  UPDATE public.league_matches
     SET team_a_score       = p_team_a_score,
         team_b_score       = p_team_b_score,
         status             = v_new_status,
         score_submitted_by = v_user,
         score_submitted_at = NOW(),
         verified_by        = ARRAY[v_user]::UUID[],
         dispute_reason     = NULL,
         updated_at         = NOW()
   WHERE id = p_match_id;

  INSERT INTO public.league_audit_log
    (league_id, actor_user_id, action, entity_type, entity_id,
     old_value, new_value)
  VALUES (
    v_match.league_id, v_user,
    CASE WHEN v_new_status = 'verified'
         THEN 'match.self_reported'
         ELSE 'match.score_submitted' END,
    'league_match', p_match_id,
    jsonb_build_object(
      'previous_status', v_match.status,
      'previous_a', v_match.team_a_score,
      'previous_b', v_match.team_b_score
    ),
    jsonb_build_object(
      'team_a_score', p_team_a_score,
      'team_b_score', p_team_b_score,
      'self_reported', v_new_status = 'verified'
    )
  );
END;
$function$;
