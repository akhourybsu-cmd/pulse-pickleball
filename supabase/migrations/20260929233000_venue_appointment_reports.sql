BEGIN;
CREATE OR REPLACE FUNCTION public.venue_operating_report(p_venue uuid,p_from date,p_to date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE tz text;begins timestamptz;ends timestamptz;result jsonb;
BEGIN
 IF NOT venue_desk_access(p_venue,true) THEN RAISE EXCEPTION 'Venue management access required' USING ERRCODE='42501'; END IF;
 IF p_from IS NULL OR p_to IS NULL OR p_to<p_from OR p_to-p_from>365 THEN RAISE EXCEPTION 'Choose a date range of up to 366 days'; END IF;
 SELECT coalesce(timezone,'America/New_York') INTO tz FROM venues WHERE id=p_venue;
 begins:=p_from::timestamp AT TIME ZONE tz;ends:=(p_to+1)::timestamp AT TIME ZONE tz;
 WITH receipts AS (
  SELECT paid_at,amount_cents,refunded_cents,method,product_kind kind FROM venue_sales WHERE venue_id=p_venue AND paid_at>=begins AND paid_at<ends AND status IN ('paid','partially_refunded','refunded')
  UNION ALL
  SELECT paid_at,amount_cents,refunded_cents,'stripe',kind FROM payment_orders WHERE venue_id=p_venue AND kind IN ('court_rental','event_registration') AND livemode AND paid_at>=begins AND paid_at<ends AND status IN ('paid','partially_refunded','refunded')
 ), visits AS (
  SELECT e.id event_id,e.title,e.event_format,e.start_time,r.user_id::text player,r.checked_in_at IS NOT NULL checked_in,r.no_show_at IS NOT NULL no_show FROM group_event_rsvps r JOIN group_events e ON e.id=r.event_id WHERE e.venue_id=p_venue AND e.parent_event_id IS NULL AND r.status='going' AND e.canceled_at IS NULL AND e.start_time>=begins AND e.start_time<ends
  UNION ALL
  SELECT coalesce(v.event_id,a.id),coalesce(e.title,a.title,'Court reservation'),coalesce(e.event_format,a.kind,'reservation'),v.start_time,coalesce(c.user_id::text,c.id::text),v.status='checked_in',v.status='no_show' FROM venue_visits v JOIN venue_customers c ON c.id=v.customer_id LEFT JOIN group_events e ON e.id=v.event_id LEFT JOIN venue_appointments a ON a.visit_id=v.id WHERE v.venue_id=p_venue AND v.start_time>=begins AND v.start_time<ends AND v.status IN ('expected','checked_in','no_show')
 ), dates AS (
  SELECT x::date AS day FROM generate_series(p_from::timestamp,p_to::timestamp,interval '1 day') x
 ), openings AS (
  SELECT c.id,c.name,d.day,(d.day+coalesce((v.hours_of_operation->'days'->extract(dow FROM d.day)::integer::text->>'open')::time,'06:00'::time)) AT TIME ZONE tz open_time,
   (d.day+coalesce((v.hours_of_operation->'days'->extract(dow FROM d.day)::integer::text->>'close')::time,'22:00'::time)) AT TIME ZONE tz close_time
  FROM dates d CROSS JOIN venue_courts c JOIN venues v ON v.id=c.venue_id WHERE c.venue_id=p_venue AND c.is_active
  AND (v.hours_of_operation->'days'->extract(dow FROM d.day)::integer::text) IS DISTINCT FROM 'null'::jsonb
  AND NOT EXISTS(SELECT 1 FROM venue_holiday_closures WHERE venue_id=p_venue AND day=d.day)
 ), court_totals AS (
  SELECT c.id,c.name,coalesce(sum(extract(epoch FROM o.close_time-o.open_time)/3600),0) available_hours,
   coalesce(sum((SELECT coalesce(sum(extract(epoch FROM least(e.end_time,o.close_time)-greatest(e.start_time,o.open_time))/3600),0) FROM group_events e WHERE e.venue_court_id=c.id AND e.canceled_at IS NULL AND e.start_time<o.close_time AND e.end_time>o.open_time)),0) booked_hours
  FROM venue_courts c LEFT JOIN openings o ON o.id=c.id WHERE c.venue_id=p_venue AND c.is_active GROUP BY c.id,c.name
 ), players AS (SELECT player,count(*) n,count(*) FILTER(WHERE checked_in) attended FROM visits GROUP BY player),
 daily_receipts AS (SELECT (paid_at AT TIME ZONE tz)::date AS day,sum(amount_cents) gross_cents,sum(refunded_cents) refunded_cents,sum(amount_cents-refunded_cents) net_cents FROM receipts GROUP BY 1),
 programs AS (SELECT event_format,count(*) registrations,count(*) FILTER(WHERE checked_in) checked_in,count(*) FILTER(WHERE no_show) no_shows FROM visits GROUP BY event_format),
 time_slots AS (SELECT extract(dow FROM start_time AT TIME ZONE tz)::integer weekday,extract(hour FROM start_time AT TIME ZONE tz)::integer AS hour,count(*) registrations,count(*) FILTER(WHERE checked_in) checked_in FROM visits GROUP BY 1,2)
 SELECT jsonb_build_object('timezone',tz,'from',p_from,'to',p_to,
 'gross_cents',coalesce((SELECT sum(amount_cents) FROM receipts),0),'refunded_cents',coalesce((SELECT sum(refunded_cents) FROM receipts),0),'net_cents',coalesce((SELECT sum(amount_cents-refunded_cents) FROM receipts),0),
 'cash_cents',coalesce((SELECT sum(amount_cents-refunded_cents) FROM receipts WHERE method='cash'),0),'stripe_cents',coalesce((SELECT sum(amount_cents-refunded_cents) FROM receipts WHERE method='stripe'),0),
 'registrations',(SELECT count(*) FROM visits),'checked_in',(SELECT count(*) FROM visits WHERE checked_in),'no_shows',(SELECT count(*) FROM visits WHERE no_show),
 'unique_players',(SELECT count(*) FROM players),'repeat_players',(SELECT count(*) FROM players WHERE n>1),'returning_attendees',(SELECT count(*) FROM players WHERE attended>1),
 'available_hours',coalesce((SELECT sum(available_hours) FROM court_totals),0),'booked_hours',coalesce((SELECT sum(booked_hours) FROM court_totals),0),
 'courts',coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY name) FROM court_totals c),'[]'::jsonb),
 'daily',coalesce((SELECT jsonb_agg(to_jsonb(d) ORDER BY day) FROM daily_receipts d),'[]'::jsonb),
 'programs',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY registrations DESC,event_format) FROM programs p),'[]'::jsonb),
 'time_slots',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY weekday,hour) FROM time_slots t),'[]'::jsonb)) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION venue_operating_report(uuid,date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION venue_operating_report(uuid,date,date) TO authenticated;
COMMIT;
