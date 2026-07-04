-- =====================================================================
-- Track C/8: bulk-add league members by email
--
-- Real leagues open with 20–60 members. Admins have been adding them
-- one at a time from the Members tab. This RPC lets an admin paste a
-- newline-or-comma-separated email list, resolve each to a profile
-- (case-insensitive), and idempotently insert an active membership
-- for the ones that match.
--
-- The RPC has TWO modes:
--   * dry_run = true  → report only. Doesn't touch anything.
--   * dry_run = false → same report + performs INSERTs for anyone
--                       matched and not already a member.
--
-- Both modes return the same JSONB shape so the client can render
-- a preview from dry_run and then re-issue with dry_run=false to
-- commit.
-- =====================================================================


CREATE OR REPLACE FUNCTION public.bulk_add_league_members(
  p_league_id   UUID,
  p_season_id   UUID DEFAULT NULL,
  p_division_id UUID DEFAULT NULL,
  p_emails      TEXT[]  DEFAULT ARRAY[]::TEXT[],
  p_dry_run     BOOLEAN DEFAULT TRUE
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user   UUID := auth.uid();
  v_email  TEXT;
  v_norm   TEXT;
  v_profile RECORD;
  v_existing UUID;
  v_new_mem UUID;
  v_resolved JSONB := '[]'::JSONB;
  v_unmatched TEXT[] := ARRAY[]::TEXT[];
  v_added_count INT := 0;
  v_reactivated_count INT := 0;
  v_already_count INT := 0;
BEGIN
  -- Auth + admin gate. Same pattern as the other admin RPCs.
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  IF NOT public.has_role(v_user, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin role required' USING ERRCODE = '42501';
  END IF;

  -- League must exist.
  IF NOT EXISTS (SELECT 1 FROM public.leagues WHERE id = p_league_id) THEN
    RAISE EXCEPTION 'League not found' USING ERRCODE = '02000';
  END IF;

  -- Sanity-check season/division belong to this league when set.
  IF p_season_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.league_seasons
       WHERE id = p_season_id AND league_id = p_league_id
    ) THEN
      RAISE EXCEPTION 'Season does not belong to this league'
        USING ERRCODE = '22023';
    END IF;
  END IF;
  IF p_division_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.league_divisions
       WHERE id = p_division_id AND league_id = p_league_id
    ) THEN
      RAISE EXCEPTION 'Division does not belong to this league'
        USING ERRCODE = '22023';
    END IF;
  END IF;
  IF p_emails IS NULL OR array_length(p_emails, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'resolved', v_resolved,
      'unmatched', v_unmatched,
      'added_count', 0,
      'reactivated_count', 0,
      'already_active_count', 0,
      'dry_run', p_dry_run
    );
  END IF;

  FOREACH v_email IN ARRAY p_emails LOOP
    v_norm := lower(trim(v_email));
    -- Skip empties silently.
    IF v_norm = '' THEN CONTINUE; END IF;

    -- Case-insensitive lookup. profiles.email is stored as-entered so
    -- we compare lowercase-both-sides.
    SELECT id, COALESCE(display_name, full_name, email) AS name, email
      INTO v_profile
      FROM public.profiles
     WHERE lower(email) = v_norm
     LIMIT 1;

    IF v_profile.id IS NULL THEN
      v_unmatched := array_append(v_unmatched, v_email);
      CONTINUE;
    END IF;

    -- Is there already a membership row for (league, user)? If season
    -- is passed we scope the check to that season; otherwise the
    -- league-wide row.
    SELECT id INTO v_existing
      FROM public.league_members
     WHERE league_id = p_league_id
       AND user_id = v_profile.id
       AND (
         (p_season_id IS NOT NULL AND season_id = p_season_id)
         OR (p_season_id IS NULL AND season_id IS NULL)
       )
     LIMIT 1;

    IF v_existing IS NOT NULL THEN
      -- Check current status — reactivate if removed, otherwise just
      -- report as already-active.
      DECLARE v_status TEXT;
      BEGIN
        SELECT status INTO v_status FROM public.league_members WHERE id = v_existing;
        IF v_status = 'active' THEN
          v_already_count := v_already_count + 1;
          v_resolved := v_resolved || jsonb_build_object(
            'email', v_email,
            'user_id', v_profile.id,
            'name', v_profile.name,
            'outcome', 'already_active'
          );
        ELSE
          IF NOT p_dry_run THEN
            UPDATE public.league_members
               SET status = 'active',
                   division_id = COALESCE(p_division_id, division_id),
                   updated_at = NOW()
             WHERE id = v_existing;
          END IF;
          v_reactivated_count := v_reactivated_count + 1;
          v_resolved := v_resolved || jsonb_build_object(
            'email', v_email,
            'user_id', v_profile.id,
            'name', v_profile.name,
            'outcome', 'reactivated'
          );
        END IF;
      END;
    ELSE
      -- New membership. Only touch the DB when not a dry run.
      IF NOT p_dry_run THEN
        INSERT INTO public.league_members (
          league_id, season_id, division_id, user_id, role, status
        ) VALUES (
          p_league_id, p_season_id, p_division_id, v_profile.id,
          'player', 'active'
        )
        RETURNING id INTO v_new_mem;
      END IF;
      v_added_count := v_added_count + 1;
      v_resolved := v_resolved || jsonb_build_object(
        'email', v_email,
        'user_id', v_profile.id,
        'name', v_profile.name,
        'outcome', 'added'
      );
    END IF;
  END LOOP;

  -- One audit entry per commit — enough to reconstruct without
  -- flooding the log with N rows.
  IF NOT p_dry_run AND (v_added_count > 0 OR v_reactivated_count > 0) THEN
    INSERT INTO public.league_audit_log
      (league_id, season_id, actor_user_id, action, entity_type,
       entity_id, new_value)
    VALUES (
      p_league_id, p_season_id, v_user, 'members.bulk_added',
      'league_members', p_league_id,
      jsonb_build_object(
        'added_count', v_added_count,
        'reactivated_count', v_reactivated_count,
        'already_active_count', v_already_count,
        'unmatched_count', COALESCE(array_length(v_unmatched, 1), 0),
        'division_id', p_division_id
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'resolved', v_resolved,
    'unmatched', v_unmatched,
    'added_count', v_added_count,
    'reactivated_count', v_reactivated_count,
    'already_active_count', v_already_count,
    'dry_run', p_dry_run
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.bulk_add_league_members(
  UUID, UUID, UUID, TEXT[], BOOLEAN
) TO authenticated;

COMMENT ON FUNCTION public.bulk_add_league_members IS
  'Admin-only bulk membership import by email. Two-phase (dry_run + '
  'commit) so the client can show a preview. Case-insensitive email '
  'matching against profiles.email. Idempotent — existing active '
  'members are reported but not touched; removed memberships are '
  'reactivated. Emits one audit entry per commit call.';
