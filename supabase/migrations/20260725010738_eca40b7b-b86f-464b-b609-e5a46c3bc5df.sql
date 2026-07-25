-- 1) swap_league_week_player: add optional p_batch_id to scope to one ladder batch.
CREATE OR REPLACE FUNCTION public.swap_league_week_player(
  p_league_id     UUID,
  p_season_id     UUID,
  p_out_player_id UUID,
  p_in_player_id  UUID,
  p_note          TEXT DEFAULT NULL,
  p_batch_id      UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user    UUID := auth.uid();
  v_is_sub  BOOLEAN;
  v_is_mem  BOOLEAN;
  v_m       RECORD;
  v_count   INT := 0;
  v_slot    TEXT;
  v_orig    UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  IF NOT public.is_league_admin(p_league_id, v_user) THEN
    RAISE EXCEPTION 'League admin privileges required' USING ERRCODE = '42501';
  END IF;
  IF p_out_player_id IS NULL OR p_in_player_id IS NULL THEN
    RAISE EXCEPTION 'Both players are required' USING ERRCODE = '22023';
  END IF;
  IF p_out_player_id = p_in_player_id THEN
    RAISE EXCEPTION 'Pick a different fill-in player' USING ERRCODE = '22023';
  END IF;

  IF p_batch_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.ladder_batches b
       WHERE b.id = p_batch_id
         AND b.league_id = p_league_id
         AND b.season_id = p_season_id
    ) THEN
      RAISE EXCEPTION 'Batch does not belong to this season' USING ERRCODE = '22023';
    END IF;
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.league_substitutes s
     WHERE s.league_id = p_league_id AND s.season_id = p_season_id
       AND s.user_id = p_in_player_id AND s.status = 'active') INTO v_is_sub;
  SELECT EXISTS (SELECT 1 FROM public.league_members m
     WHERE m.league_id = p_league_id AND m.season_id = p_season_id
       AND m.user_id = p_in_player_id AND m.status = 'active') INTO v_is_mem;
  IF NOT v_is_sub AND NOT v_is_mem THEN
    RAISE EXCEPTION 'The fill-in must be an active substitute or member of this season'
      USING ERRCODE = '22023';
  END IF;

  FOR v_m IN
    SELECT lm.* FROM public.league_matches lm
     WHERE lm.league_id = p_league_id AND lm.season_id = p_season_id
       AND lm.status IN ('scheduled', 'in_progress')
       AND p_out_player_id IN (lm.player_a_id, lm.player_b_id, lm.player_c_id, lm.player_d_id)
       AND (
         p_batch_id IS NULL
         OR lm.ladder_batch_group_id IN (
              SELECT g.id FROM public.ladder_batch_groups g WHERE g.batch_id = p_batch_id
            )
       )
     FOR UPDATE
  LOOP
    IF p_in_player_id IN (v_m.player_a_id, v_m.player_b_id, v_m.player_c_id, v_m.player_d_id) THEN
      RAISE EXCEPTION 'That player is already in one of these games — pick another fill-in'
        USING ERRCODE = '22023';
    END IF;

    v_slot := CASE p_out_player_id
      WHEN v_m.player_a_id THEN 'a' WHEN v_m.player_b_id THEN 'b'
      WHEN v_m.player_c_id THEN 'c' ELSE 'd' END;

    IF v_slot = 'a' THEN
      UPDATE public.league_matches SET player_a_id = p_in_player_id, updated_at = now() WHERE id = v_m.id;
    ELSIF v_slot = 'b' THEN
      UPDATE public.league_matches SET player_b_id = p_in_player_id, updated_at = now() WHERE id = v_m.id;
    ELSIF v_slot = 'c' THEN
      UPDATE public.league_matches SET player_c_id = p_in_player_id, updated_at = now() WHERE id = v_m.id;
    ELSE
      UPDATE public.league_matches SET player_d_id = p_in_player_id, updated_at = now() WHERE id = v_m.id;
    END IF;

    SELECT out_player_id INTO v_orig FROM public.league_match_substitutions
     WHERE match_id = v_m.id AND slot = v_slot;
    v_orig := COALESCE(v_orig, p_out_player_id);

    IF p_in_player_id = v_orig THEN
      DELETE FROM public.league_match_substitutions WHERE match_id = v_m.id AND slot = v_slot;
    ELSE
      INSERT INTO public.league_match_substitutions
        (league_id, season_id, match_id, slot, out_player_id, in_player_id, note, created_by)
      VALUES (p_league_id, p_season_id, v_m.id, v_slot, v_orig, p_in_player_id,
              NULLIF(TRIM(COALESCE(p_note, '')), ''), v_user)
      ON CONFLICT (match_id, slot) DO UPDATE
        SET in_player_id = EXCLUDED.in_player_id,
            out_player_id = EXCLUDED.out_player_id,
            note = EXCLUDED.note, updated_at = now();
    END IF;

    v_count := v_count + 1;
  END LOOP;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'That player has no upcoming games to fill in for' USING ERRCODE = '02000';
  END IF;

  INSERT INTO public.league_audit_log
    (league_id, season_id, actor_user_id, action, entity_type, entity_id, new_value)
  VALUES (
    p_league_id, p_season_id, v_user, 'league.week_player_swapped', 'league_season', p_season_id,
    jsonb_build_object('out_player_id', p_out_player_id, 'in_player_id', p_in_player_id,
                       'was_substitute', v_is_sub, 'games', v_count, 'batch_id', p_batch_id,
                       'note', COALESCE(NULLIF(TRIM(COALESCE(p_note, '')), ''), '(none)'))
  );

  RETURN jsonb_build_object('matches_updated', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.swap_league_week_player(UUID, UUID, UUID, UUID, TEXT, UUID) TO authenticated;

-- 2) submit_league_match_score: allow league admins to bypass participant + start-time gates.
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

  -- Enforce scheduled start only for non-admin (self-scoring) callers.
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