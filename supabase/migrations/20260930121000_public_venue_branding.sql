BEGIN;
CREATE OR REPLACE FUNCTION public.get_public_community(p_group_id uuid DEFAULT NULL, p_venue_slug text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT jsonb_build_object(
    'id',g.id, 'name',g.name, 'description',g.description,
    'visibility',g.visibility, 'join_method',g.join_method,
    'icon_url',g.icon_url, 'cover_url',g.cover_url,
    'member_count',g.member_count, 'is_venue_verified',g.is_venue_verified,
    'venue', CASE WHEN v.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id',v.id, 'name',v.name, 'slug',v.slug, 'address',v.address,
      'city',v.city, 'state',v.state, 'phone',v.phone, 'email',v.email, 'website_url',v.website_url,
      'logo_url',v.logo_url, 'cover_image_url',v.cover_image_url,
      'logo_image_fit',v.logo_image_fit, 'cover_image_fit',v.cover_image_fit,
      'logo_shape',v.logo_shape, 'cover_focal_point',v.cover_focal_point,
      'primary_color',v.primary_color, 'secondary_color',v.secondary_color,
      'tagline',v.tagline, 'welcome_headline',v.welcome_headline, 'welcome_message',v.welcome_message,
      'timezone',v.timezone, 'hours_of_operation',v.hours_of_operation,
      'logo_crop',v.logo_crop,'cover_crop',v.cover_crop,
      'accent_color',v.accent_color,'logo_background_color',v.logo_background_color,
      'background_color',v.background_color,'surface_color',v.surface_color,'text_color',v.text_color,
      'booking_enabled',EXISTS (SELECT 1 FROM venue_module_access m WHERE m.venue_id=v.id AND m.module_key='court_booking' AND m.enabled AND (m.expires_at IS NULL OR m.expires_at>now()))
    ) END,
    'courts', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id',c.id, 'name',c.name, 'court_number',c.court_number,
      'court_type',c.court_type, 'surface_type',c.surface_type
    ) ORDER BY c.court_number,c.id) FROM venue_courts c WHERE c.venue_id=v.id AND c.is_active), '[]'::jsonb)
  ) FROM groups g LEFT JOIN venues v ON v.id=g.venue_id
  WHERE ((p_group_id IS NOT NULL AND p_venue_slug IS NULL AND g.id=p_group_id)
    OR (p_group_id IS NULL AND p_venue_slug IS NOT NULL AND g.type='venue_official'
      AND (v.slug=p_venue_slug OR EXISTS(SELECT 1 FROM venue_address_connections a WHERE a.venue_id=v.id AND a.slug=p_venue_slug))))
    AND g.visibility='public' AND (g.venue_id IS NULL OR (v.is_active AND v.is_published))
    AND NOT EXISTS(SELECT 1 FROM private_venue_sandboxes s WHERE s.group_id=g.id OR s.venue_id=g.venue_id)
  LIMIT 1
$$;
COMMIT;
