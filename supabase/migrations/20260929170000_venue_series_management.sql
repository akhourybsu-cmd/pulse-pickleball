BEGIN;
CREATE FUNCTION public.venue_series_preview(p_event uuid,p_scope text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e group_events;result jsonb;
BEGIN
 SELECT * INTO e FROM group_events WHERE id=p_event AND parent_event_id IS NULL;
 IF NOT FOUND OR NOT pulse_has_required_mfa() OR NOT can_manage_venue_events(auth.uid(),e.venue_id,e.group_id) THEN RAISE EXCEPTION 'Venue event management access required' USING ERRCODE='42501'; END IF;
 IF p_scope NOT IN ('occurrence','following','all') THEN RAISE EXCEPTION 'Choose an edit scope'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'updated_at',updated_at,'start_time',start_time,'title',title) ORDER BY id),'[]'::jsonb) INTO result
 FROM group_events WHERE venue_id=e.venue_id AND group_id=e.group_id AND parent_event_id IS NULL AND canceled_at IS NULL AND start_time>now()
 AND (id=e.id OR (e.series_id IS NOT NULL AND series_id=e.series_id AND p_scope<>'occurrence' AND (p_scope='all' OR start_time>=e.start_time)));
 IF jsonb_array_length(result)=0 OR jsonb_array_length(result)>200 THEN RAISE EXCEPTION 'Choose from 1 to 200 upcoming occurrences'; END IF;
 RETURN result;
END $$;
CREATE FUNCTION public.venue_series_apply(p_event uuid,p_scope text,p_expected jsonb,p_changes jsonb,p_courts uuid[],p_skip_dates date[] DEFAULT '{}',p_cancel_reason text DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e group_events;r group_events;preview jsonb;tz text;shift interval;duration interval;next_start timestamp;next_end timestamp;changes jsonb;n integer:=0;
BEGIN
 preview:=venue_series_preview(p_event,p_scope);
 SELECT * INTO e FROM group_events WHERE id=p_event;
 PERFORM id FROM venues WHERE id=e.venue_id FOR UPDATE;
 PERFORM id FROM group_events WHERE id IN (SELECT (value->>'id')::uuid FROM jsonb_array_elements(preview)) ORDER BY id FOR UPDATE;
 preview:=venue_series_preview(p_event,p_scope);
 IF preview IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'The series changed. Preview the affected occurrences again.' USING ERRCODE='40001'; END IF;
 IF p_cancel_reason IS NOT NULL AND length(trim(p_cancel_reason))<5 THEN RAISE EXCEPTION 'Add a cancellation reason'; END IF;
 SELECT coalesce(timezone,'America/New_York') INTO tz FROM venues WHERE id=e.venue_id;
 IF p_cancel_reason IS NULL THEN
  shift:=((p_changes->>'start_time')::timestamptz AT TIME ZONE tz)-(e.start_time AT TIME ZONE tz);
  duration:=((p_changes->>'end_time')::timestamptz AT TIME ZONE tz)-((p_changes->>'start_time')::timestamptz AT TIME ZONE tz);
  IF shift IS NULL OR duration IS NULL OR duration<=interval '0' OR duration>interval '24 hours' THEN RAISE EXCEPTION 'Choose a valid start time and duration'; END IF;
  -- Release this batch's blocks within the same transaction so a shifted
  -- occurrence can occupy another occurrence's old slot. Any failure rolls back all.
  PERFORM id FROM venue_courts WHERE id=ANY(p_courts) OR id IN(SELECT venue_court_id FROM group_events WHERE parent_event_id IN(SELECT (value->>'id')::uuid FROM jsonb_array_elements(preview))) ORDER BY id FOR UPDATE;
  DELETE FROM group_events WHERE parent_event_id IN(SELECT (value->>'id')::uuid FROM jsonb_array_elements(preview));
 END IF;
 FOR r IN SELECT * FROM group_events WHERE id IN(SELECT (value->>'id')::uuid FROM jsonb_array_elements(preview)) ORDER BY start_time,id LOOP
  IF p_cancel_reason IS NOT NULL OR (r.start_time AT TIME ZONE tz)::date=ANY(p_skip_dates) THEN
   PERFORM cancel_venue_program(r.id,r.updated_at,coalesce(p_cancel_reason,'Series exception: '||(r.start_time AT TIME ZONE tz)::date::text));
  ELSE
   next_start:=(r.start_time AT TIME ZONE tz)+shift;next_end:=next_start+duration;
   IF ((next_start AT TIME ZONE tz) AT TIME ZONE tz)<>next_start OR ((next_end AT TIME ZONE tz) AT TIME ZONE tz)<>next_end THEN RAISE EXCEPTION 'A series time falls in a daylight-saving clock gap. Choose another time.'; END IF;
   changes:=p_changes||jsonb_build_object('start_time',next_start AT TIME ZONE tz,'end_time',next_end AT TIME ZONE tz,'registration_closes_at',(next_start AT TIME ZONE tz)-((p_changes->>'start_time')::timestamptz-(p_changes->>'registration_closes_at')::timestamptz));
   PERFORM update_venue_program(r.id,changes,p_courts,r.updated_at);
  END IF;
  n:=n+1;
 END LOOP;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION venue_series_preview(uuid,text),venue_series_apply(uuid,text,jsonb,jsonb,uuid[],date[],text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION venue_series_preview(uuid,text),venue_series_apply(uuid,text,jsonb,jsonb,uuid[],date[],text) TO authenticated;
COMMIT;
