-- Event administration preserves published history and uses the existing atomic
-- court allocator. Drafts do not reserve courts or appear on player calendars.
BEGIN;
ALTER TABLE public.group_events
  ADD COLUMN price_cents integer NOT NULL DEFAULT 0 CHECK(price_cents=0 OR price_cents BETWEEN 100 AND 99999999),
  ADD COLUMN currency text NOT NULL DEFAULT 'usd' CHECK(currency='usd'),
  ADD COLUMN registration_paused boolean NOT NULL DEFAULT false,
  ADD COLUMN registration_closes_at timestamptz,
  ADD COLUMN cancellation_policy text,
  ADD COLUMN canceled_at timestamptz,
  ADD COLUMN cancellation_reason text;
ALTER TABLE public.group_event_rsvps
  ADD COLUMN checked_in_at timestamptz,
  ADD COLUMN checked_in_by uuid REFERENCES auth.users(id);

CREATE FUNCTION public.can_manage_venue_events(p_user uuid,p_venue uuid,p_group uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT p_user IS NOT NULL AND EXISTS(
    SELECT 1 FROM groups g JOIN venues v ON v.id=g.venue_id
    WHERE g.id=p_group AND v.id=p_venue AND (
      v.owner_id=p_user OR EXISTS(SELECT 1 FROM group_members m WHERE m.group_id=g.id AND m.user_id=p_user AND m.role::text='owner' AND m.status='active')
      OR EXISTS(SELECT 1 FROM venue_staff s WHERE s.venue_id=v.id AND s.user_id=p_user AND s.role::text IN ('owner','manager','organizer') AND s.is_active IS NOT FALSE AND (s.status IS NULL OR s.status::text='active'))))
$$;
REVOKE ALL ON FUNCTION public.can_manage_venue_events(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_manage_venue_events(uuid,uuid,uuid) TO authenticated,service_role;

CREATE TABLE public.venue_event_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES public.venues(id),
  group_id uuid NOT NULL REFERENCES public.groups(id),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  document jsonb NOT NULL CHECK(jsonb_typeof(document)='object'),
  published_event_ids uuid[],
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.venue_event_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.venue_event_drafts FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.venue_event_drafts TO authenticated;
GRANT ALL ON public.venue_event_drafts TO service_role;
CREATE POLICY venue_event_draft_read ON public.venue_event_drafts FOR SELECT TO authenticated
  USING(public.can_manage_venue_events(auth.uid(),venue_id,group_id));
CREATE INDEX venue_event_drafts_scope ON public.venue_event_drafts(venue_id,group_id,updated_at DESC);

CREATE FUNCTION public.save_venue_event_draft(p_venue uuid,p_group uuid,p_id uuid,p_document jsonb,p_expected timestamptz DEFAULT NULL)
RETURNS public.venue_event_drafts LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d venue_event_drafts;
BEGIN
  IF NOT public.can_manage_venue_events(auth.uid(),p_venue,p_group) THEN RAISE EXCEPTION 'Venue event management access required' USING ERRCODE='42501'; END IF;
  IF jsonb_typeof(p_document) IS DISTINCT FROM 'object' OR octet_length(p_document::text)>65536
    OR length(trim(coalesce(p_document->>'title',''))) NOT BETWEEN 1 AND 150 THEN RAISE EXCEPTION 'Enter an event title of 1–150 characters'; END IF;
  IF p_id IS NULL THEN
    INSERT INTO venue_event_drafts(venue_id,group_id,created_by,document) VALUES(p_venue,p_group,auth.uid(),p_document) RETURNING * INTO d;
  ELSE
    SELECT * INTO d FROM venue_event_drafts WHERE id=p_id AND venue_id=p_venue AND group_id=p_group FOR UPDATE;
    IF NOT FOUND OR d.published_event_ids IS NOT NULL OR d.archived_at IS NOT NULL THEN RAISE EXCEPTION 'This draft is no longer editable'; END IF;
    IF d.updated_at IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'This draft changed. Reload it before saving.' USING ERRCODE='40001'; END IF;
    UPDATE venue_event_drafts SET document=p_document,updated_at=clock_timestamp() WHERE id=d.id RETURNING * INTO d;
  END IF;
  RETURN d;
END $$;

CREATE FUNCTION public.publish_venue_event_draft(p_id uuid,p_expected timestamptz)
RETURNS uuid[] LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d venue_event_drafts; e group_events; ids uuid[]:='{}'; courts uuid[]; rows jsonb; price integer; close_minutes integer;
BEGIN
  SELECT * INTO d FROM venue_event_drafts WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_manage_venue_events(auth.uid(),d.venue_id,d.group_id) THEN RAISE EXCEPTION 'Venue event management access required' USING ERRCODE='42501'; END IF;
  -- A lost publish response may safely be retried without duplicating the series.
  IF d.published_event_ids IS NOT NULL THEN RETURN d.published_event_ids; END IF;
  IF d.archived_at IS NOT NULL OR d.updated_at IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'This draft changed. Reload it before publishing.' USING ERRCODE='40001'; END IF;
  IF NOT public.venue_has_module(d.venue_id,'facility_tools') THEN RAISE EXCEPTION 'Enable facility operations to publish venue events'; END IF;
  SELECT array_agg(value::uuid) INTO courts FROM jsonb_array_elements_text(d.document->'court_ids');
  rows:=d.document->'occurrences';
  IF jsonb_typeof(rows) IS DISTINCT FROM 'array' OR jsonb_array_length(rows) NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'Choose 1–12 event dates'; END IF;
  price:=coalesce((d.document->>'price_cents')::integer,0);
  close_minutes:=coalesce((d.document->>'close_minutes')::integer,0);
  IF close_minutes NOT BETWEEN 0 AND 43200 THEN RAISE EXCEPTION 'Registration cutoff must be between 0 and 30 days before the event'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(rows) x WHERE (x->>'start_time')::timestamptz<=now()) THEN RAISE EXCEPTION 'Publish events with a future start time'; END IF;
  SELECT jsonb_agg((d.document - 'occurrences' - 'court_ids') || x || jsonb_build_object('series_id',CASE WHEN jsonb_array_length(rows)>1 THEN d.id ELSE NULL END,'is_recurring',jsonb_array_length(rows)>1)) INTO rows FROM jsonb_array_elements(rows) x;
  FOR e IN SELECT * FROM public.create_venue_program(d.group_id,d.venue_id,rows,courts) LOOP
    UPDATE group_events SET price_cents=price,currency='usd',registration_paused=coalesce((d.document->>'registration_paused')::boolean,false),
      registration_closes_at=e.start_time-close_minutes*interval '1 minute',cancellation_policy=nullif(trim(d.document->>'cancellation_policy'),'') WHERE id=e.id;
    ids:=array_append(ids,e.id);
  END LOOP;
  UPDATE venue_event_drafts SET published_event_ids=ids,updated_at=clock_timestamp() WHERE id=d.id;
  RETURN ids;
END $$;

CREATE FUNCTION public.archive_venue_event_draft(p_id uuid,p_expected timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d venue_event_drafts;
BEGIN
  SELECT * INTO d FROM venue_event_drafts WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_manage_venue_events(auth.uid(),d.venue_id,d.group_id) THEN RAISE EXCEPTION 'Venue event management access required' USING ERRCODE='42501'; END IF;
  IF d.published_event_ids IS NOT NULL OR d.updated_at IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'This draft changed. Reload it before archiving.' USING ERRCODE='40001'; END IF;
  UPDATE venue_event_drafts SET archived_at=now(),updated_at=clock_timestamp() WHERE id=d.id;
END $$;

CREATE FUNCTION public.update_venue_program(p_event uuid,p_changes jsonb,p_courts uuid[],p_expected timestamptz)
RETURNS public.group_events LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e group_events; proposed group_events; court uuid;
BEGIN
  SELECT * INTO e FROM group_events WHERE id=p_event AND parent_event_id IS NULL AND event_format IN ('open_play','clinic','practice','round_robin','social','other') FOR UPDATE;
  IF NOT FOUND OR NOT public.can_manage_venue_events(auth.uid(),e.venue_id,e.group_id) THEN RAISE EXCEPTION 'Venue event management access required' USING ERRCODE='42501'; END IF;
  IF e.updated_at IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'This event changed. Reload it before saving.' USING ERRCODE='40001'; END IF;
  IF e.canceled_at IS NOT NULL OR e.end_time<=now() THEN RAISE EXCEPTION 'Canceled or completed events are read-only'; END IF;
  IF NOT public.venue_has_module(e.venue_id,'facility_tools') THEN RAISE EXCEPTION 'Enable facility operations to change venue events'; END IF;
  IF p_courts IS NULL OR cardinality(p_courts) NOT BETWEEN 1 AND 100 OR cardinality(p_courts)<>(SELECT count(DISTINCT id) FROM unnest(p_courts) id) THEN RAISE EXCEPTION 'Choose distinct courts for this event'; END IF;
  PERFORM id FROM venue_courts WHERE id=ANY(p_courts) ORDER BY id FOR UPDATE;
  IF cardinality(p_courts)<>(SELECT count(*) FROM venue_courts WHERE id=ANY(p_courts) AND venue_id=e.venue_id AND is_active) THEN RAISE EXCEPTION 'Choose active courts belonging to this venue'; END IF;
  proposed:=jsonb_populate_record(e,p_changes);
  -- Remove only this event's old blocks; the deferred court invariant and
  -- exclusion constraint validate the complete replacement at commit.
  DELETE FROM group_events WHERE parent_event_id=e.id;
  UPDATE group_events SET title=trim(proposed.title),description=proposed.description,event_format=proposed.event_format,
    start_time=proposed.start_time,end_time=proposed.end_time,capacity=proposed.capacity,
    skill_level_min=proposed.skill_level_min,skill_level_max=proposed.skill_level_max,
    waitlist_enabled=proposed.waitlist_enabled,waitlist_limit=proposed.waitlist_limit,
    rotation_style=proposed.rotation_style,rr_courts=CASE WHEN proposed.event_format='round_robin' THEN cardinality(p_courts) END,
    price_cents=proposed.price_cents,registration_paused=proposed.registration_paused,
    registration_closes_at=proposed.registration_closes_at,cancellation_policy=proposed.cancellation_policy,
    updated_at=clock_timestamp() WHERE id=e.id RETURNING * INTO proposed;
  FOREACH court IN ARRAY p_courts LOOP
    INSERT INTO group_events(group_id,venue_id,created_by,title,description,start_time,end_time,location_type,venue_court_id,parent_event_id,event_format,waitlist_enabled)
      VALUES(e.group_id,e.venue_id,auth.uid(),proposed.title,proposed.description,proposed.start_time,proposed.end_time,'venue',court,e.id,'program_hold',false);
  END LOOP;
  RETURN proposed;
END $$;

CREATE FUNCTION public.set_venue_event_checkin(p_event uuid,p_rsvp uuid,p_checked boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e group_events;
BEGIN
  SELECT * INTO e FROM group_events WHERE id=p_event;
  IF NOT FOUND OR NOT public.can_manage_venue_events(auth.uid(),e.venue_id,e.group_id) THEN RAISE EXCEPTION 'Venue event management access required' USING ERRCODE='42501'; END IF;
  IF e.canceled_at IS NOT NULL THEN RAISE EXCEPTION 'This event was canceled'; END IF;
  UPDATE group_event_rsvps SET checked_in_at=CASE WHEN p_checked THEN now() END,checked_in_by=CASE WHEN p_checked THEN auth.uid() END
    WHERE id=p_rsvp AND event_id=e.id AND status='going';
  IF NOT FOUND THEN RAISE EXCEPTION 'Only confirmed attendees can be checked in'; END IF;
END $$;

REVOKE ALL ON FUNCTION public.save_venue_event_draft(uuid,uuid,uuid,jsonb,timestamptz),public.publish_venue_event_draft(uuid,timestamptz),public.archive_venue_event_draft(uuid,timestamptz),public.update_venue_program(uuid,jsonb,uuid[],timestamptz),public.set_venue_event_checkin(uuid,uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_venue_event_draft(uuid,uuid,uuid,jsonb,timestamptz),public.publish_venue_event_draft(uuid,timestamptz),public.archive_venue_event_draft(uuid,timestamptz),public.update_venue_program(uuid,jsonb,uuid[],timestamptz),public.set_venue_event_checkin(uuid,uuid,boolean) TO authenticated;
COMMIT;
