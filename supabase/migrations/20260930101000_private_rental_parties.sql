BEGIN;
-- Rental titles must not be broadcast as community event announcements.
DROP TRIGGER IF EXISTS trg_notify_group_event_new ON group_events;
CREATE TRIGGER trg_notify_group_event_new AFTER INSERT ON group_events FOR EACH ROW
 WHEN (NEW.parent_event_id IS NULL AND NEW.event_format<>'program_hold' AND (NEW.venue_id IS NULL OR NEW.event_format<>'reservation')) EXECUTE FUNCTION notify_group_event_new();
ALTER TABLE venue_visits DROP CONSTRAINT venue_visits_reservation_id_key;
ALTER TABLE venue_visits ADD CONSTRAINT venue_visits_reservation_customer_key UNIQUE(reservation_id,customer_id);
CREATE UNIQUE INDEX venue_party_customer ON venue_visits(party_booking_id,customer_id) WHERE party_booking_id IS NOT NULL;
CREATE OR REPLACE FUNCTION public.venue_project_court_visit(p_event group_events)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE customer uuid;p record;o payment_orders;
BEGIN
 IF p_event.venue_id IS NULL OR p_event.venue_court_id IS NULL OR p_event.event_format<>'reservation' OR p_event.venue_visit_id IS NOT NULL OR p_event.venue_appointment_id IS NOT NULL OR p_event.canceled_at IS NOT NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_event.created_by) THEN RETURN; END IF;
 SELECT * INTO p FROM profiles_public WHERE id=p_event.created_by;
 INSERT INTO venue_customers(venue_id,user_id,first_name,last_name,created_by)
 VALUES(p_event.venue_id,p_event.created_by,left(coalesce(nullif(trim(p.first_name),''),nullif(split_part(trim(p.full_name),' ',1),''),'Player'),80),left(coalesce(nullif(trim(p.last_name),''),''),80),p_event.created_by)
 ON CONFLICT(venue_id,user_id) DO NOTHING;
 SELECT id INTO customer FROM venue_customers WHERE venue_id=p_event.venue_id AND user_id=p_event.created_by;
 SELECT * INTO o FROM payment_orders WHERE id=p_event.payment_order_id;
 INSERT INTO venue_visits(venue_id,customer_id,group_id,court_id,reservation_id,title,start_time,end_time,status,method,amount_cents,created_by,request_key)
 VALUES(p_event.venue_id,customer,p_event.group_id,p_event.venue_court_id,p_event.id,coalesce(p_event.title,'Court reservation'),p_event.start_time,p_event.end_time,'expected',CASE WHEN o.id IS NOT NULL THEN 'stripe' ELSE 'free' END,coalesce(o.amount_cents,0),p_event.created_by,p_event.id)
 ON CONFLICT(reservation_id,customer_id) DO UPDATE SET title=excluded.title,start_time=excluded.start_time,end_time=excluded.end_time,version=venue_visits.version+1
 WHERE (venue_visits.title,venue_visits.start_time,venue_visits.end_time) IS DISTINCT FROM (excluded.title,excluded.start_time,excluded.end_time);
END $$;

-- All rental types share the original lead visit as their party identifier.
CREATE FUNCTION venue_rental_lead(p_booking uuid) RETURNS venue_visits
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT v FROM venue_visits v WHERE v.event_id IS NULL AND v.party_booking_id IS NULL
 AND (v.id=p_booking OR v.reservation_id=p_booking OR v.appointment_id=p_booking)
 ORDER BY v.created_at LIMIT 1
$$;
CREATE FUNCTION venue_rental_access(p_booking uuid,p_manage boolean DEFAULT false) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE lead venue_visits;
BEGIN
 IF auth.uid() IS NULL OR NOT pulse_has_required_mfa() THEN RETURN false; END IF;
 lead:=venue_rental_lead(p_booking);
 RETURN lead.id IS NOT NULL AND (venue_desk_access(lead.venue_id) OR EXISTS(SELECT 1 FROM venue_customers WHERE id=lead.customer_id AND user_id=auth.uid())
 OR (NOT p_manage AND EXISTS(SELECT 1 FROM venue_visits v JOIN venue_customers c ON c.id=v.customer_id WHERE v.party_booking_id=lead.id AND c.user_id=auth.uid() AND v.status NOT IN ('canceled','expired'))));
END $$;
CREATE FUNCTION venue_rental_event_visible(p_event uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE e group_events;
BEGIN
 SELECT * INTO e FROM group_events WHERE id=p_event;
 RETURN auth.uid() IS NOT NULL AND pulse_has_required_mfa() AND
 ((e.venue_visit_id IS NULL AND e.venue_appointment_id IS NULL AND e.created_by=auth.uid()) OR venue_desk_access(e.venue_id) OR venue_rental_access(coalesce(e.venue_appointment_id,e.venue_visit_id,e.id)));
END $$;
CREATE POLICY private_rental_details ON group_events AS RESTRICTIVE FOR SELECT TO anon,authenticated
 USING(event_format IS DISTINCT FROM 'reservation' OR venue_id IS NULL OR venue_rental_event_visible(id));
CREATE POLICY rental_party_read ON group_events FOR SELECT TO authenticated
 USING(event_format='reservation' AND venue_id IS NOT NULL AND venue_rental_event_visible(id));

CREATE FUNCTION venue_calendar_sessions(p_venue uuid,p_from timestamptz,p_to timestamptz) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT pulse_has_required_mfa() OR p_to<=p_from OR p_to>p_from+interval '2 days'
 OR p_from IS NULL OR p_to IS NULL OR NOT isfinite(p_from) OR NOT isfinite(p_to)
 OR NOT can_access_private_venue(p_venue)
 OR NOT (venue_desk_access(p_venue) OR EXISTS(SELECT 1 FROM venues v JOIN groups g ON g.venue_id=v.id WHERE v.id=p_venue AND v.is_active AND (g.visibility='public' OR is_group_member(auth.uid(),g.id)))
 OR EXISTS(SELECT 1 FROM venue_visits vi JOIN venue_customers c ON c.id=vi.customer_id WHERE vi.venue_id=p_venue AND c.user_id=auth.uid() AND vi.status IN ('expected','checked_in','no_show')))
 THEN RAISE EXCEPTION 'Venue calendar unavailable' USING ERRCODE='42501'; END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object(
  'id',e.id,'group_id',e.group_id,'venue_court_id',e.venue_court_id,'start_time',e.start_time,'end_time',e.end_time,
  'event_format',e.event_format,'title',CASE WHEN visible THEN e.title ELSE 'Private booking' END,
  'description',CASE WHEN visible THEN e.description END,'created_by',CASE WHEN visible THEN e.created_by END,
  'capacity',CASE WHEN visible THEN e.capacity END,'waitlist_enabled',CASE WHEN visible THEN e.waitlist_enabled ELSE false END,
  'parent_event_id',e.parent_event_id,'rotation_style',CASE WHEN visible THEN e.rotation_style END,
  'skill_level_min',CASE WHEN visible THEN e.skill_level_min END,'skill_level_max',CASE WHEN visible THEN e.skill_level_max END,
  'rr_courts',CASE WHEN visible THEN e.rr_courts END,'price_cents',CASE WHEN visible THEN e.price_cents END,
  'currency',e.currency,'registration_paused',e.registration_paused,
  'venue_visit_id',CASE WHEN visible THEN e.venue_visit_id END,'venue_appointment_id',CASE WHEN visible THEN e.venue_appointment_id END,
  'private_booking',NOT visible) ORDER BY e.start_time)
 FROM group_events e CROSS JOIN LATERAL (SELECT (e.event_format IS DISTINCT FROM 'reservation' AND
 (is_group_member(auth.uid(),e.group_id) OR EXISTS(SELECT 1 FROM groups WHERE id=e.group_id AND visibility='public') OR venue_desk_access(p_venue)))
 OR (e.event_format='reservation' AND venue_rental_event_visible(e.id)) visible) scope
 WHERE e.venue_id=p_venue AND e.canceled_at IS NULL AND e.start_time<p_to AND coalesce(e.end_time,e.start_time+interval '1 hour')>p_from),'[]'::jsonb);
END $$;

CREATE FUNCTION venue_rental_party(p_booking uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE lead venue_visits;
BEGIN
 IF NOT venue_rental_access(p_booking) THEN RAISE EXCEPTION 'This private booking is unavailable' USING ERRCODE='42501'; END IF;
 lead:=venue_rental_lead(p_booking);
 RETURN jsonb_build_object('id',lead.id,'venue_id',lead.venue_id,'group_id',lead.group_id,'title',lead.title,
 'start_time',lead.start_time,'end_time',lead.end_time,'status',lead.status,'can_manage',venue_rental_access(p_booking,true),
 'members',coalesce((SELECT jsonb_agg(jsonb_build_object('id',v.id,'name',c.first_name||CASE WHEN c.last_name<>'' THEN ' '||left(c.last_name,1)||'.' ELSE '' END,
 'lead',v.id=lead.id,'is_you',c.user_id=auth.uid()) ORDER BY v.id=lead.id DESC,c.first_name)
 FROM venue_visits v JOIN venue_customers c ON c.id=v.customer_id WHERE (v.id=lead.id OR v.party_booking_id=lead.id) AND v.status NOT IN ('canceled','expired')),'[]'::jsonb));
END $$;
CREATE FUNCTION venue_rental_player_search(p_booking uuid,p_search text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT venue_rental_access(p_booking,true) THEN RAISE EXCEPTION 'Only the renter or venue desk can add players' USING ERRCODE='42501'; END IF;
 IF length(trim(p_search))<2 THEN RETURN '[]'; END IF;
 RETURN coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT id,coalesce(nullif(first_name,''),split_part(full_name,' ',1),'Player')||
 CASE WHEN coalesce(last_name,'')<>'' THEN ' '||left(last_name,1)||'.' ELSE '' END name
 FROM profiles_public WHERE concat_ws(' ',first_name,last_name,full_name) ILIKE '%'||left(trim(p_search),100)||'%' ORDER BY first_name,id LIMIT 20) x),'[]');
END $$;
CREATE FUNCTION venue_rental_party_add(p_booking uuid,p_user uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE lead venue_visits;c uuid;p record;added uuid;
BEGIN
 IF NOT venue_rental_access(p_booking,true) THEN RAISE EXCEPTION 'Only the renter or venue desk can add players' USING ERRCODE='42501'; END IF;
 lead:=venue_rental_lead(p_booking);SELECT * INTO lead FROM venue_visits WHERE id=lead.id FOR UPDATE;
 IF lead.status NOT IN ('expected','checked_in') OR lead.end_time<now() THEN RAISE EXCEPTION 'Players can be added to an active confirmed booking'; END IF;
 IF (SELECT count(*) FROM venue_visits WHERE party_booking_id=lead.id AND status NOT IN ('canceled','expired'))>=50 THEN RAISE EXCEPTION 'Contact the venue for parties larger than 50 players'; END IF;
 SELECT * INTO p FROM profiles_public WHERE id=p_user;
 IF NOT FOUND THEN RAISE EXCEPTION 'Choose an existing PULSE player'; END IF;
 INSERT INTO venue_customers(venue_id,user_id,first_name,last_name,created_by)
 VALUES(lead.venue_id,p_user,left(coalesce(nullif(p.first_name,''),nullif(split_part(p.full_name,' ',1),''),'Player'),80),left(coalesce(p.last_name,''),80),auth.uid()) ON CONFLICT(venue_id,user_id) DO NOTHING;
 SELECT id INTO c FROM venue_customers WHERE venue_id=lead.venue_id AND user_id=p_user;
 IF c=lead.customer_id THEN RETURN; END IF;
 INSERT INTO venue_visits(venue_id,customer_id,group_id,court_id,title,start_time,end_time,status,method,amount_cents,created_by,request_key,reservation_id,appointment_id,party_booking_id)
 VALUES(lead.venue_id,c,lead.group_id,lead.court_id,lead.title,lead.start_time,lead.end_time,'expected','free',0,auth.uid(),gen_random_uuid(),lead.reservation_id,lead.appointment_id,lead.id)
 ON CONFLICT(party_booking_id,customer_id) WHERE party_booking_id IS NOT NULL DO UPDATE SET title=excluded.title,start_time=excluded.start_time,end_time=excluded.end_time,court_id=excluded.court_id,appointment_id=excluded.appointment_id,status='expected',canceled_reason=NULL,checked_in_at=NULL,no_show_at=NULL,version=venue_visits.version+1
 WHERE venue_visits.status IN ('canceled','expired') RETURNING id INTO added;
 IF added IS NULL THEN RETURN; END IF;
 PERFORM enqueue_notification(p_user,'group_event_new','community','You were added to a private court booking',lead.title,
 '/player/community/group/'||lead.group_id||'/my-visit?venue='||lead.venue_id,NULL,jsonb_build_object('venue_id',lead.venue_id));
END $$;
CREATE FUNCTION venue_rental_party_remove(p_booking uuid,p_visit uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE lead venue_visits;
BEGIN
 IF NOT venue_rental_access(p_booking,true) THEN RAISE EXCEPTION 'Only the renter or venue desk can remove players' USING ERRCODE='42501'; END IF;
 lead:=venue_rental_lead(p_booking);SELECT * INTO lead FROM venue_visits WHERE id=lead.id FOR UPDATE;
 UPDATE venue_visits SET status='canceled',canceled_reason='Removed from rental party',version=version+1
 WHERE id=p_visit AND party_booking_id=lead.id AND status='expected';
 IF NOT FOUND THEN RAISE EXCEPTION 'Only an expected party member can be removed. Ask the venue to correct attendance.'; END IF;
END $$;
CREATE FUNCTION venue_sync_rental_party() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.party_booking_id IS NULL AND NEW.event_id IS NULL THEN
  UPDATE venue_visits SET title=NEW.title,start_time=NEW.start_time,end_time=NEW.end_time,court_id=NEW.court_id,appointment_id=NEW.appointment_id,
  status=CASE WHEN NEW.status IN ('canceled','expired') THEN NEW.status ELSE status END,
  canceled_reason=CASE WHEN NEW.status IN ('canceled','expired') THEN NEW.canceled_reason ELSE canceled_reason END,version=version+1
  WHERE party_booking_id=NEW.id AND status NOT IN ('canceled','expired');
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER venue_sync_rental_party AFTER UPDATE OF title,start_time,end_time,court_id,appointment_id,status ON venue_visits FOR EACH ROW EXECUTE FUNCTION venue_sync_rental_party();
CREATE FUNCTION venue_my_rental_parties(p_venue uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT pulse_has_required_mfa() THEN RAISE EXCEPTION 'Sign in to view your bookings' USING ERRCODE='42501'; END IF;
 RETURN coalesce((SELECT jsonb_agg(venue_rental_party(x.id) ORDER BY x.start_time) FROM (
 SELECT DISTINCT coalesce(v.party_booking_id,v.id) id, v.start_time FROM venue_visits v JOIN venue_customers c ON c.id=v.customer_id
 WHERE c.user_id=auth.uid() AND v.venue_id=p_venue AND v.event_id IS NULL AND v.status IN ('expected','checked_in','no_show') AND v.end_time>now()-interval '1 day') x),'[]');
END $$;
REVOKE ALL ON FUNCTION venue_rental_lead(uuid),venue_sync_rental_party(),venue_rental_access(uuid,boolean),venue_rental_event_visible(uuid),venue_calendar_sessions(uuid,timestamptz,timestamptz),venue_rental_party(uuid),venue_rental_player_search(uuid,text),venue_rental_party_add(uuid,uuid),venue_rental_party_remove(uuid,uuid),venue_my_rental_parties(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION venue_rental_event_visible(uuid) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION venue_calendar_sessions(uuid,timestamptz,timestamptz),venue_rental_party(uuid),venue_rental_player_search(uuid,text),venue_rental_party_add(uuid,uuid),venue_rental_party_remove(uuid,uuid),venue_my_rental_parties(uuid) TO authenticated;
COMMIT;
