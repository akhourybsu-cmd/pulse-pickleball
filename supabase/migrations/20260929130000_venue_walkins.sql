-- Desk visits use the same physical court inventory and event seat locks as online bookings.
BEGIN;
CREATE TABLE public.venue_visits (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),venue_id uuid NOT NULL REFERENCES venues(id),customer_id uuid NOT NULL,
 group_id uuid NOT NULL REFERENCES groups(id),event_id uuid REFERENCES group_events(id),court_id uuid REFERENCES venue_courts(id),
 title text NOT NULL,start_time timestamptz NOT NULL,end_time timestamptz NOT NULL,
 status text NOT NULL CHECK(status IN ('pending_payment','expected','checked_in','no_show','canceled','expired')),
 method text NOT NULL CHECK(method IN ('free','cash','stripe','pass')),amount_cents integer NOT NULL CHECK(amount_cents>=0),
 sale_id uuid UNIQUE REFERENCES venue_sales(id),entitlement_id uuid REFERENCES venue_entitlements(id),
 checked_in_at timestamptz,no_show_at timestamptz,version integer NOT NULL DEFAULT 0,
 created_by uuid NOT NULL REFERENCES auth.users(id),created_at timestamptz NOT NULL DEFAULT now(),request_key uuid NOT NULL,
 canceled_reason text,FOREIGN KEY(venue_id,customer_id) REFERENCES venue_customers(venue_id,id),UNIQUE(venue_id,request_key),UNIQUE(venue_id,id),
 CHECK((event_id IS NOT NULL)::integer+(court_id IS NOT NULL)::integer=1),CHECK(end_time>start_time)
);
CREATE INDEX venue_visits_event ON venue_visits(event_id,status);
CREATE INDEX venue_visits_day ON venue_visits(venue_id,start_time);
CREATE UNIQUE INDEX venue_visits_active_customer ON venue_visits(event_id,customer_id) WHERE status IN ('pending_payment','expected','checked_in','no_show');
ALTER TABLE group_events ADD COLUMN venue_visit_id uuid UNIQUE REFERENCES venue_visits(id);
ALTER TABLE venue_sales ADD COLUMN visit_id uuid UNIQUE REFERENCES venue_visits(id);
ALTER TABLE venue_sales ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE venue_sales ADD CONSTRAINT venue_sale_item_shape CHECK(product_id IS NOT NULL OR visit_id IS NOT NULL);
ALTER TABLE venue_sales DROP CONSTRAINT venue_sales_amount_cents_check;
ALTER TABLE venue_sales ADD CONSTRAINT venue_sales_amount_cents_check CHECK(amount_cents BETWEEN 50 AND 99999999);
CREATE TABLE public.venue_visit_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),venue_id uuid NOT NULL REFERENCES venues(id),visit_id uuid NOT NULL REFERENCES venue_visits(id),
 previous_status text NOT NULL,status text NOT NULL,actor_id uuid REFERENCES auth.users(id),changed_at timestamptz NOT NULL DEFAULT now()
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['venue_visits','venue_visit_audit'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
  EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
  EXECUTE format('CREATE POLICY pulse_required_mfa ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.pulse_has_required_mfa())) WITH CHECK ((SELECT public.pulse_has_required_mfa()))',t);
 END LOOP;
END $$;

CREATE FUNCTION public.venue_walkin_seats(p_event uuid) RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT count(*)::integer FROM venue_visits WHERE event_id=p_event AND status IN ('pending_payment','expected','checked_in','no_show')
$$;
CREATE FUNCTION public.venue_walkin_quote_internal(p_customer uuid,p_event uuid,p_court uuid,p_start timestamptz,p_end timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c venue_customers;e group_events;v venues;court venue_courts;gid uuid;amount integer;reserved integer;price jsonb;policy text;
BEGIN
 SELECT * INTO c FROM venue_customers WHERE id=p_customer;
 SELECT * INTO v FROM venues WHERE id=c.venue_id;
 IF v.id IS NULL OR v.is_active IS FALSE OR EXISTS(SELECT 1 FROM private_venue_sandboxes WHERE venue_id=v.id) THEN RAISE EXCEPTION 'Venue unavailable'; END IF;
 IF (p_event IS NOT NULL)::integer+(p_court IS NOT NULL)::integer<>1 THEN RAISE EXCEPTION 'Choose an event or a court reservation'; END IF;
 SELECT id INTO gid FROM groups WHERE venue_id=v.id ORDER BY id LIMIT 1;
 IF gid IS NULL THEN RAISE EXCEPTION 'Venue community unavailable'; END IF;
 SELECT cancellation_policy INTO policy FROM venue_payment_settings WHERE venue_id=v.id;
 IF p_event IS NOT NULL THEN
  SELECT * INTO e FROM group_events WHERE id=p_event AND venue_id=v.id AND parent_event_id IS NULL FOR UPDATE;
  IF NOT FOUND OR e.canceled_at IS NOT NULL OR e.registration_paused OR e.end_time<=now() OR e.event_format NOT IN ('open_play','clinic','practice','round_robin','social','other') THEN RAISE EXCEPTION 'This event is not accepting walk-ins'; END IF;
  IF EXISTS(SELECT 1 FROM group_event_rsvps WHERE event_id=e.id AND user_id=c.user_id AND status='going') THEN RAISE EXCEPTION 'This player is already registered. Use their existing check-in.'; END IF;
  IF EXISTS(SELECT 1 FROM payment_orders WHERE program_event_id=e.id AND buyer_id=c.user_id AND status='pending') THEN RAISE EXCEPTION 'This player has an active online checkout. Resolve it first.'; END IF;
  reserved:=venue_walkin_seats(e.id)+(SELECT count(*) FROM group_event_rsvps WHERE event_id=e.id AND status='going')+(SELECT count(*) FROM payment_orders WHERE program_event_id=e.id AND status='pending' AND livemode);
  IF reserved>=e.capacity THEN RAISE EXCEPTION 'This event has no available places'; END IF;
  RETURN jsonb_build_object('venue_id',v.id,'group_id',e.group_id,'title',e.title,'start_time',e.start_time,'end_time',e.end_time,'amount_cents',e.price_cents,'policy',coalesce(e.cancellation_policy,policy,''),'places_left',e.capacity-reserved);
 END IF;
 SELECT * INTO court FROM venue_courts WHERE id=p_court AND venue_id=v.id AND is_active FOR UPDATE;
 IF NOT FOUND OR NOT venue_has_module(v.id,'court_booking') THEN RAISE EXCEPTION 'Court booking unavailable'; END IF;
 price:=venue_court_pricing(court.id,p_start,p_end,c.id,true);
 IF EXISTS(SELECT 1 FROM group_events WHERE venue_court_id=court.id AND tstzrange(start_time,end_time,'[)')&&tstzrange(p_start,p_end,'[)'))
 OR EXISTS(SELECT 1 FROM payment_orders WHERE court_id=court.id AND livemode AND status='pending' AND tstzrange(start_time,end_time,'[)')&&tstzrange(p_start,p_end,'[)')) THEN RAISE EXCEPTION 'This court is already booked or held for checkout' USING ERRCODE='23P01'; END IF;
 RETURN price||jsonb_build_object('venue_id',v.id,'group_id',gid,'title',coalesce(court.name,'Court reservation'),'start_time',p_start,'end_time',p_end,'policy',coalesce(policy,''));
END $$;
CREATE FUNCTION public.venue_walkin_quote(p_customer uuid,p_event uuid,p_court uuid,p_start timestamptz,p_end timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v uuid;
BEGIN
 SELECT venue_id INTO v FROM venue_customers WHERE id=p_customer;
 IF NOT venue_desk_access(v) THEN RAISE EXCEPTION 'Venue desk access required' USING ERRCODE='42501'; END IF;
 RETURN venue_walkin_quote_internal(p_customer,p_event,p_court,p_start,p_end);
END $$;

CREATE FUNCTION public.venue_walkin_reserve_internal(p_actor uuid,p_customer uuid,p_event uuid,p_court uuid,p_start timestamptz,p_end timestamptz,p_method text,p_entitlement uuid,p_expected integer,p_request uuid)
RETURNS venue_visits LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c venue_customers;v venues;q jsonb;visit venue_visits;s venue_sales;ent venue_entitlements;needed numeric;
BEGIN
 SELECT * INTO c FROM venue_customers WHERE id=p_customer;
 SELECT * INTO v FROM venues WHERE id=c.venue_id;
 IF p_actor IS NULL OR NOT (v.owner_id=p_actor OR EXISTS(SELECT 1 FROM venue_staff WHERE venue_id=v.id AND user_id=p_actor AND is_active IS NOT FALSE AND (status IS NULL OR status::text='active') AND (role::text IN ('owner','manager') OR (role::text='staff' AND venue_has_module(v.id,'facility_tools'))))) THEN RAISE EXCEPTION 'Venue desk access required' USING ERRCODE='42501'; END IF;
 IF p_request IS NULL OR p_method IS NULL OR p_method NOT IN ('free','cash','stripe','pass') THEN RAISE EXCEPTION 'Choose a payment method'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(v.id::text||p_request::text,846));
 SELECT * INTO visit FROM venue_visits WHERE venue_id=v.id AND request_key=p_request;
 IF FOUND THEN
  IF (visit.customer_id,visit.event_id,visit.court_id,visit.method,visit.amount_cents,visit.entitlement_id) IS DISTINCT FROM (p_customer,p_event,p_court,p_method,p_expected,p_entitlement)
   OR (p_court IS NOT NULL AND (visit.start_time,visit.end_time) IS DISTINCT FROM (p_start,p_end)) THEN RAISE EXCEPTION 'Visit request changed. Review the booking again.'; END IF;
  RETURN visit;
 END IF;
 PERFORM id FROM venues WHERE id=v.id FOR UPDATE;
 q:=venue_walkin_quote_internal(p_customer,p_event,p_court,p_start,p_end);
 IF (q->>'amount_cents')::integer IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Price changed. Review the visit total again.'; END IF;
 IF p_method='free' AND p_expected<>0 THEN RAISE EXCEPTION 'This visit requires payment or an eligible pass'; END IF;
 IF p_method IN ('cash','stripe') AND p_expected<50 THEN RAISE EXCEPTION 'Use free admission for a zero-cost visit'; END IF;
 IF p_method='cash' AND EXISTS(SELECT 1 FROM venue_cash_closings WHERE venue_id=v.id AND day=(now() AT TIME ZONE coalesce(v.timezone,'America/New_York'))::date) THEN RAISE EXCEPTION 'The cash day is closed'; END IF;
 IF p_method IN ('cash','stripe') AND length(q->>'policy')<20 THEN RAISE EXCEPTION 'Save the venue payment policy before collecting payment'; END IF;
 IF p_method='pass' THEN
  SELECT * INTO ent FROM venue_entitlements WHERE id=p_entitlement AND customer_id=c.id AND venue_id=v.id FOR UPDATE;
  needed:=CASE WHEN p_court IS NOT NULL THEN extract(epoch FROM p_end-p_start)/3600 ELSE 1 END;
  IF NOT FOUND OR ent.revoked_at IS NOT NULL OR ent.expires_at<(q->>'end_time')::timestamptz OR ent.remaining_units<needed
   OR (p_court IS NOT NULL AND ent.kind<>'court_hours') OR (p_event IS NOT NULL AND ent.kind NOT IN ('visit_pass','guest_pass','lesson_pack'))
   OR (ent.kind='lesson_pack' AND NOT EXISTS(SELECT 1 FROM group_events WHERE id=p_event AND event_format='clinic')) THEN RAISE EXCEPTION 'Choose an eligible pass with enough units through the end of this visit'; END IF;
 ELSIF p_entitlement IS NOT NULL THEN RAISE EXCEPTION 'Select pass payment to use a pass'; END IF;
 INSERT INTO venue_visits(venue_id,customer_id,group_id,event_id,court_id,title,start_time,end_time,status,method,amount_cents,entitlement_id,created_by,request_key)
 VALUES(v.id,c.id,(q->>'group_id')::uuid,p_event,p_court,q->>'title',(q->>'start_time')::timestamptz,(q->>'end_time')::timestamptz,CASE WHEN p_method IN ('cash','stripe') THEN 'pending_payment' ELSE 'expected' END,p_method,p_expected,p_entitlement,p_actor,p_request) RETURNING * INTO visit;
 IF p_method='pass' THEN
  INSERT INTO venue_entitlement_usage(venue_id,entitlement_id,units,request_key,description,actor_id) VALUES(v.id,ent.id,needed,p_request,left(visit.title||' - '||visit.start_time::text,500),p_actor);
  UPDATE venue_entitlements SET remaining_units=remaining_units-needed WHERE id=ent.id;
 END IF;
 IF p_method IN ('cash','stripe') THEN
  INSERT INTO venue_sales(venue_id,customer_id,visit_id,product_name,product_kind,quantity,units,valid_days,member_discount_percent,amount_cents,method,billing_cadence,policy_snapshot,cashier_id,request_key)
  VALUES(v.id,c.id,visit.id,visit.title,CASE WHEN p_event IS NOT NULL THEN 'event_entry' ELSE 'court_rental' END,1,1,1,0,p_expected,p_method,'one_time',q->>'policy',p_actor,p_request) RETURNING * INTO s;
  UPDATE venue_visits SET sale_id=s.id WHERE id=visit.id RETURNING * INTO visit;
 END IF;
 IF p_court IS NOT NULL THEN
  INSERT INTO group_events(group_id,venue_id,venue_court_id,venue_visit_id,created_by,title,start_time,end_time,event_format,location_type)
  VALUES(visit.group_id,v.id,p_court,visit.id,p_actor,visit.title,visit.start_time,visit.end_time,'reservation','venue');
 END IF;
 RETURN visit;
END $$;

-- A desk allocation is accepted only when every ownership and time field matches
-- its private, already-authorized visit. The unique FK prevents allocation replay.
CREATE FUNCTION public.venue_visit_allocation_valid(p_event group_events)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM venue_visits v WHERE v.id=p_event.venue_visit_id AND v.status IN ('pending_payment','expected','checked_in','no_show')
  AND (v.venue_id,v.group_id,v.court_id,v.start_time,v.end_time,v.created_by)=(p_event.venue_id,p_event.group_id,p_event.venue_court_id,p_event.start_time,p_event.end_time,p_event.created_by)
  AND p_event.event_format='reservation' AND p_event.parent_event_id IS NULL)
$$;
CREATE FUNCTION public.guard_venue_visit_allocation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  IF OLD.venue_visit_id IS NOT NULL AND EXISTS(SELECT 1 FROM venue_visits WHERE id=OLD.venue_visit_id AND status NOT IN ('canceled','expired')) THEN RAISE EXCEPTION 'Cancel this desk visit from Front desk to preserve payment and attendance history'; END IF;
  RETURN OLD;
 END IF;
 IF TG_OP='UPDATE' AND NEW.venue_visit_id IS DISTINCT FROM OLD.venue_visit_id THEN RAISE EXCEPTION 'Desk allocations cannot be reassigned'; END IF;
 IF NEW.venue_visit_id IS NOT NULL AND NOT venue_visit_allocation_valid(NEW) THEN RAISE EXCEPTION 'Desk allocation does not match its authorized visit'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_venue_visit_allocation BEFORE INSERT OR UPDATE OR DELETE ON group_events FOR EACH ROW EXECUTE FUNCTION guard_venue_visit_allocation();

ALTER FUNCTION venue_sale_fulfill(uuid,timestamptz) RENAME TO venue_sale_fulfill_before_visits;
CREATE FUNCTION venue_sale_fulfill(p_sale uuid,p_through timestamptz DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE visit venue_visits;
BEGIN
 PERFORM venue_sale_fulfill_before_visits(p_sale,p_through);
 SELECT v.* INTO visit FROM venue_visits v JOIN venue_sales s ON s.visit_id=v.id WHERE s.id=p_sale AND s.status='paid' FOR UPDATE OF v;
 IF FOUND AND visit.status IN ('canceled','expired') THEN UPDATE venue_sales SET needs_refund_review=true WHERE id=p_sale;
 ELSIF FOUND AND visit.status='pending_payment' THEN
  IF visit.end_time<=now() OR EXISTS(SELECT 1 FROM group_events WHERE id=visit.event_id AND canceled_at IS NOT NULL) THEN
   UPDATE venue_visits SET status='canceled',canceled_reason='Payment completed after the visit ended or was canceled. Review this payment for a refund.',version=version+1 WHERE id=visit.id;
   DELETE FROM group_events WHERE venue_visit_id=visit.id;
  ELSE UPDATE venue_visits SET status='expected',version=version+1 WHERE id=visit.id; END IF;
 END IF;
END $$;
CREATE FUNCTION public.venue_walkin_book(p_customer uuid,p_event uuid,p_court uuid,p_start timestamptz,p_end timestamptz,p_method text,p_entitlement uuid,p_expected integer,p_request uuid,p_cash_received boolean DEFAULT false)
RETURNS venue_visits LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE visit venue_visits;v uuid;
BEGIN
 SELECT venue_id INTO v FROM venue_customers WHERE id=p_customer;
 IF NOT venue_desk_access(v) THEN RAISE EXCEPTION 'Venue desk access required' USING ERRCODE='42501'; END IF;
 IF p_method='stripe' THEN RAISE EXCEPTION 'Use secure checkout for card payment'; END IF;
 IF p_method='cash' AND p_cash_received IS DISTINCT FROM true THEN RAISE EXCEPTION 'Confirm cash received before recording payment'; END IF;
 visit:=venue_walkin_reserve_internal(auth.uid(),p_customer,p_event,p_court,p_start,p_end,p_method,p_entitlement,p_expected,p_request);
 IF visit.method='cash' THEN PERFORM venue_sale_fulfill(visit.sale_id); SELECT * INTO visit FROM venue_visits WHERE id=visit.id; END IF;
 RETURN visit;
END $$;
CREATE FUNCTION public.payment_reserve_venue_walkin(p_actor uuid,p_customer uuid,p_event uuid,p_court uuid,p_start timestamptz,p_end timestamptz,p_expected integer,p_request uuid,p_live boolean)
RETURNS payment_orders LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE visit venue_visits;c venue_customers;v venues;a venue_payment_accounts;s venue_sales;o payment_orders;
BEGIN
 visit:=venue_walkin_reserve_internal(p_actor,p_customer,p_event,p_court,p_start,p_end,'stripe',NULL,p_expected,p_request);
 SELECT * INTO s FROM venue_sales WHERE id=visit.sale_id;
 IF s.payment_order_id IS NOT NULL THEN SELECT * INTO o FROM payment_orders WHERE id=s.payment_order_id; RETURN o; END IF;
 SELECT * INTO v FROM venues WHERE id=visit.venue_id;
 SELECT * INTO c FROM venue_customers WHERE id=visit.customer_id;
 SELECT * INTO a FROM venue_payment_accounts WHERE venue_id=v.id AND livemode AND connected_by=v.owner_id AND disconnected_at IS NULL AND charges_enabled AND payouts_enabled AND card_payments_active AND disabled_reason IS NULL;
 IF NOT FOUND OR p_live IS DISTINCT FROM true OR NOT payment_venue_owner_eligible(v.id,v.owner_id,true) THEN RAISE EXCEPTION 'Complete live venue Stripe verification before collecting card payments'; END IF;
 INSERT INTO payment_orders(buyer_id,venue_id,kind,venue_sale_id,description,merchant_name,account_id,livemode,amount_cents,billing_cadence,policy_snapshot,request_key)
 VALUES(c.user_id,v.id,'venue_sale',s.id,s.product_name,v.name,a.account_id,true,s.amount_cents,'one_time',s.policy_snapshot,p_request) RETURNING * INTO o;
 UPDATE venue_sales SET payment_order_id=o.id WHERE id=s.id;
 RETURN o;
END $$;

CREATE FUNCTION public.venue_visit_status(p_visit uuid,p_status text,p_expected integer,p_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v venue_visits;
BEGIN
 SELECT * INTO v FROM venue_visits WHERE id=p_visit FOR UPDATE;
 IF NOT FOUND OR NOT (venue_desk_access(v.venue_id) OR (p_status IN ('expected','checked_in','no_show') AND v.event_id IS NOT NULL AND can_record_venue_attendance(auth.uid(),v.venue_id,v.group_id))) THEN RAISE EXCEPTION 'Venue desk access required' USING ERRCODE='42501'; END IF;
 IF v.version IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Visit changed on another desk. Refresh before continuing.' USING ERRCODE='40001'; END IF;
 IF v.status IN ('canceled','expired','pending_payment') THEN RAISE EXCEPTION 'Resolve payment before changing this visit'; END IF;
 IF p_status IS NULL OR p_status NOT IN ('expected','checked_in','no_show','canceled') THEN RAISE EXCEPTION 'Choose a valid visit status'; END IF;
 IF p_status='checked_in' AND venue_missing_documents(v.customer_id)>0 THEN RAISE EXCEPTION 'The player must acknowledge required venue documents before check-in'; END IF;
 IF p_status='no_show' AND v.end_time>now() THEN RAISE EXCEPTION 'Record no-shows after the visit ends'; END IF;
 IF p_status='canceled' AND length(trim(coalesce(p_reason,'')))<5 THEN RAISE EXCEPTION 'Enter a cancellation reason'; END IF;
 UPDATE venue_visits SET status=p_status,checked_in_at=CASE WHEN p_status='checked_in' THEN coalesce(checked_in_at,now()) END,no_show_at=CASE WHEN p_status='no_show' THEN coalesce(no_show_at,now()) END,canceled_reason=CASE WHEN p_status='canceled' THEN trim(p_reason) END,version=version+1 WHERE id=v.id;
 IF p_status='canceled' THEN DELETE FROM group_events WHERE venue_visit_id=v.id; END IF;
END $$;
CREATE FUNCTION public.audit_venue_visit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.status IS DISTINCT FROM OLD.status THEN INSERT INTO venue_visit_audit(venue_id,visit_id,previous_status,status,actor_id) VALUES(NEW.venue_id,NEW.id,OLD.status,NEW.status,auth.uid()); END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER audit_venue_visit AFTER UPDATE ON venue_visits FOR EACH ROW EXECUTE FUNCTION audit_venue_visit();
CREATE FUNCTION public.sync_venue_visit_sale() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.visit_id IS NOT NULL AND NEW.status IN ('expired','refunded') AND NEW.status IS DISTINCT FROM OLD.status THEN
  UPDATE venue_visits SET status=CASE WHEN NEW.status='expired' THEN 'expired' ELSE 'canceled' END,version=version+1,canceled_reason=CASE WHEN NEW.status='refunded' THEN 'Payment refunded in full' ELSE 'Checkout expired' END WHERE id=NEW.visit_id AND status NOT IN ('canceled','expired');
  DELETE FROM group_events WHERE venue_visit_id=NEW.visit_id;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER sync_venue_visit_sale AFTER UPDATE ON venue_sales FOR EACH ROW EXECUTE FUNCTION sync_venue_visit_sale();

CREATE FUNCTION public.venue_walkin_day(p_venue uuid,p_day date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE tz text;a timestamptz;b timestamptz;
BEGIN
 IF NOT venue_desk_access(p_venue) THEN RAISE EXCEPTION 'Venue desk access required' USING ERRCODE='42501'; END IF;
 IF p_day IS NULL OR NOT isfinite(p_day) THEN RAISE EXCEPTION 'Choose a valid day'; END IF;
 SELECT coalesce(timezone,'America/New_York') INTO tz FROM venues WHERE id=p_venue;
 a:=p_day::timestamp AT TIME ZONE tz;b:=(p_day+1)::timestamp AT TIME ZONE tz;
 RETURN jsonb_build_object('timezone',tz,'visits',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY start_time) FROM (SELECT v.*,c.first_name,c.last_name,venue_missing_documents(c.id) missing_documents FROM venue_visits v JOIN venue_customers c ON c.id=v.customer_id WHERE v.venue_id=p_venue AND v.start_time<b AND v.end_time>a) x),'[]'::jsonb),
  'events',coalesce((SELECT jsonb_agg(jsonb_build_object('id',e.id,'title',e.title,'start_time',e.start_time,'end_time',e.end_time,'price_cents',e.price_cents,'capacity',e.capacity) ORDER BY e.start_time) FROM group_events e WHERE e.venue_id=p_venue AND e.parent_event_id IS NULL AND e.event_format IN ('open_play','clinic','practice','round_robin','social','other') AND e.canceled_at IS NULL AND e.start_time<b AND e.end_time>a),'[]'::jsonb),
  'courts',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name) ORDER BY court_number) FROM venue_courts WHERE venue_id=p_venue AND is_active),'[]'::jsonb));
END $$;

REVOKE ALL ON FUNCTION venue_walkin_seats(uuid),venue_walkin_quote_internal(uuid,uuid,uuid,timestamptz,timestamptz),venue_walkin_quote(uuid,uuid,uuid,timestamptz,timestamptz),venue_walkin_reserve_internal(uuid,uuid,uuid,uuid,timestamptz,timestamptz,text,uuid,integer,uuid),venue_visit_allocation_valid(group_events),guard_venue_visit_allocation(),venue_sale_fulfill_before_visits(uuid,timestamptz),venue_sale_fulfill(uuid,timestamptz),venue_walkin_book(uuid,uuid,uuid,timestamptz,timestamptz,text,uuid,integer,uuid,boolean),payment_reserve_venue_walkin(uuid,uuid,uuid,uuid,timestamptz,timestamptz,integer,uuid,boolean),venue_visit_status(uuid,text,integer,text),audit_venue_visit(),sync_venue_visit_sale(),venue_walkin_day(uuid,date) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION venue_walkin_quote(uuid,uuid,uuid,timestamptz,timestamptz),venue_walkin_book(uuid,uuid,uuid,timestamptz,timestamptz,text,uuid,integer,uuid,boolean),venue_visit_status(uuid,text,integer,text),venue_walkin_day(uuid,date) TO authenticated;
GRANT EXECUTE ON FUNCTION payment_reserve_venue_walkin(uuid,uuid,uuid,uuid,timestamptz,timestamptz,integer,uuid,boolean) TO service_role;

-- Existing guard definitions are extended below to count desk-held event seats
-- and accept only the validated desk allocation described above.

CREATE OR REPLACE FUNCTION public.guard_court_payment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c uuid; v uuid; active boolean; rate numeric;
BEGIN
  IF TG_OP<>'DELETE' AND NEW.venue_visit_id IS NOT NULL AND venue_visit_allocation_valid(NEW) THEN RETURN NEW; END IF;
  IF TG_OP='DELETE' THEN
    IF OLD.payment_order_id IS NOT NULL AND current_setting('role',true) IN ('authenticated','anon') THEN
      RAISE EXCEPTION 'Manage paid reservations from Payments & purchases. Canceling and refunding are separate actions.';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP='UPDATE' AND OLD.payment_order_id IS NOT NULL AND current_setting('role',true) IN ('authenticated','anon') THEN
    IF (NEW.venue_court_id,NEW.start_time,NEW.end_time,NEW.payment_order_id,NEW.created_by,NEW.group_id,NEW.venue_id,NEW.event_format)
      IS DISTINCT FROM (OLD.venue_court_id,OLD.start_time,OLD.end_time,OLD.payment_order_id,OLD.created_by,OLD.group_id,OLD.venue_id,OLD.event_format) THEN
      RAISE EXCEPTION 'A paid reservation cannot be rescheduled or reassigned without a new payment review';
    END IF;
  END IF;
  IF NEW.payment_order_id IS NOT NULL AND current_setting('role',true) IN ('authenticated','anon') THEN
    IF TG_OP='INSERT' OR NEW.payment_order_id IS DISTINCT FROM OLD.payment_order_id THEN RAISE EXCEPTION 'Payment fulfillment is server-only'; END IF;
  END IF;
  c:=NEW.venue_court_id;
  IF c IS NULL THEN RETURN NEW; END IF;
  SELECT venue_id,hourly_rate INTO v,rate FROM public.venue_courts WHERE id=c FOR UPDATE;
  IF EXISTS(SELECT 1 FROM public.payment_orders o WHERE o.court_id=c AND o.livemode AND o.status='pending'
    AND o.id IS DISTINCT FROM NEW.payment_order_id AND tstzrange(o.start_time,o.end_time,'[)') && tstzrange(NEW.start_time,NEW.end_time,'[)')) THEN
    RAISE EXCEPTION 'This court is held during checkout. Please choose another time.' USING ERRCODE='23P01';
  END IF;
  SELECT accepting_payments INTO active FROM public.venue_payment_settings WHERE venue_id=v;
  IF active AND coalesce(rate,0)>0 AND NEW.event_format<>'reservation' AND current_setting('role',true) IN ('authenticated','anon')
    AND NOT EXISTS(SELECT 1 FROM public.venues WHERE id=v AND owner_id=auth.uid())
    AND NOT EXISTS(SELECT 1 FROM public.venue_staff WHERE venue_id=v AND user_id=auth.uid() AND is_active=true AND status='active' AND role IN ('owner','manager','staff'))
    AND NOT (NEW.event_format='program_hold' AND public.can_manage_venue_events(auth.uid(),v,NEW.group_id)) THEN
    RAISE EXCEPTION 'Only venue staff may allocate a paid court outside rental checkout';
  END IF;
  IF NEW.event_format='reservation' AND active AND coalesce(rate,0)>0 AND current_setting('role',true) IN ('authenticated','anon') THEN
    IF TG_OP='INSERT' OR (NEW.venue_court_id,NEW.start_time,NEW.end_time,NEW.event_format) IS DISTINCT FROM (OLD.venue_court_id,OLD.start_time,OLD.end_time,OLD.event_format) THEN
      RAISE EXCEPTION 'This court requires secure checkout before it is reserved';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_configured_court_price() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.venue_courts;
BEGIN
  IF TG_OP<>'DELETE' AND NEW.venue_visit_id IS NOT NULL AND venue_visit_allocation_valid(NEW) THEN RETURN NEW; END IF;
  IF NEW.venue_court_id IS NULL OR current_setting('role',true) NOT IN ('authenticated','anon') THEN RETURN NEW; END IF;
  SELECT * INTO c FROM public.venue_courts WHERE id=NEW.venue_court_id FOR UPDATE;
  IF coalesce(c.hourly_rate,0)<=0 OR NOT EXISTS(SELECT 1 FROM public.venue_payment_settings WHERE venue_id=c.venue_id) THEN RETURN NEW; END IF;
  IF NEW.event_format='reservation' THEN
    IF TG_OP='INSERT' OR (NEW.venue_court_id,NEW.start_time,NEW.end_time,NEW.event_format) IS DISTINCT FROM (OLD.venue_court_id,OLD.start_time,OLD.end_time,OLD.event_format) THEN
      IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Paid court reservations cannot be rescheduled directly; use secure checkout'; END IF;
      RAISE EXCEPTION 'This priced court requires secure checkout. Paused payments do not make the court free';
    END IF;
  ELSIF NOT EXISTS(SELECT 1 FROM public.venues WHERE id=c.venue_id AND owner_id=auth.uid())
    AND NOT EXISTS(SELECT 1 FROM public.venue_staff WHERE venue_id=c.venue_id AND user_id=auth.uid() AND is_active=true AND status='active' AND role IN ('owner','manager','staff'))
    AND NOT (NEW.event_format='program_hold' AND public.can_manage_venue_events(auth.uid(),c.venue_id,NEW.group_id)) THEN
    RAISE EXCEPTION 'Only venue staff may allocate a priced court outside rental checkout';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION guard_venue_booking_policy() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE price jsonb;c uuid;tz text;
BEGIN
 IF NEW.venue_court_id IS NULL THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND (NEW.venue_court_id,NEW.start_time,NEW.end_time) IS NOT DISTINCT FROM (OLD.venue_court_id,OLD.start_time,OLD.end_time) THEN RETURN NEW; END IF;
 SELECT coalesce(timezone,'America/New_York') INTO tz FROM venues WHERE id=NEW.venue_id;
 IF EXISTS(SELECT 1 FROM venue_holiday_closures WHERE venue_id=NEW.venue_id AND day>=(NEW.start_time AT TIME ZONE tz)::date AND day<=((NEW.end_time-interval '1 microsecond') AT TIME ZONE tz)::date) THEN RAISE EXCEPTION 'The venue is closed on this date'; END IF;
 IF NEW.event_format='reservation' AND NEW.venue_visit_id IS NULL AND NEW.payment_order_id IS NULL AND current_setting('role',true) IN ('authenticated','anon') THEN
  SELECT id INTO c FROM venue_customers WHERE venue_id=NEW.venue_id AND user_id=auth.uid();
  price:=venue_court_pricing(NEW.venue_court_id,NEW.start_time,NEW.end_time,c);
  IF (price->>'amount_cents')::integer>0 THEN RAISE EXCEPTION 'This time requires secure checkout or a front-desk payment'; END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_venue_program_management() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e group_events; n integer; held integer;
BEGIN
  IF TG_OP='DELETE' THEN e:=OLD; ELSE e:=NEW; END IF;
  IF TG_OP='UPDATE' AND OLD.venue_id IS NOT NULL AND OLD.parent_event_id IS NULL AND OLD.event_format IN ('open_play','clinic','practice','round_robin','social','other') THEN
    IF NEW.venue_id IS DISTINCT FROM OLD.venue_id OR NEW.group_id IS DISTINCT FROM OLD.group_id OR NEW.parent_event_id IS DISTINCT FROM OLD.parent_event_id OR NEW.venue_court_id IS DISTINCT FROM OLD.venue_court_id OR NEW.event_format NOT IN ('open_play','clinic','practice','round_robin','social','other') THEN RAISE EXCEPTION 'The event location and ownership cannot change'; END IF;
  END IF;
  IF e.venue_id IS NULL OR e.parent_event_id IS NOT NULL OR e.event_format NOT IN ('open_play','clinic','practice','round_robin','social','other') THEN RETURN coalesce(NEW,OLD); END IF;
  IF auth.uid() IS NOT NULL AND NOT public.can_manage_venue_events(auth.uid(),e.venue_id,e.group_id) THEN RAISE EXCEPTION 'Manage venue events from the venue management area' USING ERRCODE='42501'; END IF;
  IF TG_OP='DELETE' THEN
    IF auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'Cancel this event in event management to preserve registration and payment history'; END IF;
    RETURN OLD;
  END IF;
  IF length(trim(coalesce(NEW.title,''))) NOT BETWEEN 1 AND 150 OR length(coalesce(NEW.description,''))>5000
    OR NEW.capacity IS NULL OR NEW.capacity NOT BETWEEN 1 AND 5000
    OR NEW.end_time IS NULL OR NOT isfinite(NEW.start_time) OR NOT isfinite(NEW.end_time) OR NEW.end_time<=NEW.start_time OR NEW.end_time>NEW.start_time+interval '24 hours'
    OR (NEW.skill_level_min IS NOT NULL AND NEW.skill_level_min NOT BETWEEN 0 AND 8)
    OR (NEW.skill_level_max IS NOT NULL AND NEW.skill_level_max NOT BETWEEN 0 AND 8)
    OR (NEW.skill_level_min IS NOT NULL AND NEW.skill_level_max IS NOT NULL AND NEW.skill_level_min>NEW.skill_level_max)
    OR (NEW.waitlist_limit IS NOT NULL AND NEW.waitlist_limit NOT BETWEEN 0 AND 5000)
    OR (NEW.registration_closes_at IS NOT NULL AND (NOT isfinite(NEW.registration_closes_at) OR NEW.registration_closes_at>NEW.start_time))
    OR (NEW.cancellation_policy IS NOT NULL AND length(NEW.cancellation_policy) NOT BETWEEN 20 AND 2000) THEN
    RAISE EXCEPTION 'Check the event title, duration, player capacity, skill levels, registration cutoff and cancellation policy';
  END IF;
  IF TG_OP='UPDATE' THEN
    IF (NEW.venue_id,NEW.group_id,NEW.parent_event_id,NEW.venue_court_id,NEW.created_by) IS DISTINCT FROM (OLD.venue_id,OLD.group_id,OLD.parent_event_id,OLD.venue_court_id,OLD.created_by)
      OR NEW.event_format NOT IN ('open_play','clinic','practice','round_robin','social','other') THEN RAISE EXCEPTION 'The event location and ownership cannot change'; END IF;
    IF OLD.canceled_at IS NOT NULL THEN RAISE EXCEPTION 'Canceled events are retained as read-only records'; END IF;
    SELECT count(*) INTO n FROM group_event_rsvps WHERE event_id=NEW.id AND status='going';
    SELECT count(*) INTO held FROM payment_orders WHERE program_event_id=NEW.id AND status='pending' AND livemode;
    n:=n+venue_walkin_seats(NEW.id);
    IF (NEW.start_time,NEW.end_time,NEW.cancellation_policy) IS DISTINCT FROM (OLD.start_time,OLD.end_time,OLD.cancellation_policy) AND EXISTS(SELECT 1 FROM venue_visits WHERE event_id=NEW.id AND status='pending_payment') THEN RAISE EXCEPTION 'Resolve pending desk checkouts before changing this event time or policy'; END IF;
    IF NEW.capacity<n+held THEN RAISE EXCEPTION 'Capacity cannot be lower than confirmed players and active checkouts'; END IF;
    IF NEW.price_cents IS DISTINCT FROM OLD.price_cents AND (n>0 OR EXISTS(SELECT 1 FROM payment_orders WHERE program_event_id=NEW.id AND status='pending')) THEN
      RAISE EXCEPTION 'Price is locked while players are registered or checking out. Duplicate this event for a new price.';
    END IF;
    IF (NEW.start_time,NEW.end_time,NEW.cancellation_policy) IS DISTINCT FROM (OLD.start_time,OLD.end_time,OLD.cancellation_policy)
      AND EXISTS(SELECT 1 FROM payment_orders WHERE program_event_id=NEW.id AND status='pending') THEN RAISE EXCEPTION 'Pause registration and resolve active checkouts before changing the time or policy'; END IF;
  END IF;
  IF NEW.canceled_at IS NOT NULL AND (NOT NEW.registration_paused OR length(trim(coalesce(NEW.cancellation_reason,'')))<5) THEN RAISE EXCEPTION 'Canceled events require a reason and closed registration'; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_venue_event_registration() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e group_events; r group_event_rsvps; o payment_orders; n integer;
BEGIN
  IF TG_OP='DELETE' THEN r:=OLD; ELSE r:=NEW; END IF;
  IF TG_OP='UPDATE' AND (NEW.event_id,NEW.user_id) IS DISTINCT FROM (OLD.event_id,OLD.user_id) THEN RAISE EXCEPTION 'A registration cannot be moved to another event or player'; END IF;
  SELECT * INTO e FROM group_events WHERE id=r.event_id FOR UPDATE;
  IF e.venue_id IS NULL OR e.parent_event_id IS NOT NULL OR e.event_format NOT IN ('open_play','clinic','practice','round_robin','social','other') THEN RETURN coalesce(NEW,OLD); END IF;
  IF TG_OP='UPDATE' AND (NEW.event_id,NEW.user_id) IS DISTINCT FROM (OLD.event_id,OLD.user_id) THEN RAISE EXCEPTION 'A registration cannot be moved to another event or player'; END IF;
  IF TG_OP<>'DELETE' AND (TG_OP='INSERT' OR (NEW.checked_in_at,NEW.checked_in_by) IS DISTINCT FROM (OLD.checked_in_at,OLD.checked_in_by))
    AND (NEW.checked_in_at IS NOT NULL OR NEW.checked_in_by IS NOT NULL OR TG_OP='UPDATE')
    AND NEW.status='going' AND auth.uid() IS NOT NULL AND NOT public.can_record_venue_attendance(auth.uid(),e.venue_id,e.group_id) THEN RAISE EXCEPTION 'Only event managers can change check-in status' USING ERRCODE='42501'; END IF;
  IF TG_OP<>'INSERT' AND OLD.payment_order_id IS NOT NULL THEN
    SELECT * INTO o FROM payment_orders WHERE id=OLD.payment_order_id;
    IF o.status IN ('paid','partially_refunded') AND o.canceled_at IS NULL AND e.canceled_at IS NULL
      AND (TG_OP='DELETE' OR NEW.status IS DISTINCT FROM OLD.status OR NEW.payment_order_id IS DISTINCT FROM OLD.payment_order_id) THEN
      RAISE EXCEPTION 'Request cancellation from Payments & purchases so the venue can review your paid registration';
    END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  IF (TG_OP='INSERT' OR NEW.status IS DISTINCT FROM OLD.status) AND NEW.status<>'not_going' THEN
    IF e.canceled_at IS NOT NULL OR e.end_time<=now() OR e.registration_paused OR now()>=coalesce(e.registration_closes_at,e.start_time) THEN
      -- A verified checkout already owns its place, including after the cutoff.
      IF NEW.payment_order_id IS NULL OR e.canceled_at IS NOT NULL OR e.end_time<=now() THEN RAISE EXCEPTION 'Registration is closed for this event'; END IF;
    END IF;
    IF NOT EXISTS(SELECT 1 FROM group_members WHERE group_id=e.group_id AND user_id=NEW.user_id AND status='active') AND NEW.payment_order_id IS NULL THEN RAISE EXCEPTION 'Join this venue community before registering'; END IF;
  END IF;
  IF NEW.payment_order_id IS NOT NULL THEN
    SELECT * INTO o FROM payment_orders WHERE id=NEW.payment_order_id;
    IF NOT FOUND OR o.kind<>'event_registration' OR o.program_event_id<>e.id OR o.buyer_id<>NEW.user_id OR NOT o.livemode OR (NEW.status<>'not_going' AND (o.status NOT IN ('paid','partially_refunded') OR o.canceled_at IS NOT NULL)) THEN RAISE EXCEPTION 'Invalid registration payment'; END IF;
  END IF;
  IF NEW.status='going' THEN
    IF EXISTS(SELECT 1 FROM venue_visits v JOIN venue_customers c ON c.id=v.customer_id WHERE v.event_id=e.id AND c.user_id=NEW.user_id AND v.status IN ('pending_payment','expected','checked_in','no_show')) THEN RAISE EXCEPTION 'This player already has a desk registration'; END IF;
    IF e.price_cents>0 THEN
      SELECT * INTO o FROM payment_orders WHERE id=NEW.payment_order_id;
      IF NOT FOUND OR o.kind<>'event_registration' OR o.program_event_id<>e.id OR o.buyer_id<>NEW.user_id OR NOT o.livemode
        OR o.status NOT IN ('paid','partially_refunded') OR o.canceled_at IS NOT NULL THEN RAISE EXCEPTION 'Complete secure checkout to confirm your place'; END IF;
    END IF;
    SELECT count(*) INTO n FROM group_event_rsvps WHERE event_id=e.id AND status='going' AND user_id<>NEW.user_id;
    n:=n+(SELECT count(*) FROM payment_orders WHERE program_event_id=e.id AND status='pending' AND livemode AND buyer_id<>NEW.user_id);
    n:=n+venue_walkin_seats(e.id);
    IF n>=e.capacity THEN RAISE EXCEPTION 'This event has no unreserved places'; END IF;
  ELSIF NEW.status='waitlist' THEN
    IF NOT e.waitlist_enabled THEN RAISE EXCEPTION 'The waitlist is closed'; END IF;
    IF e.waitlist_limit IS NOT NULL AND (SELECT count(*) FROM group_event_rsvps WHERE event_id=e.id AND status='waitlist' AND user_id<>NEW.user_id)>=e.waitlist_limit THEN RAISE EXCEPTION 'The waitlist is full'; END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.payment_event_quote(p_buyer uuid,p_event uuid,p_live boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e group_events; v venues; s venue_payment_settings; a venue_payment_accounts; n integer;
BEGIN
  SELECT * INTO e FROM group_events WHERE id=p_event AND parent_event_id IS NULL AND venue_id IS NOT NULL AND event_format IN ('open_play','clinic','practice','round_robin','social','other');
  IF NOT FOUND OR e.canceled_at IS NOT NULL OR e.registration_paused OR now()>=coalesce(e.registration_closes_at,e.start_time) OR e.price_cents<=0 THEN RAISE EXCEPTION 'Paid registration is unavailable for this event'; END IF;
  SELECT * INTO v FROM venues WHERE id=e.venue_id;
  SELECT * INTO s FROM venue_payment_settings WHERE venue_id=e.venue_id;
  SELECT * INTO a FROM venue_payment_accounts WHERE venue_id=e.venue_id AND livemode=p_live;
  IF NOT EXISTS(SELECT 1 FROM group_members WHERE group_id=e.group_id AND user_id=p_buyer AND status='active') THEN RAISE EXCEPTION 'Join this venue community before registering'; END IF;
  IF NOT v.is_active OR NOT public.venue_has_module(v.id,'facility_tools') OR (p_live AND NOT coalesce(s.accepting_event_payments,false)) THEN RAISE EXCEPTION 'The venue is not accepting event payments'; END IF;
  IF NOT public.payment_venue_owner_eligible(v.id,v.owner_id,p_live) OR a.connected_by IS DISTINCT FROM v.owner_id OR NOT coalesce(a.charges_enabled,false)
    OR NOT coalesce(a.payouts_enabled,false) OR NOT coalesce(a.card_payments_active,false) OR a.disabled_reason IS NOT NULL OR a.disconnected_at IS NOT NULL THEN RAISE EXCEPTION 'This venue must finish its Stripe verification'; END IF;
  IF NOT coalesce(s.tax_inclusive_acknowledged,false) OR coalesce(length(s.cancellation_policy),0)<20 OR coalesce(s.support_email,'')='' THEN RAISE EXCEPTION 'Venue payment policies are incomplete'; END IF;
  IF EXISTS(SELECT 1 FROM group_event_rsvps WHERE event_id=e.id AND user_id=p_buyer AND status='going') THEN RAISE EXCEPTION 'You already have a confirmed place'; END IF;
  IF EXISTS(SELECT 1 FROM payment_orders WHERE program_event_id=e.id AND buyer_id=p_buyer AND livemode=p_live AND status='pending') THEN RAISE EXCEPTION 'You already have a checkout for this event. Open Payments & purchases to resume or cancel it.'; END IF;
  SELECT count(*) INTO n FROM group_event_rsvps WHERE event_id=e.id AND status='going';
  n:=n+(SELECT count(*) FROM payment_orders WHERE program_event_id=e.id AND livemode=p_live AND status='pending');
  n:=n+venue_walkin_seats(e.id);
  IF EXISTS(SELECT 1 FROM venue_visits vi JOIN venue_customers cu ON cu.id=vi.customer_id WHERE vi.event_id=e.id AND cu.user_id=p_buyer AND vi.status IN ('pending_payment','expected','checked_in','no_show')) THEN RAISE EXCEPTION 'This player already has a desk registration'; END IF;
  IF n>=e.capacity THEN RAISE EXCEPTION 'No places are available. Other players may be completing checkout.'; END IF;
  RETURN jsonb_build_object('venue_id',v.id,'event_id',e.id,'group_id',e.group_id,'merchant_name',v.name,'account_id',a.account_id,
    'amount_cents',e.price_cents,'currency',e.currency,'description',e.title||' · 1 player','policy',coalesce(e.cancellation_policy,s.cancellation_policy),
    'support_email',s.support_email,'timezone',coalesce(v.timezone,s.timezone),'start_time',e.start_time,'end_time',e.end_time,'spots_left',e.capacity-n);
END $$;
COMMIT;
