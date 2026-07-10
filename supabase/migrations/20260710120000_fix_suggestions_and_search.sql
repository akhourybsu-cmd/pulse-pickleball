-- =====================================================================
-- Fix suggest_friends + search_connectable_users: both are DOWN on the
-- live database with SQLSTATE 42703.
--
-- Every repo version of these functions (20260623021253, 20260703000000,
-- 20260707100000) sources "Shared tournament" from
-- tournament_registrations.tournament_event_id / .user_id — but the live
-- table is TEAM-based: captain_user_id, partner_user_id, event_id,
-- division_id. Neither referenced column exists. plpgsql bodies aren't
-- validated at CREATE time, so the function applied cleanly and then
-- fails at runtime on its first call — the Suggestions tab and the
-- Connect search have been returning 400 for every user.
--
-- Fix: drop the tournament source entirely (the tournament surface is
-- archived from the player app; if it returns, reintroduce a source
-- built on captain/partner columns). Everything else is retained from
-- 20260707100000 (RR co-players, dismissals, user_blocks exclusion).
--
-- Improvement while here: "Played together" now counts only real
-- recorded matches — status = 'approved' and not voided — so people
-- from voided or unapproved matches aren't suggested.
-- =====================================================================

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
    -- Recorded matches only: approved + not voided.
    SELECT mp2.player_id AS uid, 'Played together'::text AS reason, 10 AS weight
    FROM public.match_participants mp1
    JOIN public.matches m
      ON m.id = mp1.match_id
     AND m.status = 'approved'
     AND COALESCE(m.voided, false) = false
    JOIN public.match_participants mp2
      ON mp2.match_id = mp1.match_id AND mp2.player_id <> me
    WHERE mp1.player_id = me
    UNION ALL
    SELECT rp2.player_id AS uid, 'Played round robin'::text AS reason, 9 AS weight
    FROM public.round_robin_players rp1
    JOIN public.round_robin_players rp2
      ON rp2.event_id = rp1.event_id AND rp2.player_id <> me
    WHERE rp1.player_id = me
      AND rp1.active = true
      AND rp2.active = true
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
    UNION
    SELECT dismissed_user_id AS uid
    FROM public.friend_suggestion_dismissals
    WHERE user_id = me
    UNION
    SELECT CASE WHEN blocker_id = me THEN blocked_id ELSE blocker_id END AS uid
    FROM public.user_blocks
    WHERE blocker_id = me OR blocked_id = me
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
    SELECT DISTINCT mp2.player_id, 'Played together'::text
    FROM public.match_participants mp1
    JOIN public.matches m
      ON m.id = mp1.match_id
     AND m.status = 'approved'
     AND COALESCE(m.voided, false) = false
    JOIN public.match_participants mp2
      ON mp2.match_id = mp1.match_id AND mp2.player_id <> me
    WHERE mp1.player_id = me
    UNION
    -- Round-robin co-participants belong in the trusted search graph too
    -- (they were already a suggestion source; search previously missed them).
    SELECT DISTINCT rp2.player_id, 'Played round robin'::text
    FROM public.round_robin_players rp1
    JOIN public.round_robin_players rp2
      ON rp2.event_id = rp1.event_id AND rp2.player_id <> me
    WHERE rp1.player_id = me
  )
  SELECT p.id, p.display_name, p.full_name, p.avatar_url, p.current_rating, p.handle,
         min(c.reason) AS reason
  FROM connected c
  JOIN public.profiles p ON p.id = c.uid
  WHERE p.id <> me
    AND NOT EXISTS (
      SELECT 1 FROM public.user_blocks ub
       WHERE (ub.blocker_id = me AND ub.blocked_id = p.id)
          OR (ub.blocker_id = p.id AND ub.blocked_id = me)
    )
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
