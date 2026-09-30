-- Confirm the actual public website launch once, independently of ownership review.
BEGIN;

ALTER TABLE public.venue_address_connections ADD COLUMN live_notified_at timestamptz;

CREATE FUNCTION public.notify_venue_address_live() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE venue_row public.venues%ROWTYPE; community_id uuid; recipient uuid; address text;
BEGIN
  IF NEW.live_notified_at IS NOT NULL OR NEW.status <> 'connected'
    OR NEW.provider_details->>'host' IS DISTINCT FROM 'HOST_ACTIVE'
    OR NEW.provider_details->>'ownership' IS DISTINCT FROM 'OWNERSHIP_ACTIVE'
    OR NEW.provider_details->>'certificate' IS DISTINCT FROM 'CERT_ACTIVE'
    OR coalesce(NEW.provider_details->'dns','[]'::jsonb) <> '[]'::jsonb
    OR coalesce(NEW.provider_details->'issues','[]'::jsonb) <> '[]'::jsonb THEN RETURN NEW; END IF;

  SELECT * INTO venue_row FROM venues WHERE id=NEW.venue_id;
  IF NOT FOUND OR venue_row.verification_approved_at IS NULL OR venue_row.verification_approved_by IS NULL
    OR public.get_public_community(NULL,venue_row.slug) IS NULL THEN RETURN NEW; END IF;
  SELECT id INTO community_id FROM groups WHERE venue_id=venue_row.id AND type='venue_official' AND visibility='public';
  IF community_id IS NULL THEN RETURN NEW; END IF;

  address := 'https://'||NEW.slug||'.pulsepb.com';
  -- UNION deduplicates an owner represented in both venues and venue_staff.
  -- create_notification respects the owner's existing in-app preferences.
  FOR recipient IN
    SELECT venue_row.owner_id WHERE venue_row.owner_id IS NOT NULL
    UNION SELECT user_id FROM venue_staff WHERE venue_id=venue_row.id AND role='owner'
      AND is_active IS NOT FALSE AND (status IS NULL OR status='active') AND user_id IS NOT NULL
  LOOP
    PERFORM public.create_notification(recipient,'venue_address_live','community',
      'Your venue website is live',
      venue_row.name||' is now live at '||address||'. Your new address is ready to share. Players can view your venue page and sign in to join or book.',
      '/player/community/group/'||community_id||'/manage?tab=integrations','normal',
      jsonb_build_object('venue_id',venue_row.id,'address_connection_id',NEW.id,'url',address),NULL,NULL);
  END LOOP;
  -- Persist completion with the status update; daily checks and retries never
  -- recreate a dismissed/read notification, including when preferences are off.
  NEW.live_notified_at := now();
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.notify_venue_address_live() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER notify_venue_address_live BEFORE INSERT OR UPDATE ON public.venue_address_connections
FOR EACH ROW EXECUTE FUNCTION public.notify_venue_address_live();

-- Hosting can finish before the owner publishes the page. Announce it when
-- both conditions become true, without waiting for tomorrow's hosting check.
CREATE FUNCTION public.recheck_public_venue_address_notification() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_TABLE_NAME='venues' THEN
    UPDATE venue_address_connections SET status=status WHERE venue_id=NEW.id AND status='connected' AND live_notified_at IS NULL;
  ELSE
    UPDATE venue_address_connections SET status=status WHERE venue_id=NEW.venue_id AND status='connected' AND live_notified_at IS NULL;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.recheck_public_venue_address_notification() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER venue_public_address_notification AFTER UPDATE OF is_active,is_published,verification_approved_at,verification_approved_by ON public.venues
FOR EACH ROW EXECUTE FUNCTION public.recheck_public_venue_address_notification();
CREATE TRIGGER community_public_address_notification AFTER INSERT OR UPDATE OF visibility,venue_id,type ON public.groups
FOR EACH ROW EXECUTE FUNCTION public.recheck_public_venue_address_notification();

-- Existing live venues missed the completion notification. Recheck their
-- recorded hosting result and public visibility before issuing it once.
UPDATE public.venue_address_connections SET status=status WHERE status='connected' AND live_notified_at IS NULL;

COMMIT;
