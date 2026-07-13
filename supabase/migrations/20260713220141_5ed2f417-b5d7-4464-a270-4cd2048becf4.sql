DO $$
DECLARE
  v_event uuid := '0db0448e-e09d-4ea2-8b59-16171251c1f5';
  v_kurt uuid := 'd591cefe-6925-4100-8643-3c41603e8953';
  v_court int;
BEGIN
  UPDATE public.round_robin_schedule SET a1_guest_id = v_kurt WHERE event_id=v_event AND round_no=3 AND court_no=3;
  UPDATE public.round_robin_schedule SET b2_guest_id = v_kurt WHERE event_id=v_event AND round_no=4 AND court_no=2;
  UPDATE public.round_robin_schedule SET a2_guest_id = v_kurt WHERE event_id=v_event AND round_no=5 AND court_no=2;
  UPDATE public.round_robin_schedule SET b2_guest_id = v_kurt WHERE event_id=v_event AND round_no=6 AND court_no=2;

  SELECT COALESCE(MAX(court_no),0)+1 INTO v_court FROM public.round_robin_schedule WHERE event_id=v_event AND round_no=2;
  INSERT INTO public.round_robin_schedule (event_id, round_no, court_no, a1_guest_id, is_bye)
  VALUES (v_event, 2, v_court, v_kurt, true);

  SELECT COALESCE(MAX(court_no),0)+1 INTO v_court FROM public.round_robin_schedule WHERE event_id=v_event AND round_no=7;
  INSERT INTO public.round_robin_schedule (event_id, round_no, court_no, a1_guest_id, is_bye)
  VALUES (v_event, 7, v_court, v_kurt, true);
END $$;