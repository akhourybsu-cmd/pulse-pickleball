BEGIN;
CREATE TABLE public.venue_automation_settings (
 venue_id uuid PRIMARY KEY REFERENCES venues(id),waitlist_offers boolean NOT NULL DEFAULT false,
 offer_minutes integer NOT NULL DEFAULT 120 CHECK(offer_minutes BETWEEN 35 AND 1440),
 event_reminders boolean NOT NULL DEFAULT false,reminder_hours integer NOT NULL DEFAULT 24 CHECK(reminder_hours BETWEEN 1 AND 168),
 arrival_instructions text NOT NULL DEFAULT '' CHECK(length(arrival_instructions)<=2000),updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE public.venue_waitlist_offers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),venue_id uuid NOT NULL REFERENCES venues(id),event_id uuid NOT NULL REFERENCES group_events(id),
 rsvp_id uuid NOT NULL REFERENCES group_event_rsvps(id) ON DELETE CASCADE,user_id uuid NOT NULL REFERENCES auth.users(id),
 status text NOT NULL DEFAULT 'offered' CHECK(status IN ('offered','checkout','accepted','expired','declined','canceled')),
 created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL,payment_order_id uuid REFERENCES payment_orders(id),resolved_at timestamptz
);
CREATE UNIQUE INDEX venue_waitlist_offer_active ON venue_waitlist_offers(rsvp_id) WHERE status IN ('offered','checkout');
CREATE INDEX venue_waitlist_offer_event ON venue_waitlist_offers(event_id,status,expires_at);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['venue_automation_settings','venue_waitlist_offers'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
  EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
  EXECUTE format('CREATE POLICY pulse_required_mfa ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.pulse_has_required_mfa())) WITH CHECK ((SELECT public.pulse_has_required_mfa()))',t);
 END LOOP;
END $$;
CREATE FUNCTION public.venue_offer_holds(p_event uuid,p_exclude uuid DEFAULT NULL)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT count(*)::integer FROM venue_waitlist_offers WHERE event_id=p_event AND status='offered' AND expires_at>now() AND user_id IS DISTINCT FROM p_exclude
$$;
CREATE FUNCTION public.venue_process_waitlist(p_event uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e group_events;settings venue_automation_settings;r group_event_rsvps;available integer;until_time timestamptz;made integer:=0;offer uuid;
BEGIN
 SELECT * INTO e FROM group_events WHERE id=p_event AND venue_id IS NOT NULL AND parent_event_id IS NULL FOR UPDATE;
 IF NOT FOUND THEN RETURN 0; END IF;
 SELECT * INTO settings FROM venue_automation_settings WHERE venue_id=e.venue_id;
 UPDATE venue_waitlist_offers o SET status='accepted',resolved_at=now() WHERE o.event_id=e.id AND o.status IN ('offered','checkout') AND EXISTS(SELECT 1 FROM group_event_rsvps WHERE id=o.rsvp_id AND status='going');
 UPDATE venue_waitlist_offers SET status='expired',resolved_at=now() WHERE event_id=e.id AND ((status='offered' AND expires_at<=now()) OR (status='checkout' AND EXISTS(SELECT 1 FROM payment_orders p WHERE p.id=payment_order_id AND p.status='expired')));
 UPDATE venue_waitlist_offers o SET status='declined',resolved_at=now() WHERE o.event_id=e.id AND o.status='offered' AND NOT EXISTS(SELECT 1 FROM group_event_rsvps WHERE id=o.rsvp_id AND status='waitlist');
 IF NOT coalesce(settings.waitlist_offers,false) OR NOT e.waitlist_enabled OR e.canceled_at IS NOT NULL OR e.registration_paused OR now()>=coalesce(e.registration_closes_at,e.start_time) THEN
  UPDATE venue_waitlist_offers SET status='canceled',resolved_at=now() WHERE event_id=e.id AND status='offered'; RETURN 0;
 END IF;
 until_time:=least(now()+make_interval(mins=>settings.offer_minutes),coalesce(e.registration_closes_at,e.start_time)-CASE WHEN e.price_cents>0 THEN interval '35 minutes' ELSE interval '0 minutes' END);
 IF until_time<=now() THEN RETURN 0; END IF;
 available:=e.capacity-(SELECT count(*) FROM group_event_rsvps WHERE event_id=e.id AND status='going')-(SELECT count(*) FROM payment_orders WHERE program_event_id=e.id AND status='pending' AND livemode)-venue_walkin_seats(e.id)-venue_offer_holds(e.id);
 IF available<=0 THEN RETURN 0; END IF;
 FOR r IN SELECT rs.* FROM group_event_rsvps rs WHERE rs.event_id=e.id AND rs.status='waitlist'
  AND EXISTS(SELECT 1 FROM group_members WHERE group_id=e.group_id AND user_id=rs.user_id AND status='active')
  AND NOT EXISTS(SELECT 1 FROM venue_waitlist_offers WHERE rsvp_id=rs.id AND status IN ('offered','checkout','accepted','expired','declined'))
  AND NOT EXISTS(SELECT 1 FROM payment_orders WHERE program_event_id=e.id AND buyer_id=rs.user_id AND status='pending')
  ORDER BY rs.waitlist_position NULLS LAST,rs.created_at,rs.id LIMIT available FOR UPDATE OF rs LOOP
  INSERT INTO venue_waitlist_offers(venue_id,event_id,rsvp_id,user_id,expires_at) VALUES(e.venue_id,e.id,r.id,r.user_id,until_time) RETURNING id INTO offer;
  IF NOT EXISTS(SELECT 1 FROM group_notification_prefs WHERE group_id=e.group_id AND user_id=r.user_id AND (coalesce(muted_all,false) OR events IS FALSE)) THEN
   PERFORM enqueue_notification(r.user_id,'group_event_new','community','A place is available',e.title||': claim your waitlist offer before it expires.',
    '/player/community/group/'||e.group_id::text||'?program='||e.id::text,NULL,jsonb_build_object('event_id',e.id,'group_id',e.group_id,'offer_id',offer,'expires_at',until_time));
  END IF;
  made:=made+1;
 END LOOP;
 RETURN made;
END $$;

CREATE OR REPLACE FUNCTION public.promote_group_event_waitlist(p_event_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e group_events;r record;occupied integer;promoted integer:=0;
BEGIN
 SELECT * INTO e FROM group_events WHERE id=p_event_id FOR UPDATE;
 IF e.venue_id IS NOT NULL AND EXISTS(SELECT 1 FROM venue_automation_settings WHERE venue_id=e.venue_id AND waitlist_offers) THEN RETURN venue_process_waitlist(e.id); END IF;
 IF e.price_cents>0 OR e.canceled_at IS NOT NULL OR e.registration_paused OR (e.venue_id IS NOT NULL AND now()>=coalesce(e.registration_closes_at,e.start_time)) THEN RETURN 0; END IF;
 IF e.venue_id IS NULL THEN RETURN promote_group_event_waitlist_before_payments(p_event_id); END IF;
 IF NOT e.waitlist_enabled OR e.capacity IS NULL THEN RETURN 0; END IF;
 occupied:=(SELECT count(*) FROM group_event_rsvps WHERE event_id=e.id AND status='going')+(SELECT count(*) FROM payment_orders WHERE program_event_id=e.id AND status='pending' AND livemode)+venue_walkin_seats(e.id)+venue_offer_holds(e.id);
 FOR r IN SELECT id,user_id FROM group_event_rsvps WHERE event_id=e.id AND status='waitlist' ORDER BY waitlist_position NULLS LAST,created_at,id LOOP
  EXIT WHEN occupied>=e.capacity;
  UPDATE group_event_rsvps SET status='going',waitlist_position=NULL,updated_at=now() WHERE id=r.id;
  occupied:=occupied+1;promoted:=promoted+1;
  IF NOT EXISTS(SELECT 1 FROM group_notification_prefs WHERE group_id=e.group_id AND user_id=r.user_id AND (coalesce(muted_all,false) OR events IS FALSE)) THEN
   PERFORM enqueue_notification(r.user_id,'group_event_new','community','Your place is confirmed',e.title||': a place opened and your registration is now confirmed.','/player/community/group/'||e.group_id::text||'?program='||e.id::text,NULL,jsonb_build_object('event_id',e.id,'group_id',e.group_id));
  END IF;
 END LOOP;
 RETURN promoted;
END $$;
CREATE FUNCTION public.venue_waitlist_changed() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_TABLE_NAME='group_events' THEN PERFORM venue_process_waitlist(NEW.id);
 ELSIF TG_TABLE_NAME='group_event_rsvps' THEN
  IF TG_OP='UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  PERFORM venue_process_waitlist(CASE WHEN TG_OP='DELETE' THEN OLD.event_id ELSE NEW.event_id END);
 ELSIF TG_TABLE_NAME='venue_visits' THEN
  IF NEW.event_id IS NOT NULL AND NEW.status IS DISTINCT FROM OLD.status THEN PERFORM venue_process_waitlist(NEW.event_id); END IF;
 ELSIF TG_TABLE_NAME='payment_orders' THEN
  IF NEW.program_event_id IS NOT NULL AND NEW.status='expired' AND OLD.status='pending' THEN PERFORM venue_process_waitlist(NEW.program_event_id); END IF;
 END IF;
 RETURN coalesce(NEW,OLD);
END $$;
CREATE TRIGGER venue_waitlist_registration_changed AFTER INSERT OR UPDATE OR DELETE ON group_event_rsvps FOR EACH ROW EXECUTE FUNCTION venue_waitlist_changed();
CREATE TRIGGER venue_waitlist_program_changed AFTER UPDATE ON group_events FOR EACH ROW WHEN(NEW.parent_event_id IS NULL AND (NEW.waitlist_enabled,NEW.capacity,NEW.canceled_at,NEW.registration_paused) IS DISTINCT FROM (OLD.waitlist_enabled,OLD.capacity,OLD.canceled_at,OLD.registration_paused)) EXECUTE FUNCTION venue_waitlist_changed();
CREATE TRIGGER venue_waitlist_visit_changed AFTER UPDATE ON venue_visits FOR EACH ROW EXECUTE FUNCTION venue_waitlist_changed();
CREATE TRIGGER venue_waitlist_payment_changed AFTER UPDATE ON payment_orders FOR EACH ROW EXECUTE FUNCTION venue_waitlist_changed();

CREATE FUNCTION public.venue_waitlist_offer(p_event uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT pulse_has_required_mfa() THEN RAISE EXCEPTION 'Sign in to view your offer' USING ERRCODE='42501'; END IF;
 RETURN (SELECT jsonb_build_object('id',id,'status',status,'expires_at',expires_at,'payment_order_id',payment_order_id) FROM venue_waitlist_offers WHERE event_id=p_event AND user_id=auth.uid() AND status IN ('offered','checkout') ORDER BY created_at DESC LIMIT 1);
END $$;
CREATE FUNCTION public.venue_waitlist_respond(p_offer uuid,p_accept boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o venue_waitlist_offers;e group_events;
BEGIN
 IF auth.uid() IS NULL OR NOT pulse_has_required_mfa() THEN RAISE EXCEPTION 'Sign in to respond to your offer' USING ERRCODE='42501'; END IF;
 SELECT ev.* INTO e FROM group_events ev JOIN venue_waitlist_offers vo ON vo.event_id=ev.id WHERE vo.id=p_offer AND vo.user_id=auth.uid() FOR UPDATE OF ev;
 SELECT * INTO o FROM venue_waitlist_offers WHERE id=p_offer AND user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND OR o.status<>'offered' OR o.expires_at<=now() OR e.canceled_at IS NOT NULL OR e.registration_paused THEN RAISE EXCEPTION 'This offer is no longer available'; END IF;
 IF p_accept IS TRUE THEN
  IF e.price_cents>0 THEN RAISE EXCEPTION 'Complete secure checkout to accept this paid event place'; END IF;
  UPDATE group_event_rsvps SET status='going',waitlist_position=NULL,updated_at=now() WHERE id=o.rsvp_id;
 ELSE
  UPDATE venue_waitlist_offers SET status='declined',resolved_at=now() WHERE id=o.id;
  UPDATE group_event_rsvps SET status='not_going',waitlist_position=NULL,updated_at=now() WHERE id=o.rsvp_id;
 END IF;
 PERFORM venue_process_waitlist(e.id);
END $$;

ALTER FUNCTION payment_reserve_event(uuid,uuid,boolean,integer,text,uuid) RENAME TO payment_reserve_event_before_offers;
CREATE FUNCTION payment_reserve_event(p_buyer uuid,p_event uuid,p_live boolean,p_expected integer,p_policy text,p_request uuid)
RETURNS payment_orders LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o payment_orders;
BEGIN
 o:=payment_reserve_event_before_offers(p_buyer,p_event,p_live,p_expected,p_policy,p_request);
 IF o.status='pending' AND o.livemode THEN UPDATE venue_waitlist_offers SET status='checkout',payment_order_id=o.id WHERE event_id=p_event AND user_id=p_buyer AND status='offered' AND expires_at>now(); END IF;
 RETURN o;
END $$;
CREATE FUNCTION public.venue_automation_settings_save(p_venue uuid,p_expected timestamptz,p_document jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s venue_automation_settings;e record;
BEGIN
 IF NOT venue_desk_access(p_venue,true) THEN RAISE EXCEPTION 'Venue management access required' USING ERRCODE='42501'; END IF;
 PERFORM id FROM venues WHERE id=p_venue FOR UPDATE;
 SELECT * INTO s FROM venue_automation_settings WHERE venue_id=p_venue;
 IF s.updated_at IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Automation settings changed. Refresh before saving.' USING ERRCODE='40001'; END IF;
 INSERT INTO venue_automation_settings(venue_id,waitlist_offers,offer_minutes,event_reminders,reminder_hours,arrival_instructions)
 VALUES(p_venue,(p_document->>'waitlist_offers')::boolean,(p_document->>'offer_minutes')::integer,(p_document->>'event_reminders')::boolean,(p_document->>'reminder_hours')::integer,coalesce(p_document->>'arrival_instructions',''))
 ON CONFLICT(venue_id) DO UPDATE SET waitlist_offers=excluded.waitlist_offers,offer_minutes=excluded.offer_minutes,event_reminders=excluded.event_reminders,reminder_hours=excluded.reminder_hours,arrival_instructions=excluded.arrival_instructions,updated_at=clock_timestamp();
 FOR e IN SELECT id FROM group_events WHERE venue_id=p_venue AND parent_event_id IS NULL AND end_time>now() AND waitlist_enabled LOOP PERFORM venue_process_waitlist(e.id); END LOOP;
END $$;
REVOKE ALL ON FUNCTION venue_offer_holds(uuid,uuid),venue_process_waitlist(uuid),venue_waitlist_changed(),venue_waitlist_offer(uuid),venue_waitlist_respond(uuid,boolean),payment_reserve_event_before_offers(uuid,uuid,boolean,integer,text,uuid),payment_reserve_event(uuid,uuid,boolean,integer,text,uuid),venue_automation_settings_save(uuid,timestamptz,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION venue_waitlist_offer(uuid),venue_waitlist_respond(uuid,boolean),venue_automation_settings_save(uuid,timestamptz,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION venue_process_waitlist(uuid),payment_reserve_event(uuid,uuid,boolean,integer,text,uuid) TO service_role;
-- Capacity guards and read projections are extended below.

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
    AND NEW.status='going' AND auth.uid() IS NOT NULL AND NOT public.can_record_venue_attendance(auth.uid(),e.venue_id,e.group_id) AND NOT public.venue_self_checkin_allowed(NEW.id,auth.uid()) THEN RAISE EXCEPTION 'Only event managers can change check-in status' USING ERRCODE='42501'; END IF;
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
    n:=n+venue_walkin_seats(e.id)+venue_offer_holds(e.id,NEW.user_id);
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
  n:=n+venue_walkin_seats(e.id)+venue_offer_holds(e.id,p_buyer);
  IF EXISTS(SELECT 1 FROM venue_visits vi JOIN venue_customers cu ON cu.id=vi.customer_id WHERE vi.event_id=e.id AND cu.user_id=p_buyer AND vi.status IN ('pending_payment','expected','checked_in','no_show')) THEN RAISE EXCEPTION 'This player already has a desk registration'; END IF;
  IF n>=e.capacity THEN RAISE EXCEPTION 'No places are available. Other players may be completing checkout.'; END IF;
  RETURN jsonb_build_object('venue_id',v.id,'event_id',e.id,'group_id',e.group_id,'merchant_name',v.name,'account_id',a.account_id,
    'amount_cents',e.price_cents,'currency',e.currency,'description',e.title||' · 1 player','policy',coalesce(e.cancellation_policy,s.cancellation_policy),
    'support_email',s.support_email,'timezone',coalesce(v.timezone,s.timezone),'start_time',e.start_time,'end_time',e.end_time,'spots_left',e.capacity-n);
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
    n:=n+venue_walkin_seats(NEW.id)+venue_offer_holds(NEW.id);
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

CREATE OR REPLACE FUNCTION public.venue_walkin_quote_internal(p_customer uuid,p_event uuid,p_court uuid,p_start timestamptz,p_end timestamptz)
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
  reserved:=venue_offer_holds(e.id)+venue_walkin_seats(e.id)+(SELECT count(*) FROM group_event_rsvps WHERE event_id=e.id AND status='going')+(SELECT count(*) FROM payment_orders WHERE program_event_id=e.id AND status='pending' AND livemode);
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

CREATE OR REPLACE FUNCTION public.get_venue_program_availability(p_event uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE e group_events;
BEGIN
 SELECT * INTO e FROM group_events WHERE id=p_event AND parent_event_id IS NULL;
 IF auth.uid() IS NULL OR e.venue_id IS NULL OR NOT (public.is_group_member(auth.uid(),e.group_id) OR EXISTS(SELECT 1 FROM groups WHERE id=e.group_id AND visibility='public') OR public.can_manage_venue_events(auth.uid(),e.venue_id,e.group_id)) THEN RAISE EXCEPTION 'Event unavailable' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('pending_places',(SELECT count(*) FROM payment_orders WHERE program_event_id=e.id AND status='pending' AND livemode)+(SELECT count(*) FROM venue_visits WHERE event_id=e.id AND status='pending_payment')+venue_offer_holds(e.id,auth.uid()),
 'viewer_desk_registration',EXISTS(SELECT 1 FROM venue_visits vi JOIN venue_customers c ON c.id=vi.customer_id WHERE vi.event_id=e.id AND c.user_id=auth.uid() AND vi.status IN ('expected','checked_in','no_show')),
 'walk_in_places',(SELECT count(*) FROM venue_visits WHERE event_id=e.id AND status IN ('expected','checked_in','no_show')),
 'checkout_order_id',(SELECT id FROM payment_orders WHERE program_event_id=e.id AND buyer_id=auth.uid() AND status='pending' ORDER BY created_at DESC LIMIT 1));
END $$;
CREATE OR REPLACE FUNCTION public.set_group_event_rsvp(p_event_id uuid, p_status text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_event group_events;
  v_going integer;
  v_wait integer;
  v_final text := p_status;
  v_pos integer;
BEGIN
  IF v_uid IS NULL OR NOT pulse_has_required_mfa() THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_status NOT IN ('going','maybe','not_going','waitlist') THEN
    RAISE EXCEPTION 'Invalid RSVP status';
  END IF;

  SELECT * INTO v_event FROM group_events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found';
  END IF;
  IF NOT is_group_member(v_uid, v_event.group_id) THEN
    RAISE EXCEPTION 'Join this community to RSVP';
  END IF;

  IF p_status = 'going' AND v_event.capacity IS NOT NULL THEN
    SELECT count(*) INTO v_going FROM group_event_rsvps
     WHERE event_id = p_event_id AND status = 'going' AND user_id <> v_uid;
    IF v_event.venue_id IS NOT NULL THEN v_going:=v_going+venue_walkin_seats(v_event.id)+venue_offer_holds(v_event.id,v_uid)+(SELECT count(*) FROM payment_orders WHERE program_event_id=v_event.id AND status='pending' AND livemode AND buyer_id<>v_uid); END IF;
    IF v_going >= v_event.capacity THEN
      IF NOT v_event.waitlist_enabled THEN
        RAISE EXCEPTION 'This event is full';
      END IF;
      SELECT count(*) INTO v_wait FROM group_event_rsvps
       WHERE event_id = p_event_id AND status = 'waitlist' AND user_id <> v_uid;
      IF v_event.waitlist_limit IS NOT NULL AND v_wait >= v_event.waitlist_limit THEN
        RAISE EXCEPTION 'The waitlist for this event is full';
      END IF;
      v_final := 'waitlist';
    END IF;
  END IF;

  IF v_final = 'waitlist' THEN
    SELECT COALESCE(max(waitlist_position), 0) + 1 INTO v_pos
      FROM group_event_rsvps WHERE event_id = p_event_id;
  ELSE
    v_pos := NULL;
  END IF;

  INSERT INTO group_event_rsvps (event_id, user_id, status, waitlist_position)
  VALUES (p_event_id, v_uid, v_final, v_pos)
  ON CONFLICT (event_id, user_id)
  DO UPDATE SET status = EXCLUDED.status,
                waitlist_position = CASE WHEN EXCLUDED.status = 'waitlist'
                                         THEN COALESCE(group_event_rsvps.waitlist_position, EXCLUDED.waitlist_position)
                                         ELSE NULL END,
                updated_at = now();

  IF v_final <> 'going' THEN
    PERFORM promote_group_event_waitlist(p_event_id);
  END IF;

  RETURN v_final;
END;
$$;
REVOKE ALL ON FUNCTION set_group_event_rsvp(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION set_group_event_rsvp(uuid,text) TO authenticated;
COMMIT;
