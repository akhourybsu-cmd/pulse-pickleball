DO $$
DECLARE
  v_event uuid := '0db0448e-e09d-4ea2-8b59-16171251c1f5';
  v_organizer uuid := 'fff594fe-02ea-439c-a974-72e1f6295f08';
  v_alex uuid := 'fff594fe-02ea-439c-a974-72e1f6295f08';
  v_tpereira uuid := '06d565bb-9fe7-406b-953a-7b45fe0b39d8';
  v_bonnie uuid := 'f878f00b-d102-4d74-87eb-9fd0063a2f09';
  v_john_g uuid := 'd287820c-4bda-4031-a398-cf7b7a03bea9';
  v_kurt uuid;
BEGIN
  -- 1. Create Kurt N guest owned by organizer
  INSERT INTO public.guest_players (display_name, created_by)
  VALUES ('Kurt N', v_organizer)
  RETURNING id INTO v_kurt;

  -- 2. Register Kurt N in the event
  INSERT INTO public.round_robin_players (event_id, guest_player_id, registration_status)
  VALUES (v_event, v_kurt, 'confirmed');

  -- 3. Update Round 1 Court 1: Marty & Kurt N vs John Brouwer & Arlene T
  UPDATE public.round_robin_schedule
  SET a2_guest_id  = v_kurt,           -- Bonnie -> Kurt N
      b1_player_id = NULL,             -- T Pereira out
      b1_guest_id  = v_john_g          -- John Brouwer in
  WHERE event_id = v_event AND round_no = 1 AND court_no = 1;

  -- 4. Remove the two bye rows (Alex and John Brouwer) from Round 1
  DELETE FROM public.round_robin_schedule
  WHERE event_id = v_event AND round_no = 1 AND court_no IN (4, 5);

  -- 5. Null out Alex / T Pereira / Bonnie seats across all remaining rounds
  UPDATE public.round_robin_schedule SET a1_player_id = NULL
    WHERE event_id = v_event AND a1_player_id IN (v_alex, v_tpereira);
  UPDATE public.round_robin_schedule SET a2_player_id = NULL
    WHERE event_id = v_event AND a2_player_id IN (v_alex, v_tpereira);
  UPDATE public.round_robin_schedule SET b1_player_id = NULL
    WHERE event_id = v_event AND b1_player_id IN (v_alex, v_tpereira);
  UPDATE public.round_robin_schedule SET b2_player_id = NULL
    WHERE event_id = v_event AND b2_player_id IN (v_alex, v_tpereira);

  UPDATE public.round_robin_schedule SET a1_guest_id = NULL
    WHERE event_id = v_event AND a1_guest_id = v_bonnie;
  UPDATE public.round_robin_schedule SET a2_guest_id = NULL
    WHERE event_id = v_event AND a2_guest_id = v_bonnie;
  UPDATE public.round_robin_schedule SET b1_guest_id = NULL
    WHERE event_id = v_event AND b1_guest_id = v_bonnie;
  UPDATE public.round_robin_schedule SET b2_guest_id = NULL
    WHERE event_id = v_event AND b2_guest_id = v_bonnie;

  -- Delete any pure-bye rows that are now empty
  DELETE FROM public.round_robin_schedule
  WHERE event_id = v_event
    AND is_bye = true
    AND a1_player_id IS NULL AND a1_guest_id IS NULL
    AND a2_player_id IS NULL AND a2_guest_id IS NULL
    AND b1_player_id IS NULL AND b1_guest_id IS NULL
    AND b2_player_id IS NULL AND b2_guest_id IS NULL;

  -- 6. Remove the three players from event registration
  DELETE FROM public.round_robin_players
  WHERE event_id = v_event
    AND (player_id IN (v_alex, v_tpereira) OR guest_player_id = v_bonnie);
END $$;