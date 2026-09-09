-- Keep public kiosk RPCs and public media buckets from bypassing sample privacy.
BEGIN;

CREATE OR REPLACE FUNCTION public.rr_kiosk_participant_names(_event_id uuid)
RETURNS TABLE(participant_id uuid,name text,is_guest boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 WITH ev AS (
   SELECT id FROM round_robin_events WHERE id=_event_id AND status IN ('live','completed')
     AND public.can_access_private_venue(venue_id) AND public.can_access_private_group(group_id)
 ), seats AS (
   SELECT s.a1_player_id AS pid,s.a1_guest_id AS gid FROM round_robin_schedule s JOIN ev ON ev.id=s.event_id
   UNION SELECT s.a2_player_id,s.a2_guest_id FROM round_robin_schedule s JOIN ev ON ev.id=s.event_id
   UNION SELECT s.b1_player_id,s.b1_guest_id FROM round_robin_schedule s JOIN ev ON ev.id=s.event_id
   UNION SELECT s.b2_player_id,s.b2_guest_id FROM round_robin_schedule s JOIN ev ON ev.id=s.event_id
 )
 SELECT p.id,coalesce(nullif(btrim(p.full_name),''),nullif(btrim(p.display_name),''),'Player'),false
 FROM profiles p WHERE p.id IN (SELECT pid FROM seats WHERE pid IS NOT NULL)
 UNION ALL
 SELECT g.id,coalesce(nullif(btrim(g.display_name),''),'Guest'),true
 FROM guest_players g WHERE g.id IN (SELECT gid FROM seats WHERE gid IS NOT NULL)
$$;

-- Normal venue media has public URLs. Until private, expiring media is supported
-- throughout the app, fail closed on uploads inside a private sample. Do not
-- change any existing public bucket or the behavior of ordinary venues.
CREATE FUNCTION public.can_upload_public_venue_media(p_bucket text,p_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT NOT EXISTS (
   SELECT 1 FROM private_venue_sandboxes s
   WHERE (p_bucket='venue-logos' AND s.venue_id::text=split_part(p_path,'/',1))
     OR (p_bucket IN ('groups','group-post-images','group-message-images','group-files')
         AND s.group_id::text=split_part(p_path,'/',1))
 )
$$;
REVOKE ALL ON FUNCTION public.can_upload_public_venue_media(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_upload_public_venue_media(text,text) TO anon,authenticated,service_role;
CREATE POLICY private_sample_no_public_upload ON storage.objects AS RESTRICTIVE FOR INSERT TO anon,authenticated
 WITH CHECK(public.can_upload_public_venue_media(bucket_id,name));
CREATE POLICY private_sample_no_public_overwrite ON storage.objects AS RESTRICTIVE FOR UPDATE TO anon,authenticated
 USING(public.can_upload_public_venue_media(bucket_id,name)) WITH CHECK(public.can_upload_public_venue_media(bucket_id,name));

COMMIT;
