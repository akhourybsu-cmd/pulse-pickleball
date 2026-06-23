-- Fix suggest_friends and search_connectable_users:
-- match_participants column is "player_id", not "user_id".

CREATE OR REPLACE FUNCTION public.suggest_friends()
RETURNS TABLE (
  id uuid,
  display_name text,
  full_name text,
  avatar_url text,
  current_rating numeric,
  handle text,
  reason text,
  weight int
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT mp2.player_id AS uid, 'Played together'::text AS reason, 10 AS weight
    FROM public.match_participants mp1
    JOIN public.match_participants mp2
      ON mp2.match_id = mp1.match_id AND mp2.player_id <> me
    WHERE mp1.player_id = me
    UNION ALL
    SELECT CASE WHEN f2.user_id IN (fr.user_id, fr.friend_id) THEN f2.friend_id ELSE f2.user_id END,
           'Mutual friend'::text, 8
    FROM public.friendships fr
    JOIN public.friendships f2
      ON f2.status = 'accepted'
     AND (f2.user_id IN (fr.user_id, fr.friend_id) OR f2.friend_id IN (fr.user_id, fr.friend_id))
    WHERE fr.status = 'accepted'
      AND (fr.user_id = me OR fr.friend_id = me)
    UNION ALL
    SELECT gm2.user_id, 'Shared group'::text, 5
    FROM public.group_members gm1
    JOIN public.group_members gm2 ON gm2.group_id = gm1.group_id AND gm2.user_id <> me
    WHERE gm1.user_id = me
    UNION ALL
    SELECT tr2.user_id, 'Shared tournament'::text, 4
    FROM public.tournament_registrations tr1
    JOIN public.tournament_registrations tr2
      ON tr2.tournament_event_id = tr1.tournament_event_id AND tr2.user_id <> me
    WHERE tr1.user_id = me
    UNION ALL
    SELECT er2.user_id, 'Shared event'::text, 3
    FROM public.calendar_event_registrations er1
    JOIN public.calendar_event_registrations er2
      ON er2.event_id = er1.event_id AND er2.user_id <> me
    WHERE er1.user_id = me
  ),
  excluded AS (
    SELECT CASE WHEN user_id = me THEN friend_id ELSE user_id END AS uid
    FROM public.friendships
    WHERE (user_id = me OR friend_id = me)
      AND status IN ('accepted', 'pending', 'blocked')
  ),
  aggregated AS (
    SELECT uid, sum(weight)::int AS total_weight, count(*)::int AS hits
    FROM candidates
    WHERE uid IS NOT NULL
      AND uid NOT IN (SELECT uid FROM excluded WHERE uid IS NOT NULL)
    GROUP BY uid
  )
  SELECT p.id, p.display_name, p.full_name, p.avatar_url, p.current_rating, p.handle,
         (SELECT c.reason FROM candidates c WHERE c.uid = a.uid ORDER BY c.weight DESC LIMIT 1) AS reason,
         a.total_weight AS weight
  FROM aggregated a
  JOIN public.profiles p ON p.id = a.uid
  ORDER BY a.total_weight DESC, a.hits DESC
  LIMIT 24;
END;
$$;

GRANT EXECUTE ON FUNCTION public.suggest_friends() TO authenticated;


CREATE OR REPLACE FUNCTION public.search_connectable_users(_query text)
RETURNS TABLE (
  id uuid,
  display_name text,
  full_name text,
  avatar_url text,
  current_rating numeric,
  handle text,
  reason text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE me uuid := auth.uid(); q text;
BEGIN
  IF me IS NULL THEN RETURN; END IF;
  q := trim(coalesce(_query, ''));
  IF length(q) < 2 THEN RETURN; END IF;

  RETURN QUERY
  WITH connected AS (
    SELECT DISTINCT CASE WHEN f2.user_id = fr.friend_id THEN f2.friend_id ELSE f2.user_id END AS uid,
           'Mutual friend'::text AS reason
    FROM public.friendships fr
    JOIN public.friendships f2
      ON f2.status = 'accepted'
     AND (f2.user_id IN (fr.user_id, fr.friend_id) OR f2.friend_id IN (fr.user_id, fr.friend_id))
    WHERE fr.status = 'accepted'
      AND (fr.user_id = me OR fr.friend_id = me)
    UNION
    SELECT DISTINCT gm2.user_id, 'Shared group'::text
    FROM public.group_members gm1
    JOIN public.group_members gm2 ON gm2.group_id = gm1.group_id AND gm2.user_id <> me
    WHERE gm1.user_id = me
    UNION
    SELECT DISTINCT er2.user_id, 'Shared event'::text
    FROM public.calendar_event_registrations er1
    JOIN public.calendar_event_registrations er2 ON er2.event_id = er1.event_id AND er2.user_id <> me
    WHERE er1.user_id = me
    UNION
    SELECT DISTINCT tr2.user_id, 'Shared tournament'::text
    FROM public.tournament_registrations tr1
    JOIN public.tournament_registrations tr2 ON tr2.tournament_event_id = tr1.tournament_event_id AND tr2.user_id <> me
    WHERE tr1.user_id = me
    UNION
    SELECT DISTINCT mp2.player_id, 'Played together'::text
    FROM public.match_participants mp1
    JOIN public.match_participants mp2
      ON mp2.match_id = mp1.match_id AND mp2.player_id <> me
    WHERE mp1.player_id = me
  )
  SELECT p.id, p.display_name, p.full_name, p.avatar_url, p.current_rating, p.handle,
         min(c.reason) AS reason
  FROM connected c
  JOIN public.profiles p ON p.id = c.uid
  WHERE p.id <> me
    AND (
      p.display_name ILIKE '%' || q || '%'
      OR p.full_name ILIKE '%' || q || '%'
      OR p.handle ILIKE '%' || regexp_replace(q, '^@', '') || '%'
    )
  GROUP BY p.id, p.display_name, p.full_name, p.avatar_url, p.current_rating, p.handle
  LIMIT 20;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_connectable_users(text) TO authenticated;
