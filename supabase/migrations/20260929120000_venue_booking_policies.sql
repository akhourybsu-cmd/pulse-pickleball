BEGIN;
CREATE TABLE public.venue_booking_rules (
 venue_id uuid PRIMARY KEY REFERENCES venues(id),minimum_minutes integer NOT NULL DEFAULT 30 CHECK(minimum_minutes BETWEEN 30 AND 240 AND minimum_minutes%30=0),
 maximum_minutes integer NOT NULL DEFAULT 240 CHECK(maximum_minutes BETWEEN 30 AND 240 AND maximum_minutes%30=0),
 booking_days integer NOT NULL DEFAULT 30 CHECK(booking_days BETWEEN 1 AND 180),member_booking_days integer NOT NULL DEFAULT 30 CHECK(member_booking_days BETWEEN 1 AND 180),
 lead_minutes integer NOT NULL DEFAULT 35 CHECK(lead_minutes BETWEEN 35 AND 10080),
 cancellation_hours integer NOT NULL DEFAULT 24 CHECK(cancellation_hours BETWEEN 0 AND 720),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),CHECK(maximum_minutes>=minimum_minutes),CHECK(member_booking_days>=booking_days)
);
CREATE TABLE public.venue_rate_bands (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),venue_id uuid NOT NULL REFERENCES venues(id),court_id uuid REFERENCES venue_courts(id),
 name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 100),days integer[] NOT NULL CHECK(cardinality(days) BETWEEN 1 AND 7 AND days<@ARRAY[0,1,2,3,4,5,6]),
 start_minute integer NOT NULL CHECK(start_minute BETWEEN 0 AND 1439),end_minute integer NOT NULL CHECK(end_minute BETWEEN 1 AND 1440),
 hourly_cents integer NOT NULL CHECK(hourly_cents BETWEEN 100 AND 99999999),CHECK(end_minute>start_minute),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE public.venue_holiday_closures (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),venue_id uuid NOT NULL REFERENCES venues(id),day date NOT NULL,
 reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 3 AND 500),UNIQUE(venue_id,day)
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['venue_booking_rules','venue_rate_bands','venue_holiday_closures'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
  EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
  EXECUTE format('CREATE POLICY pulse_required_mfa ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.pulse_has_required_mfa())) WITH CHECK ((SELECT public.pulse_has_required_mfa()))',t);
 END LOOP;
END $$;
CREATE FUNCTION public.venue_booking_policy_workspace(p_venue uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT venue_desk_access(p_venue) THEN RAISE EXCEPTION 'Venue desk access required' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('can_manage',venue_desk_access(p_venue,true),'rules',(SELECT to_jsonb(r) FROM venue_booking_rules r WHERE venue_id=p_venue),
 'rates',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY name) FROM venue_rate_bands r WHERE venue_id=p_venue),'[]'::jsonb),
 'closures',coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY day) FROM venue_holiday_closures c WHERE venue_id=p_venue AND day>=current_date-30),'[]'::jsonb),
 'courts',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name,'hourly_rate',hourly_rate) ORDER BY court_number) FROM venue_courts WHERE venue_id=p_venue AND is_active),'[]'::jsonb));
END $$;
CREATE FUNCTION public.venue_booking_rules_save(p_venue uuid,p_expected timestamptz,p_rules jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r venue_booking_rules;
BEGIN
 IF NOT venue_desk_access(p_venue,true) THEN RAISE EXCEPTION 'Venue management access required' USING ERRCODE='42501'; END IF;
 PERFORM id FROM venues WHERE id=p_venue FOR UPDATE;
 SELECT * INTO r FROM venue_booking_rules WHERE venue_id=p_venue;
 IF r.updated_at IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Booking rules changed. Refresh before saving.' USING ERRCODE='40001'; END IF;
 INSERT INTO venue_booking_rules(venue_id,minimum_minutes,maximum_minutes,booking_days,member_booking_days,lead_minutes,cancellation_hours)
 VALUES(p_venue,(p_rules->>'minimum_minutes')::integer,(p_rules->>'maximum_minutes')::integer,(p_rules->>'booking_days')::integer,(p_rules->>'member_booking_days')::integer,(p_rules->>'lead_minutes')::integer,(p_rules->>'cancellation_hours')::integer)
 ON CONFLICT(venue_id) DO UPDATE SET minimum_minutes=excluded.minimum_minutes,maximum_minutes=excluded.maximum_minutes,booking_days=excluded.booking_days,member_booking_days=excluded.member_booking_days,lead_minutes=excluded.lead_minutes,cancellation_hours=excluded.cancellation_hours,updated_at=clock_timestamp();
END $$;
CREATE FUNCTION public.venue_rate_save(p_venue uuid,p_id uuid,p_expected timestamptz,p_rate jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r venue_rate_bands;court uuid;selected_days integer[];a integer;b integer;
BEGIN
 IF NOT venue_desk_access(p_venue,true) THEN RAISE EXCEPTION 'Venue management access required' USING ERRCODE='42501'; END IF;
 PERFORM id FROM venues WHERE id=p_venue FOR UPDATE;
 IF p_id IS NOT NULL THEN SELECT * INTO r FROM venue_rate_bands WHERE id=p_id AND venue_id=p_venue FOR UPDATE;
  IF NOT FOUND OR r.updated_at IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Rate changed. Refresh before saving.' USING ERRCODE='40001'; END IF; END IF;
 IF p_rate IS NULL THEN IF p_id IS NULL THEN RAISE EXCEPTION 'Choose a rate'; END IF; DELETE FROM venue_rate_bands WHERE id=r.id; RETURN; END IF;
 court:=(p_rate->>'court_id')::uuid;selected_days:=ARRAY(SELECT value::integer FROM jsonb_array_elements_text(p_rate->'days'));a:=(p_rate->>'start_minute')::integer;b:=(p_rate->>'end_minute')::integer;
 IF court IS NOT NULL AND NOT EXISTS(SELECT 1 FROM venue_courts WHERE id=court AND venue_id=p_venue AND is_active AND hourly_rate>0) THEN RAISE EXCEPTION 'Choose an active court with a base rental price'; END IF;
 IF court IS NULL AND EXISTS(SELECT 1 FROM venue_courts WHERE venue_id=p_venue AND is_active AND coalesce(hourly_rate,0)<=0) THEN RAISE EXCEPTION 'Set a base rental price for each active court in Payments first'; END IF;
 IF EXISTS(SELECT 1 FROM venue_rate_bands WHERE venue_id=p_venue AND id IS DISTINCT FROM p_id AND court_id IS NOT DISTINCT FROM court AND selected_days && venue_rate_bands.days AND a<end_minute AND b>start_minute) THEN RAISE EXCEPTION 'Rate windows overlap. Use a separate time window or court.'; END IF;
 INSERT INTO venue_rate_bands(id,venue_id,court_id,name,days,start_minute,end_minute,hourly_cents)
 VALUES(coalesce(p_id,gen_random_uuid()),p_venue,court,trim(p_rate->>'name'),selected_days,a,b,(p_rate->>'hourly_cents')::integer)
 ON CONFLICT(id) DO UPDATE SET court_id=excluded.court_id,name=excluded.name,days=excluded.days,start_minute=excluded.start_minute,end_minute=excluded.end_minute,hourly_cents=excluded.hourly_cents,updated_at=clock_timestamp();
END $$;
CREATE FUNCTION public.venue_holiday_save(p_venue uuid,p_day date,p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE tz text;a timestamptz;b timestamptz;
BEGIN
 IF NOT venue_desk_access(p_venue,true) THEN RAISE EXCEPTION 'Venue management access required' USING ERRCODE='42501'; END IF;
 PERFORM id FROM venues WHERE id=p_venue FOR UPDATE;
 SELECT coalesce(timezone,'America/New_York') INTO tz FROM venues WHERE id=p_venue;
 IF p_day IS NULL OR NOT isfinite(p_day) OR p_day<(now() AT TIME ZONE tz)::date THEN RAISE EXCEPTION 'Choose today or a future holiday'; END IF;
 IF p_reason IS NULL THEN DELETE FROM venue_holiday_closures WHERE venue_id=p_venue AND day=p_day; RETURN; END IF;
 a:=p_day::timestamp AT TIME ZONE tz;b:=(p_day+1)::timestamp AT TIME ZONE tz;
 PERFORM id FROM venue_courts WHERE venue_id=p_venue ORDER BY id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM group_events WHERE venue_id=p_venue AND venue_court_id IS NOT NULL AND start_time<b AND end_time>a)
 OR EXISTS(SELECT 1 FROM payment_orders WHERE venue_id=p_venue AND livemode AND status='pending' AND start_time<b AND end_time>a) THEN RAISE EXCEPTION 'This day has court allocations or checkouts. Reschedule or cancel them before closing the venue.'; END IF;
 INSERT INTO venue_holiday_closures(venue_id,day,reason) VALUES(p_venue,p_day,trim(p_reason)) ON CONFLICT(venue_id,day) DO UPDATE SET reason=excluded.reason;
END $$;

CREATE FUNCTION public.venue_court_pricing(p_court uuid,p_start timestamptz,p_end timestamptz,p_customer uuid DEFAULT NULL,p_walk_in boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE c venue_courts;v venues;r venue_booking_rules;discount integer;member boolean;mins numeric;total numeric:=0;t timestamptz;local_t timestamp;rate integer;operating_day jsonb;opens integer;closes integer;
BEGIN
 SELECT * INTO c FROM venue_courts WHERE id=p_court;
 SELECT * INTO v FROM venues WHERE id=c.venue_id;
 IF c.id IS NULL OR c.is_active IS FALSE OR v.is_active IS FALSE THEN RAISE EXCEPTION 'Court unavailable'; END IF;
 SELECT * INTO r FROM venue_booking_rules WHERE venue_id=v.id;
 SELECT coalesce(max(member_discount_percent),0),count(*)>0 INTO discount,member FROM venue_entitlements WHERE venue_id=v.id AND customer_id=p_customer AND kind='membership' AND revoked_at IS NULL AND starts_at<=now() AND expires_at>p_end;
 mins:=extract(epoch FROM p_end-p_start)/60;
 IF p_start IS NULL OR p_end IS NULL OR NOT isfinite(p_start) OR NOT isfinite(p_end) OR mins<coalesce(r.minimum_minutes,30) OR mins>coalesce(r.maximum_minutes,240) OR mod(mins,30)<>0 THEN RAISE EXCEPTION 'Choose a duration within the venue limits in 30-minute increments'; END IF;
 IF NOT p_walk_in AND (p_start<now()+make_interval(mins=>coalesce(r.lead_minutes,35)) OR p_start>now()+make_interval(days=>CASE WHEN member THEN coalesce(r.member_booking_days,180) ELSE coalesce(r.booking_days,180) END)) THEN RAISE EXCEPTION 'This time is outside your advance booking window or minimum notice'; END IF;
 IF p_walk_in AND (p_start<now()-interval '15 minutes' OR p_start>now()+interval '180 days') THEN RAISE EXCEPTION 'Choose a current or future booking time'; END IF;
 local_t:=p_start AT TIME ZONE coalesce(v.timezone,'America/New_York');
 operating_day:=v.hours_of_operation->'days'->extract(dow FROM local_t)::integer::text;
 opens:=extract(epoch FROM coalesce((operating_day->>'open')::time,'06:00'::time))/60;
 closes:=CASE WHEN operating_day->>'close'='24:00' THEN 1440 ELSE extract(epoch FROM coalesce((operating_day->>'close')::time,'22:00'::time))/60 END;
 IF operating_day='null'::jsonb OR local_t<date_trunc('day',local_t)+opens*interval '1 minute' OR (p_end AT TIME ZONE coalesce(v.timezone,'America/New_York'))>date_trunc('day',local_t)+closes*interval '1 minute' THEN RAISE EXCEPTION 'Choose a time within venue opening hours'; END IF;
 IF EXISTS(SELECT 1 FROM venue_holiday_closures WHERE venue_id=v.id AND day>=local_t::date AND day<=((p_end-interval '1 microsecond') AT TIME ZONE coalesce(v.timezone,'America/New_York'))::date) THEN RAISE EXCEPTION 'The venue is closed on this date'; END IF;
 -- Minute-weighted bands handle bookings spanning peak/off-peak and DST changes.
 FOR t IN SELECT generate_series(p_start,p_end-interval '1 minute',interval '1 minute') LOOP
  local_t:=t AT TIME ZONE coalesce(v.timezone,'America/New_York');
  SELECT hourly_cents INTO rate FROM venue_rate_bands WHERE venue_id=v.id AND (court_id IS NULL OR court_id=c.id)
   AND extract(dow FROM local_t)::integer=ANY(days) AND extract(hour FROM local_t)*60+extract(minute FROM local_t)>=start_minute
   AND extract(hour FROM local_t)*60+extract(minute FROM local_t)<end_minute ORDER BY court_id NULLS LAST LIMIT 1;
  total:=total+coalesce(rate,round(coalesce(c.hourly_rate,0)*100)::integer)::numeric/60;
 END LOOP;
 total:=round(total*(100-discount)/100);
 RETURN jsonb_build_object('amount_cents',CASE WHEN total>0 THEN greatest(total,50) ELSE 0 END,'member_discount_percent',discount,'member',member,'cancellation_hours',coalesce(r.cancellation_hours,24),'timezone',coalesce(v.timezone,'America/New_York'));
END $$;

ALTER FUNCTION payment_court_quote(uuid,uuid,uuid,timestamptz,timestamptz,boolean) RENAME TO payment_court_quote_before_rates;
CREATE FUNCTION payment_court_quote(p_buyer uuid,p_group uuid,p_court uuid,p_start timestamptz,p_end timestamptz,p_live boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE q jsonb;price jsonb;c uuid;
BEGIN
 q:=payment_court_quote_before_rates(p_buyer,p_group,p_court,p_start,p_end,p_live);
 SELECT id INTO c FROM venue_customers WHERE user_id=p_buyer AND venue_id=(q->>'venue_id')::uuid;
 price:=venue_court_pricing(p_court,p_start,p_end,c);
 IF (price->>'amount_cents')::integer<50 THEN RAISE EXCEPTION 'Use an eligible prepaid pass or contact the front desk for a complimentary booking'; END IF;
 RETURN q||price||jsonb_build_object('policy',q->>'policy'||E'\nCancellation requests: please submit at least '||(price->>'cancellation_hours')||' hours before the booking. The venue reviews refunds under its policy.');
END $$;
CREATE FUNCTION guard_venue_booking_policy() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE price jsonb;c uuid;tz text;
BEGIN
 IF NEW.venue_court_id IS NULL THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND (NEW.venue_court_id,NEW.start_time,NEW.end_time) IS NOT DISTINCT FROM (OLD.venue_court_id,OLD.start_time,OLD.end_time) THEN RETURN NEW; END IF;
 SELECT coalesce(timezone,'America/New_York') INTO tz FROM venues WHERE id=NEW.venue_id;
 IF EXISTS(SELECT 1 FROM venue_holiday_closures WHERE venue_id=NEW.venue_id AND day>=(NEW.start_time AT TIME ZONE tz)::date AND day<=((NEW.end_time-interval '1 microsecond') AT TIME ZONE tz)::date) THEN RAISE EXCEPTION 'The venue is closed on this date'; END IF;
 IF NEW.event_format='reservation' AND NEW.payment_order_id IS NULL AND current_setting('role',true) IN ('authenticated','anon') THEN
  SELECT id INTO c FROM venue_customers WHERE venue_id=NEW.venue_id AND user_id=auth.uid();
  price:=venue_court_pricing(NEW.venue_court_id,NEW.start_time,NEW.end_time,c);
  IF (price->>'amount_cents')::integer>0 THEN RAISE EXCEPTION 'This time requires secure checkout or a front-desk payment'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_venue_booking_policy BEFORE INSERT OR UPDATE ON group_events FOR EACH ROW EXECUTE FUNCTION guard_venue_booking_policy();
REVOKE ALL ON FUNCTION venue_booking_policy_workspace(uuid),venue_booking_rules_save(uuid,timestamptz,jsonb),venue_rate_save(uuid,uuid,timestamptz,jsonb),venue_holiday_save(uuid,date,text),venue_court_pricing(uuid,timestamptz,timestamptz,uuid,boolean),payment_court_quote_before_rates(uuid,uuid,uuid,timestamptz,timestamptz,boolean),payment_court_quote(uuid,uuid,uuid,timestamptz,timestamptz,boolean),guard_venue_booking_policy() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION venue_booking_policy_workspace(uuid),venue_booking_rules_save(uuid,timestamptz,jsonb),venue_rate_save(uuid,uuid,timestamptz,jsonb),venue_holiday_save(uuid,date,text) TO authenticated;
GRANT EXECUTE ON FUNCTION payment_court_quote(uuid,uuid,uuid,timestamptz,timestamptz,boolean),venue_court_pricing(uuid,timestamptz,timestamptz,uuid,boolean) TO service_role;
COMMIT;
