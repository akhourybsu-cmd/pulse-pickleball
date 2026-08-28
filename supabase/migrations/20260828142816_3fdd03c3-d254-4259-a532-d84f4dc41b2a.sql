-- Recent co-players (matches + round robins), most recent first.
CREATE OR REPLACE FUNCTION public.recent_play_partners(_limit integer DEFAULT 24)
RETURNS TABLE (
  id uuid,
  display_name text,
  full_name text,
  avatar_url text,
  current_rating numeric,
  handle text,
  reason text,
  last_played_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH plays AS (
    SELECT mp2.player_id AS uid,
           'Played together'::text AS reason,
           COALESCE(m.played_at, m.created_at) AS when_at
    FROM public.match_participants mp1
    JOIN public.matches m
      ON m.id = mp1.match_id
     AND COALESCE(m.voided, false) = false
    JOIN public.match_participants mp2
      ON mp2.match_id = mp1.match_id AND mp2.player_id <> me
    WHERE mp1.player_id = me
    UNION ALL
    SELECT rp2.player_id AS uid,
           'Round robin'::text AS reason,
           COALESCE(rre.event_date::timestamptz, rre.created_at) AS when_at
    FROM public.round_robin_players rp1
    JOIN public.round_robin_events rre ON rre.id = rp1.event_id
    JOIN public.round_robin_players rp2
      ON rp2.event_id = rp1.event_id AND rp2.player_id <> me
    WHERE rp1.player_id = me
  ),
  excluded AS (
    SELECT CASE WHEN user_id = me THEN friend_id ELSE user_id END AS uid
    FROM public.friendships
    WHERE (user_id = me OR friend_id = me)
      AND status IN ('accepted', 'pending', 'blocked')
    UNION
    SELECT CASE WHEN blocker_id = me THEN blocked_id ELSE blocker_id END
    FROM public.user_blocks
    WHERE blocker_id = me OR blocked_id = me
  ),
  agg AS (
    SELECT p.uid,
           max(p.when_at) AS last_at,
           (array_agg(p.reason ORDER BY p.when_at DESC))[1] AS reason
    FROM plays p
    WHERE p.uid IS NOT NULL
      AND p.uid <> me
      AND p.uid NOT IN (SELECT e.uid FROM excluded e WHERE e.uid IS NOT NULL)
    GROUP BY p.uid
  )
  SELECT pr.id, pr.display_name, pr.full_name, pr.avatar_url, pr.current_rating,
         pr.handle, a.reason, a.last_at
  FROM agg a
  JOIN public.profiles pr ON pr.id = a.uid
  ORDER BY a.last_at DESC NULLS LAST
  LIMIT least(greatest(_limit, 1), 100);
END;
$$;

REVOKE ALL ON FUNCTION public.recent_play_partners(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recent_play_partners(integer) TO authenticated;