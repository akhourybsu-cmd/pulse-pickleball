BEGIN;

-- Keep the original columns for older clients; append session wall-clock values
-- so new clients display the same time as the league schedule.
DROP FUNCTION public.get_my_upcoming_league_matches(integer);
CREATE FUNCTION public.get_my_upcoming_league_matches(p_limit integer DEFAULT 3)
RETURNS TABLE (
  match_id uuid, league_id uuid, league_name text, league_type text,
  season_id uuid, season_name text, scheduled_time timestamptz,
  court_number integer, location text, status text,
  team_a_id uuid, team_a_name text, team_b_id uuid, team_b_name text,
  league_branding jsonb, has_match_time boolean, session_date date, session_start_time time
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.id, l.id, l.name, l.league_type::text, s.id, s.name,
    coalesce(m.scheduled_time, (ls.scheduled_date + coalesce(ls.start_time, '00:00'::time)) AT TIME ZONE 'UTC'),
    m.court_number, coalesce(nullif(ls.location, ''), l.location), m.status::text,
    m.team_a_id, coalesce(ta.name, nullif(concat_ws(' & ',
      coalesce(nullif(pa.display_name,''), nullif(pa.full_name,''), nullif(pa.first_name,'')),
      coalesce(nullif(pb.display_name,''), nullif(pb.full_name,''), nullif(pb.first_name,''))), '')),
    m.team_b_id, coalesce(tb.name, nullif(concat_ws(' & ',
      coalesce(nullif(pc.display_name,''), nullif(pc.full_name,''), nullif(pc.first_name,'')),
      coalesce(nullif(pd.display_name,''), nullif(pd.full_name,''), nullif(pd.first_name,''))), '')),
    l.branding, m.scheduled_time IS NOT NULL, ls.scheduled_date, ls.start_time
  FROM public.league_matches m
  JOIN public.leagues l ON l.id=m.league_id
  JOIN public.league_seasons s ON s.id=m.season_id
  LEFT JOIN public.league_sessions ls ON ls.id=m.session_id
  LEFT JOIN public.league_teams ta ON ta.id=m.team_a_id
  LEFT JOIN public.league_teams tb ON tb.id=m.team_b_id
  LEFT JOIN public.profiles pa ON pa.id=m.player_a_id
  LEFT JOIN public.profiles pb ON pb.id=m.player_b_id
  LEFT JOIN public.profiles pc ON pc.id=m.player_c_id
  LEFT JOIN public.profiles pd ON pd.id=m.player_d_id
  WHERE m.status IN ('scheduled','in_progress')
    AND public.player_is_in_league_match(m.id)
    AND (m.status='in_progress' OR m.scheduled_time >= now()
      OR (m.scheduled_time IS NULL AND ls.scheduled_date >= CURRENT_DATE))
  ORDER BY coalesce(m.scheduled_time,
    (ls.scheduled_date + coalesce(ls.start_time, '23:59:59'::time)) AT TIME ZONE 'UTC') ASC NULLS LAST, m.id
  LIMIT least(greatest(coalesce(p_limit,3),0),50);
$$;
REVOKE ALL ON FUNCTION public.get_my_upcoming_league_matches(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_upcoming_league_matches(integer) TO authenticated;

-- Notifications must open the season and section that contains their match.
CREATE OR REPLACE FUNCTION public.notify_league_match_state_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_recipient RECORD; v_league_name TEXT; v_actor_name TEXT; v_link TEXT;
        v_team_a_name TEXT; v_team_b_name TEXT; v_score TEXT; v_winner_team_name TEXT;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  SELECT name INTO v_league_name FROM public.leagues WHERE id = NEW.league_id;
  IF v_league_name IS NULL THEN RETURN NEW; END IF;
  v_link := '/player/leagues/' || NEW.league_id || '?season=' || NEW.season_id
    || CASE WHEN NEW.status IN ('verified','forfeit') THEN '#results' ELSE '#gameday' END;
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

COMMIT;
