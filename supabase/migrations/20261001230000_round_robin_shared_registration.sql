-- Shared links expose an event summary, never a private roster or invite code.
-- Registration locks the event so competing requests cannot take the last seat.
BEGIN;
-- Quick standalone events remain private; possession of the host's invitation
-- enables signup. Venue programs retain their own registration authority.
CREATE OR REPLACE FUNCTION public.rr_events_set_invite_code()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.invite_code IS NULL AND (NEW.registration_mode='invite_only' OR
    (NEW.registration_mode='immediate' AND NEW.venue_id IS NULL)) THEN
    NEW.invite_code:=public.generate_rr_invite_code();
  END IF;
  RETURN NEW;
END $$;
UPDATE public.round_robin_events SET invite_code=public.generate_rr_invite_code()
  WHERE invite_code IS NULL AND registration_mode='immediate' AND venue_id IS NULL;
CREATE OR REPLACE FUNCTION public.get_round_robin_entry(p_event_id uuid, p_invite_code text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  e round_robin_events; program group_events; registration round_robin_players;
  manager boolean; member boolean; invited boolean; verified boolean; confirmed integer; waiting integer;
  closed text; venue_link uuid; venue_registration text;
BEGIN
  SELECT * INTO e FROM round_robin_events WHERE id=p_event_id;
  IF NOT FOUND OR NOT can_access_private_venue(e.venue_id) OR NOT can_access_private_group(e.group_id) THEN RETURN NULL; END IF;
  verified := auth.uid() IS NOT NULL AND pulse_has_required_mfa();
  manager := verified AND can_manage_round_robin(e.id,auth.uid());
  member := verified AND coalesce(is_group_member(auth.uid(),e.group_id),false);
  invited := e.registration_mode IN ('invite_only','immediate') AND e.invite_code IS NOT NULL
    AND e.invite_code=upper(trim(p_invite_code));
  SELECT * INTO registration FROM round_robin_players r WHERE verified AND r.event_id=e.id AND r.player_id=auth.uid();
  SELECT event_id INTO venue_link FROM venue_round_robin_links WHERE round_robin_id=e.id;
  IF venue_link IS NOT NULL THEN SELECT * INTO program FROM group_events WHERE id=venue_link; END IF;
  IF NOT (coalesce(manager,false) OR (verified AND coalesce(is_event_participant(e.id,auth.uid()),false))
    OR (registration.registration_status='waitlisted') OR coalesce(invited,false)
    OR (e.registration_mode='open_registration' AND e.is_published AND (e.group_visibility<>'private_group' OR member))
    OR (e.group_id IS NOT NULL AND member AND e.group_visibility IN ('private_group','shared_group'))
    OR (venue_link IS NOT NULL AND get_public_community(program.group_id,NULL) IS NOT NULL)) IS TRUE THEN RETURN NULL; END IF;

  SELECT count(*) FILTER (WHERE r.active AND coalesce(r.registration_status,'confirmed')='confirmed'),
    count(*) FILTER (WHERE r.registration_status='waitlisted') INTO confirmed,waiting
    FROM round_robin_players r WHERE r.event_id=e.id;
  IF e.status IN ('completed','voided') OR coalesce(e.voided,false) THEN closed:='This event is no longer accepting registrations.';
  ELSIF e.registration_deadline IS NOT NULL AND clock_timestamp()>=e.registration_deadline THEN closed:='Registration has closed for this event.';
  ELSIF e.date<CURRENT_DATE AND e.status<>'live' THEN closed:='This event has ended.';
  ELSIF venue_link IS NULL AND coalesce(e.registration_mode,'immediate')='immediate' AND NOT coalesce(invited,false) THEN closed:='Use the invitation link or code from the host to join this event.';
  ELSIF venue_link IS NULL AND e.registration_mode='open_registration' AND NOT coalesce(e.is_published,false) THEN closed:='Registration is not open yet.';
  ELSIF venue_link IS NULL AND e.registration_mode='invite_only' AND NOT coalesce(invited,false) THEN closed:='Use the invitation link or code from the host to register.';
  END IF;
  IF venue_link IS NOT NULL THEN
    SELECT r.status INTO venue_registration FROM group_event_rsvps r WHERE verified AND r.event_id=venue_link AND r.user_id=auth.uid();
    SELECT count(*) FILTER (WHERE r.status='going'),count(*) FILTER (WHERE r.status='waitlist') INTO confirmed,waiting
      FROM group_event_rsvps r WHERE r.event_id=venue_link;
    IF program.canceled_at IS NOT NULL THEN closed:='This event was canceled.';
    ELSIF program.registration_paused OR clock_timestamp()>=coalesce(program.registration_closes_at,program.start_time) THEN closed:='Registration has closed for this event.';
    ELSIF program.capacity IS NOT NULL AND confirmed>=program.capacity AND
      (NOT program.waitlist_enabled OR (program.waitlist_limit IS NOT NULL AND waiting>=program.waitlist_limit)) THEN closed:='This event and its waitlist are full.';
    END IF;
  END IF;
  RETURN jsonb_build_object(
    'event_id',e.id,'name',e.name,'date',e.date,'start_time',e.start_time,'location',e.location,'notes',e.notes,
    'status',e.status,'format',e.format,'num_courts',e.num_courts,'num_rounds',e.num_rounds,
    'registration_mode',e.registration_mode,'registration_deadline',e.registration_deadline,
    'max_players',CASE WHEN venue_link IS NOT NULL THEN program.capacity ELSE e.max_players END,
    'confirmed_count',confirmed,'waitlisted_count',waiting,'closed_reason',closed,
    'registration_status',CASE WHEN venue_link IS NOT NULL THEN CASE venue_registration WHEN 'going' THEN 'confirmed' WHEN 'waitlist' THEN 'waitlisted' END
      WHEN registration.registration_status='waitlisted' THEN 'waitlisted' WHEN registration.active THEN coalesce(registration.registration_status,'confirmed') END,
    'waitlist_position',CASE WHEN registration.registration_status='waitlisted' THEN
      (SELECT count(*) FROM round_robin_players r WHERE r.event_id=e.id AND r.registration_status='waitlisted' AND (r.joined_at,r.id)<=(registration.joined_at,registration.id)) END,
    'can_open',coalesce(manager,false) OR (verified AND coalesce(is_event_participant(e.id,auth.uid()),false) AND registration.registration_status IS DISTINCT FROM 'waitlisted'),
    'organizer_name',(SELECT coalesce(nullif(display_name,''),nullif(full_name,''),'Organizer') FROM profiles WHERE id=e.organizer_id),
    'venue_registration_path',CASE WHEN venue_link IS NOT NULL THEN '/player/community/group/'||program.group_id||'?tab=events&program='||program.id END,
    'price_cents',CASE WHEN venue_link IS NOT NULL THEN program.price_cents END,
    'currency',CASE WHEN venue_link IS NOT NULL THEN program.currency END
  );
END $$;
REVOKE ALL ON FUNCTION public.get_round_robin_entry(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_round_robin_entry(uuid,text) TO anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.join_round_robin_event(p_event_id uuid,p_invite_code text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e round_robin_events; existing round_robin_players; entry jsonb; n integer; outcome text; gender text;
BEGIN
  IF auth.uid() IS NULL OR NOT pulse_has_required_mfa() THEN RAISE EXCEPTION 'Sign in and complete verification to register.' USING ERRCODE='42501'; END IF;
  SELECT * INTO e FROM round_robin_events WHERE id=p_event_id FOR UPDATE;
  entry:=get_round_robin_entry(p_event_id,p_invite_code);
  IF entry IS NULL THEN RAISE EXCEPTION 'This invitation is unavailable. Ask the host for a new link.' USING ERRCODE='42501'; END IF;
  IF entry->>'venue_registration_path' IS NOT NULL THEN RAISE EXCEPTION 'Register through the venue to complete its payment and waiver requirements.'; END IF;
  SELECT * INTO existing FROM round_robin_players r WHERE r.event_id=e.id AND r.player_id=auth.uid();
  IF existing.registration_status='waitlisted' OR (existing.active AND coalesce(existing.registration_status,'confirmed')='confirmed') THEN
    RETURN jsonb_build_object('event_id',e.id,'registration_status',coalesce(existing.registration_status,'confirmed'),'message','Your registration is already saved.');
  END IF;
  IF entry->>'closed_reason' IS NOT NULL THEN RAISE EXCEPTION '%',entry->>'closed_reason'; END IF;
  SELECT lower(trim(p.gender)) INTO gender FROM profiles p WHERE p.id=auth.uid();
  IF (e.format IN ('male','female') AND gender IS DISTINCT FROM e.format) OR (e.format='mixed' AND coalesce(gender,'') NOT IN ('male','female')) THEN
    RAISE EXCEPTION 'Check your profile gender before registering for this event format.';
  END IF;
  SELECT count(*) INTO n FROM round_robin_players r WHERE r.event_id=e.id AND r.active AND coalesce(r.registration_status,'confirmed')='confirmed';
  outcome:=CASE WHEN e.max_players IS NOT NULL AND n>=e.max_players THEN 'waitlisted' ELSE 'confirmed' END;
  -- Use the saved identity, not FOUND (the capacity SELECT overwrites FOUND).
  IF existing.id IS NOT NULL THEN
    UPDATE round_robin_players SET registration_status=outcome,active=(outcome='confirmed'),
      status=CASE WHEN outcome='confirmed' THEN 'active'::rr_participant_status ELSE 'removed'::rr_participant_status END,joined_at=clock_timestamp()
      WHERE id=existing.id;
  ELSE
    INSERT INTO round_robin_players(event_id,player_id,registration_status,active,status,joined_at)
      VALUES(e.id,auth.uid(),outcome,outcome='confirmed',CASE WHEN outcome='confirmed' THEN 'active'::rr_participant_status ELSE 'removed'::rr_participant_status END,clock_timestamp());
  END IF;
  RETURN jsonb_build_object('event_id',e.id,'registration_status',outcome,'message',
    CASE WHEN outcome='waitlisted' THEN 'You are on the waitlist. Your place is saved.' ELSE 'You are registered. See you on the court!' END);
END $$;
REVOKE ALL ON FUNCTION public.join_round_robin_event(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.join_round_robin_event(uuid,text) TO authenticated,service_role;

-- Keep old invite links and installed clients on the same atomic registration.
CREATE OR REPLACE FUNCTION public.join_round_robin_by_code(p_code text)
RETURNS TABLE(event_id uuid,registration_status text,message text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb; target uuid;
BEGIN
  SELECT id INTO target FROM round_robin_events WHERE invite_code=upper(trim(p_code)) AND registration_mode IN ('invite_only','immediate');
  result:=join_round_robin_event(target,p_code);
  RETURN QUERY SELECT (result->>'event_id')::uuid,result->>'registration_status',result->>'message';
END $$;
REVOKE ALL ON FUNCTION public.join_round_robin_by_code(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.join_round_robin_by_code(text) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.preview_round_robin_by_code(p_code text)
RETURNS TABLE(event_id uuid,event_name text,event_date date,event_start_time text,event_status public.round_robin_status,
  num_courts integer,num_rounds integer,current_players integer,max_players integer,registration_deadline timestamptz,
  organizer_name text,organizer_avatar_url text,already_joined boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE target uuid; entry jsonb;
BEGIN
  SELECT id INTO target FROM round_robin_events WHERE invite_code=upper(trim(p_code)) AND registration_mode IN ('invite_only','immediate');
  entry:=get_round_robin_entry(target,p_code);
  IF entry IS NULL THEN RAISE EXCEPTION 'Invalid invite code' USING ERRCODE='02000'; END IF;
  RETURN QUERY SELECT target,entry->>'name',(entry->>'date')::date,entry->>'start_time',(entry->>'status')::round_robin_status,
    (entry->>'num_courts')::integer,(entry->>'num_rounds')::integer,(entry->>'confirmed_count')::integer,(entry->>'max_players')::integer,
    (entry->>'registration_deadline')::timestamptz,entry->>'organizer_name',NULL::text,entry->>'registration_status' IN ('confirmed','waitlisted');
END $$;
REVOKE ALL ON FUNCTION public.preview_round_robin_by_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preview_round_robin_by_code(text) TO anon,authenticated,service_role;
COMMIT;
