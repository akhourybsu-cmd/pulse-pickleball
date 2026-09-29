BEGIN;
ALTER TABLE payment_subscriptions ADD COLUMN cancel_requested_by uuid REFERENCES auth.users(id),ADD COLUMN cancel_requested_at timestamptz;
CREATE TABLE public.venue_equipment_returns (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),venue_id uuid NOT NULL REFERENCES venues(id),sale_id uuid NOT NULL REFERENCES venue_sales(id),
 quantity integer NOT NULL CHECK(quantity>0),actor_id uuid NOT NULL REFERENCES auth.users(id),request_key uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(sale_id,request_key)
);
ALTER TABLE venue_equipment_returns ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON venue_equipment_returns FROM PUBLIC,anon,authenticated;
GRANT ALL ON venue_equipment_returns TO service_role;
CREATE POLICY pulse_required_mfa ON venue_equipment_returns AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT pulse_has_required_mfa())) WITH CHECK ((SELECT pulse_has_required_mfa()));
CREATE FUNCTION public.venue_equipment_return(p_sale uuid,p_quantity integer,p_request uuid,p_returned boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s venue_sales;r venue_equipment_returns;returned integer;
BEGIN
 SELECT * INTO s FROM venue_sales WHERE id=p_sale FOR UPDATE;
 IF NOT FOUND OR NOT venue_desk_access(s.venue_id) THEN RAISE EXCEPTION 'Venue desk access required' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM venue_equipment_returns WHERE sale_id=p_sale AND request_key=p_request;
 IF FOUND THEN IF r.quantity IS DISTINCT FROM p_quantity THEN RAISE EXCEPTION 'Return request changed'; END IF; RETURN; END IF;
 SELECT coalesce(sum(quantity),0) INTO returned FROM venue_equipment_returns WHERE sale_id=p_sale;
 IF p_returned IS DISTINCT FROM true OR s.product_kind<>'equipment_rental' OR s.status NOT IN ('paid','partially_refunded','refunded') OR p_quantity IS NULL OR p_quantity<1 OR p_quantity>s.quantity-returned THEN RAISE EXCEPTION 'Confirm the quantity physically returned to the venue'; END IF;
 INSERT INTO venue_equipment_returns(venue_id,sale_id,quantity,actor_id,request_key) VALUES(s.venue_id,s.id,p_quantity,auth.uid(),p_request);
 UPDATE venue_products SET stock=stock+p_quantity,updated_at=clock_timestamp() WHERE id=s.product_id AND stock IS NOT NULL;
END $$;
ALTER FUNCTION venue_desk_workspace(uuid,date,uuid) RENAME TO venue_desk_workspace_before_returns;
CREATE FUNCTION venue_desk_workspace(p_venue uuid,p_day date,p_customer uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
 result:=venue_desk_workspace_before_returns(p_venue,p_day,p_customer);
 RETURN result||jsonb_build_object('memberships',coalesce((SELECT jsonb_agg(to_jsonb(m) ORDER BY first_name,last_name) FROM (
  SELECT s.subscription_id,s.status,s.paid_through,s.cancel_at_period_end,c.first_name,c.last_name,v.product_name,v.customer_id FROM payment_subscriptions s JOIN payment_orders o ON o.id=s.order_id JOIN venue_sales v ON v.id=o.venue_sale_id JOIN venue_customers c ON c.id=v.customer_id WHERE s.venue_id=p_venue AND s.livemode AND v.product_kind='membership' AND (p_customer IS NULL OR c.id=p_customer) ORDER BY c.first_name,c.last_name LIMIT 500)m),'[]'::jsonb),
 'equipment',coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY paid_at) FROM (
  SELECT s.id,s.customer_id,s.product_name,s.quantity,s.quantity-coalesce((SELECT sum(quantity) FROM venue_equipment_returns WHERE sale_id=s.id),0) outstanding,c.first_name,c.last_name,s.paid_at FROM venue_sales s JOIN venue_customers c ON c.id=s.customer_id WHERE s.venue_id=p_venue AND s.product_kind='equipment_rental' AND s.paid_at IS NOT NULL AND (p_customer IS NULL OR c.id=p_customer) AND s.quantity>coalesce((SELECT sum(quantity) FROM venue_equipment_returns WHERE sale_id=s.id),0) ORDER BY paid_at LIMIT 500)e),'[]'::jsonb));
END $$;
ALTER FUNCTION venue_sale_receipt(uuid) RENAME TO venue_sale_receipt_before_booking_status;
CREATE FUNCTION venue_sale_receipt(p_token uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE s venue_sales;status text;result jsonb;
BEGIN
 result:=venue_sale_receipt_before_booking_status(p_token);
 SELECT * INTO s FROM venue_sales WHERE receipt_token=p_token;
 IF s.appointment_id IS NOT NULL THEN SELECT a.status INTO status FROM venue_appointments a WHERE id=s.appointment_id;
 ELSIF s.visit_id IS NOT NULL THEN SELECT v.status INTO status FROM venue_visits v WHERE id=s.visit_id; END IF;
 RETURN result||jsonb_build_object('booking_status',status,'refund_review',s.needs_refund_review);
END $$;
REVOKE ALL ON FUNCTION venue_equipment_return(uuid,integer,uuid,boolean),venue_desk_workspace_before_returns(uuid,date,uuid),venue_desk_workspace(uuid,date,uuid),venue_sale_receipt_before_booking_status(uuid),venue_sale_receipt(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION venue_equipment_return(uuid,integer,uuid,boolean),venue_desk_workspace(uuid,date,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION venue_sale_receipt(uuid) TO anon,authenticated;
COMMIT;
