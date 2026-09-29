BEGIN;
ALTER TABLE venue_customers ADD COLUMN competition_guest_id uuid UNIQUE REFERENCES guest_players(id) ON DELETE SET NULL;
CREATE FUNCTION public.venue_competition_confirmed(p_event uuid,p_player uuid,p_guest uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT (p_player IS NOT NULL AND p_guest IS NULL AND EXISTS(SELECT 1 FROM group_event_rsvps WHERE event_id=p_event AND user_id=p_player AND status='going'))
 OR EXISTS(SELECT 1 FROM venue_visits v JOIN venue_customers c ON c.id=v.customer_id WHERE v.event_id=p_event AND v.status IN ('expected','checked_in','no_show') AND ((p_player IS NOT NULL AND p_guest IS NULL AND c.user_id=p_player) OR (p_player IS NULL AND p_guest IS NOT NULL AND c.user_id IS NULL AND c.competition_guest_id=p_guest)))
$$;
CREATE OR REPLACE FUNCTION public.sync_venue_round_robin(p_event uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e group_events;l venue_round_robin_links;zone text;n integer;c venue_customers;guest uuid;
BEGIN
 SELECT * INTO e FROM group_events WHERE id=p_event;
 SELECT * INTO l FROM venue_round_robin_links WHERE event_id=p_event;
 IF NOT FOUND OR l.roster_locked_at IS NOT NULL THEN RETURN; END IF;
 PERFORM id FROM round_robin_events WHERE id=l.round_robin_id FOR UPDATE;
 SELECT coalesce(timezone,'America/New_York') INTO zone FROM venues WHERE id=e.venue_id;
 SELECT count(*) INTO n FROM group_events WHERE parent_event_id=e.id AND event_format='program_hold';
 IF n=0 OR e.canceled_at IS NOT NULL THEN RETURN; END IF;
 FOR c IN SELECT cu.* FROM venue_customers cu WHERE cu.user_id IS NULL AND cu.competition_guest_id IS NULL AND EXISTS(SELECT 1 FROM venue_visits WHERE event_id=e.id AND customer_id=cu.id AND status IN ('expected','checked_in','no_show')) FOR UPDATE LOOP
  INSERT INTO guest_players(display_name,created_by,group_id) VALUES(CASE WHEN c.first_name LIKE '%@%' THEN 'Guest' ELSE split_part(c.first_name,' ',1) END||CASE WHEN c.last_name<>'' AND c.last_name NOT LIKE '%@%' THEN ' '||upper(left(c.last_name,1))||'.' ELSE '' END,e.created_by,e.group_id) RETURNING id INTO guest;
  UPDATE venue_customers SET competition_guest_id=guest WHERE id=c.id;
 END LOOP;
 UPDATE round_robin_events SET name=e.title,notes=e.description,location=(SELECT name FROM venues WHERE id=e.venue_id),date=(e.start_time AT TIME ZONE zone)::date,start_time=(e.start_time AT TIME ZONE zone)::time,num_courts=n,max_players=e.capacity,games_per_player=coalesce(e.rr_games_per_player,3),registration_deadline=coalesce(e.registration_closes_at,e.start_time),allow_guests=EXISTS(SELECT 1 FROM venue_visits v JOIN venue_customers cu ON cu.id=v.customer_id WHERE v.event_id=e.id AND cu.user_id IS NULL AND v.status IN ('expected','checked_in','no_show')) WHERE id=l.round_robin_id;
 DELETE FROM round_robin_players p WHERE p.event_id=l.round_robin_id AND NOT venue_competition_confirmed(e.id,p.player_id,p.guest_player_id);
 INSERT INTO round_robin_players(event_id,player_id,registration_status,active,status)
 SELECT l.round_robin_id,x.user_id,'confirmed',true,'active' FROM (
  SELECT user_id FROM group_event_rsvps WHERE event_id=e.id AND status='going'
  UNION SELECT cu.user_id FROM venue_visits v JOIN venue_customers cu ON cu.id=v.customer_id WHERE v.event_id=e.id AND cu.user_id IS NOT NULL AND v.status IN ('expected','checked_in','no_show')
 ) x ON CONFLICT(event_id,player_id) WHERE player_id IS NOT NULL DO UPDATE SET active=true,status='active',registration_status='confirmed';
 INSERT INTO round_robin_players(event_id,guest_player_id,registration_status,active,status)
 SELECT l.round_robin_id,cu.competition_guest_id,'confirmed',true,'active' FROM venue_visits v JOIN venue_customers cu ON cu.id=v.customer_id WHERE v.event_id=e.id AND cu.user_id IS NULL AND v.status IN ('expected','checked_in','no_show')
 ON CONFLICT(event_id,guest_player_id) WHERE guest_player_id IS NOT NULL DO UPDATE SET active=true,status='active',registration_status='confirmed';
END $$;
CREATE OR REPLACE FUNCTION public.guard_venue_round_robin_player() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l venue_round_robin_links;target uuid;
BEGIN
 target:=CASE WHEN TG_OP='DELETE' THEN OLD.event_id ELSE NEW.event_id END;
 IF TG_OP='UPDATE' AND NEW.event_id IS DISTINCT FROM OLD.event_id THEN RAISE EXCEPTION 'Participant event cannot change'; END IF;
 SELECT * INTO l FROM venue_round_robin_links WHERE round_robin_id=target;
 IF NOT FOUND THEN RETURN coalesce(NEW,OLD); END IF;
 IF l.roster_locked_at IS NULL THEN
  IF TG_OP='DELETE' THEN
   IF venue_competition_confirmed(l.event_id,OLD.player_id,OLD.guest_player_id) THEN RAISE EXCEPTION 'Manage registrations in the venue event'; END IF;
  ELSIF NOT NEW.active OR NEW.status<>'active' OR NEW.registration_status<>'confirmed' OR NOT venue_competition_confirmed(l.event_id,NEW.player_id,NEW.guest_player_id) THEN RAISE EXCEPTION 'Manage registrations in the venue event'; END IF;
 ELSE
  IF auth.uid() IS NOT NULL AND NOT can_manage_round_robin(target) THEN RAISE EXCEPTION 'Venue organizer access required' USING ERRCODE='42501'; END IF;
  IF TG_OP<>'DELETE' AND (TG_OP='INSERT' OR NEW.active) AND NOT venue_competition_confirmed(l.event_id,NEW.player_id,NEW.guest_player_id) THEN RAISE EXCEPTION 'Only confirmed event registrations can join this round robin'; END IF;
 END IF;RETURN coalesce(NEW,OLD);
END $$;
CREATE OR REPLACE FUNCTION public.prepare_venue_round_robin(p_event uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e group_events;l venue_round_robin_links;
BEGIN
 SELECT * INTO e FROM group_events WHERE id=p_event FOR UPDATE;
 IF NOT FOUND OR NOT can_manage_venue_events(auth.uid(),e.venue_id,e.group_id) THEN RAISE EXCEPTION 'Venue event management access required' USING ERRCODE='42501'; END IF;
 SELECT * INTO l FROM venue_round_robin_links WHERE event_id=e.id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Set up the round robin first'; END IF;
 IF l.roster_locked_at IS NOT NULL THEN RETURN l.round_robin_id; END IF;
 IF e.canceled_at IS NOT NULL OR e.end_time<=now() THEN RAISE EXCEPTION 'This event has ended or was canceled'; END IF;
 IF EXISTS(SELECT 1 FROM payment_orders WHERE program_event_id=e.id AND status='pending' AND livemode) OR EXISTS(SELECT 1 FROM venue_visits WHERE event_id=e.id AND status='pending_payment') THEN RAISE EXCEPTION 'Wait for pending checkouts to finish or expire before closing registration'; END IF;
 PERFORM sync_venue_round_robin(e.id);
 IF (SELECT count(*) FROM round_robin_players WHERE event_id=l.round_robin_id AND active)<4 THEN RAISE EXCEPTION 'At least four confirmed players are needed to prepare play'; END IF;
 UPDATE venue_round_robin_links SET roster_locked_at=now() WHERE event_id=e.id;
 UPDATE group_events SET registration_paused=true,updated_at=clock_timestamp() WHERE id=e.id;
 RETURN l.round_robin_id;
END $$;
CREATE FUNCTION public.sync_venue_desk_competition() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.event_id IS NOT NULL THEN PERFORM sync_venue_round_robin(NEW.event_id); END IF; RETURN NEW;
END $$;
CREATE TRIGGER sync_venue_desk_competition AFTER INSERT OR UPDATE ON venue_visits FOR EACH ROW EXECUTE FUNCTION sync_venue_desk_competition();
-- Shared venue organizers may read abbreviated guest identities in their events.
CREATE POLICY venue_guest_roster_read ON guest_players FOR SELECT TO authenticated USING (EXISTS(SELECT 1 FROM round_robin_players p WHERE p.guest_player_id=guest_players.id AND can_manage_round_robin(p.event_id)));
REVOKE ALL ON FUNCTION venue_competition_confirmed(uuid,uuid,uuid),sync_venue_desk_competition() FROM PUBLIC,anon,authenticated;
-- Updated start-of-play guard and management projections follow below.

CREATE OR REPLACE FUNCTION public.guard_venue_round_robin() RETURNS trigger
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
   AND NOT venue_competition_confirmed(e.id,p.player_id,p.guest_player_id)) THEN
   RAISE EXCEPTION 'Review withdrawn registrations and update the playing roster before starting'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.get_venue_competitions(p_group uuid) RETURNS jsonb
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
       ((SELECT count(*) FROM group_event_rsvps WHERE event_id=e.id AND status='going')+(SELECT count(*) FROM venue_visits WHERE event_id=e.id AND status IN ('expected','checked_in','no_show'))) confirmed,
       (SELECT count(*) FROM round_robin_players WHERE event_id=l.round_robin_id AND active) playing,
       ((SELECT count(*) FROM group_event_rsvps s WHERE s.event_id=e.id AND s.status='going' AND NOT EXISTS(SELECT 1 FROM round_robin_players p WHERE p.event_id=l.round_robin_id AND p.player_id=s.user_id AND p.active))+(SELECT count(*) FROM venue_visits vi JOIN venue_customers cu ON cu.id=vi.customer_id WHERE vi.event_id=e.id AND vi.status IN ('expected','checked_in','no_show') AND NOT EXISTS(SELECT 1 FROM round_robin_players p WHERE p.event_id=l.round_robin_id AND p.active AND (p.player_id=cu.user_id OR p.guest_player_id=cu.competition_guest_id)))) roster_additions,
       (SELECT count(*) FROM round_robin_players p WHERE p.event_id=l.round_robin_id AND p.active AND NOT venue_competition_confirmed(e.id,p.player_id,p.guest_player_id)) roster_withdrawals,
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
COMMIT;
