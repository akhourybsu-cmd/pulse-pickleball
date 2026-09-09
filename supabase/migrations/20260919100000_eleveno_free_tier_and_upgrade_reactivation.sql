-- User-requested reset of the ELEVENO test venue, plus safe paid reactivation.
-- No courts, events, posts, members, staff, ownership or verification are deleted/changed.
-- No Stripe subscriptions are canceled and no charging is enabled.
BEGIN;

CREATE OR REPLACE FUNCTION public.payment_apply_result(p_order uuid,p_account text,p_live boolean,p_session text,p_status text,p_amount integer,p_currency text,p_intent text,p_customer text,p_subscription text DEFAULT NULL,p_paid_through timestamptz DEFAULT NULL)
RETURNS public.payment_orders LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.payment_orders;
BEGIN
  SELECT * INTO o FROM public.payment_orders WHERE id=p_order FOR UPDATE;
  IF NOT FOUND OR o.account_id IS DISTINCT FROM p_account OR o.livemode IS DISTINCT FROM p_live
    OR o.amount_cents IS DISTINCT FROM p_amount OR o.currency IS DISTINCT FROM p_currency
    OR (o.checkout_session_id IS NOT NULL AND o.checkout_session_id IS DISTINCT FROM p_session)
    OR (o.customer_id IS NOT NULL AND o.customer_id IS DISTINCT FROM p_customer) THEN RAISE EXCEPTION 'Payment verification mismatch'; END IF;
  IF p_status NOT IN ('paid','expired') THEN RAISE EXCEPTION 'Only confirmed terminal processor states may fulfill or release an order'; END IF;
  IF o.status<>'pending' THEN RETURN o; END IF;
  IF p_status='paid' THEN
    IF p_intent IS NULL THEN RAISE EXCEPTION 'A successful payment reference is required'; END IF;
    IF o.billing_cadence='monthly' AND (p_subscription IS NULL OR p_paid_through IS NULL) THEN RAISE EXCEPTION 'Subscription paid period is required'; END IF;
    IF o.kind='court_rental' AND o.livemode THEN
      INSERT INTO public.group_events(group_id,venue_id,venue_court_id,created_by,title,start_time,end_time,event_format,location_type,payment_order_id)
        VALUES(o.group_id,o.venue_id,o.court_id,o.buyer_id,o.description,o.start_time,o.end_time,'reservation','venue',o.id);
    ELSIF o.kind='venue_module' AND o.livemode THEN
      INSERT INTO public.venue_module_access(venue_id,module_key,source,enabled,expires_at) VALUES(o.venue_id,o.module_key,'subscription',true,p_paid_through)
        ON CONFLICT(venue_id,module_key) DO UPDATE SET source='subscription',enabled=true,expires_at=EXCLUDED.expires_at,updated_at=now()
        WHERE venue_module_access.source='subscription' OR NOT venue_module_access.enabled OR venue_module_access.expires_at<=now();
      -- A disabled/expired legacy or staff grant can become a paid subscription.
      -- An active included grant is preserved, never converted into a paid one.
    END IF;
    IF p_subscription IS NOT NULL THEN
      INSERT INTO public.payment_subscriptions(subscription_id,order_id,venue_id,module_key,buyer_id,account_id,livemode,status,paid_through)
        VALUES(p_subscription,o.id,o.venue_id,o.module_key,o.buyer_id,o.account_id,o.livemode,'active',p_paid_through) ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  UPDATE public.payment_orders SET status=p_status,checkout_session_id=p_session,payment_intent_id=p_intent,customer_id=p_customer,subscription_id=p_subscription,
    paid_at=CASE WHEN p_status='paid' THEN now() END,updated_at=now() WHERE id=o.id RETURNING * INTO o;
  RETURN o;
END $$;
REVOKE ALL ON FUNCTION public.payment_apply_result(uuid,text,boolean,text,text,integer,text,text,text,text,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.payment_apply_result(uuid,text,boolean,text,text,integer,text,text,text,text,timestamptz) TO service_role;

DO $$
DECLARE target uuid := '4ee96566-4074-41c0-aa2b-2d767bdb50e1'; target_name text;
BEGIN
  SELECT name INTO target_name FROM public.venues WHERE id=target FOR UPDATE;
  IF NOT FOUND THEN
    RAISE NOTICE 'ELEVENO test venue is absent in this environment; data reset skipped';
    RETURN;
  END IF;
  IF target_name<>'ELEVENO' OR NOT EXISTS (
    SELECT 1 FROM public.groups WHERE id='e3e97754-ac66-4814-94f3-ae3391de4e33' AND venue_id=target
  ) THEN RAISE EXCEPTION 'ELEVENO reset target mismatch; no changes applied'; END IF;
  IF EXISTS (SELECT 1 FROM public.payment_orders WHERE venue_id=target AND livemode AND status NOT IN ('expired','refunded'))
    OR EXISTS (SELECT 1 FROM public.payment_subscriptions WHERE venue_id=target AND livemode AND status NOT IN ('canceled','incomplete_expired'))
    OR EXISTS (SELECT 1 FROM public.venue_module_access WHERE venue_id=target AND source='subscription' AND enabled AND (expires_at IS NULL OR expires_at>now()))
  THEN RAISE EXCEPTION 'Review ELEVENO paid orders/subscriptions before resetting access'; END IF;

  -- Preserve the original grant rows as a record; revoke only their capability.
  UPDATE public.venue_module_access SET enabled=false,updated_at=now() WHERE venue_id=target;
  UPDATE public.venue_payment_settings SET accepting_payments=false,updated_at=now() WHERE venue_id=target;
  UPDATE public.venues SET community_model='free_verified' WHERE id=target;
  -- community_model is the free-community product model, not verification status.
END $$;

COMMIT;
