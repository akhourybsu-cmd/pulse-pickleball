BEGIN;

-- The previous RETURNS TABLE declaration made sum(weight) ambiguous: weight
-- could mean either the output variable or the CTE column. Qualify all columns.
CREATE OR REPLACE FUNCTION public.suggest_friends()
RETURNS TABLE (id uuid, display_name text, full_name text, avatar_url text,
  current_rating numeric, handle text, reason text, weight integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN RETURN; END IF;
  RETURN QUERY
  WITH my_friends AS (
    SELECT CASE WHEN f.user_id = me THEN f.friend_id ELSE f.user_id END AS uid
    FROM public.friendships f WHERE f.status = 'accepted' AND (f.user_id = me OR f.friend_id = me)
  ), candidates AS (
    SELECT mp2.player_id AS uid, 'Played together'::text AS reason, 10 AS weight
    FROM public.match_participants mp1
    JOIN public.matches m ON m.id = mp1.match_id AND m.status = 'approved' AND NOT COALESCE(m.voided, false)
    JOIN public.match_participants mp2 ON mp2.match_id = mp1.match_id AND mp2.player_id <> me
    WHERE mp1.player_id = me
    UNION ALL
    SELECT rp2.player_id, 'Played round robin'::text, 9
    FROM public.round_robin_players rp1
    JOIN public.round_robin_players rp2 ON rp2.event_id = rp1.event_id AND rp2.player_id <> me
    WHERE rp1.player_id = me AND rp1.active AND rp2.active
    UNION ALL
    SELECT CASE WHEN f.user_id = mf.uid THEN f.friend_id ELSE f.user_id END, 'Mutual friend'::text, 8
    FROM my_friends mf JOIN public.friendships f ON f.status = 'accepted' AND (f.user_id = mf.uid OR f.friend_id = mf.uid)
    UNION ALL
    SELECT gm2.user_id, 'Shared group'::text, 5
    FROM public.group_members gm1
    JOIN public.group_members gm2 ON gm2.group_id = gm1.group_id AND gm2.user_id <> me
    WHERE gm1.user_id = me AND gm1.status = 'active' AND gm2.status = 'active'
    UNION ALL
    SELECT er2.user_id, 'Shared event'::text, 3
    FROM public.calendar_event_registrations er1
    JOIN public.calendar_event_registrations er2 ON er2.event_id = er1.event_id AND er2.user_id <> me
    WHERE er1.user_id = me
  ), excluded AS (
    SELECT CASE WHEN f.user_id = me THEN f.friend_id ELSE f.user_id END AS uid
    FROM public.friendships f WHERE f.user_id = me OR f.friend_id = me
    UNION SELECT d.dismissed_user_id FROM public.friend_suggestion_dismissals d WHERE d.user_id = me
    UNION SELECT CASE WHEN ub.blocker_id = me THEN ub.blocked_id ELSE ub.blocker_id END
    FROM public.user_blocks ub WHERE ub.blocker_id = me OR ub.blocked_id = me
  ), aggregated AS (
    SELECT c.uid, sum(c.weight)::integer AS total_weight, count(*)::integer AS hits
    FROM candidates c WHERE c.uid IS NOT NULL AND c.uid <> me
      AND c.uid NOT IN (SELECT e.uid FROM excluded e WHERE e.uid IS NOT NULL)
    GROUP BY c.uid
  )
  SELECT p.id, p.display_name, p.full_name, p.avatar_url, p.current_rating, p.handle,
    (SELECT c.reason FROM candidates c WHERE c.uid = a.uid ORDER BY c.weight DESC, c.reason LIMIT 1), a.total_weight
  FROM aggregated a JOIN public.profiles p ON p.id = a.uid
  ORDER BY a.total_weight DESC, a.hits DESC, p.id LIMIT 24;
END;
$$;
REVOKE ALL ON FUNCTION public.suggest_friends() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.suggest_friends() TO authenticated;

-- Mutual connections work in either stored friendship direction. Existing
-- friends and pending requests remain searchable with their current status.
CREATE OR REPLACE FUNCTION public.search_connectable_users(_query text)
RETURNS TABLE (id uuid, display_name text, full_name text, avatar_url text,
  current_rating numeric, handle text, reason text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE me uuid := auth.uid(); q text;
BEGIN
  IF me IS NULL THEN RETURN; END IF;
  q := trim(coalesce(_query, ''));
  IF length(q) < 2 THEN RETURN; END IF;
  RETURN QUERY
  WITH my_friends AS (
    SELECT CASE WHEN f.user_id = me THEN f.friend_id ELSE f.user_id END AS uid
    FROM public.friendships f WHERE f.status = 'accepted' AND (f.user_id = me OR f.friend_id = me)
  ), connected AS (
    SELECT CASE WHEN f.user_id = me THEN f.friend_id ELSE f.user_id END AS uid,
      CASE WHEN f.status = 'accepted' THEN 'Friends' ELSE 'Friend request' END AS reason
    FROM public.friendships f WHERE f.status IN ('accepted', 'pending') AND (f.user_id = me OR f.friend_id = me)
    UNION
    SELECT CASE WHEN f.user_id = mf.uid THEN f.friend_id ELSE f.user_id END, 'Mutual friend'::text
    FROM my_friends mf JOIN public.friendships f ON f.status = 'accepted' AND (f.user_id = mf.uid OR f.friend_id = mf.uid)
    UNION
    SELECT gm2.user_id, 'Shared group'::text FROM public.group_members gm1
    JOIN public.group_members gm2 ON gm2.group_id = gm1.group_id AND gm2.user_id <> me
    WHERE gm1.user_id = me AND gm1.status = 'active' AND gm2.status = 'active'
    UNION
    SELECT er2.user_id, 'Shared event'::text FROM public.calendar_event_registrations er1
    JOIN public.calendar_event_registrations er2 ON er2.event_id = er1.event_id AND er2.user_id <> me
    WHERE er1.user_id = me
    UNION
    SELECT mp2.player_id, 'Played together'::text FROM public.match_participants mp1
    JOIN public.matches m ON m.id = mp1.match_id AND m.status = 'approved' AND NOT COALESCE(m.voided, false)
    JOIN public.match_participants mp2 ON mp2.match_id = mp1.match_id AND mp2.player_id <> me
    WHERE mp1.player_id = me
    UNION
    SELECT rp2.player_id, 'Played round robin'::text FROM public.round_robin_players rp1
    JOIN public.round_robin_players rp2 ON rp2.event_id = rp1.event_id AND rp2.player_id <> me
    WHERE rp1.player_id = me AND rp1.active AND rp2.active
  )
  SELECT p.id, p.display_name, p.full_name, p.avatar_url, p.current_rating, p.handle, min(c.reason)
  FROM connected c JOIN public.profiles p ON p.id = c.uid
  WHERE p.id <> me AND NOT public.is_blocked_between(me, p.id)
    AND NOT EXISTS (SELECT 1 FROM public.friendships f WHERE f.status = 'blocked'
      AND ((f.user_id = me AND f.friend_id = p.id) OR (f.user_id = p.id AND f.friend_id = me)))
    AND (p.display_name ILIKE '%' || q || '%' OR p.full_name ILIKE '%' || q || '%'
      OR p.handle ILIKE '%' || regexp_replace(q, '^@', '') || '%')
  GROUP BY p.id, p.display_name, p.full_name, p.avatar_url, p.current_rating, p.handle
  ORDER BY coalesce(p.display_name, p.full_name), p.id LIMIT 20;
END;
$$;
REVOKE ALL ON FUNCTION public.search_connectable_users(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_connectable_users(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.discover_players_nearby(_radius_km double precision DEFAULT 40, _limit integer DEFAULT 30)
RETURNS TABLE (id uuid, display_name text, full_name text, avatar_url text, current_rating numeric,
  handle text, location_name text, distance_km double precision, reason text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
DECLARE v_actor uuid := auth.uid(); v_lat double precision; v_lng double precision; v_discoverable boolean;
BEGIN
  IF v_actor IS NULL THEN RETURN; END IF;
  SELECT p.location_lat, p.location_lng, p.discoverable_by_location INTO v_lat, v_lng, v_discoverable
  FROM public.profiles p WHERE p.id = v_actor;
  IF v_lat IS NULL OR v_lng IS NULL OR v_discoverable IS NOT TRUE THEN RETURN; END IF;
  RETURN QUERY
  WITH nearby AS (
    SELECT p.id, p.display_name, p.full_name, p.avatar_url, p.current_rating, p.handle, p.location_name,
      2 * 6371 * asin(sqrt(least(1.0,
        power(sin(radians(p.location_lat - v_lat) / 2), 2) + cos(radians(v_lat)) * cos(radians(p.location_lat)) *
        power(sin(radians(p.location_lng - v_lng) / 2), 2)))) AS dist_km
    FROM public.profiles p WHERE p.id <> v_actor AND p.discoverable_by_location = true
      AND p.location_lat IS NOT NULL AND p.location_lng IS NOT NULL
      AND NOT public.is_blocked_between(v_actor, p.id)
  )
  SELECT n.id, n.display_name, n.full_name, n.avatar_url, n.current_rating, n.handle, n.location_name,
    round(n.dist_km::numeric, 1)::double precision, 'Near you'::text
  FROM nearby n WHERE n.dist_km <= greatest(_radius_km, 0)
    AND NOT EXISTS (SELECT 1 FROM public.friendships f
      WHERE (f.user_id = v_actor AND f.friend_id = n.id) OR (f.friend_id = v_actor AND f.user_id = n.id))
  ORDER BY n.dist_km, n.current_rating DESC NULLS LAST, n.id LIMIT least(greatest(_limit, 1), 100);
END;
$$;
REVOKE ALL ON FUNCTION public.discover_players_nearby(double precision, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.discover_players_nearby(double precision, integer) TO authenticated;

COMMIT;
