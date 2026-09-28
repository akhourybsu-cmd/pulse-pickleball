-- Assign the owner's imported November schedule to existing active courts.
-- Preserve court inventory, event IDs, registrations, times, and owner edits.
BEGIN;
DO $$
DECLARE
  v constant uuid := 'd99d7de3-2431-4ee2-a826-04cc293da1cd';
  g constant uuid := 'd5b47d17-d217-441a-a62a-bcdd87307d62';
  actor uuid; event public.group_events; required integer; selected uuid[]; court uuid;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.venues WHERE id=v) THEN RETURN; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('rally-haus-november-2026',0));
  SELECT created_by INTO actor FROM public.groups WHERE id=g AND venue_id=v AND type='venue_official' FOR UPDATE;
  IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.group_members
    WHERE group_id=g AND user_id=actor AND role='owner' AND status='active') THEN
    RAISE EXCEPTION 'Rally Haus allocations require its existing community owner';
  END IF;
  IF NOT public.venue_has_module(v,'facility_tools') THEN RAISE EXCEPTION 'Rally Haus facility tools must be active'; END IF;
  PERFORM id FROM public.venue_courts WHERE venue_id=v AND is_active IS TRUE ORDER BY id FOR UPDATE;
  IF (SELECT count(*) FROM public.venue_courts WHERE venue_id=v AND is_active IS TRUE)<4 THEN
    RAISE EXCEPTION 'The November schedule needs at least four existing active courts';
  END IF;
  CREATE TEMP TABLE rally_program_allocations ON COMMIT DROP AS
    SELECT e.* FROM public.group_events e
    JOIN unnest(ARRAY['mon-am','mon-clinic','mon-practice','mon-social','tue-am','tue-clinic','tue-lunch','tue-rr',
      'wed-am','wed-practice','wed-adults','wed-social','thu-am','thu-clinic','thu-practice','thu-rr',
      'fri-am','fri-clinic','fri-lunch','fri-social','sat-am','sat-clinic','sat-rr','sat-family',
      'sun-orientation','sun-practice','sun-rr','sun-mixer']) code
      ON e.id=md5('rally-haus-november-2026:'||code||':'||(e.start_time AT TIME ZONE 'America/New_York')::date::text)::uuid
    WHERE e.venue_id=v AND e.group_id=g AND e.parent_event_id IS NULL
      AND e.start_time>='2026-11-02 00:00 America/New_York'::timestamptz
      AND e.start_time<'2026-11-30 00:00 America/New_York'::timestamptz;
  IF (SELECT count(*) FROM rally_program_allocations)<>108 THEN RAISE EXCEPTION 'Expected the 108 imported November events'; END IF;
  FOR event IN SELECT * FROM rally_program_allocations ORDER BY start_time,id LOOP
    -- Never replace allocations subsequently chosen by the venue manager.
    IF event.venue_court_id IS NOT NULL OR EXISTS(SELECT 1 FROM public.group_events WHERE parent_event_id=event.id) THEN CONTINUE; END IF;
    required:=CASE event.event_format WHEN 'clinic' THEN 2 WHEN 'practice' THEN 3 WHEN 'other' THEN 1 ELSE 4 END;
    SELECT array_agg(id ORDER BY court_number,id) INTO selected FROM (
      SELECT c.id,c.court_number FROM public.venue_courts c WHERE c.venue_id=v AND c.is_active IS TRUE
        AND NOT EXISTS(SELECT 1 FROM public.group_events busy WHERE busy.venue_court_id=c.id
          AND busy.start_time<event.end_time AND event.start_time<busy.end_time)
      ORDER BY c.court_number,c.id LIMIT required
    ) available;
    IF coalesce(cardinality(selected),0)<>required THEN RAISE EXCEPTION 'Not enough free courts for % at %',event.title,event.start_time; END IF;
    FOREACH court IN ARRAY selected LOOP
      INSERT INTO public.group_events(id,group_id,venue_id,created_by,title,description,start_time,end_time,
        location_type,venue_court_id,parent_event_id,event_format,waitlist_enabled)
      VALUES(md5('rally-haus-court-block:'||event.id::text||':'||court::text)::uuid,g,v,actor,
        event.title,event.description,event.start_time,event.end_time,'venue',court,event.id,'program_hold',false);
    END LOOP;
  END LOOP;
  -- Programs use half-hour boundaries. Expose the 09:00–09:30 and other
  -- half-hour gaps without changing the owner's opening hours or court rates.
  UPDATE public.venues SET hours_of_operation=jsonb_set(hours_of_operation::jsonb,'{slotMinutes}','30'::jsonb)
    WHERE id=v AND hours_of_operation->>'slotMinutes'='60';
END $$;
COMMIT;
