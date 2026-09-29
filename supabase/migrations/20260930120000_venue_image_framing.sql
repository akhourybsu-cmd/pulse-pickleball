BEGIN;
CREATE FUNCTION public.valid_venue_image_crop(p_crop jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT p_crop IS NULL OR coalesce(jsonb_typeof(p_crop)='object' AND jsonb_typeof(p_crop->'x')='number' AND jsonb_typeof(p_crop->'y')='number' AND jsonb_typeof(p_crop->'zoom')='number'
 AND (p_crop->>'x')::numeric BETWEEN 0 AND 100 AND (p_crop->>'y')::numeric BETWEEN 0 AND 100 AND (p_crop->>'zoom')::numeric BETWEEN 1 AND 3,false)
$$;
ALTER TABLE public.venues ADD COLUMN logo_crop jsonb CHECK(valid_venue_image_crop(logo_crop)), ADD COLUMN cover_crop jsonb CHECK(valid_venue_image_crop(cover_crop));
GRANT SELECT(logo_crop,cover_crop) ON public.venues TO anon,authenticated;
-- Called only behind existing public-visibility or unguessable-token access checks.
CREATE FUNCTION public.venue_brand_identity(p_venue uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT coalesce(jsonb_object_agg(k.key,k.value),'{}'::jsonb) FROM venues v CROSS JOIN LATERAL jsonb_each(to_jsonb(v)) k
 WHERE v.id=p_venue AND k.key=ANY(ARRAY['logo_url','cover_image_url','logo_shape','logo_image_fit','cover_image_fit','cover_focal_point','logo_crop','cover_crop','primary_color','secondary_color','accent_color','background_color','surface_color','text_color','logo_background_color','chat_background_color','chat_incoming_color','chat_outgoing_color'])
$$;
REVOKE ALL ON FUNCTION venue_brand_identity(uuid) FROM PUBLIC,anon,authenticated;
COMMIT;
