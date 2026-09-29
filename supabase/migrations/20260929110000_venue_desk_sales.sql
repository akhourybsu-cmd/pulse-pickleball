-- Immutable sale snapshots, attributed cash receipts, and verified-card fulfillment.
BEGIN;
CREATE TABLE public.venue_products (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),venue_id uuid NOT NULL REFERENCES venues(id),
 name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 150), description text NOT NULL DEFAULT '' CHECK(length(description)<=4000),
 kind text NOT NULL CHECK(kind IN ('membership','visit_pass','court_hours','lesson_pack','guest_pass','merchandise','equipment_rental')),
 price_cents integer NOT NULL CHECK(price_cents BETWEEN 100 AND 99999999),
 billing_cadence text NOT NULL DEFAULT 'one_time' CHECK(billing_cadence IN ('one_time','monthly')),
 units integer NOT NULL DEFAULT 1 CHECK(units BETWEEN 1 AND 10000),valid_days integer NOT NULL DEFAULT 30 CHECK(valid_days BETWEEN 1 AND 3660),
 member_discount_percent integer NOT NULL DEFAULT 0 CHECK(member_discount_percent BETWEEN 0 AND 100),
 stock integer CHECK(stock>=0),active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(venue_id,id),CHECK(billing_cadence='one_time' OR kind='membership'),
 CHECK(kind<>'membership' OR units=1),CHECK(stock IS NULL OR kind IN ('merchandise','equipment_rental'))
);
CREATE TABLE public.venue_sales (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),venue_id uuid NOT NULL REFERENCES venues(id),customer_id uuid NOT NULL,product_id uuid NOT NULL,
 product_name text NOT NULL,product_kind text NOT NULL,quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 100),
 units integer NOT NULL,valid_days integer NOT NULL,member_discount_percent integer NOT NULL,
 amount_cents integer NOT NULL CHECK(amount_cents BETWEEN 100 AND 99999999),refunded_cents integer NOT NULL DEFAULT 0,
 method text NOT NULL CHECK(method IN ('cash','stripe')),status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','expired','partially_refunded','refunded')),
 billing_cadence text NOT NULL,policy_snapshot text NOT NULL,
 cashier_id uuid NOT NULL REFERENCES auth.users(id),request_key uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),paid_at timestamptz,
 payment_order_id uuid UNIQUE REFERENCES payment_orders(id),receipt_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,needs_refund_review boolean NOT NULL DEFAULT false,
 FOREIGN KEY(venue_id,customer_id) REFERENCES venue_customers(venue_id,id),
 FOREIGN KEY(venue_id,product_id) REFERENCES venue_products(venue_id,id),
 UNIQUE(venue_id,request_key),UNIQUE(venue_id,id),CHECK(refunded_cents BETWEEN 0 AND amount_cents)
);
CREATE TABLE public.venue_entitlements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),venue_id uuid NOT NULL REFERENCES venues(id),customer_id uuid NOT NULL,sale_id uuid NOT NULL UNIQUE,
 kind text NOT NULL,name text NOT NULL,total_units numeric(12,2) NOT NULL CHECK(total_units>0),remaining_units numeric(12,2) NOT NULL CHECK(remaining_units>=0),
 member_discount_percent integer NOT NULL DEFAULT 0,starts_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL,
 revoked_at timestamptz,FOREIGN KEY(venue_id,customer_id) REFERENCES venue_customers(venue_id,id),
 FOREIGN KEY(venue_id,sale_id) REFERENCES venue_sales(venue_id,id),CHECK(remaining_units<=total_units),UNIQUE(venue_id,id)
);
CREATE TABLE public.venue_entitlement_usage (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),venue_id uuid NOT NULL REFERENCES venues(id),entitlement_id uuid NOT NULL,
 units numeric(12,2) NOT NULL CHECK(units>0),request_key uuid NOT NULL,description text NOT NULL CHECK(length(trim(description)) BETWEEN 3 AND 500),
 actor_id uuid NOT NULL REFERENCES auth.users(id),created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(venue_id,entitlement_id) REFERENCES venue_entitlements(venue_id,id),UNIQUE(entitlement_id,request_key)
);
CREATE TABLE public.venue_cash_refunds (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),venue_id uuid NOT NULL REFERENCES venues(id),sale_id uuid NOT NULL,
 amount_cents integer NOT NULL CHECK(amount_cents>0),reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 5 AND 1000),
 actor_id uuid NOT NULL REFERENCES auth.users(id),request_key uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(venue_id,sale_id) REFERENCES venue_sales(venue_id,id),UNIQUE(sale_id,request_key)
);
CREATE TABLE public.venue_cash_closings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),venue_id uuid NOT NULL REFERENCES venues(id),day date NOT NULL,
 expected_cents integer NOT NULL,counted_cents integer NOT NULL CHECK(counted_cents>=0),note text NOT NULL DEFAULT '' CHECK(length(note)<=2000),
 actor_id uuid NOT NULL REFERENCES auth.users(id),created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(venue_id,day)
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['venue_products','venue_sales','venue_entitlements','venue_entitlement_usage','venue_cash_refunds','venue_cash_closings'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
  EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
  EXECUTE format('CREATE POLICY pulse_required_mfa ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.pulse_has_required_mfa())) WITH CHECK ((SELECT public.pulse_has_required_mfa()))',t);
 END LOOP;
END $$;

ALTER TABLE payment_orders DROP CONSTRAINT payment_orders_kind_check;
ALTER TABLE payment_orders ADD CONSTRAINT payment_orders_kind_check CHECK(kind IN ('venue_module','court_rental','league_slot','tournament_license','division_slot','event_registration','venue_sale'));
ALTER TABLE payment_orders ADD COLUMN venue_sale_id uuid REFERENCES venue_sales(id);
ALTER TABLE payment_orders ALTER COLUMN buyer_id DROP NOT NULL;
ALTER TABLE payment_orders ADD CONSTRAINT payment_buyer_shape CHECK(buyer_id IS NOT NULL OR kind='venue_sale');
ALTER TABLE payment_orders ADD CONSTRAINT payment_sale_shape CHECK(kind<>'venue_sale' OR (venue_sale_id IS NOT NULL AND venue_id IS NOT NULL));
ALTER TABLE payment_subscriptions ALTER COLUMN module_key DROP NOT NULL;
ALTER TABLE payment_subscriptions ADD CONSTRAINT payment_subscription_shape CHECK(module_key IS NOT NULL OR buyer_id IS NOT NULL);

CREATE FUNCTION public.venue_product_save(p_venue uuid,p_id uuid,p_expected timestamptz,p_document jsonb)
RETURNS venue_products LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p venue_products;
BEGIN
 IF NOT venue_desk_access(p_venue,true) THEN RAISE EXCEPTION 'Venue management access required' USING ERRCODE='42501'; END IF;
 IF p_document IS NULL OR jsonb_typeof(p_document)<>'object' OR p_document->>'tax_inclusive_acknowledged' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Confirm prices include any applicable taxes'; END IF;
 IF p_id IS NOT NULL THEN
  SELECT * INTO p FROM venue_products WHERE id=p_id AND venue_id=p_venue FOR UPDATE;
  IF NOT FOUND OR p.updated_at IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Product changed. Refresh before saving.' USING ERRCODE='40001'; END IF;
  IF EXISTS(SELECT 1 FROM venue_sales WHERE product_id=p.id AND status='pending') THEN RAISE EXCEPTION 'Resolve pending sales before editing this product'; END IF;
 END IF;
 INSERT INTO venue_products(id,venue_id,name,description,kind,price_cents,billing_cadence,units,valid_days,member_discount_percent,stock,active)
 VALUES(coalesce(p_id,gen_random_uuid()),p_venue,trim(p_document->>'name'),coalesce(p_document->>'description',''),p_document->>'kind',
  (p_document->>'price_cents')::integer,coalesce(p_document->>'billing_cadence','one_time'),coalesce((p_document->>'units')::integer,1),
  coalesce((p_document->>'valid_days')::integer,30),coalesce((p_document->>'member_discount_percent')::integer,0),(p_document->>'stock')::integer,coalesce((p_document->>'active')::boolean,true))
 ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,kind=excluded.kind,price_cents=excluded.price_cents,billing_cadence=excluded.billing_cadence,
  units=excluded.units,valid_days=excluded.valid_days,member_discount_percent=excluded.member_discount_percent,stock=excluded.stock,active=excluded.active,updated_at=clock_timestamp() RETURNING * INTO p;
 RETURN p;
END $$;

-- Internal-only helper. Its caller must verify the actor and MFA before invocation.
CREATE FUNCTION public.venue_sale_prepare(p_actor uuid,p_customer uuid,p_product uuid,p_quantity integer,p_method text,p_expected integer,p_request uuid)
RETURNS venue_sales LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c venue_customers;p venue_products;s venue_sales;v venues;policy text;reserved bigint;
BEGIN
 SELECT * INTO c FROM venue_customers WHERE id=p_customer;
 IF NOT FOUND THEN RAISE EXCEPTION 'Player not found'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(c.venue_id::text||p_request::text,845));
 SELECT * INTO s FROM venue_sales WHERE venue_id=c.venue_id AND request_key=p_request;
 IF FOUND THEN
  IF (s.customer_id,s.product_id,s.quantity,s.method,s.amount_cents,s.cashier_id) IS DISTINCT FROM (c.id,p_product,p_quantity,p_method,p_expected,p_actor) THEN RAISE EXCEPTION 'Sale request changed. Review the sale again.'; END IF;
  RETURN s;
 END IF;
 IF p_request IS NULL OR p_quantity IS NULL OR p_quantity NOT BETWEEN 1 AND 100 OR p_method NOT IN ('cash','stripe') THEN RAISE EXCEPTION 'Choose a valid quantity and payment method'; END IF;
 SELECT * INTO v FROM venues WHERE id=c.venue_id;
 PERFORM id FROM venues WHERE id=v.id FOR UPDATE;
 IF p_method='cash' AND EXISTS(SELECT 1 FROM venue_cash_closings WHERE venue_id=v.id AND day=(now() AT TIME ZONE coalesce(v.timezone,'America/New_York'))::date) THEN RAISE EXCEPTION 'The cash day is closed. Ask a manager to reconcile the day before recording more cash.'; END IF;
 IF EXISTS(SELECT 1 FROM private_venue_sandboxes WHERE venue_id=v.id) THEN RAISE EXCEPTION 'Sales are unavailable in sample venues'; END IF;
 SELECT * INTO p FROM venue_products WHERE id=p_product AND venue_id=c.venue_id AND active FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Product unavailable'; END IF;
 IF p.price_cents::bigint*p_quantity>99999999 OR p.price_cents*p_quantity IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Price changed. Review the total again.'; END IF;
 IF p.kind='membership' AND p_quantity<>1 THEN RAISE EXCEPTION 'Sell one membership at a time'; END IF;
 IF p.billing_cadence='monthly' AND (p_method<>'stripe' OR c.user_id IS NULL) THEN RAISE EXCEPTION 'Monthly auto-renewal requires a linked PULSE player and Stripe checkout. Use a one-time membership for cash or guests.'; END IF;
 IF p.kind='membership' AND (EXISTS(SELECT 1 FROM venue_entitlements WHERE customer_id=c.id AND kind='membership' AND revoked_at IS NULL AND expires_at>now())
  OR EXISTS(SELECT 1 FROM venue_sales WHERE customer_id=c.id AND product_kind='membership' AND status='pending')) THEN RAISE EXCEPTION 'This player already has an active or pending membership'; END IF;
 SELECT coalesce(sum(quantity),0) INTO reserved FROM venue_sales WHERE product_id=p.id AND status='pending';
 IF p.stock IS NOT NULL AND p.stock<reserved+p_quantity THEN RAISE EXCEPTION 'Insufficient stock; another desk may have reserved this item'; END IF;
 SELECT cancellation_policy INTO policy FROM venue_payment_settings WHERE venue_id=v.id;
 IF length(coalesce(policy,''))<20 THEN RAISE EXCEPTION 'Save the venue cancellation policy in Payments before selling'; END IF;
 INSERT INTO venue_sales(venue_id,customer_id,product_id,product_name,product_kind,quantity,units,valid_days,member_discount_percent,amount_cents,method,billing_cadence,policy_snapshot,cashier_id,request_key)
 VALUES(v.id,c.id,p.id,p.name,p.kind,p_quantity,p.units,p.valid_days,p.member_discount_percent,p_expected,p_method,p.billing_cadence,policy,p_actor,p_request) RETURNING * INTO s;
 RETURN s;
END $$;

CREATE FUNCTION public.venue_sale_fulfill(p_sale uuid,p_through timestamptz DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s venue_sales;
BEGIN
 SELECT * INTO s FROM venue_sales WHERE id=p_sale FOR UPDATE;
 IF NOT FOUND OR s.status<>'pending' THEN RETURN; END IF;
 UPDATE venue_sales SET status='paid',paid_at=now() WHERE id=s.id;
 UPDATE venue_products SET stock=stock-s.quantity,updated_at=clock_timestamp() WHERE id=s.product_id AND stock IS NOT NULL;
 IF s.product_kind IN ('membership','visit_pass','court_hours','lesson_pack','guest_pass') THEN
  INSERT INTO venue_entitlements(venue_id,customer_id,sale_id,kind,name,total_units,remaining_units,member_discount_percent,expires_at)
  VALUES(s.venue_id,s.customer_id,s.id,s.product_kind,s.product_name,s.units*s.quantity,s.units*s.quantity,s.member_discount_percent,coalesce(p_through,now()+make_interval(days=>s.valid_days))) ON CONFLICT(sale_id) DO NOTHING;
 END IF;
END $$;
CREATE FUNCTION public.venue_cash_sale(p_customer uuid,p_product uuid,p_quantity integer,p_expected integer,p_request uuid,p_cash_received boolean)
RETURNS venue_sales LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s venue_sales;v uuid;
BEGIN
 SELECT venue_id INTO v FROM venue_customers WHERE id=p_customer;
 IF NOT venue_desk_access(v) THEN RAISE EXCEPTION 'Venue desk access required' USING ERRCODE='42501'; END IF;
 IF p_cash_received IS DISTINCT FROM true THEN RAISE EXCEPTION 'Confirm the cash was received before recording payment'; END IF;
 s:=venue_sale_prepare(auth.uid(),p_customer,p_product,p_quantity,'cash',p_expected,p_request);
 PERFORM venue_sale_fulfill(s.id);
 SELECT * INTO s FROM venue_sales WHERE id=s.id;
 RETURN s;
END $$;

CREATE FUNCTION public.payment_reserve_venue_sale(p_actor uuid,p_customer uuid,p_product uuid,p_quantity integer,p_expected integer,p_request uuid,p_live boolean)
RETURNS payment_orders LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s venue_sales;c venue_customers;v venues;a venue_payment_accounts;o payment_orders;
BEGIN
 SELECT * INTO c FROM venue_customers WHERE id=p_customer;
 SELECT * INTO v FROM venues WHERE id=c.venue_id;
 IF p_actor IS NULL OR NOT (v.owner_id=p_actor OR EXISTS(SELECT 1 FROM venue_staff WHERE venue_id=v.id AND user_id=p_actor AND is_active IS NOT FALSE AND (status IS NULL OR status::text='active') AND (role::text IN ('owner','manager') OR (role::text='staff' AND venue_has_module(v.id,'facility_tools'))))) THEN RAISE EXCEPTION 'Venue desk access required' USING ERRCODE='42501'; END IF;
 IF p_live IS DISTINCT FROM true THEN RAISE EXCEPTION 'Desk sales require live venue payment setup'; END IF;
 SELECT * INTO a FROM venue_payment_accounts WHERE venue_id=v.id AND livemode AND connected_by=v.owner_id AND disconnected_at IS NULL AND charges_enabled AND payouts_enabled AND card_payments_active AND disabled_reason IS NULL;
 IF NOT FOUND OR NOT payment_venue_owner_eligible(v.id,v.owner_id,true) THEN RAISE EXCEPTION 'Complete Stripe verification before collecting card payments'; END IF;
 s:=venue_sale_prepare(p_actor,c.id,p_product,p_quantity,'stripe',p_expected,p_request);
 IF s.payment_order_id IS NOT NULL THEN SELECT * INTO o FROM payment_orders WHERE id=s.payment_order_id; RETURN o; END IF;
 INSERT INTO payment_orders(buyer_id,venue_id,kind,venue_sale_id,description,merchant_name,account_id,livemode,amount_cents,billing_cadence,policy_snapshot,request_key)
 VALUES(c.user_id,v.id,'venue_sale',s.id,s.product_name||' x '||s.quantity,v.name,a.account_id,true,s.amount_cents,s.billing_cadence,s.policy_snapshot,p_request) RETURNING * INTO o;
 UPDATE venue_sales SET payment_order_id=o.id WHERE id=s.id;
 RETURN o;
END $$;

ALTER FUNCTION public.payment_apply_result(uuid,text,boolean,text,text,integer,text,text,text,text,timestamptz) RENAME TO payment_apply_result_before_desk;
CREATE FUNCTION public.payment_apply_result(p_order uuid,p_account text,p_live boolean,p_session text,p_status text,p_amount integer,p_currency text,p_intent text,p_customer text,p_subscription text DEFAULT NULL,p_paid_through timestamptz DEFAULT NULL)
RETURNS payment_orders LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o payment_orders;
BEGIN
 o:=payment_apply_result_before_desk(p_order,p_account,p_live,p_session,p_status,p_amount,p_currency,p_intent,p_customer,p_subscription,p_paid_through);
 IF o.kind='venue_sale' AND o.livemode THEN
  IF o.status='paid' THEN PERFORM venue_sale_fulfill(o.venue_sale_id,p_paid_through);
  ELSIF o.status='expired' THEN UPDATE venue_sales SET status='expired' WHERE id=o.venue_sale_id AND status='pending'; END IF;
 END IF;
 RETURN o;
END $$;

CREATE FUNCTION public.venue_use_entitlement(p_entitlement uuid,p_units numeric,p_request uuid,p_description text)
RETURNS venue_entitlements LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e venue_entitlements;u venue_entitlement_usage;
BEGIN
 SELECT * INTO e FROM venue_entitlements WHERE id=p_entitlement FOR UPDATE;
 IF NOT FOUND OR NOT venue_desk_access(e.venue_id) THEN RAISE EXCEPTION 'Venue desk access required' USING ERRCODE='42501'; END IF;
 SELECT * INTO u FROM venue_entitlement_usage WHERE entitlement_id=e.id AND request_key=p_request;
 IF FOUND THEN IF u.units IS DISTINCT FROM p_units OR u.description IS DISTINCT FROM trim(p_description) THEN RAISE EXCEPTION 'Redemption request changed'; END IF; RETURN e; END IF;
 IF p_units IS NULL OR p_units<0.5 OR (e.kind<>'court_hours' AND mod(p_units,1)<>0) OR (e.kind='court_hours' AND mod(p_units,0.5)<>0) OR e.kind='membership' OR e.revoked_at IS NOT NULL OR e.expires_at<=now() OR e.remaining_units<p_units THEN RAISE EXCEPTION 'This pass has insufficient valid units'; END IF;
 INSERT INTO venue_entitlement_usage(venue_id,entitlement_id,units,request_key,description,actor_id) VALUES(e.venue_id,e.id,p_units,p_request,trim(p_description),auth.uid());
 UPDATE venue_entitlements SET remaining_units=remaining_units-p_units WHERE id=e.id RETURNING * INTO e;
 RETURN e;
END $$;
CREATE FUNCTION public.venue_cash_refund(p_sale uuid,p_amount integer,p_reason text,p_request uuid,p_cash_returned boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s venue_sales;r venue_cash_refunds;
BEGIN
 SELECT * INTO s FROM venue_sales WHERE id=p_sale FOR UPDATE;
 IF NOT FOUND OR NOT pulse_has_required_mfa() OR NOT EXISTS(SELECT 1 FROM venues WHERE id=s.venue_id AND owner_id=auth.uid()) THEN RAISE EXCEPTION 'Venue owner access required' USING ERRCODE='42501'; END IF;
 PERFORM id FROM venues WHERE id=s.venue_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM venue_cash_closings c JOIN venues v ON v.id=c.venue_id WHERE c.venue_id=s.venue_id AND c.day=(now() AT TIME ZONE coalesce(v.timezone,'America/New_York'))::date) THEN RAISE EXCEPTION 'The cash day is closed'; END IF;
 SELECT * INTO r FROM venue_cash_refunds WHERE sale_id=s.id AND request_key=p_request;
 IF FOUND THEN IF r.amount_cents IS DISTINCT FROM p_amount THEN RAISE EXCEPTION 'Refund request changed'; END IF; RETURN; END IF;
 IF p_cash_returned IS DISTINCT FROM true OR s.method<>'cash' OR s.status NOT IN ('paid','partially_refunded') OR p_amount IS NULL OR p_amount<=0 OR p_amount>s.amount_cents-s.refunded_cents THEN RAISE EXCEPTION 'Confirm cash returned and enter a valid remaining refund amount'; END IF;
 INSERT INTO venue_cash_refunds(venue_id,sale_id,amount_cents,reason,actor_id,request_key) VALUES(s.venue_id,s.id,p_amount,trim(p_reason),auth.uid(),p_request);
 UPDATE venue_sales SET refunded_cents=refunded_cents+p_amount,status=CASE WHEN refunded_cents+p_amount=amount_cents THEN 'refunded' ELSE 'partially_refunded' END WHERE id=s.id;
 IF s.refunded_cents+p_amount=s.amount_cents THEN UPDATE venue_entitlements SET revoked_at=now() WHERE sale_id=s.id; END IF;
END $$;
CREATE FUNCTION public.sync_venue_sale_refund() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.kind='venue_sale' AND NEW.livemode AND NEW.status IN ('paid','partially_refunded','refunded') AND (NEW.refunded_cents IS DISTINCT FROM OLD.refunded_cents OR NEW.disputed IS DISTINCT FROM OLD.disputed) THEN
  UPDATE venue_sales SET refunded_cents=NEW.refunded_cents,status=NEW.status WHERE id=NEW.venue_sale_id;
  IF NEW.refunded_cents=NEW.amount_cents OR NEW.disputed THEN UPDATE venue_entitlements SET revoked_at=coalesce(revoked_at,now()) WHERE sale_id=NEW.venue_sale_id; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER sync_venue_sale_refund AFTER UPDATE ON payment_orders FOR EACH ROW EXECUTE FUNCTION sync_venue_sale_refund();

CREATE FUNCTION public.venue_desk_workspace(p_venue uuid,p_day date,p_customer uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE tz text;a timestamptz;b timestamptz;cash integer;refunds integer;
BEGIN
 IF NOT venue_desk_access(p_venue) THEN RAISE EXCEPTION 'Venue desk access required' USING ERRCODE='42501'; END IF;
 IF p_day IS NULL OR NOT isfinite(p_day) THEN RAISE EXCEPTION 'Choose a valid day'; END IF;
 SELECT coalesce(timezone,'America/New_York') INTO tz FROM venues WHERE id=p_venue;
 a:=p_day::timestamp AT TIME ZONE tz;b:=(p_day+1)::timestamp AT TIME ZONE tz;
 SELECT coalesce(sum(amount_cents),0)::integer INTO cash FROM venue_sales WHERE venue_id=p_venue AND method='cash' AND paid_at>=a AND paid_at<b;
 SELECT coalesce(sum(amount_cents),0)::integer INTO refunds FROM venue_cash_refunds WHERE venue_id=p_venue AND created_at>=a AND created_at<b;
 RETURN jsonb_build_object('can_manage',venue_desk_access(p_venue,true),'is_owner',EXISTS(SELECT 1 FROM venues WHERE id=p_venue AND owner_id=auth.uid()),'timezone',tz,
  'policy',(SELECT cancellation_policy FROM venue_payment_settings WHERE venue_id=p_venue),
  'cash_collected_cents',cash,'cash_refunded_cents',refunds,'cash_expected_cents',cash-refunds,
  'closing',(SELECT to_jsonb(c) FROM venue_cash_closings c WHERE venue_id=p_venue AND day=p_day),
  'products',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY active DESC,name) FROM venue_products p WHERE venue_id=p_venue),'[]'::jsonb),
  'sales',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY created_at DESC) FROM (SELECT s.*,c.first_name,c.last_name FROM venue_sales s JOIN venue_customers c ON c.id=s.customer_id
   WHERE s.venue_id=p_venue AND (p_customer IS NULL OR s.customer_id=p_customer) AND s.created_at>=a AND s.created_at<b ORDER BY s.created_at DESC LIMIT 500) x),'[]'::jsonb),
  'entitlements',coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY expires_at) FROM venue_entitlements e WHERE venue_id=p_venue AND customer_id=p_customer),'[]'::jsonb));
END $$;
CREATE FUNCTION public.venue_cash_close(p_venue uuid,p_day date,p_expected integer,p_counted integer,p_note text)
RETURNS venue_cash_closings LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE w jsonb;c venue_cash_closings;
BEGIN
 IF NOT venue_desk_access(p_venue,true) THEN RAISE EXCEPTION 'Venue management access required' USING ERRCODE='42501'; END IF;
 PERFORM id FROM venues WHERE id=p_venue FOR UPDATE;
 w:=venue_desk_workspace(p_venue,p_day);
 IF p_day>(now() AT TIME ZONE (w->>'timezone'))::date OR (w->>'cash_expected_cents')::integer IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Cash totals changed or date is in the future. Refresh before closing.'; END IF;
 INSERT INTO venue_cash_closings(venue_id,day,expected_cents,counted_cents,note,actor_id) VALUES(p_venue,p_day,p_expected,p_counted,trim(coalesce(p_note,'')),auth.uid()) RETURNING * INTO c;
 RETURN c;
END $$;

CREATE FUNCTION public.venue_sale_receipt(p_token uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE s venue_sales;v venues;
BEGIN
 SELECT * INTO s FROM venue_sales WHERE receipt_token=p_token;
 IF NOT FOUND THEN RAISE EXCEPTION 'Receipt unavailable'; END IF;
 SELECT * INTO v FROM venues WHERE id=s.venue_id;
 RETURN jsonb_build_object('venue_name',v.name,'description',s.product_name,'quantity',s.quantity,'amount_cents',s.amount_cents,'refunded_cents',s.refunded_cents,'status',s.status,'method',s.method,'billing_cadence',s.billing_cadence,'policy',s.policy_snapshot,'created_at',s.created_at,'paid_at',s.paid_at);
END $$;
REVOKE ALL ON FUNCTION venue_sale_receipt(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION venue_sale_receipt(uuid) TO anon,authenticated;

REVOKE ALL ON FUNCTION venue_product_save(uuid,uuid,timestamptz,jsonb),venue_cash_sale(uuid,uuid,integer,integer,uuid,boolean),venue_use_entitlement(uuid,numeric,uuid,text),venue_cash_refund(uuid,integer,text,uuid,boolean),venue_desk_workspace(uuid,date,uuid),venue_cash_close(uuid,date,integer,integer,text),venue_sale_prepare(uuid,uuid,uuid,integer,text,integer,uuid),venue_sale_fulfill(uuid,timestamptz),payment_reserve_venue_sale(uuid,uuid,uuid,integer,integer,uuid,boolean),payment_apply_result_before_desk(uuid,text,boolean,text,text,integer,text,text,text,text,timestamptz),payment_apply_result(uuid,text,boolean,text,text,integer,text,text,text,text,timestamptz),sync_venue_sale_refund() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION venue_product_save(uuid,uuid,timestamptz,jsonb),venue_cash_sale(uuid,uuid,integer,integer,uuid,boolean),venue_use_entitlement(uuid,numeric,uuid,text),venue_cash_refund(uuid,integer,text,uuid,boolean),venue_desk_workspace(uuid,date,uuid),venue_cash_close(uuid,date,integer,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION payment_reserve_venue_sale(uuid,uuid,uuid,integer,integer,uuid,boolean),payment_apply_result(uuid,text,boolean,text,text,integer,text,text,text,text,timestamptz) TO service_role;

ALTER FUNCTION public.payment_record_renewal(text,text,integer,text,text,text,timestamptz) RENAME TO payment_record_renewal_before_desk;
CREATE FUNCTION public.payment_record_renewal(p_subscription text,p_invoice text,p_amount integer,p_currency text,p_intent text,p_customer text,p_through timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE sub payment_subscriptions;o payment_orders;original venue_sales;s venue_sales;new_order uuid;
BEGIN
 SELECT * INTO sub FROM payment_subscriptions WHERE subscription_id=p_subscription FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Subscription checkout must be reconciled before its renewal'; END IF;
 SELECT * INTO o FROM payment_orders WHERE id=sub.order_id;
 IF o.kind<>'venue_sale' THEN PERFORM payment_record_renewal_before_desk(p_subscription,p_invoice,p_amount,p_currency,p_intent,p_customer,p_through); RETURN; END IF;
 IF p_amount IS DISTINCT FROM o.amount_cents OR p_currency IS DISTINCT FROM o.currency OR p_customer IS DISTINCT FROM o.customer_id OR p_intent IS NULL OR p_invoice IS NULL OR p_through IS NULL OR NOT isfinite(p_through) OR o.billing_cadence<>'monthly' THEN RAISE EXCEPTION 'Renewal payment mismatch'; END IF;
 IF EXISTS(SELECT 1 FROM payment_orders WHERE account_id=o.account_id AND livemode=o.livemode AND invoice_id=p_invoice) THEN RETURN; END IF;
 SELECT * INTO original FROM venue_sales WHERE id=o.venue_sale_id;
 INSERT INTO venue_sales(venue_id,customer_id,product_id,product_name,product_kind,quantity,units,valid_days,member_discount_percent,amount_cents,method,billing_cadence,policy_snapshot,cashier_id,request_key)
 VALUES(original.venue_id,original.customer_id,original.product_id,original.product_name,original.product_kind,original.quantity,original.units,original.valid_days,original.member_discount_percent,p_amount,'stripe','monthly',original.policy_snapshot,original.cashier_id,gen_random_uuid()) RETURNING * INTO s;
 INSERT INTO payment_orders(buyer_id,venue_id,kind,venue_sale_id,billing_cadence,description,merchant_name,account_id,livemode,amount_cents,status,payment_intent_id,subscription_id,invoice_id,customer_id,request_key,policy_snapshot,paid_at)
 VALUES(o.buyer_id,o.venue_id,'venue_sale',s.id,'monthly',o.description,o.merchant_name,o.account_id,o.livemode,p_amount,'paid',p_intent,p_subscription,p_invoice,p_customer,gen_random_uuid(),o.policy_snapshot,now()) RETURNING id INTO new_order;
 UPDATE venue_sales SET payment_order_id=new_order WHERE id=s.id;
 IF o.livemode THEN PERFORM venue_sale_fulfill(s.id,p_through); END IF;
 UPDATE payment_subscriptions SET paid_through=greatest(paid_through,p_through),updated_at=now() WHERE subscription_id=sub.subscription_id;
END $$;
REVOKE ALL ON FUNCTION payment_record_renewal_before_desk(text,text,integer,text,text,text,timestamptz),payment_record_renewal(text,text,integer,text,text,text,timestamptz) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION payment_record_renewal(text,text,integer,text,text,text,timestamptz) TO service_role;
COMMIT;
