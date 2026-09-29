BEGIN;
-- Credentials are encrypted in Vault; browser roles have no access to these tables.
CREATE TABLE public.venue_email_connections (
 venue_id uuid PRIMARY KEY REFERENCES venues(id), provider text NOT NULL CHECK(provider IN ('pulse','resend','sendgrid','postmark')),
 sender_name text NOT NULL,from_email text NOT NULL,reply_to text NOT NULL,footer text NOT NULL DEFAULT '',message_stream text NOT NULL DEFAULT 'broadcast',
 secret_id uuid,version uuid NOT NULL DEFAULT gen_random_uuid(),enabled boolean NOT NULL DEFAULT false,
 tested_at timestamptz,updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),updated_by uuid NOT NULL REFERENCES auth.users(id)
);
CREATE TABLE public.venue_email_preferences (
 venue_id uuid NOT NULL REFERENCES venues(id),user_id uuid NOT NULL REFERENCES auth.users(id),subscribed boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(venue_id,user_id)
);
CREATE TABLE public.venue_email_campaigns (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),venue_id uuid NOT NULL REFERENCES venues(id),actor_id uuid NOT NULL REFERENCES auth.users(id),
 subject text NOT NULL,body text NOT NULL,audience text NOT NULL CHECK(audience IN ('community','event')),event_id uuid REFERENCES group_events(id),
 recipient_count integer NOT NULL,request_key uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(venue_id,request_key)
);
CREATE TABLE public.venue_email_outbox (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),venue_id uuid NOT NULL REFERENCES venues(id),connection_version uuid NOT NULL,
 campaign_id uuid REFERENCES venue_email_campaigns(id),user_id uuid NOT NULL REFERENCES auth.users(id),recipient_email text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('test','announcement')),subject text NOT NULL,body text NOT NULL,
 brand jsonb NOT NULL,footer text NOT NULL,venue_url text NOT NULL,unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','sending','accepted','failed','unknown','canceled','suppressed')),
 attempts integer NOT NULL DEFAULT 0,available_at timestamptz NOT NULL DEFAULT now(),lease uuid,lease_until timestamptz,
 provider_id text,last_error text,created_at timestamptz NOT NULL DEFAULT now(),finished_at timestamptz,
 UNIQUE(campaign_id,user_id)
);
CREATE INDEX venue_email_pending ON venue_email_outbox(available_at,created_at) WHERE status='queued';
CREATE INDEX venue_email_history ON venue_email_outbox(venue_id,created_at DESC);
CREATE UNIQUE INDEX venue_email_one_in_flight ON venue_email_outbox(venue_id) WHERE status='sending';
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['venue_email_connections','venue_email_preferences','venue_email_campaigns','venue_email_outbox'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
  EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
 END LOOP;
END $$;
CREATE FUNCTION public.venue_email_actor_access(p_venue uuid,p_actor uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT p_actor IS NOT NULL AND EXISTS(SELECT 1 FROM venues v WHERE v.id=p_venue AND v.is_active AND v.verification_approved_at IS NOT NULL
 AND NOT EXISTS(SELECT 1 FROM private_venue_sandboxes WHERE venue_id=v.id)
 AND (v.owner_id=p_actor OR EXISTS(SELECT 1 FROM venue_staff WHERE venue_id=v.id AND user_id=p_actor AND is_active IS NOT FALSE AND (status IS NULL OR status::text='active') AND role::text IN ('owner','manager'))))
$$;
CREATE FUNCTION public.venue_email_brand(p_venue uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('name',v.name,'logo_url',to_jsonb(v)->>'logo_url','primary_color',to_jsonb(v)->>'primary_color',
 'address',to_jsonb(v)->>'address','city',to_jsonb(v)->>'city','state',to_jsonb(v)->>'state') FROM venues v WHERE id=p_venue
$$;
CREATE FUNCTION public.venue_email_workspace(p_venue uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT coalesce(venue_desk_access(p_venue,true),false) THEN RAISE EXCEPTION 'Venue management access required' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('eligible',venue_email_actor_access(p_venue,auth.uid()),'brand',venue_email_brand(p_venue),
 'connection',(SELECT to_jsonb(c)-'secret_id' FROM venue_email_connections c WHERE venue_id=p_venue),
 'test_email',(SELECT email FROM auth.users WHERE id=auth.uid()),
 'deliveries',coalesce((SELECT jsonb_agg(to_jsonb(j) ORDER BY created_at DESC) FROM (SELECT id,kind,subject,status,last_error,created_at,finished_at FROM venue_email_outbox WHERE venue_id=p_venue ORDER BY created_at DESC LIMIT 30)j),'[]'::jsonb),
 'campaigns',coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY created_at DESC) FROM (SELECT id,subject,recipient_count,created_at,
 (SELECT count(*) FROM venue_email_outbox o WHERE o.campaign_id=m.id AND status='accepted') accepted,
 (SELECT count(*) FROM venue_email_outbox o WHERE o.campaign_id=m.id AND status IN ('failed','unknown')) needs_attention
 FROM venue_email_campaigns m WHERE venue_id=p_venue ORDER BY created_at DESC LIMIT 20)c),'[]'::jsonb));
END $$;
CREATE FUNCTION public.venue_email_save(p_venue uuid,p_actor uuid,p_expected uuid,p_document jsonb,p_key text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,vault AS $$
DECLARE c venue_email_connections;sid uuid;provider text:=p_document->>'provider';sender text:=trim(p_document->>'sender_name');
 from_address text:=lower(trim(p_document->>'from_email'));reply text:=lower(trim(p_document->>'reply_to'));stream text:=coalesce(p_document->>'message_stream','broadcast');
BEGIN
 IF NOT coalesce(venue_email_actor_access(p_venue,p_actor),false) THEN RAISE EXCEPTION 'Active verified venue management required' USING ERRCODE='42501'; END IF;
 PERFORM id FROM venues WHERE id=p_venue FOR UPDATE;
 SELECT * INTO c FROM venue_email_connections WHERE venue_id=p_venue FOR UPDATE;
 IF c.version IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Settings changed. Refresh before saving.'; END IF;
 IF provider IS NULL OR provider NOT IN ('pulse','resend','sendgrid','postmark') OR coalesce(length(sender),0) NOT BETWEEN 1 AND 100 OR sender ~ '[<>\r\n]' THEN RAISE EXCEPTION 'Choose a provider and a valid sender name'; END IF;
 IF provider='pulse' THEN from_address:='support@pulsepb.com'; END IF;
 IF coalesce(length(from_address),0) NOT BETWEEN 3 AND 254 OR from_address !~ '^[A-Za-z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
 OR coalesce(length(reply),0) NOT BETWEEN 3 AND 254 OR reply !~ '^[A-Za-z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN RAISE EXCEPTION 'Enter valid sender and reply-to email addresses'; END IF;
 IF length(coalesce(p_document->>'footer',''))>500 OR stream !~ '^[a-zA-Z0-9_-]{1,100}$' OR (provider='postmark' AND stream='outbound') THEN RAISE EXCEPTION 'Check the footer and broadcast message stream'; END IF;
 IF provider<>'pulse' THEN
  IF nullif(p_key,'') IS NULL THEN
   IF c.provider IS DISTINCT FROM provider OR c.secret_id IS NULL THEN RAISE EXCEPTION 'Enter this provider’s sending API key'; END IF;
   sid:=c.secret_id;
  ELSE
   IF length(p_key) NOT BETWEEN 16 AND 1000 OR p_key ~ '[[:space:]]' THEN RAISE EXCEPTION 'Enter a valid provider API key'; END IF;
   IF c.secret_id IS NOT NULL AND c.provider=provider THEN sid:=c.secret_id; PERFORM vault.update_secret(sid,p_key);
   ELSE SELECT vault.create_secret(p_key,'venue-email-'||p_venue::text||'-'||gen_random_uuid()::text) INTO sid; END IF;
  END IF;
 END IF;
 IF c.secret_id IS NOT NULL AND c.secret_id IS DISTINCT FROM sid THEN DELETE FROM vault.secrets WHERE id=c.secret_id; END IF;
 INSERT INTO venue_email_connections(venue_id,provider,sender_name,from_email,reply_to,footer,message_stream,secret_id,updated_by)
 VALUES(p_venue,provider,sender,from_address,reply,coalesce(p_document->>'footer',''),stream,sid,p_actor)
 ON CONFLICT(venue_id) DO UPDATE SET provider=excluded.provider,sender_name=excluded.sender_name,from_email=excluded.from_email,reply_to=excluded.reply_to,footer=excluded.footer,message_stream=excluded.message_stream,secret_id=excluded.secret_id,version=gen_random_uuid(),enabled=false,tested_at=NULL,updated_at=clock_timestamp(),updated_by=p_actor;
 UPDATE venue_email_outbox SET status='canceled',last_error='Sender settings changed. Compose a new message.',finished_at=now() WHERE venue_id=p_venue AND status='queued';
END $$;
CREATE FUNCTION public.venue_email_toggle(p_venue uuid,p_expected uuid,p_enabled boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c venue_email_connections;
BEGIN
 IF NOT coalesce(venue_desk_access(p_venue,true),false) THEN RAISE EXCEPTION 'Venue management access required' USING ERRCODE='42501'; END IF;
 SELECT * INTO c FROM venue_email_connections WHERE venue_id=p_venue FOR UPDATE;
 IF c.version IS NULL OR c.version IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Settings changed. Refresh before continuing.'; END IF;
 IF p_enabled IS TRUE AND (c.tested_at IS NULL OR NOT venue_email_actor_access(p_venue,auth.uid())) THEN RAISE EXCEPTION 'Send a successful test from your active verified venue first'; END IF;
 UPDATE venue_email_connections SET enabled=coalesce(p_enabled,false),updated_at=clock_timestamp(),updated_by=auth.uid() WHERE venue_id=p_venue;
END $$;
CREATE FUNCTION public.venue_email_disconnect(p_venue uuid,p_actor uuid,p_expected uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,vault AS $$
DECLARE c venue_email_connections;
BEGIN
 IF NOT coalesce(venue_email_actor_access(p_venue,p_actor),false) THEN RAISE EXCEPTION 'Venue management access required' USING ERRCODE='42501'; END IF;
 PERFORM id FROM venues WHERE id=p_venue FOR UPDATE;
 SELECT * INTO c FROM venue_email_connections WHERE venue_id=p_venue FOR UPDATE;
 IF c.version IS NULL OR c.version IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Settings changed. Refresh before continuing.'; END IF;
 DELETE FROM venue_email_connections WHERE venue_id=p_venue;
 IF c.secret_id IS NOT NULL THEN DELETE FROM vault.secrets WHERE id=c.secret_id; END IF;
 UPDATE venue_email_outbox SET status='canceled',finished_at=now() WHERE venue_id=p_venue AND status='queued';
END $$;
CREATE FUNCTION public.venue_email_preference(p_group uuid,p_subscribed boolean DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v uuid;s boolean;
BEGIN
 IF auth.uid() IS NULL OR NOT pulse_has_required_mfa() THEN RAISE EXCEPTION 'Sign in to update your preferences' USING ERRCODE='42501'; END IF;
 SELECT g.venue_id INTO v FROM groups g JOIN group_members m ON m.group_id=g.id WHERE g.id=p_group AND m.user_id=auth.uid() AND m.status='active';
 IF v IS NULL THEN RETURN NULL; END IF;
 IF p_subscribed IS NOT NULL THEN INSERT INTO venue_email_preferences(venue_id,user_id,subscribed) VALUES(v,auth.uid(),p_subscribed) ON CONFLICT(venue_id,user_id) DO UPDATE SET subscribed=excluded.subscribed,updated_at=clock_timestamp(); END IF;
 SELECT subscribed INTO s FROM venue_email_preferences WHERE venue_id=v AND user_id=auth.uid();
 RETURN jsonb_build_object('subscribed',coalesce(s,false),'global_enabled',NOT EXISTS(SELECT 1 FROM notification_preferences WHERE user_id=auth.uid() AND category='community' AND email_enabled IS FALSE));
END $$;
CREATE FUNCTION public.venue_email_recipients(p_venue uuid,p_event uuid DEFAULT NULL) RETURNS TABLE(user_id uuid,email text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT u.id,lower(u.email) FROM auth.users u JOIN venue_email_preferences p ON p.user_id=u.id AND p.venue_id=p_venue AND p.subscribed
 WHERE u.email_confirmed_at IS NOT NULL AND u.email IS NOT NULL
 AND EXISTS(SELECT 1 FROM group_members m JOIN groups g ON g.id=m.group_id WHERE g.venue_id=p_venue AND m.user_id=u.id AND m.status='active')
 AND (p_event IS NULL OR EXISTS(SELECT 1 FROM group_event_rsvps r JOIN group_events e ON e.id=r.event_id WHERE e.id=p_event AND e.venue_id=p_venue AND r.user_id=u.id AND r.status IN ('going','waitlist')))
 AND NOT EXISTS(SELECT 1 FROM suppressed_emails s WHERE lower(s.email)=lower(u.email))
 AND NOT EXISTS(SELECT 1 FROM notification_preferences WHERE user_id=u.id AND category='community' AND email_enabled IS FALSE)
 AND NOT EXISTS(SELECT 1 FROM group_notification_prefs p JOIN groups g ON g.id=p.group_id WHERE g.venue_id=p_venue AND p.user_id=u.id AND (p.muted_all OR p.events IS FALSE))
$$;
CREATE FUNCTION public.venue_email_preview(p_venue uuid,p_event uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT coalesce(venue_desk_access(p_venue,true),false) THEN RAISE EXCEPTION 'Venue management access required' USING ERRCODE='42501'; END IF;
 IF p_event IS NOT NULL AND NOT EXISTS(SELECT 1 FROM group_events WHERE id=p_event AND venue_id=p_venue AND parent_event_id IS NULL AND canceled_at IS NULL) THEN RAISE EXCEPTION 'Choose an active event at this venue'; END IF;
 RETURN (SELECT jsonb_build_object('count',count(*),'fingerprint',md5(coalesce(string_agg(user_id::text||':'||email,',' ORDER BY user_id),''))) FROM venue_email_recipients(p_venue,p_event));
END $$;
CREATE FUNCTION public.venue_email_campaign_send(p_venue uuid,p_event uuid,p_subject text,p_body text,p_fingerprint text,p_request uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c venue_email_connections;m venue_email_campaigns;preview jsonb;g uuid;
BEGIN
 IF NOT coalesce(venue_desk_access(p_venue,true),false) OR NOT venue_email_actor_access(p_venue,auth.uid()) THEN RAISE EXCEPTION 'Active verified venue management required' USING ERRCODE='42501'; END IF;
 PERFORM id FROM venues WHERE id=p_venue FOR UPDATE;
 SELECT * INTO m FROM venue_email_campaigns WHERE venue_id=p_venue AND request_key=p_request;
 IF FOUND THEN IF (m.subject,m.body,m.event_id) IS DISTINCT FROM (trim(p_subject),trim(p_body),p_event) THEN RAISE EXCEPTION 'Request changed. Review the message again.'; END IF; RETURN m.id; END IF;
 SELECT * INTO c FROM venue_email_connections WHERE venue_id=p_venue FOR UPDATE;
 IF c.version IS NULL OR NOT c.enabled OR c.tested_at IS NULL THEN RAISE EXCEPTION 'Connect, test and enable venue email first'; END IF;
 IF coalesce(length(trim(p_subject)),0) NOT BETWEEN 1 AND 120 OR p_subject ~ '[\r\n]' OR coalesce(length(trim(p_body)),0) NOT BETWEEN 1 AND 10000 OR p_request IS NULL THEN RAISE EXCEPTION 'Enter a subject and message'; END IF;
 IF coalesce(length(trim(venue_email_brand(p_venue)->>'address')),0)=0 THEN RAISE EXCEPTION 'Add your venue mailing address in Profile before sending updates'; END IF;
 preview:=venue_email_preview(p_venue,p_event);
 IF preview->>'fingerprint' IS DISTINCT FROM p_fingerprint OR (preview->>'count')::integer NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Preview the current subscribed audience (1–500 players) before sending'; END IF;
 IF (SELECT count(*) FROM venue_email_outbox WHERE venue_id=p_venue AND created_at>now()-interval '24 hours')+(preview->>'count')::integer>1000 THEN RAISE EXCEPTION 'The venue email limit is 1,000 recipients per 24 hours. Try again later.'; END IF;
 SELECT id INTO g FROM groups WHERE venue_id=p_venue ORDER BY id LIMIT 1;
 INSERT INTO venue_email_campaigns(venue_id,actor_id,subject,body,audience,event_id,recipient_count,request_key) VALUES(p_venue,auth.uid(),trim(p_subject),trim(p_body),CASE WHEN p_event IS NULL THEN 'community' ELSE 'event' END,p_event,(preview->>'count')::integer,p_request) RETURNING * INTO m;
 INSERT INTO venue_email_outbox(venue_id,connection_version,campaign_id,user_id,recipient_email,kind,subject,body,brand,footer,venue_url)
 SELECT p_venue,c.version,m.id,r.user_id,r.email,'announcement',m.subject,m.body,venue_email_brand(p_venue),c.footer,'https://pulsepb.com/player/community/group/'||g::text||CASE WHEN p_event IS NULL THEN '' ELSE '?program='||p_event::text END FROM venue_email_recipients(p_venue,p_event) r;
 RETURN m.id;
END $$;
CREATE FUNCTION public.venue_email_test(p_venue uuid,p_actor uuid,p_expected uuid,p_request uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c venue_email_connections;recipient text;job uuid;g uuid;
BEGIN
 IF NOT coalesce(venue_email_actor_access(p_venue,p_actor),false) THEN RAISE EXCEPTION 'Active verified venue management required' USING ERRCODE='42501'; END IF;
 PERFORM id FROM venues WHERE id=p_venue FOR UPDATE;
 SELECT id INTO job FROM venue_email_outbox WHERE id=p_request AND venue_id=p_venue AND user_id=p_actor AND kind='test'; IF FOUND THEN RETURN job; END IF;
 SELECT * INTO c FROM venue_email_connections WHERE venue_id=p_venue FOR UPDATE;
 IF c.version IS NULL OR c.version IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Save the current sender settings before testing'; END IF;
 IF (SELECT count(*) FROM venue_email_outbox WHERE venue_id=p_venue AND kind='test' AND created_at>now()-interval '1 hour')>=5 THEN RAISE EXCEPTION 'Five test emails per hour are available. Please wait before testing again.'; END IF;
 SELECT email INTO recipient FROM auth.users WHERE id=p_actor AND email_confirmed_at IS NOT NULL;
 IF recipient IS NULL THEN RAISE EXCEPTION 'Confirm your PULSE account email before sending a test'; END IF;
 SELECT id INTO g FROM groups WHERE venue_id=p_venue ORDER BY id LIMIT 1;
 INSERT INTO venue_email_outbox(id,venue_id,connection_version,user_id,recipient_email,kind,subject,body,brand,footer,venue_url)
 VALUES(p_request,p_venue,c.version,p_actor,lower(recipient),'test','Your venue email is taking shape','This is a test of your venue’s branding and email connection. Check the sender, logo, colors, and reply address. Once you are happy with this email, return to Integrations and enable venue email.',venue_email_brand(p_venue),c.footer,coalesce('https://pulsepb.com/player/community/group/'||g::text,'https://pulsepb.com/player/community')) RETURNING id INTO job;
 RETURN job;
END $$;
-- A lease is never blindly retried after an uncertain handoff: some providers
-- do not support idempotency. Staff can inspect their provider activity log.
CREATE FUNCTION public.venue_email_claim(p_job uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,vault AS $$
DECLARE j venue_email_outbox;c venue_email_connections;secret text;
BEGIN
 UPDATE venue_email_outbox SET status='unknown',last_error='Delivery was interrupted. Check the provider activity log before sending again.',finished_at=now() WHERE status='sending' AND lease_until<now();
 UPDATE venue_email_outbox o SET status='canceled',finished_at=now() WHERE o.status='queued' AND (o.created_at<now()-interval '24 hours' OR NOT EXISTS(SELECT 1 FROM venue_email_connections conn JOIN venues v ON v.id=conn.venue_id WHERE conn.venue_id=o.venue_id AND conn.version=o.connection_version AND v.is_active AND v.verification_approved_at IS NOT NULL)
 OR NOT venue_email_actor_access(o.venue_id,CASE WHEN o.kind='test' THEN o.user_id ELSE (SELECT actor_id FROM venue_email_campaigns WHERE id=o.campaign_id) END));
 SELECT o.* INTO j FROM venue_email_outbox o JOIN venue_email_connections conn ON conn.venue_id=o.venue_id AND conn.version=o.connection_version
 WHERE o.status='queued' AND o.available_at<=now() AND (p_job IS NULL OR o.id=p_job) AND (o.kind='test' OR (conn.enabled AND conn.tested_at IS NOT NULL))
 AND NOT EXISTS(SELECT 1 FROM venue_email_outbox x WHERE x.venue_id=o.venue_id AND x.status='sending') ORDER BY o.created_at LIMIT 1 FOR UPDATE OF o SKIP LOCKED;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT * INTO c FROM venue_email_connections WHERE venue_id=j.venue_id FOR UPDATE;
 -- Recheck after the lock, in case settings changed while this worker waited.
 IF c.version IS DISTINCT FROM j.connection_version THEN
  UPDATE venue_email_outbox SET status='canceled',finished_at=now() WHERE id=j.id;
  RETURN jsonb_build_object('skipped',true);
 END IF;
 IF j.kind<>'test' AND (NOT c.enabled OR c.tested_at IS NULL) THEN RETURN NULL; END IF;
 IF EXISTS(SELECT 1 FROM suppressed_emails WHERE lower(email)=j.recipient_email) OR (j.kind<>'test' AND NOT EXISTS(SELECT 1 FROM venue_email_recipients(j.venue_id,(SELECT event_id FROM venue_email_campaigns WHERE id=j.campaign_id)) WHERE user_id=j.user_id AND email=j.recipient_email)) THEN
  UPDATE venue_email_outbox SET status='suppressed',finished_at=now() WHERE id=j.id; RETURN jsonb_build_object('skipped',true);
 END IF;
 UPDATE venue_email_outbox SET status='sending',attempts=attempts+1,lease=gen_random_uuid(),lease_until=now()+interval '2 minutes' WHERE id=j.id RETURNING * INTO j;
 IF c.secret_id IS NOT NULL THEN SELECT decrypted_secret INTO secret FROM vault.decrypted_secrets WHERE id=c.secret_id; END IF;
 RETURN jsonb_build_object('job',to_jsonb(j),'connection',to_jsonb(c)-'secret_id','key',secret);
END $$;
CREATE FUNCTION public.venue_email_finish(p_job uuid,p_lease uuid,p_status text,p_provider_id text DEFAULT NULL,p_error text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j venue_email_outbox;next_status text:=p_status;
BEGIN
 SELECT * INTO j FROM venue_email_outbox WHERE id=p_job AND status='sending' AND lease=p_lease FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Delivery lease was replaced'; END IF;
 IF next_status NOT IN ('accepted','failed','unknown','retry') OR next_status IS NULL THEN RAISE EXCEPTION 'Invalid delivery result'; END IF;
 IF next_status='retry' AND j.attempts>=5 THEN next_status:='failed'; END IF;
 UPDATE venue_email_outbox SET status=CASE WHEN next_status='retry' THEN 'queued' ELSE next_status END,available_at=now()+interval '2 minutes',lease=NULL,lease_until=NULL,
 provider_id=left(p_provider_id,200),last_error=left(p_error,300),finished_at=CASE WHEN next_status='retry' THEN NULL ELSE now() END WHERE id=j.id;
 IF next_status='accepted' AND j.kind='test' THEN UPDATE venue_email_connections SET tested_at=now() WHERE venue_id=j.venue_id AND version=j.connection_version; END IF;
END $$;
CREATE FUNCTION public.venue_email_unsubscribe(p_token uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j venue_email_outbox;
BEGIN
 SELECT * INTO j FROM venue_email_outbox WHERE unsubscribe_token=p_token AND kind='announcement';
 IF NOT FOUND THEN RETURN false; END IF;
 INSERT INTO venue_email_preferences(venue_id,user_id,subscribed) VALUES(j.venue_id,j.user_id,false) ON CONFLICT(venue_id,user_id) DO UPDATE SET subscribed=false,updated_at=clock_timestamp();
 UPDATE venue_email_outbox SET status='suppressed',finished_at=now() WHERE venue_id=j.venue_id AND user_id=j.user_id AND kind='announcement' AND status='queued';
 RETURN true;
END $$;
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT oid::regprocedure signature FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname LIKE 'venue_email_%' LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f.signature);
 END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION venue_email_workspace(uuid),venue_email_toggle(uuid,uuid,boolean),venue_email_preference(uuid,boolean),venue_email_preview(uuid,uuid),venue_email_campaign_send(uuid,uuid,text,text,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION venue_email_save(uuid,uuid,uuid,jsonb,text),venue_email_disconnect(uuid,uuid,uuid),venue_email_test(uuid,uuid,uuid,uuid),venue_email_claim(uuid),venue_email_finish(uuid,uuid,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION venue_email_unsubscribe(uuid) TO anon,authenticated,service_role;
COMMIT;
