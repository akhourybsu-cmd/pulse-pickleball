DO $$
DECLARE
  v_event uuid := '0db0448e-e09d-4ea2-8b59-16171251c1f5';
  v_organizer uuid := 'fff594fe-02ea-439c-a974-72e1f6295f08';
  v_alex uuid := 'fff594fe-02ea-439c-a974-72e1f6295f08';
  v_kyle uuid;
  v_next_court int;
BEGIN
  -- Create Kyle N guest
  INSERT INTO public.guest_players (display_name, created_by)
  VALUES ('Kyle N', v_organizer)
  RETURNING id INTO v_kyle;

  -- Register Kyle and re-register Alex
  INSERT INTO public.round_robin_players (event_id, guest_player_id, registration_status)
  VALUES (v_event, v_kyle, 'confirmed') ON CONFLICT DO NOTHING;
  INSERT INTO public.round_robin_players (event_id, player_id, registration_status)
  VALUES (v_event, v_alex, 'confirmed') ON CONFLICT DO NOTHING;

  -- ROUND 1 BYES — pick next available court numbers
  SELECT COALESCE(MAX(court_no),0)+1 INTO v_next_court FROM public.round_robin_schedule WHERE event_id=v_event AND round_no=1;
  INSERT INTO public.round_robin_schedule (event_id, round_no, court_no, a1_player_id, is_bye)
  VALUES (v_event, 1, v_next_court, v_alex, true);

  SELECT COALESCE(MAX(court_no),0)+1 INTO v_next_court FROM public.round_robin_schedule WHERE event_id=v_event AND round_no=1;
  INSERT INTO public.round_robin_schedule (event_id, round_no, court_no, a1_guest_id, is_bye)
  VALUES (v_event, 1, v_next_court, v_kyle, true);

  -- KYLE R2 BYE
  SELECT COALESCE(MAX(court_no),0)+1 INTO v_next_court FROM public.round_robin_schedule WHERE event_id=v_event AND round_no=2;
  INSERT INTO public.round_robin_schedule (event_id, round_no, court_no, a1_guest_id, is_bye)
  VALUES (v_event, 2, v_next_court, v_kyle, true);

  -- ALEX back to his original seats (R2-R7)
  UPDATE public.round_robin_schedule SET a1_player_id = v_alex WHERE event_id=v_event AND round_no=2 AND court_no=2;
  UPDATE public.round_robin_schedule SET b1_player_id = v_alex WHERE event_id=v_event AND round_no=3 AND court_no=1;
  UPDATE public.round_robin_schedule SET b1_player_id = v_alex WHERE event_id=v_event AND round_no=4 AND court_no=1;
  UPDATE public.round_robin_schedule SET b1_player_id = v_alex WHERE event_id=v_event AND round_no=5 AND court_no=2;
  UPDATE public.round_robin_schedule SET b2_player_id = v_alex WHERE event_id=v_event AND round_no=6 AND court_no=3;
  UPDATE public.round_robin_schedule SET b2_player_id = v_alex WHERE event_id=v_event AND round_no=7 AND court_no=2;

  -- KYLE into Bonnie's old seats (R3-R7)
  UPDATE public.round_robin_schedule SET a1_guest_id = v_kyle WHERE event_id=v_event AND round_no=3 AND court_no=1;
  UPDATE public.round_robin_schedule SET b1_guest_id = v_kyle WHERE event_id=v_event AND round_no=4 AND court_no=2;
  UPDATE public.round_robin_schedule SET b2_guest_id = v_kyle WHERE event_id=v_event AND round_no=5 AND court_no=2;
  UPDATE public.round_robin_schedule SET a1_guest_id = v_kyle WHERE event_id=v_event AND round_no=6 AND court_no=3;
  UPDATE public.round_robin_schedule SET a2_guest_id = v_kyle WHERE event_id=v_event AND round_no=7 AND court_no=2;
END $$;