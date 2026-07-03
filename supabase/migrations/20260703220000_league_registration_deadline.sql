-- =====================================================================
-- Phase 7: registration deadline enforcement
--
-- Two RPCs get updated:
--
--   1. find_league_by_invite_code(text) — additional return columns
--      so the teaser can show a "registration open until X" note or
--      "registration closed" state. Doesn't change existing behavior;
--      just widens the return type.
--
--   2. join_league_by_code(text) — rejects NEW registrations when
--      every active season for the league has passed its
--      registration_deadline. Rules:
--        • No active seasons                → allow (setup phase)
--        • At least one active season is
--          still open (deadline null OR
--          in the future)                   → allow
--        • All active seasons have a
--          deadline in the past             → reject
--
-- Reactivations of a previously-removed member are ALWAYS allowed —
-- the person was already registered and the admin removed them; the
-- deadline check is about NEW registrations only. This mirrors the
-- Round Robin invite-code pattern.
--
-- No schema changes. Both functions are CREATE OR REPLACE.
-- =====================================================================


-- ---------- Widened teaser lookup --------------------------------------
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
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

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
        -- Any active season still accepting registrations?
        bool_or(
          s.registration_deadline IS NULL
          OR s.registration_deadline >= CURRENT_DATE
        ) FILTER (WHERE s.status = 'active') AS any_open,
        -- Are there any active seasons at all?
        bool_or(s.status = 'active') AS any_active,
        -- Earliest upcoming deadline among active + open seasons.
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
      -- Registration is open when there are no active seasons yet
      -- (setup phase) OR when at least one active season is still
      -- accepting entries.
      COALESCE(NOT ss.any_active OR ss.any_open, TRUE) AS registration_open,
      ss.next_deadline AS registration_closes_at
    FROM matched m
    LEFT JOIN season_state ss ON ss.league_id = m.id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.find_league_by_invite_code(TEXT) TO authenticated;


-- ---------- Join with deadline check -----------------------------------
CREATE OR REPLACE FUNCTION public.join_league_by_code(p_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user            UUID := auth.uid();
  v_league_id       UUID;
  v_existing_id     UUID;
  v_existing_status TEXT;
  v_new_member_id   UUID;
  v_registration_open BOOLEAN;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT id INTO v_league_id
    FROM public.leagues
   WHERE LOWER(invite_code) = LOWER(p_code)
     AND visibility <> 'admin_only'
   LIMIT 1;

  IF v_league_id IS NULL THEN
    RAISE EXCEPTION 'No league matches that code' USING ERRCODE = '02000';
  END IF;

  -- Existing membership first — reactivations bypass the deadline.
  SELECT id, status
    INTO v_existing_id, v_existing_status
    FROM public.league_members
   WHERE league_id = v_league_id AND user_id = v_user
   ORDER BY joined_at DESC
   LIMIT 1;

  -- Deadline check applies only to brand-new registrations. Someone
  -- who was previously an active or pending member can always rejoin
  -- through the same code (admin removed them + shared the code
  -- again = a "please come back" gesture, not a new signup).
  IF v_existing_id IS NULL THEN
    SELECT COALESCE(
      -- No active season yet → open
      NOT EXISTS (
        SELECT 1 FROM public.league_seasons s
        WHERE s.league_id = v_league_id AND s.status = 'active'
      )
      -- Or at least one active season still accepting registrations
      OR EXISTS (
        SELECT 1 FROM public.league_seasons s
        WHERE s.league_id = v_league_id
          AND s.status = 'active'
          AND (s.registration_deadline IS NULL
               OR s.registration_deadline >= CURRENT_DATE)
      ),
      TRUE
    )
    INTO v_registration_open;

    IF NOT v_registration_open THEN
      RAISE EXCEPTION 'Registration for this league has closed'
        USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.league_members (league_id, user_id, role, status)
    VALUES (v_league_id, v_user, 'player', 'active')
    RETURNING id INTO v_new_member_id;

    INSERT INTO public.league_audit_log
      (league_id, actor_user_id, action, entity_type, entity_id, new_value)
    VALUES (
      v_league_id, v_user, 'member.joined_by_code', 'member', v_new_member_id,
      jsonb_build_object('via', 'invite_code')
    );

  ELSIF v_existing_status <> 'active' THEN
    UPDATE public.league_members
       SET status = 'active', updated_at = NOW()
     WHERE id = v_existing_id;

    INSERT INTO public.league_audit_log
      (league_id, actor_user_id, action, entity_type, entity_id,
       old_value, new_value)
    VALUES (
      v_league_id, v_user, 'member.rejoined_by_code', 'member', v_existing_id,
      jsonb_build_object('status', v_existing_status),
      jsonb_build_object('status', 'active', 'via', 'invite_code')
    );
  END IF;
  -- else: already-active member — no-op.

  RETURN v_league_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.join_league_by_code(TEXT) TO authenticated;
