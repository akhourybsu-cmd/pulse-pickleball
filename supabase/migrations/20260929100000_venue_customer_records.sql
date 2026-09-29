-- Venue-owned customer records. All writes pass through scoped, MFA-aware RPCs.
BEGIN;
CREATE FUNCTION public.venue_desk_access(p_venue uuid,p_manage boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT auth.uid() IS NOT NULL AND public.pulse_has_required_mfa() AND EXISTS(
  SELECT 1 FROM venues v WHERE v.id=p_venue AND (v.owner_id=auth.uid() OR EXISTS(
   SELECT 1 FROM venue_staff s WHERE s.venue_id=v.id AND s.user_id=auth.uid()
    AND s.is_active IS NOT FALSE AND (s.status IS NULL OR s.status::text='active')
    AND (s.role::text IN ('owner','manager') OR (NOT p_manage AND s.role::text='staff' AND venue_has_module(v.id,'facility_tools'))))))
$$;

CREATE TABLE public.venue_customers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), venue_id uuid NOT NULL REFERENCES venues(id),
 user_id uuid REFERENCES auth.users(id), first_name text NOT NULL CHECK(length(trim(first_name)) BETWEEN 1 AND 80),
 last_name text NOT NULL DEFAULT '' CHECK(length(last_name)<=80),
 email text CHECK(email IS NULL OR (length(email)<=254 AND email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
 phone text CHECK(length(phone)<=40), created_by uuid REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(venue_id,user_id), UNIQUE(venue_id,id)
);
CREATE INDEX venue_customer_names ON public.venue_customers(venue_id,lower(first_name),lower(last_name));
CREATE TABLE public.venue_customer_notes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), venue_id uuid NOT NULL REFERENCES venues(id),
 customer_id uuid NOT NULL, body text NOT NULL CHECK(length(trim(body)) BETWEEN 1 AND 4000),
 created_by uuid NOT NULL REFERENCES auth.users(id), created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(venue_id,customer_id) REFERENCES venue_customers(venue_id,id)
);
CREATE TABLE public.venue_documents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), venue_id uuid NOT NULL REFERENCES venues(id),
 title text NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 150),
 body text NOT NULL CHECK(length(trim(body)) BETWEEN 20 AND 100000),
 version integer NOT NULL CHECK(version>0), required boolean NOT NULL DEFAULT true,
 published_at timestamptz NOT NULL DEFAULT now(), retired_at timestamptz,
 created_by uuid NOT NULL REFERENCES auth.users(id), UNIQUE(venue_id,version), UNIQUE(venue_id,id)
);
CREATE TABLE public.venue_document_acceptances (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),venue_id uuid NOT NULL REFERENCES venues(id), customer_id uuid NOT NULL,
 document_id uuid NOT NULL, signer_name text NOT NULL CHECK(length(trim(signer_name)) BETWEEN 2 AND 160),
 accepted_at timestamptz NOT NULL DEFAULT now(), user_id uuid REFERENCES auth.users(id),
 FOREIGN KEY(venue_id,customer_id) REFERENCES venue_customers(venue_id,id),
 FOREIGN KEY(venue_id,document_id) REFERENCES venue_documents(venue_id,id),
 UNIQUE(customer_id,document_id)
);
CREATE TABLE public.venue_visit_links (
 token uuid PRIMARY KEY DEFAULT gen_random_uuid(), venue_id uuid NOT NULL REFERENCES venues(id), customer_id uuid NOT NULL,
 created_by uuid NOT NULL REFERENCES auth.users(id), expires_at timestamptz NOT NULL DEFAULT now()+interval '1 day',
 revoked_at timestamptz, FOREIGN KEY(venue_id,customer_id) REFERENCES venue_customers(venue_id,id)
);

DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['venue_customers','venue_customer_notes','venue_documents','venue_document_acceptances','venue_visit_links'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
  EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
  EXECUTE format('CREATE POLICY pulse_required_mfa ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.pulse_has_required_mfa())) WITH CHECK ((SELECT public.pulse_has_required_mfa()))',t);
 END LOOP;
END $$;

CREATE FUNCTION public.venue_customer_save(p_venue uuid,p_id uuid,p_expected timestamptz,p_first text,p_last text,p_email text,p_phone text)
RETURNS venue_customers LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c venue_customers;
BEGIN
 IF NOT venue_desk_access(p_venue) THEN RAISE EXCEPTION 'Venue desk access required' USING ERRCODE='42501'; END IF;
 IF p_id IS NULL THEN
  INSERT INTO venue_customers(venue_id,first_name,last_name,email,phone,created_by)
   VALUES(p_venue,trim(p_first),trim(coalesce(p_last,'')),nullif(trim(p_email),''),nullif(trim(p_phone),''),auth.uid()) RETURNING * INTO c;
 ELSE
  SELECT * INTO c FROM venue_customers WHERE id=p_id AND venue_id=p_venue FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Player not found'; END IF;
  IF c.updated_at IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'This player changed. Refresh before saving.' USING ERRCODE='40001'; END IF;
  UPDATE venue_customers SET first_name=trim(p_first),last_name=trim(coalesce(p_last,'')),email=nullif(trim(p_email),''),phone=nullif(trim(p_phone),''),updated_at=clock_timestamp() WHERE id=c.id RETURNING * INTO c;
 END IF;
 RETURN c;
END $$;

CREATE FUNCTION public.venue_customer_note(p_customer uuid,p_body text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c venue_customers; result uuid;
BEGIN
 SELECT * INTO c FROM venue_customers WHERE id=p_customer;
 IF NOT FOUND OR NOT venue_desk_access(c.venue_id) THEN RAISE EXCEPTION 'Venue desk access required' USING ERRCODE='42501'; END IF;
 INSERT INTO venue_customer_notes(venue_id,customer_id,body,created_by) VALUES(c.venue_id,c.id,trim(p_body),auth.uid()) RETURNING id INTO result;
 RETURN result;
END $$;

-- Imports only people already connected to this venue, never a platform directory.
CREATE FUNCTION public.venue_customer_sync(p_venue uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT venue_desk_access(p_venue) THEN RAISE EXCEPTION 'Venue desk access required' USING ERRCODE='42501'; END IF;
 INSERT INTO venue_customers(venue_id,user_id,first_name,last_name,created_by)
  SELECT DISTINCT p_venue,p.id,left(coalesce(nullif(trim(p.first_name),''),nullif(split_part(trim(p.full_name),' ',1),''),'Player'),80),left(coalesce(p.last_name,''),80),auth.uid()
  FROM profiles_public p JOIN (
   SELECT m.user_id FROM group_members m JOIN groups g ON g.id=m.group_id WHERE g.venue_id=p_venue AND m.status='active'
   UNION SELECT r.user_id FROM group_event_rsvps r JOIN group_events e ON e.id=r.event_id WHERE e.venue_id=p_venue
   UNION SELECT buyer_id FROM payment_orders WHERE venue_id=p_venue AND livemode
  ) people ON people.user_id=p.id ON CONFLICT(venue_id,user_id) DO NOTHING;
END $$;

CREATE FUNCTION public.venue_customer_directory(p_venue uuid,p_search text DEFAULT '',p_page integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT venue_desk_access(p_venue) THEN RAISE EXCEPTION 'Venue desk access required' USING ERRCODE='42501'; END IF;
 IF p_page IS NULL OR p_page<0 OR p_page>10000 OR length(p_search)>200 THEN RAISE EXCEPTION 'Invalid search'; END IF;
 PERFORM venue_customer_sync(p_venue);
 RETURN jsonb_build_object('players',coalesce((SELECT jsonb_agg(to_jsonb(c)) FROM (
  SELECT * FROM venue_customers WHERE venue_id=p_venue AND (coalesce(p_search,'')='' OR
   strpos(lower(first_name||' '||last_name||' '||coalesce(email,'')||' '||coalesce(phone,'')),lower(p_search))>0)
  ORDER BY lower(first_name),lower(last_name),id LIMIT 51 OFFSET p_page*50
 ) c),'[]'::jsonb));
END $$;

CREATE FUNCTION public.venue_customer_profile(p_customer uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE c venue_customers;
BEGIN
 SELECT * INTO c FROM venue_customers WHERE id=p_customer;
 IF NOT FOUND OR NOT venue_desk_access(c.venue_id) THEN RAISE EXCEPTION 'Venue desk access required' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('player',to_jsonb(c),
  'notes',coalesce((SELECT jsonb_agg(to_jsonb(n) ORDER BY n.created_at DESC) FROM venue_customer_notes n WHERE n.customer_id=c.id),'[]'::jsonb),
  'documents',coalesce((SELECT jsonb_agg(jsonb_build_object('id',d.id,'title',d.title,'version',d.version,'required',d.required,'accepted_at',a.accepted_at,'signer_name',a.signer_name) ORDER BY d.version DESC)
   FROM venue_documents d LEFT JOIN venue_document_acceptances a ON a.document_id=d.id AND a.customer_id=c.id WHERE d.venue_id=c.venue_id AND d.retired_at IS NULL),'[]'::jsonb),
  'registrations',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.start_time DESC) FROM (
   SELECT e.id,e.title,e.start_time,e.end_time,r.status,r.checked_in_at,r.no_show_at FROM group_events e JOIN group_event_rsvps r ON r.event_id=e.id
    WHERE e.venue_id=c.venue_id AND r.user_id=c.user_id ORDER BY e.start_time DESC LIMIT 200) x),'[]'::jsonb),
  'bookings',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.start_time DESC) FROM (
   SELECT e.id,e.title,e.start_time,e.end_time,vc.name court FROM group_events e LEFT JOIN venue_courts vc ON vc.id=e.venue_court_id
    WHERE e.venue_id=c.venue_id AND e.created_by=c.user_id AND e.event_format='reservation' ORDER BY e.start_time DESC LIMIT 200) x),'[]'::jsonb),
  'purchases',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC) FROM (
   SELECT id,description,amount_cents,refunded_cents,status,created_at FROM payment_orders WHERE venue_id=c.venue_id AND buyer_id=c.user_id AND livemode ORDER BY created_at DESC LIMIT 200) x),'[]'::jsonb));
END $$;

CREATE FUNCTION public.venue_document_publish(p_venue uuid,p_title text,p_body text,p_required boolean,p_replace uuid DEFAULT NULL)
RETURNS venue_documents LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d venue_documents; next_version integer;
BEGIN
 IF NOT venue_desk_access(p_venue,true) THEN RAISE EXCEPTION 'Venue management access required' USING ERRCODE='42501'; END IF;
 PERFORM id FROM venues WHERE id=p_venue FOR UPDATE;
 IF p_replace IS NOT NULL THEN
  UPDATE venue_documents SET retired_at=now() WHERE id=p_replace AND venue_id=p_venue AND retired_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Document changed. Refresh before publishing.'; END IF;
 END IF;
 SELECT coalesce(max(version),0)+1 INTO next_version FROM venue_documents WHERE venue_id=p_venue;
 INSERT INTO venue_documents(venue_id,title,body,version,required,created_by) VALUES(p_venue,trim(p_title),trim(p_body),next_version,p_required,auth.uid()) RETURNING * INTO d;
 RETURN d;
END $$;
CREATE FUNCTION public.venue_documents_list(p_venue uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT venue_desk_access(p_venue) THEN RAISE EXCEPTION 'Venue desk access required' USING ERRCODE='42501'; END IF;
 RETURN coalesce((SELECT jsonb_agg(to_jsonb(d) ORDER BY version DESC) FROM venue_documents d WHERE venue_id=p_venue),'[]'::jsonb);
END $$;
CREATE FUNCTION public.venue_visit_link(p_customer uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c venue_customers; result uuid;
BEGIN
 SELECT * INTO c FROM venue_customers WHERE id=p_customer;
 IF NOT FOUND OR NOT venue_desk_access(c.venue_id) THEN RAISE EXCEPTION 'Venue desk access required' USING ERRCODE='42501'; END IF;
 UPDATE venue_visit_links SET revoked_at=now() WHERE customer_id=c.id AND revoked_at IS NULL;
 INSERT INTO venue_visit_links(venue_id,customer_id,created_by) VALUES(c.venue_id,c.id,auth.uid()) RETURNING token INTO result;
 RETURN result;
END $$;
CREATE FUNCTION public.venue_visit_document_view(p_token uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE l venue_visit_links; c venue_customers; v venues;
BEGIN
 SELECT * INTO l FROM venue_visit_links WHERE token=p_token AND revoked_at IS NULL AND expires_at>now();
 IF NOT FOUND THEN RAISE EXCEPTION 'This visit link expired. Ask the front desk for a new one.'; END IF;
 SELECT * INTO c FROM venue_customers WHERE id=l.customer_id;
 SELECT * INTO v FROM venues WHERE id=l.venue_id;
 RETURN jsonb_build_object('venue_name',v.name,'player_name',c.first_name||CASE WHEN c.last_name<>'' THEN ' '||left(c.last_name,1)||'.' ELSE '' END,
  'expires_at',l.expires_at,'documents',coalesce((SELECT jsonb_agg(jsonb_build_object('id',d.id,'title',d.title,'body',d.body,'version',d.version,'required',d.required,'accepted_at',a.accepted_at) ORDER BY d.version)
   FROM venue_documents d LEFT JOIN venue_document_acceptances a ON a.document_id=d.id AND a.customer_id=c.id WHERE d.venue_id=v.id AND d.retired_at IS NULL),'[]'::jsonb));
END $$;
CREATE FUNCTION public.venue_document_accept(p_token uuid,p_document uuid,p_signer text,p_agree boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l venue_visit_links;
BEGIN
 SELECT * INTO l FROM venue_visit_links WHERE token=p_token AND revoked_at IS NULL AND expires_at>now() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'This visit link expired. Ask the front desk for a new one.'; END IF;
 IF p_agree IS DISTINCT FROM true THEN RAISE EXCEPTION 'Read and acknowledge this document to continue'; END IF;
 IF NOT EXISTS(SELECT 1 FROM venue_documents WHERE id=p_document AND venue_id=l.venue_id AND retired_at IS NULL) THEN RAISE EXCEPTION 'The document changed. Review the latest version.'; END IF;
 INSERT INTO venue_document_acceptances(venue_id,customer_id,document_id,signer_name,user_id) VALUES(l.venue_id,l.customer_id,p_document,trim(p_signer),auth.uid())
  ON CONFLICT(customer_id,document_id) DO NOTHING;
END $$;
CREATE FUNCTION public.venue_missing_documents(p_customer uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT count(*)::integer FROM venue_customers c JOIN venue_documents d ON d.venue_id=c.venue_id
 WHERE c.id=p_customer AND d.retired_at IS NULL AND d.required AND NOT EXISTS(
  SELECT 1 FROM venue_document_acceptances a WHERE a.customer_id=c.id AND a.document_id=d.id)
$$;

REVOKE ALL ON FUNCTION public.venue_desk_access(uuid,boolean),public.venue_customer_save(uuid,uuid,timestamptz,text,text,text,text),public.venue_customer_note(uuid,text),public.venue_customer_sync(uuid),public.venue_customer_directory(uuid,text,integer),public.venue_customer_profile(uuid),public.venue_document_publish(uuid,text,text,boolean,uuid),public.venue_documents_list(uuid),public.venue_visit_link(uuid),public.venue_missing_documents(uuid),public.venue_visit_document_view(uuid),public.venue_document_accept(uuid,uuid,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.venue_desk_access(uuid,boolean),public.venue_customer_save(uuid,uuid,timestamptz,text,text,text,text),public.venue_customer_note(uuid,text),public.venue_customer_sync(uuid),public.venue_customer_directory(uuid,text,integer),public.venue_customer_profile(uuid),public.venue_document_publish(uuid,text,text,boolean,uuid),public.venue_documents_list(uuid),public.venue_visit_link(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.venue_visit_document_view(uuid),public.venue_document_accept(uuid,uuid,text,boolean) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.venue_desk_access(uuid,boolean),public.venue_missing_documents(uuid) TO service_role;
COMMIT;
