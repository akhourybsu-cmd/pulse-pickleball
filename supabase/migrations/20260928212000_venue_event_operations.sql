BEGIN;
CREATE OR REPLACE FUNCTION public.check_venue_program_courts() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE target uuid; event public.group_events; old_parent uuid; new_parent uuid;
BEGIN
  IF TG_OP<>'INSERT' THEN old_parent:=OLD.parent_event_id; END IF;
  IF TG_OP<>'DELETE' THEN new_parent:=NEW.parent_event_id; END IF;
  FOR target IN SELECT DISTINCT id FROM unnest(ARRAY[coalesce(NEW.id,OLD.id),old_parent,new_parent]) id WHERE id IS NOT NULL LOOP
    SELECT * INTO event FROM public.group_events WHERE id=target;
    IF NOT FOUND THEN CONTINUE; END IF;
    IF EXISTS(SELECT 1 FROM public.group_events WHERE parent_event_id=event.id)
      AND (event.event_format NOT IN ('open_play','round_robin','practice','social','clinic','other')
        OR event.venue_id IS NULL OR event.venue_court_id IS NOT NULL OR event.parent_event_id IS NOT NULL) THEN
      RAISE EXCEPTION 'Court blocks require a public venue program';
    END IF;
    IF event.canceled_at IS NOT NULL THEN
      IF EXISTS(SELECT 1 FROM group_events WHERE parent_event_id=event.id) THEN RAISE EXCEPTION 'Canceled events cannot hold courts'; END IF;
      CONTINUE;
    END IF;
    IF event.event_format='program_hold' THEN
      IF NOT EXISTS(SELECT 1 FROM public.group_events p WHERE p.id=event.parent_event_id
        AND p.venue_id=event.venue_id AND p.group_id=event.group_id
        AND p.start_time=event.start_time AND p.end_time=event.end_time
        AND p.canceled_at IS NULL AND p.parent_event_id IS NULL AND p.venue_court_id IS NULL
        AND p.event_format IN ('open_play','round_robin','practice','social','clinic','other')) THEN
        RAISE EXCEPTION 'Court blocks must match their venue program and full duration';
      END IF;
    ELSIF event.venue_id IS NOT NULL AND event.event_format IN ('open_play','round_robin','practice','social','clinic','other') THEN
      IF event.end_time IS NULL OR event.end_time<=event.start_time
        OR NOT isfinite(event.start_time) OR NOT isfinite(event.end_time) THEN
        RAISE EXCEPTION 'Venue programs require a positive duration';
      END IF;
      IF event.venue_court_id IS NULL AND NOT EXISTS(SELECT 1 FROM public.group_events h
        WHERE h.parent_event_id=event.id AND h.event_format='program_hold') THEN
        RAISE EXCEPTION 'Venue programs require dedicated courts; schedule the event and courts together';
      END IF;
      IF EXISTS(SELECT 1 FROM public.group_events h WHERE h.parent_event_id=event.id
        AND (h.event_format<>'program_hold' OR h.venue_id IS DISTINCT FROM event.venue_id
          OR h.group_id IS DISTINCT FROM event.group_id OR h.start_time IS DISTINCT FROM event.start_time
          OR h.end_time IS DISTINCT FROM event.end_time)) THEN
        RAISE EXCEPTION 'Court blocks must match their venue program and full duration';
      END IF;
    END IF;
  END LOOP;
  RETURN NULL;
END $$;
CREATE OR REPLACE FUNCTION public.payment_request_cancellation(p_order uuid,p_buyer uuid,p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o payment_orders;
BEGIN
  SELECT * INTO o FROM payment_orders WHERE id=p_order AND buyer_id=p_buyer AND kind IN ('court_rental','event_registration') AND status IN ('paid','partially_refunded','refunded') FOR UPDATE;
  IF NOT FOUND OR o.canceled_at IS NOT NULL THEN RAISE EXCEPTION 'No cancellable reservation found'; END IF;
  IF p_note IS NULL OR length(p_note) NOT BETWEEN 5 AND 1000 THEN RAISE EXCEPTION 'Please give the venue a short reason (5–1000 characters)'; END IF;
  INSERT INTO payment_cancellation_requests(order_id,buyer_id,venue_id,note) VALUES(o.id,o.buyer_id,o.venue_id,p_note)
    ON CONFLICT(order_id) DO UPDATE SET note=p_note,status='requested',refund_review_only=false,resolution_note=NULL,resolved_by=NULL,updated_at=now()
    WHERE payment_cancellation_requests.refund_review_only AND payment_cancellation_requests.status='approved';
END $$;
CREATE OR REPLACE FUNCTION public.payment_cancel_reservation(p_order uuid,p_owner uuid,p_note text,p_decision text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.payment_orders;
BEGIN
  IF p_decision='refund_pending' AND NOT EXISTS(SELECT 1 FROM payment_orders po JOIN venue_payment_accounts a ON a.venue_id=po.venue_id AND a.account_id=po.account_id AND a.livemode=po.livemode JOIN venues v ON v.id=po.venue_id WHERE po.id=p_order AND a.connected_by=p_owner AND v.owner_id=p_owner AND a.disconnected_at IS NULL) THEN RAISE EXCEPTION 'Financial ownership review is required before refunding this payment'; END IF;
  PERFORM e.id FROM group_events e JOIN payment_orders po ON po.program_event_id=e.id WHERE po.id=p_order FOR UPDATE OF e;
  SELECT * INTO o FROM public.payment_orders WHERE id=p_order AND kind IN ('court_rental','event_registration') FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.venues WHERE id=o.venue_id AND owner_id=p_owner) THEN RAISE EXCEPTION 'Only the venue owner may resolve this reservation'; END IF;
  IF p_note IS NULL OR p_decision IS NULL OR length(p_note) NOT BETWEEN 5 AND 1000 OR p_decision NOT IN ('declined','cancel_without_refund','refund_pending') THEN RAISE EXCEPTION 'Choose a resolution and include a note'; END IF;
  IF o.status NOT IN ('paid','partially_refunded','refunded') THEN RAISE EXCEPTION 'This reservation is not paid'; END IF;
  IF p_decision<>'refund_pending' AND EXISTS(SELECT 1 FROM public.payment_cancellation_requests WHERE order_id=o.id AND status='refund_pending') THEN
    RAISE EXCEPTION 'A refund is already in progress. Resolve it in Stripe before changing this decision.';
  END IF;
  UPDATE public.payment_cancellation_requests SET status=CASE WHEN p_decision='cancel_without_refund' THEN 'approved' ELSE p_decision END,
    resolution_note=p_note,resolved_by=p_owner,updated_at=now() WHERE order_id=o.id AND status IN ('requested','refund_pending','refund_failed');
  IF NOT FOUND THEN RAISE EXCEPTION 'No open cancellation request'; END IF;
  IF p_decision='cancel_without_refund' THEN
    UPDATE public.payment_orders SET canceled_at=now(),updated_at=now() WHERE id=o.id;
    IF o.kind='court_rental' THEN DELETE FROM group_events WHERE payment_order_id=o.id;
    ELSE UPDATE group_event_rsvps SET status='not_going',checked_in_at=NULL,checked_in_by=NULL,updated_at=now() WHERE payment_order_id=o.id; END IF;
  END IF;
END $$;
CREATE OR REPLACE FUNCTION public.payment_apply_refund_snapshot(p_account text,p_live boolean,p_intent text,p_version bigint,p_amount integer,p_attempts jsonb,p_disputed boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o payment_orders; total integer; pending boolean; failed boolean; state text;
BEGIN
  PERFORM e.id FROM group_events e JOIN payment_orders po ON po.program_event_id=e.id WHERE po.account_id=p_account AND po.livemode=p_live AND po.payment_intent_id=p_intent FOR UPDATE OF e;
  SELECT * INTO o FROM payment_orders WHERE account_id=p_account AND livemode=p_live AND payment_intent_id=p_intent FOR UPDATE;
  IF NOT FOUND OR p_version IS NULL OR p_version<1 OR p_version<>o.refund_sync_version OR o.status NOT IN ('paid','partially_refunded','refunded') THEN RETURN false; END IF;
  IF p_amount IS DISTINCT FROM o.amount_cents OR p_disputed IS NULL OR p_attempts IS NULL OR jsonb_typeof(p_attempts)<>'array' THEN
    RAISE EXCEPTION 'Invalid refund snapshot';
  END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_attempts) a WHERE
    jsonb_typeof(a)<>'object' OR coalesce(a->>'id','')!~'^(re_|pyr_)[A-Za-z0-9]+$'
    OR coalesce(a->>'status','') NOT IN ('pending','requires_action','succeeded','failed','canceled')
    OR coalesce(a->>'amount','')!~'^[1-9][0-9]*$' OR (a->>'amount')::numeric>o.amount_cents)
    OR (SELECT count(*)<>count(DISTINCT a->>'id') FROM jsonb_array_elements(p_attempts) a) THEN
    RAISE EXCEPTION 'Invalid refund attempts';
  END IF;
  SELECT coalesce(sum((a->>'amount')::integer) FILTER (WHERE a->>'status'='succeeded'),0),
    coalesce(bool_or(a->>'status' IN ('pending','requires_action')),false),
    coalesce(bool_or(a->>'status' IN ('failed','canceled')),false)
    INTO total,pending,failed FROM jsonb_array_elements(p_attempts) a;
  IF total>o.amount_cents THEN RAISE EXCEPTION 'Refund verification mismatch'; END IF;
  -- A formerly succeeded refund may fail, or need further action, later.
  state:=CASE WHEN total=o.amount_cents THEN 'none' WHEN pending THEN 'pending' WHEN failed THEN 'failed' ELSE 'none' END;
  UPDATE payment_orders SET refunded_cents=total,disputed=p_disputed,
    status=CASE WHEN total=amount_cents THEN 'refunded' WHEN total>0 THEN 'partially_refunded' ELSE 'paid' END,
    refund_state=state,refund_attempts=coalesce((SELECT jsonb_agg(jsonb_build_object('id',a->>'id','amount',(a->>'amount')::integer,'status',a->>'status')) FROM jsonb_array_elements(p_attempts) a),'[]'::jsonb),
    refund_checked_at=clock_timestamp(),updated_at=now() WHERE id=o.id;
  IF o.kind IN ('court_rental','event_registration') THEN
    IF state='failed' THEN
      INSERT INTO payment_cancellation_requests(order_id,buyer_id,venue_id,note,status,refund_review_only)
        VALUES(o.id,o.buyer_id,o.venue_id,'Stripe reported an unsuccessful refund. Review the payment and contact the player.','refund_failed',true)
        ON CONFLICT(order_id) DO UPDATE SET status='refund_failed',updated_at=now();
    ELSIF state='pending' THEN
      UPDATE payment_cancellation_requests SET status='refund_pending',updated_at=now()
        WHERE order_id=o.id AND status IN ('approved','refund_failed');
    ELSIF total=o.amount_cents AND EXISTS(SELECT 1 FROM payment_cancellation_requests WHERE order_id=o.id AND status IN ('refund_pending','refund_failed')) THEN
      IF EXISTS(SELECT 1 FROM payment_cancellation_requests WHERE order_id=o.id AND NOT refund_review_only) THEN
        UPDATE payment_orders SET canceled_at=coalesce(canceled_at,now()) WHERE id=o.id;
        IF o.kind='court_rental' THEN DELETE FROM group_events WHERE payment_order_id=o.id;
        ELSE UPDATE group_event_rsvps SET status='not_going',checked_in_at=NULL,checked_in_by=NULL,updated_at=now() WHERE payment_order_id=o.id; END IF;
      END IF;
      UPDATE payment_cancellation_requests SET status='approved',updated_at=now() WHERE order_id=o.id;
    END IF;
    -- Never re-create a canceled booking: another player may now hold the court.
  END IF;
  IF total=o.amount_cents AND o.kind='venue_module' AND o.livemode THEN
    UPDATE venue_module_access SET enabled=false,updated_at=now() WHERE venue_id=o.venue_id AND module_key=o.module_key AND source='subscription'
      AND NOT EXISTS(SELECT 1 FROM payment_orders newer WHERE newer.venue_id=o.venue_id AND newer.module_key=o.module_key AND newer.livemode AND newer.status='paid' AND newer.created_at>o.created_at);
  END IF;
  RETURN true;
END $$;
CREATE FUNCTION public.cancel_venue_program(p_event uuid,p_expected timestamptz,p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e group_events;
BEGIN
  SELECT * INTO e FROM group_events WHERE id=p_event AND parent_event_id IS NULL AND venue_id IS NOT NULL AND event_format IN ('open_play','clinic','practice','round_robin','social','other') FOR UPDATE;
  IF NOT FOUND OR NOT can_manage_venue_events(auth.uid(),e.venue_id,e.group_id) THEN RAISE EXCEPTION 'Venue event management access required' USING ERRCODE='42501'; END IF;
  IF e.canceled_at IS NOT NULL THEN RETURN; END IF;
  IF e.updated_at IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'This event changed. Reload before canceling.' USING ERRCODE='40001'; END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) NOT BETWEEN 5 AND 1000 THEN RAISE EXCEPTION 'Enter a cancellation reason of 5–1000 characters'; END IF;
  UPDATE group_events SET canceled_at=now(),cancellation_reason=trim(p_reason),registration_paused=true,updated_at=clock_timestamp() WHERE id=e.id;
  DELETE FROM group_events WHERE parent_event_id=e.id;
  UPDATE payment_orders SET canceled_at=coalesce(canceled_at,now()) WHERE program_event_id=e.id AND status IN ('paid','partially_refunded','refunded');
  INSERT INTO payment_cancellation_requests(order_id,buyer_id,venue_id,note)
    SELECT id,buyer_id,venue_id,'Venue canceled the event: '||left(p_reason,950) FROM payment_orders WHERE program_event_id=e.id AND status IN ('paid','partially_refunded') AND refunded_cents<amount_cents
    ON CONFLICT(order_id) DO UPDATE SET status=CASE WHEN payment_cancellation_requests.status='refund_pending' THEN 'refund_pending' ELSE 'requested' END,note=excluded.note,refund_review_only=false,updated_at=now();
  UPDATE group_event_rsvps SET status='not_going',checked_in_at=NULL,checked_in_by=NULL,updated_at=now() WHERE event_id=e.id;
END $$;

CREATE FUNCTION public.payment_save_event_settings(p_user uuid,p_venue uuid,p_accepting boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s venue_payment_settings;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM venues WHERE id=p_venue AND owner_id=p_user) THEN RAISE EXCEPTION 'Only the venue owner can manage payments'; END IF;
  SELECT * INTO s FROM venue_payment_settings WHERE venue_id=p_venue FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Save your venue payment policies first'; END IF;
  IF p_accepting AND (NOT venue_has_module(p_venue,'facility_tools') OR NOT payment_venue_owner_eligible(p_venue,p_user,true)
    OR NOT s.tax_inclusive_acknowledged OR length(s.cancellation_policy)<20 OR coalesce(s.support_email,'')=''
    OR NOT EXISTS(SELECT 1 FROM venue_payment_accounts WHERE venue_id=p_venue AND livemode AND connected_by=p_user AND disconnected_at IS NULL AND charges_enabled AND payouts_enabled AND card_payments_active AND disabled_reason IS NULL)) THEN RAISE EXCEPTION 'Complete Stripe verification, payment policies and facility setup first'; END IF;
  UPDATE venue_payment_settings SET accepting_event_payments=coalesce(p_accepting,false),updated_at=now() WHERE venue_id=p_venue;
END $$;

CREATE FUNCTION public.get_venue_event_management(p_group uuid,p_from timestamptz,p_to timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v venues;
BEGIN
  SELECT v0.* INTO v FROM venues v0 JOIN groups g ON g.venue_id=v0.id WHERE g.id=p_group;
  IF NOT FOUND OR NOT can_manage_venue_events(auth.uid(),v.id,p_group) THEN RAISE EXCEPTION 'Venue event management access required' USING ERRCODE='42501'; END IF;
  IF p_from IS NULL OR p_to IS NULL OR NOT isfinite(p_from) OR NOT isfinite(p_to) OR p_to<=p_from OR p_to>p_from+interval '366 days' THEN RAISE EXCEPTION 'Choose a date range up to one year'; END IF;
  RETURN jsonb_build_object('venue',jsonb_build_object('id',v.id,'name',v.name,'timezone',v.timezone),'is_owner',v.owner_id=auth.uid(),'facility_enabled',venue_has_module(v.id,'facility_tools'),
    'accepting_event_payments',coalesce((SELECT accepting_event_payments FROM venue_payment_settings WHERE venue_id=v.id),false),
    'courts',coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.court_number) FROM venue_courts c WHERE c.venue_id=v.id AND c.is_active),'[]'::jsonb),
    'drafts',coalesce((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.updated_at DESC) FROM venue_event_drafts d WHERE d.venue_id=v.id AND d.group_id=p_group AND d.archived_at IS NULL AND d.published_event_ids IS NULL),'[]'::jsonb),
    'events',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.start_time) FROM (SELECT e.*,
      ARRAY(SELECT venue_court_id FROM group_events WHERE parent_event_id=e.id ORDER BY venue_court_id) court_ids,
      (SELECT count(*) FROM group_event_rsvps WHERE event_id=e.id AND status='going') going,
      (SELECT count(*) FROM group_event_rsvps WHERE event_id=e.id AND status='waitlist') waitlisted,
      (SELECT count(*) FROM payment_orders WHERE program_event_id=e.id AND livemode AND status='pending') pending,
      (SELECT coalesce(sum(amount_cents-refunded_cents),0) FROM payment_orders WHERE program_event_id=e.id AND livemode AND status IN ('paid','partially_refunded','refunded')) collected_cents
      FROM group_events e WHERE e.venue_id=v.id AND e.group_id=p_group AND e.parent_event_id IS NULL AND e.event_format IN ('open_play','clinic','practice','round_robin','social','other') AND e.start_time>=p_from AND e.start_time<p_to ORDER BY e.start_time LIMIT 500) x),'[]'::jsonb));
END $$;

-- Never return a player's surname, contact information or payment credentials.
CREATE FUNCTION public.get_venue_event_attendees(p_event uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE e group_events;
BEGIN
  SELECT * INTO e FROM group_events WHERE id=p_event AND parent_event_id IS NULL;
  IF NOT FOUND OR NOT can_manage_venue_events(auth.uid(),e.venue_id,e.group_id) THEN RAISE EXCEPTION 'Venue event management access required' USING ERRCODE='42501'; END IF;
  RETURN coalesce((WITH entries AS (
    SELECT r.id,r.user_id,r.status,r.checked_in_at,o.id order_id,o.status payment_status,o.amount_cents,o.refunded_cents,o.refund_state,o.livemode
      FROM group_event_rsvps r LEFT JOIN payment_orders o ON o.id=r.payment_order_id WHERE r.event_id=e.id
    UNION ALL
    SELECT NULL,o.buyer_id,'checkout',NULL,o.id,o.status,o.amount_cents,o.refunded_cents,o.refund_state,o.livemode
      FROM payment_orders o WHERE o.program_event_id=e.id AND NOT EXISTS(SELECT 1 FROM group_event_rsvps r WHERE r.payment_order_id=o.id)
  ), labels AS (
    SELECT x.*,split_part(coalesce(nullif(trim(p.first_name),''),nullif(trim(p.full_name),''),'Player'),' ',1) first,
      coalesce(nullif(trim(p.last_name),''),CASE WHEN trim(p.full_name) LIKE '% %' THEN regexp_replace(trim(p.full_name),'^.* ','') END) last
    FROM entries x LEFT JOIN profiles_public p ON p.id=x.user_id
  ) SELECT jsonb_agg(jsonb_build_object('id',id,'name',CASE WHEN first LIKE '%@%' THEN 'Player' ELSE first||CASE WHEN last IS NOT NULL AND last NOT LIKE '%@%' THEN ' '||upper(left(last,1))||'.' ELSE '' END END,
    'status',status,'checked_in_at',checked_in_at,'order_id',order_id,'payment_status',payment_status,'amount_cents',amount_cents,'refunded_cents',refunded_cents,'refund_state',refund_state,'livemode',livemode) ORDER BY lower(first),id) FROM labels),'[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.cancel_venue_program(uuid,timestamptz,text),public.get_venue_event_management(uuid,timestamptz,timestamptz),public.get_venue_event_attendees(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.cancel_venue_program(uuid,timestamptz,text),public.get_venue_event_management(uuid,timestamptz,timestamptz),public.get_venue_event_attendees(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.payment_save_event_settings(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.payment_save_event_settings(uuid,uuid,boolean) TO service_role;
-- Keep registered players informed when staff change their event.
CREATE FUNCTION public.notify_venue_program_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE player uuid;
BEGIN
  IF NEW.venue_id IS NULL OR NEW.parent_event_id IS NOT NULL OR NEW.event_format NOT IN ('open_play','clinic','practice','round_robin','social','other')
    OR (NEW.title,NEW.start_time,NEW.end_time,NEW.canceled_at) IS NOT DISTINCT FROM (OLD.title,OLD.start_time,OLD.end_time,OLD.canceled_at) THEN RETURN NEW; END IF;
  FOR player IN SELECT DISTINCT x.user_id FROM (
    SELECT user_id FROM group_event_rsvps WHERE event_id=NEW.id AND status IN ('going','waitlist','maybe')
    UNION SELECT buyer_id FROM payment_orders WHERE program_event_id=NEW.id AND status='pending' AND livemode
  ) x LEFT JOIN group_notification_prefs p ON p.group_id=NEW.group_id AND p.user_id=x.user_id
  WHERE NOT coalesce(p.muted_all,false) AND coalesce(p.events,true) LOOP
    PERFORM enqueue_notification(player,'group_event_new','community',CASE WHEN NEW.canceled_at IS NOT NULL THEN 'Event canceled' ELSE 'Event updated' END,
      NEW.title||CASE WHEN NEW.canceled_at IS NOT NULL THEN ': '||NEW.cancellation_reason ELSE ': check the updated time and details.' END,
      '/player/community/group/'||NEW.group_id::text||'?program='||NEW.id::text,auth.uid(),jsonb_build_object('event_id',NEW.id,'group_id',NEW.group_id));
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER notify_venue_program_change AFTER UPDATE ON public.group_events FOR EACH ROW EXECUTE FUNCTION public.notify_venue_program_change();
REVOKE ALL ON FUNCTION public.notify_venue_program_change() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.guard_court_payment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
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
COMMIT;
