DO $$
DECLARE
  v_event uuid := '0db0448e-e09d-4ea2-8b59-16171251c1f5';
  v_kyle uuid := '954063c1-d1fb-428b-add3-88e5a4b608a5';
BEGIN
  UPDATE public.round_robin_schedule
  SET b2_guest_id = v_kyle
  WHERE event_id=v_event AND round_no=2 AND court_no=3;

  DELETE FROM public.round_robin_schedule
  WHERE event_id=v_event AND round_no=2 AND court_no=5 AND is_bye=true;
END $$;