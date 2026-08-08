-- =====================================================================
-- Remove the team-captain path from forfeit_league_match.
--
-- The league team-captain feature is being retired (captains could
-- concede a match on their team's behalf). Forfeits are now admin-only:
-- a league admin specifies the winning team, exactly as the admin path
-- already worked. The captain_user_id column is left in place but inert.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.forfeit_league_match(
  p_match_id UUID, p_winner_team_id UUID DEFAULT NULL, p_reason TEXT DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID := auth.uid();
  v_match RECORD;
  v_is_admin BOOLEAN;
  v_winner_team UUID;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000'; END IF;
  SELECT * INTO v_match FROM public.league_matches WHERE id = p_match_id FOR UPDATE;
  IF v_match.id IS NULL THEN RAISE EXCEPTION 'Match not found' USING ERRCODE = '02000'; END IF;
  IF v_match.status IN ('verified', 'forfeit', 'canceled') THEN
    RAISE EXCEPTION 'Match is already % — cannot forfeit', v_match.status USING ERRCODE = '22023';
  END IF;
  IF v_match.team_a_id IS NULL OR v_match.team_b_id IS NULL THEN
    RAISE EXCEPTION 'Both teams must be set to record a forfeit' USING ERRCODE = '22023';
  END IF;

  v_is_admin := public.is_league_admin(v_match.league_id, v_user);
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Only a league admin can forfeit a match' USING ERRCODE = '42501';
  END IF;

  IF p_winner_team_id IS NULL THEN
    RAISE EXCEPTION 'Specify the winning team id when forfeiting' USING ERRCODE = '22023';
  END IF;
  IF p_winner_team_id NOT IN (v_match.team_a_id, v_match.team_b_id) THEN
    RAISE EXCEPTION 'Winning team must be team_a or team_b of this match' USING ERRCODE = '22023';
  END IF;
  v_winner_team := p_winner_team_id;

  UPDATE public.league_matches
     SET status = 'forfeit', forfeit_winner_team_id = v_winner_team,
         team_a_score = NULL, team_b_score = NULL, verified_by = ARRAY[]::UUID[],
         dispute_reason = NULLIF(TRIM(COALESCE(p_reason, '')), ''),
         score_submitted_by = NULL, score_submitted_at = NULL, updated_at = NOW()
   WHERE id = p_match_id;

  INSERT INTO public.league_audit_log
    (league_id, actor_user_id, action, entity_type, entity_id, old_value, new_value)
  VALUES (v_match.league_id, v_user, 'match.forfeited', 'league_match', p_match_id,
    jsonb_build_object('previous_status', v_match.status, 'previous_a', v_match.team_a_score, 'previous_b', v_match.team_b_score),
    jsonb_build_object('winner_team_id', v_winner_team, 'source', 'admin',
      'reason', COALESCE(NULLIF(TRIM(COALESCE(p_reason, '')), ''), '(none)')));
END; $$;
