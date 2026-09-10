-- Fresh, merchant-scoped refund snapshots. No charges, refunds or bookings
-- are created by this migration. Existing rows are repaired by reconciliation.
BEGIN;

ALTER TABLE public.payment_orders
  ADD COLUMN refund_state text NOT NULL DEFAULT 'none' CHECK (refund_state IN ('none','pending','failed')),
  ADD COLUMN refund_attempts jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN refund_sync_version bigint NOT NULL DEFAULT 0,
  ADD COLUMN refund_sync_started_at timestamptz,
  ADD COLUMN refund_checked_at timestamptz;
ALTER TABLE public.payment_cancellation_requests DROP CONSTRAINT payment_cancellation_requests_status_check;
ALTER TABLE public.payment_cancellation_requests ADD CONSTRAINT payment_cancellation_requests_status_check
  CHECK (status IN ('requested','refund_pending','refund_failed','approved','declined'));
ALTER TABLE public.payment_cancellation_requests ADD COLUMN refund_review_only boolean NOT NULL DEFAULT false;
CREATE INDEX payment_refund_recovery_queue ON public.payment_orders(livemode,refund_sync_started_at)
  WHERE payment_intent_id IS NOT NULL AND status IN ('paid','partially_refunded','refunded');

-- Claim BEFORE fetching Stripe. Only the latest-started read may commit.
-- Older webhook payload timestamps are not a version of the current refund.
CREATE FUNCTION public.payment_begin_refund_sync(p_account text,p_live boolean,p_intent text)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE version bigint;
BEGIN
  UPDATE payment_orders SET refund_sync_version=refund_sync_version+1,refund_sync_started_at=clock_timestamp()
    WHERE account_id=p_account AND livemode=p_live AND payment_intent_id=p_intent
      AND status IN ('paid','partially_refunded','refunded')
    RETURNING refund_sync_version INTO version;
  RETURN version;
END $$;

CREATE FUNCTION public.payment_apply_refund_snapshot(p_account text,p_live boolean,p_intent text,p_version bigint,p_amount integer,p_attempts jsonb,p_disputed boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o payment_orders; total integer; pending boolean; failed boolean; state text;
BEGIN
  SELECT * INTO o FROM payment_orders WHERE account_id=p_account AND livemode=p_live AND payment_intent_id=p_intent FOR UPDATE;
  IF NOT FOUND OR p_version IS NULL OR p_version<1 OR p_version<>o.refund_sync_version OR o.status NOT IN ('paid','partially_refunded','refunded') THEN RETURN false; END IF;
  IF p_amount IS DISTINCT FROM o.amount_cents OR p_disputed IS NULL OR p_attempts IS NULL OR jsonb_typeof(p_attempts)<>'array' THEN
    RAISE EXCEPTION 'Invalid refund snapshot';
  END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_attempts) a WHERE
    jsonb_typeof(a)<>'object' OR coalesce(a->>'id','')!~'^(re_|pyr_)[A-Za-z0-9]+$'
    OR coalesce(a->>'status','') NOT IN ('pending','requires_action','succeeded','failed','canceled')
    OR coalesce(a->>'amount','')!~'^[1-9][0-9]*$' OR (a->>'amount')::numeric>o.amount_cents)
    OR (SELECT count(*)<>count(DISTINCT a->>'id') FROM jsonb_array_elements(p_attempts) a) THEN
    RAISE EXCEPTION 'Invalid refund attempts';
  END IF;
  SELECT coalesce(sum((a->>'amount')::integer) FILTER (WHERE a->>'status'='succeeded'),0),
    coalesce(bool_or(a->>'status' IN ('pending','requires_action')),false),
    coalesce(bool_or(a->>'status' IN ('failed','canceled')),false)
    INTO total,pending,failed FROM jsonb_array_elements(p_attempts) a;
  IF total>o.amount_cents THEN RAISE EXCEPTION 'Refund verification mismatch'; END IF;
  -- A formerly succeeded refund may fail, or need further action, later.
  state:=CASE WHEN total=o.amount_cents THEN 'none' WHEN pending THEN 'pending' WHEN failed THEN 'failed' ELSE 'none' END;
  UPDATE payment_orders SET refunded_cents=total,disputed=p_disputed,
    status=CASE WHEN total=amount_cents THEN 'refunded' WHEN total>0 THEN 'partially_refunded' ELSE 'paid' END,
    refund_state=state,refund_attempts=coalesce((SELECT jsonb_agg(jsonb_build_object('id',a->>'id','amount',(a->>'amount')::integer,'status',a->>'status')) FROM jsonb_array_elements(p_attempts) a),'[]'::jsonb),
    refund_checked_at=clock_timestamp(),updated_at=now() WHERE id=o.id;
  IF o.kind='court_rental' THEN
    IF state='failed' THEN
      INSERT INTO payment_cancellation_requests(order_id,buyer_id,venue_id,note,status,refund_review_only)
        VALUES(o.id,o.buyer_id,o.venue_id,'Stripe reported an unsuccessful refund. Review the payment and contact the player.','refund_failed',true)
        ON CONFLICT(order_id) DO UPDATE SET status='refund_failed',updated_at=now();
    ELSIF state='pending' THEN
      UPDATE payment_cancellation_requests SET status='refund_pending',updated_at=now()
        WHERE order_id=o.id AND status IN ('approved','refund_failed');
    ELSIF total=o.amount_cents AND EXISTS(SELECT 1 FROM payment_cancellation_requests WHERE order_id=o.id AND status IN ('refund_pending','refund_failed')) THEN
      IF EXISTS(SELECT 1 FROM payment_cancellation_requests WHERE order_id=o.id AND NOT refund_review_only) THEN
        DELETE FROM group_events WHERE payment_order_id=o.id;
        UPDATE payment_orders SET canceled_at=coalesce(canceled_at,now()) WHERE id=o.id;
      END IF;
      UPDATE payment_cancellation_requests SET status='approved',updated_at=now() WHERE order_id=o.id;
    END IF;
    -- Never re-create a canceled booking: another player may now hold the court.
  END IF;
  IF total=o.amount_cents AND o.kind='venue_module' AND o.livemode THEN
    UPDATE venue_module_access SET enabled=false,updated_at=now() WHERE venue_id=o.venue_id AND module_key=o.module_key AND source='subscription'
      AND NOT EXISTS(SELECT 1 FROM payment_orders newer WHERE newer.venue_id=o.venue_id AND newer.module_key=o.module_key AND newer.livemode AND newer.status='paid' AND newer.created_at>o.created_at);
  END IF;
  RETURN true;
END $$;

-- A completed external refund review is not a player's cancellation request.
CREATE OR REPLACE FUNCTION public.payment_request_cancellation(p_order uuid,p_buyer uuid,p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o payment_orders;
BEGIN
  SELECT * INTO o FROM payment_orders WHERE id=p_order AND buyer_id=p_buyer AND kind='court_rental' AND status IN ('paid','partially_refunded','refunded') FOR UPDATE;
  IF NOT FOUND OR o.canceled_at IS NOT NULL THEN RAISE EXCEPTION 'No cancellable reservation found'; END IF;
  IF p_note IS NULL OR length(p_note) NOT BETWEEN 5 AND 1000 THEN RAISE EXCEPTION 'Please give the venue a short reason (5–1000 characters)'; END IF;
  INSERT INTO payment_cancellation_requests(order_id,buyer_id,venue_id,note) VALUES(o.id,o.buyer_id,o.venue_id,p_note)
    ON CONFLICT(order_id) DO UPDATE SET note=p_note,status='requested',refund_review_only=false,resolution_note=NULL,resolved_by=NULL,updated_at=now()
    WHERE payment_cancellation_requests.refund_review_only AND payment_cancellation_requests.status='approved';
END $$;

-- Old Edge versions must retry, not overwrite a fresh failed-refund snapshot.
REVOKE ALL ON FUNCTION public.payment_record_charge(text,boolean,text,integer,boolean) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.payment_begin_refund_sync(text,boolean,text),public.payment_apply_refund_snapshot(text,boolean,text,bigint,integer,jsonb,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.payment_begin_refund_sync(text,boolean,text),public.payment_apply_refund_snapshot(text,boolean,text,bigint,integer,jsonb,boolean) TO service_role;
COMMIT;
