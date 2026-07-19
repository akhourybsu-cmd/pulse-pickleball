ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS location_name        text,
  ADD COLUMN IF NOT EXISTS location_place_id    text,
  ADD COLUMN IF NOT EXISTS location_lat         double precision,
  ADD COLUMN IF NOT EXISTS location_lng         double precision,
  ADD COLUMN IF NOT EXISTS location_updated_at  timestamptz,
  ADD COLUMN IF NOT EXISTS discoverable_by_location boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.location_name IS
  'Canonical home city label (e.g. "Brooklyn, NY") from the verified geocoder.';
COMMENT ON COLUMN public.profiles.discoverable_by_location IS
  'Opt-in: when true, this player may be surfaced to other opted-in players by proximity.';

CREATE INDEX IF NOT EXISTS idx_profiles_discoverable_geo
  ON public.profiles (location_lat, location_lng)
  WHERE discoverable_by_location = true
    AND location_lat IS NOT NULL
    AND location_lng IS NOT NULL;

CREATE OR REPLACE FUNCTION public.discover_players_nearby(
  _radius_km double precision DEFAULT 40,
  _limit     integer          DEFAULT 30
) RETURNS TABLE (
  id            uuid,
  display_name  text,
  full_name     text,
  avatar_url    text,
  current_rating numeric,
  handle        text,
  location_name text,
  distance_km   double precision,
  reason        text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_actor        uuid := auth.uid();
  v_lat          double precision;
  v_lng          double precision;
  v_discoverable boolean;
BEGIN
  IF v_actor IS NULL THEN
    RETURN;
  END IF;

  SELECT p.location_lat, p.location_lng, p.discoverable_by_location
    INTO v_lat, v_lng, v_discoverable
    FROM public.profiles p
   WHERE p.id = v_actor;

  IF v_lat IS NULL OR v_lng IS NULL OR v_discoverable IS NOT TRUE THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH nearby AS (
    SELECT
      p.id, p.display_name, p.full_name, p.avatar_url, p.current_rating,
      p.handle, p.location_name,
      2 * 6371 * asin(sqrt(
        power(sin(radians(p.location_lat - v_lat) / 2), 2) +
        cos(radians(v_lat)) * cos(radians(p.location_lat)) *
        power(sin(radians(p.location_lng - v_lng) / 2), 2)
      )) AS dist_km
    FROM public.profiles p
    WHERE p.id <> v_actor
      AND p.discoverable_by_location = true
      AND p.location_lat IS NOT NULL
      AND p.location_lng IS NOT NULL
  )
  SELECT
    n.id, n.display_name, n.full_name, n.avatar_url, n.current_rating,
    n.handle, n.location_name,
    round(n.dist_km::numeric, 1)::double precision AS distance_km,
    'Near you'::text AS reason
  FROM nearby n
  WHERE n.dist_km <= greatest(_radius_km, 0)
    AND NOT EXISTS (
      SELECT 1 FROM public.friendships f
       WHERE (f.user_id = v_actor AND f.friend_id = n.id)
          OR (f.friend_id = v_actor AND f.user_id = n.id)
    )
  ORDER BY n.dist_km ASC, n.current_rating DESC NULLS LAST
  LIMIT least(greatest(_limit, 1), 100);
END;
$$;

REVOKE ALL ON FUNCTION public.discover_players_nearby(double precision, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.discover_players_nearby(double precision, integer) TO authenticated;