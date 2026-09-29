-- Attendance stays on the registration; staff never gain payment authority.
BEGIN;
ALTER TABLE public.group_event_rsvps ADD COLUMN no_show_at timestamptz,
  ADD COLUMN attendance_version integer NOT NULL DEFAULT 0;
CREATE TABLE public.venue_attendance_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES public.venues(id),
  event_id uuid NOT NULL REFERENCES public.group_events(id) ON DELETE CASCADE,
  rsvp_id uuid REFERENCES public.group_event_rsvps(id) ON DELETE SET NULL,
  player_id uuid NOT NULL REFERENCES auth.users(id), actor_id uuid REFERENCES auth.users(id),
  previous_status text NOT NULL, status text NOT NULL, changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX venue_attendance_audit_event ON public.venue_attendance_audit(event_id,changed_at);
ALTER TABLE public.venue_attendance_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.venue_attendance_audit FROM anon,authenticated;

CREATE FUNCTION public.can_record_venue_attendance(p_user uuid,p_venue uuid,p_group uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT p_user IS NOT NULL AND public.pulse_has_required_mfa() AND (
    public.can_manage_venue_events(p_user,p_venue,p_group) OR (
      public.venue_has_module(p_venue,'facility_tools') AND
      EXISTS(SELECT 1 FROM groups WHERE id=p_group AND venue_id=p_venue) AND
      EXISTS(SELECT 1 FROM venue_staff WHERE venue_id=p_venue AND user_id=p_user
        AND role::text='staff' AND is_active IS NOT FALSE AND (status IS NULL OR status::text='active'))))
$$;

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


-- Guard every write path, including the legacy check-in action and cancellations.
CREATE FUNCTION public.guard_venue_attendance() RETURNS trigger
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
    IF auth.uid() IS NOT NULL AND NOT public.can_record_venue_attendance(auth.uid(),e.venue_id,e.group_id) THEN
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
CREATE TRIGGER guard_venue_attendance BEFORE INSERT OR UPDATE ON public.group_event_rsvps
  FOR EACH ROW EXECUTE FUNCTION public.guard_venue_attendance();
CREATE FUNCTION public.audit_venue_attendance() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.attendance_version=OLD.attendance_version THEN RETURN NEW; END IF;
  INSERT INTO venue_attendance_audit(venue_id,event_id,rsvp_id,player_id,actor_id,previous_status,status)
    SELECT e.venue_id,e.id,NEW.id,NEW.user_id,auth.uid(),
      CASE WHEN OLD.checked_in_at IS NOT NULL THEN 'checked_in' WHEN OLD.no_show_at IS NOT NULL THEN 'no_show' ELSE 'expected' END,
      CASE WHEN NEW.status<>'going' THEN 'canceled' WHEN NEW.checked_in_at IS NOT NULL THEN 'checked_in' WHEN NEW.no_show_at IS NOT NULL THEN 'no_show' ELSE 'expected' END
    FROM group_events e WHERE e.id=NEW.event_id AND e.venue_id IS NOT NULL;
  RETURN NEW;
END $$;
CREATE TRIGGER audit_venue_attendance AFTER UPDATE ON public.group_event_rsvps
  FOR EACH ROW EXECUTE FUNCTION public.audit_venue_attendance();

CREATE FUNCTION public.record_venue_attendance(p_event uuid,p_rsvp uuid,p_status text,p_expected_version integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e group_events; r group_event_rsvps;
BEGIN
  SELECT * INTO e FROM group_events WHERE id=p_event FOR UPDATE;
  IF NOT FOUND OR NOT public.can_record_venue_attendance(auth.uid(),e.venue_id,e.group_id) THEN
    RAISE EXCEPTION 'Venue attendance access required' USING ERRCODE='42501'; END IF;
  IF e.parent_event_id IS NOT NULL OR e.canceled_at IS NOT NULL THEN RAISE EXCEPTION 'Attendance requires an active venue event'; END IF;
  SELECT * INTO r FROM group_event_rsvps WHERE id=p_rsvp AND event_id=e.id FOR UPDATE;
  IF NOT FOUND OR r.status<>'going' THEN RAISE EXCEPTION 'Only confirmed attendees can be checked in'; END IF;
  IF p_expected_version IS DISTINCT FROM r.attendance_version THEN RAISE EXCEPTION 'Attendance changed on another desk. Refresh and try again.' USING ERRCODE='40001'; END IF;
  IF p_status IS NULL OR p_status NOT IN ('expected','checked_in','no_show') THEN RAISE EXCEPTION 'Choose a valid attendance status'; END IF;
  IF p_status='no_show' AND e.end_time>now() THEN RAISE EXCEPTION 'Record no-shows after the event ends'; END IF;
  UPDATE group_event_rsvps SET
    checked_in_at=CASE WHEN p_status='checked_in' THEN coalesce(checked_in_at,now()) END,
    checked_in_by=CASE WHEN p_status='checked_in' THEN coalesce(checked_in_by,auth.uid()) END,
    no_show_at=CASE WHEN p_status='no_show' THEN coalesce(no_show_at,now()) END,
    updated_at=now() WHERE id=r.id;
END $$;

CREATE OR REPLACE FUNCTION public.set_venue_event_checkin(p_event uuid,p_rsvp uuid,p_checked boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE version integer;
BEGIN
  PERFORM id FROM group_events WHERE id=p_event FOR UPDATE;
  SELECT attendance_version INTO version FROM group_event_rsvps WHERE id=p_rsvp AND event_id=p_event;
  PERFORM public.record_venue_attendance(p_event,p_rsvp,CASE WHEN p_checked THEN 'checked_in' ELSE 'expected' END,version);
END $$;

CREATE FUNCTION public.close_venue_event_attendance(p_event uuid,p_expected_ids uuid[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e group_events; ids uuid[]; affected integer;
BEGIN
  SELECT * INTO e FROM group_events WHERE id=p_event FOR UPDATE;
  IF NOT FOUND OR NOT public.can_record_venue_attendance(auth.uid(),e.venue_id,e.group_id) THEN
    RAISE EXCEPTION 'Venue attendance access required' USING ERRCODE='42501'; END IF;
  IF e.canceled_at IS NOT NULL OR e.end_time>now() OR e.parent_event_id IS NOT NULL THEN RAISE EXCEPTION 'Close attendance after an active event ends'; END IF;
  SELECT coalesce(array_agg(id ORDER BY id),'{}'::uuid[]) INTO ids FROM group_event_rsvps
    WHERE event_id=e.id AND status='going' AND checked_in_at IS NULL AND no_show_at IS NULL;
  IF ids IS DISTINCT FROM (SELECT coalesce(array_agg(x ORDER BY x),'{}'::uuid[]) FROM unnest(p_expected_ids) x) THEN
    RAISE EXCEPTION 'Attendance changed on another desk. Refresh before closing attendance.' USING ERRCODE='40001'; END IF;
  UPDATE group_event_rsvps SET no_show_at=now(),updated_at=now() WHERE id=ANY(ids);
  GET DIAGNOSTICS affected=ROW_COUNT;
  RETURN affected;
END $$;

CREATE FUNCTION public.get_venue_attendance_day(p_group uuid,p_day date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v venues; tz text; from_time timestamptz; to_time timestamptz;
BEGIN
  SELECT venue.* INTO v FROM groups g JOIN venues venue ON venue.id=g.venue_id WHERE g.id=p_group;
  IF NOT FOUND OR NOT public.can_record_venue_attendance(auth.uid(),v.id,p_group) THEN
    RAISE EXCEPTION 'Venue attendance access required' USING ERRCODE='42501'; END IF;
  IF p_day IS NULL OR NOT isfinite(p_day) THEN RAISE EXCEPTION 'Choose a calendar date'; END IF;
  tz:=coalesce(v.timezone,'America/New_York');
  from_time:=p_day::timestamp AT TIME ZONE tz; to_time:=(p_day+1)::timestamp AT TIME ZONE tz;
  RETURN jsonb_build_object('venue_id',v.id,'timezone',tz,'day',p_day,'server_now',now(),'events',coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id',e.id,'title',e.title,'event_format',e.event_format,'start_time',e.start_time,'end_time',e.end_time,
      'canceled_at',e.canceled_at,'capacity',e.capacity,
      'courts',coalesce((SELECT jsonb_agg(coalesce(c.name,'Court '||c.court_number) ORDER BY c.court_number,c.id)
        FROM group_events h JOIN venue_courts c ON c.id=h.venue_court_id WHERE h.parent_event_id=e.id AND h.event_format='program_hold'),'[]'::jsonb),
      'waitlisted',(SELECT count(*) FROM group_event_rsvps WHERE event_id=e.id AND status='waitlist'),
      'attendees',coalesce((SELECT jsonb_agg(jsonb_build_object('id',r.id,
        'name',CASE WHEN coalesce(nullif(trim(split_part(coalesce(nullif(p.first_name,''),p.full_name,''),' ',1)),''),'Player') LIKE '%@%' THEN 'Player' ELSE coalesce(nullif(trim(split_part(coalesce(nullif(p.first_name,''),p.full_name,''),' ',1)),''),'Player') || CASE WHEN coalesce(nullif(trim(p.last_name),''),CASE WHEN trim(p.full_name) LIKE '% %' THEN regexp_replace(trim(p.full_name),'^.* ','') END) IS NOT NULL AND coalesce(nullif(trim(p.last_name),''),CASE WHEN trim(p.full_name) LIKE '% %' THEN regexp_replace(trim(p.full_name),'^.* ','') END) NOT LIKE '%@%' THEN ' '||upper(left(coalesce(nullif(trim(p.last_name),''),CASE WHEN trim(p.full_name) LIKE '% %' THEN regexp_replace(trim(p.full_name),'^.* ','') END),1))||'.' ELSE '' END END,
        'checked_in_at',r.checked_in_at,'no_show_at',r.no_show_at,'version',r.attendance_version)
        ORDER BY lower(coalesce(p.first_name,p.full_name,'Player')),r.id)
        FROM group_event_rsvps r LEFT JOIN profiles_public p ON p.id=r.user_id WHERE r.event_id=e.id AND r.status='going'),'[]'::jsonb)
    ) ORDER BY e.start_time,e.id) FROM group_events e
      WHERE e.group_id=p_group AND e.venue_id=v.id AND e.parent_event_id IS NULL
        AND e.event_format IN ('open_play','clinic','practice','round_robin','social','other')
        AND e.start_time<to_time AND e.end_time>from_time),'[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.can_record_venue_attendance(uuid,uuid,uuid),public.record_venue_attendance(uuid,uuid,text,integer),public.close_venue_event_attendance(uuid,uuid[]),public.get_venue_attendance_day(uuid,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_record_venue_attendance(uuid,uuid,uuid),public.record_venue_attendance(uuid,uuid,text,integer),public.close_venue_event_attendance(uuid,uuid[]),public.get_venue_attendance_day(uuid,date) TO authenticated;
CREATE OR REPLACE FUNCTION public.get_venue_event_attendees(p_event uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE e group_events;
BEGIN
  SELECT * INTO e FROM group_events WHERE id=p_event AND parent_event_id IS NULL;
  IF NOT FOUND OR NOT can_manage_venue_events(auth.uid(),e.venue_id,e.group_id) THEN RAISE EXCEPTION 'Venue event management access required' USING ERRCODE='42501'; END IF;
  RETURN coalesce((WITH entries AS (
    SELECT r.id,r.user_id,r.status,r.checked_in_at,r.no_show_at,r.attendance_version,o.id order_id,o.status payment_status,o.amount_cents,o.refunded_cents,o.refund_state,o.livemode
      FROM group_event_rsvps r LEFT JOIN payment_orders o ON o.id=r.payment_order_id WHERE r.event_id=e.id
    UNION ALL
    SELECT NULL,o.buyer_id,'checkout',NULL,NULL,0,o.id,o.status,o.amount_cents,o.refunded_cents,o.refund_state,o.livemode
      FROM payment_orders o WHERE o.program_event_id=e.id AND NOT EXISTS(SELECT 1 FROM group_event_rsvps r WHERE r.payment_order_id=o.id)
  ), labels AS (
    SELECT x.*,split_part(coalesce(nullif(trim(p.first_name),''),nullif(trim(p.full_name),''),'Player'),' ',1) first,
      coalesce(nullif(trim(p.last_name),''),CASE WHEN trim(p.full_name) LIKE '% %' THEN regexp_replace(trim(p.full_name),'^.* ','') END) last
    FROM entries x LEFT JOIN profiles_public p ON p.id=x.user_id
  ) SELECT jsonb_agg(jsonb_build_object('id',id,'name',CASE WHEN first LIKE '%@%' THEN 'Player' ELSE first||CASE WHEN last IS NOT NULL AND last NOT LIKE '%@%' THEN ' '||upper(left(last,1))||'.' ELSE '' END END,
    'status',status,'checked_in_at',checked_in_at,'no_show_at',no_show_at,'attendance_version',attendance_version,'order_id',order_id,'payment_status',payment_status,'amount_cents',amount_cents,'refunded_cents',refunded_cents,'refund_state',refund_state,'livemode',livemode) ORDER BY lower(first),id) FROM labels),'[]'::jsonb);
END $$;
-- Checking arrivals must not rebuild or re-authorize a competition roster.
CREATE OR REPLACE FUNCTION public.sync_venue_competition_registration() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='UPDATE' AND (NEW.event_id,NEW.user_id,NEW.status) IS NOT DISTINCT FROM (OLD.event_id,OLD.user_id,OLD.status) THEN RETURN NEW; END IF;
 PERFORM public.sync_venue_round_robin(CASE WHEN TG_OP='DELETE' THEN OLD.event_id ELSE NEW.event_id END);
 RETURN coalesce(NEW,OLD);
END $$;
COMMIT;
