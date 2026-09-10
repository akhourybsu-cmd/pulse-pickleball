-- Explicit, service-managed sandbox billing permission. Never enables live
-- billing, real-business verification, public visibility or new memberships.
BEGIN;

ALTER TABLE public.private_venue_sandboxes
  ADD COLUMN test_payments_enabled boolean NOT NULL DEFAULT false;

CREATE FUNCTION public.payment_venue_owner_eligible(p_venue uuid,p_owner uuid,p_live boolean)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.venues v LEFT JOIN public.private_venue_sandboxes s ON s.venue_id=v.id
    WHERE v.id=p_venue AND v.owner_id=p_owner AND p_live IS NOT NULL
      AND CASE WHEN s.venue_id IS NOT NULL
        THEN p_live=false AND s.test_payments_enabled AND s.owner_id=p_owner
        ELSE v.verification_approved_at IS NOT NULL END
  )
$$;
REVOKE ALL ON FUNCTION public.payment_venue_owner_eligible(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.payment_venue_owner_eligible(uuid,uuid,boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.guard_private_venue_sandbox() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s private_venue_sandboxes; v_venue uuid; v_group uuid; row_data jsonb:=to_jsonb(NEW);
BEGIN
 IF TG_TABLE_NAME='venues' THEN v_venue:=NEW.id;
 ELSE v_venue:=nullif(row_data->>'venue_id','')::uuid; v_group:=nullif(row_data->>'group_id','')::uuid; END IF;
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
 ELSIF TG_TABLE_NAME IN ('venue_payment_accounts','payment_orders','payment_subscriptions','venue_payment_oauth_states') THEN
   -- Deny absent/null/live mode, another buyer/financial owner, and a registry
   -- that no longer agrees with the actual venue owner. Browser writes remain
   -- denied by the payment tables' existing grants and RLS.
   IF NOT s.test_payments_enabled OR (row_data->>'livemode') IS DISTINCT FROM 'false'
     OR NOT public.payment_venue_owner_eligible(s.venue_id,s.owner_id,false)
     OR coalesce(row_data->>'connected_by',row_data->>'buyer_id',row_data->>'owner_id') IS DISTINCT FROM s.owner_id::text
     OR (v_group IS NOT NULL AND v_group IS DISTINCT FROM s.group_id) THEN
     RAISE EXCEPTION 'Billing is disabled for private sample venues except approved owner-only test payments';
   END IF;
 ELSIF TG_TABLE_NAME='venue_subscriptions' THEN
   RAISE EXCEPTION 'Billing is disabled for private sample venues';
 ELSIF TG_TABLE_NAME='venue_payment_settings' AND NEW.accepting_payments THEN
   RAISE EXCEPTION 'Live billing is disabled for private sample venues';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_private_sandbox BEFORE INSERT OR UPDATE ON public.venue_payment_oauth_states
  FOR EACH ROW EXECUTE FUNCTION public.guard_private_venue_sandbox();

CREATE OR REPLACE FUNCTION public.payment_link_venue_account(p_venue uuid,p_owner uuid,p_live boolean,p_account text)
RETURNS public.venue_payment_accounts LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.venues; a public.venue_payment_accounts;
BEGIN
  SELECT * INTO v FROM public.venues WHERE id=p_venue FOR UPDATE;
  IF EXISTS(SELECT 1 FROM public.private_venue_sandboxes WHERE venue_id=p_venue)
    AND NOT public.payment_venue_owner_eligible(p_venue,p_owner,p_live) THEN
    RAISE EXCEPTION 'Billing is disabled for private sample venues except approved owner-only test payments';
  END IF;
  IF NOT public.payment_venue_owner_eligible(p_venue,p_owner,p_live) THEN
    RAISE EXCEPTION 'Only the verified current venue owner can connect payments';
  END IF;
  IF p_account IS NULL OR p_account !~ '^acct_[A-Za-z0-9]+$' THEN RAISE EXCEPTION 'Invalid connected account'; END IF;
  SELECT * INTO a FROM public.venue_payment_accounts WHERE venue_id=p_venue AND livemode=p_live FOR UPDATE;
  IF FOUND AND (a.connected_by IS DISTINCT FROM p_owner OR a.account_id IS DISTINCT FROM p_account) THEN
    RAISE EXCEPTION 'The existing financial account requires review; it cannot be replaced here';
  END IF;
  IF p_live AND v.stripe_account_id IS NOT NULL AND v.stripe_account_id<>p_account THEN
    RAISE EXCEPTION 'Connect the venue existing Stripe account or request a financial review';
  END IF;
  IF EXISTS(SELECT 1 FROM public.venue_payment_accounts WHERE account_id=p_account AND livemode=p_live AND venue_id<>p_venue) THEN
    RAISE EXCEPTION 'This Stripe account already belongs to another venue in PULSE';
  END IF;
  INSERT INTO public.venue_payment_accounts(venue_id,livemode,account_id,connected_by)
    VALUES(p_venue,p_live,p_account,p_owner)
    ON CONFLICT(venue_id,livemode) DO UPDATE SET disconnected_at=NULL,updated_at=now()
    RETURNING * INTO a;
  RETURN a;
END $$;

-- Preserve all quote validation. Only the verification branch gains the
-- explicit test exception; private samples additionally require the owner buyer.
CREATE OR REPLACE FUNCTION public.payment_court_quote_base(p_buyer uuid,p_group uuid,p_court uuid,p_start timestamptz,p_end timestamptz,p_live boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.venue_courts; v public.venues; s public.venue_payment_settings; a public.venue_payment_accounts;
  mins numeric; amount integer; day jsonb; local_start timestamp; local_end timestamp; opens integer; closes integer;
BEGIN
  SELECT * INTO c FROM public.venue_courts WHERE id=p_court;
  SELECT * INTO v FROM public.venues WHERE id=c.venue_id;
  IF c.id IS NULL OR c.is_active=false OR v.is_active=false THEN RAISE EXCEPTION 'Court is unavailable'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.groups WHERE id=p_group AND venue_id=v.id)
    OR NOT EXISTS(SELECT 1 FROM public.group_members WHERE group_id=p_group AND user_id=p_buyer AND status='active') THEN
    RAISE EXCEPTION 'Join this venue community before booking';
  END IF;
  IF EXISTS(SELECT 1 FROM public.private_venue_sandboxes WHERE venue_id=v.id)
    AND (p_buyer IS DISTINCT FROM v.owner_id OR NOT public.payment_venue_owner_eligible(v.id,p_buyer,p_live)) THEN
    RAISE EXCEPTION 'Private sample payment testing is restricted to its approved owner';
  END IF;
  IF NOT public.venue_has_module(v.id,'court_booking') THEN RAISE EXCEPTION 'Court booking is not enabled'; END IF;
  mins:=extract(epoch FROM p_end-p_start)/60;
  IF p_start IS NULL OR p_end IS NULL OR p_start<now()+interval '35 minutes' OR p_start>now()+interval '180 days'
    OR mins<30 OR mins>240 OR mod(mins,30)<>0 THEN
    RAISE EXCEPTION 'Choose 30-minute increments, up to 4 hours, starting at least 35 minutes from now and within 180 days';
  END IF;
  SELECT * INTO s FROM public.venue_payment_settings WHERE venue_id=v.id;
  SELECT * INTO a FROM public.venue_payment_accounts WHERE venue_id=v.id AND livemode=p_live;
  IF (p_live AND NOT coalesce(s.accepting_payments,false)) OR coalesce(c.hourly_rate,0)<=0 THEN RAISE EXCEPTION 'Paid booking is not configured for this court'; END IF;
  IF NOT coalesce(a.charges_enabled,false) OR NOT coalesce(a.payouts_enabled,false) OR a.connected_by IS DISTINCT FROM v.owner_id
    OR NOT public.payment_venue_owner_eligible(v.id,v.owner_id,p_live) THEN RAISE EXCEPTION 'This venue must finish its payment verification'; END IF;
  IF NOT coalesce(s.tax_inclusive_acknowledged,false) OR coalesce(length(s.cancellation_policy),0)<20 OR coalesce(s.support_email,'')='' OR coalesce(s.timezone,'')='' THEN RAISE EXCEPTION 'Venue payment policies are incomplete'; END IF;
  local_start:=p_start AT TIME ZONE s.timezone; local_end:=p_end AT TIME ZONE s.timezone;
  day:=v.hours_of_operation->'days'->(extract(dow FROM local_start)::integer)::text;
  IF day='null'::jsonb THEN RAISE EXCEPTION 'The venue is closed that day'; END IF;
  opens:=extract(epoch FROM coalesce((day->>'open')::time,'06:00'::time))/60;
  closes:=CASE WHEN day->>'close'='24:00' THEN 1440 ELSE extract(epoch FROM coalesce((day->>'close')::time,'22:00'::time))/60 END;
  IF local_end::date>local_start::date+1 OR local_end>date_trunc('day',local_start)+closes*interval '1 minute'
    OR local_start<date_trunc('day',local_start)+opens*interval '1 minute' THEN RAISE EXCEPTION 'Choose a time within the venue opening hours'; END IF;
  IF EXISTS(SELECT 1 FROM public.group_events WHERE venue_court_id=c.id AND tstzrange(start_time,end_time,'[)') && tstzrange(p_start,p_end,'[)'))
    OR EXISTS(SELECT 1 FROM public.payment_orders WHERE court_id=c.id AND livemode=p_live AND status='pending' AND tstzrange(start_time,end_time,'[)') && tstzrange(p_start,p_end,'[)')) THEN
    RAISE EXCEPTION 'This court is no longer available' USING ERRCODE='23P01';
  END IF;
  amount:=round(c.hourly_rate*100*mins/60);
  IF amount<50 OR amount>99999999 THEN RAISE EXCEPTION 'The venue must set a valid rate'; END IF;
  RETURN jsonb_build_object('venue_id',v.id,'merchant_name',v.name,'account_id',a.account_id,'amount_cents',amount,'currency','usd',
    'description',c.name||' · '||mins::integer||' minutes','policy',s.cancellation_policy,'support_email',s.support_email,'timezone',s.timezone,'hourly_rate',c.hourly_rate);
END $$;

COMMIT;
