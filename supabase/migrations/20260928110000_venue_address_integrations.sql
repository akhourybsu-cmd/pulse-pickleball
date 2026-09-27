-- A venue's first integration: a permanent, PULSE-managed public address.
BEGIN;

CREATE TABLE public.venue_address_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid UNIQUE REFERENCES public.venues(id) ON DELETE SET NULL,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$'),
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','provisioning','action_required','connected','error')),
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  checked_at timestamptz,
  check_after timestamptz NOT NULL DEFAULT now(),
  check_token uuid,
  provider_details jsonb NOT NULL DEFAULT '{}'
);
ALTER TABLE public.venue_address_connections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.venue_address_connections FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.venue_address_connections TO service_role;
-- Keep reservations after venue deletion: a shared address must never be reassigned.

CREATE FUNCTION public.can_manage_venue_integrations(p_venue_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT auth.uid() IS NOT NULL
    AND coalesce(auth.jwt()->>'is_anonymous','false') <> 'true'
    AND public.pulse_has_required_mfa()
    AND (public.is_platform_superadmin()
      OR EXISTS (SELECT 1 FROM venues WHERE id=p_venue_id AND owner_id=auth.uid())
      OR EXISTS (SELECT 1 FROM venue_staff WHERE venue_id=p_venue_id AND user_id=auth.uid()
        AND role IN ('owner','manager') AND is_active IS NOT FALSE AND (status IS NULL OR status='active')))
$$;
REVOKE ALL ON FUNCTION public.can_manage_venue_integrations(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_manage_venue_integrations(uuid) TO authenticated,service_role;

CREATE FUNCTION public.get_venue_address_setup(p_venue_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.can_manage_venue_integrations(p_venue_id) THEN RAISE EXCEPTION 'Venue manager access required' USING ERRCODE='42501'; END IF;
  SELECT jsonb_build_object(
    'venue_slug',v.slug,'active',v.is_active,
    'verified',v.verification_approved_at IS NOT NULL AND v.verification_approved_by IS NOT NULL,
    'private_sample',EXISTS(SELECT 1 FROM private_venue_sandboxes s WHERE s.venue_id=v.id),
    'public_ready',public.get_public_community(NULL,v.slug) IS NOT NULL,
    'connection',(SELECT (to_jsonb(c)-'check_token'-'check_after'-'requested_by'-'provider_details')
      || CASE WHEN public.is_platform_superadmin() THEN jsonb_build_object('provider_details',c.provider_details) ELSE '{}'::jsonb END
      FROM venue_address_connections c WHERE c.venue_id=v.id)
  ) INTO result FROM venues v WHERE v.id=p_venue_id;
  IF result IS NULL THEN RAISE EXCEPTION 'Venue not found'; END IF;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.get_venue_address_setup(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_venue_address_setup(uuid) TO authenticated;

CREATE FUNCTION public.check_venue_address(p_venue_id uuid,p_slug text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE chosen text := lower(trim(p_slug)); reason text;
BEGIN
  IF NOT public.can_manage_venue_integrations(p_venue_id) THEN RAISE EXCEPTION 'Venue manager access required' USING ERRCODE='42501'; END IF;
  IF chosen IS NULL OR chosen !~ '^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$' THEN
    reason := 'Use 3–63 lowercase letters, numbers or hyphens. Start and end with a letter or number.';
  ELSIF chosen = ANY(ARRAY['www','app','api','auth','admin','mail','notify','support','staging','dev','preview','status','help','account','accounts','billing','payment','payments','login','signup','cdn','assets','static','docs','blog','email','smtp','ftp','ns1','ns2','autodiscover','pulse','venues','community']) THEN
    reason := 'That name is reserved by PULSE. Try your venue name or add your city.';
  ELSIF EXISTS(SELECT 1 FROM venues WHERE lower(slug)=chosen AND id<>p_venue_id)
    OR EXISTS(SELECT 1 FROM venue_address_connections WHERE slug=chosen AND venue_id IS DISTINCT FROM p_venue_id) THEN
    reason := 'That address is already taken. Try adding your city or neighborhood.';
  ELSIF EXISTS(SELECT 1 FROM venue_address_connections WHERE venue_id=p_venue_id AND slug<>chosen) THEN
    reason := 'Your venue already has a reserved address. We keep it stable so shared links keep working.';
  END IF;
  RETURN jsonb_build_object('slug',chosen,'available',reason IS NULL,'reason',reason);
END $$;
REVOKE ALL ON FUNCTION public.check_venue_address(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.check_venue_address(uuid,text) TO authenticated;

CREATE FUNCTION public.request_venue_address(p_venue_id uuid,p_slug text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE setup jsonb; availability jsonb; chosen text := lower(trim(p_slug));
BEGIN
  -- Shared with venue slug writes, closing the alias/canonical-name race.
  PERFORM pg_advisory_xact_lock(28110000);
  setup := public.get_venue_address_setup(p_venue_id);
  IF (setup->>'private_sample')::boolean THEN RAISE EXCEPTION 'Private sample venues cannot have public addresses'; END IF;
  IF NOT (setup->>'active')::boolean THEN RAISE EXCEPTION 'Activate this venue before requesting an address'; END IF;
  IF NOT (setup->>'verified')::boolean THEN RAISE EXCEPTION 'Verify venue ownership before requesting an address'; END IF;
  availability := public.check_venue_address(p_venue_id,chosen);
  IF NOT (availability->>'available')::boolean THEN RAISE EXCEPTION '%',availability->>'reason'; END IF;
  INSERT INTO venue_address_connections(venue_id,slug,requested_by) VALUES(p_venue_id,chosen,auth.uid())
    ON CONFLICT(venue_id) DO NOTHING;
  RETURN public.get_venue_address_setup(p_venue_id);
END $$;
REVOKE ALL ON FUNCTION public.request_venue_address(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.request_venue_address(uuid,text) TO authenticated;

CREATE FUNCTION public.protect_reserved_venue_address() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(28110000);
  IF EXISTS(SELECT 1 FROM venue_address_connections WHERE slug=lower(NEW.slug) AND venue_id IS DISTINCT FROM NEW.id) THEN
    RAISE EXCEPTION 'That venue address is already reserved';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.protect_reserved_venue_address() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER protect_reserved_venue_address BEFORE INSERT OR UPDATE OF slug ON public.venues
FOR EACH ROW EXECUTE FUNCTION public.protect_reserved_venue_address();

CREATE FUNCTION public.list_venue_address_requests() RETURNS SETOF jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.is_platform_superadmin() OR NOT public.pulse_has_required_mfa() THEN RAISE EXCEPTION 'Platform administrator access required' USING ERRCODE='42501'; END IF;
  RETURN QUERY SELECT jsonb_build_object('venue_id',c.venue_id,'venue_name',v.name,'slug',c.slug,'status',c.status,'requested_at',c.requested_at)
    FROM venue_address_connections c JOIN venues v ON v.id=c.venue_id
    ORDER BY (c.status='connected'),c.requested_at LIMIT 100;
END $$;
REVOKE ALL ON FUNCTION public.list_venue_address_requests() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.list_venue_address_requests() TO authenticated;

-- Only the authenticated, MFA-checked Edge Function can run provider operations.
-- A lease makes double clicks/retries safe, and the completion token rejects stale results.
CREATE FUNCTION public.begin_venue_address_check(p_venue_id uuid,p_actor uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM platform_admin_identity WHERE user_id=p_actor)
    OR NOT public.has_role(p_actor,'admin'::public.app_role) THEN RAISE EXCEPTION 'Platform administrator access required'; END IF;
  IF NOT EXISTS(SELECT 1 FROM venues v WHERE v.id=p_venue_id AND v.is_active
    AND v.verification_approved_at IS NOT NULL AND v.verification_approved_by IS NOT NULL
    AND NOT EXISTS(SELECT 1 FROM private_venue_sandboxes s WHERE s.venue_id=v.id)) THEN
    RAISE EXCEPTION 'Active, verified venue required';
  END IF;
  UPDATE venue_address_connections SET check_token=gen_random_uuid(),check_after=now()+interval '90 seconds'
    WHERE venue_id=p_venue_id AND check_after<=now()
    RETURNING jsonb_build_object('slug',slug,'token',check_token) INTO result;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.begin_venue_address_check(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.begin_venue_address_check(uuid,uuid) TO service_role;

CREATE FUNCTION public.finish_venue_address_check(p_venue_id uuid,p_actor uuid,p_token uuid,p_status text,p_details jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE previous jsonb; next_state jsonb;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM platform_admin_identity WHERE user_id=p_actor)
    OR NOT public.has_role(p_actor,'admin'::public.app_role) THEN RAISE EXCEPTION 'Platform administrator access required'; END IF;
  SELECT jsonb_build_object('slug',slug,'status',status) INTO previous
    FROM venue_address_connections WHERE venue_id=p_venue_id AND check_token=p_token FOR UPDATE;
  IF previous IS NULL THEN RAISE EXCEPTION 'This check was replaced by a newer one'; END IF;
  UPDATE venue_address_connections SET status=p_status,provider_details=p_details,checked_at=now(),
    check_token=NULL,check_after=now()+interval '30 seconds' WHERE venue_id=p_venue_id
    RETURNING jsonb_build_object('slug',slug,'status',status) INTO next_state;
  INSERT INTO platform_admin_audit(actor_id,venue_id,action,note,before_state,after_state)
    VALUES(p_actor,p_venue_id,'venue.address.checked','Checked venue address with Firebase Hosting.',previous,next_state);
END $$;
REVOKE ALL ON FUNCTION public.finish_venue_address_check(uuid,uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_venue_address_check(uuid,uuid,uuid,text,jsonb) TO service_role;

-- Preserve the public projection and its privacy checks for both original and reserved links.
CREATE OR REPLACE FUNCTION public.get_public_community(p_group_id uuid DEFAULT NULL, p_venue_slug text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT jsonb_build_object(
    'id',g.id, 'name',g.name, 'description',g.description,
    'visibility',g.visibility, 'join_method',g.join_method,
    'icon_url',g.icon_url, 'cover_url',g.cover_url,
    'member_count',g.member_count, 'is_venue_verified',g.is_venue_verified,
    'venue', CASE WHEN v.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id',v.id, 'name',v.name, 'slug',v.slug, 'address',v.address,
      'city',v.city, 'state',v.state, 'phone',v.phone, 'email',v.email, 'website_url',v.website_url,
      'logo_url',v.logo_url, 'cover_image_url',v.cover_image_url,
      'logo_image_fit',v.logo_image_fit, 'cover_image_fit',v.cover_image_fit,
      'logo_shape',v.logo_shape, 'cover_focal_point',v.cover_focal_point,
      'primary_color',v.primary_color, 'secondary_color',v.secondary_color,
      'tagline',v.tagline, 'welcome_headline',v.welcome_headline, 'welcome_message',v.welcome_message,
      'timezone',v.timezone, 'hours_of_operation',v.hours_of_operation,
      'booking_enabled',EXISTS (SELECT 1 FROM venue_module_access m WHERE m.venue_id=v.id AND m.module_key='court_booking' AND m.enabled AND (m.expires_at IS NULL OR m.expires_at>now()))
    ) END,
    'courts', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id',c.id, 'name',c.name, 'court_number',c.court_number,
      'court_type',c.court_type, 'surface_type',c.surface_type
    ) ORDER BY c.court_number,c.id) FROM venue_courts c WHERE c.venue_id=v.id AND c.is_active), '[]'::jsonb)
  ) FROM groups g LEFT JOIN venues v ON v.id=g.venue_id
  WHERE ((p_group_id IS NOT NULL AND p_venue_slug IS NULL AND g.id=p_group_id)
    OR (p_group_id IS NULL AND p_venue_slug IS NOT NULL AND g.type='venue_official'
      AND (v.slug=p_venue_slug OR EXISTS(SELECT 1 FROM venue_address_connections a WHERE a.venue_id=v.id AND a.slug=p_venue_slug))))
    AND g.visibility='public' AND (g.venue_id IS NULL OR (v.is_active AND v.is_published))
    AND NOT EXISTS(SELECT 1 FROM private_venue_sandboxes s WHERE s.group_id=g.id OR s.venue_id=g.venue_id)
  LIMIT 1
$$;
COMMIT;
