
-- 1. Add handle column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS handle text;

-- Helper to slugify a name
CREATE OR REPLACE FUNCTION public.slugify_name(input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  s text;
BEGIN
  IF input IS NULL OR length(trim(input)) = 0 THEN
    RETURN 'player';
  END IF;
  s := lower(trim(input));
  s := regexp_replace(s, '[^a-z0-9]+', '-', 'g');
  s := regexp_replace(s, '(^-+|-+$)', '', 'g');
  IF length(s) = 0 THEN
    s := 'player';
  END IF;
  IF length(s) > 20 THEN
    s := substring(s from 1 for 20);
    s := regexp_replace(s, '-+$', '', 'g');
  END IF;
  RETURN s;
END;
$$;

-- Generate a unique handle for a profile
CREATE OR REPLACE FUNCTION public.generate_unique_handle(base_name text)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  base text;
  candidate text;
  suffix text;
  attempts int := 0;
BEGIN
  base := public.slugify_name(base_name);
  LOOP
    -- 3 char alphanumeric suffix
    suffix := lower(substring(md5(random()::text || clock_timestamp()::text) from 1 for 3));
    candidate := base || '-' || suffix;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE handle = candidate);
    attempts := attempts + 1;
    IF attempts > 25 THEN
      candidate := base || '-' || substring(md5(random()::text) from 1 for 6);
      EXIT;
    END IF;
  END LOOP;
  RETURN candidate;
END;
$$;

-- Backfill existing rows
UPDATE public.profiles
SET handle = public.generate_unique_handle(
  COALESCE(display_name, full_name, first_name, 'player')
)
WHERE handle IS NULL;

-- Unique index + not null
CREATE UNIQUE INDEX IF NOT EXISTS profiles_handle_unique_idx ON public.profiles (handle);
ALTER TABLE public.profiles ALTER COLUMN handle SET NOT NULL;

-- Trigger to auto-assign handle on insert
CREATE OR REPLACE FUNCTION public.assign_profile_handle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.handle IS NULL OR length(trim(NEW.handle)) = 0 THEN
    NEW.handle := public.generate_unique_handle(
      COALESCE(NEW.display_name, NEW.full_name, NEW.first_name, 'player')
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_assign_handle ON public.profiles;
CREATE TRIGGER profiles_assign_handle
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.assign_profile_handle();

-- 2. Recreate profiles_public view to include handle
DROP VIEW IF EXISTS public.profiles_public;
CREATE VIEW public.profiles_public AS
SELECT
  id, full_name, display_name, first_name, last_name,
  avatar_url, current_rating, total_matches, wins, losses,
  handedness, play_side, paddle_brand, paddle_model, home_court_id,
  handle, created_at
FROM public.profiles;

GRANT SELECT ON public.profiles_public TO authenticated, anon;

-- 3. lookup_player_by_handle
CREATE OR REPLACE FUNCTION public.lookup_player_by_handle(_handle text)
RETURNS TABLE (
  id uuid,
  display_name text,
  full_name text,
  avatar_url text,
  current_rating numeric,
  handle text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.display_name, p.full_name, p.avatar_url, p.current_rating, p.handle
  FROM public.profiles p
  WHERE lower(p.handle) = lower(regexp_replace(coalesce(_handle, ''), '^@', ''))
    AND p.id <> auth.uid()
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_player_by_handle(text) TO authenticated;

-- 4. search_connectable_users — scoped to trusted graph
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
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  q text;
BEGIN
  IF me IS NULL THEN RETURN; END IF;
  q := trim(coalesce(_query, ''));
  IF length(q) < 2 THEN RETURN; END IF;

  RETURN QUERY
  WITH connected AS (
    -- friends of friends
    SELECT DISTINCT CASE WHEN f2.user_id = fr.friend_id THEN f2.friend_id ELSE f2.user_id END AS uid,
           'Mutual friend'::text AS reason
    FROM public.friendships fr
    JOIN public.friendships f2
      ON f2.status = 'accepted'
     AND (f2.user_id IN (fr.user_id, fr.friend_id) OR f2.friend_id IN (fr.user_id, fr.friend_id))
    WHERE fr.status = 'accepted'
      AND (fr.user_id = me OR fr.friend_id = me)
    UNION
    -- shared groups
    SELECT DISTINCT gm2.user_id, 'Shared group'::text
    FROM public.group_members gm1
    JOIN public.group_members gm2 ON gm2.group_id = gm1.group_id AND gm2.user_id <> me
    WHERE gm1.user_id = me
    UNION
    -- shared events (calendar)
    SELECT DISTINCT er2.user_id, 'Shared event'::text
    FROM public.calendar_event_registrations er1
    JOIN public.calendar_event_registrations er2 ON er2.event_id = er1.event_id AND er2.user_id <> me
    WHERE er1.user_id = me
    UNION
    -- shared tournaments
    SELECT DISTINCT tr2.user_id, 'Shared tournament'::text
    FROM public.tournament_registrations tr1
    JOIN public.tournament_registrations tr2 ON tr2.tournament_event_id = tr1.tournament_event_id AND tr2.user_id <> me
    WHERE tr1.user_id = me
    UNION
    -- played matches together
    SELECT DISTINCT mp2.user_id, 'Played together'::text
    FROM public.match_participants mp1
    JOIN public.match_participants mp2 ON mp2.match_id = mp1.match_id AND mp2.user_id <> me
    WHERE mp1.user_id = me
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

-- 5. suggest_friends — ranked suggestions from trusted graph
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
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH candidates AS (
    -- Played matches together (highest signal)
    SELECT mp2.user_id AS uid, 'Played together'::text AS reason, 10 AS weight
    FROM public.match_participants mp1
    JOIN public.match_participants mp2 ON mp2.match_id = mp1.match_id AND mp2.user_id <> me
    WHERE mp1.user_id = me
    UNION ALL
    -- Mutual friends
    SELECT CASE WHEN f2.user_id IN (fr.user_id, fr.friend_id) THEN f2.friend_id ELSE f2.user_id END,
           'Mutual friend'::text, 8
    FROM public.friendships fr
    JOIN public.friendships f2
      ON f2.status = 'accepted'
     AND (f2.user_id IN (fr.user_id, fr.friend_id) OR f2.friend_id IN (fr.user_id, fr.friend_id))
    WHERE fr.status = 'accepted'
      AND (fr.user_id = me OR fr.friend_id = me)
    UNION ALL
    -- Shared groups
    SELECT gm2.user_id, 'Shared group'::text, 5
    FROM public.group_members gm1
    JOIN public.group_members gm2 ON gm2.group_id = gm1.group_id AND gm2.user_id <> me
    WHERE gm1.user_id = me
    UNION ALL
    -- Shared tournaments
    SELECT tr2.user_id, 'Shared tournament'::text, 4
    FROM public.tournament_registrations tr1
    JOIN public.tournament_registrations tr2 ON tr2.tournament_event_id = tr1.tournament_event_id AND tr2.user_id <> me
    WHERE tr1.user_id = me
    UNION ALL
    -- Shared events
    SELECT er2.user_id, 'Shared event'::text, 3
    FROM public.calendar_event_registrations er1
    JOIN public.calendar_event_registrations er2 ON er2.event_id = er1.event_id AND er2.user_id <> me
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
