-- =====================================================================
-- Track B/6: kill the join_league_by_code race
--
-- The previous version (20260703220000) reads the caller's existing
-- membership then INSERTs a new one when none exists. Between those
-- two statements, a concurrent request from the same user (double-tap
-- from two devices, backgrounded PWA re-issuing the RPC, etc.) can
-- see the same NULL and race a second INSERT — leaving the player
-- with two active membership rows for the same league.
--
-- Fix: `FOR UPDATE` the leagues row up-front. All concurrent join
-- attempts against the same league now serialize on that row lock,
-- so the second caller sees the first caller's insert and follows
-- the reactivation branch (or the already-active no-op).
--
-- Same pattern as Phase 1.1's Round Robin oversell fix. No RLS or
-- schema changes; just a stronger read lock.
-- =====================================================================


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

  -- FOR UPDATE takes an exclusive row lock on the resolved league,
  -- serializing every join attempt against that league until this
  -- transaction commits or rolls back. Prevents the double-INSERT
  -- race described in the header comment.
  SELECT id INTO v_league_id
    FROM public.leagues
   WHERE LOWER(invite_code) = LOWER(p_code)
     AND visibility <> 'admin_only'
   LIMIT 1
   FOR UPDATE;

  IF v_league_id IS NULL THEN
    RAISE EXCEPTION 'No league matches that code' USING ERRCODE = '02000';
  END IF;

  -- Existing membership first — reactivations bypass the deadline.
  -- Because we hold the leagues row lock, any concurrent caller for
  -- this same code sees our future INSERT if we do one.
  SELECT id, status
    INTO v_existing_id, v_existing_status
    FROM public.league_members
   WHERE league_id = v_league_id AND user_id = v_user
   ORDER BY joined_at DESC
   LIMIT 1;

  IF v_existing_id IS NULL THEN
    SELECT COALESCE(
      NOT EXISTS (
        SELECT 1 FROM public.league_seasons s
        WHERE s.league_id = v_league_id AND s.status = 'active'
      )
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
