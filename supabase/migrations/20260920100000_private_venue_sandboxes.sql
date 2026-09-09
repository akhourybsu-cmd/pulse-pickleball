-- Owner-only, non-billing sample venues. No production data is seeded here.
BEGIN;

CREATE TABLE public.private_venue_sandboxes (
  venue_id uuid PRIMARY KEY REFERENCES public.venues(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  group_id uuid NOT NULL UNIQUE REFERENCES public.groups(id) DEFERRABLE INITIALLY DEFERRED,
  owner_id uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id)
);
ALTER TABLE public.private_venue_sandboxes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.private_venue_sandboxes FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.private_venue_sandboxes TO authenticated;
GRANT ALL ON public.private_venue_sandboxes TO service_role;
CREATE POLICY private_sandbox_owner ON public.private_venue_sandboxes FOR SELECT TO authenticated USING(owner_id=auth.uid());

CREATE FUNCTION public.can_access_private_venue(p_venue uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT NOT EXISTS(SELECT 1 FROM private_venue_sandboxes WHERE venue_id=p_venue AND owner_id IS DISTINCT FROM auth.uid())
$$;
CREATE FUNCTION public.can_access_private_group(p_group uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT NOT EXISTS(SELECT 1 FROM private_venue_sandboxes WHERE group_id=p_group AND owner_id IS DISTINCT FROM auth.uid())
$$;
REVOKE ALL ON FUNCTION public.can_access_private_venue(uuid),public.can_access_private_group(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_private_venue(uuid),public.can_access_private_group(uuid) TO anon,authenticated,service_role;

-- Restrictive gates intersect ALL existing permissive policies, including old
-- public-discovery and administrator rules. The registry avoids RLS recursion.
CREATE POLICY private_venue_owner_only ON public.venues AS RESTRICTIVE FOR ALL TO anon,authenticated
 USING(public.can_access_private_venue(id)) WITH CHECK(public.can_access_private_venue(id));
CREATE POLICY private_group_owner_only ON public.groups AS RESTRICTIVE FOR ALL TO anon,authenticated
 USING(public.can_access_private_group(id)) WITH CHECK(public.can_access_private_group(id));
DO $$ DECLARE r record; helper text; policy_name text;
BEGIN
 FOR r IN SELECT c.relname,a.attname,c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   JOIN pg_attribute a ON a.attrelid=c.oid
   WHERE n.nspname='public' AND c.relkind='r' AND NOT a.attisdropped AND a.atttypid='uuid'::regtype
   AND a.attname IN ('venue_id','group_id','host_venue_id','host_group_id') AND c.relname<>'private_venue_sandboxes'
 LOOP
   IF NOT r.relrowsecurity THEN RAISE EXCEPTION 'Privacy gate requires RLS on %',r.relname; END IF;
   helper := CASE WHEN r.attname LIKE '%venue_id' THEN 'can_access_private_venue' ELSE 'can_access_private_group' END;
   policy_name := 'private_sandbox_'||r.attname;
   EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO anon,authenticated USING(public.%I(%I)) WITH CHECK(public.%I(%I))',
     policy_name,r.relname,helper,r.attname,helper,r.attname);
 END LOOP;
END $$;

-- This legacy RPC bypasses table RLS; filter its result explicitly.
CREATE OR REPLACE FUNCTION public.get_user_venues(_user_id uuid)
RETURNS TABLE(venue_id uuid,venue_name text,role public.venue_role)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT v.id,v.name,coalesce(vs.role,'owner'::venue_role) FROM venues v
 LEFT JOIN venue_staff vs ON vs.venue_id=v.id AND vs.user_id=_user_id AND vs.is_active=true
 WHERE (v.owner_id=_user_id OR vs.user_id IS NOT NULL) AND public.can_access_private_venue(v.id)
$$;

-- Wrap the existing verification trigger with a narrowly scoped sample branch.
-- Samples NEVER receive a real-business verification badge.
ALTER FUNCTION public.validate_venue_group() RENAME TO validate_venue_group_before_sandboxes;
-- Trigger functions cannot be called normally; preserve its original body and
-- add the sample branch using pg_get_functiondef, retaining ordinary behavior.
DO $$ DECLARE body text;
BEGIN
 SELECT prosrc INTO body FROM pg_proc WHERE oid='public.validate_venue_group_before_sandboxes()'::regprocedure;
 body := replace(body,'BEGIN', $branch$BEGIN
  IF EXISTS(SELECT 1 FROM private_venue_sandboxes s WHERE s.group_id=NEW.id OR s.venue_id=NEW.venue_id) THEN
    IF NOT EXISTS(SELECT 1 FROM private_venue_sandboxes s WHERE s.group_id=NEW.id AND s.venue_id=NEW.venue_id AND s.owner_id=NEW.created_by)
      OR NEW.type<>'venue_official' OR NEW.visibility<>'private' OR NEW.join_method<>'invite_only' THEN
      RAISE EXCEPTION 'Private sample venues must remain owner-only';
    END IF;
    IF TG_OP='UPDATE' AND NEW.invite_code IS DISTINCT FROM OLD.invite_code THEN RAISE EXCEPTION 'Invitations are disabled for private sample venues'; END IF;
    NEW.invite_code:=NULL; NEW.invite_code_expires_at:=NULL; NEW.is_venue_verified:=false;
    NEW.settings:=coalesce(NEW.settings,'{}'::jsonb)||jsonb_build_object('private_sample',true);
    RETURN NEW;
  END IF;
 $branch$);
 EXECUTE format('CREATE FUNCTION public.validate_venue_group() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS %L',body);
END $$;
DROP TRIGGER check_venue_group_permission ON public.groups;
CREATE TRIGGER check_venue_group_permission BEFORE INSERT OR UPDATE ON public.groups FOR EACH ROW EXECUTE FUNCTION public.validate_venue_group();
DROP FUNCTION public.validate_venue_group_before_sandboxes();

CREATE FUNCTION public.guard_private_venue_sandbox() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s private_venue_sandboxes; v_venue uuid; v_group uuid;
BEGIN
 IF TG_TABLE_NAME='venues' THEN v_venue:=NEW.id;
 ELSE v_venue:=nullif(to_jsonb(NEW)->>'venue_id','')::uuid; v_group:=nullif(to_jsonb(NEW)->>'group_id','')::uuid; END IF;
 SELECT * INTO s FROM private_venue_sandboxes WHERE venue_id=v_venue OR group_id=v_group LIMIT 1;
 IF NOT FOUND THEN RETURN NEW; END IF;
 IF auth.uid() IS NOT NULL AND auth.uid()<>s.owner_id THEN RAISE EXCEPTION 'Private sample venue access denied'; END IF;
 IF TG_TABLE_NAME='venues' THEN
   IF NEW.owner_id IS DISTINCT FROM s.owner_id OR NEW.is_published IS TRUE OR NEW.is_searchable IS TRUE
     OR NEW.verification_approved_at IS NOT NULL OR NEW.verification_approved_by IS NOT NULL THEN
     RAISE EXCEPTION 'Private sample venues cannot be published, transferred or verified as real businesses';
   END IF;
   NEW.allow_follow:=false;
 ELSIF TG_TABLE_NAME IN ('group_members','venue_staff') THEN
   IF NEW.user_id<>s.owner_id OR NEW.role::text<>'owner' THEN RAISE EXCEPTION 'Only the owner can belong to this private sample venue'; END IF;
 ELSIF TG_TABLE_NAME='group_invites' THEN
   RAISE EXCEPTION 'Invitations are disabled for private sample venues';
 ELSIF TG_TABLE_NAME IN ('venue_payment_accounts','payment_orders','payment_subscriptions','venue_subscriptions') THEN
   RAISE EXCEPTION 'Billing is disabled for private sample venues';
 ELSIF TG_TABLE_NAME='venue_payment_settings' AND NEW.accepting_payments THEN
   RAISE EXCEPTION 'Billing is disabled for private sample venues';
 END IF;
 RETURN NEW;
END $$;
DO $$ DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['venues','group_members','venue_staff','group_invites','venue_payment_accounts','venue_payment_settings','payment_orders','payment_subscriptions','venue_subscriptions'] LOOP
   EXECUTE format('CREATE TRIGGER guard_private_sandbox BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.guard_private_venue_sandbox()',t);
 END LOOP;
END $$;

-- Service-only provisioning. One sample per owner; retries return the existing
-- venue rather than overwriting edits. No real accounts/contacts are in source.
CREATE FUNCTION public.provision_private_venue_sandbox(p_owner uuid,p_name text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v uuid:=gen_random_uuid(); g uuid:=gen_random_uuid(); existing private_venue_sandboxes;
 c uuid[]:=ARRAY[]::uuid[]; court uuid; event uuid; day date; start_at timestamptz; n integer; i integer;
BEGIN
 IF length(btrim(coalesce(p_name,''))) NOT BETWEEN 3 AND 50 THEN RAISE EXCEPTION 'Provide a venue name (3–50 characters)'; END IF;
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_owner AND email_confirmed_at IS NOT NULL) THEN RAISE EXCEPTION 'Confirmed owner account required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('private-venue:'||p_owner::text,0));
 SELECT * INTO existing FROM private_venue_sandboxes WHERE owner_id=p_owner;
 IF FOUND THEN RETURN jsonb_build_object('venue_id',existing.venue_id,'group_id',existing.group_id,'already_exists',true); END IF;
 INSERT INTO private_venue_sandboxes(venue_id,group_id,owner_id) VALUES(v,g,p_owner);
 INSERT INTO venues(id,name,slug,owner_id,venue_type,activation_state,is_active,is_published,is_searchable,allow_follow,
   description,tagline,welcome_headline,welcome_message,primary_color,secondary_color,timezone,hours_of_operation,amenities)
 VALUES(v,btrim(p_name),'private-sample-'||v::text,p_owner,'other','active',true,false,false,false,
   'Your owner-only sample venue. Explore booking, programs, the facility calendar, posts and chat. All sample tools are included; no live payments or outside members.',
   'Your private pickleball playground','Welcome to your palace',
   'A private space to explore every venue tool. Sample programs are editable and new reservations stay inside this venue. Only your account has access.',
   '#C9A35B','#19352F','America/New_York',
   '{"slotMinutes":60,"days":{"0":{"open":"07:00","close":"22:00"},"1":{"open":"07:00","close":"22:00"},"2":{"open":"07:00","close":"22:00"},"3":{"open":"07:00","close":"22:00"},"4":{"open":"07:00","close":"22:00"},"5":{"open":"07:00","close":"22:00"},"6":{"open":"07:00","close":"22:00"}}}',
   ARRAY['Indoor courts','Outdoor courts','Practice area','Player lounge','Water refill station']);
 INSERT INTO venue_module_access(venue_id,module_key,source,enabled) VALUES(v,'court_booking','staff_grant',true),(v,'facility_tools','staff_grant',true);
 INSERT INTO venue_staff(venue_id,user_id,role,accepted_at,is_active,status) VALUES(v,p_owner,'owner',now(),true,'active');
 INSERT INTO groups(id,name,description,type,visibility,join_method,venue_id,created_by,settings,invite_code)
 VALUES(g,btrim(p_name),'Private sample venue. All tools included, no subscriptions or real charges. Only you can enter.','venue_official','private','invite_only',v,p_owner,
   '{"private_sample":true,"allow_member_posts":true,"allow_member_events":true}',NULL);
 FOR n IN 1..6 LOOP
   INSERT INTO venue_courts(venue_id,court_number,name,is_active,is_premium,court_type,surface_type,hourly_rate,notes)
   VALUES(v,n,'Court '||n,true,n=1,CASE WHEN n<=4 THEN 'indoor' ELSE 'outdoor' END,'acrylic',0,
     'Private sample court. Reservations are free and visible only to the owner.') RETURNING id INTO court;
   c:=array_append(c,court);
 END LOOP;
 -- Relative dates keep the initial sample useful on whichever day it is created.
 day:=(now() AT TIME ZONE 'America/New_York')::date;
 FOR i IN 0..6 LOOP
   start_at:=((day+i)+time '18:00') AT TIME ZONE 'America/New_York';
   INSERT INTO group_events(group_id,venue_id,created_by,title,description,event_format,location_type,start_time,end_time,capacity,waitlist_enabled,rotation_style)
   VALUES(g,v,p_owner,CASE WHEN i%2=0 THEN 'Sample · Palace open play' ELSE 'Sample · Skills & drills' END,
     'Owner-only sample program. Edit the time, capacity and assigned courts to explore venue operations. No other players have been invited.',
     CASE WHEN i%2=0 THEN 'open_play' ELSE 'clinic' END,'venue',start_at,start_at+interval '2 hours',16,true,
     CASE WHEN i%2=0 THEN 'paddle_stack' ELSE 'coach_led' END) RETURNING id INTO event;
   FOR n IN 1..2 LOOP
     INSERT INTO group_events(group_id,venue_id,venue_court_id,parent_event_id,created_by,title,event_format,location_type,start_time,end_time)
     VALUES(g,v,c[n],event,p_owner,'Sample program court allocation','program_hold','venue',start_at,start_at+interval '2 hours');
   END LOOP;
   INSERT INTO group_events(group_id,venue_id,venue_court_id,created_by,title,description,event_format,location_type,start_time,end_time)
   VALUES(g,v,c[3],p_owner,'Sample · Private practice','Example reservation. No card was charged.','reservation','venue',start_at-interval '1 hour',start_at);
 END LOOP;
 start_at:=((day+1)+time '12:00') AT TIME ZONE 'America/New_York';
 INSERT INTO group_events(group_id,venue_id,venue_court_id,created_by,title,description,event_format,location_type,start_time,end_time)
 VALUES(g,v,c[6],p_owner,'Sample · Court care','Example maintenance closure. Edit or remove it in Operations.','maintenance','venue',start_at,start_at+interval '1 hour');
 INSERT INTO group_posts(group_id,user_id,type,title,content,pinned) VALUES
 (g,p_owner,'announcement','Welcome to your private sample venue','This is your own venue playground. You are its only owner, staff member and community member. Booking and facility operations are included at no cost. Invitations and live billing are disabled to keep this space private.',true),
 (g,p_owner,'feed','Your first venue walkthrough','Try these: reserve a free court, edit a sample program, block a court for maintenance, publish a post, and send yourself a chat message. These edits persist in your private venue; they do not affect ELEVENO.',false),
 (g,p_owner,'announcement','Sample house rules','Arrive ten minutes before play. Wear court shoes, bring water, and respect scheduled closures. These are fictional example rules that you can replace with your own.',false);
 INSERT INTO group_messages(group_id,user_id,content,is_pinned,pinned_at,pinned_by)
 VALUES(g,p_owner,'Sample welcome: this is your private venue chat. There are no other members. Send a message, try reactions, and explore chat settings.',true,now(),p_owner);
 INSERT INTO group_messages(group_id,user_id,content) VALUES(g,p_owner,'Sample operations note: six courts are ready. The calendar contains one week of sample play, clinics and private practice, plus a maintenance block tomorrow.');
 RETURN jsonb_build_object('venue_id',v,'group_id',g,'already_exists',false);
END $$;
REVOKE ALL ON FUNCTION public.provision_private_venue_sandbox(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.provision_private_venue_sandbox(uuid,text) TO service_role;

COMMIT;
