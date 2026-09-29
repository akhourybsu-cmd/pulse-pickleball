BEGIN;
-- Provider credentials remain server-only in Vault. Existing Stripe accounts,
-- platform subscriptions and historical orders keep their original destination.
CREATE TABLE public.venue_processor_connections (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), venue_id uuid NOT NULL REFERENCES venues(id),
 provider text NOT NULL CHECK(provider IN ('square','clover','paypal','authorize_net','adyen')),
 livemode boolean NOT NULL, merchant_id text NOT NULL, merchant_name text NOT NULL,
 location_id text, location_name text, connected_by uuid NOT NULL REFERENCES auth.users(id),
 secret_id uuid NOT NULL, token_expires_at timestamptz NOT NULL, version uuid NOT NULL DEFAULT gen_random_uuid(),
 status text NOT NULL DEFAULT 'needs_attention' CHECK(status IN ('connected','needs_attention','paused')),
 updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(venue_id,provider,livemode),
 UNIQUE(provider,livemode,merchant_id,location_id)
);
CREATE TABLE public.venue_processor_oauth_states (
 state_hash text PRIMARY KEY, venue_id uuid NOT NULL REFERENCES venues(id), actor_id uuid NOT NULL REFERENCES auth.users(id),
 provider text NOT NULL CHECK(provider='square'), livemode boolean NOT NULL,
 expires_at timestamptz NOT NULL DEFAULT now()+interval '10 minutes'
);
CREATE TABLE public.venue_processor_preferences (
 venue_id uuid PRIMARY KEY REFERENCES venues(id), desk_provider text NOT NULL DEFAULT 'stripe' CHECK(desk_provider IN ('stripe','square')),
 updated_by uuid NOT NULL REFERENCES auth.users(id), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.venue_processor_requests (
 venue_id uuid NOT NULL REFERENCES venues(id), provider text NOT NULL CHECK(provider IN ('clover','paypal','authorize_net','adyen')),
 requested_by uuid NOT NULL REFERENCES auth.users(id), created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(venue_id,provider)
);
ALTER TABLE payment_orders ADD COLUMN provider text NOT NULL DEFAULT 'stripe' CHECK(provider IN ('stripe','square')),
 ADD COLUMN processor_connection_id uuid REFERENCES venue_processor_connections(id),
 ADD COLUMN processor_order_id text, ADD COLUMN processor_checkout_url text, ADD COLUMN processor_checked_at timestamptz;
ALTER TABLE venue_sales ADD COLUMN payment_provider text NOT NULL DEFAULT 'stripe' CHECK(payment_provider IN ('stripe','square'));
ALTER TABLE payment_orders ADD CONSTRAINT payment_processor_destination CHECK (
 (provider='stripe' AND processor_connection_id IS NULL AND account_id NOT LIKE 'square:%') OR
 (provider='square' AND processor_connection_id IS NOT NULL AND account_id='square:'||processor_connection_id::text AND kind='venue_sale' AND billing_cadence='one_time')
);
CREATE INDEX payment_processor_recovery ON payment_orders(provider,processor_checked_at) WHERE provider='square' AND status IN ('pending','paid','partially_refunded','refunded');
CREATE UNIQUE INDEX payment_processor_order ON payment_orders(processor_connection_id,processor_order_id) WHERE processor_order_id IS NOT NULL;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['venue_processor_connections','venue_processor_oauth_states','venue_processor_preferences','venue_processor_requests'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
  EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
  EXECUTE format('CREATE POLICY pulse_required_mfa ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT pulse_has_required_mfa())) WITH CHECK ((SELECT pulse_has_required_mfa()))',t);
 END LOOP;
END $$;

CREATE FUNCTION public.venue_processor_owner(p_venue uuid,p_actor uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF p_actor IS NULL OR NOT EXISTS(SELECT 1 FROM venues WHERE id=p_venue AND owner_id=p_actor AND verification_approved_at IS NOT NULL AND is_active IS DISTINCT FROM false)
 OR EXISTS(SELECT 1 FROM private_venue_sandboxes WHERE venue_id=p_venue) THEN RAISE EXCEPTION 'Verified venue owner access required' USING ERRCODE='42501'; END IF;
END $$;
CREATE FUNCTION public.venue_processor_workspace(p_venue uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT pulse_has_required_mfa() OR NOT EXISTS(SELECT 1 FROM venues WHERE id=p_venue AND owner_id=auth.uid()) THEN RAISE EXCEPTION 'Venue owner access required' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('connections',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'provider',provider,'merchant_name',merchant_name,'location_id',location_id,'location_name',location_name,'status',status,'connected_by',connected_by,'updated_at',updated_at,'livemode',livemode)) FROM venue_processor_connections WHERE venue_id=p_venue),'[]'::jsonb),
 'desk_provider',coalesce((SELECT desk_provider FROM venue_processor_preferences WHERE venue_id=p_venue),'stripe'),'online_provider','stripe',
 'stripe_connected',EXISTS(SELECT 1 FROM venue_payment_accounts a JOIN venues v ON v.id=a.venue_id WHERE a.venue_id=p_venue AND a.livemode AND a.connected_by=v.owner_id AND a.charges_enabled AND a.payouts_enabled AND a.card_payments_active AND a.disconnected_at IS NULL AND a.disabled_reason IS NULL),
 'requests',coalesce((SELECT jsonb_agg(provider) FROM venue_processor_requests WHERE venue_id=p_venue),'[]'::jsonb));
END $$;

CREATE FUNCTION public.venue_processor_consume_state(p_hash text,p_actor uuid,p_venue uuid,p_live boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM venue_processor_owner(p_venue,p_actor);
 DELETE FROM venue_processor_oauth_states WHERE state_hash=p_hash AND actor_id=p_actor AND venue_id=p_venue AND livemode=p_live AND expires_at>now();
 IF NOT FOUND THEN RAISE EXCEPTION 'Connection expired. Start the connection again.'; END IF;
END $$;
CREATE FUNCTION public.venue_processor_store_square(p_venue uuid,p_actor uuid,p_live boolean,p_merchant text,p_name text,p_credentials text,p_expires timestamptz) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,vault AS $$
DECLARE c venue_processor_connections; sid uuid;
BEGIN
 PERFORM venue_processor_owner(p_venue,p_actor);
 PERFORM id FROM venues WHERE id=p_venue FOR UPDATE;
 SELECT * INTO c FROM venue_processor_connections WHERE venue_id=p_venue AND provider='square' AND livemode=p_live FOR UPDATE;
 IF c.id IS NOT NULL AND (c.merchant_id<>p_merchant OR c.connected_by<>p_actor) THEN RAISE EXCEPTION 'This venue already has a different payment owner or merchant. Contact PULSE for a financial account transfer.'; END IF;
 IF length(coalesce(p_credentials,''))<20 OR p_expires<=now() OR coalesce(p_merchant,'')='' THEN RAISE EXCEPTION 'Square did not return a valid connection'; END IF;
 IF c.id IS NULL THEN
  sid:=vault.create_secret(p_credentials,'venue-processor-'||gen_random_uuid());
  INSERT INTO venue_processor_connections(venue_id,provider,livemode,merchant_id,merchant_name,connected_by,secret_id,token_expires_at)
  VALUES(p_venue,'square',p_live,p_merchant,left(p_name,200),p_actor,sid,p_expires) RETURNING * INTO c;
 ELSE
  PERFORM vault.update_secret(c.secret_id,p_credentials);
  UPDATE venue_processor_connections SET merchant_name=left(p_name,200),token_expires_at=p_expires,version=gen_random_uuid(),status='needs_attention',updated_at=clock_timestamp() WHERE id=c.id;
 END IF;
 RETURN c.id;
END $$;
CREATE FUNCTION public.venue_processor_credentials(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,vault AS $$
DECLARE c venue_processor_connections; secret text;
BEGIN
 SELECT * INTO c FROM venue_processor_connections WHERE id=p_id;
 IF c.id IS NULL THEN RAISE EXCEPTION 'Payment connection unavailable'; END IF;
 SELECT decrypted_secret INTO secret FROM vault.decrypted_secrets WHERE id=c.secret_id;
 RETURN jsonb_build_object('connection',to_jsonb(c)-'secret_id','credentials',secret::jsonb);
END $$;
CREATE FUNCTION public.venue_processor_refresh_token(p_id uuid,p_version uuid,p_credentials text,p_expires timestamptz) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,vault AS $$
DECLARE c venue_processor_connections;
BEGIN
 SELECT * INTO c FROM venue_processor_connections WHERE id=p_id FOR UPDATE;
 IF c.version IS DISTINCT FROM p_version THEN RETURN false; END IF;
 IF p_expires<=now() OR length(coalesce(p_credentials,''))<20 THEN RAISE EXCEPTION 'Invalid refreshed connection'; END IF;
 PERFORM vault.update_secret(c.secret_id,p_credentials);
 UPDATE venue_processor_connections SET token_expires_at=p_expires,version=gen_random_uuid(),updated_at=clock_timestamp() WHERE id=c.id;
 RETURN true;
END $$;
CREATE FUNCTION public.venue_processor_select_location(p_id uuid,p_actor uuid,p_location text,p_name text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c venue_processor_connections;
BEGIN
 SELECT * INTO c FROM venue_processor_connections WHERE id=p_id FOR UPDATE;
 PERFORM venue_processor_owner(c.venue_id,p_actor);
 IF c.connected_by IS DISTINCT FROM p_actor OR coalesce(p_location,'')='' THEN RAISE EXCEPTION 'Payment owner or location does not match'; END IF;
 IF c.location_id IS DISTINCT FROM p_location AND EXISTS(SELECT 1 FROM payment_orders WHERE processor_connection_id=c.id) THEN RAISE EXCEPTION 'This location has payment history. Contact PULSE to transfer locations without losing refund access.'; END IF;
 UPDATE venue_processor_connections SET location_id=p_location,location_name=left(p_name,200),status='connected',updated_at=clock_timestamp() WHERE id=c.id;
END $$;
CREATE FUNCTION public.venue_processor_set_desk(p_venue uuid,p_actor uuid,p_provider text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM venue_processor_owner(p_venue,p_actor);
 IF p_provider IS NULL OR p_provider NOT IN ('stripe','square') THEN RAISE EXCEPTION 'Choose a supported desk payment provider'; END IF;
 IF p_provider='square' AND NOT EXISTS(SELECT 1 FROM venue_processor_connections WHERE venue_id=p_venue AND provider='square' AND livemode AND connected_by=p_actor AND status='connected' AND location_id IS NOT NULL AND token_expires_at>now()) THEN RAISE EXCEPTION 'Connect and verify a live Square location first'; END IF;
 IF p_provider='stripe' AND NOT EXISTS(SELECT 1 FROM venue_payment_accounts WHERE venue_id=p_venue AND livemode AND connected_by=p_actor AND charges_enabled AND payouts_enabled AND card_payments_active AND disconnected_at IS NULL AND disabled_reason IS NULL) THEN RAISE EXCEPTION 'Connect and verify a live Stripe account first'; END IF;
 INSERT INTO venue_processor_preferences(venue_id,desk_provider,updated_by) VALUES(p_venue,p_provider,p_actor)
 ON CONFLICT(venue_id) DO UPDATE SET desk_provider=excluded.desk_provider,updated_by=p_actor,updated_at=clock_timestamp();
END $$;
CREATE FUNCTION public.venue_desk_payment_account(p_venue uuid,p_live boolean,p_recurring boolean DEFAULT false) RETURNS venue_payment_accounts
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a venue_payment_accounts; c venue_processor_connections; owner_id uuid;
BEGIN
 SELECT v.owner_id INTO owner_id FROM venues v WHERE v.id=p_venue;
 IF coalesce((SELECT desk_provider FROM venue_processor_preferences WHERE venue_id=p_venue),'stripe')='square' AND NOT p_recurring THEN
  SELECT * INTO c FROM venue_processor_connections WHERE venue_id=p_venue AND provider='square' AND livemode=p_live AND connected_by=owner_id AND status='connected' AND location_id IS NOT NULL AND token_expires_at>now();
  IF c.id IS NULL THEN RAISE EXCEPTION 'Square needs attention. Reconnect the venue account before collecting payments.'; END IF;
  a.venue_id:=p_venue; a.livemode:=p_live; a.account_id:='square:'||c.id; a.connected_by:=owner_id;
  a.charges_enabled:=true; a.payouts_enabled:=true; a.card_payments_active:=true;
 ELSE
  SELECT * INTO a FROM venue_payment_accounts WHERE venue_id=p_venue AND livemode=p_live AND connected_by=owner_id AND disconnected_at IS NULL AND charges_enabled AND payouts_enabled AND card_payments_active AND disabled_reason IS NULL;
 END IF;
 RETURN a;
END $$;
CREATE FUNCTION public.venue_stamp_payment_provider() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c venue_processor_connections;
BEGIN
 IF TG_OP='UPDATE' AND (NEW.provider,NEW.processor_connection_id,NEW.account_id) IS DISTINCT FROM (OLD.provider,OLD.processor_connection_id,OLD.account_id) THEN RAISE EXCEPTION 'A payment destination is immutable'; END IF;
 IF TG_OP='INSERT' AND NEW.account_id LIKE 'square:%' THEN
  SELECT * INTO c FROM venue_processor_connections WHERE id=substring(NEW.account_id from 8)::uuid;
  IF c.venue_id IS DISTINCT FROM NEW.venue_id OR c.livemode IS DISTINCT FROM NEW.livemode OR NEW.kind<>'venue_sale' OR NEW.billing_cadence<>'one_time' THEN RAISE EXCEPTION 'Unsupported Square payment destination'; END IF;
  NEW.provider:='square'; NEW.processor_connection_id:=c.id;
  UPDATE venue_sales SET payment_provider='square' WHERE id=NEW.venue_sale_id;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER venue_stamp_payment_provider BEFORE INSERT OR UPDATE ON payment_orders FOR EACH ROW EXECUTE FUNCTION venue_stamp_payment_provider();

-- Grants are explicit; no browser can read tokens or impersonate an owner.
REVOKE ALL ON FUNCTION venue_processor_owner(uuid,uuid),venue_processor_workspace(uuid),venue_processor_consume_state(text,uuid,uuid,boolean),venue_processor_store_square(uuid,uuid,boolean,text,text,text,timestamptz),venue_processor_credentials(uuid),venue_processor_refresh_token(uuid,uuid,text,timestamptz),venue_processor_select_location(uuid,uuid,text,text),venue_processor_set_desk(uuid,uuid,text),venue_desk_payment_account(uuid,boolean,boolean),venue_stamp_payment_provider() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION venue_processor_workspace(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION venue_processor_owner(uuid,uuid),venue_processor_consume_state(text,uuid,uuid,boolean),venue_processor_store_square(uuid,uuid,boolean,text,text,text,timestamptz),venue_processor_credentials(uuid),venue_processor_refresh_token(uuid,uuid,text,timestamptz),venue_processor_select_location(uuid,uuid,text,text),venue_processor_set_desk(uuid,uuid,text),venue_desk_payment_account(uuid,boolean,boolean) TO service_role;
COMMIT;
