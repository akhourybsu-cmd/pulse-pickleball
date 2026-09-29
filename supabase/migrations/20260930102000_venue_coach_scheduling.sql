BEGIN;
ALTER TABLE venue_coaches ADD COLUMN time_off jsonb NOT NULL DEFAULT '[]';
CREATE FUNCTION venue_coach_conflict(p_coach uuid,p_start timestamptz,p_end timestamptz,p_appointment uuid DEFAULT NULL,p_lesson uuid DEFAULT NULL) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE c venue_coaches;tz text;ls timestamp;le timestamp;
BEGIN
 SELECT * INTO c FROM venue_coaches WHERE id=p_coach;
 SELECT coalesce(timezone,'America/New_York') INTO tz FROM venues WHERE id=c.venue_id;
 ls:=p_start AT TIME ZONE tz;le:=p_end AT TIME ZONE tz;
 IF NOT coalesce(c.active,false) THEN RETURN 'Choose an active coach'; END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(c.availability) s WHERE (s->>'weekday')::integer=extract(dow FROM ls)::integer AND ls>=ls::date+(s->>'start_minute')::integer*interval '1 minute' AND le<=ls::date+(s->>'end_minute')::integer*interval '1 minute') THEN RETURN 'Outside the coach’s weekly availability'; END IF;
 IF EXISTS(SELECT 1 FROM venue_coaches other CROSS JOIN LATERAL jsonb_array_elements(other.time_off) t WHERE (other.id=c.id OR (c.user_id IS NOT NULL AND other.user_id=c.user_id)) AND tstzrange((t->>'start_time')::timestamptz,(t->>'end_time')::timestamptz,'[)')&&tstzrange(p_start,p_end,'[)')) THEN RETURN 'The coach has time off'; END IF;
 IF EXISTS(SELECT 1 FROM venue_appointments a JOIN venue_coaches other ON other.id=a.coach_id WHERE (other.id=c.id OR (c.user_id IS NOT NULL AND other.user_id=c.user_id)) AND a.id IS DISTINCT FROM p_appointment AND a.status IN ('held','confirmed') AND tstzrange(a.start_time,a.end_time,'[)')&&tstzrange(p_start,p_end,'[)'))
 OR EXISTS(SELECT 1 FROM venue_lessons l JOIN venue_coaches other ON other.id=l.coach_id WHERE (other.id=c.id OR (c.user_id IS NOT NULL AND other.user_id=c.user_id)) AND l.id IS DISTINCT FROM p_lesson AND l.status IN ('scheduled','in_progress') AND tstzrange(l.start_time,l.end_time,'[)')&&tstzrange(p_start,p_end,'[)')) THEN RETURN 'The coach already has a lesson at this time'; END IF;
 RETURN NULL;
END $$;
ALTER FUNCTION venue_coach_save(uuid,uuid,timestamptz,jsonb) RENAME TO venue_coach_save_before_details;
CREATE FUNCTION venue_coach_save(p_venue uuid,p_id uuid,p_expected timestamptz,p_document jsonb) RETURNS venue_coaches
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c venue_coaches;t jsonb;linked uuid;actor uuid;scheduled record;reason text;
BEGIN
 IF NOT venue_desk_access(p_venue,true) THEN RAISE EXCEPTION 'Venue management access required' USING ERRCODE='42501'; END IF;
 PERFORM id FROM venues WHERE id=p_venue FOR UPDATE;
 linked:=nullif(p_document->>'user_id','')::uuid;
 FOR actor IN SELECT DISTINCT x FROM (SELECT coalesce(user_id,id) x FROM venue_coaches WHERE id=p_id UNION SELECT linked) keys WHERE x IS NOT NULL ORDER BY x LOOP PERFORM pg_advisory_xact_lock(hashtextextended(actor::text,913)); END LOOP;
 IF linked IS NOT NULL AND NOT EXISTS(SELECT 1 FROM profiles_public WHERE id=linked) THEN RAISE EXCEPTION 'Choose an existing PULSE coach account'; END IF;
 IF length(coalesce(p_document->>'email',''))>254 OR length(coalesce(p_document->>'phone',''))>40 OR length(coalesce(p_document->>'specialties',''))>1000 THEN RAISE EXCEPTION 'Coach contact or specialties are too long'; END IF;
 IF p_document ? 'time_off' THEN
  IF jsonb_typeof(p_document->'time_off') IS DISTINCT FROM 'array' OR jsonb_array_length(p_document->'time_off')>100 THEN RAISE EXCEPTION 'Add up to 100 time-off windows'; END IF;
  FOR t IN SELECT value FROM jsonb_array_elements(p_document->'time_off') LOOP
   IF ((t->>'end_time')::timestamptz>(t->>'start_time')::timestamptz AND isfinite((t->>'start_time')::timestamptz) AND isfinite((t->>'end_time')::timestamptz)) IS NOT TRUE THEN RAISE EXCEPTION 'Time off requires a valid start and end'; END IF;
   IF EXISTS(SELECT 1 FROM venue_appointments a JOIN venue_coaches co ON co.id=a.coach_id WHERE (co.id=p_id OR (linked IS NOT NULL AND co.user_id=linked)) AND a.status IN ('held','confirmed') AND tstzrange(a.start_time,a.end_time,'[)')&&tstzrange((t->>'start_time')::timestamptz,(t->>'end_time')::timestamptz,'[)'))
   OR EXISTS(SELECT 1 FROM venue_lessons l JOIN venue_coaches co ON co.id=l.coach_id WHERE (co.id=p_id OR (linked IS NOT NULL AND co.user_id=linked)) AND l.status IN ('scheduled','in_progress') AND tstzrange(l.start_time,l.end_time,'[)')&&tstzrange((t->>'start_time')::timestamptz,(t->>'end_time')::timestamptz,'[)')) THEN RAISE EXCEPTION 'Reschedule the existing lesson before adding overlapping time off'; END IF;
  END LOOP;
 END IF;
 IF linked IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtextextended(linked::text,913)); END IF;
 c:=venue_coach_save_before_details(p_venue,p_id,p_expected,p_document);
 UPDATE venue_coaches SET user_id=CASE WHEN p_document ? 'user_id' THEN linked ELSE user_id END,
 email=CASE WHEN p_document ? 'email' THEN nullif(trim(p_document->>'email'),'') ELSE email END,
 phone=CASE WHEN p_document ? 'phone' THEN nullif(trim(p_document->>'phone'),'') ELSE phone END,
 specialties=CASE WHEN p_document ? 'specialties' THEN ARRAY(SELECT trim(value) FROM jsonb_array_elements_text(p_document->'specialties')) ELSE specialties END,
 time_off=coalesce(p_document->'time_off',time_off),updated_at=clock_timestamp() WHERE id=c.id RETURNING * INTO c;
 FOR scheduled IN SELECT id,start_time,end_time FROM venue_appointments WHERE coach_id=c.id AND status IN ('held','confirmed') AND end_time>now() LOOP
  reason:=venue_coach_conflict(c.id,scheduled.start_time,scheduled.end_time,scheduled.id);
  IF reason IS NOT NULL AND c.active THEN RAISE EXCEPTION 'This change conflicts with an assigned lesson: %',reason; END IF;
 END LOOP;
 RETURN c;
END $$;
ALTER FUNCTION venue_appointment_available(uuid) RENAME TO venue_appointment_available_before_coach_details;
CREATE FUNCTION venue_appointment_available(p_appointment uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a venue_appointments;actor uuid;reason text;
BEGIN
 SELECT * INTO a FROM venue_appointments WHERE id=p_appointment;
 SELECT coalesce(user_id,id) INTO actor FROM venue_coaches WHERE id=a.coach_id;
 IF actor IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtextextended(actor::text,913)); END IF;
 PERFORM venue_appointment_available_before_coach_details(p_appointment);
 IF a.coach_id IS NOT NULL THEN
  reason:=venue_coach_conflict(a.coach_id,a.start_time,a.end_time,a.id);
  IF reason IS NOT NULL THEN RAISE EXCEPTION '%',reason USING ERRCODE='23P01'; END IF;
 END IF;
END $$;
-- Protect the original lesson editor too, so both ways of assigning coaches
-- participate in the same court and coach locks and conflict checks.
CREATE FUNCTION venue_guard_legacy_lesson() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid;reason text;
BEGIN
 IF NEW.status NOT IN ('scheduled','in_progress') THEN RETURN NEW; END IF;
 IF NEW.end_time<=NEW.start_time OR NEW.court_id IS NULL THEN RAISE EXCEPTION 'Choose a court and valid lesson duration'; END IF;
 SELECT coalesce(user_id,id) INTO actor FROM venue_coaches WHERE id=NEW.coach_id AND venue_id=NEW.venue_id;
 IF actor IS NULL THEN RAISE EXCEPTION 'Choose a coach at this venue'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(actor::text,913));
 PERFORM id FROM venue_courts WHERE id=NEW.court_id AND venue_id=NEW.venue_id AND is_active FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Choose an active court at this venue'; END IF;
 reason:=venue_coach_conflict(NEW.coach_id,NEW.start_time,NEW.end_time,NULL,NEW.id);
 IF reason IS NOT NULL THEN RAISE EXCEPTION '%',reason USING ERRCODE='23P01'; END IF;
 IF EXISTS(SELECT 1 FROM group_events WHERE venue_court_id=NEW.court_id AND canceled_at IS NULL AND tstzrange(start_time,end_time,'[)')&&tstzrange(NEW.start_time,NEW.end_time,'[)'))
 OR EXISTS(SELECT 1 FROM venue_lessons WHERE court_id=NEW.court_id AND id<>NEW.id AND status IN ('scheduled','in_progress') AND tstzrange(start_time,end_time,'[)')&&tstzrange(NEW.start_time,NEW.end_time,'[)'))
 OR EXISTS(SELECT 1 FROM venue_bookings WHERE court_id=NEW.court_id AND status IN ('pending','confirmed') AND tstzrange(start_time,end_time,'[)')&&tstzrange(NEW.start_time,NEW.end_time,'[)'))
 OR EXISTS(SELECT 1 FROM payment_orders WHERE court_id=NEW.court_id AND status='pending' AND livemode AND tstzrange(start_time,end_time,'[)')&&tstzrange(NEW.start_time,NEW.end_time,'[)')) THEN RAISE EXCEPTION 'This court is already booked or held for checkout' USING ERRCODE='23P01'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER venue_guard_legacy_lesson BEFORE INSERT OR UPDATE OF coach_id,court_id,start_time,end_time,status ON venue_lessons FOR EACH ROW EXECUTE FUNCTION venue_guard_legacy_lesson();
CREATE FUNCTION venue_coach_player_search(p_venue uuid,p_search text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT venue_desk_access(p_venue,true) THEN RAISE EXCEPTION 'Venue management access required' USING ERRCODE='42501'; END IF;
 IF length(trim(p_search))<2 THEN RETURN '[]'; END IF;
 RETURN coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT id,coalesce(nullif(full_name,''),concat_ws(' ',first_name,last_name),'Player') name FROM profiles_public WHERE concat_ws(' ',first_name,last_name,full_name) ILIKE '%'||left(trim(p_search),100)||'%' ORDER BY full_name,id LIMIT 20)x),'[]');
END $$;
CREATE FUNCTION venue_lesson_availability(p_venue uuid,p_coach uuid,p_start timestamptz,p_end timestamptz,p_appointment uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE reason text;tz text;ls timestamp;le timestamp;hours jsonb;courts jsonb;
BEGIN
 IF NOT venue_desk_access(p_venue) THEN RAISE EXCEPTION 'Venue desk access required' USING ERRCODE='42501'; END IF;
 IF p_start IS NULL OR p_end IS NULL OR p_end<=p_start OR p_end>p_start+interval '12 hours' THEN RAISE EXCEPTION 'Choose a valid booking duration'; END IF;
 SELECT coalesce(timezone,'America/New_York'),hours_of_operation INTO tz,hours FROM venues WHERE id=p_venue;
 ls:=p_start AT TIME ZONE tz;le:=p_end AT TIME ZONE tz;hours:=hours->'days'->extract(dow FROM ls)::integer::text;
 IF p_start<now() OR p_start>now()+interval '180 days' OR mod(extract(epoch FROM p_end-p_start)/60,30)<>0 THEN reason:='Choose a future booking within 180 days in 30-minute increments';
 ELSIF hours='null'::jsonb OR ls<ls::date+coalesce((hours->>'open')::time,'06:00') OR le>ls::date+coalesce((hours->>'close')::time,'22:00') OR EXISTS(SELECT 1 FROM venue_holiday_closures WHERE venue_id=p_venue AND day=ls::date) THEN reason:='The venue is closed at this time';
 ELSIF p_coach IS NOT NULL THEN
  IF NOT EXISTS(SELECT 1 FROM venue_coaches WHERE id=p_coach AND venue_id=p_venue) THEN RAISE EXCEPTION 'Choose a coach at this venue'; END IF;
  reason:=venue_coach_conflict(p_coach,p_start,p_end,p_appointment);
 END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'available',
 NOT EXISTS(SELECT 1 FROM group_events WHERE venue_court_id=c.id AND canceled_at IS NULL AND (p_appointment IS NULL OR venue_appointment_id IS DISTINCT FROM p_appointment) AND tstzrange(start_time,end_time,'[)')&&tstzrange(p_start,p_end,'[)'))
 AND NOT EXISTS(SELECT 1 FROM payment_orders WHERE court_id=c.id AND status='pending' AND livemode AND tstzrange(start_time,end_time,'[)')&&tstzrange(p_start,p_end,'[)'))
 AND NOT EXISTS(SELECT 1 FROM venue_lessons WHERE court_id=c.id AND status IN ('scheduled','in_progress') AND tstzrange(start_time,end_time,'[)')&&tstzrange(p_start,p_end,'[)'))
 AND NOT EXISTS(SELECT 1 FROM venue_bookings WHERE court_id=c.id AND status IN ('pending','confirmed') AND tstzrange(start_time,end_time,'[)')&&tstzrange(p_start,p_end,'[)'))
 ) ORDER BY c.court_number),'[]') INTO courts FROM venue_courts c WHERE c.venue_id=p_venue AND c.is_active;
 RETURN jsonb_build_object('available',reason IS NULL,'reason',reason,'courts',courts);
END $$;
CREATE FUNCTION venue_my_coach_schedule(p_venue uuid,p_from date,p_to date) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE tz text;
BEGIN
 IF auth.uid() IS NULL OR NOT pulse_has_required_mfa() OR p_from IS NULL OR p_to IS NULL OR p_to<p_from OR p_to-p_from>90 THEN RAISE EXCEPTION 'Choose a schedule range of up to 91 days' USING ERRCODE='42501'; END IF;
 SELECT coalesce(timezone,'America/New_York') INTO tz FROM venues WHERE id=p_venue;
 RETURN jsonb_build_object('coaches',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name,'availability',availability,'time_off',time_off)) FROM venue_coaches WHERE venue_id=p_venue AND user_id=auth.uid()),'[]'),
 'lessons',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY start_time) FROM (
 SELECT a.id,a.title,a.start_time,a.end_time,a.status,ARRAY(SELECT name FROM venue_courts WHERE id=ANY(a.court_ids)) courts,c.first_name||' '||left(c.last_name,1)||'.' player
 FROM venue_appointments a JOIN venue_coaches co ON co.id=a.coach_id JOIN venue_customers c ON c.id=a.customer_id WHERE co.user_id=auth.uid() AND a.venue_id=p_venue AND a.status IN ('held','confirmed') AND a.start_time<(p_to+1)::timestamp AT TIME ZONE tz AND a.end_time>p_from::timestamp AT TIME ZONE tz
 UNION ALL SELECT l.id,l.title,l.start_time,l.end_time,l.status,ARRAY(SELECT name FROM venue_courts WHERE id=l.court_id),NULL FROM venue_lessons l JOIN venue_coaches co ON co.id=l.coach_id WHERE co.user_id=auth.uid() AND l.venue_id=p_venue AND l.status IN ('scheduled','in_progress') AND l.start_time<(p_to+1)::timestamp AT TIME ZONE tz AND l.end_time>p_from::timestamp AT TIME ZONE tz
 )x),'[]'));
END $$;
-- Linking an account gives the coach an authenticated entry point to their
-- own schedule, without granting desk or venue management privileges.
ALTER FUNCTION venue_player_visit_context(uuid) RENAME TO venue_player_visit_context_before_coaches;
CREATE FUNCTION venue_player_visit_context(p_venue uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p record;
BEGIN
 IF auth.uid() IS NOT NULL AND pulse_has_required_mfa() AND can_access_private_venue(p_venue) AND EXISTS(SELECT 1 FROM venue_coaches WHERE venue_id=p_venue AND user_id=auth.uid()) THEN
  SELECT * INTO p FROM profiles_public WHERE id=auth.uid();
  INSERT INTO venue_customers(venue_id,user_id,first_name,last_name,created_by) VALUES(p_venue,auth.uid(),left(coalesce(nullif(p.first_name,''),nullif(split_part(p.full_name,' ',1),''),'Coach'),80),left(coalesce(p.last_name,''),80),auth.uid()) ON CONFLICT(venue_id,user_id) DO NOTHING;
 END IF;
 RETURN venue_player_visit_context_before_coaches(p_venue);
END $$;
REVOKE ALL ON FUNCTION venue_player_visit_context_before_coaches(uuid),venue_player_visit_context(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION venue_player_visit_context(uuid) TO authenticated;
REVOKE ALL ON FUNCTION venue_coach_conflict(uuid,timestamptz,timestamptz,uuid,uuid),venue_coach_save_before_details(uuid,uuid,timestamptz,jsonb),venue_coach_save(uuid,uuid,timestamptz,jsonb),venue_appointment_available_before_coach_details(uuid),venue_appointment_available(uuid),venue_guard_legacy_lesson(),venue_coach_player_search(uuid,text),venue_lesson_availability(uuid,uuid,timestamptz,timestamptz,uuid),venue_my_coach_schedule(uuid,date,date) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION venue_coach_save(uuid,uuid,timestamptz,jsonb),venue_coach_player_search(uuid,text),venue_lesson_availability(uuid,uuid,timestamptz,timestamptz,uuid),venue_my_coach_schedule(uuid,date,date) TO authenticated;
COMMIT;
