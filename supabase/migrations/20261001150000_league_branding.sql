-- League identities are separate from seasons and never change competition data.
BEGIN;

CREATE FUNCTION public.valid_league_branding(p_brand jsonb, p_league_id uuid)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE k text; v jsonb; coordinate text;
BEGIN
  IF p_brand IS NULL OR jsonb_typeof(p_brand) <> 'object' OR octet_length(p_brand::text) > 6000 THEN RETURN false; END IF;
  FOR k, v IN SELECT * FROM jsonb_each(p_brand) LOOP
    IF k IN ('primary_color','secondary_color','accent_color') THEN
      IF jsonb_typeof(v) <> 'string' OR (v #>> '{}') !~ '^#[0-9a-fA-F]{6}$' THEN RETURN false; END IF;
    ELSIF k IN ('logo_url','cover_url') THEN
      IF jsonb_typeof(v) <> 'string' OR length(v #>> '{}') > 2048
        OR (v #>> '{}') !~ ('^https://[^/]+/storage/v1/object/public/league-branding/' || p_league_id::text || '/[a-zA-Z0-9._-]+$') THEN RETURN false; END IF;
    ELSIF k = 'logo_shape' THEN
      IF v NOT IN ('"circle"'::jsonb,'"square"'::jsonb) THEN RETURN false; END IF;
    ELSIF k = 'logo_fit' THEN
      IF v NOT IN ('"cover"'::jsonb,'"contain"'::jsonb) THEN RETURN false; END IF;
    ELSIF k IN ('logo_crop','cover_crop') THEN
      IF jsonb_typeof(v) <> 'object' OR NOT (v ?& ARRAY['x','y','zoom']) OR (v - ARRAY['x','y','zoom']) <> '{}'::jsonb THEN RETURN false; END IF;
      FOREACH coordinate IN ARRAY ARRAY['x','y','zoom'] LOOP
        IF jsonb_typeof(v -> coordinate) <> 'number' THEN RETURN false; END IF;
      END LOOP;
      IF (v->>'x')::numeric NOT BETWEEN 0 AND 100 OR (v->>'y')::numeric NOT BETWEEN 0 AND 100 OR (v->>'zoom')::numeric NOT BETWEEN 1 AND 3 THEN RETURN false; END IF;
    ELSE RETURN false;
    END IF;
  END LOOP;
  RETURN true;
END; $$;

ALTER TABLE public.leagues ADD COLUMN branding jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.leagues ADD CONSTRAINT league_branding_valid CHECK (public.valid_league_branding(branding, id));

CREATE FUNCTION public.set_league_branding(p_league_id uuid, p_branding jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_old jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_league_admin(p_league_id) THEN
    RAISE EXCEPTION 'League manager privileges required' USING ERRCODE = '42501';
  END IF;
  SELECT branding INTO v_old FROM public.leagues WHERE id = p_league_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'League not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.valid_league_branding(p_branding, p_league_id) THEN
    RAISE EXCEPTION 'Check your league colors and images and try again' USING ERRCODE = '22023';
  END IF;
  IF v_old IS NOT DISTINCT FROM p_branding THEN RETURN; END IF;
  UPDATE public.leagues SET branding = p_branding WHERE id = p_league_id;
  INSERT INTO public.league_audit_log(league_id, actor_user_id, action, entity_type, entity_id, old_value, new_value)
    VALUES(p_league_id, auth.uid(), 'league.branding_updated', 'league', p_league_id, v_old, p_branding);
END; $$;
REVOKE ALL ON FUNCTION public.set_league_branding(uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_league_branding(uuid,jsonb) TO authenticated;

-- Images are intentionally public brand assets. Writes remain league-scoped,
-- including for managers who can operate only one of several leagues.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('league-branding','league-branding',true,8388608,ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT(id) DO UPDATE SET public=true,file_size_limit=EXCLUDED.file_size_limit,allowed_mime_types=EXCLUDED.allowed_mime_types;

CREATE FUNCTION public.can_manage_league_brand_asset(p_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.leagues l
    WHERE l.id::text = split_part(p_name,'/',1) AND public.is_league_admin(l.id));
$$;
REVOKE ALL ON FUNCTION public.can_manage_league_brand_asset(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_league_brand_asset(text) TO authenticated;
CREATE POLICY "League managers manage branding" ON storage.objects FOR ALL TO authenticated
  USING(bucket_id = 'league-branding' AND public.can_manage_league_brand_asset(name))
  WITH CHECK(bucket_id = 'league-branding' AND public.can_manage_league_brand_asset(name));
-- Protect this bucket even when another storage policy grants broad user access.
CREATE POLICY "League branding write boundary" ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
  USING(bucket_id <> 'league-branding' OR public.can_manage_league_brand_asset(name))
  WITH CHECK(bucket_id <> 'league-branding' OR public.can_manage_league_brand_asset(name));

-- Read RPCs below preserve their existing visibility and membership filters.

DROP FUNCTION public.get_my_leagues_with_context();
CREATE FUNCTION public.get_my_leagues_with_context()
RETURNS TABLE (
  membership_id             UUID,
  membership_league_id      UUID,
  membership_season_id      UUID,
  membership_user_id        UUID,
  membership_role           TEXT,
  membership_status         TEXT,
  membership_joined_at      TIMESTAMPTZ,
  membership_created_at     TIMESTAMPTZ,
  membership_updated_at     TIMESTAMPTZ,
  league_id                 UUID,
  league_name               TEXT,
  league_description        TEXT,
  league_location           TEXT,
  league_community_id       UUID,
  league_created_by         UUID,
  league_status             TEXT,
  league_visibility         TEXT,
  league_league_type        TEXT,
  league_rating_eligible    BOOLEAN,
  league_guests_allowed     BOOLEAN,
  league_skill_min          NUMERIC,
  league_skill_max          NUMERIC,
  league_created_at         TIMESTAMPTZ,
  league_updated_at         TIMESTAMPTZ,
  season_id                 UUID,
  season_league_id          UUID,
  season_name               TEXT,
  season_start_date         DATE,
  season_end_date           DATE,
  season_registration_deadline DATE,
  season_status             TEXT,
  season_created_at         TIMESTAMPTZ,
  season_updated_at         TIMESTAMPTZ,
  league_branding JSONB
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    m.id, m.league_id, m.season_id, m.user_id,
    m.role::TEXT, m.status::TEXT, m.joined_at, m.created_at, m.updated_at,
    l.id, l.name, l.description, l.location, l.community_id, l.created_by,
    l.status::TEXT, l.visibility::TEXT, l.league_type::TEXT,
    l.rating_eligible, l.guests_allowed, l.skill_min, l.skill_max,
    l.created_at, l.updated_at,
    s.id, s.league_id, s.name, s.start_date, s.end_date,
    s.registration_deadline, s.status::TEXT, s.created_at, s.updated_at, l.branding
  FROM public.league_members m
  JOIN public.leagues l ON l.id = m.league_id
  LEFT JOIN public.league_seasons s ON s.id = m.season_id
  WHERE m.user_id = auth.uid()
    AND m.status = 'active'
    AND l.visibility <> 'admin_only'
  ORDER BY l.name ASC, m.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.get_my_leagues_with_context() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_leagues_with_context() TO authenticated, service_role;

DROP FUNCTION public.find_league_by_invite_code(text);
CREATE OR REPLACE FUNCTION public.find_league_by_invite_code(p_code text)
RETURNS TABLE (id uuid, name text, description text, location text, league_type text,
  visibility text, guests_allowed boolean, registration_open boolean, registration_closes_at date, branding jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT l.id, l.name, l.description, l.location, l.league_type::text, l.visibility::text, l.guests_allowed,
    EXISTS (SELECT 1 FROM public.league_seasons s WHERE s.league_id = l.id AND s.status = 'active'
      AND (s.registration_deadline IS NULL OR s.registration_deadline >= CURRENT_DATE)),
    (SELECT min(s.registration_deadline) FROM public.league_seasons s WHERE s.league_id = l.id
      AND s.status = 'active' AND s.registration_deadline >= CURRENT_DATE), l.branding
  FROM public.leagues l WHERE lower(l.invite_code) = lower(trim(p_code))
    AND l.visibility <> 'admin_only' AND l.status = 'active';
$$;
REVOKE ALL ON FUNCTION public.find_league_by_invite_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_league_by_invite_code(text) TO anon, authenticated, service_role;

COMMIT;
