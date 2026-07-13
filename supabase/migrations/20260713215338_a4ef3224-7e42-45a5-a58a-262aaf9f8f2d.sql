DO $$
DECLARE
  v_event uuid := '0db0448e-e09d-4ea2-8b59-16171251c1f5';
  v_marty uuid := 'f878f00b-d102-4d74-87eb-9fd0063a2f09';
  v_bonnie uuid := '8be721e2-32a7-4b4b-87a2-addfb72c27de';
BEGIN
  -- Re-register Marty
  INSERT INTO public.round_robin_players (event_id, guest_player_id, registration_status)
  VALUES (v_event, v_marty, 'confirmed')
  ON CONFLICT DO NOTHING;

  -- Restore Marty's seats
  UPDATE public.round_robin_schedule SET a1_guest_id = v_marty WHERE event_id=v_event AND round_no=1 AND court_no=1;
  UPDATE public.round_robin_schedule SET b2_guest_id = v_marty WHERE event_id=v_event AND round_no=2 AND court_no=1;
  UPDATE public.round_robin_schedule SET a1_guest_id = v_marty WHERE event_id=v_event AND round_no=4 AND court_no=1;
  UPDATE public.round_robin_schedule SET a1_guest_id = v_marty WHERE event_id=v_event AND round_no=5 AND court_no=3;
  UPDATE public.round_robin_schedule SET b1_guest_id = v_marty WHERE event_id=v_event AND round_no=6 AND court_no=3;
  UPDATE public.round_robin_schedule SET a2_guest_id = v_marty WHERE event_id=v_event AND round_no=7 AND court_no=3;

  -- Restore Marty's Round 3 bye row (was auto-deleted)
  INSERT INTO public.round_robin_schedule (event_id, round_no, court_no, a1_guest_id, is_bye)
  VALUES (v_event, 3, 4, v_marty, true)
  ON CONFLICT DO NOTHING;

  -- Now actually remove Bonnie: null her seats
  UPDATE public.round_robin_schedule SET a1_guest_id = NULL WHERE event_id=v_event AND a1_guest_id = v_bonnie;
  UPDATE public.round_robin_schedule SET a2_guest_id = NULL WHERE event_id=v_event AND a2_guest_id = v_bonnie;
  UPDATE public.round_robin_schedule SET b1_guest_id = NULL WHERE event_id=v_event AND b1_guest_id = v_bonnie;
  UPDATE public.round_robin_schedule SET b2_guest_id = NULL WHERE event_id=v_event AND b2_guest_id = v_bonnie;

  -- Clean up any bye rows that are now empty
  DELETE FROM public.round_robin_schedule
  WHERE event_id = v_event AND is_bye = true
    AND a1_player_id IS NULL AND a1_guest_id IS NULL
    AND a2_player_id IS NULL AND a2_guest_id IS NULL
    AND b1_player_id IS NULL AND b1_guest_id IS NULL
    AND b2_player_id IS NULL AND b2_guest_id IS NULL;

  -- Remove Bonnie from event roster
  DELETE FROM public.round_robin_players
  WHERE event_id = v_event AND guest_player_id = v_bonnie;
END $$;