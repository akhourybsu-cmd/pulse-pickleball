-- PULSE platform control plane. No venue operations, charges or subscriptions are changed.
-- Full copy/paste migration: run the entire transaction before releasing the new portal.
BEGIN;

-- Release verification stays inside this transaction. Store fingerprints only;
-- no contacts, account credentials or financial records are exported to logs.
CREATE TEMP TABLE platform_admin_release_baseline (resource text PRIMARY KEY, fingerprint text) ON COMMIT DROP;
DO $$ DECLARE resource text; fingerprint text;
BEGIN
  FOREACH resource IN ARRAY ARRAY['venues','venue_module_access','venue_staff','group_members','private_venue_sandboxes',
    'venue_payment_settings','venue_payment_accounts','payment_orders','payment_subscriptions'] LOOP
    EXECUTE format('SELECT md5(coalesce(string_agg(to_jsonb(t)::text,chr(10) ORDER BY to_jsonb(t)::text),'''')) FROM public.%I t',resource) INTO fingerprint;
    INSERT INTO platform_admin_release_baseline VALUES(resource,fingerprint);
  END LOOP;
END $$;

CREATE TABLE public.platform_admin_identity (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE RESTRICT
);
ALTER TABLE public.platform_admin_identity ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_admin_identity FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.platform_admin_identity TO authenticated;
GRANT SELECT ON public.platform_admin_identity TO service_role;
CREATE POLICY platform_identity_self ON public.platform_admin_identity FOR SELECT TO authenticated USING(user_id=auth.uid());

-- Resolve the confirmed account once; future access is bound to its UUID, not an editable profile email.
DO $$ DECLARE target uuid; matches integer;
BEGIN
  SELECT count(*), (array_agg(id))[1] INTO matches,target FROM auth.users
    WHERE lower(email)='akhourybsu@gmail.com' AND email_confirmed_at IS NOT NULL;
  IF matches<>1 THEN RAISE EXCEPTION 'Expected exactly one confirmed akhourybsu@gmail.com account; no changes applied'; END IF;
  INSERT INTO public.platform_admin_identity(singleton,user_id) VALUES(true,target);
  INSERT INTO public.user_roles(user_id,role) VALUES(target,'admin') ON CONFLICT(user_id,role) DO NOTHING;
END $$;

CREATE FUNCTION public.is_platform_superadmin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM platform_admin_identity WHERE user_id=auth.uid())
    AND public.has_role(auth.uid(),'admin'::public.app_role)
$$;
REVOKE ALL ON FUNCTION public.is_platform_superadmin() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.is_platform_superadmin() TO authenticated,service_role;

CREATE TABLE public.platform_admin_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  venue_id uuid REFERENCES public.venues(id) ON DELETE SET NULL,
  action text NOT NULL,
  note text NOT NULL,
  before_state jsonb NOT NULL DEFAULT '[]',
  after_state jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX platform_admin_audit_recent ON public.platform_admin_audit(created_at DESC,id DESC);
CREATE INDEX platform_admin_audit_venue ON public.platform_admin_audit(venue_id,created_at DESC);
ALTER TABLE public.platform_admin_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_admin_audit FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.platform_admin_audit TO authenticated;
GRANT SELECT,INSERT ON public.platform_admin_audit TO service_role;
CREATE POLICY platform_audit_read ON public.platform_admin_audit FOR SELECT TO authenticated USING(public.is_platform_superadmin());

INSERT INTO public.platform_admin_audit(actor_id,action,note,before_state,after_state)
SELECT i.user_id,'superadmin_configured','Sole platform administrator configured by the owner-approved migration.',
  coalesce((SELECT jsonb_agg(user_id ORDER BY user_id) FROM public.user_roles WHERE role='admin'),'[]'),jsonb_build_array(i.user_id)
FROM public.platform_admin_identity i;
-- Remove only other PLATFORM admin assignments, never users, venue staff or league roles.
DELETE FROM public.user_roles WHERE role='admin' AND user_id<>(SELECT user_id FROM public.platform_admin_identity);

CREATE FUNCTION public.protect_platform_admin_identity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE target uuid;
BEGIN
  SELECT user_id INTO target FROM platform_admin_identity;
  IF TG_OP<>'DELETE' AND NEW.role='admin' AND NEW.user_id IS DISTINCT FROM target THEN
    RAISE EXCEPTION 'Only the designated PULSE superadmin may hold the platform admin role';
  END IF;
  IF TG_OP<>'INSERT' AND OLD.role='admin' AND OLD.user_id=target THEN
    IF TG_OP='DELETE' THEN RAISE EXCEPTION 'The PULSE superadmin cannot be removed'; END IF;
    IF NEW.role IS DISTINCT FROM OLD.role OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'The PULSE superadmin cannot be reassigned';
    END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.protect_platform_admin_identity() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER protect_platform_admin_identity BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.protect_platform_admin_identity();
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
CREATE POLICY platform_admin_roles_read ON public.user_roles FOR SELECT TO authenticated USING(public.is_platform_superadmin());
REVOKE INSERT,UPDATE,DELETE ON public.user_roles FROM authenticated,anon;

CREATE FUNCTION public.platform_venue_access_snapshot(p_venue uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('module_key',module_key,'source',source,'enabled',enabled,'expires_at',expires_at,'updated_at',updated_at) ORDER BY module_key),'[]')
 FROM public.venue_module_access WHERE venue_id=p_venue
$$;
REVOKE ALL ON FUNCTION public.platform_venue_access_snapshot(uuid) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.platform_admin_overview() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.is_platform_superadmin() THEN RAISE EXCEPTION 'PULSE superadmin access required' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object(
   'account_email',(SELECT email FROM auth.users WHERE id=auth.uid()),
   'pending_requests',(SELECT count(*) FROM venue_applications WHERE status='pending'),
   'needs_info',(SELECT count(*) FROM venue_applications WHERE status='needs_info'),
   'venues',(SELECT count(*) FROM venues WHERE NOT EXISTS(SELECT 1 FROM private_venue_sandboxes WHERE venue_id=venues.id)),
   'unverified_venues',(SELECT count(*) FROM venues WHERE (verification_approved_at IS NULL OR verification_approved_by IS NULL) AND NOT EXISTS(SELECT 1 FROM private_venue_sandboxes WHERE venue_id=venues.id)),
   'recent_actions',(SELECT coalesce(jsonb_agg(a ORDER BY a.created_at DESC,a.id DESC),'[]') FROM
      (SELECT id,venue_id,action,note,created_at FROM platform_admin_audit ORDER BY created_at DESC,id DESC LIMIT 8) a)
 );
END $$;

CREATE FUNCTION public.platform_admin_venues(p_search text DEFAULT '',p_filter text DEFAULT 'all',p_page integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
 IF NOT public.is_platform_superadmin() THEN RAISE EXCEPTION 'PULSE superadmin access required' USING ERRCODE='42501'; END IF;
 IF p_filter IS NULL OR p_filter NOT IN ('all','unverified','upgraded','free','samples') OR p_page IS NULL OR p_page<0 OR p_page>100000 OR length(coalesce(p_search,''))>200 THEN RAISE EXCEPTION 'Invalid directory filter'; END IF;
 WITH directory AS (
 SELECT v.id,v.name,v.city,v.state,v.owner_id,v.is_active,v.is_published,
   v.verification_approved_at,v.verification_approved_by,
   coalesce(nullif(p.display_name,''),nullif(p.full_name,''),'Owner account') AS owner_name,u.email AS owner_email,
   (SELECT id FROM groups WHERE venue_id=v.id AND type='venue_official' LIMIT 1) AS group_id,
   EXISTS(SELECT 1 FROM private_venue_sandboxes WHERE venue_id=v.id) AS private_sample,
   public.platform_venue_access_snapshot(v.id) AS modules,
   public.venue_has_module(v.id,'court_booking') AS booking,
   public.venue_has_module(v.id,'facility_tools') AS facility
 FROM venues v LEFT JOIN profiles p ON p.id=v.owner_id LEFT JOIN auth.users u ON u.id=v.owner_id
 WHERE strpos(lower(concat_ws(' ',v.name,v.city,v.state,p.full_name,p.display_name,u.email)),lower(btrim(coalesce(p_search,''))))>0
   AND NOT EXISTS(SELECT 1 FROM private_venue_sandboxes s WHERE s.venue_id=v.id AND s.owner_id IS DISTINCT FROM auth.uid())
 ), filtered AS (
 SELECT * FROM directory WHERE
   CASE p_filter WHEN 'unverified' THEN NOT private_sample AND (verification_approved_at IS NULL OR verification_approved_by IS NULL)
     WHEN 'upgraded' THEN NOT private_sample AND (booking OR facility)
     WHEN 'free' THEN NOT private_sample AND NOT booking AND NOT facility
     WHEN 'samples' THEN private_sample ELSE NOT private_sample END
 ), page AS (SELECT * FROM filtered ORDER BY lower(name),id LIMIT 25 OFFSET p_page*25)
 SELECT jsonb_build_object('total',(SELECT count(*) FROM filtered),'rows',coalesce((SELECT jsonb_agg(page ORDER BY lower(name),id) FROM page),'[]')) INTO result;
 RETURN result;
END $$;

CREATE FUNCTION public.platform_set_venue_access(p_venue uuid,p_modules text[],p_expires timestamptz,p_note text,p_expected jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.venues; before_access jsonb; after_access jsonb; k text; desired boolean; old_row public.venue_module_access; changed boolean:=false;
BEGIN
 IF NOT public.is_platform_superadmin() THEN RAISE EXCEPTION 'PULSE superadmin access required' USING ERRCODE='42501'; END IF;
 IF length(btrim(coalesce(p_note,''))) NOT BETWEEN 20 AND 2000 THEN RAISE EXCEPTION 'Record a reason (20–2000 characters)'; END IF;
 IF p_modules IS NULL OR cardinality(p_modules)>2 OR EXISTS(SELECT 1 FROM unnest(p_modules) x WHERE x IS NULL OR x NOT IN ('court_booking','facility_tools'))
   OR cardinality(p_modules)<>(SELECT count(DISTINCT x) FROM unnest(p_modules) x) THEN RAISE EXCEPTION 'Choose valid venue features'; END IF;
 IF p_expires IS NOT NULL AND (NOT isfinite(p_expires) OR p_expires<=now()) THEN RAISE EXCEPTION 'Choose a future expiry or no expiry'; END IF;
 SELECT * INTO v FROM public.venues WHERE id=p_venue FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Venue not found'; END IF;
 IF EXISTS(SELECT 1 FROM private_venue_sandboxes WHERE venue_id=p_venue) THEN RAISE EXCEPTION 'Private sample features remain included; sample access is not a commercial tier'; END IF;
 before_access:=public.platform_venue_access_snapshot(p_venue);
 IF p_expected IS NULL OR before_access IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Venue access changed. Refresh and review again before saving.'; END IF;
 FOREACH k IN ARRAY ARRAY['court_booking','facility_tools'] LOOP
   SELECT * INTO old_row FROM venue_module_access WHERE venue_id=p_venue AND module_key=k;
   desired:=k=ANY(p_modules);
   -- Keep unchanged paid access untouched; it can never be converted to a grant here.
   IF old_row.source='subscription' THEN
     IF desired IS DISTINCT FROM (old_row.enabled AND (old_row.expires_at IS NULL OR old_row.expires_at>now())) THEN
       RAISE EXCEPTION 'Subscription-managed access must be changed by the owner through Stripe billing; no charge or cancellation was made';
     END IF;
     CONTINUE;
   END IF;
   IF desired AND (v.verification_approved_at IS NULL OR v.verification_approved_by IS NULL) THEN RAISE EXCEPTION 'Approve venue ownership before granting features'; END IF;
   IF (desired AND old_row.enabled AND old_row.expires_at IS NOT DISTINCT FROM p_expires)
      OR (NOT desired AND (old_row.venue_id IS NULL OR NOT old_row.enabled)) THEN CONTINUE; END IF;
   IF NOT desired AND k='court_booking' AND EXISTS(
     SELECT 1 FROM payment_orders WHERE venue_id=p_venue AND kind='court_rental' AND livemode AND status='pending'
   ) THEN RAISE EXCEPTION 'A player rental checkout is in progress. Resolve it before removing court booking.'; END IF;
   IF EXISTS(SELECT 1 FROM payment_orders WHERE venue_id=p_venue AND module_key=k AND kind='venue_module' AND livemode AND status='pending')
     OR EXISTS(SELECT 1 FROM payment_subscriptions WHERE venue_id=p_venue AND module_key=k AND livemode AND (status NOT IN ('canceled','incomplete_expired') OR paid_through>now()))
     THEN RAISE EXCEPTION 'This feature has a checkout or paid subscription in progress. Resolve billing before changing included access.'; END IF;
   changed:=true;
   IF desired THEN
     INSERT INTO venue_module_access(venue_id,module_key,source,enabled,expires_at) VALUES(p_venue,k,'staff_grant',true,p_expires)
       ON CONFLICT(venue_id,module_key) DO UPDATE SET source='staff_grant',enabled=true,expires_at=p_expires,updated_at=now();
   ELSE
     UPDATE venue_module_access SET enabled=false,updated_at=now() WHERE venue_id=p_venue AND module_key=k;
   END IF;
 END LOOP;
 after_access:=public.platform_venue_access_snapshot(p_venue);
 IF changed THEN
   INSERT INTO platform_admin_audit(actor_id,venue_id,action,note,before_state,after_state)
     VALUES(auth.uid(),p_venue,'venue_access_changed',btrim(p_note),before_access,after_access);
   IF v.owner_id IS NOT NULL THEN
     PERFORM public.create_notification(v.owner_id,'venue_access_changed','community','Your venue feature access changed',
       'PULSE updated included feature access. Review Plan & upgrades in your venue. No subscription or charge was created.',
       '/player/community/group/'||(SELECT id::text FROM groups WHERE venue_id=p_venue AND type='venue_official' LIMIT 1),'normal',jsonb_build_object('venue_id',p_venue),auth.uid());
   END IF;
 END IF;
 RETURN after_access;
END $$;

-- Serialize new real module checkouts with admin grants. Neither workflow can
-- pass an earlier access check and then race into charging for included access.
-- The same lock protects pending player rental fulfillment from a downgrade.
CREATE FUNCTION public.guard_module_checkout_access() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.kind IN ('venue_module','court_rental') AND NEW.livemode AND NEW.status='pending' THEN
   PERFORM 1 FROM venues WHERE id=NEW.venue_id FOR UPDATE;
   IF NEW.kind='court_rental' AND NOT public.venue_has_module(NEW.venue_id,'court_booking') THEN
     RAISE EXCEPTION 'Court booking access changed. Refresh before starting checkout.';
   END IF;
   IF NEW.kind='venue_module' AND public.venue_has_module(NEW.venue_id,NEW.module_key) THEN
     RAISE EXCEPTION 'This feature already has access. No payment is needed; refresh your venue.';
   END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_module_checkout_access() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_module_checkout_access BEFORE INSERT ON public.payment_orders FOR EACH ROW EXECUTE FUNCTION public.guard_module_checkout_access();

REVOKE ALL ON FUNCTION public.platform_admin_overview(),public.platform_admin_venues(text,text,integer),public.platform_set_venue_access(uuid,text[],timestamptz,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.platform_admin_overview(),public.platform_admin_venues(text,text,integer),public.platform_set_venue_access(uuid,text[],timestamptz,text,jsonb) TO authenticated;

-- Sole-superadmin review retains evidence, duplicate checks and atomic creation.
CREATE OR REPLACE FUNCTION public.review_venue_application(p_application_id uuid, p_decision text, p_note text, p_ownership_checked boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_app public.venue_applications; v_venue uuid; v_group uuid; v_slug text; v_details jsonb;
BEGIN
  IF NOT public.is_platform_superadmin() THEN RAISE EXCEPTION 'PULSE admin access required'; END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('approved','needs_info','rejected') OR length(btrim(coalesce(p_note,''))) NOT BETWEEN 20 AND 2000 THEN
    RAISE EXCEPTION 'Choose a decision and provide a review note (20–2000 characters)';
  END IF;
  SELECT * INTO v_app FROM public.venue_applications WHERE id=p_application_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Application not found'; END IF;
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
    VALUES(p_application_id,auth.uid(),p_decision,btrim(p_note),jsonb_build_object('ownership_checked',p_ownership_checked,'superadmin_self_review',v_app.applicant_id=auth.uid()));
  INSERT INTO public.platform_admin_audit(actor_id,venue_id,action,note,before_state,after_state)
    VALUES(auth.uid(),v_venue,'venue_request_'||p_decision,btrim(p_note),
      jsonb_build_object('application_id',p_application_id,'status',v_app.status),
      jsonb_build_object('application_id',p_application_id,'status',p_decision,'self_review',v_app.applicant_id=auth.uid()));
  PERFORM public.create_notification(v_app.applicant_id,'venue_ownership_review','community',
    CASE p_decision WHEN 'approved' THEN 'Your venue is approved' WHEN 'needs_info' THEN 'Your venue request needs information' ELSE 'Your venue review is ready' END,
    'Open your venue requests to see the decision and next steps.','/player/venue-requests','normal',jsonb_build_object('application_id',p_application_id),auth.uid());
  RETURN jsonb_build_object('venue_id',v_venue,'group_id',v_group);
END $$;

-- A successful migration also proves the live access checks and unchanged venue
-- records below. Any failure rolls back this release, including role changes.
DO $$ DECLARE target uuid; original_claim text := current_setting('request.jwt.claim.sub',true); resource record; fingerprint text;
BEGIN
  SELECT user_id INTO target FROM public.platform_admin_identity;
  IF target IS NULL OR (SELECT count(*) FROM public.user_roles WHERE role='admin')<>1
    OR NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=target AND role='admin') THEN
    RAISE EXCEPTION 'Superadmin reconciliation failed; release rolled back';
  END IF;
  IF has_table_privilege('authenticated','public.user_roles','INSERT,UPDATE,DELETE')
    OR has_table_privilege('authenticated','public.platform_admin_audit','INSERT,UPDATE,DELETE')
    OR has_function_privilege('anon','public.platform_set_venue_access(uuid,text[],timestamptz,text,jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'Platform privilege verification failed; release rolled back';
  END IF;
  FOR resource IN SELECT * FROM platform_admin_release_baseline LOOP
    EXECUTE format('SELECT md5(coalesce(string_agg(to_jsonb(t)::text,chr(10) ORDER BY to_jsonb(t)::text),'''')) FROM public.%I t',resource.resource) INTO fingerprint;
    IF fingerprint IS DISTINCT FROM resource.fingerprint THEN
      RAISE EXCEPTION 'Unexpected change to %; release rolled back',resource.resource;
    END IF;
  END LOOP;
  PERFORM set_config('request.jwt.claim.sub',target::text,true);
  IF NOT public.is_platform_superadmin() THEN RAISE EXCEPTION 'Superadmin identity check failed'; END IF;
  PERFORM public.platform_admin_overview();
  PERFORM public.platform_admin_venues('','all',0);
  PERFORM set_config('request.jwt.claim.sub','',true);
  BEGIN
    PERFORM public.platform_admin_overview();
    RAISE EXCEPTION 'Signed-out overview access was not denied';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM set_config('request.jwt.claim.sub',coalesce(original_claim,''),true);
END $$;

COMMIT;
