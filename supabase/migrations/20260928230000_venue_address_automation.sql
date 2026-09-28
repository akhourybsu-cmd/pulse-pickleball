-- Process reserved addresses without a browser session or impersonating an admin.
BEGIN;
ALTER TABLE public.venue_address_connections ADD COLUMN failure_count integer NOT NULL DEFAULT 0;
CREATE INDEX venue_address_connections_due ON public.venue_address_connections(check_after) WHERE venue_id IS NOT NULL;

CREATE FUNCTION public.claim_venue_address_jobs(p_limit integer DEFAULT 10) RETURNS SETOF jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  RETURN QUERY
  WITH due AS (
    SELECT c.id FROM venue_address_connections c JOIN venues v ON v.id=c.venue_id
    WHERE c.check_after<=now() AND v.is_active
      AND v.verification_approved_at IS NOT NULL AND v.verification_approved_by IS NOT NULL
      AND NOT EXISTS(SELECT 1 FROM private_venue_sandboxes s WHERE s.venue_id=v.id)
    ORDER BY c.check_after,c.id LIMIT greatest(1,least(coalesce(p_limit,10),10))
    FOR UPDATE OF c SKIP LOCKED
  ), claimed AS (
    UPDATE venue_address_connections c SET check_token=gen_random_uuid(),check_after=now()+interval '15 minutes',
      status=CASE WHEN c.status='requested' THEN 'provisioning' ELSE c.status END
    FROM due WHERE c.id=due.id RETURNING c.venue_id,c.slug,c.check_token
  ) SELECT jsonb_build_object('venue_id',venue_id,'slug',slug,'token',check_token) FROM claimed;
END $$;
REVOKE ALL ON FUNCTION public.claim_venue_address_jobs(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_venue_address_jobs(integer) TO service_role;

CREATE FUNCTION public.finish_venue_address_job(p_venue_id uuid,p_token uuid,p_status text,p_details jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE previous venue_address_connections; failures integer;
BEGIN
  SELECT * INTO previous FROM venue_address_connections
    WHERE venue_id=p_venue_id AND check_token=p_token AND check_after>now() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Address job lease expired or was replaced'; END IF;
  IF NOT EXISTS(SELECT 1 FROM venues v WHERE v.id=p_venue_id AND v.is_active
    AND v.verification_approved_at IS NOT NULL AND v.verification_approved_by IS NOT NULL
    AND NOT EXISTS(SELECT 1 FROM private_venue_sandboxes s WHERE s.venue_id=v.id)) THEN
    RAISE EXCEPTION 'Active, verified venue required';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('provisioning','action_required','connected','error')
    OR jsonb_typeof(p_details) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid address result'; END IF;
  IF p_status='connected' AND NOT coalesce(
    p_details->>'host'='HOST_ACTIVE' AND p_details->>'ownership'='OWNERSHIP_ACTIVE'
    AND p_details->>'certificate'='CERT_ACTIVE' AND p_details->'dns'='[]'::jsonb
    AND p_details->'issues'='[]'::jsonb,false) THEN RAISE EXCEPTION 'Hosting and HTTPS must be verified'; END IF;
  failures := CASE WHEN p_status='error' THEN least(previous.failure_count+1,6) ELSE 0 END;
  UPDATE venue_address_connections SET status=p_status,provider_details=p_details,checked_at=now(),
    check_token=NULL,failure_count=failures,check_after=now()+CASE p_status
      WHEN 'connected' THEN interval '1 day'
      WHEN 'action_required' THEN interval '1 hour'
      WHEN 'error' THEN interval '5 minutes'*power(2,failures)
      ELSE interval '10 minutes' END
    WHERE venue_id=p_venue_id;
  IF previous.status IS DISTINCT FROM p_status OR previous.provider_details IS DISTINCT FROM p_details THEN
    INSERT INTO platform_admin_audit(actor_id,venue_id,action,note,before_state,after_state)
      VALUES(NULL,p_venue_id,'venue.address.automated','Automatic venue address hosting and DNS check.',
        jsonb_build_object('slug',previous.slug,'status',previous.status),jsonb_build_object('slug',previous.slug,'status',p_status));
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.finish_venue_address_job(uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_venue_address_job(uuid,uuid,text,jsonb) TO service_role;

-- An administrator can bring the next check forward without needing hosting credentials in Edge secrets.
CREATE FUNCTION public.queue_venue_address_check(p_venue_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_platform_superadmin() OR NOT public.pulse_has_required_mfa()
    OR coalesce(auth.jwt()->>'is_anonymous','false')='true' THEN
    RAISE EXCEPTION 'Platform administrator access required' USING ERRCODE='42501';
  END IF;
  UPDATE venue_address_connections SET check_after=now()
    WHERE venue_id=p_venue_id AND (check_token IS NULL OR check_after<=now());
  IF NOT FOUND THEN RAISE EXCEPTION 'A check is already running, or this address was not requested'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.queue_venue_address_check(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.queue_venue_address_check(uuid) TO authenticated;
COMMIT;
