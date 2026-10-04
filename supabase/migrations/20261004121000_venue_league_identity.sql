BEGIN;
-- Preserve league identity in the venue management workspace.
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
   'leagues',coalesce((SELECT jsonb_agg(jsonb_build_object('id',l.id,'name',l.name,'status',l.status,'league_type',l.league_type,'branding',l.branding,
     'seasons',(SELECT count(*) FROM league_seasons WHERE league_id=l.id),
     'members',(SELECT count(DISTINCT user_id) FROM league_members WHERE league_id=l.id AND status='active' AND role<>'manager')) ORDER BY l.created_at DESC)
     FROM venue_league_links link JOIN leagues l ON l.id=link.league_id WHERE link.group_id=p_group),'[]'::jsonb),
   'available_leagues',coalesce((SELECT jsonb_agg(jsonb_build_object('id',l.id,'name',l.name) ORDER BY l.name) FROM leagues l
     WHERE l.created_by=auth.uid() AND (l.community_id IS NULL OR l.community_id=p_group)
       AND NOT EXISTS(SELECT 1 FROM venue_league_links WHERE league_id=l.id)),'[]'::jsonb));
END $$;
COMMIT;
