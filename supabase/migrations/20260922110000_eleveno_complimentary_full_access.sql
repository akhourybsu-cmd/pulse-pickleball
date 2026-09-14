-- Explicit platform-owner request: give ELEVENO all current venue features.
-- One-venue complimentary override, not ownership verification or a paid tier.
-- No Stripe changes, charges, publication changes, staff changes or new privileges.
BEGIN;

DO $$
DECLARE
  target uuid := '4ee96566-4074-41c0-aa2b-2d767bdb50e1';
  community uuid := 'e3e97754-ac66-4814-94f3-ae3391de4e33';
  actor uuid;
  venue_row public.venues;
  before_access jsonb;
  after_access jsonb;
  before_venue jsonb;
  before_other_access jsonb;
BEGIN
  SELECT * INTO venue_row FROM public.venues WHERE id=target FOR UPDATE;
  IF NOT FOUND THEN
    RAISE NOTICE 'ELEVENO absent in this environment; complimentary override skipped';
    RETURN;
  END IF;
  IF venue_row.name<>'ELEVENO' OR NOT EXISTS (
    SELECT 1 FROM public.groups WHERE id=community AND venue_id=target AND type='venue_official'
  ) OR EXISTS (SELECT 1 FROM public.private_venue_sandboxes WHERE venue_id=target) THEN
    RAISE EXCEPTION 'ELEVENO override target mismatch; no changes applied';
  END IF;
  SELECT i.user_id INTO actor FROM public.platform_admin_identity i JOIN auth.users u ON u.id=i.user_id
    WHERE lower(u.email)='akhourybsu@gmail.com' AND u.email_confirmed_at IS NOT NULL
      AND public.has_role(i.user_id,'admin'::public.app_role);
  IF actor IS NULL THEN RAISE EXCEPTION 'Designated superadmin not confirmed; no changes applied'; END IF;

  -- Same venue lock as the standard grant RPC and live checkout insert guard.
  -- Never replace a subscription entitlement or interfere with an open purchase.
  IF EXISTS (SELECT 1 FROM public.venue_module_access WHERE venue_id=target AND source='subscription')
    OR EXISTS (SELECT 1 FROM public.payment_orders WHERE venue_id=target AND kind='venue_module' AND livemode AND status='pending')
    OR EXISTS (SELECT 1 FROM public.payment_subscriptions WHERE venue_id=target AND livemode
      AND (status NOT IN ('canceled','incomplete_expired') OR paid_through>now())) THEN
    RAISE EXCEPTION 'Resolve ELEVENO module billing before granting complimentary access; no changes applied';
  END IF;

  before_venue:=to_jsonb(venue_row);
  before_access:=public.platform_venue_access_snapshot(target);
  SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY venue_id,module_key),'[]') INTO before_other_access
    FROM public.venue_module_access m WHERE venue_id<>target;

  -- This explicit one-off exception does NOT weaken the normal verified-owner
  -- requirement in platform_set_venue_access or mark the business as verified.
  INSERT INTO public.venue_module_access(venue_id,module_key,source,enabled,expires_at)
    VALUES(target,'court_booking','staff_grant',true,NULL),(target,'facility_tools','staff_grant',true,NULL)
    ON CONFLICT(venue_id,module_key) DO UPDATE SET source='staff_grant',enabled=true,expires_at=NULL,updated_at=now();
  after_access:=public.platform_venue_access_snapshot(target);

  IF NOT public.venue_has_module(target,'court_booking') OR NOT public.venue_has_module(target,'facility_tools')
    OR (SELECT count(*) FROM public.venue_module_access WHERE venue_id=target AND source='staff_grant' AND enabled AND expires_at IS NULL)<>2
    OR before_venue IS DISTINCT FROM (SELECT to_jsonb(v) FROM public.venues v WHERE id=target)
    OR before_other_access IS DISTINCT FROM (
      SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY venue_id,module_key),'[]') FROM public.venue_module_access m WHERE venue_id<>target
    ) THEN RAISE EXCEPTION 'ELEVENO override verification failed; transaction rolled back'; END IF;

  INSERT INTO public.platform_admin_audit(actor_id,venue_id,action,note,before_state,after_state)
    VALUES(actor,target,'venue_access_changed',
      'Explicit superadmin request: override ELEVENO to complimentary Court Booking and Facility Tools with no expiry. Ownership verification remains unchanged; no subscription, charge or live payment activation.',
      before_access,after_access);
  IF venue_row.owner_id IS NOT NULL THEN
    PERFORM public.create_notification(venue_row.owner_id,'venue_access_changed','community','ELEVENO now has full feature access',
      'PULSE included Court Booking and Facility Tools at no cost, with no expiry. Your verification and payment setup are unchanged.',
      '/player/community/group/'||community::text,'normal',jsonb_build_object('venue_id',target),actor);
  END IF;
END $$;

COMMIT;
