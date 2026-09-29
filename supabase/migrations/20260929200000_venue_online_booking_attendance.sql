BEGIN;
ALTER TABLE venue_visits ADD COLUMN reservation_id uuid UNIQUE REFERENCES group_events(id) ON DELETE SET NULL;
CREATE FUNCTION public.venue_project_court_visit(p_event group_events)
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
 ON CONFLICT(reservation_id) DO UPDATE SET title=excluded.title,start_time=excluded.start_time,end_time=excluded.end_time,version=venue_visits.version+1
 WHERE (venue_visits.title,venue_visits.start_time,venue_visits.end_time) IS DISTINCT FROM (excluded.title,excluded.start_time,excluded.end_time);
END $$;
CREATE FUNCTION public.sync_venue_online_visit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  UPDATE venue_visits SET status='canceled',canceled_reason='Court reservation canceled',version=version+1 WHERE reservation_id=OLD.id AND status NOT IN ('canceled','expired');RETURN OLD;
 ELSIF NEW.canceled_at IS NOT NULL THEN
  UPDATE venue_visits SET status='canceled',canceled_reason=coalesce(NEW.cancellation_reason,'Court reservation canceled'),version=version+1 WHERE reservation_id=NEW.id AND status NOT IN ('canceled','expired');
 ELSE PERFORM venue_project_court_visit(NEW);
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER sync_venue_online_visit AFTER INSERT OR UPDATE ON group_events FOR EACH ROW EXECUTE FUNCTION sync_venue_online_visit();
CREATE TRIGGER cancel_venue_online_visit BEFORE DELETE ON group_events FOR EACH ROW EXECUTE FUNCTION sync_venue_online_visit();
ALTER FUNCTION venue_visit_status(uuid,text,integer,text) RENAME TO venue_visit_status_before_online;
CREATE FUNCTION venue_visit_status(p_visit uuid,p_status text,p_expected integer,p_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v venue_visits;
BEGIN
 SELECT * INTO v FROM venue_visits WHERE id=p_visit FOR UPDATE;
 IF NOT FOUND OR NOT (venue_desk_access(v.venue_id) OR (p_status IN ('expected','checked_in','no_show') AND v.event_id IS NOT NULL AND can_record_venue_attendance(auth.uid(),v.venue_id,v.group_id))) THEN RAISE EXCEPTION 'Venue desk access required' USING ERRCODE='42501'; END IF;
 IF p_status='canceled' AND v.reservation_id IS NOT NULL THEN RAISE EXCEPTION 'Cancel this online court reservation from its original booking or Payments & purchases. Attendance does not cancel a paid reservation.'; END IF;
 PERFORM venue_visit_status_before_online(p_visit,p_status,p_expected,p_reason);
END $$;
-- Existing real reservations become visible at the desk and to their own player.
DO $$ DECLARE e group_events; BEGIN
 FOR e IN SELECT * FROM group_events WHERE venue_id IS NOT NULL AND event_format='reservation' AND venue_visit_id IS NULL AND venue_appointment_id IS NULL AND canceled_at IS NULL AND end_time>now()-interval '90 days' LOOP PERFORM venue_project_court_visit(e); END LOOP;
END $$;
REVOKE ALL ON FUNCTION venue_project_court_visit(group_events),sync_venue_online_visit(),venue_visit_status_before_online(uuid,text,integer,text),venue_visit_status(uuid,text,integer,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION venue_visit_status(uuid,text,integer,text) TO authenticated;
COMMIT;
