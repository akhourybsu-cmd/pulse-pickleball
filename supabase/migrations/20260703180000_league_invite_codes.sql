-- =====================================================================
-- Phase 2: League invite codes + public teaser browse
--
-- What ships:
--   1. `leagues.invite_code` — nullable, admin-editable custom string.
--      Case-insensitively unique when set. Format-guarded to
--      alphanumeric + hyphen + underscore, 4–32 chars.
--   2. A second SELECT policy on `leagues` for non-members:
--      users can see any league whose visibility = 'public_future'.
--      Combined with the existing member-scoped policy, players see:
--        • leagues they are members of (via Phase 1 policy), AND
--        • leagues marked visibility='public_future' (browse teaser).
--      `admin_only` leagues remain invisible to non-admins.
--   3. `find_league_by_invite_code(text)` RPC — auth-only, returns
--      the teaser row for a code. Deliberately narrow — description /
--      location / type only. No roster, no schedule.
--   4. `join_league_by_code(text)` RPC — validates the code, creates
--      an active league_members row (or reactivates a previously
--      removed one), writes to league_audit_log. Idempotent for
--      already-active members.
--
-- Safety invariants:
--   • Codes can only be set on leagues with visibility != 'admin_only'
--     via app-level UX — the DB doesn't hard-block it, but every join
--     path checks visibility != 'admin_only' regardless.
--   • Case-insensitive uniqueness prevents "abc123" and "ABC123"
--     colliding.
--   • Every join goes through the RPC so we get consistent audit
--     coverage.
-- =====================================================================

-- ---------- 1. invite_code column --------------------------------------
ALTER TABLE public.leagues
  ADD COLUMN IF NOT EXISTS invite_code TEXT;

-- Case-insensitive uniqueness. Partial so NULL codes don't compete.
CREATE UNIQUE INDEX IF NOT EXISTS idx_leagues_invite_code_ci_unique
  ON public.leagues (LOWER(invite_code))
  WHERE invite_code IS NOT NULL;

-- Format guard: prevents whitespace, punctuation, unicode surprises.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'leagues_invite_code_format'
       AND conrelid = 'public.leagues'::regclass
  ) THEN
    ALTER TABLE public.leagues
      ADD CONSTRAINT leagues_invite_code_format
      CHECK (invite_code IS NULL OR invite_code ~ '^[A-Za-z0-9_-]{4,32}$');
  END IF;
END $$;


-- ---------- 2. Non-member SELECT policy for browse ---------------------
-- Add a SECOND SELECT policy on leagues. Postgres OR-combines same-cmd
-- policies, so a non-admin session can now see:
--   (member-scoped rows from the Phase 1 policy) OR
--   (any row where visibility = 'public_future').
-- Admin `FOR ALL` policy still grants admins everything.

DROP POLICY IF EXISTS "Signed-in users can browse public leagues" ON public.leagues;
CREATE POLICY "Signed-in users can browse public leagues"
  ON public.leagues FOR SELECT
  USING (
    visibility = 'public_future'
    AND auth.uid() IS NOT NULL
  );


-- ---------- 3. Teaser lookup by code -----------------------------------
CREATE OR REPLACE FUNCTION public.find_league_by_invite_code(p_code TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  location TEXT,
  league_type TEXT,
  visibility TEXT,
  guests_allowed BOOLEAN
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
    SELECT l.id,
           l.name,
           l.description,
           l.location,
           l.league_type::TEXT,
           l.visibility::TEXT,
           l.guests_allowed
      FROM public.leagues l
     WHERE LOWER(l.invite_code) = LOWER(p_code)
       AND l.visibility <> 'admin_only';
END;
$function$;

GRANT EXECUTE ON FUNCTION public.find_league_by_invite_code(TEXT) TO authenticated;

COMMENT ON FUNCTION public.find_league_by_invite_code IS
  'Auth-only teaser lookup. Returns the minimal league fields a '
  'prospective member needs to decide "do I want to join?". Never '
  'returns admin_only leagues even if the code matches.';


-- ---------- 4. Join by code -------------------------------------------
CREATE OR REPLACE FUNCTION public.join_league_by_code(p_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user     UUID := auth.uid();
  v_league_id UUID;
  v_existing_id UUID;
  v_existing_status TEXT;
  v_new_member_id UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  -- Case-insensitive code lookup. Excludes admin_only leagues.
  SELECT id INTO v_league_id
    FROM public.leagues
   WHERE LOWER(invite_code) = LOWER(p_code)
     AND visibility <> 'admin_only'
   LIMIT 1;

  IF v_league_id IS NULL THEN
    RAISE EXCEPTION 'No league matches that code' USING ERRCODE = '02000';
  END IF;

  -- Existing membership? Reactivate if removed, no-op if active.
  SELECT id, status
    INTO v_existing_id, v_existing_status
    FROM public.league_members
   WHERE league_id = v_league_id
     AND user_id = v_user
   ORDER BY joined_at DESC
   LIMIT 1;

  IF v_existing_id IS NULL THEN
    INSERT INTO public.league_members (league_id, user_id, role, status)
    VALUES (v_league_id, v_user, 'player', 'active')
    RETURNING id INTO v_new_member_id;

    -- Audit direct — league_action helper requires admin, but this
    -- RPC is SECURITY DEFINER so we can write to the log ourselves.
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
  -- else: already active — do nothing (idempotent).

  RETURN v_league_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.join_league_by_code(TEXT) TO authenticated;

COMMENT ON FUNCTION public.join_league_by_code IS
  'Auth-only join-by-invite-code. Creates an active league_members '
  'row on first join, reactivates a removed member, or no-ops for '
  'an already-active member. Never joins admin_only leagues.';
