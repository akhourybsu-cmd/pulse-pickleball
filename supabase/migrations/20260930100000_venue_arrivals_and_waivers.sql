BEGIN;

-- One waiver summary is shared by player records, arrivals and the player portal.
CREATE FUNCTION public.venue_waiver_summary(p_customer uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object(
  'required',count(*),'signed',count(a.document_id),'missing',count(*)-count(a.document_id),
  'status',CASE WHEN count(*)=0 THEN 'not_required' WHEN count(*)=count(a.document_id) THEN 'signed'
    WHEN EXISTS(SELECT 1 FROM venue_document_acceptances old WHERE old.customer_id=p_customer) THEN 'update_required' ELSE 'not_signed' END,
  'signed_at',max(a.accepted_at))
 FROM venue_customers c JOIN venue_documents d ON d.venue_id=c.venue_id AND d.required AND d.retired_at IS NULL
 LEFT JOIN venue_document_acceptances a ON a.customer_id=c.id AND a.document_id=d.id WHERE c.id=p_customer
$$;

ALTER FUNCTION venue_customer_directory(uuid,text,integer) RENAME TO venue_customer_directory_before_waivers;
CREATE FUNCTION public.venue_customer_directory(p_venue uuid,p_search text DEFAULT '',p_page integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
 result:=venue_customer_directory_before_waivers(p_venue,trim(coalesce(p_search,'')),p_page);
 RETURN result||jsonb_build_object('players',coalesce((SELECT jsonb_agg(c||jsonb_build_object(
  'waiver',venue_waiver_summary((c->>'id')::uuid),
  'last_visit',(SELECT max(x.start_time) FROM (
    SELECT start_time FROM venue_visits WHERE customer_id=(c->>'id')::uuid AND checked_in_at IS NOT NULL
    UNION ALL SELECT e.start_time FROM group_event_rsvps r JOIN group_events e ON e.id=r.event_id
      WHERE e.venue_id=p_venue AND r.user_id=(c->>'user_id')::uuid AND r.checked_in_at IS NOT NULL
  ) x))) FROM jsonb_array_elements(result->'players') c),'[]'::jsonb));
END $$;

ALTER FUNCTION venue_customer_profile(uuid) RENAME TO venue_customer_profile_before_waivers;
CREATE FUNCTION public.venue_customer_profile(p_customer uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
 result:=venue_customer_profile_before_waivers(p_customer);
 RETURN result||jsonb_build_object('waiver',venue_waiver_summary(p_customer));
END $$;

ALTER TABLE venue_visits ADD COLUMN party_booking_id uuid REFERENCES venue_visits(id);
ALTER TABLE venue_visits ADD COLUMN appointment_id uuid REFERENCES venue_appointments(id);
UPDATE venue_visits v SET appointment_id=a.id FROM venue_appointments a WHERE a.visit_id=v.id;
CREATE INDEX venue_visits_appointment ON venue_visits(appointment_id) WHERE appointment_id IS NOT NULL;
CREATE FUNCTION public.venue_link_appointment_visit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.visit_id IS NOT NULL THEN UPDATE venue_visits SET appointment_id=NEW.id WHERE id=NEW.visit_id AND appointment_id IS DISTINCT FROM NEW.id; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER venue_link_appointment_visit AFTER INSERT OR UPDATE OF visit_id ON venue_appointments
FOR EACH ROW EXECUTE FUNCTION venue_link_appointment_visit();

-- The same authenticated operations kiosk includes programs, online rentals,
-- desk rentals, private parties and lessons. A rental's customer data is staff-only.
ALTER FUNCTION get_venue_attendance_day(uuid,date) RENAME TO get_venue_attendance_day_before_rentals;
CREATE FUNCTION public.get_venue_attendance_day(p_group uuid,p_day date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;items jsonb:='[]';e jsonb;v uuid;from_time timestamptz;to_time timestamptz;desk boolean;
BEGIN
 result:=get_venue_attendance_day_before_rentals(p_group,p_day);
 v:=(result->>'venue_id')::uuid;desk:=venue_desk_access(v);
 IF desk THEN PERFORM venue_customer_sync(v); END IF;
 FOR e IN SELECT value FROM jsonb_array_elements(result->'events') LOOP
  items:=items||jsonb_build_array(e||jsonb_build_object('activity_kind','program','attendees',coalesce((
   SELECT jsonb_agg(a||jsonb_build_object('customer_id',CASE WHEN desk THEN c.id END,
    'waiver',CASE WHEN c.id IS NOT NULL THEN venue_waiver_summary(c.id) ELSE jsonb_build_object('missing',coalesce((a->>'missing_documents')::integer,0),'status',CASE WHEN coalesce((a->>'missing_documents')::integer,0)>0 THEN 'not_signed' ELSE 'not_required' END) END))
   FROM jsonb_array_elements(e->'attendees') a
   LEFT JOIN group_event_rsvps r ON r.id=(a->>'id')::uuid AND coalesce((a->>'walk_in')::boolean,false)=false
   LEFT JOIN venue_visits vi ON vi.id=(a->>'id')::uuid AND coalesce((a->>'walk_in')::boolean,false)
   LEFT JOIN venue_customers c ON c.venue_id=v AND (c.id=vi.customer_id OR c.user_id=r.user_id)
  ),'[]'::jsonb)));
 END LOOP;
 IF desk THEN
  from_time:=p_day::timestamp AT TIME ZONE (result->>'timezone');to_time:=(p_day+1)::timestamp AT TIME ZONE (result->>'timezone');
  items:=items||coalesce((SELECT jsonb_agg(activity ORDER BY start_time) FROM (
   SELECT min(vi.start_time) start_time,jsonb_build_object(
    'id',coalesce(vi.appointment_id,vi.reservation_id,vi.party_booking_id,vi.id),'activity_kind','rental',
    'title',min(vi.title),'event_format',coalesce(min(ap.kind),'reservation'),
    'start_time',min(vi.start_time),'end_time',max(vi.end_time),'canceled_at',NULL,'capacity',NULL,'waitlisted',0,
    'courts',coalesce((SELECT jsonb_agg(coalesce(c.name,'Court '||c.court_number) ORDER BY c.court_number) FROM venue_courts c
      WHERE c.id=ANY(coalesce((SELECT court_ids FROM venue_appointments WHERE id=vi.appointment_id),array_agg(vi.court_id)))),'[]'::jsonb),
    'attendees',jsonb_agg(jsonb_build_object('id',vi.id,'customer_id',c.id,'name',c.first_name||CASE WHEN c.last_name<>'' THEN ' '||left(c.last_name,1)||'.' ELSE '' END,
      'checked_in_at',vi.checked_in_at,'no_show_at',vi.no_show_at,'version',vi.version,'walk_in',true,
      'pending_payment',vi.status='pending_payment','missing_documents',venue_missing_documents(c.id),'waiver',venue_waiver_summary(c.id)) ORDER BY c.first_name,c.id)
   ) activity FROM venue_visits vi JOIN venue_customers c ON c.id=vi.customer_id LEFT JOIN venue_appointments ap ON ap.id=vi.appointment_id
   WHERE vi.venue_id=v AND vi.event_id IS NULL AND vi.status IN ('pending_payment','expected','checked_in','no_show') AND vi.start_time<to_time AND vi.end_time>from_time
   GROUP BY coalesce(vi.appointment_id,vi.reservation_id,vi.party_booking_id,vi.id),vi.appointment_id
  ) x),'[]'::jsonb);
 END IF;
 RETURN result||jsonb_build_object('events',coalesce((SELECT jsonb_agg(x ORDER BY x->>'start_time',x->>'id') FROM jsonb_array_elements(items) x),'[]'::jsonb));
END $$;

CREATE FUNCTION public.close_venue_arrival_attendance(p_venue uuid,p_activity uuid,p_expected_ids uuid[]) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actual uuid[];counted integer;ends timestamptz;
BEGIN
 IF NOT venue_desk_access(p_venue) THEN RAISE EXCEPTION 'Venue desk access required' USING ERRCODE='42501'; END IF;
 PERFORM id FROM venue_visits WHERE venue_id=p_venue AND event_id IS NULL AND coalesce(appointment_id,reservation_id,party_booking_id,id)=p_activity ORDER BY id FOR UPDATE;
 SELECT array_agg(id ORDER BY id),max(end_time) INTO actual,ends FROM venue_visits
  WHERE venue_id=p_venue AND event_id IS NULL AND coalesce(appointment_id,reservation_id,party_booking_id,id)=p_activity AND status='expected';
 IF ends IS NULL OR ends>now() THEN RAISE EXCEPTION 'Attendance can be closed after the booking ends'; END IF;
 IF actual IS DISTINCT FROM (SELECT array_agg(x ORDER BY x) FROM unnest(p_expected_ids) x) THEN RAISE EXCEPTION 'Attendance changed. Refresh before closing.' USING ERRCODE='40001'; END IF;
 UPDATE venue_visits SET status='no_show',no_show_at=now(),version=version+1 WHERE id=ANY(actual);GET DIAGNOSTICS counted=ROW_COUNT;
 RETURN counted;
END $$;

-- Notify each player once per current required document, with a second reminder
-- near arrival. Never send a waiver signed by somebody else on their behalf.
CREATE TABLE public.venue_waiver_reminders (
 customer_id uuid NOT NULL REFERENCES venue_customers(id),document_id uuid NOT NULL REFERENCES venue_documents(id),
 stage text NOT NULL CHECK(stage IN ('booking','arrival')),created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(customer_id,document_id,stage)
);
ALTER TABLE venue_waiver_reminders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON venue_waiver_reminders FROM PUBLIC,anon,authenticated;
GRANT ALL ON venue_waiver_reminders TO service_role;
CREATE FUNCTION public.venue_remind_missing_waivers(p_customer uuid,p_stage text DEFAULT 'booking') RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c venue_customers;d venue_documents;gid uuid;venue_name text;n integer;sent integer:=0;
BEGIN
 SELECT * INTO c FROM venue_customers WHERE id=p_customer;
 IF c.user_id IS NULL THEN RETURN 0; END IF;
 SELECT g.id,v.name INTO gid,venue_name FROM groups g JOIN venues v ON v.id=g.venue_id WHERE v.id=c.venue_id ORDER BY (g.type='venue_official') DESC,g.id LIMIT 1;
 FOR d IN SELECT doc.* FROM venue_documents doc WHERE doc.venue_id=c.venue_id AND doc.required AND doc.retired_at IS NULL
   AND NOT EXISTS(SELECT 1 FROM venue_document_acceptances a WHERE a.customer_id=c.id AND a.document_id=doc.id) LOOP
  INSERT INTO venue_waiver_reminders(customer_id,document_id,stage) VALUES(c.id,d.id,p_stage) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN
   PERFORM enqueue_notification(c.user_id,'group_event_new','community','Sign your venue waiver before arrival',
    venue_name||' needs your signature for '||d.title||' (version '||d.version||'). Open your visit to review and sign before you arrive.',
    '/player/community/group/'||gid::text||'/my-visit?venue='||c.venue_id::text,NULL,
    jsonb_build_object('venue_id',c.venue_id,'document_id',d.id,'waiver_required',true));
   sent:=sent+1;
  END IF;
 END LOOP;
 RETURN sent;
END $$;
CREATE FUNCTION public.venue_waiver_visit_reminder() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.status IN ('expected','checked_in') AND NEW.end_time>now() THEN PERFORM venue_remind_missing_waivers(NEW.customer_id); END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER venue_waiver_visit_reminder AFTER INSERT OR UPDATE OF status ON venue_visits FOR EACH ROW EXECUTE FUNCTION venue_waiver_visit_reminder();
CREATE FUNCTION public.venue_waiver_registration_reminder() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e group_events;c uuid;p record;
BEGIN
 SELECT * INTO e FROM group_events WHERE id=NEW.event_id;
 IF NEW.status<>'going' OR e.venue_id IS NULL OR e.end_time<=now() THEN RETURN NEW; END IF;
 SELECT * INTO p FROM profiles_public WHERE id=NEW.user_id;
 INSERT INTO venue_customers(venue_id,user_id,first_name,last_name,created_by)
 VALUES(e.venue_id,NEW.user_id,left(coalesce(nullif(trim(p.first_name),''),nullif(split_part(trim(p.full_name),' ',1),''),'Player'),80),left(coalesce(p.last_name,''),80),NEW.user_id)
 ON CONFLICT(venue_id,user_id) DO NOTHING;
 SELECT id INTO c FROM venue_customers WHERE venue_id=e.venue_id AND user_id=NEW.user_id;
 PERFORM venue_remind_missing_waivers(c);RETURN NEW;
END $$;
CREATE TRIGGER venue_waiver_registration_reminder AFTER INSERT OR UPDATE OF status ON group_event_rsvps FOR EACH ROW EXECUTE FUNCTION venue_waiver_registration_reminder();
ALTER FUNCTION venue_process_automations() RENAME TO venue_process_automations_before_waivers;
CREATE FUNCTION public.venue_process_automations() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE sent integer;c record;
BEGIN
 sent:=venue_process_automations_before_waivers();
 FOR c IN SELECT DISTINCT customer_id FROM (
   SELECT vi.customer_id FROM venue_visits vi WHERE vi.status='expected' AND vi.start_time>now() AND vi.start_time<=now()+interval '24 hours'
   UNION SELECT vc.id FROM group_event_rsvps r JOIN group_events e ON e.id=r.event_id JOIN venue_customers vc ON vc.venue_id=e.venue_id AND vc.user_id=r.user_id
    WHERE r.status='going' AND e.canceled_at IS NULL AND e.start_time>now() AND e.start_time<=now()+interval '24 hours'
  ) pending LOOP sent:=sent+venue_remind_missing_waivers(c.customer_id,'arrival'); END LOOP;
 RETURN sent;
END $$;

REVOKE ALL ON FUNCTION venue_waiver_summary(uuid),venue_customer_directory_before_waivers(uuid,text,integer),venue_customer_profile_before_waivers(uuid),
 get_venue_attendance_day_before_rentals(uuid,date),venue_link_appointment_visit(),venue_remind_missing_waivers(uuid,text),venue_waiver_visit_reminder(),venue_waiver_registration_reminder(),venue_process_automations_before_waivers() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION venue_customer_directory(uuid,text,integer),venue_customer_profile(uuid),get_venue_attendance_day(uuid,date),close_venue_arrival_attendance(uuid,uuid,uuid[]),venue_process_automations() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION venue_customer_directory(uuid,text,integer),venue_customer_profile(uuid),get_venue_attendance_day(uuid,date),close_venue_arrival_attendance(uuid,uuid,uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION venue_process_automations() TO service_role;
COMMIT;
