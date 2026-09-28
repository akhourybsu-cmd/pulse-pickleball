-- One player, one event seat, one venue-owned payment. Prices and available
-- capacity are checked and locked in SQL; browser totals are acknowledgments.
BEGIN;
ALTER TABLE public.venue_payment_settings ADD COLUMN accepting_event_payments boolean NOT NULL DEFAULT false;
ALTER TABLE public.payment_orders DROP CONSTRAINT payment_orders_kind_check;
ALTER TABLE public.payment_orders ADD CONSTRAINT payment_orders_kind_check CHECK(kind IN ('venue_module','court_rental','league_slot','tournament_license','division_slot','event_registration'));
ALTER TABLE public.payment_orders ADD COLUMN program_event_id uuid REFERENCES public.group_events(id) ON DELETE RESTRICT;
ALTER TABLE public.payment_orders ADD CONSTRAINT payment_event_shape CHECK(kind<>'event_registration' OR (program_event_id IS NOT NULL AND venue_id IS NOT NULL AND group_id IS NOT NULL AND billing_cadence='one_time' AND end_time>start_time));
ALTER TABLE public.group_event_rsvps ADD COLUMN payment_order_id uuid UNIQUE REFERENCES public.payment_orders(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX payment_event_active_checkout ON public.payment_orders(program_event_id,buyer_id,livemode) WHERE kind='event_registration' AND status='pending';
CREATE INDEX payment_event_orders ON public.payment_orders(program_event_id,created_at DESC);
DROP POLICY payment_orders_read ON public.payment_orders;
CREATE POLICY payment_orders_read ON public.payment_orders FOR SELECT TO authenticated USING(buyer_id=auth.uid() OR (kind IN ('court_rental','event_registration') AND EXISTS(SELECT 1 FROM venues v WHERE v.id=venue_id AND v.owner_id=auth.uid())));

CREATE FUNCTION public.guard_venue_program_management() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
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
CREATE TRIGGER guard_venue_program_management BEFORE INSERT OR UPDATE OR DELETE ON public.group_events FOR EACH ROW EXECUTE FUNCTION public.guard_venue_program_management();

CREATE FUNCTION public.guard_venue_event_registration() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e group_events; r group_event_rsvps; o payment_orders; n integer;
BEGIN
  IF TG_OP='DELETE' THEN r:=OLD; ELSE r:=NEW; END IF;
  IF TG_OP='UPDATE' AND (NEW.event_id,NEW.user_id) IS DISTINCT FROM (OLD.event_id,OLD.user_id) THEN RAISE EXCEPTION 'A registration cannot be moved to another event or player'; END IF;
  SELECT * INTO e FROM group_events WHERE id=r.event_id FOR UPDATE;
  IF e.venue_id IS NULL OR e.parent_event_id IS NOT NULL OR e.event_format NOT IN ('open_play','clinic','practice','round_robin','social','other') THEN RETURN coalesce(NEW,OLD); END IF;
  IF TG_OP='UPDATE' AND (NEW.event_id,NEW.user_id) IS DISTINCT FROM (OLD.event_id,OLD.user_id) THEN RAISE EXCEPTION 'A registration cannot be moved to another event or player'; END IF;
  IF TG_OP<>'DELETE' AND (TG_OP='INSERT' OR (NEW.checked_in_at,NEW.checked_in_by) IS DISTINCT FROM (OLD.checked_in_at,OLD.checked_in_by))
    AND (NEW.checked_in_at IS NOT NULL OR NEW.checked_in_by IS NOT NULL OR TG_OP='UPDATE')
    AND auth.uid() IS NOT NULL AND NOT public.can_manage_venue_events(auth.uid(),e.venue_id,e.group_id) THEN RAISE EXCEPTION 'Only event managers can change check-in status' USING ERRCODE='42501'; END IF;
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
    IF e.price_cents>0 THEN
      SELECT * INTO o FROM payment_orders WHERE id=NEW.payment_order_id;
      IF NOT FOUND OR o.kind<>'event_registration' OR o.program_event_id<>e.id OR o.buyer_id<>NEW.user_id OR NOT o.livemode
        OR o.status NOT IN ('paid','partially_refunded') OR o.canceled_at IS NOT NULL THEN RAISE EXCEPTION 'Complete secure checkout to confirm your place'; END IF;
    END IF;
    SELECT count(*) INTO n FROM group_event_rsvps WHERE event_id=e.id AND status='going' AND user_id<>NEW.user_id;
    n:=n+(SELECT count(*) FROM payment_orders WHERE program_event_id=e.id AND status='pending' AND livemode AND buyer_id<>NEW.user_id);
    IF n>=e.capacity THEN RAISE EXCEPTION 'This event has no unreserved places'; END IF;
  ELSIF NEW.status='waitlist' THEN
    IF NOT e.waitlist_enabled THEN RAISE EXCEPTION 'The waitlist is closed'; END IF;
    IF e.waitlist_limit IS NOT NULL AND (SELECT count(*) FROM group_event_rsvps WHERE event_id=e.id AND status='waitlist' AND user_id<>NEW.user_id)>=e.waitlist_limit THEN RAISE EXCEPTION 'The waitlist is full'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_venue_event_registration BEFORE INSERT OR UPDATE OR DELETE ON public.group_event_rsvps FOR EACH ROW EXECUTE FUNCTION public.guard_venue_event_registration();

-- Paid waitlists require a new checkout; they must never be auto-promoted free.
ALTER FUNCTION public.promote_group_event_waitlist(uuid) RENAME TO promote_group_event_waitlist_before_payments;
CREATE FUNCTION public.promote_group_event_waitlist(p_event_id uuid) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e group_events;
BEGIN
  SELECT * INTO e FROM group_events WHERE id=p_event_id FOR UPDATE;
  IF e.price_cents>0 OR e.canceled_at IS NOT NULL OR e.registration_paused OR (e.venue_id IS NOT NULL AND now()>=coalesce(e.registration_closes_at,e.start_time)) THEN RETURN 0; END IF;
  RETURN public.promote_group_event_waitlist_before_payments(p_event_id);
END $$;
REVOKE ALL ON FUNCTION public.promote_group_event_waitlist_before_payments(uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.promote_group_event_waitlist(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.promote_group_event_waitlist(uuid) TO authenticated,service_role;

CREATE FUNCTION public.payment_event_quote(p_buyer uuid,p_event uuid,p_live boolean)
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
  IF n>=e.capacity THEN RAISE EXCEPTION 'No places are available. Other players may be completing checkout.'; END IF;
  RETURN jsonb_build_object('venue_id',v.id,'event_id',e.id,'group_id',e.group_id,'merchant_name',v.name,'account_id',a.account_id,
    'amount_cents',e.price_cents,'currency',e.currency,'description',e.title||' · 1 player','policy',coalesce(e.cancellation_policy,s.cancellation_policy),
    'support_email',s.support_email,'timezone',coalesce(v.timezone,s.timezone),'start_time',e.start_time,'end_time',e.end_time,'spots_left',e.capacity-n);
END $$;
CREATE FUNCTION public.payment_reserve_event(p_buyer uuid,p_event uuid,p_live boolean,p_expected integer,p_policy text,p_request uuid)
RETURNS public.payment_orders LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE q jsonb; o payment_orders;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_buyer::text,441));
  SELECT * INTO o FROM payment_orders WHERE buyer_id=p_buyer AND livemode=p_live AND request_key=p_request;
  IF FOUND THEN
    IF o.kind<>'event_registration' OR o.program_event_id IS DISTINCT FROM p_event OR o.amount_cents IS DISTINCT FROM p_expected OR o.policy_snapshot IS DISTINCT FROM p_policy THEN RAISE EXCEPTION 'Checkout request changed. Review the event again.'; END IF;
    RETURN o;
  END IF;
  IF (SELECT count(*) FROM payment_orders WHERE buyer_id=p_buyer AND status='pending')>=2 OR (SELECT count(*) FROM payment_orders WHERE buyer_id=p_buyer AND created_at>now()-interval '1 hour')>=10 THEN RAISE EXCEPTION 'Finish or cancel your existing checkouts before starting another'; END IF;
  PERFORM id FROM group_events WHERE id=p_event FOR UPDATE;
  q:=public.payment_event_quote(p_buyer,p_event,p_live);
  IF (q->>'amount_cents')::integer IS DISTINCT FROM p_expected OR q->>'policy' IS DISTINCT FROM p_policy THEN RAISE EXCEPTION 'The price or policy changed. Review the updated event before paying.'; END IF;
  INSERT INTO payment_orders(buyer_id,venue_id,group_id,program_event_id,kind,description,merchant_name,account_id,livemode,amount_cents,start_time,end_time,policy_snapshot,request_key)
    VALUES(p_buyer,(q->>'venue_id')::uuid,(q->>'group_id')::uuid,p_event,'event_registration',q->>'description',q->>'merchant_name',q->>'account_id',p_live,p_expected,(q->>'start_time')::timestamptz,(q->>'end_time')::timestamptz,p_policy,p_request) RETURNING * INTO o;
  RETURN o;
END $$;

ALTER FUNCTION public.payment_apply_result(uuid,text,boolean,text,text,integer,text,text,text,text,timestamptz) RENAME TO payment_apply_result_before_events;
CREATE FUNCTION public.payment_apply_result(p_order uuid,p_account text,p_live boolean,p_session text,p_status text,p_amount integer,p_currency text,p_intent text,p_customer text,p_subscription text DEFAULT NULL,p_paid_through timestamptz DEFAULT NULL)
RETURNS public.payment_orders LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o payment_orders; e group_events; pending boolean;
BEGIN
  SELECT * INTO o FROM payment_orders WHERE id=p_order;
  IF o.kind='event_registration' THEN SELECT * INTO e FROM group_events WHERE id=o.program_event_id FOR UPDATE; END IF;
  SELECT status='pending' INTO pending FROM payment_orders WHERE id=p_order;
  o:=public.payment_apply_result_before_events(p_order,p_account,p_live,p_session,p_status,p_amount,p_currency,p_intent,p_customer,p_subscription,p_paid_through);
  IF pending AND o.kind='event_registration' AND o.livemode AND o.status='paid' THEN
    IF e.canceled_at IS NOT NULL OR e.end_time<=now() THEN
      UPDATE payment_orders SET canceled_at=now() WHERE id=o.id RETURNING * INTO o;
      INSERT INTO payment_cancellation_requests(order_id,buyer_id,venue_id,note)
        VALUES(o.id,o.buyer_id,o.venue_id,'Payment completed after the event was canceled or ended. Review and refund this registration.') ON CONFLICT(order_id) DO NOTHING;
    ELSE
      INSERT INTO group_event_rsvps(event_id,user_id,status,payment_order_id) VALUES(e.id,o.buyer_id,'going',o.id)
        ON CONFLICT(event_id,user_id) DO UPDATE SET status='going',payment_order_id=o.id,waitlist_position=NULL,updated_at=now();
    END IF;
  END IF;
  RETURN o;
END $$;
REVOKE ALL ON FUNCTION public.payment_apply_result_before_events(uuid,text,boolean,text,text,integer,text,text,text,text,timestamptz) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.payment_event_quote(uuid,uuid,boolean),public.payment_reserve_event(uuid,uuid,boolean,integer,text,uuid),public.payment_apply_result(uuid,text,boolean,text,text,integer,text,text,text,text,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.payment_event_quote(uuid,uuid,boolean),public.payment_reserve_event(uuid,uuid,boolean,integer,text,uuid),public.payment_apply_result(uuid,text,boolean,text,text,integer,text,text,text,text,timestamptz) TO service_role;

CREATE FUNCTION public.get_venue_program_availability(p_event uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE e group_events;
BEGIN
  SELECT * INTO e FROM group_events WHERE id=p_event AND parent_event_id IS NULL;
  IF auth.uid() IS NULL OR e.venue_id IS NULL OR NOT (public.is_group_member(auth.uid(),e.group_id) OR EXISTS(SELECT 1 FROM groups WHERE id=e.group_id AND visibility='public') OR public.can_manage_venue_events(auth.uid(),e.venue_id,e.group_id)) THEN RAISE EXCEPTION 'Event unavailable' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object('pending_places',(SELECT count(*) FROM payment_orders WHERE program_event_id=e.id AND status='pending' AND livemode),
    'checkout_order_id',(SELECT id FROM payment_orders WHERE program_event_id=e.id AND buyer_id=auth.uid() AND status='pending' ORDER BY created_at DESC LIMIT 1));
END $$;
REVOKE ALL ON FUNCTION public.get_venue_program_availability(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_venue_program_availability(uuid) TO authenticated;
COMMIT;
