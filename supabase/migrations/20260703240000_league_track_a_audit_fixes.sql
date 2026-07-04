-- =====================================================================
-- Track A follow-up: RLS audit fixes
--
-- Two findings from the RLS audit worth addressing:
--
--  1. The forfeit-winner trigger uses `NOT IN` which silently evaluates
--     to NULL (not TRUE) when either team_a_id or team_b_id is NULL,
--     letting a direct SQL UPDATE set forfeit_winner_team_id to any
--     arbitrary UUID as long as one team slot is unset. The RPCs
--     already guard against this, but the trigger is defense-in-depth
--     for direct writes and should hold on its own.
--
--  2. `resolve_league_match_dispute` clears forfeit_winner_team_id
--     unconditionally without preserving the old value in the audit
--     log. When an admin re-scores a previously-forfeited match, the
--     audit trail loses the fact that a forfeit was ever recorded.
-- =====================================================================


-- ---------- 1. Harden the forfeit-winner trigger -----------------------
-- Two failure modes to close:
--   (a) NULL team slots: reject any forfeit_winner_team_id set on a row
--       where either team slot is unset. A forfeit requires both teams
--       to be participants — you can't forfeit a match that isn't set.
--   (b) NOT IN vs NULL: use IS DISTINCT FROM explicitly so the check
--       stays TRUE-evaluating even when one comparand is NULL.
CREATE OR REPLACE FUNCTION public.assert_forfeit_winner_is_participant()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.forfeit_winner_team_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Both team slots MUST be set for the forfeit column to be meaningful.
  IF NEW.team_a_id IS NULL OR NEW.team_b_id IS NULL THEN
    RAISE EXCEPTION
      'Both team_a_id and team_b_id must be set before recording a forfeit winner'
      USING ERRCODE = '22023';
  END IF;

  IF NEW.forfeit_winner_team_id IS DISTINCT FROM NEW.team_a_id
     AND NEW.forfeit_winner_team_id IS DISTINCT FROM NEW.team_b_id THEN
    RAISE EXCEPTION
      'forfeit_winner_team_id must equal team_a_id or team_b_id (got %)',
      NEW.forfeit_winner_team_id
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;


-- ---------- 2. Preserve prior forfeit state in audit log ---------------
-- Add previous forfeit_winner_team_id to the old_value payload so the
-- audit trail shows the admin overrode a forfeit, not just a score.
CREATE OR REPLACE FUNCTION public.resolve_league_match_dispute(
  p_match_id     UUID,
  p_team_a_score INTEGER,
  p_team_b_score INTEGER,
  p_note         TEXT DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user  UUID := auth.uid();
  v_match RECORD;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  IF NOT public.has_role(v_user, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin role required' USING ERRCODE = '42501';
  END IF;
  IF p_team_a_score IS NULL OR p_team_b_score IS NULL
     OR p_team_a_score < 0 OR p_team_b_score < 0 THEN
    RAISE EXCEPTION 'Scores must be non-negative integers'
      USING ERRCODE = '22023';
  END IF;
  IF p_team_a_score = p_team_b_score THEN
    RAISE EXCEPTION 'Pickleball scores cannot be tied'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_match
    FROM public.league_matches WHERE id = p_match_id FOR UPDATE;
  IF v_match.id IS NULL THEN
    RAISE EXCEPTION 'Match not found' USING ERRCODE = '02000';
  END IF;
  -- Allow admins to resolve out of forfeit as well — the whole point is
  -- one canonical override path.
  IF v_match.status NOT IN ('disputed', 'score_submitted', 'forfeit') THEN
    RAISE EXCEPTION
      'Match is not in a resolvable state (status: %)',
      v_match.status USING ERRCODE = '22023';
  END IF;

  UPDATE public.league_matches
     SET team_a_score           = p_team_a_score,
         team_b_score           = p_team_b_score,
         status                 = 'verified',
         verified_by            = ARRAY[v_user]::UUID[],
         dispute_reason         = NULL,
         forfeit_winner_team_id = NULL,
         updated_at             = NOW()
   WHERE id = p_match_id;

  INSERT INTO public.league_audit_log
    (league_id, actor_user_id, action, entity_type, entity_id,
     old_value, new_value)
  VALUES (
    v_match.league_id, v_user, 'match.dispute_resolved', 'league_match',
    p_match_id,
    jsonb_build_object(
      'previous_status', v_match.status,
      'previous_a', v_match.team_a_score,
      'previous_b', v_match.team_b_score,
      'previous_reason', v_match.dispute_reason,
      'previous_forfeit_winner', v_match.forfeit_winner_team_id
    ),
    jsonb_build_object(
      'team_a_score', p_team_a_score,
      'team_b_score', p_team_b_score,
      'admin_note', COALESCE(NULLIF(TRIM(COALESCE(p_note, '')), ''), '(none)')
    )
  );
END;
$$;
