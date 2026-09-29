BEGIN;
CREATE TABLE public.venue_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),venue_id uuid NOT NULL REFERENCES venues(id),
 audience text NOT NULL CHECK(audience IN ('community','event','memberships','no_shows')),event_id uuid REFERENCES group_events(id),
 title text NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 120),body text NOT NULL CHECK(length(trim(body)) BETWEEN 1 AND 2000),
 recipient_count integer NOT NULL,actor_id uuid NOT NULL REFERENCES auth.users(id),request_key uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(venue_id,request_key)
);
CREATE TABLE public.venue_reminder_deliveries (
 event_id uuid NOT NULL REFERENCES group_events(id),user_id uuid NOT NULL REFERENCES auth.users(id),
 event_start timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(event_id,user_id,event_start)
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['venue_messages','venue_reminder_deliveries'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
  EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
  EXECUTE format('CREATE POLICY pulse_required_mfa ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.pulse_has_required_mfa())) WITH CHECK ((SELECT public.pulse_has_required_mfa()))',t);
 END LOOP;
END $$;
CREATE FUNCTION public.venue_message_recipients(p_venue uuid,p_audience text,p_event uuid DEFAULT NULL)
RETURNS TABLE(user_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 WITH candidates AS (
  SELECT gm.user_id FROM group_members gm JOIN groups g ON g.id=gm.group_id WHERE g.venue_id=p_venue AND gm.status='active' AND p_audience='community'
  UNION
  SELECT r.user_id FROM group_event_rsvps r JOIN group_events e ON e.id=r.event_id WHERE e.venue_id=p_venue AND e.id=p_event AND p_audience='event' AND r.status IN ('going','waitlist')
  UNION
  SELECT c.user_id FROM venue_visits v JOIN venue_customers c ON c.id=v.customer_id WHERE v.venue_id=p_venue AND v.event_id=p_event AND p_audience='event' AND v.status IN ('expected','checked_in','no_show')
  UNION
  SELECT c.user_id FROM venue_entitlements e JOIN venue_customers c ON c.id=e.customer_id WHERE e.venue_id=p_venue AND p_audience='memberships' AND e.kind='membership' AND e.revoked_at IS NULL AND now()>=e.starts_at AND now()<e.expires_at
  UNION
  SELECT c.user_id FROM venue_visits v JOIN venue_customers c ON c.id=v.customer_id WHERE v.venue_id=p_venue AND p_audience='no_shows' AND v.status='no_show' AND v.start_time>=now()-interval '30 days'
  UNION
  SELECT r.user_id FROM group_event_rsvps r JOIN group_events e ON e.id=r.event_id WHERE e.venue_id=p_venue AND p_audience='no_shows' AND r.no_show_at IS NOT NULL AND e.start_time>=now()-interval '30 days'
 ) SELECT DISTINCT c.user_id FROM candidates c WHERE c.user_id IS NOT NULL
 AND NOT EXISTS(SELECT 1 FROM group_notification_prefs p JOIN groups g ON g.id=p.group_id WHERE g.venue_id=p_venue AND p.user_id=c.user_id AND (coalesce(p.muted_all,false) OR p.events IS FALSE))
 AND NOT EXISTS(SELECT 1 FROM notification_preferences WHERE user_id=c.user_id AND category='community' AND in_app_enabled IS FALSE)
 AND (auth.uid() IS NULL OR c.user_id<>auth.uid())
$$;
CREATE FUNCTION public.venue_communications_workspace(p_venue uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT venue_desk_access(p_venue,true) THEN RAISE EXCEPTION 'Venue management access required' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('settings',(SELECT to_jsonb(s) FROM venue_automation_settings s WHERE venue_id=p_venue),
 'events',coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY start_time) FROM (SELECT id,title,start_time FROM group_events WHERE venue_id=p_venue AND parent_event_id IS NULL AND venue_court_id IS NULL AND start_time>now()-interval '30 days' AND canceled_at IS NULL ORDER BY start_time LIMIT 500)e),'[]'::jsonb),
 'messages',coalesce((SELECT jsonb_agg(to_jsonb(m) ORDER BY created_at DESC) FROM (SELECT * FROM venue_messages WHERE venue_id=p_venue ORDER BY created_at DESC LIMIT 50)m),'[]'::jsonb),
 'offers',coalesce((SELECT jsonb_agg(to_jsonb(o) ORDER BY expires_at) FROM (SELECT o.id,e.title,o.status,o.expires_at FROM venue_waitlist_offers o JOIN group_events e ON e.id=o.event_id WHERE o.venue_id=p_venue AND o.status IN ('offered','checkout') ORDER BY o.expires_at LIMIT 200)o),'[]'::jsonb));
END $$;
CREATE FUNCTION public.venue_message_preview(p_venue uuid,p_audience text,p_event uuid DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT venue_desk_access(p_venue,true) THEN RAISE EXCEPTION 'Venue management access required' USING ERRCODE='42501'; END IF;
 IF p_audience NOT IN ('community','event','memberships','no_shows') THEN RAISE EXCEPTION 'Choose a message audience'; END IF;
 IF p_audience='event' AND NOT EXISTS(SELECT 1 FROM group_events WHERE id=p_event AND venue_id=p_venue AND parent_event_id IS NULL) THEN RAISE EXCEPTION 'Choose an event at this venue'; END IF;
 RETURN (SELECT count(*)::integer FROM venue_message_recipients(p_venue,p_audience,p_event));
END $$;
CREATE FUNCTION public.venue_message_send(p_venue uuid,p_audience text,p_event uuid,p_title text,p_body text,p_expected integer,p_request uuid)
RETURNS venue_messages LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m venue_messages;recipients uuid[];recipient uuid;g uuid;n integer;
BEGIN
 n:=venue_message_preview(p_venue,p_audience,p_event);
 PERFORM id FROM venues WHERE id=p_venue FOR UPDATE;
 SELECT * INTO m FROM venue_messages WHERE venue_id=p_venue AND request_key=p_request;
 IF FOUND THEN
  IF (m.title,m.body,m.audience,m.event_id) IS DISTINCT FROM (trim(p_title),trim(p_body),p_audience,p_event) THEN RAISE EXCEPTION 'Message request changed. Review and try again.'; END IF; RETURN m;
 END IF;
 SELECT array_agg(user_id) INTO recipients FROM venue_message_recipients(p_venue,p_audience,p_event);
 n:=coalesce(cardinality(recipients),0);
 IF n<>p_expected OR n=0 THEN RAISE EXCEPTION 'Audience changed or is empty. Preview the message again.'; END IF;
 SELECT id INTO g FROM groups WHERE venue_id=p_venue ORDER BY id LIMIT 1;
 INSERT INTO venue_messages(venue_id,audience,event_id,title,body,recipient_count,actor_id,request_key) VALUES(p_venue,p_audience,p_event,trim(p_title),trim(p_body),n,auth.uid(),p_request) RETURNING * INTO m;
 FOREACH recipient IN ARRAY recipients LOOP
  PERFORM enqueue_notification(recipient,'group_event_new','community',m.title,m.body,'/player/community/group/'||g::text||CASE WHEN p_event IS NOT NULL THEN '?program='||p_event::text ELSE '' END,auth.uid(),jsonb_build_object('venue_id',p_venue,'message_id',m.id));
 END LOOP;
 RETURN m;
END $$;
CREATE FUNCTION public.venue_process_automations()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e record;r record;inserted integer;sent integer:=0;
BEGIN
 IF NOT pg_try_advisory_xact_lock(hashtext('venue_process_automations')) THEN RETURN 0; END IF;
 FOR e IN SELECT ev.id FROM group_events ev JOIN venue_automation_settings s ON s.venue_id=ev.venue_id WHERE s.waitlist_offers AND ev.parent_event_id IS NULL AND ev.end_time>now() AND ev.waitlist_enabled LOOP
  PERFORM venue_process_waitlist(e.id);
 END LOOP;
 FOR e IN SELECT ev.*,s.arrival_instructions,v.timezone FROM group_events ev JOIN venue_automation_settings s ON s.venue_id=ev.venue_id JOIN venues v ON v.id=ev.venue_id
  WHERE s.event_reminders AND v.is_active AND ev.parent_event_id IS NULL AND ev.venue_court_id IS NULL AND ev.canceled_at IS NULL AND ev.start_time>now() AND ev.start_time<=now()+make_interval(hours=>s.reminder_hours) LOOP
  FOR r IN SELECT * FROM venue_message_recipients(e.venue_id,'event',e.id) WHERE user_id IN (
   SELECT user_id FROM group_event_rsvps WHERE event_id=e.id AND status='going' UNION SELECT c.user_id FROM venue_visits v JOIN venue_customers c ON c.id=v.customer_id WHERE v.event_id=e.id AND v.status='expected'
  ) LOOP
   INSERT INTO venue_reminder_deliveries(event_id,user_id,event_start) VALUES(e.id,r.user_id,e.start_time) ON CONFLICT DO NOTHING;
   GET DIAGNOSTICS inserted=ROW_COUNT;
   IF inserted=1 THEN
    PERFORM enqueue_notification(r.user_id,'group_event_new','community','Your upcoming visit',e.title||' · '||to_char(e.start_time AT TIME ZONE coalesce(e.timezone,'America/New_York'),'Dy Mon DD, HH24:MI')||' ('||coalesce(e.timezone,'America/New_York')||')'||CASE WHEN e.arrival_instructions<>'' THEN E'\n'||e.arrival_instructions ELSE '' END,'/player/community/group/'||e.group_id::text||'?program='||e.id::text,NULL,jsonb_build_object('event_id',e.id,'group_id',e.group_id,'reminder',true));
    sent:=sent+1;
   END IF;
  END LOOP;
 END LOOP;
 RETURN sent;
END $$;
REVOKE ALL ON FUNCTION venue_message_recipients(uuid,text,uuid),venue_communications_workspace(uuid),venue_message_preview(uuid,text,uuid),venue_message_send(uuid,text,uuid,text,text,integer,uuid),venue_process_automations() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION venue_communications_workspace(uuid),venue_message_preview(uuid,text,uuid),venue_message_send(uuid,text,uuid,text,text,integer,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION venue_process_automations() TO service_role;
COMMIT;
