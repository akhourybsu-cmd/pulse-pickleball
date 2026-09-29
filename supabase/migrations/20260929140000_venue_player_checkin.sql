BEGIN;
CREATE TABLE public.venue_kiosk_sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),venue_id uuid NOT NULL REFERENCES venues(id),
 created_by uuid NOT NULL REFERENCES auth.users(id),created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL,revoked_at timestamptz
);
CREATE TABLE public.venue_self_checkin_intents (
 rsvp_id uuid NOT NULL REFERENCES group_event_rsvps(id) ON DELETE CASCADE,transaction_id bigint NOT NULL,
 actor_id uuid REFERENCES auth.users(id),created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(rsvp_id,transaction_id)
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['venue_kiosk_sessions','venue_self_checkin_intents'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
  EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
  EXECUTE format('CREATE POLICY pulse_required_mfa ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.pulse_has_required_mfa())) WITH CHECK ((SELECT public.pulse_has_required_mfa()))',t);
 END LOOP;
END $$;
CREATE FUNCTION public.venue_kiosk_create(p_venue uuid,p_hours integer DEFAULT 8)
RETURNS venue_kiosk_sessions LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE k venue_kiosk_sessions;
BEGIN
 IF NOT venue_desk_access(p_venue) THEN RAISE EXCEPTION 'Venue desk access required' USING ERRCODE='42501'; END IF;
 IF p_hours IS NULL OR p_hours NOT BETWEEN 1 AND 24 OR EXISTS(SELECT 1 FROM private_venue_sandboxes WHERE venue_id=p_venue) THEN RAISE EXCEPTION 'Choose a live venue and a kiosk session of 1 to 24 hours'; END IF;
 INSERT INTO venue_kiosk_sessions(venue_id,created_by,expires_at) VALUES(p_venue,auth.uid(),now()+make_interval(hours=>p_hours)) RETURNING * INTO k;
 RETURN k;
END $$;
CREATE FUNCTION public.venue_kiosk_manage(p_venue uuid,p_revoke uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT venue_desk_access(p_venue) THEN RAISE EXCEPTION 'Venue desk access required' USING ERRCODE='42501'; END IF;
 IF p_revoke IS NOT NULL THEN UPDATE venue_kiosk_sessions SET revoked_at=now() WHERE id=p_revoke AND venue_id=p_venue; IF NOT FOUND THEN RAISE EXCEPTION 'Kiosk not found'; END IF; END IF;
 RETURN coalesce((SELECT jsonb_agg(to_jsonb(k) ORDER BY created_at DESC) FROM venue_kiosk_sessions k WHERE venue_id=p_venue AND expires_at>now()-interval '1 day'),'[]'::jsonb);
END $$;
CREATE FUNCTION public.venue_kiosk_validate(p_token uuid)
RETURNS venue_kiosk_sessions LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE k venue_kiosk_sessions;
BEGIN
 SELECT s.* INTO k FROM venue_kiosk_sessions s JOIN venues v ON v.id=s.venue_id WHERE s.token=p_token AND s.revoked_at IS NULL AND s.expires_at>now() AND v.is_active IS NOT FALSE
 AND (v.owner_id=s.created_by OR EXISTS(SELECT 1 FROM venue_staff st WHERE st.venue_id=v.id AND st.user_id=s.created_by AND st.is_active IS NOT FALSE AND (st.status IS NULL OR st.status::text='active') AND (st.role::text IN ('owner','manager') OR (st.role::text='staff' AND venue_has_module(v.id,'facility_tools')))));
 IF NOT FOUND THEN RAISE EXCEPTION 'This check-in station is closed. Please visit the front desk.'; END IF;
 RETURN k;
END $$;
CREATE FUNCTION public.venue_kiosk_view(p_token uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE k venue_kiosk_sessions;v jsonb;
BEGIN
 k:=venue_kiosk_validate(p_token);SELECT to_jsonb(venue) INTO v FROM venues venue WHERE id=k.venue_id;
 RETURN jsonb_build_object('venue_name',v->>'name','expires_at',k.expires_at,'timezone',coalesce(v->>'timezone','America/New_York'),'group_id',(SELECT id FROM groups WHERE venue_id=k.venue_id ORDER BY id LIMIT 1),
  'brand',jsonb_build_object('logo_url',v->>'logo_url','logo_shape',v->>'logo_shape','logo_image_fit',v->>'logo_image_fit','logo_background_color',v->>'logo_background_color','primary_color',v->>'primary_color','secondary_color',v->>'secondary_color','accent_color',v->>'accent_color'));
END $$;

CREATE FUNCTION public.venue_self_checkin_context(p_token uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE k venue_kiosk_sessions;c venue_customers;p record;l venue_visit_links;
BEGIN
 IF auth.uid() IS NULL OR NOT pulse_has_required_mfa() THEN RAISE EXCEPTION 'Sign in to check in for your own visit' USING ERRCODE='42501'; END IF;
 k:=venue_kiosk_validate(p_token);
 IF NOT EXISTS(SELECT 1 FROM group_members m JOIN groups g ON g.id=m.group_id WHERE g.venue_id=k.venue_id AND m.user_id=auth.uid() AND m.status='active')
 AND NOT EXISTS(SELECT 1 FROM group_event_rsvps r JOIN group_events e ON e.id=r.event_id WHERE e.venue_id=k.venue_id AND r.user_id=auth.uid() AND r.status='going')
 AND NOT EXISTS(SELECT 1 FROM venue_customers WHERE venue_id=k.venue_id AND user_id=auth.uid()) THEN RAISE EXCEPTION 'Join the venue community or ask the front desk to register your visit first'; END IF;
 SELECT * INTO p FROM profiles_public WHERE id=auth.uid();
 INSERT INTO venue_customers(venue_id,user_id,first_name,last_name,created_by) VALUES(k.venue_id,auth.uid(),left(coalesce(nullif(trim(p.first_name),''),nullif(split_part(trim(p.full_name),' ',1),''),'Player'),80),left(coalesce(p.last_name,''),80),auth.uid()) ON CONFLICT(venue_id,user_id) DO NOTHING;
 SELECT * INTO c FROM venue_customers WHERE venue_id=k.venue_id AND user_id=auth.uid();
 SELECT * INTO l FROM venue_visit_links WHERE customer_id=c.id AND created_by=auth.uid() AND revoked_at IS NULL AND expires_at>now()+interval '1 hour' ORDER BY expires_at DESC LIMIT 1;
 IF NOT FOUND THEN INSERT INTO venue_visit_links(venue_id,customer_id,created_by,expires_at) VALUES(k.venue_id,c.id,auth.uid(),least(k.expires_at,now()+interval '4 hours')) RETURNING * INTO l; END IF;
 RETURN venue_visit_document_view(l.token)||jsonb_build_object('visit_token',l.token);
END $$;

CREATE FUNCTION public.venue_self_checkin_allowed(p_rsvp uuid,p_actor uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM venue_self_checkin_intents WHERE rsvp_id=p_rsvp AND transaction_id=txid_current() AND actor_id IS NOT DISTINCT FROM p_actor)
$$;
CREATE FUNCTION public.venue_self_checkin(p_token uuid,p_rsvp uuid DEFAULT NULL,p_visit uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l venue_visit_links;c venue_customers;e group_events;r group_event_rsvps;v venue_visits;
BEGIN
 IF auth.uid() IS NOT NULL AND NOT pulse_has_required_mfa() THEN RAISE EXCEPTION 'Complete sign-in verification before checking in' USING ERRCODE='42501'; END IF;
 SELECT * INTO l FROM venue_visit_links WHERE token=p_token AND revoked_at IS NULL AND expires_at>now();
 IF NOT FOUND THEN RAISE EXCEPTION 'This visit link expired. Ask the front desk for a new one.'; END IF;
 SELECT * INTO c FROM venue_customers WHERE id=l.customer_id;
 IF auth.uid() IS NOT NULL AND c.user_id IS NOT NULL AND auth.uid()<>c.user_id THEN RAISE EXCEPTION 'Use the participant account for this check-in'; END IF;
 IF (p_rsvp IS NOT NULL)::integer+(p_visit IS NOT NULL)::integer<>1 THEN RAISE EXCEPTION 'Choose your visit'; END IF;
 IF venue_missing_documents(c.id)>0 THEN RAISE EXCEPTION 'Acknowledge the required venue documents before checking in'; END IF;
 IF p_rsvp IS NOT NULL THEN
  SELECT ev.* INTO e FROM group_events ev JOIN group_event_rsvps rs ON rs.event_id=ev.id WHERE rs.id=p_rsvp AND rs.user_id=c.user_id AND ev.venue_id=c.venue_id FOR UPDATE OF ev;
  SELECT * INTO r FROM group_event_rsvps WHERE id=p_rsvp AND user_id=c.user_id FOR UPDATE;
  IF r.id IS NULL OR e.id IS NULL OR r.status<>'going' OR e.canceled_at IS NOT NULL OR e.start_time>now()+interval '1 hour' OR e.end_time<=now() THEN RAISE EXCEPTION 'Check-in opens one hour before your confirmed event and closes when it ends. Ask the front desk for help.'; END IF;
  IF r.checked_in_at IS NOT NULL THEN RETURN; END IF;
  INSERT INTO venue_self_checkin_intents(rsvp_id,transaction_id,actor_id) VALUES(r.id,txid_current(),auth.uid()) ON CONFLICT DO NOTHING;
  UPDATE group_event_rsvps SET checked_in_at=now(),checked_in_by=auth.uid(),no_show_at=NULL,updated_at=now() WHERE id=r.id;
  DELETE FROM venue_self_checkin_intents WHERE rsvp_id=r.id AND transaction_id=txid_current();
 ELSE
  SELECT * INTO v FROM venue_visits WHERE id=p_visit AND customer_id=c.id FOR UPDATE;
  IF NOT FOUND OR v.status NOT IN ('expected','checked_in') OR v.start_time>now()+interval '1 hour' OR v.end_time<=now() THEN RAISE EXCEPTION 'Check-in opens one hour before your paid or confirmed visit and closes when it ends. Ask the front desk for help.'; END IF;
  IF v.status='checked_in' THEN RETURN; END IF;
  UPDATE venue_visits SET status='checked_in',checked_in_at=now(),version=version+1 WHERE id=v.id;
 END IF;
END $$;

ALTER FUNCTION public.venue_visit_document_view(uuid) RENAME TO venue_visit_document_view_before_checkin;
CREATE FUNCTION public.venue_visit_document_view(p_token uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;l venue_visit_links;c venue_customers;v jsonb;
BEGIN
 result:=venue_visit_document_view_before_checkin(p_token);
 SELECT * INTO l FROM venue_visit_links WHERE token=p_token;
 SELECT * INTO c FROM venue_customers WHERE id=l.customer_id;
 SELECT to_jsonb(venue) INTO v FROM venues venue WHERE id=c.venue_id;
 RETURN result||jsonb_build_object('server_now',now(),'timezone',coalesce(v->>'timezone','America/New_York'),
  'brand',jsonb_build_object('logo_url',v->>'logo_url','logo_shape',v->>'logo_shape','logo_image_fit',v->>'logo_image_fit','logo_background_color',v->>'logo_background_color','primary_color',v->>'primary_color','secondary_color',v->>'secondary_color','accent_color',v->>'accent_color'),
  'visits',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY start_time) FROM (
   SELECT r.id,'registration'::text kind,e.title,e.start_time,e.end_time,r.checked_in_at,NULL::text visit_status FROM group_event_rsvps r JOIN group_events e ON e.id=r.event_id
    WHERE r.user_id=c.user_id AND e.venue_id=c.venue_id AND r.status='going' AND e.canceled_at IS NULL AND e.end_time>now() AND e.start_time<now()+interval '24 hours'
   UNION ALL SELECT vi.id,'desk',vi.title,vi.start_time,vi.end_time,vi.checked_in_at,vi.status FROM venue_visits vi
    WHERE vi.customer_id=c.id AND vi.end_time>now() AND vi.start_time<now()+interval '24 hours' AND vi.status NOT IN ('canceled','expired')
  ) x),'[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION venue_kiosk_create(uuid,integer),venue_kiosk_manage(uuid,uuid),venue_kiosk_validate(uuid),venue_kiosk_view(uuid),venue_self_checkin_context(uuid),venue_self_checkin_allowed(uuid,uuid),venue_self_checkin(uuid,uuid,uuid),venue_visit_document_view_before_checkin(uuid),venue_visit_document_view(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION venue_kiosk_create(uuid,integer),venue_kiosk_manage(uuid,uuid),venue_self_checkin_context(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION venue_kiosk_view(uuid),venue_self_checkin(uuid,uuid,uuid),venue_visit_document_view(uuid) TO anon,authenticated;
-- The existing attendance guards are amended below. Only the transaction-bound,
-- private intent created above permits a participant to mark their own RSVP.

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
    n:=n+venue_walkin_seats(e.id);
    IF n>=e.capacity THEN RAISE EXCEPTION 'This event has no unreserved places'; END IF;
  ELSIF NEW.status='waitlist' THEN
    IF NOT e.waitlist_enabled THEN RAISE EXCEPTION 'The waitlist is closed'; END IF;
    IF e.waitlist_limit IS NOT NULL AND (SELECT count(*) FROM group_event_rsvps WHERE event_id=e.id AND status='waitlist' AND user_id<>NEW.user_id)>=e.waitlist_limit THEN RAISE EXCEPTION 'The waitlist is full'; END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_venue_attendance() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e group_events; changed boolean;
BEGIN
  IF TG_OP='INSERT' THEN
    NEW.attendance_version:=0;
    changed:=NEW.checked_in_at IS NOT NULL OR NEW.no_show_at IS NOT NULL;
  ELSE
    NEW.attendance_version:=OLD.attendance_version;
    changed:=(NEW.checked_in_at,NEW.checked_in_by,NEW.no_show_at) IS DISTINCT FROM (OLD.checked_in_at,OLD.checked_in_by,OLD.no_show_at);
  END IF;
  IF NEW.status<>'going' THEN
    NEW.checked_in_at:=NULL; NEW.checked_in_by:=NULL; NEW.no_show_at:=NULL;
    IF TG_OP='UPDATE' THEN changed:=changed OR OLD.checked_in_at IS NOT NULL OR OLD.no_show_at IS NOT NULL; END IF;
  END IF;
  IF NOT changed THEN RETURN NEW; END IF;
  SELECT * INTO e FROM group_events WHERE id=NEW.event_id;
  IF NEW.status='going' THEN
    IF auth.uid() IS NOT NULL AND NOT public.can_record_venue_attendance(auth.uid(),e.venue_id,e.group_id) AND NOT public.venue_self_checkin_allowed(NEW.id,auth.uid()) THEN
      RAISE EXCEPTION 'Venue attendance access required' USING ERRCODE='42501'; END IF;
    IF e.venue_id IS NULL OR e.parent_event_id IS NOT NULL OR e.canceled_at IS NOT NULL
      OR e.event_format NOT IN ('open_play','clinic','practice','round_robin','social','other') THEN
      RAISE EXCEPTION 'Attendance requires an active venue event'; END IF;
    IF NEW.checked_in_at IS NOT NULL AND NEW.no_show_at IS NOT NULL THEN RAISE EXCEPTION 'An attendee cannot also be a no-show'; END IF;
    IF NEW.no_show_at IS NOT NULL AND e.end_time>now() THEN RAISE EXCEPTION 'Record no-shows after the event ends'; END IF;
  END IF;
  NEW.attendance_version:=NEW.attendance_version+1;
  RETURN NEW;
END $$;
COMMIT;
