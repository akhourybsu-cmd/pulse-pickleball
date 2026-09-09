-- Verified free venue communities. Apply this complete file before the web release.
-- Existing facility access is preserved; new venues receive community features only.
-- No prices, subscriptions, charges, or automatic paid grants are created here.
BEGIN;

CREATE TABLE IF NOT EXISTS public.venue_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  venue_id uuid REFERENCES public.venues(id) ON DELETE SET NULL,
  group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  details jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','needs_info','approved','rejected','withdrawn')),
  review_note text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS venue_applications_owner ON public.venue_applications(applicant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS venue_applications_queue ON public.venue_applications(status, created_at);
CREATE TABLE IF NOT EXISTS public.venue_application_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.venue_applications(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  note text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.venue_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_application_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.venue_applications, public.venue_application_history FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.venue_applications, public.venue_application_history TO authenticated;
GRANT ALL ON public.venue_applications, public.venue_application_history TO service_role;
DROP POLICY IF EXISTS venue_applications_read ON public.venue_applications;
CREATE POLICY venue_applications_read ON public.venue_applications FOR SELECT TO authenticated
  USING (applicant_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS venue_application_history_read ON public.venue_application_history;
CREATE POLICY venue_application_history_read ON public.venue_application_history FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.venue_applications a WHERE a.id = application_id));

CREATE TABLE IF NOT EXISTS public.venue_module_access (
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  module_key text NOT NULL CHECK (module_key IN ('court_booking','facility_tools')),
  source text NOT NULL CHECK (source IN ('existing_venue','staff_grant','subscription')),
  enabled boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (venue_id, module_key)
);
-- This marker makes rerunning the migration safe: venues created AFTER its
-- first application must never accidentally receive the legacy grants.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.venues'::regclass AND attname = 'community_model' AND NOT attisdropped) THEN
    ALTER TABLE public.venues ADD COLUMN community_model text NOT NULL DEFAULT 'free_verified';
    UPDATE public.venues SET community_model = 'existing';
    INSERT INTO public.venue_module_access(venue_id,module_key,source)
      SELECT v.id, m.key, 'existing_venue' FROM public.venues v
      CROSS JOIN (VALUES ('court_booking'),('facility_tools')) m(key)
      ON CONFLICT DO NOTHING;
  END IF;
END $$;
ALTER TABLE public.venue_module_access ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.venue_module_access FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.venue_module_access TO authenticated;
GRANT ALL ON public.venue_module_access TO service_role;
DROP POLICY IF EXISTS venue_module_access_read ON public.venue_module_access;
CREATE POLICY venue_module_access_read ON public.venue_module_access FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.venues v WHERE v.id = venue_id));

CREATE OR REPLACE FUNCTION public.venue_has_module(p_venue_id uuid, p_module text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.venue_module_access
    WHERE venue_id = p_venue_id AND module_key = p_module AND enabled
    AND (expires_at IS NULL OR expires_at > now()))
$$;
REVOKE ALL ON FUNCTION public.venue_has_module(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.venue_has_module(uuid,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.submit_venue_application(p_details jsonb, p_application_id uuid DEFAULT NULL, p_venue_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_id uuid; v_old public.venue_applications; v_key text; v_value text; v_admin uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in to request a venue'; END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_uid AND email_confirmed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Confirm your PULSE account email before requesting a venue';
  END IF;
  IF p_details IS NULL OR jsonb_typeof(p_details) <> 'object' OR octet_length(p_details::text) > 12000 THEN
    RAISE EXCEPTION 'Provide valid venue details';
  END IF;
  FOREACH v_key IN ARRAY ARRAY['name','address','city','state','contact_name','contact_email','contact_phone','evidence'] LOOP
    v_value := nullif(btrim(p_details->>v_key),'');
    IF v_value IS NULL OR length(v_value) > (CASE WHEN v_key = 'evidence' THEN 3000 ELSE 250 END) THEN
      RAISE EXCEPTION 'Provide a valid %', replace(v_key,'_',' ');
    END IF;
  END LOOP;
  IF length(btrim(p_details->>'name')) > 50 OR length(btrim(p_details->>'evidence')) < 30
    OR length(coalesce(p_details->>'description','')) > 500
    OR coalesce(p_details->>'contact_email','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    OR coalesce(p_details->>'authorized','') <> 'true'
    OR coalesce(p_details->>'website','') !~ '^https://[^/[:space:]]+\.[^/[:space:]]+'
    OR coalesce(p_details->>'visibility','') NOT IN ('public','unlisted','private')
    OR coalesce(p_details->>'join_method','') NOT IN ('open','request_to_join','invite_only')
  THEN RAISE EXCEPTION 'Check the ownership evidence, website, contact details, and authority confirmation'; END IF;
  IF p_venue_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.venues WHERE id = p_venue_id AND owner_id = v_uid) THEN
    RAISE EXCEPTION 'Only the current venue owner can request re-verification';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('venue-application:' || v_uid::text,0));
  IF (SELECT count(*) FROM public.venue_application_history WHERE actor_id=v_uid AND action IN ('submitted','resubmitted') AND created_at > now()-interval '1 day') >= 5 THEN
    RAISE EXCEPTION 'You have reached the daily venue request limit. Please try again tomorrow.';
  END IF;
  IF p_application_id IS NOT NULL THEN
    SELECT * INTO v_old FROM public.venue_applications WHERE id = p_application_id FOR UPDATE;
    IF NOT FOUND OR v_old.applicant_id <> v_uid THEN RAISE EXCEPTION 'Application not found'; END IF;
    IF v_old.status NOT IN ('needs_info','rejected') THEN RAISE EXCEPTION 'Only a returned application can be resubmitted'; END IF;
    IF v_old.venue_id IS DISTINCT FROM p_venue_id THEN RAISE EXCEPTION 'The requested venue cannot be changed'; END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM public.venue_applications WHERE applicant_id = v_uid
    AND status IN ('pending','needs_info') AND id IS DISTINCT FROM p_application_id
    AND ((p_venue_id IS NOT NULL AND venue_id = p_venue_id) OR
      (lower(btrim(details->>'name')) = lower(btrim(p_details->>'name')) AND lower(btrim(details->>'address')) = lower(btrim(p_details->>'address'))))) THEN
    RAISE EXCEPTION 'You already have an open request for this venue';
  END IF;
  IF p_application_id IS NULL THEN
    INSERT INTO public.venue_applications(applicant_id,venue_id,details) VALUES(v_uid,p_venue_id,p_details) RETURNING id INTO v_id;
  ELSE
    UPDATE public.venue_applications SET details=p_details,status='pending',review_note=NULL,reviewed_by=NULL,reviewed_at=NULL,updated_at=now()
      WHERE id=p_application_id RETURNING id INTO v_id;
  END IF;
  INSERT INTO public.venue_application_history(application_id,actor_id,action,details)
    VALUES(v_id,v_uid,CASE WHEN p_application_id IS NULL THEN 'submitted' ELSE 'resubmitted' END,p_details);
  FOR v_admin IN SELECT DISTINCT user_id FROM public.user_roles WHERE role='admin'::public.app_role AND user_id<>v_uid LOOP
    PERFORM public.create_notification(v_admin,'venue_ownership_request','community','Venue ownership review needed',
      'A venue request is ready for private review.','/admin/venue-requests','normal',jsonb_build_object('application_id',v_id),v_uid);
  END LOOP;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.withdraw_venue_application(p_application_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_app public.venue_applications;
BEGIN
  SELECT * INTO v_app FROM public.venue_applications WHERE id=p_application_id FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS DISTINCT FROM v_app.applicant_id THEN RAISE EXCEPTION 'Application not found'; END IF;
  IF v_app.status NOT IN ('pending','needs_info') THEN RAISE EXCEPTION 'This application is already resolved'; END IF;
  UPDATE public.venue_applications SET status='withdrawn',updated_at=now() WHERE id=p_application_id;
  INSERT INTO public.venue_application_history(application_id,actor_id,action) VALUES(p_application_id,auth.uid(),'withdrawn');
END $$;

CREATE OR REPLACE FUNCTION public.review_venue_application(p_application_id uuid, p_decision text, p_note text, p_ownership_checked boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_app public.venue_applications; v_venue uuid; v_group uuid; v_slug text; v_details jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN RAISE EXCEPTION 'PULSE admin access required'; END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('approved','needs_info','rejected') OR length(btrim(coalesce(p_note,''))) NOT BETWEEN 20 AND 2000 THEN
    RAISE EXCEPTION 'Choose a decision and provide a review note (20–2000 characters)';
  END IF;
  SELECT * INTO v_app FROM public.venue_applications WHERE id=p_application_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Application not found'; END IF;
  IF v_app.applicant_id = auth.uid() THEN RAISE EXCEPTION 'Another PULSE admin must review your own application'; END IF;
  IF v_app.status <> 'pending' THEN RAISE EXCEPTION 'This application is no longer awaiting review'; END IF;
  v_venue := v_app.venue_id; v_details := v_app.details;
  IF p_decision = 'approved' THEN
    IF p_ownership_checked IS DISTINCT FROM true THEN RAISE EXCEPTION 'Independently verify ownership before approving'; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('venue-address:' || lower(btrim(v_details->>'address')) || lower(btrim(v_details->>'city')),0));
    IF v_venue IS NULL THEN
      IF EXISTS (SELECT 1 FROM public.venues WHERE lower(btrim(address)) = lower(btrim(v_details->>'address'))
        AND lower(btrim(city)) = lower(btrim(v_details->>'city')) AND lower(btrim(name)) = lower(btrim(v_details->>'name'))) THEN
        RAISE EXCEPTION 'This venue already exists; resolve the existing ownership claim instead of creating a duplicate';
      END IF;
      v_venue := gen_random_uuid();
      v_slug := coalesce(nullif(btrim(regexp_replace(lower(v_details->>'name'),'[^a-z0-9]+','-','g'),'-'),''),'venue') || '-' || left(v_venue::text,8);
      INSERT INTO public.venues(id,name,slug,address,city,state,description,owner_id,venue_type,activation_state,is_active,is_published,
        verification_requested_at,verification_approved_at,verification_approved_by)
      VALUES(v_venue,btrim(v_details->>'name'),v_slug,btrim(v_details->>'address'),btrim(v_details->>'city'),btrim(v_details->>'state'),
        nullif(btrim(v_details->>'description'),''),v_app.applicant_id,'other','active',true,true,v_app.created_at,now(),auth.uid());
      -- Private applicant contact/evidence is intentionally NOT copied into the public venue profile.
      INSERT INTO public.venue_staff(venue_id,user_id,role,accepted_at,is_active,status)
        VALUES(v_venue,v_app.applicant_id,'owner',now(),true,'active');
      INSERT INTO public.groups(name,description,type,visibility,join_method,venue_id,is_venue_verified,created_by)
        VALUES(btrim(v_details->>'name'),nullif(btrim(v_details->>'description'),''),'venue_official',
          (v_details->>'visibility')::public.group_visibility,(v_details->>'join_method')::public.group_join_method,v_venue,true,v_app.applicant_id)
        RETURNING id INTO v_group;
    ELSE
      PERFORM 1 FROM public.venues WHERE id=v_venue AND owner_id=v_app.applicant_id FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Venue ownership changed; the current owner must submit a new request'; END IF;
      UPDATE public.venues SET verification_requested_at=v_app.created_at,verification_approved_at=now(),verification_approved_by=auth.uid() WHERE id=v_venue;
      SELECT id INTO v_group FROM public.groups WHERE venue_id=v_venue AND type='venue_official';
      UPDATE public.groups SET is_venue_verified=true WHERE id=v_group;
    END IF;
  END IF;
  UPDATE public.venue_applications SET status=p_decision,review_note=btrim(p_note),reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now(),
    venue_id=v_venue,group_id=v_group WHERE id=p_application_id;
  INSERT INTO public.venue_application_history(application_id,actor_id,action,note,details)
    VALUES(p_application_id,auth.uid(),p_decision,btrim(p_note),jsonb_build_object('ownership_checked',p_ownership_checked));
  PERFORM public.create_notification(v_app.applicant_id,'venue_ownership_review','community',
    CASE p_decision WHEN 'approved' THEN 'Your venue is approved' WHEN 'needs_info' THEN 'Your venue request needs information' ELSE 'Your venue review is ready' END,
    'Open your venue requests to see the decision and next steps.','/player/venue-requests','normal',jsonb_build_object('application_id',p_application_id),auth.uid());
  RETURN jsonb_build_object('venue_id',v_venue,'group_id',v_group);
END $$;

REVOKE ALL ON FUNCTION public.submit_venue_application(jsonb,uuid,uuid), public.withdraw_venue_application(uuid), public.review_venue_application(uuid,text,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_venue_application(jsonb,uuid,uuid), public.withdraw_venue_application(uuid), public.review_venue_application(uuid,text,text,boolean) TO authenticated;

-- Retire direct creation, including the old authenticated RPC. Keep its signature
-- so a stale client receives a useful error rather than silently bypassing review.
REVOKE INSERT ON public.venues FROM authenticated, anon;
CREATE OR REPLACE FUNCTION public.create_venue_community(
  p_name text, p_description text DEFAULT NULL, p_visibility public.group_visibility DEFAULT 'public',
  p_join_method public.group_join_method DEFAULT 'open', p_venue_type public.venue_type DEFAULT 'other', p_city text DEFAULT NULL, p_state text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN RAISE EXCEPTION 'Request a free venue from Community. Ownership approval is required before creation.'; END $$;

CREATE OR REPLACE FUNCTION public.validate_venue_group()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_verified boolean;
BEGIN
  IF TG_OP='UPDATE' AND (OLD.venue_id IS NOT NULL OR NEW.venue_id IS NOT NULL OR NEW.type='venue_official')
    AND (NEW.venue_id IS DISTINCT FROM OLD.venue_id OR NEW.type IS DISTINCT FROM OLD.type) THEN
    RAISE EXCEPTION 'Venue identity cannot be changed through community settings';
  END IF;
  IF NEW.venue_id IS NOT NULL OR NEW.type='venue_official' THEN
    IF NEW.venue_id IS NULL THEN RAISE EXCEPTION 'An approved venue is required'; END IF;
    SELECT verification_approved_at IS NOT NULL AND verification_approved_by IS NOT NULL INTO v_verified FROM public.venues WHERE id=NEW.venue_id;
    IF TG_OP='INSERT' AND (NOT coalesce(v_verified,false) OR NOT EXISTS (SELECT 1 FROM public.venues WHERE id=NEW.venue_id AND owner_id=NEW.created_by)
      OR (auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM NEW.created_by AND NOT public.has_role(auth.uid(),'admin'::public.app_role))) THEN
      RAISE EXCEPTION 'Venue ownership must be approved before community creation';
    END IF;
    NEW.is_venue_verified := coalesce(v_verified,false);
  ELSE NEW.is_venue_verified := false;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS check_venue_group_permission ON public.groups;
CREATE TRIGGER check_venue_group_permission BEFORE INSERT OR UPDATE ON public.groups FOR EACH ROW EXECUTE FUNCTION public.validate_venue_group();

CREATE OR REPLACE FUNCTION public.protect_venue_verification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_OP='UPDATE' THEN
    IF (NEW.verification_approved_at IS DISTINCT FROM OLD.verification_approved_at OR NEW.verification_approved_by IS DISTINCT FROM OLD.verification_approved_by
      OR NEW.community_model IS DISTINCT FROM OLD.community_model) AND auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN
      RAISE EXCEPTION 'Only PULSE can change venue verification or access classification';
    END IF;
    IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
      NEW.verification_approved_at := NULL; NEW.verification_approved_by := NULL;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS protect_venue_verification ON public.venues;
CREATE TRIGGER protect_venue_verification BEFORE UPDATE ON public.venues FOR EACH ROW EXECUTE FUNCTION public.protect_venue_verification();
CREATE OR REPLACE FUNCTION public.sync_venue_verification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE public.groups SET is_venue_verified=(NEW.verification_approved_at IS NOT NULL AND NEW.verification_approved_by IS NOT NULL)
    WHERE venue_id=NEW.id AND is_venue_verified IS DISTINCT FROM (NEW.verification_approved_at IS NOT NULL AND NEW.verification_approved_by IS NOT NULL);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS sync_venue_verification ON public.venues;
CREATE TRIGGER sync_venue_verification AFTER UPDATE OF owner_id,verification_approved_at,verification_approved_by ON public.venues FOR EACH ROW EXECUTE FUNCTION public.sync_venue_verification();
-- Correct old automatically-issued badges, without removing venues, members or tools.
UPDATE public.groups g SET is_venue_verified=(v.verification_approved_at IS NOT NULL AND v.verification_approved_by IS NOT NULL)
  FROM public.venues v WHERE v.id=g.venue_id;

-- Enforce optional facility capabilities at the write boundary, not just tabs.
-- Existing reservations can still be canceled/deleted after an entitlement ends.
CREATE OR REPLACE FUNCTION public.guard_venue_module_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_venue uuid; v_module text; v_court_venue uuid;
BEGIN
  IF TG_TABLE_NAME='venue_courts' THEN
    v_venue := NEW.venue_id;
    IF NOT public.venue_has_module(v_venue,'court_booking') AND NOT public.venue_has_module(v_venue,'facility_tools') THEN
      RAISE EXCEPTION 'Court inventory requires an active venue add-on';
    END IF;
  ELSE
    IF TG_OP='UPDATE' AND NEW.venue_court_id IS NOT DISTINCT FROM OLD.venue_court_id
      AND NEW.venue_id IS NOT DISTINCT FROM OLD.venue_id AND NEW.group_id IS NOT DISTINCT FROM OLD.group_id
      AND NEW.event_format IS NOT DISTINCT FROM OLD.event_format AND NEW.start_time IS NOT DISTINCT FROM OLD.start_time
      AND NEW.end_time IS NOT DISTINCT FROM OLD.end_time THEN RETURN NEW; END IF;
    SELECT venue_id INTO v_venue FROM public.groups WHERE id=NEW.group_id;
    IF NEW.venue_court_id IS NOT NULL THEN
      SELECT venue_id INTO v_court_venue FROM public.venue_courts WHERE id=NEW.venue_court_id;
      IF v_court_venue IS DISTINCT FROM v_venue THEN RAISE EXCEPTION 'Court and community must belong to the same venue'; END IF;
    END IF;
    IF NEW.event_format='reservation' THEN v_module:='court_booking';
    ELSIF NEW.venue_court_id IS NOT NULL OR NEW.event_format IN ('program_hold','maintenance') THEN v_module:='facility_tools';
    END IF;
    IF v_module IS NOT NULL AND NEW.venue_id IS NOT NULL AND NEW.venue_id IS DISTINCT FROM v_venue THEN
      RAISE EXCEPTION 'A facility booking must belong to the venue community';
    END IF;
    IF v_module IS NOT NULL AND NOT public.venue_has_module(v_venue,v_module) THEN
      RAISE EXCEPTION 'This facility action requires the % add-on. Community events remain free.',v_module;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_venue_court_module ON public.venue_courts;
CREATE TRIGGER guard_venue_court_module BEFORE INSERT OR UPDATE ON public.venue_courts FOR EACH ROW EXECUTE FUNCTION public.guard_venue_module_write();
DROP TRIGGER IF EXISTS guard_venue_event_module ON public.group_events;
CREATE TRIGGER guard_venue_event_module BEFORE INSERT OR UPDATE ON public.group_events FOR EACH ROW EXECUTE FUNCTION public.guard_venue_module_write();

COMMIT;
