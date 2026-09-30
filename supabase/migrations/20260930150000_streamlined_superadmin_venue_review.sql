BEGIN;
CREATE OR REPLACE FUNCTION public.platform_set_venue_access(p_venue uuid,p_modules text[],p_expires timestamptz,p_note text,p_expected jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.venues; before_access jsonb; after_access jsonb; k text; desired boolean; old_row public.venue_module_access; changed boolean:=false;
BEGIN
 IF NOT public.is_platform_superadmin() OR NOT public.pulse_has_required_mfa() THEN RAISE EXCEPTION 'PULSE superadmin access required' USING ERRCODE='42501'; END IF;
 IF length(coalesce(p_note,''))>2000 THEN RAISE EXCEPTION 'Keep the note under 2000 characters'; END IF;
 p_note:=coalesce(nullif(btrim(p_note),''),'Included feature access updated by the platform superadmin.');
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

CREATE OR REPLACE FUNCTION public.review_venue_application(p_application_id uuid, p_decision text, p_note text, p_ownership_checked boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_app public.venue_applications; v_venue uuid; v_group uuid; v_slug text; v_details jsonb;
BEGIN
  IF NOT public.is_platform_superadmin() OR NOT public.pulse_has_required_mfa() THEN RAISE EXCEPTION 'PULSE admin access required'; END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('approved','needs_info','rejected') OR length(coalesce(p_note,''))>2000 THEN
    RAISE EXCEPTION 'Choose a decision and keep the note under 2000 characters';
  END IF;
  IF p_decision<>'approved' AND nullif(btrim(p_note),'') IS NULL THEN
    RAISE EXCEPTION 'Tell the applicant what is needed or why the request was declined';
  END IF;
  p_note:=coalesce(nullif(btrim(p_note),''),'Approved by the platform superadmin.');
  SELECT * INTO v_app FROM public.venue_applications WHERE id=p_application_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Application not found'; END IF;
  IF v_app.status NOT IN ('pending','needs_info') THEN RAISE EXCEPTION 'This application is no longer awaiting review'; END IF;
  v_venue := v_app.venue_id; v_details := v_app.details;
  IF p_decision = 'approved' THEN
    IF p_ownership_checked IS DISTINCT FROM true THEN RAISE EXCEPTION 'Confirm that you have verified the current owner before approving'; END IF;
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

-- Uses the existing venue and owner; no fabricated application or business evidence.
CREATE FUNCTION public.platform_verify_venue(p_venue uuid,p_expected_owner uuid,p_note text DEFAULT '',p_confirmed boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.venues; request public.venue_applications; before_verification jsonb; v_group uuid;
BEGIN
 IF NOT public.is_platform_superadmin() OR NOT public.pulse_has_required_mfa() THEN RAISE EXCEPTION 'PULSE superadmin access required' USING ERRCODE='42501'; END IF;
 IF p_confirmed IS DISTINCT FROM true THEN RAISE EXCEPTION 'Confirm the current owner before verifying'; END IF;
 IF length(coalesce(p_note,''))>2000 THEN RAISE EXCEPTION 'Keep the note under 2000 characters'; END IF;
 p_note:=coalesce(nullif(btrim(p_note),''),'Existing venue ownership verified by the platform superadmin.');
 -- Same lock order as application review: application, then venue.
 SELECT * INTO request FROM venue_applications WHERE venue_id=p_venue AND status IN ('pending','needs_info') ORDER BY created_at LIMIT 1 FOR UPDATE;
 SELECT * INTO v FROM venues WHERE id=p_venue FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Venue not found'; END IF;
 IF v.owner_id IS NULL OR p_expected_owner IS NULL OR v.owner_id IS DISTINCT FROM p_expected_owner THEN
  RAISE EXCEPTION 'Venue owner changed or is missing. Refresh and review the owner before verifying.';
 END IF;
 IF EXISTS(SELECT 1 FROM private_venue_sandboxes WHERE venue_id=p_venue) THEN RAISE EXCEPTION 'Private samples cannot be business-verified'; END IF;
 IF request.id IS NOT NULL THEN
  IF request.applicant_id IS DISTINCT FROM v.owner_id THEN RAISE EXCEPTION 'Resolve the existing ownership request first'; END IF;
  RETURN public.review_venue_application(request.id,'approved',p_note,true);
 END IF;
 SELECT id INTO v_group FROM groups WHERE venue_id=p_venue AND type='venue_official';
 IF v.verification_approved_at IS NOT NULL AND v.verification_approved_by IS NOT NULL THEN
  RETURN jsonb_build_object('venue_id',p_venue,'group_id',v_group);
 END IF;
 before_verification:=jsonb_build_object('owner_id',v.owner_id,'verified_at',v.verification_approved_at,'verified_by',v.verification_approved_by);
 UPDATE venues SET verification_approved_at=now(),verification_approved_by=auth.uid() WHERE id=p_venue;
 UPDATE groups SET is_venue_verified=true WHERE id=v_group;
 INSERT INTO platform_admin_audit(actor_id,venue_id,action,note,before_state,after_state)
 VALUES(auth.uid(),p_venue,'venue_ownership_verified',p_note,before_verification,
  jsonb_build_object('owner_id',v.owner_id,'verified_at',now(),'verified_by',auth.uid(),'self_review',v.owner_id=auth.uid(),'source','direct_superadmin_review'));
 RETURN jsonb_build_object('venue_id',p_venue,'group_id',v_group);
END $$;
REVOKE ALL ON FUNCTION public.platform_verify_venue(uuid,uuid,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.platform_verify_venue(uuid,uuid,text,boolean) TO authenticated;
COMMIT;
