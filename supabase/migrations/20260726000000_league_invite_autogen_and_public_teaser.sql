-- =====================================================================
-- Make league invite links the most efficient way to add real players.
--
-- Three changes, all mirroring the already-shipped GROUP invite pattern
-- (find_group_by_invite_code is granted to anon; groups auto-generate a
-- code on creation; the /player/community/join/:code page previews then
-- joins):
--
--   1. generate_league_invite_code() — a unique, shareable code.
--   2. A BEFORE INSERT trigger on public.leagues that stamps a code on
--      every new (non-admin_only) league, so a league is shareable the
--      moment it's created. Done as a trigger — NOT inside create_league —
--      so it survives Lovable re-applying create_league, and covers any
--      other insert path too. Existing code-less leagues are backfilled.
--   3. find_league_by_invite_code() no longer requires a logged-in user,
--      and is granted to anon. This powers a logged-out teaser on the
--      shared join link ("You're invited to {league}") so a recipient can
--      see what they're joining before signing in — instead of hitting a
--      blank auth wall. It returns only public teaser columns and still
--      hides admin_only leagues, exactly like the group teaser.
--
-- join_league_by_code is deliberately left as-is (still authenticated-
-- only): previewing is public, but actually joining requires an account.
-- =====================================================================

-- ---- 1) Unique code generator ---------------------------------------
CREATE OR REPLACE FUNCTION public.generate_league_invite_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code   TEXT;
  v_exists BOOLEAN;
BEGIN
  LOOP
    -- 8 hex chars + a dash → e.g. "A1B2-C3D4". Matches the
    -- leagues_invite_code_format CHECK (^[A-Za-z0-9_-]{4,32}$) and is
    -- easy to read aloud / type from a poster.
    v_code := UPPER(SUBSTR(md5(random()::text), 1, 4) || '-' ||
                    SUBSTR(md5(random()::text), 1, 4));
    -- Case-insensitive uniqueness (matches idx_leagues_invite_code_ci_unique).
    SELECT EXISTS (
      SELECT 1 FROM public.leagues WHERE LOWER(invite_code) = LOWER(v_code)
    ) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  RETURN v_code;
END;
$$;

-- ---- 2) Auto-stamp a code on new leagues ----------------------------
CREATE OR REPLACE FUNCTION public.set_league_invite_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only auto-generate when none was supplied and the league is
  -- shareable. admin_only leagues can't be joined by code (the join
  -- path filters them out and InviteCodeCard blocks setting one), so
  -- leave those blank.
  IF (NEW.invite_code IS NULL OR TRIM(NEW.invite_code) = '')
     AND COALESCE(NEW.visibility, 'private') <> 'admin_only' THEN
    NEW.invite_code := public.generate_league_invite_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_league_invite_code ON public.leagues;
CREATE TRIGGER trg_set_league_invite_code
  BEFORE INSERT ON public.leagues
  FOR EACH ROW
  EXECUTE FUNCTION public.set_league_invite_code();

-- Backfill: give every existing shareable league a code so old leagues
-- become instantly shareable too.
UPDATE public.leagues
   SET invite_code = public.generate_league_invite_code()
 WHERE (invite_code IS NULL OR TRIM(invite_code) = '')
   AND COALESCE(visibility, 'private') <> 'admin_only';

-- ---- 3) Public (anon-readable) teaser lookup ------------------------
-- Reproduces the current body (20260703220000) minus the auth guard, so
-- a logged-out invite recipient can preview the league before signing in.
CREATE OR REPLACE FUNCTION public.find_league_by_invite_code(p_code TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  location TEXT,
  league_type TEXT,
  visibility TEXT,
  guests_allowed BOOLEAN,
  registration_open BOOLEAN,
  registration_closes_at DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $function$
BEGIN
  -- No auth guard: this is a public teaser (admin_only leagues are still
  -- hidden below). Joining still requires an account.
  RETURN QUERY
    WITH matched AS (
      SELECT l.*
        FROM public.leagues l
       WHERE LOWER(l.invite_code) = LOWER(p_code)
         AND l.visibility <> 'admin_only'
       LIMIT 1
    ),
    season_state AS (
      SELECT
        m.id AS league_id,
        bool_or(
          s.registration_deadline IS NULL
          OR s.registration_deadline >= CURRENT_DATE
        ) FILTER (WHERE s.status = 'active') AS any_open,
        bool_or(s.status = 'active') AS any_active,
        MIN(s.registration_deadline) FILTER (
          WHERE s.status = 'active'
            AND s.registration_deadline IS NOT NULL
            AND s.registration_deadline >= CURRENT_DATE
        ) AS next_deadline
      FROM matched m
      LEFT JOIN public.league_seasons s ON s.league_id = m.id
      GROUP BY m.id
    )
    SELECT
      m.id, m.name, m.description, m.location,
      m.league_type::TEXT, m.visibility::TEXT, m.guests_allowed,
      COALESCE(NOT ss.any_active OR ss.any_open, TRUE) AS registration_open,
      ss.next_deadline AS registration_closes_at
    FROM matched m
    LEFT JOIN season_state ss ON ss.league_id = m.id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.generate_league_invite_code() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.find_league_by_invite_code(TEXT) TO anon, authenticated;
