BEGIN;
ALTER TABLE venue_entitlement_usage ADD COLUMN reversed_at timestamptz,ADD COLUMN reversal_reason text;
CREATE FUNCTION public.venue_player_missing_documents(p_venue uuid,p_user uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT count(*)::integer FROM venue_documents d WHERE d.venue_id=p_venue AND d.required AND d.retired_at IS NULL AND NOT EXISTS(
  SELECT 1 FROM venue_document_acceptances a JOIN venue_customers c ON c.id=a.customer_id WHERE a.document_id=d.id AND c.venue_id=p_venue AND c.user_id=p_user)
$$;
CREATE FUNCTION public.restore_venue_visit_pass(p_visit uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v venue_visits;returned numeric;
BEGIN
 SELECT * INTO v FROM venue_visits WHERE id=p_visit AND status='canceled' FOR UPDATE;
 IF NOT FOUND OR v.method<>'pass' THEN RETURN; END IF;
 UPDATE venue_entitlement_usage SET reversed_at=now(),reversal_reason=coalesce(v.canceled_reason,'Visit canceled') WHERE entitlement_id=v.entitlement_id AND request_key=v.request_key AND reversed_at IS NULL RETURNING units INTO returned;
 IF returned IS NOT NULL THEN UPDATE venue_entitlements SET remaining_units=remaining_units+returned WHERE id=v.entitlement_id; END IF;
END $$;
CREATE FUNCTION public.review_canceled_venue_visit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.status='canceled' AND OLD.status<>'canceled' THEN
  PERFORM restore_venue_visit_pass(NEW.id);
  UPDATE venue_sales SET needs_refund_review=true WHERE visit_id=NEW.id AND status IN ('paid','partially_refunded');
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER review_canceled_venue_visit AFTER UPDATE ON venue_visits FOR EACH ROW EXECUTE FUNCTION review_canceled_venue_visit();
CREATE FUNCTION public.sync_venue_walkin_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.parent_event_id IS NULL AND NEW.venue_id IS NOT NULL THEN
  IF NEW.canceled_at IS NOT NULL AND OLD.canceled_at IS NULL THEN
   UPDATE venue_visits SET status='canceled',canceled_reason='Venue canceled the event: '||coalesce(NEW.cancellation_reason,'See venue staff'),version=version+1 WHERE event_id=NEW.id AND status NOT IN ('canceled','expired');
  ELSIF (NEW.start_time,NEW.end_time,NEW.title) IS DISTINCT FROM (OLD.start_time,OLD.end_time,OLD.title) THEN
   UPDATE venue_visits SET start_time=NEW.start_time,end_time=NEW.end_time,title=NEW.title,version=version+1 WHERE event_id=NEW.id AND status NOT IN ('canceled','expired');
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER sync_venue_walkin_event AFTER UPDATE ON group_events FOR EACH ROW EXECUTE FUNCTION sync_venue_walkin_event();

ALTER FUNCTION public.get_venue_attendance_day(uuid,date) RENAME TO get_venue_attendance_day_before_walkins;
CREATE FUNCTION public.get_venue_attendance_day(p_group uuid,p_day date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;events jsonb:='[]';e jsonb;attendees jsonb;
BEGIN
 result:=get_venue_attendance_day_before_walkins(p_group,p_day);
 FOR e IN SELECT value FROM jsonb_array_elements(result->'events') LOOP
  SELECT coalesce(jsonb_agg(a||jsonb_build_object('missing_documents',venue_player_missing_documents((result->>'venue_id')::uuid,r.user_id))),'[]'::jsonb) INTO attendees
  FROM jsonb_array_elements(e->'attendees') a JOIN group_event_rsvps r ON r.id=(a->>'id')::uuid;
  attendees:=attendees||coalesce((SELECT jsonb_agg(jsonb_build_object('id',v.id,'name',split_part(c.first_name,' ',1)||CASE WHEN c.last_name<>'' THEN ' '||upper(left(c.last_name,1))||'.' ELSE '' END,
   'checked_in_at',v.checked_in_at,'no_show_at',v.no_show_at,'version',v.version,'walk_in',true,'missing_documents',venue_missing_documents(c.id)) ORDER BY c.first_name)
   FROM venue_visits v JOIN venue_customers c ON c.id=v.customer_id WHERE v.event_id=(e->>'id')::uuid AND v.status IN ('expected','checked_in','no_show')),'[]'::jsonb);
  events:=events||jsonb_build_array(e||jsonb_build_object('attendees',attendees));
 END LOOP;
 RETURN result||jsonb_build_object('events',events);
END $$;
ALTER FUNCTION public.close_venue_event_attendance(uuid,uuid[]) RENAME TO close_venue_event_attendance_before_walkins;
CREATE FUNCTION public.close_venue_event_attendance(p_event uuid,p_expected_ids uuid[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e group_events;actual uuid[];rsvps uuid[];counted integer;n integer;
BEGIN
 SELECT * INTO e FROM group_events WHERE id=p_event FOR UPDATE;
 IF NOT FOUND OR NOT can_record_venue_attendance(auth.uid(),e.venue_id,e.group_id) THEN RAISE EXCEPTION 'Venue attendance access required' USING ERRCODE='42501'; END IF;
 PERFORM id FROM venue_visits WHERE event_id=e.id ORDER BY id FOR UPDATE;
 SELECT coalesce(array_agg(id ORDER BY id),'{}'::uuid[]) INTO rsvps FROM group_event_rsvps WHERE event_id=e.id AND status='going' AND checked_in_at IS NULL AND no_show_at IS NULL;
 SELECT coalesce(array_agg(id ORDER BY id),'{}'::uuid[]) INTO actual FROM (SELECT unnest(rsvps) id UNION ALL SELECT id FROM venue_visits WHERE event_id=e.id AND status='expected') x;
 IF actual IS DISTINCT FROM (SELECT coalesce(array_agg(x ORDER BY x),'{}'::uuid[]) FROM unnest(p_expected_ids) x) THEN RAISE EXCEPTION 'Attendance changed on another desk. Refresh before closing attendance.' USING ERRCODE='40001'; END IF;
 counted:=close_venue_event_attendance_before_walkins(p_event,rsvps);
 UPDATE venue_visits SET status='no_show',no_show_at=now(),version=version+1 WHERE event_id=e.id AND status='expected';GET DIAGNOSTICS n=ROW_COUNT;
 RETURN counted+n;
END $$;
ALTER FUNCTION public.venue_customer_profile(uuid) RENAME TO venue_customer_profile_before_sales;
CREATE FUNCTION public.venue_customer_profile(p_customer uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;c venue_customers;
BEGIN
 result:=venue_customer_profile_before_sales(p_customer);
 SELECT * INTO c FROM venue_customers WHERE id=p_customer;
 RETURN result||jsonb_build_object('visits',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY start_time DESC) FROM (SELECT id,title,start_time,end_time,status,method,checked_in_at,no_show_at,canceled_reason FROM venue_visits WHERE customer_id=c.id ORDER BY start_time DESC LIMIT 200) x),'[]'::jsonb),
 'entitlements',coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY expires_at DESC) FROM venue_entitlements e WHERE customer_id=c.id),'[]'::jsonb),
 'purchases',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY created_at DESC) FROM (
  SELECT id,description,amount_cents,refunded_cents,status,created_at FROM payment_orders WHERE venue_id=c.venue_id AND buyer_id=c.user_id AND livemode AND kind<>'venue_sale'
  UNION ALL SELECT id,product_name,amount_cents,refunded_cents,status,created_at FROM venue_sales WHERE customer_id=c.id
  ORDER BY created_at DESC LIMIT 200) x),'[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION public.get_venue_program_availability(p_event uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE e group_events;
BEGIN
 SELECT * INTO e FROM group_events WHERE id=p_event AND parent_event_id IS NULL;
 IF auth.uid() IS NULL OR e.venue_id IS NULL OR NOT (public.is_group_member(auth.uid(),e.group_id) OR EXISTS(SELECT 1 FROM groups WHERE id=e.group_id AND visibility='public') OR public.can_manage_venue_events(auth.uid(),e.venue_id,e.group_id)) THEN RAISE EXCEPTION 'Event unavailable' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('pending_places',(SELECT count(*) FROM payment_orders WHERE program_event_id=e.id AND status='pending' AND livemode)+(SELECT count(*) FROM venue_visits WHERE event_id=e.id AND status='pending_payment'),
 'viewer_desk_registration',EXISTS(SELECT 1 FROM venue_visits vi JOIN venue_customers c ON c.id=vi.customer_id WHERE vi.event_id=e.id AND c.user_id=auth.uid() AND vi.status IN ('expected','checked_in','no_show')),
 'walk_in_places',(SELECT count(*) FROM venue_visits WHERE event_id=e.id AND status IN ('expected','checked_in','no_show')),
 'checkout_order_id',(SELECT id FROM payment_orders WHERE program_event_id=e.id AND buyer_id=auth.uid() AND status='pending' ORDER BY created_at DESC LIMIT 1));
END $$;
-- Preserve the invoker/RLS check for the existing public roster before exposing
-- the additional abbreviated desk roster. No contacts or customer IDs leave SQL.
ALTER FUNCTION public.get_venue_program_roster(uuid) RENAME TO get_venue_program_roster_before_walkins;
CREATE FUNCTION public.get_venue_program_roster(p_event_id uuid) RETURNS TABLE(name text)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
BEGIN
 RETURN QUERY SELECT r.name FROM get_venue_program_roster_before_walkins(p_event_id) r;
 RETURN QUERY SELECT r.name FROM get_venue_walkin_public_roster(p_event_id) r;
END $$;
CREATE FUNCTION public.get_venue_walkin_public_roster(p_event uuid) RETURNS TABLE(name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE e group_events;
BEGIN
 SELECT * INTO e FROM group_events WHERE id=p_event AND parent_event_id IS NULL;
 IF auth.uid() IS NULL OR NOT pulse_has_required_mfa() OR e.venue_id IS NULL OR NOT (is_group_member(auth.uid(),e.group_id) OR EXISTS(SELECT 1 FROM groups WHERE id=e.group_id AND visibility='public') OR can_manage_venue_events(auth.uid(),e.venue_id,e.group_id)) THEN RAISE EXCEPTION 'Event roster unavailable' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT CASE WHEN c.first_name LIKE '%@%' THEN 'Player' ELSE split_part(c.first_name,' ',1)||CASE WHEN c.last_name<>'' AND c.last_name NOT LIKE '%@%' THEN ' '||upper(left(c.last_name,1))||'.' ELSE '' END END
 FROM venue_visits v JOIN venue_customers c ON c.id=v.customer_id WHERE v.event_id=e.id AND v.status IN ('expected','checked_in','no_show') ORDER BY c.first_name,v.id;
END $$;

REVOKE ALL ON FUNCTION venue_player_missing_documents(uuid,uuid),restore_venue_visit_pass(uuid),review_canceled_venue_visit(),sync_venue_walkin_event(),get_venue_attendance_day_before_walkins(uuid,date),get_venue_attendance_day(uuid,date),close_venue_event_attendance_before_walkins(uuid,uuid[]),close_venue_event_attendance(uuid,uuid[]),venue_customer_profile_before_sales(uuid),venue_customer_profile(uuid),get_venue_program_roster(uuid),get_venue_walkin_public_roster(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION get_venue_attendance_day(uuid,date),close_venue_event_attendance(uuid,uuid[]),venue_customer_profile(uuid),get_venue_program_roster(uuid),get_venue_walkin_public_roster(uuid) TO authenticated;
-- The invoker wrapper needs this RLS-protected predecessor; it contains no guest records.
GRANT EXECUTE ON FUNCTION get_venue_program_roster_before_walkins(uuid) TO authenticated;
CREATE FUNCTION public.guard_venue_required_documents() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v uuid;
BEGIN
 IF TG_OP='UPDATE' AND (NEW.checked_in_at,NEW.status) IS NOT DISTINCT FROM (OLD.checked_in_at,OLD.status) THEN RETURN NEW; END IF;
 IF NEW.status='going' AND NEW.checked_in_at IS NOT NULL THEN
  SELECT venue_id INTO v FROM group_events WHERE id=NEW.event_id;
  IF v IS NOT NULL AND venue_player_missing_documents(v,NEW.user_id)>0 THEN RAISE EXCEPTION 'The player must acknowledge required venue documents before check-in'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_venue_required_documents BEFORE INSERT OR UPDATE ON group_event_rsvps FOR EACH ROW EXECUTE FUNCTION guard_venue_required_documents();
REVOKE ALL ON FUNCTION guard_venue_required_documents() FROM PUBLIC,anon,authenticated;
COMMIT;
