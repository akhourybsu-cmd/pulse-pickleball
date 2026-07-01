-- Extends friend suggestions so co-participants from round-robin
-- events surface as candidates, and gives users a way to dismiss
-- suggestions they don't want.
--
-- Two pieces:
--   A) friend_suggestion_dismissals table + dismiss_friend_suggestion
--      RPC so the X-to-dismiss UX on the Friends page persists.
--   B) suggest_friends adds round_robin_players as a candidate source
--      (weight 9, sitting between match_participants at 10 and
--      mutual-friend at 8) AND excludes any user the caller has
--      dismissed.

-- =====================================================================
-- A) Dismissals table
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.friend_suggestion_dismissals (
  user_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dismissed_user_id uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dismissed_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, dismissed_user_id),
  CHECK (user_id <> dismissed_user_id)
);

CREATE INDEX IF NOT EXISTS idx_friend_suggestion_dismissals_user
  ON public.friend_suggestion_dismissals (user_id);

ALTER TABLE public.friend_suggestion_dismissals ENABLE ROW LEVEL SECURITY;

-- Each user can read / insert / delete only their own dismissals.
-- (Deletes let us "un-dismiss" later if we ever add a "Show again"
--  affordance, e.g. in a settings page.)
DROP POLICY IF EXISTS "Users can read own dismissals" ON public.friend_suggestion_dismissals;
CREATE POLICY "Users can read own dismissals"
  ON public.friend_suggestion_dismissals FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own dismissals" ON public.friend_suggestion_dismissals;
CREATE POLICY "Users can insert own dismissals"
  ON public.friend_suggestion_dismissals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own dismissals" ON public.friend_suggestion_dismissals;
CREATE POLICY "Users can delete own dismissals"
  ON public.friend_suggestion_dismissals FOR DELETE
  USING (auth.uid() = user_id);

-- RPC kept for parity with other community write paths — it's a thin
-- INSERT … ON CONFLICT DO NOTHING wrapper that lets clients call one
-- function regardless of whether the dismissal already exists.
CREATE OR REPLACE FUNCTION public.dismiss_friend_suggestion(p_target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;
  IF p_target_user_id IS NULL OR p_target_user_id = v_caller THEN
    RETURN;
  END IF;
  INSERT INTO public.friend_suggestion_dismissals (user_id, dismissed_user_id)
  VALUES (v_caller, p_target_user_id)
  ON CONFLICT (user_id, dismissed_user_id) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dismiss_friend_suggestion(uuid) TO authenticated;

-- =====================================================================
-- B) suggest_friends — add round-robin source + dismissal filter
-- =====================================================================
-- Same shape and selection logic as the prior version; two additions:
--   1. New candidate source: round_robin_players co-participants
--      (active=true on both sides, weight 9). This covers RR events
--      where matches haven't been scored yet — match_participants
--      only catches the post-score case.
--   2. The aggregated step now also filters out any uid that the
--      caller has dismissed.
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
    -- NEW: round-robin co-participants. Anyone you're rostered with on
    -- an active RR slot is suggested, even if the event hasn't been
    -- scored yet (match_participants only fires once scores land).
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
    -- Existing exclusions: anyone we already have a friendship row
    -- with (accepted, pending, or blocked).
    SELECT CASE WHEN user_id = me THEN friend_id ELSE user_id END AS uid
    FROM public.friendships
    WHERE (user_id = me OR friend_id = me)
      AND status IN ('accepted', 'pending', 'blocked')
    UNION
    -- NEW: anyone the caller has explicitly dismissed.
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
$$;

GRANT EXECUTE ON FUNCTION public.suggest_friends() TO authenticated;
