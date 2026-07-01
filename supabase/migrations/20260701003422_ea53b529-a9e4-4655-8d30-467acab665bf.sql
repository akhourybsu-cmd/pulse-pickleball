-- Dismissals table
CREATE TABLE IF NOT EXISTS public.friend_suggestion_dismissals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dismissed_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, dismissed_user_id)
);

GRANT SELECT, INSERT, DELETE ON public.friend_suggestion_dismissals TO authenticated;
GRANT ALL ON public.friend_suggestion_dismissals TO service_role;

ALTER TABLE public.friend_suggestion_dismissals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own dismissals" ON public.friend_suggestion_dismissals;
CREATE POLICY "Users view own dismissals"
  ON public.friend_suggestion_dismissals FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own dismissals" ON public.friend_suggestion_dismissals;
CREATE POLICY "Users insert own dismissals"
  ON public.friend_suggestion_dismissals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own dismissals" ON public.friend_suggestion_dismissals;
CREATE POLICY "Users delete own dismissals"
  ON public.friend_suggestion_dismissals FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_friend_suggestion_dismissals_user
  ON public.friend_suggestion_dismissals(user_id);

-- Dismiss RPC
CREATE OR REPLACE FUNCTION public.dismiss_friend_suggestion(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF target_user_id IS NULL OR target_user_id = me THEN
    RETURN;
  END IF;
  INSERT INTO public.friend_suggestion_dismissals (user_id, dismissed_user_id)
  VALUES (me, target_user_id)
  ON CONFLICT (user_id, dismissed_user_id) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dismiss_friend_suggestion(uuid) TO authenticated;

-- Updated suggest_friends: adds RR co-participants + honors dismissals
CREATE OR REPLACE FUNCTION public.suggest_friends()
RETURNS TABLE(id uuid, display_name text, full_name text, avatar_url text, current_rating numeric, handle text, reason text, weight integer)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    UNION ALL
    SELECT rrp2.player_id AS uid, 'Round Robin together'::text, 6
    FROM public.round_robin_players rrp1
    JOIN public.round_robin_players rrp2
      ON rrp2.event_id = rrp1.event_id AND rrp2.player_id <> me
    WHERE rrp1.player_id = me
      AND rrp2.player_id IS NOT NULL
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
$function$;
