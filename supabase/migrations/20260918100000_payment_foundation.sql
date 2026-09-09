-- PULSE billing and venue direct payments. This migration does NOT enable charging.
-- Deploy the payment functions/configuration before enabling checkout in Stripe.
-- Card numbers, CVCs and bank details must never be written to these tables.
-- Venue features are $10 USD per feature per month; court rentals are one-time payments.
BEGIN;

CREATE TABLE public.venue_payment_accounts (
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE RESTRICT,
  livemode boolean NOT NULL,
  account_id text NOT NULL CHECK (account_id LIKE 'acct_%'),
  connected_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  charges_enabled boolean NOT NULL DEFAULT false,
  payouts_enabled boolean NOT NULL DEFAULT false,
  details_submitted boolean NOT NULL DEFAULT false,
  disabled_reason text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (venue_id,livemode), UNIQUE(account_id,livemode)
);
CREATE TABLE public.venue_payment_settings (
  venue_id uuid PRIMARY KEY REFERENCES public.venues(id) ON DELETE RESTRICT,
  accepting_payments boolean NOT NULL DEFAULT false,
  cancellation_policy text NOT NULL DEFAULT '',
  support_email text NOT NULL DEFAULT '',
  timezone text NOT NULL DEFAULT '',
  tax_inclusive_acknowledged boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.payment_customers (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  account_id text NOT NULL,
  livemode boolean NOT NULL,
  customer_id text NOT NULL CHECK (customer_id LIKE 'cus_%'),
  merchant_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,account_id,livemode), UNIQUE(account_id,livemode,customer_id)
);
CREATE TABLE public.payment_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  venue_id uuid REFERENCES public.venues(id) ON DELETE RESTRICT,
  group_id uuid REFERENCES public.groups(id) ON DELETE RESTRICT,
  court_id uuid REFERENCES public.venue_courts(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK(kind IN ('venue_module','court_rental','league_slot','tournament_license','division_slot')),
  module_key text CHECK(module_key IN ('court_booking','facility_tools')),
  billing_cadence text NOT NULL DEFAULT 'one_time' CHECK(billing_cadence IN ('one_time','monthly')),
  description text NOT NULL,
  merchant_name text NOT NULL,
  account_id text NOT NULL,
  livemode boolean NOT NULL,
  amount_cents integer NOT NULL CHECK(amount_cents BETWEEN 50 AND 99999999),
  currency text NOT NULL DEFAULT 'usd' CHECK(currency='usd'),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','expired','partially_refunded','refunded')),
  refunded_cents integer NOT NULL DEFAULT 0 CHECK(refunded_cents >= 0 AND refunded_cents <= amount_cents),
  disputed boolean NOT NULL DEFAULT false,
  checkout_session_id text,
  payment_intent_id text,
  subscription_id text,
  invoice_id text,
  customer_id text,
  start_time timestamptz,
  end_time timestamptz,
  expires_at timestamptz NOT NULL DEFAULT now()+interval '31 minutes',
  policy_snapshot text NOT NULL DEFAULT '',
  terms_accepted_at timestamptz NOT NULL DEFAULT now(),
  request_key uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  canceled_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(buyer_id,livemode,request_key),
  UNIQUE(account_id,livemode,checkout_session_id),
  UNIQUE(account_id,livemode,invoice_id),
  CHECK(kind <> 'court_rental' OR (court_id IS NOT NULL AND group_id IS NOT NULL AND venue_id IS NOT NULL AND end_time > start_time AND billing_cadence='one_time')),
  CHECK(kind <> 'venue_module' OR (venue_id IS NOT NULL AND module_key IS NOT NULL AND amount_cents=1000 AND billing_cadence='monthly'))
);
CREATE INDEX payment_orders_buyer_history ON public.payment_orders(buyer_id,created_at DESC,id DESC);
CREATE INDEX payment_orders_venue_history ON public.payment_orders(venue_id,created_at DESC);
CREATE INDEX payment_orders_court_holds ON public.payment_orders(court_id,start_time) WHERE status='pending';
CREATE INDEX payment_orders_intent ON public.payment_orders(account_id,payment_intent_id);
CREATE UNIQUE INDEX payment_module_active_checkout ON public.payment_orders(venue_id,module_key,livemode) WHERE kind='venue_module' AND status='pending';

CREATE TABLE public.payment_subscriptions (
  subscription_id text PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.payment_orders(id),
  venue_id uuid NOT NULL REFERENCES public.venues(id),
  module_key text NOT NULL,
  buyer_id uuid NOT NULL REFERENCES auth.users(id),
  account_id text NOT NULL,
  livemode boolean NOT NULL,
  status text NOT NULL,
  paid_through timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.payment_webhook_events (
  account_id text NOT NULL,
  event_id text NOT NULL,
  livemode boolean NOT NULL,
  event_type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(account_id,livemode,event_id)
);
ALTER TABLE public.group_events ADD COLUMN payment_order_id uuid UNIQUE REFERENCES public.payment_orders(id) ON DELETE RESTRICT;

-- Financial records are private, server-written and retained independently of UI state.
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['venue_payment_accounts','venue_payment_settings','payment_customers','payment_orders','payment_subscriptions','payment_webhook_events'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
  END LOOP;
END $$;
GRANT SELECT ON public.payment_orders,public.venue_payment_accounts,public.venue_payment_settings TO authenticated;
CREATE POLICY payment_orders_read ON public.payment_orders FOR SELECT TO authenticated USING (
  buyer_id=auth.uid() OR (kind='court_rental' AND EXISTS(SELECT 1 FROM public.venues v WHERE v.id=venue_id AND v.owner_id=auth.uid()))
);
CREATE POLICY venue_payment_accounts_read ON public.venue_payment_accounts FOR SELECT TO authenticated USING (
  EXISTS(SELECT 1 FROM public.venues v WHERE v.id=venue_id AND v.owner_id=auth.uid())
);
CREATE POLICY venue_payment_settings_read ON public.venue_payment_settings FOR SELECT TO authenticated USING (
  EXISTS(SELECT 1 FROM public.venues v WHERE v.id=venue_id AND v.owner_id=auth.uid())
);

-- Serialize every court writer with payment holds. Holds remain occupied until
-- Stripe confirms expiration, never just because a local timer has elapsed.
CREATE FUNCTION public.guard_court_payment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c uuid; v uuid; active boolean; rate numeric;
BEGIN
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
    AND NOT EXISTS(SELECT 1 FROM public.venue_staff WHERE venue_id=v AND user_id=auth.uid() AND is_active=true AND status='active' AND role IN ('owner','manager','staff')) THEN
    RAISE EXCEPTION 'Only venue staff may allocate a paid court outside rental checkout';
  END IF;
  IF NEW.event_format='reservation' AND active AND coalesce(rate,0)>0 AND current_setting('role',true) IN ('authenticated','anon') THEN
    IF TG_OP='INSERT' OR (NEW.venue_court_id,NEW.start_time,NEW.end_time,NEW.event_format) IS DISTINCT FROM (OLD.venue_court_id,OLD.start_time,OLD.end_time,OLD.event_format) THEN
      RAISE EXCEPTION 'This court requires secure checkout before it is reserved';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_court_payment BEFORE INSERT OR UPDATE OR DELETE ON public.group_events FOR EACH ROW EXECUTE FUNCTION public.guard_court_payment();

CREATE FUNCTION public.payment_court_quote(p_buyer uuid,p_group uuid,p_court uuid,p_start timestamptz,p_end timestamptz,p_live boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.venue_courts; v public.venues; s public.venue_payment_settings; a public.venue_payment_accounts;
  mins numeric; amount integer; day jsonb; local_start timestamp; local_end timestamp; opens integer; closes integer;
BEGIN
  SELECT * INTO c FROM public.venue_courts WHERE id=p_court;
  SELECT * INTO v FROM public.venues WHERE id=c.venue_id;
  IF c.id IS NULL OR c.is_active=false OR v.is_active=false THEN RAISE EXCEPTION 'Court is unavailable'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.groups WHERE id=p_group AND venue_id=v.id)
    OR NOT EXISTS(SELECT 1 FROM public.group_members WHERE group_id=p_group AND user_id=p_buyer AND status='active') THEN
    RAISE EXCEPTION 'Join this venue community before booking';
  END IF;
  IF NOT public.venue_has_module(v.id,'court_booking') THEN RAISE EXCEPTION 'Court booking is not enabled'; END IF;
  mins:=extract(epoch FROM p_end-p_start)/60;
  IF p_start IS NULL OR p_end IS NULL OR p_start<now()+interval '35 minutes' OR p_start>now()+interval '180 days'
    OR mins<30 OR mins>240 OR mod(mins,30)<>0 THEN
    RAISE EXCEPTION 'Choose 30-minute increments, up to 4 hours, starting at least 35 minutes from now and within 180 days';
  END IF;
  SELECT * INTO s FROM public.venue_payment_settings WHERE venue_id=v.id;
  SELECT * INTO a FROM public.venue_payment_accounts WHERE venue_id=v.id AND livemode=p_live;
  IF (p_live AND NOT coalesce(s.accepting_payments,false)) OR coalesce(c.hourly_rate,0)<=0 THEN RAISE EXCEPTION 'Paid booking is not configured for this court'; END IF;
  IF NOT coalesce(a.charges_enabled,false) OR NOT coalesce(a.payouts_enabled,false) OR a.connected_by IS DISTINCT FROM v.owner_id
    OR v.verification_approved_at IS NULL THEN RAISE EXCEPTION 'This venue must finish its payment verification'; END IF;
  IF NOT coalesce(s.tax_inclusive_acknowledged,false) OR coalesce(length(s.cancellation_policy),0)<20 OR coalesce(s.support_email,'')='' OR coalesce(s.timezone,'')='' THEN RAISE EXCEPTION 'Venue payment policies are incomplete'; END IF;
  local_start:=p_start AT TIME ZONE s.timezone; local_end:=p_end AT TIME ZONE s.timezone;
  day:=v.hours_of_operation->'days'->(extract(dow FROM local_start)::integer)::text;
  IF day='null'::jsonb THEN RAISE EXCEPTION 'The venue is closed that day'; END IF;
  opens:=extract(epoch FROM coalesce((day->>'open')::time,'06:00'::time))/60;
  closes:=CASE WHEN day->>'close'='24:00' THEN 1440 ELSE extract(epoch FROM coalesce((day->>'close')::time,'22:00'::time))/60 END;
  IF local_end::date>local_start::date+1 OR local_end>date_trunc('day',local_start)+closes*interval '1 minute'
    OR local_start<date_trunc('day',local_start)+opens*interval '1 minute' THEN RAISE EXCEPTION 'Choose a time within the venue opening hours'; END IF;
  IF EXISTS(SELECT 1 FROM public.group_events WHERE venue_court_id=c.id AND tstzrange(start_time,end_time,'[)') && tstzrange(p_start,p_end,'[)'))
    OR EXISTS(SELECT 1 FROM public.payment_orders WHERE court_id=c.id AND livemode=p_live AND status='pending' AND tstzrange(start_time,end_time,'[)') && tstzrange(p_start,p_end,'[)')) THEN
    RAISE EXCEPTION 'This court is no longer available' USING ERRCODE='23P01';
  END IF;
  amount:=round(c.hourly_rate*100*mins/60);
  IF amount<50 OR amount>99999999 THEN RAISE EXCEPTION 'The venue must set a valid rate'; END IF;
  RETURN jsonb_build_object('venue_id',v.id,'merchant_name',v.name,'account_id',a.account_id,'amount_cents',amount,'currency','usd',
    'description',c.name||' · '||mins::integer||' minutes','policy',s.cancellation_policy,'support_email',s.support_email,'timezone',s.timezone,'hourly_rate',c.hourly_rate);
END $$;

CREATE FUNCTION public.payment_reserve_court(p_buyer uuid,p_group uuid,p_court uuid,p_start timestamptz,p_end timestamptz,p_live boolean,p_expected integer,p_policy text,p_request uuid)
RETURNS public.payment_orders LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE q jsonb; o public.payment_orders;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_buyer::text,441));
  SELECT * INTO o FROM public.payment_orders WHERE buyer_id=p_buyer AND livemode=p_live AND request_key=p_request;
  IF FOUND THEN
    IF o.kind<>'court_rental' OR (o.court_id,o.start_time,o.end_time,o.amount_cents) IS DISTINCT FROM (p_court,p_start,p_end,p_expected) THEN RAISE EXCEPTION 'Checkout request changed. Review the booking again.'; END IF;
    RETURN o;
  END IF;
  IF (SELECT count(*) FROM public.payment_orders WHERE buyer_id=p_buyer AND status='pending')>=2
    OR (SELECT count(*) FROM public.payment_orders WHERE buyer_id=p_buyer AND created_at>now()-interval '1 hour')>=10 THEN
    RAISE EXCEPTION 'Finish or cancel your existing checkouts before starting another';
  END IF;
  PERFORM 1 FROM public.venue_courts WHERE id=p_court FOR UPDATE;
  q:=public.payment_court_quote(p_buyer,p_group,p_court,p_start,p_end,p_live);
  IF (q->>'amount_cents')::integer IS DISTINCT FROM p_expected OR q->>'policy' IS DISTINCT FROM p_policy THEN RAISE EXCEPTION 'The price or policy changed. Review the updated booking before paying.'; END IF;
  INSERT INTO public.payment_orders(buyer_id,venue_id,group_id,court_id,kind,description,merchant_name,account_id,livemode,amount_cents,start_time,end_time,policy_snapshot,request_key)
    VALUES(p_buyer,(q->>'venue_id')::uuid,p_group,p_court,'court_rental',q->>'description',q->>'merchant_name',q->>'account_id',p_live,p_expected,p_start,p_end,p_policy,p_request) RETURNING * INTO o;
  RETURN o;
END $$;

CREATE FUNCTION public.payment_apply_result(p_order uuid,p_account text,p_live boolean,p_session text,p_status text,p_amount integer,p_currency text,p_intent text,p_customer text,p_subscription text DEFAULT NULL,p_paid_through timestamptz DEFAULT NULL)
RETURNS public.payment_orders LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.payment_orders;
BEGIN
  SELECT * INTO o FROM public.payment_orders WHERE id=p_order FOR UPDATE;
  IF NOT FOUND OR o.account_id IS DISTINCT FROM p_account OR o.livemode IS DISTINCT FROM p_live
    OR o.amount_cents IS DISTINCT FROM p_amount OR o.currency IS DISTINCT FROM p_currency
    OR (o.checkout_session_id IS NOT NULL AND o.checkout_session_id IS DISTINCT FROM p_session)
    OR (o.customer_id IS NOT NULL AND o.customer_id IS DISTINCT FROM p_customer) THEN RAISE EXCEPTION 'Payment verification mismatch'; END IF;
  IF p_status NOT IN ('paid','expired') THEN RAISE EXCEPTION 'Only confirmed terminal processor states may fulfill or release an order'; END IF;
  IF o.status<>'pending' THEN RETURN o; END IF;
  IF p_status='paid' THEN
    IF p_intent IS NULL THEN RAISE EXCEPTION 'A successful payment reference is required'; END IF;
    IF o.billing_cadence='monthly' AND (p_subscription IS NULL OR p_paid_through IS NULL) THEN RAISE EXCEPTION 'Subscription paid period is required'; END IF;
    IF o.kind='court_rental' AND o.livemode THEN
      INSERT INTO public.group_events(group_id,venue_id,venue_court_id,created_by,title,start_time,end_time,event_format,location_type,payment_order_id)
        VALUES(o.group_id,o.venue_id,o.court_id,o.buyer_id,o.description,o.start_time,o.end_time,'reservation','venue',o.id);
    ELSIF o.kind='venue_module' AND o.livemode THEN
      INSERT INTO public.venue_module_access(venue_id,module_key,source,enabled,expires_at) VALUES(o.venue_id,o.module_key,'subscription',true,p_paid_through)
        ON CONFLICT(venue_id,module_key) DO UPDATE SET enabled=true,expires_at=EXCLUDED.expires_at,updated_at=now()
        WHERE venue_module_access.source='subscription';
    END IF;
    IF p_subscription IS NOT NULL THEN
      INSERT INTO public.payment_subscriptions(subscription_id,order_id,venue_id,module_key,buyer_id,account_id,livemode,status,paid_through)
        VALUES(p_subscription,o.id,o.venue_id,o.module_key,o.buyer_id,o.account_id,o.livemode,'active',p_paid_through) ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  UPDATE public.payment_orders SET status=p_status,checkout_session_id=p_session,payment_intent_id=p_intent,customer_id=p_customer,subscription_id=p_subscription,
    paid_at=CASE WHEN p_status='paid' THEN now() END,updated_at=now() WHERE id=o.id RETURNING * INTO o;
  RETURN o;
END $$;

-- Expose only anonymous slot boundaries, never buyer or payment details.
CREATE FUNCTION public.venue_checkout_holds(p_venue uuid,p_from timestamptz,p_to timestamptz)
RETURNS TABLE(id text,venue_court_id uuid,start_time timestamptz,end_time timestamptz,title text,event_format text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT 'hold:'||o.id,o.court_id,o.start_time,o.end_time,'Checkout in progress','reservation'
  FROM public.payment_orders o WHERE o.venue_id=p_venue AND o.livemode AND o.status='pending' AND o.kind='court_rental'
  AND o.start_time<p_to AND o.end_time>p_from AND p_to-p_from<=interval '2 days'
  AND EXISTS(SELECT 1 FROM public.group_members m WHERE m.group_id=o.group_id AND m.user_id=auth.uid() AND m.status='active')
$$;
REVOKE ALL ON FUNCTION public.venue_checkout_holds(uuid,timestamptz,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.venue_checkout_holds(uuid,timestamptz,timestamptz) TO authenticated;
REVOKE ALL ON FUNCTION public.payment_court_quote(uuid,uuid,uuid,timestamptz,timestamptz,boolean),public.payment_reserve_court(uuid,uuid,uuid,timestamptz,timestamptz,boolean,integer,text,uuid),public.payment_apply_result(uuid,text,boolean,text,text,integer,text,text,text,text,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.payment_court_quote(uuid,uuid,uuid,timestamptz,timestamptz,boolean),public.payment_reserve_court(uuid,uuid,uuid,timestamptz,timestamptz,boolean,integer,text,uuid),public.payment_apply_result(uuid,text,boolean,text,text,integer,text,text,text,text,timestamptz) TO service_role;

CREATE FUNCTION public.payment_save_venue(p_user uuid,p_venue uuid,p_accepting boolean,p_policy text,p_email text,p_timezone text,p_rates jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE rate jsonb;
BEGIN
  PERFORM 1 FROM public.venues WHERE id=p_venue AND owner_id=p_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Only the venue owner may change payment settings'; END IF;
  IF length(p_policy) NOT BETWEEN 20 AND 2000 OR p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    OR NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=p_timezone) OR jsonb_typeof(p_rates)<>'array' OR jsonb_array_length(p_rates)>100 THEN
    RAISE EXCEPTION 'Invalid payment policies or court prices';
  END IF;
  FOR rate IN SELECT * FROM jsonb_array_elements(p_rates) LOOP
    IF (rate->>'cents')::numeric<0 OR (rate->>'cents')::numeric>99999999 OR (rate->>'cents')::numeric<>trunc((rate->>'cents')::numeric) THEN RAISE EXCEPTION 'Invalid rate'; END IF;
    UPDATE public.venue_courts SET hourly_rate=(rate->>'cents')::numeric/100 WHERE id=(rate->>'id')::uuid AND venue_id=p_venue;
    IF NOT FOUND THEN RAISE EXCEPTION 'Court does not belong to this venue'; END IF;
  END LOOP;
  INSERT INTO public.venue_payment_settings(venue_id,accepting_payments,cancellation_policy,support_email,timezone,tax_inclusive_acknowledged)
    VALUES(p_venue,p_accepting,p_policy,p_email,p_timezone,true)
    ON CONFLICT(venue_id) DO UPDATE SET accepting_payments=p_accepting,cancellation_policy=p_policy,support_email=p_email,timezone=p_timezone,tax_inclusive_acknowledged=true,updated_at=now();
END $$;

CREATE TABLE public.payment_cancellation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.payment_orders(id),
  buyer_id uuid NOT NULL REFERENCES auth.users(id),
  venue_id uuid NOT NULL REFERENCES public.venues(id),
  note text NOT NULL,
  status text NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','refund_pending','approved','declined')),
  resolution_note text,
  resolved_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_cancellation_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_cancellation_requests FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.payment_cancellation_requests TO service_role;
GRANT SELECT ON public.payment_cancellation_requests TO authenticated;
CREATE POLICY payment_cancellation_read ON public.payment_cancellation_requests FOR SELECT TO authenticated USING (
  buyer_id=auth.uid() OR EXISTS(SELECT 1 FROM public.venues WHERE id=venue_id AND owner_id=auth.uid())
);
CREATE FUNCTION public.payment_request_cancellation(p_order uuid,p_buyer uuid,p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.payment_orders;
BEGIN
  SELECT * INTO o FROM public.payment_orders WHERE id=p_order AND buyer_id=p_buyer AND kind='court_rental' AND status IN ('paid','partially_refunded') FOR UPDATE;
  IF NOT FOUND OR o.canceled_at IS NOT NULL THEN RAISE EXCEPTION 'No cancellable reservation found'; END IF;
  IF length(p_note) NOT BETWEEN 5 AND 1000 THEN RAISE EXCEPTION 'Please give the venue a short reason (5–1000 characters)'; END IF;
  INSERT INTO public.payment_cancellation_requests(order_id,buyer_id,venue_id,note) VALUES(o.id,o.buyer_id,o.venue_id,p_note) ON CONFLICT(order_id) DO NOTHING;
END $$;
CREATE FUNCTION public.payment_cancel_reservation(p_order uuid,p_owner uuid,p_note text,p_decision text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.payment_orders;
BEGIN
  SELECT * INTO o FROM public.payment_orders WHERE id=p_order AND kind='court_rental' FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.venues WHERE id=o.venue_id AND owner_id=p_owner) THEN RAISE EXCEPTION 'Only the venue owner may resolve this reservation'; END IF;
  IF length(p_note) NOT BETWEEN 5 AND 1000 OR p_decision NOT IN ('declined','cancel_without_refund','refund_pending') THEN RAISE EXCEPTION 'Choose a resolution and include a note'; END IF;
  IF o.status NOT IN ('paid','partially_refunded','refunded') THEN RAISE EXCEPTION 'This reservation is not paid'; END IF;
  IF p_decision<>'refund_pending' AND EXISTS(SELECT 1 FROM public.payment_cancellation_requests WHERE order_id=o.id AND status='refund_pending') THEN
    RAISE EXCEPTION 'A refund is already in progress. Resolve it in Stripe before changing this decision.';
  END IF;
  UPDATE public.payment_cancellation_requests SET status=CASE WHEN p_decision='cancel_without_refund' THEN 'approved' ELSE p_decision END,
    resolution_note=p_note,resolved_by=p_owner,updated_at=now() WHERE order_id=o.id AND status IN ('requested','refund_pending');
  IF NOT FOUND THEN RAISE EXCEPTION 'No open cancellation request'; END IF;
  IF p_decision='cancel_without_refund' THEN
    DELETE FROM public.group_events WHERE payment_order_id=o.id;
    UPDATE public.payment_orders SET canceled_at=now(),updated_at=now() WHERE id=o.id;
  END IF;
END $$;

CREATE FUNCTION public.payment_record_charge(p_account text,p_live boolean,p_intent text,p_refunded integer,p_disputed boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.payment_orders;
BEGIN
  SELECT * INTO o FROM public.payment_orders WHERE account_id=p_account AND livemode=p_live AND payment_intent_id=p_intent FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF p_refunded<0 OR p_refunded>o.amount_cents THEN RAISE EXCEPTION 'Refund verification mismatch'; END IF;
  -- Old webhook deliveries cannot reduce a refund already recorded.
  p_refunded:=greatest(p_refunded,o.refunded_cents);
  UPDATE public.payment_orders SET refunded_cents=p_refunded,disputed=p_disputed,
    status=CASE WHEN p_refunded=amount_cents THEN 'refunded' WHEN p_refunded>0 THEN 'partially_refunded' ELSE status END,updated_at=now() WHERE id=o.id;
  IF p_refunded=o.amount_cents AND o.kind='venue_module' AND o.livemode THEN
    UPDATE public.venue_module_access SET enabled=false,updated_at=now() WHERE venue_id=o.venue_id AND module_key=o.module_key AND source='subscription'
      AND NOT EXISTS(SELECT 1 FROM public.payment_orders newer WHERE newer.venue_id=o.venue_id AND newer.module_key=o.module_key AND newer.livemode AND newer.status='paid' AND newer.created_at>o.created_at);
  END IF;
  IF p_refunded=o.amount_cents AND o.kind='court_rental' THEN
    IF EXISTS(SELECT 1 FROM public.payment_cancellation_requests WHERE order_id=o.id AND status='refund_pending') THEN
      DELETE FROM public.group_events WHERE payment_order_id=o.id;
      UPDATE public.payment_orders SET canceled_at=now() WHERE id=o.id;
      UPDATE public.payment_cancellation_requests SET status='approved',updated_at=now() WHERE order_id=o.id;
    END IF;
  END IF;
END $$;

CREATE FUNCTION public.payment_record_renewal(p_subscription text,p_invoice text,p_amount integer,p_currency text,p_intent text,p_customer text,p_through timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.payment_subscriptions; o public.payment_orders; new_id uuid;
BEGIN
  SELECT * INTO s FROM public.payment_subscriptions WHERE subscription_id=p_subscription FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Subscription checkout must be reconciled before its renewal'; END IF;
  SELECT * INTO o FROM public.payment_orders WHERE id=s.order_id;
  IF p_amount<>1000 OR p_currency<>'usd' OR p_customer IS DISTINCT FROM o.customer_id OR p_intent IS NULL OR p_through IS NULL THEN RAISE EXCEPTION 'Renewal payment mismatch'; END IF;
  INSERT INTO public.payment_orders(buyer_id,venue_id,kind,module_key,billing_cadence,description,merchant_name,account_id,livemode,amount_cents,status,payment_intent_id,subscription_id,invoice_id,customer_id,request_key,policy_snapshot,paid_at)
    VALUES(o.buyer_id,o.venue_id,'venue_module',o.module_key,'monthly',o.description,o.merchant_name,o.account_id,o.livemode,1000,'paid',p_intent,p_subscription,p_invoice,p_customer,gen_random_uuid(),o.policy_snapshot,now())
    ON CONFLICT(account_id,livemode,invoice_id) DO NOTHING RETURNING id INTO new_id;
  IF new_id IS NULL THEN RETURN; END IF;
  UPDATE public.payment_subscriptions SET paid_through=greatest(paid_through,p_through),updated_at=now() WHERE subscription_id=s.subscription_id;
  IF s.livemode THEN UPDATE public.venue_module_access SET enabled=true,expires_at=greatest(expires_at,p_through),updated_at=now()
    WHERE venue_id=s.venue_id AND module_key=s.module_key AND source='subscription'; END IF;
END $$;

-- All money-changing RPCs are exclusively for authenticated server handlers.
REVOKE ALL ON FUNCTION public.payment_save_venue(uuid,uuid,boolean,text,text,text,jsonb),public.payment_request_cancellation(uuid,uuid,text),public.payment_cancel_reservation(uuid,uuid,text,text),public.payment_record_charge(text,boolean,text,integer,boolean),public.payment_record_renewal(text,text,integer,text,text,text,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.payment_save_venue(uuid,uuid,boolean,text,text,text,jsonb),public.payment_request_cancellation(uuid,uuid,text),public.payment_cancel_reservation(uuid,uuid,text,text),public.payment_record_charge(text,boolean,text,integer,boolean),public.payment_record_renewal(text,text,integer,text,text,text,timestamptz) TO service_role;

-- Honor an already-quoted reservation if a venue's module expires while the
-- player is in Stripe. This exception requires the exact server-created hold;
-- browser-supplied payment_order_id values are rejected by guard_court_payment.
CREATE OR REPLACE FUNCTION public.guard_venue_module_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_venue uuid; v_module text; v_court_venue uuid;
BEGIN
  IF TG_TABLE_NAME='venue_courts' THEN
    v_venue:=NEW.venue_id;
    IF NOT public.venue_has_module(v_venue,'court_booking') AND NOT public.venue_has_module(v_venue,'facility_tools') THEN RAISE EXCEPTION 'Court inventory requires an active venue add-on'; END IF;
  ELSE
    IF TG_OP='UPDATE' AND NEW.venue_court_id IS NOT DISTINCT FROM OLD.venue_court_id AND NEW.venue_id IS NOT DISTINCT FROM OLD.venue_id
      AND NEW.group_id IS NOT DISTINCT FROM OLD.group_id AND NEW.event_format IS NOT DISTINCT FROM OLD.event_format
      AND NEW.start_time IS NOT DISTINCT FROM OLD.start_time AND NEW.end_time IS NOT DISTINCT FROM OLD.end_time THEN RETURN NEW; END IF;
    SELECT venue_id INTO v_venue FROM public.groups WHERE id=NEW.group_id;
    IF NEW.venue_court_id IS NOT NULL THEN
      SELECT venue_id INTO v_court_venue FROM public.venue_courts WHERE id=NEW.venue_court_id;
      IF v_court_venue IS DISTINCT FROM v_venue THEN RAISE EXCEPTION 'Court and community must belong to the same venue'; END IF;
    END IF;
    IF NEW.event_format='reservation' THEN v_module:='court_booking';
    ELSIF NEW.venue_court_id IS NOT NULL OR NEW.event_format IN ('program_hold','maintenance') THEN v_module:='facility_tools'; END IF;
    IF v_module IS NOT NULL AND NEW.venue_id IS NOT NULL AND NEW.venue_id IS DISTINCT FROM v_venue THEN RAISE EXCEPTION 'A facility booking must belong to the venue community'; END IF;
    IF v_module='court_booking' AND current_setting('role',true) NOT IN ('authenticated','anon') AND EXISTS(
      SELECT 1 FROM public.payment_orders o WHERE o.id=NEW.payment_order_id AND o.kind='court_rental' AND o.livemode AND o.status='pending'
        AND o.court_id=NEW.venue_court_id AND o.group_id=NEW.group_id AND o.venue_id=NEW.venue_id AND o.buyer_id=NEW.created_by AND o.start_time=NEW.start_time AND o.end_time=NEW.end_time
    ) THEN RETURN NEW; END IF;
    IF v_module IS NOT NULL AND NOT public.venue_has_module(v_venue,v_module) THEN RAISE EXCEPTION 'This facility action requires the % add-on. Community events remain free.',v_module; END IF;
  END IF;
  RETURN NEW;
END $$;

-- Repair the existing league fulfillment race without re-granting historical
-- purchases. The purchase ledger and profile increment now commit together.
CREATE FUNCTION public.payment_fulfill_league_slot(p_user uuid,p_session text,p_customer text,p_amount integer,p_currency text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE purchase public.league_slot_purchases;
BEGIN
  IF p_amount IS NULL OR p_amount<=0 OR p_currency<>'usd' OR p_session NOT LIKE 'cs_%' THEN RAISE EXCEPTION 'Invalid verified league purchase'; END IF;
  INSERT INTO public.league_slot_purchases(user_id,stripe_session_id,status,slots_granted)
    VALUES(p_user,p_session,'pending',0) ON CONFLICT(stripe_session_id) DO NOTHING;
  SELECT * INTO purchase FROM public.league_slot_purchases WHERE stripe_session_id=p_session FOR UPDATE;
  IF purchase.user_id IS DISTINCT FROM p_user THEN RAISE EXCEPTION 'Purchase belongs to another player'; END IF;
  IF purchase.status='paid' THEN RETURN 0; END IF;
  IF purchase.status<>'pending' THEN RAISE EXCEPTION 'Purchase is not eligible for fulfillment'; END IF;
  PERFORM public.increment_league_slots(p_user,1);
  UPDATE public.league_slot_purchases SET status='paid',slots_granted=1,amount_cents=p_amount,currency=p_currency,stripe_customer_id=p_customer,fulfilled_at=now() WHERE id=purchase.id;
  RETURN 1;
END $$;
REVOKE ALL ON FUNCTION public.payment_fulfill_league_slot(uuid,text,text,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.payment_fulfill_league_slot(uuid,text,text,integer,text) TO service_role;
REVOKE INSERT,UPDATE,DELETE ON public.league_slot_purchases FROM authenticated,anon;

COMMIT;
