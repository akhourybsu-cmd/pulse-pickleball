BEGIN;
CREATE TABLE public.venue_coaches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),venue_id uuid NOT NULL REFERENCES venues(id),name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 120),
 bio text NOT NULL DEFAULT '' CHECK(length(bio)<=2000),hourly_cents integer NOT NULL CHECK(hourly_cents BETWEEN 0 AND 9999999),
 active boolean NOT NULL DEFAULT true,availability jsonb NOT NULL DEFAULT '[]',updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(venue_id,id)
);
CREATE TABLE public.venue_appointments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),venue_id uuid NOT NULL REFERENCES venues(id),group_id uuid NOT NULL REFERENCES groups(id),customer_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('lesson','private_event')),title text NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 150),
 coach_id uuid,court_ids uuid[] NOT NULL,start_time timestamptz NOT NULL,end_time timestamptz NOT NULL,
 total_cents integer NOT NULL CHECK(total_cents BETWEEN 0 AND 99999999),deposit_cents integer NOT NULL CHECK(deposit_cents>=0 AND deposit_cents<=total_cents),
 policy text NOT NULL DEFAULT '' CHECK(length(policy)<=5000),notes text NOT NULL DEFAULT '' CHECK(length(notes)<=4000),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','held','confirmed','canceled')),
 quote_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,quote_expires_at timestamptz NOT NULL,
 agreed_at timestamptz,agreed_name text,created_by uuid NOT NULL REFERENCES auth.users(id),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 visit_id uuid UNIQUE REFERENCES venue_visits(id),request_key uuid NOT NULL,request_document jsonb NOT NULL DEFAULT '{}',version integer NOT NULL DEFAULT 0,cancellation_reason text,
 FOREIGN KEY(venue_id,customer_id) REFERENCES venue_customers(venue_id,id),FOREIGN KEY(venue_id,coach_id) REFERENCES venue_coaches(venue_id,id),UNIQUE(venue_id,request_key),UNIQUE(venue_id,id),
 CHECK(end_time>start_time),CHECK(cardinality(court_ids) BETWEEN 1 AND 100),CHECK((kind='lesson' AND coach_id IS NOT NULL AND cardinality(court_ids)=1 AND deposit_cents=total_cents) OR (kind='private_event' AND coach_id IS NULL))
);
CREATE INDEX venue_appointment_day ON venue_appointments(venue_id,start_time);
ALTER TABLE group_events ADD COLUMN venue_appointment_id uuid REFERENCES venue_appointments(id);
CREATE UNIQUE INDEX venue_appointment_court ON group_events(venue_appointment_id,venue_court_id) WHERE venue_appointment_id IS NOT NULL;
ALTER TABLE venue_sales ADD COLUMN appointment_id uuid REFERENCES venue_appointments(id);
ALTER TABLE venue_sales DROP CONSTRAINT venue_sale_item_shape;
ALTER TABLE venue_sales ADD CONSTRAINT venue_sale_item_shape CHECK(product_id IS NOT NULL OR visit_id IS NOT NULL OR appointment_id IS NOT NULL);
CREATE UNIQUE INDEX venue_appointment_pending_sale ON venue_sales(appointment_id) WHERE status='pending';
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['venue_coaches','venue_appointments'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
  EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
  EXECUTE format('CREATE POLICY pulse_required_mfa ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.pulse_has_required_mfa())) WITH CHECK ((SELECT public.pulse_has_required_mfa()))',t);
 END LOOP;
END $$;
CREATE FUNCTION public.venue_coach_save(p_venue uuid,p_id uuid,p_expected timestamptz,p_document jsonb)
RETURNS venue_coaches LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c venue_coaches;slot jsonb;
BEGIN
 IF NOT venue_desk_access(p_venue,true) THEN RAISE EXCEPTION 'Venue management access required' USING ERRCODE='42501'; END IF;
 PERFORM id FROM venues WHERE id=p_venue FOR UPDATE;
 IF jsonb_typeof(p_document->'availability') IS DISTINCT FROM 'array' OR jsonb_array_length(p_document->'availability')>50 THEN RAISE EXCEPTION 'Add weekly availability windows'; END IF;
 FOR slot IN SELECT value FROM jsonb_array_elements(p_document->'availability') LOOP
  IF ((slot->>'weekday')::integer BETWEEN 0 AND 6 AND (slot->>'start_minute')::integer BETWEEN 0 AND 1439 AND (slot->>'end_minute')::integer BETWEEN 1 AND 1440 AND (slot->>'end_minute')::integer>(slot->>'start_minute')::integer) IS NOT TRUE THEN RAISE EXCEPTION 'Choose a valid weekday and availability window'; END IF;
 END LOOP;
 IF p_id IS NULL THEN
  INSERT INTO venue_coaches(venue_id,name,bio,hourly_cents,active,availability) VALUES(p_venue,trim(p_document->>'name'),coalesce(p_document->>'bio',''),(p_document->>'hourly_cents')::integer,(p_document->>'active')::boolean,p_document->'availability') RETURNING * INTO c;
 ELSE
  SELECT * INTO c FROM venue_coaches WHERE id=p_id AND venue_id=p_venue FOR UPDATE;
  IF NOT FOUND OR c.updated_at IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Coach changed. Refresh before saving.' USING ERRCODE='40001'; END IF;
  UPDATE venue_coaches SET name=trim(p_document->>'name'),bio=coalesce(p_document->>'bio',''),hourly_cents=(p_document->>'hourly_cents')::integer,active=(p_document->>'active')::boolean,availability=p_document->'availability',updated_at=clock_timestamp() WHERE id=c.id RETURNING * INTO c;
 END IF;
 RETURN c;
END $$;
CREATE FUNCTION public.venue_appointment_available(p_appointment uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a venue_appointments;v venues;c venue_coaches;local_start timestamp;local_end timestamp;day_hours jsonb;opens time;closes time;
BEGIN
 SELECT * INTO a FROM venue_appointments WHERE id=p_appointment;
 SELECT * INTO v FROM venues WHERE id=a.venue_id;
 IF NOT coalesce(v.is_active,false) OR NOT venue_has_module(v.id,'court_booking') OR EXISTS(SELECT 1 FROM private_venue_sandboxes WHERE venue_id=v.id) THEN RAISE EXCEPTION 'Live venue court booking is required'; END IF;
 IF a.start_time<now() OR a.start_time>now()+interval '180 days' OR a.end_time>a.start_time+interval '12 hours' OR mod(extract(epoch FROM a.end_time-a.start_time)/60,30)<>0 THEN RAISE EXCEPTION 'Choose a future booking within 180 days and a duration of 30 minutes to 12 hours in 30-minute increments'; END IF;
 local_start:=a.start_time AT TIME ZONE coalesce(v.timezone,'America/New_York');local_end:=a.end_time AT TIME ZONE coalesce(v.timezone,'America/New_York');
 day_hours:=v.hours_of_operation->'days'->extract(dow FROM local_start)::integer::text;
 opens:=coalesce((day_hours->>'open')::time,'06:00');closes:=coalesce((day_hours->>'close')::time,'22:00');
 IF day_hours='null'::jsonb OR local_start<local_start::date+opens OR local_end>local_start::date+closes OR EXISTS(SELECT 1 FROM venue_holiday_closures WHERE venue_id=v.id AND day BETWEEN local_start::date AND (local_end-interval '1 microsecond')::date) THEN RAISE EXCEPTION 'Choose a time within venue hours on an open date'; END IF;
 PERFORM id FROM venue_courts WHERE id=ANY(a.court_ids) ORDER BY id FOR UPDATE;
 IF cardinality(a.court_ids)<>(SELECT count(*) FROM venue_courts WHERE id=ANY(a.court_ids) AND venue_id=v.id AND is_active) THEN RAISE EXCEPTION 'Choose distinct active courts at this venue'; END IF;
 IF EXISTS(SELECT 1 FROM group_events WHERE venue_court_id=ANY(a.court_ids) AND venue_appointment_id IS DISTINCT FROM a.id AND canceled_at IS NULL AND tstzrange(start_time,end_time,'[)')&&tstzrange(a.start_time,a.end_time,'[)')) OR EXISTS(SELECT 1 FROM payment_orders WHERE court_id=ANY(a.court_ids) AND status='pending' AND livemode AND tstzrange(start_time,end_time,'[)')&&tstzrange(a.start_time,a.end_time,'[)')) THEN RAISE EXCEPTION 'A requested court is already booked or held for checkout' USING ERRCODE='23P01'; END IF;
 IF a.coach_id IS NOT NULL THEN
  SELECT * INTO c FROM venue_coaches WHERE id=a.coach_id AND venue_id=v.id FOR UPDATE;
  IF NOT coalesce(c.active,false) OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(c.availability) s WHERE (s->>'weekday')::integer=extract(dow FROM local_start)::integer AND local_start>=local_start::date+(s->>'start_minute')::integer*interval '1 minute' AND local_end<=local_start::date+(s->>'end_minute')::integer*interval '1 minute') THEN RAISE EXCEPTION 'The coach is unavailable at this time'; END IF;
  IF EXISTS(SELECT 1 FROM venue_appointments WHERE coach_id=a.coach_id AND id<>a.id AND status IN ('held','confirmed') AND tstzrange(start_time,end_time,'[)')&&tstzrange(a.start_time,a.end_time,'[)')) THEN RAISE EXCEPTION 'The coach already has a lesson at this time' USING ERRCODE='23P01'; END IF;
 END IF;
END $$;
CREATE FUNCTION public.venue_appointment_save(p_venue uuid,p_id uuid,p_expected integer,p_document jsonb,p_request uuid)
RETURNS venue_appointments LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a venue_appointments;c venue_coaches;total integer;deposit integer;gid uuid;policy_text text;
BEGIN
 IF NOT venue_desk_access(p_venue,true) THEN RAISE EXCEPTION 'Venue management access required' USING ERRCODE='42501'; END IF;
 PERFORM id FROM venues WHERE id=p_venue FOR UPDATE;
 IF p_id IS NULL THEN SELECT * INTO a FROM venue_appointments WHERE venue_id=p_venue AND request_key=p_request; IF FOUND THEN IF a.request_document IS DISTINCT FROM p_document THEN RAISE EXCEPTION 'Quote request changed. Start a new quote or edit the saved draft.'; END IF; RETURN a; END IF;
 ELSE SELECT * INTO a FROM venue_appointments WHERE id=p_id AND venue_id=p_venue FOR UPDATE; IF NOT FOUND OR a.version IS DISTINCT FROM p_expected OR a.status<>'draft' THEN RAISE EXCEPTION 'Only an unchanged draft quote can be edited. Cancel a confirmed booking before replacing it.'; END IF; END IF;
 SELECT id INTO gid FROM groups WHERE venue_id=p_venue ORDER BY id LIMIT 1;
 SELECT cancellation_policy INTO policy_text FROM venue_payment_settings WHERE venue_id=p_venue;
 total:=(p_document->>'total_cents')::integer;
 IF p_document->>'kind'='lesson' THEN
  SELECT * INTO c FROM venue_coaches WHERE id=(p_document->>'coach_id')::uuid AND venue_id=p_venue AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Choose an active coach'; END IF;
  total:=round(c.hourly_cents*extract(epoch FROM (p_document->>'end_time')::timestamptz-(p_document->>'start_time')::timestamptz)/3600);
 END IF;
 deposit:=CASE WHEN c.id IS NOT NULL THEN total ELSE (p_document->>'deposit_cents')::integer END;
 IF total BETWEEN 1 AND 49 OR deposit BETWEEN 1 AND 49 OR total-deposit BETWEEN 1 AND 49 THEN RAISE EXCEPTION 'Each payment, including the remaining balance, must be at least $0.50 or zero'; END IF;
 IF total>0 AND (length(coalesce(policy_text,''))<20 OR p_document->>'tax_inclusive' IS DISTINCT FROM 'true') THEN RAISE EXCEPTION 'Confirm tax-inclusive pricing and save the venue payment policy before quoting'; END IF;
 IF p_id IS NULL THEN
  INSERT INTO venue_appointments(venue_id,group_id,customer_id,kind,title,coach_id,court_ids,start_time,end_time,total_cents,deposit_cents,policy,notes,quote_expires_at,created_by,request_key,request_document)
  VALUES(p_venue,gid,(p_document->>'customer_id')::uuid,p_document->>'kind',trim(p_document->>'title'),c.id,ARRAY(SELECT value::uuid FROM jsonb_array_elements_text(p_document->'court_ids')),(p_document->>'start_time')::timestamptz,(p_document->>'end_time')::timestamptz,total,deposit,coalesce(policy_text,''),coalesce(p_document->>'notes',''),least(now()+interval '7 days',(p_document->>'start_time')::timestamptz),auth.uid(),p_request,p_document) RETURNING * INTO a;
 ELSE
  UPDATE venue_appointments SET customer_id=(p_document->>'customer_id')::uuid,kind=p_document->>'kind',title=trim(p_document->>'title'),coach_id=c.id,court_ids=ARRAY(SELECT value::uuid FROM jsonb_array_elements_text(p_document->'court_ids')),start_time=(p_document->>'start_time')::timestamptz,end_time=(p_document->>'end_time')::timestamptz,total_cents=total,deposit_cents=CASE WHEN c.id IS NOT NULL THEN total ELSE (p_document->>'deposit_cents')::integer END,policy=coalesce(policy_text,''),notes=coalesce(p_document->>'notes',''),quote_token=gen_random_uuid(),agreed_at=NULL,agreed_name=NULL,quote_expires_at=least(now()+interval '7 days',(p_document->>'start_time')::timestamptz),version=version+1,updated_at=clock_timestamp() WHERE id=a.id RETURNING * INTO a;
 END IF;
 PERFORM venue_appointment_available(a.id);
 RETURN a;
END $$;
CREATE FUNCTION public.venue_appointment_allocation_valid(p_event group_events)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM venue_appointments a WHERE a.id=p_event.venue_appointment_id AND a.status IN ('held','confirmed') AND p_event.venue_court_id=ANY(a.court_ids)
  AND (a.venue_id,a.group_id,a.created_by,a.start_time,a.end_time)=(p_event.venue_id,p_event.group_id,p_event.created_by,p_event.start_time,p_event.end_time)
  AND p_event.event_format='reservation' AND p_event.parent_event_id IS NULL AND p_event.payment_order_id IS NULL AND p_event.venue_visit_id IS NULL)
$$;
CREATE FUNCTION public.guard_venue_appointment_allocation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='DELETE' THEN IF OLD.venue_appointment_id IS NOT NULL AND EXISTS(SELECT 1 FROM venue_appointments WHERE id=OLD.venue_appointment_id AND status IN ('held','confirmed')) THEN RAISE EXCEPTION 'Manage this court block from Lessons & private bookings'; END IF; RETURN OLD; END IF;
 IF TG_OP='UPDATE' AND NEW.venue_appointment_id IS DISTINCT FROM OLD.venue_appointment_id THEN RAISE EXCEPTION 'An appointment block cannot be reassigned'; END IF;
 IF NEW.venue_appointment_id IS NOT NULL AND NOT venue_appointment_allocation_valid(NEW) THEN RAISE EXCEPTION 'Court block does not match an authorized appointment'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_venue_appointment_allocation BEFORE INSERT OR UPDATE OR DELETE ON group_events FOR EACH ROW EXECUTE FUNCTION guard_venue_appointment_allocation();
CREATE FUNCTION public.venue_appointment_collect_internal(p_actor uuid,p_id uuid,p_expected integer,p_method text,p_amount integer,p_request uuid,p_entitlement uuid DEFAULT NULL)
RETURNS venue_sales LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a venue_appointments;s venue_sales;v venues;visit venue_visits;c uuid;paid integer;due integer;ent venue_entitlements;
BEGIN
 SELECT * INTO a FROM venue_appointments WHERE id=p_id FOR UPDATE;
 SELECT * INTO v FROM venues WHERE id=a.venue_id;
 IF p_actor IS NULL OR NOT (v.owner_id=p_actor OR EXISTS(SELECT 1 FROM venue_staff WHERE venue_id=v.id AND user_id=p_actor AND is_active IS NOT FALSE AND (status IS NULL OR status::text='active') AND (role::text IN ('owner','manager') OR (role::text='staff' AND venue_has_module(v.id,'facility_tools'))))) THEN RAISE EXCEPTION 'Venue desk access required' USING ERRCODE='42501'; END IF;
 PERFORM id FROM venues WHERE id=v.id FOR UPDATE;
 SELECT * INTO s FROM venue_sales WHERE venue_id=v.id AND request_key=p_request;
 IF FOUND THEN IF (s.appointment_id,s.method,s.amount_cents) IS DISTINCT FROM (a.id,p_method,p_amount) THEN RAISE EXCEPTION 'Payment request changed'; END IF; RETURN s; END IF;
 SELECT * INTO visit FROM venue_visits WHERE id=a.visit_id AND request_key=p_request AND method IN ('free','pass');
 IF FOUND THEN
  IF (visit.method,visit.entitlement_id) IS DISTINCT FROM (p_method,p_entitlement) OR p_amount IS DISTINCT FROM a.deposit_cents THEN RAISE EXCEPTION 'Confirmation request changed'; END IF; RETURN NULL;
 END IF;
 IF a.version IS DISTINCT FROM p_expected OR a.status NOT IN ('draft','confirmed') THEN RAISE EXCEPTION 'Booking changed or has a pending payment. Refresh before continuing.'; END IF;
 IF a.status='confirmed' AND EXISTS(SELECT 1 FROM venue_visits WHERE id=a.visit_id AND method='pass') THEN RAISE EXCEPTION 'This lesson is already covered by its package'; END IF;
 IF a.status='draft' AND a.quote_expires_at<=now() THEN RAISE EXCEPTION 'This quote expired. Edit and save a new quote.'; END IF;
 IF p_method NOT IN ('cash','stripe','free','pass') OR p_method IS NULL THEN RAISE EXCEPTION 'Choose a payment method'; END IF;
 SELECT coalesce(sum(amount_cents-refunded_cents),0) INTO paid FROM venue_sales WHERE appointment_id=a.id AND status IN ('paid','partially_refunded','refunded');
 due:=CASE WHEN a.status='draft' THEN a.deposit_cents ELSE a.total_cents-paid END;
 IF p_amount IS DISTINCT FROM due OR (a.status='confirmed' AND due=0) THEN RAISE EXCEPTION 'Payment amount changed. Review the remaining balance.'; END IF;
 IF p_method='free' AND due<>0 THEN RAISE EXCEPTION 'Payment or a lesson pass is required'; END IF;
 IF p_method IN ('cash','stripe') AND due<50 THEN RAISE EXCEPTION 'Use free confirmation for a zero deposit, or charge at least $0.50'; END IF;
 IF p_method='cash' AND EXISTS(SELECT 1 FROM venue_cash_closings WHERE venue_id=v.id AND day=(now() AT TIME ZONE coalesce(v.timezone,'America/New_York'))::date) THEN RAISE EXCEPTION 'The cash day is closed'; END IF;
 IF a.status='draft' THEN
  PERFORM venue_appointment_available(a.id);
  IF p_method='pass' THEN
   SELECT * INTO ent FROM venue_entitlements WHERE id=p_entitlement AND customer_id=a.customer_id AND venue_id=v.id FOR UPDATE;
   IF a.kind<>'lesson' OR ent.id IS NULL OR ent.kind<>'lesson_pack' OR ent.revoked_at IS NOT NULL OR ent.starts_at>now() OR ent.expires_at<a.end_time OR ent.remaining_units<1 THEN RAISE EXCEPTION 'Choose a valid lesson pack with an unused lesson'; END IF;
  ELSIF p_entitlement IS NOT NULL THEN RAISE EXCEPTION 'Select lesson pass to use a package'; END IF;
  UPDATE venue_appointments SET status=CASE WHEN p_method IN ('free','pass') THEN 'confirmed' ELSE 'held' END,version=version+1,updated_at=clock_timestamp(),agreed_at=coalesce(agreed_at,now()),agreed_name=coalesce(agreed_name,'Acknowledged at venue desk') WHERE id=a.id RETURNING * INTO a;
  INSERT INTO venue_visits(venue_id,customer_id,group_id,court_id,title,start_time,end_time,status,method,amount_cents,entitlement_id,created_by,request_key)
  VALUES(v.id,a.customer_id,a.group_id,a.court_ids[1],a.title,a.start_time,a.end_time,CASE WHEN p_method IN ('free','pass') THEN 'expected' ELSE 'pending_payment' END,p_method,a.total_cents,p_entitlement,p_actor,p_request) RETURNING * INTO visit;
  UPDATE venue_appointments SET visit_id=visit.id WHERE id=a.id RETURNING * INTO a;
  IF p_method='pass' THEN
   INSERT INTO venue_entitlement_usage(venue_id,entitlement_id,units,request_key,description,actor_id) VALUES(v.id,ent.id,1,p_request,a.title,p_actor);
   UPDATE venue_entitlements SET remaining_units=remaining_units-1 WHERE id=ent.id;
  END IF;
  FOREACH c IN ARRAY a.court_ids LOOP
   INSERT INTO group_events(venue_id,group_id,venue_court_id,venue_appointment_id,created_by,title,start_time,end_time,event_format,location_type)
   VALUES(v.id,a.group_id,c,a.id,a.created_by,CASE WHEN a.kind='lesson' THEN 'Coaching lesson' ELSE 'Private event' END,a.start_time,a.end_time,'reservation','venue');
  END LOOP;
 ELSIF p_method='pass' THEN RAISE EXCEPTION 'Apply lesson packages when confirming a new lesson';
 END IF;
 IF p_method IN ('free','pass') THEN RETURN NULL; END IF;
 INSERT INTO venue_sales(venue_id,customer_id,appointment_id,product_name,product_kind,quantity,units,valid_days,member_discount_percent,amount_cents,method,billing_cadence,policy_snapshot,cashier_id,request_key)
 VALUES(v.id,a.customer_id,a.id,a.title||CASE WHEN paid>0 THEN ' - balance' WHEN a.deposit_cents<a.total_cents THEN ' - deposit' ELSE '' END,a.kind,1,1,1,0,due,p_method,'one_time',a.policy,p_actor,p_request) RETURNING * INTO s;
 RETURN s;
END $$;
CREATE FUNCTION public.venue_appointment_collect(p_id uuid,p_expected integer,p_method text,p_amount integer,p_request uuid,p_cash_received boolean,p_terms boolean,p_entitlement uuid DEFAULT NULL)
RETURNS venue_sales LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a venue_appointments;s venue_sales;
BEGIN
 SELECT * INTO a FROM venue_appointments WHERE id=p_id;
 IF NOT venue_desk_access(a.venue_id) THEN RAISE EXCEPTION 'Venue desk access required' USING ERRCODE='42501'; END IF;
 IF p_terms IS DISTINCT FROM true OR (p_method='cash' AND p_cash_received IS DISTINCT FROM true) THEN RAISE EXCEPTION 'Confirm the customer accepted the quote and any cash was received'; END IF;
 IF p_method='stripe' THEN RAISE EXCEPTION 'Use secure checkout for card payment'; END IF;
 s:=venue_appointment_collect_internal(auth.uid(),p_id,p_expected,p_method,p_amount,p_request,p_entitlement);
 IF s.id IS NOT NULL THEN PERFORM venue_sale_fulfill(s.id); SELECT * INTO s FROM venue_sales WHERE id=s.id; END IF;
 RETURN s;
END $$;
CREATE FUNCTION public.payment_reserve_venue_appointment(p_actor uuid,p_id uuid,p_expected integer,p_amount integer,p_request uuid,p_live boolean)
RETURNS payment_orders LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s venue_sales;o payment_orders;a venue_payment_accounts;v venues;c venue_customers;
BEGIN
 s:=venue_appointment_collect_internal(p_actor,p_id,p_expected,'stripe',p_amount,p_request);
 IF s.payment_order_id IS NOT NULL THEN SELECT * INTO o FROM payment_orders WHERE id=s.payment_order_id; RETURN o; END IF;
 SELECT * INTO v FROM venues WHERE id=s.venue_id;SELECT * INTO c FROM venue_customers WHERE id=s.customer_id;
 SELECT * INTO a FROM venue_payment_accounts WHERE venue_id=v.id AND livemode AND connected_by=v.owner_id AND disconnected_at IS NULL AND charges_enabled AND payouts_enabled AND card_payments_active AND disabled_reason IS NULL;
 IF NOT FOUND OR p_live IS DISTINCT FROM true OR NOT payment_venue_owner_eligible(v.id,v.owner_id,true) THEN RAISE EXCEPTION 'Complete live venue Stripe verification before collecting card payments'; END IF;
 INSERT INTO payment_orders(buyer_id,venue_id,kind,venue_sale_id,description,merchant_name,account_id,livemode,amount_cents,billing_cadence,policy_snapshot,request_key)
 VALUES(c.user_id,v.id,'venue_sale',s.id,s.product_name,v.name,a.account_id,true,s.amount_cents,'one_time',s.policy_snapshot,p_request) RETURNING * INTO o;
 UPDATE venue_sales SET payment_order_id=o.id WHERE id=s.id;RETURN o;
END $$;
CREATE FUNCTION public.sync_venue_appointment_sale() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a venue_appointments;paid integer;
BEGIN
 IF NEW.appointment_id IS NULL OR NEW.status IS NOT DISTINCT FROM OLD.status AND NEW.refunded_cents IS NOT DISTINCT FROM OLD.refunded_cents THEN RETURN NEW; END IF;
 SELECT * INTO a FROM venue_appointments WHERE id=NEW.appointment_id FOR UPDATE;
 SELECT coalesce(sum(amount_cents-refunded_cents),0) INTO paid FROM venue_sales WHERE appointment_id=a.id AND status IN ('paid','partially_refunded','refunded');
 IF NEW.status='paid' AND a.status='held' AND paid>=a.deposit_cents AND a.end_time>now() THEN
  UPDATE venue_appointments SET status='confirmed',version=version+1,updated_at=clock_timestamp() WHERE id=a.id;
  UPDATE venue_visits SET status='expected',version=version+1 WHERE id=a.visit_id AND status='pending_payment';
 ELSIF (NEW.status='expired' AND a.status='held') OR (NEW.status IN ('refunded','partially_refunded') AND a.status IN ('held','confirmed') AND paid<a.deposit_cents) OR (NEW.status='paid' AND a.end_time<=now() AND a.status='held') THEN
  UPDATE venue_appointments SET status='canceled',cancellation_reason='Deposit was not completed or was refunded. Review any remaining collections.',version=version+1,updated_at=clock_timestamp() WHERE id=a.id;
  UPDATE venue_visits SET status='canceled',canceled_reason='Booking deposit canceled or refunded',version=version+1 WHERE id=a.visit_id AND status NOT IN ('canceled','expired');
  DELETE FROM group_events WHERE venue_appointment_id=a.id;
  UPDATE venue_sales SET needs_refund_review=true WHERE appointment_id=a.id AND status IN ('paid','partially_refunded');
 ELSIF NEW.status='paid' AND a.status='canceled' THEN UPDATE venue_sales SET needs_refund_review=true WHERE id=NEW.id;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER sync_venue_appointment_sale AFTER UPDATE ON venue_sales FOR EACH ROW EXECUTE FUNCTION sync_venue_appointment_sale();
CREATE FUNCTION public.venue_appointment_cancel(p_id uuid,p_expected integer,p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a venue_appointments;
BEGIN
 SELECT * INTO a FROM venue_appointments WHERE id=p_id FOR UPDATE;
 IF NOT venue_desk_access(a.venue_id) THEN RAISE EXCEPTION 'Venue desk access required' USING ERRCODE='42501'; END IF;
 IF a.version IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Booking changed. Refresh before canceling'; END IF;
 IF a.status='held' THEN RAISE EXCEPTION 'Cancel or reconcile the pending payment in Front desk before canceling this booking'; END IF;
 IF length(trim(coalesce(p_reason,'')))<5 THEN RAISE EXCEPTION 'Enter a cancellation reason'; END IF;
 UPDATE venue_appointments SET status='canceled',cancellation_reason=trim(p_reason),version=version+1,updated_at=clock_timestamp() WHERE id=a.id;
 UPDATE venue_visits SET status='canceled',canceled_reason=trim(p_reason),version=version+1 WHERE id=a.visit_id AND status NOT IN ('canceled','expired');
 DELETE FROM group_events WHERE venue_appointment_id=a.id;
 UPDATE venue_sales SET needs_refund_review=true WHERE appointment_id=a.id AND status IN ('paid','partially_refunded');
END $$;
CREATE FUNCTION public.sync_venue_appointment_visit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a venue_appointments;
BEGIN
 IF NEW.status='canceled' AND OLD.status<>'canceled' THEN
  SELECT * INTO a FROM venue_appointments WHERE visit_id=NEW.id AND status IN ('held','confirmed') FOR UPDATE;
  IF FOUND THEN UPDATE venue_appointments SET status='canceled',cancellation_reason=NEW.canceled_reason,version=version+1,updated_at=clock_timestamp() WHERE id=a.id; DELETE FROM group_events WHERE venue_appointment_id=a.id; UPDATE venue_sales SET needs_refund_review=true WHERE appointment_id=a.id AND status IN ('paid','partially_refunded'); END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER sync_venue_appointment_visit AFTER UPDATE ON venue_visits FOR EACH ROW EXECUTE FUNCTION sync_venue_appointment_visit();
CREATE FUNCTION public.venue_appointments_workspace(p_venue uuid,p_from date,p_to date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE tz text;
BEGIN
 IF NOT venue_desk_access(p_venue) THEN RAISE EXCEPTION 'Venue desk access required' USING ERRCODE='42501'; END IF;
 IF p_from IS NULL OR p_to IS NULL OR p_to<p_from OR p_to-p_from>180 THEN RAISE EXCEPTION 'Choose a range of up to 181 days'; END IF;
 SELECT coalesce(timezone,'America/New_York') INTO tz FROM venues WHERE id=p_venue;
 RETURN jsonb_build_object('can_manage',venue_desk_access(p_venue,true),'coaches',coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY name) FROM venue_coaches c WHERE venue_id=p_venue),'[]'::jsonb),
 'courts',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name) ORDER BY court_number) FROM venue_courts WHERE venue_id=p_venue AND is_active),'[]'::jsonb),
 'appointments',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY start_time) FROM (SELECT a.*,c.first_name,c.last_name,coalesce((SELECT sum(amount_cents-refunded_cents) FROM venue_sales WHERE appointment_id=a.id AND status IN ('paid','partially_refunded','refunded')),0) paid_cents,(SELECT id FROM venue_sales WHERE appointment_id=a.id AND status='pending' LIMIT 1) pending_sale_id,(SELECT method FROM venue_visits WHERE id=a.visit_id) visit_method FROM venue_appointments a JOIN venue_customers c ON c.id=a.customer_id WHERE a.venue_id=p_venue AND a.start_time>=p_from::timestamp AT TIME ZONE tz AND a.start_time<(p_to+1)::timestamp AT TIME ZONE tz) x),'[]'::jsonb));
END $$;
CREATE FUNCTION public.venue_appointment_quote(p_token uuid,p_accept boolean DEFAULT false,p_name text DEFAULT NULL,p_version integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a venue_appointments;v venues;coach text;
BEGIN
 IF auth.uid() IS NOT NULL AND NOT pulse_has_required_mfa() THEN RAISE EXCEPTION 'Complete account verification first' USING ERRCODE='42501'; END IF;
 SELECT * INTO a FROM venue_appointments WHERE quote_token=p_token FOR UPDATE;
 IF NOT FOUND OR (a.status='draft' AND a.quote_expires_at<=now()) THEN RAISE EXCEPTION 'This quote is unavailable or expired'; END IF;
 IF p_accept IS TRUE THEN
  IF a.status<>'draft' OR a.version IS DISTINCT FROM p_version OR length(trim(coalesce(p_name,''))) NOT BETWEEN 2 AND 150 THEN RAISE EXCEPTION 'Review the current quote and enter your name'; END IF;
  UPDATE venue_appointments SET agreed_at=coalesce(agreed_at,now()),agreed_name=coalesce(agreed_name,trim(p_name)) WHERE id=a.id RETURNING * INTO a;
 END IF;
 SELECT * INTO v FROM venues WHERE id=a.venue_id;SELECT name INTO coach FROM venue_coaches WHERE id=a.coach_id;
 RETURN jsonb_build_object('venue_name',v.name,'timezone',coalesce(v.timezone,'America/New_York'),'title',a.title,'kind',a.kind,'coach',coach,'start_time',a.start_time,'end_time',a.end_time,'courts',cardinality(a.court_ids),'total_cents',a.total_cents,'deposit_cents',a.deposit_cents,'policy',a.policy,'status',a.status,'agreed_at',a.agreed_at,'expires_at',a.quote_expires_at,'version',a.version);
END $$;
REVOKE ALL ON FUNCTION venue_coach_save(uuid,uuid,timestamptz,jsonb),venue_appointment_available(uuid),venue_appointment_save(uuid,uuid,integer,jsonb,uuid),venue_appointment_allocation_valid(group_events),guard_venue_appointment_allocation(),venue_appointment_collect_internal(uuid,uuid,integer,text,integer,uuid,uuid),venue_appointment_collect(uuid,integer,text,integer,uuid,boolean,boolean,uuid),payment_reserve_venue_appointment(uuid,uuid,integer,integer,uuid,boolean),sync_venue_appointment_sale(),venue_appointment_cancel(uuid,integer,text),sync_venue_appointment_visit(),venue_appointments_workspace(uuid,date,date),venue_appointment_quote(uuid,boolean,text,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION venue_coach_save(uuid,uuid,timestamptz,jsonb),venue_appointment_save(uuid,uuid,integer,jsonb,uuid),venue_appointment_collect(uuid,integer,text,integer,uuid,boolean,boolean,uuid),venue_appointment_cancel(uuid,integer,text),venue_appointments_workspace(uuid,date,date) TO authenticated;
GRANT EXECUTE ON FUNCTION payment_reserve_venue_appointment(uuid,uuid,integer,integer,uuid,boolean) TO service_role;
GRANT EXECUTE ON FUNCTION venue_appointment_quote(uuid,boolean,text,integer) TO anon,authenticated;
-- Validated appointment allocations are added to the existing court guards below.

CREATE OR REPLACE FUNCTION public.guard_court_payment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c uuid; v uuid; active boolean; rate numeric;
BEGIN
  IF TG_OP<>'DELETE' AND NEW.venue_appointment_id IS NOT NULL AND venue_appointment_allocation_valid(NEW) THEN RETURN NEW; END IF;
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
  IF TG_OP<>'DELETE' AND NEW.venue_appointment_id IS NOT NULL AND venue_appointment_allocation_valid(NEW) THEN RETURN NEW; END IF;
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
 IF NEW.event_format='reservation' AND NOT coalesce(venue_appointment_allocation_valid(NEW),false) AND NEW.venue_visit_id IS NULL AND NEW.payment_order_id IS NULL AND current_setting('role',true) IN ('authenticated','anon') THEN
  SELECT id INTO c FROM venue_customers WHERE venue_id=NEW.venue_id AND user_id=auth.uid();
  price:=venue_court_pricing(NEW.venue_court_id,NEW.start_time,NEW.end_time,c);
  IF (price->>'amount_cents')::integer>0 THEN RAISE EXCEPTION 'This time requires secure checkout or a front-desk payment'; END IF;
 END IF;
 RETURN NEW;
END $$;

COMMIT;
