-- Host controls commit their result, audit and history effects together.
BEGIN;

CREATE OR REPLACE FUNCTION public.rr_start_event(p_event_id uuid,p_expected_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE e public.round_robin_events%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.pulse_has_required_mfa() THEN RAISE EXCEPTION 'Sign in and complete verification.' USING ERRCODE='42501'; END IF;
  SELECT * INTO e FROM public.round_robin_events WHERE id=p_event_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_manage_round_robin(e.id,auth.uid()) THEN RAISE EXCEPTION 'Event unavailable or not authorized.' USING ERRCODE='42501'; END IF;
  -- A delayed retry must never reset a round that another host has advanced.
  IF e.status='live' AND NOT coalesce(e.voided,false) THEN
    RETURN jsonb_build_object('current_round',e.current_round,'already_started',true);
  END IF;
  IF e.status<>'draft' OR coalesce(e.voided,false) THEN RAISE EXCEPTION 'Only a draft event can be started.'; END IF;
  IF p_expected_version IS DISTINCT FROM coalesce(e.schedule_version,0) THEN RAISE EXCEPTION 'The event changed. Refresh and review the schedule before starting.' USING ERRCODE='40001'; END IF;
  PERFORM id FROM public.round_robin_schedule WHERE event_id=e.id ORDER BY id FOR UPDATE;
  IF (SELECT count(*) FROM public.round_robin_players WHERE event_id=e.id AND active AND registration_status='confirmed')<4 THEN
    RAISE EXCEPTION 'At least four confirmed active players are needed.';
  END IF;
  IF e.num_rounds IS NULL OR e.num_rounds<1 OR e.num_courts IS NULL OR e.num_courts<1 THEN RAISE EXCEPTION 'Set courts and games before starting.'; END IF;
  IF EXISTS(SELECT 1 FROM generate_series(1,e.num_rounds) r WHERE NOT EXISTS(
    SELECT 1 FROM public.round_robin_schedule s WHERE s.event_id=e.id AND s.round_no=r AND NOT s.is_bye
      AND NOT coalesce(s.abandoned,false) AND s.voided_at IS NULL AND s.superseded_by_schedule_id IS NULL)) THEN
    RAISE EXCEPTION 'Generate a complete schedule before starting.';
  END IF;
  IF EXISTS(SELECT 1 FROM public.round_robin_schedule s WHERE s.event_id=e.id AND s.voided_at IS NULL AND s.superseded_by_schedule_id IS NULL
    AND (s.round_no NOT BETWEEN 1 AND e.num_rounds OR (NOT s.is_bye AND s.court_no NOT BETWEEN 1 AND e.num_courts)
      OR s.team1_score IS NOT NULL OR s.team2_score IS NOT NULL OR s.match_id IS NOT NULL OR coalesce(s.abandoned,false))) THEN
    RAISE EXCEPTION 'Review the schedule: draft matches must be unplayed and assigned to an available court.';
  END IF;
  -- Validate each playing/resting seat against the current roster, including
  -- claimed guests, without changing its stable schedule identity.
  IF EXISTS(
    SELECT 1 FROM public.round_robin_schedule s
    CROSS JOIN LATERAL (VALUES(s.a1_player_id,s.a1_guest_id,1),(s.a2_player_id,s.a2_guest_id,2),
      (s.b1_player_id,s.b1_guest_id,3),(s.b2_player_id,s.b2_guest_id,4)) seat(pid,gid,slot)
    WHERE s.event_id=e.id AND s.voided_at IS NULL AND s.superseded_by_schedule_id IS NULL AND (NOT s.is_bye OR seat.slot=1)
      AND ((seat.pid IS NULL)=(seat.gid IS NULL) OR NOT EXISTS(SELECT 1 FROM public.round_robin_players p WHERE p.event_id=e.id AND p.active
        AND p.registration_status='confirmed' AND (p.player_id=seat.pid OR p.guest_player_id=seat.gid)))) THEN
    RAISE EXCEPTION 'The roster changed. Rebuild the schedule before starting.';
  END IF;
  IF EXISTS(
    SELECT s.round_no,coalesce('p:'||seat.pid::text,'g:'||seat.gid::text) FROM public.round_robin_schedule s
    CROSS JOIN LATERAL (VALUES(s.a1_player_id,s.a1_guest_id),(s.a2_player_id,s.a2_guest_id),(s.b1_player_id,s.b1_guest_id),(s.b2_player_id,s.b2_guest_id)) seat(pid,gid)
    WHERE s.event_id=e.id AND s.voided_at IS NULL AND s.superseded_by_schedule_id IS NULL AND (seat.pid IS NOT NULL OR seat.gid IS NOT NULL)
    GROUP BY 1,2 HAVING count(*)>1) THEN RAISE EXCEPTION 'A player is assigned twice in a round. Rebuild the schedule.'; END IF;
  IF EXISTS(SELECT 1 FROM public.round_robin_players p WHERE p.event_id=e.id AND p.active AND p.registration_status='confirmed'
    AND NOT EXISTS(SELECT 1 FROM public.round_robin_schedule s WHERE s.event_id=e.id AND s.round_no=1 AND s.voided_at IS NULL AND s.superseded_by_schedule_id IS NULL
      AND (p.player_id IN (s.a1_player_id,s.a2_player_id,s.b1_player_id,s.b2_player_id) OR p.guest_player_id IN (s.a1_guest_id,s.a2_guest_id,s.b1_guest_id,s.b2_guest_id)))) THEN
    RAISE EXCEPTION 'A confirmed player is missing from the schedule. Rebuild before starting.';
  END IF;
  IF EXISTS(SELECT 1 FROM public.round_robin_schedule WHERE event_id=e.id AND NOT is_bye AND voided_at IS NULL AND superseded_by_schedule_id IS NULL
    GROUP BY round_no,court_no HAVING count(*)>1) THEN RAISE EXCEPTION 'A court has two matches in one round. Rebuild the schedule.'; END IF;
  UPDATE public.round_robin_events SET status='live',current_round=1,schedule_version=coalesce(schedule_version,0)+1 WHERE id=e.id;
  INSERT INTO public.round_robin_audit(event_id,editor_id,change_type,changes,reason)
    VALUES(e.id,auth.uid(),'event_start',jsonb_build_object('current_round',1),'Event started');
  RETURN jsonb_build_object('current_round',1,'already_started',false);
END $$;

CREATE OR REPLACE FUNCTION public.rr_update_event_settings(p_event_id uuid,p_expected_version integer,p_updates jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE e public.round_robin_events%ROWTYPE; n public.round_robin_events%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.pulse_has_required_mfa() THEN RAISE EXCEPTION 'Sign in and complete verification.' USING ERRCODE='42501'; END IF;
  SELECT * INTO e FROM public.round_robin_events WHERE id=p_event_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_manage_round_robin(e.id,auth.uid()) THEN RAISE EXCEPTION 'Event unavailable or not authorized.' USING ERRCODE='42501'; END IF;
  IF e.status='voided' OR coalesce(e.voided,false) THEN RAISE EXCEPTION 'Voided events are read-only.'; END IF;
  IF p_expected_version IS DISTINCT FROM coalesce(e.schedule_version,0) THEN RAISE EXCEPTION 'The event changed. Refresh before saving these settings.' USING ERRCODE='40001'; END IF;
  IF p_updates IS NULL OR jsonb_typeof(p_updates)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_updates) k
    WHERE k NOT IN ('name','date','start_time','notes','rating_eligible','rating_type','max_players','registration_deadline','location')) THEN
    RAISE EXCEPTION 'Unsupported event settings.' USING ERRCODE='22023'; END IF;
  n:=jsonb_populate_record(e,p_updates);
  n.name:=btrim(n.name);
  IF n.name IS NULL OR length(n.name) NOT BETWEEN 1 AND 200 OR n.date IS NULL OR n.rating_eligible IS NULL
    OR n.rating_type IS NULL OR n.rating_type::text NOT IN ('ladder','league','playoffs','casual') THEN RAISE EXCEPTION 'Enter a name, date and valid rating settings.'; END IF;
  IF n.max_players IS DISTINCT FROM e.max_players AND n.max_players IS NOT NULL AND
    (n.max_players NOT BETWEEN 4 AND 100 OR n.max_players<(SELECT count(*) FROM public.round_robin_players WHERE event_id=e.id AND active AND registration_status='confirmed')) THEN
    RAISE EXCEPTION 'Capacity must allow all confirmed active players (4–100).'; END IF;
  IF to_jsonb(n)=to_jsonb(e) THEN RETURN true; END IF;
  UPDATE public.round_robin_events SET name=n.name,date=n.date,start_time=n.start_time,notes=n.notes,location=n.location,
    rating_eligible=n.rating_eligible,rating_type=n.rating_type,max_players=n.max_players,registration_deadline=n.registration_deadline,
    schedule_version=coalesce(schedule_version,0)+1 WHERE id=e.id;
  INSERT INTO public.round_robin_audit(event_id,editor_id,change_type,changes,reason)
    VALUES(e.id,auth.uid(),'event_settings',jsonb_build_object('before',(SELECT jsonb_object_agg(k,to_jsonb(e)->k) FROM jsonb_object_keys(p_updates) k),
      'after',(SELECT jsonb_object_agg(k,to_jsonb(n)->k) FROM jsonb_object_keys(p_updates) k)),'Event settings updated');
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.rr_remove_match_result(p_schedule_id uuid,p_expected_version integer,p_action text,
  p_expected_match_id uuid,p_expected_team1_score integer,p_expected_team2_score integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE e public.round_robin_events%ROWTYPE; s public.round_robin_schedule%ROWTYPE; affected uuid[]; reason text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.pulse_has_required_mfa() THEN RAISE EXCEPTION 'Sign in and complete verification.' USING ERRCODE='42501'; END IF;
  SELECT * INTO e FROM public.round_robin_events WHERE id=(SELECT event_id FROM public.round_robin_schedule WHERE id=p_schedule_id) FOR UPDATE;
  IF NOT FOUND OR NOT public.can_manage_round_robin(e.id,auth.uid()) THEN RAISE EXCEPTION 'Event unavailable or not authorized.' USING ERRCODE='42501'; END IF;
  IF p_action IS NULL OR p_action NOT IN ('void','delete') THEN RAISE EXCEPTION 'Choose void or delete.'; END IF;
  IF p_action='delete' AND NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN RAISE EXCEPTION 'Only an administrator can delete a match record.' USING ERRCODE='42501'; END IF;
  IF e.status NOT IN ('live','completed') OR coalesce(e.voided,false) THEN RAISE EXCEPTION 'This event is not open for score corrections.'; END IF;
  SELECT * INTO s FROM public.round_robin_schedule WHERE id=p_schedule_id AND event_id=e.id FOR UPDATE;
  reason:=CASE p_action WHEN 'void' THEN 'Result voided by host' ELSE 'Result deleted by administrator' END;
  -- Safe retries after lost responses leave the already-resolved court alone.
  IF s.abandoned AND s.abandoned_reason=reason THEN RETURN true; END IF;
  IF NOT FOUND OR s.is_bye OR coalesce(s.abandoned,false) OR s.voided_at IS NOT NULL OR s.superseded_by_schedule_id IS NOT NULL THEN RAISE EXCEPTION 'This match is no longer available for correction.'; END IF;
  IF p_expected_version IS DISTINCT FROM coalesce(e.schedule_version,0) OR s.match_id IS DISTINCT FROM p_expected_match_id
    OR s.team1_score IS DISTINCT FROM p_expected_team1_score OR s.team2_score IS DISTINCT FROM p_expected_team2_score THEN
    RAISE EXCEPTION 'The match changed. Refresh and review its result before continuing.' USING ERRCODE='40001'; END IF;
  IF s.team1_score IS NULL OR s.team2_score IS NULL THEN RAISE EXCEPTION 'Choose a match with a saved result.'; END IF;
  SELECT array_agg(DISTINCT player_id) FILTER(WHERE player_id IS NOT NULL) INTO affected FROM public.match_participants WHERE match_id=s.match_id;
  IF s.match_id IS NOT NULL THEN
    -- The approval trigger replays rating history once when this flag changes.
    UPDATE public.matches SET voided=true,voided_at=now(),voided_by=auth.uid(),void_reason=reason WHERE id=s.match_id AND NOT coalesce(voided,false);
  END IF;
  UPDATE public.round_robin_schedule SET abandoned=true,abandoned_at=now(),abandoned_reason=reason,
    team1_score=CASE WHEN p_action='delete' THEN NULL ELSE team1_score END,
    team2_score=CASE WHEN p_action='delete' THEN NULL ELSE team2_score END,
    match_id=CASE WHEN p_action='delete' THEN NULL ELSE match_id END WHERE id=s.id;
  IF p_action='delete' AND s.match_id IS NOT NULL THEN
    DELETE FROM public.match_participants WHERE match_id=s.match_id;
    DELETE FROM public.matches WHERE id=s.match_id;
  END IF;
  PERFORM public.recalculate_player_stats(pid) FROM unnest(affected) pid;
  UPDATE public.round_robin_events SET schedule_version=coalesce(schedule_version,0)+1 WHERE id=e.id;
  INSERT INTO public.round_robin_audit(event_id,editor_id,change_type,changes,reason)
    VALUES(e.id,auth.uid(),'match_'||p_action,jsonb_build_object('schedule_id',s.id,'match_id',s.match_id,'team1_score',s.team1_score,'team2_score',s.team2_score),reason);
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.void_round_robin_event(p_event_id uuid,p_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE e public.round_robin_events%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.pulse_has_required_mfa() THEN RAISE EXCEPTION 'Sign in and complete verification.' USING ERRCODE='42501'; END IF;
  SELECT * INTO e FROM public.round_robin_events WHERE id=p_event_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_manage_round_robin(e.id,auth.uid()) THEN RAISE EXCEPTION 'Event unavailable or not authorized.' USING ERRCODE='42501'; END IF;
  IF coalesce(e.voided,false) THEN RETURN; END IF;
  -- Keep venue cancellation/registration guards in force on this update.
  UPDATE public.round_robin_events SET voided=true,voided_by=auth.uid(),voided_at=now(),void_reason=p_reason,status='voided',
    schedule_version=coalesce(schedule_version,0)+1 WHERE id=e.id;
  UPDATE public.matches SET voided=true,voided_by=auth.uid(),voided_at=now(),void_reason=coalesce(p_reason,'Round Robin event voided')
    WHERE id IN (SELECT match_id FROM public.round_robin_schedule WHERE event_id=e.id AND match_id IS NOT NULL) AND NOT coalesce(voided,false);
  -- Each changed result's approval trigger owns rating and stat reconciliation.
  INSERT INTO public.round_robin_audit(event_id,editor_id,change_type,changes,reason)
    VALUES(e.id,auth.uid(),'event_void',jsonb_build_object('previous_status',e.status),coalesce(p_reason,'Event voided by host'));
END $$;

CREATE OR REPLACE FUNCTION public.delete_round_robin_event(p_event_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE e public.round_robin_events%ROWTYPE; results uuid[]; affected uuid[]; has_scores boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.pulse_has_required_mfa() THEN RAISE EXCEPTION 'Sign in and complete verification.' USING ERRCODE='42501'; END IF;
  SELECT * INTO e FROM public.round_robin_events WHERE id=p_event_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_manage_round_robin(e.id,auth.uid()) THEN RAISE EXCEPTION 'Event unavailable or not authorized.' USING ERRCODE='42501'; END IF;
  SELECT array_agg(match_id) FILTER(WHERE match_id IS NOT NULL),bool_or(team1_score IS NOT NULL OR team2_score IS NOT NULL OR match_id IS NOT NULL)
    INTO results,has_scores FROM public.round_robin_schedule WHERE event_id=e.id;
  IF coalesce(has_scores,false) AND NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN
    RAISE EXCEPTION 'This event has saved results. Void it to retain history, or ask an administrator to delete it.' USING ERRCODE='23000'; END IF;
  SELECT array_agg(DISTINCT player_id) FILTER(WHERE player_id IS NOT NULL) INTO affected FROM public.match_participants WHERE match_id=ANY(results);
  DELETE FROM public.round_robin_schedule WHERE event_id=e.id;
  DELETE FROM public.match_participants WHERE match_id=ANY(results);
  DELETE FROM public.matches WHERE id=ANY(results);
  DELETE FROM public.round_robin_players WHERE event_id=e.id;
  DELETE FROM public.round_robin_audit WHERE event_id=e.id;
  DELETE FROM public.rr_schedule_mutation_requests WHERE event_id=e.id;
  DELETE FROM public.round_robin_events WHERE id=e.id;
  -- The existing match-deletion trigger reflows each removed non-voided result.
  PERFORM public.recalculate_player_stats(pid) FROM unnest(affected) pid;
END $$;

REVOKE ALL ON FUNCTION public.void_round_robin_event(uuid,text), public.delete_round_robin_event(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.void_round_robin_event(uuid,text), public.delete_round_robin_event(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.rr_start_event(uuid,integer), public.rr_update_event_settings(uuid,integer,jsonb),
  public.rr_remove_match_result(uuid,integer,text,uuid,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.rr_start_event(uuid,integer), public.rr_update_event_settings(uuid,integer,jsonb),
  public.rr_remove_match_result(uuid,integer,text,uuid,integer,integer) TO authenticated;

-- Preserve the policy captured when a result was first saved. Changing event
-- settings applies to future results, including when an old score is corrected.
DO $$
DECLARE definition text; function_name text;
BEGIN
  SELECT pg_get_functiondef('public.submit_rr_match_score(uuid,integer,integer)'::regprocedure) INTO definition;
  IF position('RR_PRESERVE_RESULT_POLICY' IN definition)=0 THEN
    definition:=replace(definition,'IF v_schedule.match_id IS NOT NULL THEN',E'IF v_schedule.match_id IS NOT NULL THEN\n    -- RR_PRESERVE_RESULT_POLICY\n    SELECT count_for_rating INTO v_count_for_rating FROM public.matches WHERE id=v_schedule.match_id;');
    EXECUTE definition;
  END IF;
  -- An event whose only matches were voided still has resolved play to finish.
  SELECT pg_get_functiondef('public.rr_complete_event(uuid,integer,integer)'::regprocedure) INTO definition;
  definition:=replace(definition,'IF v_scored+v_pending=0 THEN',
    'IF NOT EXISTS(SELECT 1 FROM public.round_robin_schedule WHERE event_id=p_event_id AND NOT is_bye AND voided_at IS NULL AND superseded_by_schedule_id IS NULL) THEN');
  EXECUTE definition;
  -- Removing an already-voided RR result cannot change the rating chain again.
  SELECT pg_get_functiondef('public.handle_match_deletion()'::regprocedure) INTO definition;
  IF position('RR_VOIDED_DELETE_RECONCILED' IN definition)=0 THEN
    EXECUTE regexp_replace(definition, E'\\mBEGIN\\M', E'BEGIN\n  -- RR_VOIDED_DELETE_RECONCILED\n  IF OLD.source=''round_robin'' AND coalesce(OLD.voided,false) THEN RETURN OLD; END IF;', 'i');
  END IF;
  -- These predate the MFA check in newer scoring and roster RPCs.
  FOREACH function_name IN ARRAY ARRAY['rr_edit_schedule','rr_close_round'] LOOP
    SELECT pg_get_functiondef(p.oid) INTO definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname=function_name;
    IF definition IS NULL THEN RAISE EXCEPTION 'Missing round-robin control: %',function_name; END IF;
    IF position('pulse_has_required_mfa' IN definition)=0 THEN
      EXECUTE regexp_replace(definition, E'\\mBEGIN\\M',
        E'BEGIN\n  IF auth.uid() IS NULL OR NOT public.pulse_has_required_mfa() THEN RAISE EXCEPTION ''Sign in and complete verification.'' USING ERRCODE=''42501''; END IF;', 'i');
    END IF;
  END LOOP;
END $$;
COMMIT;
