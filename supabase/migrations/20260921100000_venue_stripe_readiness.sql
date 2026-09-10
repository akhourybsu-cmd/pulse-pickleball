-- Prepare independently owned venue Stripe connections. Does not enable payments.
BEGIN;

ALTER TABLE public.venue_payment_accounts
  ADD COLUMN card_payments_active boolean NOT NULL DEFAULT false,
  ADD COLUMN requirements_due text[] NOT NULL DEFAULT '{}',
  ADD COLUMN requirements_pending text[] NOT NULL DEFAULT '{}',
  ADD COLUMN requirements_deadline timestamptz,
  ADD COLUMN disconnected_at timestamptz;

CREATE TABLE public.venue_payment_oauth_states (
  state_hash text PRIMARY KEY CHECK (length(state_hash)=64),
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  livemode boolean NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT now()+interval '10 minutes',
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.venue_payment_oauth_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.venue_payment_oauth_states FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.venue_payment_oauth_states TO service_role;
CREATE INDEX venue_payment_oauth_expiry ON public.venue_payment_oauth_states(expires_at);

-- A Stripe response is not authority to replace the financial owner or account.
-- Lock the venue while binding, and preserve the one-account-per-venue invariant.
CREATE FUNCTION public.payment_link_venue_account(p_venue uuid,p_owner uuid,p_live boolean,p_account text)
RETURNS public.venue_payment_accounts LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.venues; a public.venue_payment_accounts;
BEGIN
  SELECT * INTO v FROM public.venues WHERE id=p_venue FOR UPDATE;
  IF v.id IS NULL OR v.owner_id IS DISTINCT FROM p_owner OR v.verification_approved_at IS NULL THEN
    RAISE EXCEPTION 'Only the verified current venue owner can connect payments';
  END IF;
  IF EXISTS(SELECT 1 FROM public.private_venue_sandboxes WHERE venue_id=p_venue) THEN RAISE EXCEPTION 'Billing is disabled for private sample venues'; END IF;
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
REVOKE ALL ON FUNCTION public.payment_link_venue_account(uuid,uuid,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.payment_link_venue_account(uuid,uuid,boolean,text) TO service_role;

-- The original quote keeps price, membership, opening hours, hold and overlap
-- validation. Wrap it with current card capability and disconnect safeguards.
ALTER FUNCTION public.payment_court_quote(uuid,uuid,uuid,timestamptz,timestamptz,boolean) RENAME TO payment_court_quote_base;
CREATE FUNCTION public.payment_court_quote(p_buyer uuid,p_group uuid,p_court uuid,p_start timestamptz,p_end timestamptz,p_live boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE q jsonb; a public.venue_payment_accounts;
BEGIN
  q:=public.payment_court_quote_base(p_buyer,p_group,p_court,p_start,p_end,p_live);
  SELECT * INTO a FROM public.venue_payment_accounts WHERE venue_id=(q->>'venue_id')::uuid AND livemode=p_live;
  IF NOT a.card_payments_active OR a.disconnected_at IS NOT NULL OR a.disabled_reason IS NOT NULL THEN
    RAISE EXCEPTION 'This venue must finish its Stripe payment requirements';
  END IF;
  RETURN q;
END $$;
REVOKE ALL ON FUNCTION public.payment_court_quote(uuid,uuid,uuid,timestamptz,timestamptz,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.payment_court_quote(uuid,uuid,uuid,timestamptz,timestamptz,boolean) TO service_role;

-- Financial ownership is separate from community ownership, including refunds.
ALTER FUNCTION public.payment_cancel_reservation(uuid,uuid,text,text) RENAME TO payment_cancel_reservation_base;
CREATE FUNCTION public.payment_cancel_reservation(p_order uuid,p_owner uuid,p_note text,p_decision text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.payment_orders;
BEGIN
  SELECT * INTO o FROM public.payment_orders WHERE id=p_order;
  IF p_decision='refund_pending' AND NOT EXISTS(
    SELECT 1 FROM public.venue_payment_accounts a JOIN public.venues v ON v.id=a.venue_id
    WHERE a.venue_id=o.venue_id AND a.account_id=o.account_id AND a.livemode=o.livemode
      AND a.connected_by=p_owner AND v.owner_id=p_owner AND a.disconnected_at IS NULL
  ) THEN RAISE EXCEPTION 'Financial ownership review is required before refunding this payment'; END IF;
  PERFORM public.payment_cancel_reservation_base(p_order,p_owner,p_note,p_decision);
END $$;
REVOKE ALL ON FUNCTION public.payment_cancel_reservation(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.payment_cancel_reservation(uuid,uuid,text,text) TO service_role;

ALTER FUNCTION public.payment_save_venue(uuid,uuid,boolean,text,text,text,jsonb) RENAME TO payment_save_venue_base;
CREATE FUNCTION public.payment_save_venue(p_user uuid,p_venue uuid,p_accepting boolean,p_policy text,p_email text,p_timezone text,p_rates jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  -- Serialize against venue ownership changes before checking financial access.
  PERFORM 1 FROM public.venues WHERE id=p_venue AND owner_id=p_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Only the venue owner may change payment settings'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_rates) rate WHERE (rate->>'cents')::numeric>0 AND (rate->>'cents')::numeric<100) THEN
    RAISE EXCEPTION 'Paid court prices must be at least $1 per hour; use 0 for free';
  END IF;
  IF p_accepting AND (NOT public.venue_has_module(p_venue,'court_booking') OR NOT EXISTS(
    SELECT 1 FROM public.venue_payment_accounts a JOIN public.venues v ON v.id=a.venue_id
    WHERE a.venue_id=p_venue AND a.livemode AND a.connected_by=p_user AND v.verification_approved_at IS NOT NULL
      AND a.charges_enabled AND a.payouts_enabled AND a.card_payments_active AND a.disconnected_at IS NULL AND a.disabled_reason IS NULL
  )) THEN RAISE EXCEPTION 'Finish venue verification, court booking access and Stripe setup before enabling collections'; END IF;
  PERFORM public.payment_save_venue_base(p_user,p_venue,p_accepting,p_policy,p_email,p_timezone,p_rates);
  -- The calendar and authoritative checkout quote must use the same time zone.
  UPDATE public.venues SET timezone=p_timezone WHERE id=p_venue;
  IF p_accepting AND NOT EXISTS(SELECT 1 FROM public.venue_courts WHERE venue_id=p_venue AND is_active IS DISTINCT FROM false AND hourly_rate>=1) THEN
    RAISE EXCEPTION 'Set a price on at least one active court before enabling collections';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.payment_save_venue(uuid,uuid,boolean,text,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.payment_save_venue(uuid,uuid,boolean,text,text,text,jsonb) TO service_role;

-- Pausing collections or saving a paid-rate draft must never silently make a
-- priced court free. Existing reservations and staff program allocations stay.
CREATE FUNCTION public.guard_configured_court_price() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.venue_courts;
BEGIN
  IF NEW.venue_court_id IS NULL OR current_setting('role',true) NOT IN ('authenticated','anon') THEN RETURN NEW; END IF;
  SELECT * INTO c FROM public.venue_courts WHERE id=NEW.venue_court_id FOR UPDATE;
  IF coalesce(c.hourly_rate,0)<=0 OR NOT EXISTS(SELECT 1 FROM public.venue_payment_settings WHERE venue_id=c.venue_id) THEN RETURN NEW; END IF;
  IF NEW.event_format='reservation' THEN
    IF TG_OP='INSERT' OR (NEW.venue_court_id,NEW.start_time,NEW.end_time,NEW.event_format) IS DISTINCT FROM (OLD.venue_court_id,OLD.start_time,OLD.end_time,OLD.event_format) THEN
      IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Paid court reservations cannot be rescheduled directly; use secure checkout'; END IF;
      RAISE EXCEPTION 'This priced court requires secure checkout. Paused payments do not make the court free';
    END IF;
  ELSIF NOT EXISTS(SELECT 1 FROM public.venues WHERE id=c.venue_id AND owner_id=auth.uid())
    AND NOT EXISTS(SELECT 1 FROM public.venue_staff WHERE venue_id=c.venue_id AND user_id=auth.uid() AND is_active=true AND status='active' AND role IN ('owner','manager','staff')) THEN
    RAISE EXCEPTION 'Only venue staff may allocate a priced court outside rental checkout';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_priced_court_configuration BEFORE INSERT OR UPDATE ON public.group_events FOR EACH ROW EXECUTE FUNCTION public.guard_configured_court_price();

UPDATE public.venues v SET timezone=s.timezone FROM public.venue_payment_settings s
WHERE s.venue_id=v.id AND v.timezone IS DISTINCT FROM s.timezone
  AND EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=s.timezone);

COMMIT;
