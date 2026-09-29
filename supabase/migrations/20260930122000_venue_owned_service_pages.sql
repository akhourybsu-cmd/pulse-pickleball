BEGIN;
CREATE FUNCTION public.venue_service_contact(p_venue uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('name',v.name,'email',coalesce(nullif(p.support_email,''),to_jsonb(v)->>'email'),'phone',to_jsonb(v)->>'phone',
 'group_id',(SELECT g.id FROM groups g WHERE g.venue_id=v.id AND g.visibility='public' AND g.type='venue_official' AND v.is_active AND (to_jsonb(v)->>'is_published')::boolean AND NOT EXISTS(SELECT 1 FROM private_venue_sandboxes s WHERE s.venue_id=v.id) ORDER BY g.id LIMIT 1))
 FROM venues v LEFT JOIN venue_payment_settings p ON p.venue_id=v.id WHERE v.id=p_venue
$$;
REVOKE ALL ON FUNCTION venue_service_contact(uuid) FROM PUBLIC,anon,authenticated;
ALTER FUNCTION venue_sale_receipt(uuid) RENAME TO venue_sale_receipt_before_branding;
CREATE FUNCTION public.venue_sale_receipt(p_token uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb; v uuid;
BEGIN
 result:=venue_sale_receipt_before_branding(p_token);
 SELECT venue_id INTO v FROM venue_sales WHERE receipt_token=p_token;
 RETURN result||jsonb_build_object('brand',venue_brand_identity(v),'venue_contact',venue_service_contact(v));
END $$;
ALTER FUNCTION venue_visit_document_view(uuid) RENAME TO venue_visit_document_view_before_branding;
CREATE FUNCTION public.venue_visit_document_view(p_token uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb; v uuid;
BEGIN
 result:=venue_visit_document_view_before_branding(p_token);
 SELECT venue_id INTO v FROM venue_visit_links WHERE token=p_token;
 RETURN result||jsonb_build_object('brand',venue_brand_identity(v),'venue_contact',venue_service_contact(v));
END $$;
CREATE OR REPLACE FUNCTION public.venue_kiosk_view(p_token uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE k venue_kiosk_sessions;v jsonb;
BEGIN
 k:=venue_kiosk_validate(p_token);SELECT to_jsonb(venue) INTO v FROM venues venue WHERE id=k.venue_id;
 RETURN jsonb_build_object('venue_name',v->>'name','expires_at',k.expires_at,'timezone',coalesce(v->>'timezone','America/New_York'),'group_id',(SELECT id FROM groups WHERE venue_id=k.venue_id ORDER BY id LIMIT 1),
 'brand',venue_brand_identity(k.venue_id),'venue_contact',venue_service_contact(k.venue_id));
END $$;
REVOKE ALL ON FUNCTION venue_sale_receipt_before_branding(uuid),venue_visit_document_view_before_branding(uuid),venue_sale_receipt(uuid),venue_visit_document_view(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION venue_sale_receipt(uuid),venue_visit_document_view(uuid) TO anon,authenticated;
COMMIT;
