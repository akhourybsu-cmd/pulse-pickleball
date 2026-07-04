-- =====================================================================
-- Track A: dispute-resolve + forfeit + season-lifecycle sync
--
-- Correctness holes surfaced by the Track A audit:
--
--  1. resolve_league_match_dispute — admin-only. Overrides scores +
--     transitions status from 'disputed' → 'verified' in one step.
--     Prior to this, admins had to edit the raw row.
--
--  2. forfeit_league_match — admin OR captain of the losing side may
--     concede a match. Records the winning team via a NEW column
--     `forfeit_winner_team_id` so standings can credit the win even
--     though team_a_score/team_b_score aren't the source of truth.
--     Captains can only concede FROM their own team (i.e., the loser
--     is auto-set to their team).
--
--  3. sync_league_season_statuses — admin-only, one-shot helper that:
--       • flips draft → active when start_date has passed
--       • flips active → completed when end_date has passed
--     Returns a JSONB summary of what changed. Manual by design —
--     we don't want a cron surprising admins mid-season. The
--     SeasonsTab surfaces a "Sync statuses" button.
--
-- Rating engine still untouched. rating_status stays 'not_connected'.
-- =====================================================================


-- ---------- 0. Schema addition ------------------------------------------
-- Track the winning team for a forfeit. NULL when status != 'forfeit'.
-- Constrained to team_a_id or team_b_id via a trigger below so admin
-- typos can't credit a team that didn't play the match.
ALTER TABLE public.league_matches
  ADD COLUMN IF NOT EXISTS forfeit_winner_team_id UUID
    REFERENCES public.league_teams(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.league_matches.forfeit_winner_team_id IS
  'For status = forfeit: which team gets credited the win. Must equal '
  'team_a_id or team_b_id. NULL for any non-forfeit match.';

CREATE OR REPLACE FUNCTION public.assert_forfeit_winner_is_participant()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.forfeit_winner_team_id IS NOT NULL
     AND NEW.forfeit_winner_team_id NOT IN (NEW.team_a_id, NEW.team_b_id) THEN
    RAISE EXCEPTION
      'forfeit_winner_team_id must be team_a_id or team_b_id (got %)',
      NEW.forfeit_winner_team_id
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assert_forfeit_winner ON public.league_matches;
CREATE TRIGGER trg_assert_forfeit_winner
  BEFORE INSERT OR UPDATE ON public.league_matches
  FOR EACH ROW EXECUTE FUNCTION public.assert_forfeit_winner_is_participant();


-- ---------- 1. Admin dispute resolution --------------------------------
-- Overwrites the scores and flips to 'verified' in one shot. Only
-- callable by platform admins. dispute_reason is kept in the audit
-- log payload but cleared off the match row.
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
  IF v_match.status NOT IN ('disputed', 'score_submitted') THEN
    RAISE EXCEPTION
      'Match is not in a disputed/pending state (status: %)',
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
      'previous_reason', v_match.dispute_reason
    ),
    jsonb_build_object(
      'team_a_score', p_team_a_score,
      'team_b_score', p_team_b_score,
      'admin_note', COALESCE(NULLIF(TRIM(COALESCE(p_note, '')), ''), '(none)')
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_league_match_dispute(
  UUID, INTEGER, INTEGER, TEXT
) TO authenticated;


-- ---------- 2. Forfeit a match -----------------------------------------
-- Admin OR captain of the LOSING side can concede. When called by a
-- captain we auto-derive the winning team as the OTHER team on the
-- match. Admins may pass an explicit winning team id (defaults to
-- the-other-team if only one is set).
--
-- Scores are cleared to NULL so standings math doesn't accidentally
-- credit points-for/against from a stale entry — the win is tracked
-- via forfeit_winner_team_id.
CREATE OR REPLACE FUNCTION public.forfeit_league_match(
  p_match_id       UUID,
  p_winner_team_id UUID DEFAULT NULL,
  p_reason         TEXT DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user           UUID := auth.uid();
  v_match          RECORD;
  v_is_admin       BOOLEAN;
  v_is_captain_a   BOOLEAN;
  v_is_captain_b   BOOLEAN;
  v_winner_team    UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_match
    FROM public.league_matches WHERE id = p_match_id FOR UPDATE;
  IF v_match.id IS NULL THEN
    RAISE EXCEPTION 'Match not found' USING ERRCODE = '02000';
  END IF;
  IF v_match.status IN ('verified', 'forfeit', 'canceled') THEN
    RAISE EXCEPTION 'Match is already % — cannot forfeit',
      v_match.status USING ERRCODE = '22023';
  END IF;
  IF v_match.team_a_id IS NULL OR v_match.team_b_id IS NULL THEN
    RAISE EXCEPTION 'Both teams must be set to record a forfeit'
      USING ERRCODE = '22023';
  END IF;

  v_is_admin := public.has_role(v_user, 'admin'::app_role);

  -- Captain check per side. Captain conceding their own team's match
  -- auto-derives the winner as the other side. We deliberately only
  -- honor CAPTAINS here, not any team member, so a heated player
  -- can't unilaterally hand the match to the other side.
  v_is_captain_a := EXISTS (
    SELECT 1 FROM public.league_teams t
     WHERE t.id = v_match.team_a_id AND t.captain_user_id = v_user
  );
  v_is_captain_b := EXISTS (
    SELECT 1 FROM public.league_teams t
     WHERE t.id = v_match.team_b_id AND t.captain_user_id = v_user
  );

  IF NOT v_is_admin AND NOT v_is_captain_a AND NOT v_is_captain_b THEN
    RAISE EXCEPTION
      'Only an admin or the captain of a participating team can forfeit'
      USING ERRCODE = '42501';
  END IF;

  -- Resolve the winning team.
  IF v_is_admin THEN
    -- Admins may specify explicitly. If they don't, we can't guess.
    IF p_winner_team_id IS NULL THEN
      RAISE EXCEPTION
        'Admins must specify the winning team id when calling forfeit'
        USING ERRCODE = '22023';
    END IF;
    IF p_winner_team_id NOT IN (v_match.team_a_id, v_match.team_b_id) THEN
      RAISE EXCEPTION
        'Winning team must be team_a or team_b of this match'
        USING ERRCODE = '22023';
    END IF;
    v_winner_team := p_winner_team_id;
  ELSIF v_is_captain_a THEN
    v_winner_team := v_match.team_b_id;
  ELSE  -- captain of B
    v_winner_team := v_match.team_a_id;
  END IF;

  UPDATE public.league_matches
     SET status                 = 'forfeit',
         forfeit_winner_team_id = v_winner_team,
         team_a_score           = NULL,
         team_b_score           = NULL,
         verified_by            = ARRAY[]::UUID[],
         dispute_reason         = NULLIF(TRIM(COALESCE(p_reason, '')), ''),
         score_submitted_by     = NULL,
         score_submitted_at     = NULL,
         updated_at             = NOW()
   WHERE id = p_match_id;

  INSERT INTO public.league_audit_log
    (league_id, actor_user_id, action, entity_type, entity_id,
     old_value, new_value)
  VALUES (
    v_match.league_id, v_user, 'match.forfeited', 'league_match', p_match_id,
    jsonb_build_object(
      'previous_status', v_match.status,
      'previous_a', v_match.team_a_score,
      'previous_b', v_match.team_b_score
    ),
    jsonb_build_object(
      'winner_team_id', v_winner_team,
      'source', CASE
        WHEN v_is_admin THEN 'admin'
        ELSE 'captain'
      END,
      'reason', COALESCE(NULLIF(TRIM(COALESCE(p_reason, '')), ''), '(none)')
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.forfeit_league_match(
  UUID, UUID, TEXT
) TO authenticated;


-- ---------- 3. Season lifecycle sync -----------------------------------
-- One-shot helper an admin can call from the SeasonsTab. Advances any
-- season whose dates say it should be past its current status:
--   • draft   → active     when start_date <= today
--   • active  → completed  when end_date < today
-- Does NOT touch archived seasons or seasons with NULL dates. Returns
-- a JSONB report so the caller can toast something informative.
CREATE OR REPLACE FUNCTION public.sync_league_season_statuses(
  p_league_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user     UUID := auth.uid();
  v_today    DATE := CURRENT_DATE;
  v_activated INTEGER := 0;
  v_completed INTEGER := 0;
  v_ids_activated UUID[];
  v_ids_completed UUID[];
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  IF NOT public.has_role(v_user, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin role required' USING ERRCODE = '42501';
  END IF;

  -- Draft → Active
  WITH updated AS (
    UPDATE public.league_seasons
       SET status = 'active', updated_at = NOW()
     WHERE league_id = p_league_id
       AND status = 'draft'
       AND start_date IS NOT NULL
       AND start_date <= v_today
       AND (end_date IS NULL OR end_date >= v_today)
     RETURNING id
  )
  SELECT array_agg(id), count(*) INTO v_ids_activated, v_activated FROM updated;

  -- Active → Completed
  WITH updated AS (
    UPDATE public.league_seasons
       SET status = 'completed', updated_at = NOW()
     WHERE league_id = p_league_id
       AND status = 'active'
       AND end_date IS NOT NULL
       AND end_date < v_today
     RETURNING id
  )
  SELECT array_agg(id), count(*) INTO v_ids_completed, v_completed FROM updated;

  IF v_activated > 0 OR v_completed > 0 THEN
    INSERT INTO public.league_audit_log
      (league_id, actor_user_id, action, entity_type, entity_id, new_value)
    VALUES (
      p_league_id, v_user, 'season.lifecycle_synced', 'league', p_league_id,
      jsonb_build_object(
        'activated_count', v_activated,
        'completed_count', v_completed,
        'activated_ids', COALESCE(v_ids_activated, ARRAY[]::UUID[]),
        'completed_ids', COALESCE(v_ids_completed, ARRAY[]::UUID[])
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'activated', v_activated,
    'completed', v_completed
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_league_season_statuses(UUID)
  TO authenticated;
