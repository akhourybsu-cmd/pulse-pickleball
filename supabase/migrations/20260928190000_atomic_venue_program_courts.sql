-- Programs and their physical court blocks commit together. The existing
-- exclusion constraint and checkout/payment guards remain the booking authority.
BEGIN;

CREATE FUNCTION public.create_venue_program(p_group uuid, p_venue uuid, p_events jsonb, p_court_ids uuid[])
RETURNS SETOF public.group_events
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE item jsonb; draft public.group_events; event public.group_events; court uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to schedule a program' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.groups WHERE id=p_group AND venue_id=p_venue) THEN
    RAISE EXCEPTION 'The program must belong to this venue community';
  END IF;
  IF jsonb_typeof(p_events) IS DISTINCT FROM 'array' OR jsonb_array_length(p_events) NOT BETWEEN 1 AND 12 THEN
    RAISE EXCEPTION 'Choose between 1 and 12 program dates';
  END IF;
  IF p_court_ids IS NULL OR cardinality(p_court_ids) NOT BETWEEN 1 AND 100
    OR cardinality(p_court_ids) <> (SELECT count(DISTINCT c) FROM unnest(p_court_ids) c) THEN
    RAISE EXCEPTION 'Choose at least one distinct court';
  END IF;
  -- Lock in a consistent order, also serializing with rental checkout.
  PERFORM id FROM public.venue_courts WHERE id=ANY(p_court_ids) ORDER BY id FOR UPDATE;
  IF cardinality(p_court_ids) <> (SELECT count(*) FROM public.venue_courts
    WHERE id=ANY(p_court_ids) AND venue_id=p_venue AND is_active IS TRUE) THEN
    RAISE EXCEPTION 'Choose active courts belonging to this venue';
  END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_events) LOOP
    draft := jsonb_populate_record(NULL::public.group_events, item);
    IF nullif(btrim(draft.title),'') IS NULL OR draft.event_format IS NULL
      OR draft.event_format NOT IN ('open_play','round_robin','practice','social','clinic','other') THEN
      RAISE EXCEPTION 'Choose a program name and format';
    END IF;
    IF draft.start_time IS NULL OR draft.end_time IS NULL
      OR NOT isfinite(draft.start_time) OR NOT isfinite(draft.end_time)
      OR draft.end_time<=draft.start_time OR draft.end_time>draft.start_time+interval '24 hours' THEN
      RAISE EXCEPTION 'Specify a positive program duration of at most 24 hours';
    END IF;
    INSERT INTO public.group_events(group_id,venue_id,created_by,title,description,start_time,end_time,
      location_type,custom_location,capacity,skill_level_min,skill_level_max,event_format,rotation_style,
      waitlist_enabled,waitlist_limit,rr_courts,rr_games_per_player,is_recurring,recurring_rule,series_id)
    VALUES(p_group,p_venue,auth.uid(),btrim(draft.title),draft.description,draft.start_time,draft.end_time,
      'venue',draft.custom_location,draft.capacity,draft.skill_level_min,draft.skill_level_max,draft.event_format,draft.rotation_style,
      coalesce(draft.waitlist_enabled,false),draft.waitlist_limit,
      CASE WHEN draft.event_format='round_robin' THEN cardinality(p_court_ids) END,draft.rr_games_per_player,
      coalesce(draft.is_recurring,false),draft.recurring_rule,draft.series_id)
    RETURNING * INTO event;
    FOREACH court IN ARRAY p_court_ids LOOP
      INSERT INTO public.group_events(group_id,venue_id,created_by,title,description,start_time,end_time,
        location_type,venue_court_id,parent_event_id,event_format,waitlist_enabled)
      VALUES(p_group,p_venue,auth.uid(),event.title,event.description,event.start_time,event.end_time,
        'venue',court,event.id,'program_hold',false);
    END LOOP;
    RETURN NEXT event;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.create_venue_program(uuid,uuid,jsonb,uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_venue_program(uuid,uuid,jsonb,uuid[]) TO authenticated;

-- Rescheduling an event moves its blocks in the same transaction. Any court
-- clash rolls the entire edit back. Deletion already cascades via the FK.
CREATE FUNCTION public.sync_venue_program_courts() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
  IF NEW.parent_event_id IS NULL AND (
    NEW.start_time IS DISTINCT FROM OLD.start_time OR NEW.end_time IS DISTINCT FROM OLD.end_time
    OR NEW.title IS DISTINCT FROM OLD.title OR NEW.description IS DISTINCT FROM OLD.description) THEN
    UPDATE public.group_events SET start_time=NEW.start_time,end_time=NEW.end_time,
      title=NEW.title,description=NEW.description
    WHERE parent_event_id=NEW.id AND event_format='program_hold';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER sync_venue_program_courts AFTER UPDATE ON public.group_events
  FOR EACH ROW EXECUTE FUNCTION public.sync_venue_program_courts();

-- Deferred validation permits parent-then-child inserts inside one transaction,
-- but prevents orphan programs, mismatched windows, or deleting the last block.
-- Existing untouched legacy listings are not retroactively invalidated.
CREATE FUNCTION public.check_venue_program_courts() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE target uuid; event public.group_events; old_parent uuid; new_parent uuid;
BEGIN
  IF TG_OP<>'INSERT' THEN old_parent:=OLD.parent_event_id; END IF;
  IF TG_OP<>'DELETE' THEN new_parent:=NEW.parent_event_id; END IF;
  FOR target IN SELECT DISTINCT id FROM unnest(ARRAY[coalesce(NEW.id,OLD.id),old_parent,new_parent]) id WHERE id IS NOT NULL LOOP
    SELECT * INTO event FROM public.group_events WHERE id=target;
    IF NOT FOUND THEN CONTINUE; END IF;
    IF EXISTS(SELECT 1 FROM public.group_events WHERE parent_event_id=event.id)
      AND (event.event_format NOT IN ('open_play','round_robin','practice','social','clinic','other')
        OR event.venue_id IS NULL OR event.venue_court_id IS NOT NULL OR event.parent_event_id IS NOT NULL) THEN
      RAISE EXCEPTION 'Court blocks require a public venue program';
    END IF;
    IF event.event_format='program_hold' THEN
      IF NOT EXISTS(SELECT 1 FROM public.group_events p WHERE p.id=event.parent_event_id
        AND p.venue_id=event.venue_id AND p.group_id=event.group_id
        AND p.start_time=event.start_time AND p.end_time=event.end_time
        AND p.parent_event_id IS NULL AND p.venue_court_id IS NULL
        AND p.event_format IN ('open_play','round_robin','practice','social','clinic','other')) THEN
        RAISE EXCEPTION 'Court blocks must match their venue program and full duration';
      END IF;
    ELSIF event.venue_id IS NOT NULL AND event.event_format IN ('open_play','round_robin','practice','social','clinic','other') THEN
      IF event.end_time IS NULL OR event.end_time<=event.start_time
        OR NOT isfinite(event.start_time) OR NOT isfinite(event.end_time) THEN
        RAISE EXCEPTION 'Venue programs require a positive duration';
      END IF;
      IF event.venue_court_id IS NULL AND NOT EXISTS(SELECT 1 FROM public.group_events h
        WHERE h.parent_event_id=event.id AND h.event_format='program_hold') THEN
        RAISE EXCEPTION 'Venue programs require dedicated courts; schedule the event and courts together';
      END IF;
      IF EXISTS(SELECT 1 FROM public.group_events h WHERE h.parent_event_id=event.id
        AND (h.event_format<>'program_hold' OR h.venue_id IS DISTINCT FROM event.venue_id
          OR h.group_id IS DISTINCT FROM event.group_id OR h.start_time IS DISTINCT FROM event.start_time
          OR h.end_time IS DISTINCT FROM event.end_time)) THEN
        RAISE EXCEPTION 'Court blocks must match their venue program and full duration';
      END IF;
    END IF;
  END LOOP;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER check_venue_program_courts AFTER INSERT OR UPDATE OR DELETE ON public.group_events
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.check_venue_program_courts();
COMMIT;
