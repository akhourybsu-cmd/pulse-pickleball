-- Venue competitions reuse the established scoring and league engines.
-- The scheduled program remains the authority for courts, signups and payment.
BEGIN;

CREATE TABLE public.venue_round_robin_links (
  event_id uuid PRIMARY KEY REFERENCES public.group_events(id) ON DELETE RESTRICT,
  round_robin_id uuid NOT NULL UNIQUE REFERENCES public.round_robin_events(id) ON DELETE RESTRICT,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  roster_locked_at timestamptz
);
CREATE TABLE public.venue_league_links (
  league_id uuid PRIMARY KEY REFERENCES public.leagues(id) ON DELETE CASCADE,
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE RESTRICT,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE RESTRICT,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  request_id uuid UNIQUE
);
CREATE INDEX venue_league_links_group_idx ON public.venue_league_links(group_id);
ALTER TABLE public.venue_round_robin_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_league_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY venue_competition_read ON public.venue_round_robin_links FOR SELECT TO authenticated
 USING (EXISTS(SELECT 1 FROM public.group_events e WHERE e.id=event_id
   AND public.can_manage_venue_events(auth.uid(),e.venue_id,e.group_id)));
CREATE POLICY venue_competition_read ON public.venue_league_links FOR SELECT TO authenticated
 USING (public.can_manage_venue_events(auth.uid(),venue_id,group_id));
CREATE POLICY pulse_required_mfa ON public.venue_round_robin_links AS RESTRICTIVE FOR ALL TO authenticated
 USING ((SELECT public.pulse_has_required_mfa())) WITH CHECK ((SELECT public.pulse_has_required_mfa()));
CREATE POLICY pulse_required_mfa ON public.venue_league_links AS RESTRICTIVE FOR ALL TO authenticated
 USING ((SELECT public.pulse_has_required_mfa())) WITH CHECK ((SELECT public.pulse_has_required_mfa()));
REVOKE ALL ON public.venue_round_robin_links,public.venue_league_links FROM anon,authenticated;
GRANT SELECT ON public.venue_round_robin_links,public.venue_league_links TO authenticated;
GRANT ALL ON public.venue_round_robin_links,public.venue_league_links TO service_role;

CREATE FUNCTION public.can_manage_round_robin(p_event uuid,p_user uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT p_user IS NOT NULL AND (public.has_role(p_user,'admin'::public.app_role) OR EXISTS (
   SELECT 1 FROM round_robin_events r LEFT JOIN venue_round_robin_links l ON l.round_robin_id=r.id
   LEFT JOIN group_events e ON e.id=l.event_id WHERE r.id=p_event AND
   CASE WHEN l.event_id IS NOT NULL THEN public.can_manage_venue_events(p_user,e.venue_id,e.group_id)
        ELSE r.organizer_id=p_user END));
$$;
CREATE OR REPLACE FUNCTION public.is_league_admin(p_league_id uuid,p_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT p_user_id IS NOT NULL AND (public.has_role(p_user_id,'admin'::app_role)
   OR EXISTS(SELECT 1 FROM venue_league_links WHERE league_id=p_league_id
     AND public.can_manage_venue_events(p_user_id,venue_id,group_id))
   OR (NOT EXISTS(SELECT 1 FROM venue_league_links WHERE league_id=p_league_id) AND (
     EXISTS(SELECT 1 FROM leagues WHERE id=p_league_id AND created_by=p_user_id)
     OR EXISTS(SELECT 1 FROM league_members WHERE league_id=p_league_id AND user_id=p_user_id AND role='manager' AND status='active'))));
$$;
REVOKE ALL ON FUNCTION public.can_manage_round_robin(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_manage_round_robin(uuid,uuid) TO authenticated,service_role;
CREATE FUNCTION public.is_venue_round_robin(p_event uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM venue_round_robin_links WHERE round_robin_id=p_event)
$$;
REVOKE ALL ON FUNCTION public.is_venue_round_robin(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.is_venue_round_robin(uuid) TO authenticated,service_role;

-- Add shared staff access; restrictive policies also revoke legacy organizer
-- writes when that organizer no longer manages the linked venue.
CREATE POLICY venue_rr_read ON public.round_robin_events FOR SELECT TO authenticated
 USING (public.can_manage_round_robin(id));
CREATE POLICY venue_rr_update ON public.round_robin_events FOR UPDATE TO authenticated
 USING (public.can_manage_round_robin(id)) WITH CHECK (public.can_manage_round_robin(id));
CREATE POLICY venue_rr_write_scope ON public.round_robin_events AS RESTRICTIVE FOR UPDATE TO authenticated
 USING (public.can_manage_round_robin(id)) WITH CHECK (public.can_manage_round_robin(id));
CREATE POLICY venue_rr_delete_scope ON public.round_robin_events AS RESTRICTIVE FOR DELETE TO authenticated
 USING (public.can_manage_round_robin(id));
DO $$ DECLARE t text; operation text; BEGIN
 FOREACH t IN ARRAY ARRAY['round_robin_players','round_robin_schedule','round_robin_audit'] LOOP
   EXECUTE format('CREATE POLICY venue_rr_staff ON public.%I FOR ALL TO authenticated USING (public.can_manage_round_robin(event_id)) WITH CHECK (public.can_manage_round_robin(event_id))',t);
   FOREACH operation IN ARRAY ARRAY['UPDATE','DELETE'] LOOP
     EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR %s TO authenticated USING (NOT public.is_venue_round_robin(event_id) OR public.can_manage_round_robin(event_id))', 'venue_rr_scope_'||lower(operation),t,operation);
   END LOOP;
   EXECUTE format('CREATE POLICY venue_rr_scope_insert ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT public.is_venue_round_robin(event_id) OR public.can_manage_round_robin(event_id))',t);
 END LOOP;
END $$;

-- Keep every existing scheduling/scoring validation. Only replace the narrow
-- organizer authorization expressions in the current installed definitions.
DO $$
DECLARE spec record; f record; definition text; changed text;
BEGIN
 FOR spec IN SELECT * FROM (VALUES
   ('rr_apply_schedule_rebuild','v_event.organizer_id <> p_actor_id','NOT public.can_manage_round_robin(p_event_id,p_actor_id)'),
   ('rr_edit_schedule','v_event.organizer_id <> v_actor','NOT public.can_manage_round_robin(p_event_id,v_actor)'),
   ('rr_substitute_round','v_event.organizer_id <> v_actor','NOT public.can_manage_round_robin(p_event_id,v_actor)'),
   ('rr_close_round','v_event.organizer_id IS DISTINCT FROM v_actor','NOT public.can_manage_round_robin(p_event_id,v_actor)'),
   ('rr_manage_participant','(v_event.organizer_id = v_actor)','public.can_manage_round_robin(p_event_id,v_actor)'),
   ('submit_rr_match_score','v_event.organizer_id <> v_user_id','NOT public.can_manage_round_robin(v_event.id,v_user_id)'),
   ('void_round_robin_event','v_organizer_id <> auth.uid()','NOT public.can_manage_round_robin(p_event_id,auth.uid())'),
   ('delete_round_robin_event','v_organizer_id <> auth.uid()','NOT public.can_manage_round_robin(p_event_id,auth.uid())')
 ) AS s(name,old_text,new_text) LOOP
   SELECT p.oid INTO STRICT f FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=spec.name;
   definition:=pg_get_functiondef(f.oid);
   changed:=replace(definition,spec.old_text,spec.new_text);
   IF changed=definition THEN RAISE EXCEPTION 'Unexpected authorization definition: %',spec.name; END IF;
   EXECUTE changed;
 END LOOP;
END $$;

CREATE FUNCTION public.sync_venue_round_robin(p_event uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e group_events; l venue_round_robin_links; zone text; n integer;
BEGIN
 SELECT * INTO e FROM group_events WHERE id=p_event;
 SELECT * INTO l FROM venue_round_robin_links WHERE event_id=p_event;
 IF NOT FOUND OR l.roster_locked_at IS NOT NULL THEN RETURN; END IF;
 PERFORM id FROM round_robin_events WHERE id=l.round_robin_id FOR UPDATE;
 SELECT coalesce(timezone,'America/New_York') INTO zone FROM venues WHERE id=e.venue_id;
 SELECT count(*) INTO n FROM group_events WHERE parent_event_id=e.id AND event_format='program_hold';
 IF n=0 OR e.canceled_at IS NOT NULL THEN RETURN; END IF;
 UPDATE round_robin_events SET name=e.title,notes=e.description,location=(SELECT name FROM venues WHERE id=e.venue_id),
   date=(e.start_time AT TIME ZONE zone)::date,start_time=(e.start_time AT TIME ZONE zone)::time,
   num_courts=n,max_players=e.capacity,games_per_player=coalesce(e.rr_games_per_player,3),
   registration_deadline=coalesce(e.registration_closes_at,e.start_time)
 WHERE id=l.round_robin_id;
 DELETE FROM round_robin_players p WHERE p.event_id=l.round_robin_id AND NOT EXISTS
   (SELECT 1 FROM group_event_rsvps s WHERE s.event_id=e.id AND s.user_id=p.player_id AND s.status='going');
 INSERT INTO round_robin_players(event_id,player_id,registration_status,active,status)
   SELECT l.round_robin_id,s.user_id,'confirmed',true,'active' FROM group_event_rsvps s
   WHERE s.event_id=e.id AND s.status='going'
   ON CONFLICT(event_id,player_id) DO UPDATE SET active=true,status='active',registration_status='confirmed';
END $$;
REVOKE ALL ON FUNCTION public.sync_venue_round_robin(uuid) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.setup_venue_round_robin(p_event uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e group_events; result uuid; n integer; zone text;
BEGIN
 SELECT * INTO e FROM group_events WHERE id=p_event FOR UPDATE;
 IF NOT FOUND OR NOT public.can_manage_venue_events(auth.uid(),e.venue_id,e.group_id) THEN
   RAISE EXCEPTION 'Venue event management access required' USING ERRCODE='42501'; END IF;
 SELECT round_robin_id INTO result FROM venue_round_robin_links WHERE event_id=e.id;
 IF result IS NOT NULL THEN RETURN result; END IF;
 IF e.event_format<>'round_robin' OR e.parent_event_id IS NOT NULL OR e.canceled_at IS NOT NULL OR e.end_time<=now() THEN
   RAISE EXCEPTION 'Choose an upcoming round-robin program'; END IF;
 IF NOT public.venue_has_module(e.venue_id,'facility_tools') THEN RAISE EXCEPTION 'Enable facility operations to set up competitions'; END IF;
 SELECT count(*) INTO n FROM group_events h JOIN venue_courts c ON c.id=h.venue_court_id
   WHERE h.parent_event_id=e.id AND h.event_format='program_hold' AND c.venue_id=e.venue_id AND c.is_active;
 IF n<1 THEN RAISE EXCEPTION 'Assign courts to this event before setting up play'; END IF;
 SELECT coalesce(timezone,'America/New_York') INTO zone FROM venues WHERE id=e.venue_id;
 INSERT INTO round_robin_events(name,notes,organizer_id,venue_id,group_id,group_visibility,location,date,start_time,
   num_courts,num_rounds,games_per_player,max_players,registration_deadline,registration_mode,is_published,status,rating_eligible,rating_type,format,allow_guests)
 VALUES(e.title,e.description,auth.uid(),e.venue_id,e.group_id,'shared_group',(SELECT name FROM venues WHERE id=e.venue_id),
   (e.start_time AT TIME ZONE zone)::date,(e.start_time AT TIME ZONE zone)::time,n,1,coalesce(e.rr_games_per_player,3),e.capacity,
   coalesce(e.registration_closes_at,e.start_time),'immediate',false,'draft',false,'league','open',false) RETURNING id INTO result;
 INSERT INTO venue_round_robin_links(event_id,round_robin_id,created_by) VALUES(e.id,result,auth.uid());
 PERFORM public.sync_venue_round_robin(e.id);
 RETURN result;
END $$;

CREATE FUNCTION public.prepare_venue_round_robin(p_event uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e group_events; l venue_round_robin_links;
BEGIN
 SELECT * INTO e FROM group_events WHERE id=p_event FOR UPDATE;
 IF NOT FOUND OR NOT public.can_manage_venue_events(auth.uid(),e.venue_id,e.group_id) THEN
   RAISE EXCEPTION 'Venue event management access required' USING ERRCODE='42501'; END IF;
 SELECT * INTO l FROM venue_round_robin_links WHERE event_id=e.id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Set up the round robin first'; END IF;
 IF l.roster_locked_at IS NOT NULL THEN RETURN l.round_robin_id; END IF;
 IF e.canceled_at IS NOT NULL OR e.end_time<=now() THEN RAISE EXCEPTION 'This event has ended or was canceled'; END IF;
 IF EXISTS(SELECT 1 FROM payment_orders WHERE program_event_id=e.id AND status='pending' AND livemode) THEN
   RAISE EXCEPTION 'Wait for pending checkouts to finish or expire before closing registration'; END IF;
 IF (SELECT count(*) FROM group_event_rsvps WHERE event_id=e.id AND status='going')<4 THEN
   RAISE EXCEPTION 'At least four confirmed players are needed to prepare play'; END IF;
 PERFORM public.sync_venue_round_robin(e.id);
 UPDATE venue_round_robin_links SET roster_locked_at=now() WHERE event_id=e.id;
 UPDATE group_events SET registration_paused=true,updated_at=clock_timestamp() WHERE id=e.id;
 RETURN l.round_robin_id;
END $$;

-- No second registration path or invented players on imported events. After
-- preparation, staff use the existing substitution/withdrawal workflow.
CREATE FUNCTION public.guard_venue_round_robin_player() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l venue_round_robin_links; target uuid;
BEGIN
 target:=CASE WHEN TG_OP='DELETE' THEN OLD.event_id ELSE NEW.event_id END;
 IF TG_OP='UPDATE' AND NEW.event_id IS DISTINCT FROM OLD.event_id THEN RAISE EXCEPTION 'Participant event cannot change'; END IF;
 SELECT * INTO l FROM venue_round_robin_links WHERE round_robin_id=target;
 IF NOT FOUND THEN RETURN coalesce(NEW,OLD); END IF;
 IF l.roster_locked_at IS NULL THEN
   IF TG_OP='DELETE' THEN
     IF EXISTS(SELECT 1 FROM group_event_rsvps WHERE event_id=l.event_id AND user_id=OLD.player_id AND status='going') THEN
       RAISE EXCEPTION 'Manage registrations in the venue event'; END IF;
   ELSIF NEW.player_id IS NULL OR NEW.guest_player_id IS NOT NULL OR NOT NEW.active OR NEW.status<>'active'
     OR NEW.registration_status<>'confirmed' OR NOT EXISTS(SELECT 1 FROM group_event_rsvps WHERE event_id=l.event_id AND user_id=NEW.player_id AND status='going') THEN
     RAISE EXCEPTION 'Manage registrations in the venue event';
   END IF;
 ELSE
   IF auth.uid() IS NOT NULL AND NOT public.can_manage_round_robin(target) THEN RAISE EXCEPTION 'Venue organizer access required' USING ERRCODE='42501'; END IF;
   IF TG_OP<>'DELETE' AND (TG_OP='INSERT' OR NEW.active) AND (NEW.player_id IS NULL OR NOT EXISTS(SELECT 1 FROM group_event_rsvps WHERE event_id=l.event_id AND user_id=NEW.player_id AND status='going')) THEN
     RAISE EXCEPTION 'Only confirmed event registrations can join this round robin'; END IF;
 END IF;
 RETURN coalesce(NEW,OLD);
END $$;
CREATE TRIGGER guard_venue_round_robin_player BEFORE INSERT OR UPDATE OR DELETE ON public.round_robin_players
 FOR EACH ROW EXECUTE FUNCTION public.guard_venue_round_robin_player();

CREATE FUNCTION public.guard_venue_round_robin() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l venue_round_robin_links; e group_events; zone text;
BEGIN
 SELECT * INTO l FROM venue_round_robin_links WHERE round_robin_id=NEW.id;
 IF NOT FOUND THEN RETURN NEW; END IF;
 SELECT * INTO e FROM group_events WHERE id=l.event_id;
 SELECT coalesce(timezone,'America/New_York') INTO zone FROM venues WHERE id=e.venue_id;
 IF NEW.venue_id IS DISTINCT FROM e.venue_id OR NEW.group_id IS DISTINCT FROM e.group_id
   OR NEW.organizer_id IS DISTINCT FROM OLD.organizer_id OR NEW.registration_mode<>'immediate' OR NEW.is_published
   OR NEW.name IS DISTINCT FROM e.title OR NEW.notes IS DISTINCT FROM e.description
   OR NEW.date IS DISTINCT FROM (e.start_time AT TIME ZONE zone)::date OR NEW.start_time IS DISTINCT FROM (e.start_time AT TIME ZONE zone)::time
   OR NEW.num_courts IS DISTINCT FROM (SELECT count(*)::integer FROM group_events WHERE parent_event_id=e.id AND event_format='program_hold')
   OR NEW.max_players IS DISTINCT FROM e.capacity THEN
   IF e.canceled_at IS NULL THEN RAISE EXCEPTION 'Edit schedule, courts and registration in venue event management'; END IF;
 END IF;
 IF NEW.status='live' AND (l.roster_locked_at IS NULL OR e.canceled_at IS NOT NULL) THEN
   RAISE EXCEPTION 'Close venue registration and prepare play before starting'; END IF;
 IF NEW.voided AND NOT coalesce(OLD.voided,false) AND e.canceled_at IS NULL THEN
   RAISE EXCEPTION 'Cancel the venue event in event management to close registration and retain payment history'; END IF;
 IF NEW.status='live' AND OLD.status<>'live' AND NOT EXISTS(SELECT 1 FROM round_robin_schedule WHERE event_id=NEW.id AND NOT is_bye AND voided_at IS NULL AND superseded_by_schedule_id IS NULL) THEN
   RAISE EXCEPTION 'Generate a schedule before starting'; END IF;
 IF NEW.status='live' AND OLD.status<>'live' AND EXISTS(SELECT 1 FROM round_robin_players p WHERE p.event_id=NEW.id AND p.active
   AND NOT EXISTS(SELECT 1 FROM group_event_rsvps s WHERE s.event_id=e.id AND s.user_id=p.player_id AND s.status='going')) THEN
   RAISE EXCEPTION 'Review withdrawn registrations and update the playing roster before starting'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_venue_round_robin BEFORE UPDATE ON public.round_robin_events
 FOR EACH ROW EXECUTE FUNCTION public.guard_venue_round_robin();
CREATE FUNCTION public.guard_venue_rr_schedule() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM venue_round_robin_links WHERE round_robin_id=NEW.event_id AND roster_locked_at IS NULL) THEN
   RAISE EXCEPTION 'Close venue registration and prepare play before generating a schedule'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_venue_rr_schedule BEFORE INSERT ON public.round_robin_schedule FOR EACH ROW EXECUTE FUNCTION public.guard_venue_rr_schedule();

CREATE FUNCTION public.sync_venue_competition_registration() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM public.sync_venue_round_robin(CASE WHEN TG_OP='DELETE' THEN OLD.event_id ELSE NEW.event_id END);
 RETURN coalesce(NEW,OLD);
END $$;
CREATE TRIGGER sync_venue_competition_registration AFTER INSERT OR UPDATE OR DELETE ON public.group_event_rsvps
 FOR EACH ROW EXECUTE FUNCTION public.sync_venue_competition_registration();

CREATE FUNCTION public.guard_venue_competition_program() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l venue_round_robin_links; source_id uuid;
BEGIN
 source_id:=coalesce(OLD.parent_event_id,OLD.id);
 SELECT * INTO l FROM venue_round_robin_links WHERE event_id=source_id;
 IF NOT FOUND THEN RETURN coalesce(NEW,OLD); END IF;
 IF TG_OP='UPDATE' AND OLD.parent_event_id IS NULL AND NEW.canceled_at IS NULL THEN
   IF NEW.event_format<>'round_robin' THEN RAISE EXCEPTION 'A linked round robin must keep its event format'; END IF;
   IF l.roster_locked_at IS NOT NULL AND (NOT NEW.registration_paused OR
     ROW(NEW.title,NEW.description,NEW.start_time,NEW.end_time,NEW.capacity,NEW.rr_games_per_player,NEW.price_cents,NEW.skill_level_min,NEW.skill_level_max,NEW.rotation_style)
     IS DISTINCT FROM ROW(OLD.title,OLD.description,OLD.start_time,OLD.end_time,OLD.capacity,OLD.rr_games_per_player,OLD.price_cents,OLD.skill_level_min,OLD.skill_level_max,OLD.rotation_style)) THEN
     RAISE EXCEPTION 'This round robin is prepared for play. Its scheduled details and registration are locked'; END IF;
 END IF;
 IF OLD.parent_event_id IS NOT NULL AND l.roster_locked_at IS NOT NULL AND EXISTS(SELECT 1 FROM group_events WHERE id=source_id AND canceled_at IS NULL) THEN
   RAISE EXCEPTION 'Courts are locked while this round robin is prepared for play'; END IF;
 RETURN coalesce(NEW,OLD);
END $$;
CREATE TRIGGER guard_venue_competition_program BEFORE UPDATE OR DELETE ON public.group_events
 FOR EACH ROW EXECUTE FUNCTION public.guard_venue_competition_program();
-- Deferred: court replacement must be complete before copying the court count.
CREATE FUNCTION public.sync_venue_competition_program() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE source_id uuid; rr uuid;
BEGIN
 source_id:=coalesce(NEW.parent_event_id,NEW.id);
 SELECT round_robin_id INTO rr FROM venue_round_robin_links WHERE event_id=source_id;
 IF rr IS NOT NULL THEN
   IF EXISTS(SELECT 1 FROM group_events WHERE id=source_id AND canceled_at IS NOT NULL) THEN
     IF EXISTS(SELECT 1 FROM round_robin_events WHERE id=rr AND NOT coalesce(voided,false)) THEN
       PERFORM public.void_round_robin_event(rr,'Venue event canceled'); END IF;
   ELSE PERFORM public.sync_venue_round_robin(source_id); END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER sync_venue_competition_program AFTER INSERT OR UPDATE ON public.group_events
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.sync_venue_competition_program();

CREATE FUNCTION public.link_venue_league(p_group uuid,p_league uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v uuid; l leagues; existing venue_league_links;
BEGIN
 SELECT venue_id INTO v FROM groups WHERE id=p_group;
 IF NOT public.can_manage_venue_events(auth.uid(),v,p_group) THEN RAISE EXCEPTION 'Venue event management access required' USING ERRCODE='42501'; END IF;
 SELECT * INTO l FROM leagues WHERE id=p_league FOR UPDATE;
 IF NOT FOUND OR l.created_by IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Only the league owner can connect it to a venue' USING ERRCODE='42501'; END IF;
 SELECT * INTO existing FROM venue_league_links WHERE league_id=p_league;
 IF FOUND THEN
   IF existing.group_id<>p_group THEN RAISE EXCEPTION 'This league is already managed by another venue'; END IF;
   RETURN p_league;
 END IF;
 IF l.community_id IS NOT NULL AND l.community_id<>p_group THEN RAISE EXCEPTION 'This league belongs to another community'; END IF;
 INSERT INTO venue_league_links(league_id,venue_id,group_id,created_by) VALUES(p_league,v,p_group,auth.uid());
 UPDATE leagues SET community_id=p_group WHERE id=p_league;
 RETURN p_league;
END $$;
CREATE FUNCTION public.create_venue_league(p_group uuid,p_name text,p_description text,p_type text,p_request uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v uuid; result uuid; existing venue_league_links;
BEGIN
 SELECT venue_id INTO v FROM groups WHERE id=p_group;
 IF NOT public.can_manage_venue_events(auth.uid(),v,p_group) THEN RAISE EXCEPTION 'Venue event management access required' USING ERRCODE='42501'; END IF;
 IF p_request IS NULL OR length(trim(p_name)) NOT BETWEEN 1 AND 150 THEN RAISE EXCEPTION 'Enter a league name and request identifier'; END IF;
 -- Serialize quota checks and idempotent retries for the existing account owner.
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text,282200));
 SELECT * INTO existing FROM venue_league_links WHERE request_id=p_request;
 IF FOUND THEN
   IF existing.group_id<>p_group OR existing.created_by<>auth.uid() THEN RAISE EXCEPTION 'Request belongs to another venue'; END IF;
   RETURN existing.league_id;
 END IF;
 result:=public.create_league(p_name,p_description,(SELECT name FROM venues WHERE id=v),p_type);
 PERFORM public.link_venue_league(p_group,result);
 UPDATE venue_league_links SET request_id=p_request WHERE league_id=result;
 RETURN result;
END $$;
CREATE FUNCTION public.guard_venue_league_context() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM venue_league_links WHERE league_id=NEW.id AND group_id IS DISTINCT FROM NEW.community_id) THEN
   RAISE EXCEPTION 'This league is managed in its connected venue'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_venue_league_context BEFORE UPDATE ON public.leagues FOR EACH ROW EXECUTE FUNCTION public.guard_venue_league_context();

CREATE FUNCTION public.get_venue_competitions(p_group uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v uuid;
BEGIN
 SELECT venue_id INTO v FROM groups WHERE id=p_group;
 IF NOT public.can_manage_venue_events(auth.uid(),v,p_group) THEN RAISE EXCEPTION 'Venue event management access required' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object(
   'venue',(SELECT jsonb_build_object('id',id,'name',name,'timezone',timezone) FROM venues WHERE id=v),
   'round_robins',coalesce((SELECT jsonb_agg(row_to_json(x) ORDER BY x.start_time) FROM (
     SELECT e.id,e.title,e.start_time,e.end_time,e.canceled_at,e.capacity,e.price_cents,e.description,e.skill_level_min,e.skill_level_max,e.rotation_style,
       coalesce(e.rr_games_per_player,3) games_per_player,l.round_robin_id,l.roster_locked_at,r.status,
       (SELECT count(*) FROM group_event_rsvps WHERE event_id=e.id AND status='going') confirmed,
       (SELECT count(*) FROM round_robin_players WHERE event_id=l.round_robin_id AND active) playing,
       (SELECT count(*) FROM group_event_rsvps s WHERE s.event_id=e.id AND s.status='going' AND NOT EXISTS(SELECT 1 FROM round_robin_players p WHERE p.event_id=l.round_robin_id AND p.player_id=s.user_id AND p.active)) roster_additions,
       (SELECT count(*) FROM round_robin_players p WHERE p.event_id=l.round_robin_id AND p.active AND NOT EXISTS(SELECT 1 FROM group_event_rsvps s WHERE s.event_id=e.id AND s.user_id=p.player_id AND s.status='going')) roster_withdrawals,
       coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'court_number',c.court_number) ORDER BY c.court_number,c.id) FROM group_events h JOIN venue_courts c ON c.id=h.venue_court_id WHERE h.parent_event_id=e.id),'[]'::jsonb) courts
     FROM group_events e LEFT JOIN venue_round_robin_links l ON l.event_id=e.id LEFT JOIN round_robin_events r ON r.id=l.round_robin_id
     WHERE e.group_id=p_group AND e.venue_id=v AND e.event_format='round_robin' AND e.parent_event_id IS NULL
       AND (e.end_time>now()-interval '180 days' OR l.round_robin_id IS NOT NULL)
     ORDER BY e.start_time DESC LIMIT 500
   ) x),'[]'::jsonb),
   'leagues',coalesce((SELECT jsonb_agg(jsonb_build_object('id',l.id,'name',l.name,'status',l.status,'league_type',l.league_type,
     'seasons',(SELECT count(*) FROM league_seasons WHERE league_id=l.id),
     'members',(SELECT count(DISTINCT user_id) FROM league_members WHERE league_id=l.id AND status='active' AND role<>'manager')) ORDER BY l.created_at DESC)
     FROM venue_league_links link JOIN leagues l ON l.id=link.league_id WHERE link.group_id=p_group),'[]'::jsonb),
   'available_leagues',coalesce((SELECT jsonb_agg(jsonb_build_object('id',l.id,'name',l.name) ORDER BY l.name) FROM leagues l
     WHERE l.created_by=auth.uid() AND (l.community_id IS NULL OR l.community_id=p_group)
       AND NOT EXISTS(SELECT 1 FROM venue_league_links WHERE league_id=l.id)),'[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.setup_venue_round_robin(uuid),public.prepare_venue_round_robin(uuid),public.link_venue_league(uuid,uuid),public.create_venue_league(uuid,text,text,text,uuid),public.get_venue_competitions(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.setup_venue_round_robin(uuid),public.prepare_venue_round_robin(uuid),public.link_venue_league(uuid,uuid),public.create_venue_league(uuid,text,text,text,uuid),public.get_venue_competitions(uuid) TO authenticated;
-- Preserve the event-level game count when editing through the existing RPC.
DO $$ DECLARE d text; patched text; BEGIN
 d:=pg_get_functiondef('public.update_venue_program(uuid,jsonb,uuid[],timestamptz)'::regprocedure);
 patched:=replace(d,'rotation_style=proposed.rotation_style,','rotation_style=proposed.rotation_style,rr_games_per_player=proposed.rr_games_per_player,');
 IF patched=d THEN RAISE EXCEPTION 'Unexpected venue event update definition'; END IF;
 EXECUTE patched;
END $$;
ALTER TABLE public.group_events ADD CONSTRAINT venue_rr_game_count CHECK(rr_games_per_player IS NULL OR rr_games_per_player BETWEEN 1 AND 20) NOT VALID;
COMMIT;
