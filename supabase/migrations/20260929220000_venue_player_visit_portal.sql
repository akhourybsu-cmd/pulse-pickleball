BEGIN;
CREATE FUNCTION public.venue_player_visit_context(p_venue uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c venue_customers;p record;l venue_visit_links;
BEGIN
 IF auth.uid() IS NULL OR NOT pulse_has_required_mfa() THEN RAISE EXCEPTION 'Sign in to view your own venue visit' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM venues WHERE id=p_venue AND is_active) THEN RAISE EXCEPTION 'Venue unavailable'; END IF;
 IF NOT EXISTS(SELECT 1 FROM group_members m JOIN groups g ON g.id=m.group_id WHERE g.venue_id=p_venue AND m.user_id=auth.uid() AND m.status='active')
 AND NOT EXISTS(SELECT 1 FROM group_members m JOIN group_events e ON e.group_id=m.group_id WHERE e.venue_id=p_venue AND e.end_time>now() AND m.user_id=auth.uid() AND m.status='active')
 AND NOT EXISTS(SELECT 1 FROM group_event_rsvps r JOIN group_events e ON e.id=r.event_id WHERE e.venue_id=p_venue AND r.user_id=auth.uid() AND r.status='going')
 AND NOT EXISTS(SELECT 1 FROM venue_customers WHERE venue_id=p_venue AND user_id=auth.uid()) THEN RAISE EXCEPTION 'Join the venue community or ask the front desk to register your visit first'; END IF;
 SELECT * INTO p FROM profiles_public WHERE id=auth.uid();
 INSERT INTO venue_customers(venue_id,user_id,first_name,last_name,created_by) VALUES(p_venue,auth.uid(),left(coalesce(nullif(trim(p.first_name),''),nullif(split_part(trim(p.full_name),' ',1),''),'Player'),80),left(coalesce(p.last_name,''),80),auth.uid()) ON CONFLICT(venue_id,user_id) DO NOTHING;
 SELECT * INTO c FROM venue_customers WHERE venue_id=p_venue AND user_id=auth.uid();
 SELECT * INTO l FROM venue_visit_links WHERE customer_id=c.id AND created_by=auth.uid() AND revoked_at IS NULL AND expires_at>now()+interval '1 hour' ORDER BY expires_at DESC LIMIT 1;
 IF NOT FOUND THEN INSERT INTO venue_visit_links(venue_id,customer_id,created_by,expires_at) VALUES(p_venue,c.id,auth.uid(),now()+interval '4 hours') RETURNING * INTO l; END IF;
 RETURN venue_visit_document_view(l.token)||jsonb_build_object('visit_token',l.token,'entitlements',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name,'kind',kind,'remaining_units',remaining_units,'expires_at',expires_at,'member_discount_percent',member_discount_percent) ORDER BY expires_at) FROM venue_entitlements WHERE customer_id=c.id AND revoked_at IS NULL AND expires_at>now()),'[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION venue_player_visit_context(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION venue_player_visit_context(uuid) TO authenticated;
COMMIT;
