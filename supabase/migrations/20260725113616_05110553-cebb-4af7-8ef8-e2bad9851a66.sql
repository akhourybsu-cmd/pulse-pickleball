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
    v_code := UPPER(SUBSTR(md5(random()::text), 1, 4) || '-' ||
                    SUBSTR(md5(random()::text), 1, 4));
    SELECT EXISTS (
      SELECT 1 FROM public.leagues WHERE LOWER(invite_code) = LOWER(v_code)
    ) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  RETURN v_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_league_invite_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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

UPDATE public.leagues
   SET invite_code = public.generate_league_invite_code()
 WHERE (invite_code IS NULL OR TRIM(invite_code) = '')
   AND COALESCE(visibility, 'private') <> 'admin_only';

DROP FUNCTION IF EXISTS public.find_league_by_invite_code(TEXT);
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