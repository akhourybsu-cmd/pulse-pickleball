BEGIN;
-- Entry acknowledgement applies to this player's membership only. Chat retains its own marker.
CREATE FUNCTION public.mark_community_read(p_group_id uuid) RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE marker timestamptz;
BEGIN
 IF auth.uid() IS NULL OR NOT pulse_has_required_mfa() THEN RAISE EXCEPTION 'Sign in required'; END IF;
 UPDATE group_members SET last_read_at=greatest(last_read_at,clock_timestamp())
 WHERE group_id=p_group_id AND user_id=auth.uid() AND status='active'
 RETURNING last_read_at INTO marker;
 RETURN marker;
END $$;
REVOKE ALL ON FUNCTION public.mark_community_read(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mark_community_read(uuid) TO authenticated;
COMMIT;
