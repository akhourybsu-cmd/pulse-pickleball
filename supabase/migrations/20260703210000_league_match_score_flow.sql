-- =====================================================================
-- Phase 5: player-driven score entry + verification for league matches
--
-- Adds three new columns to league_matches (audit-friendly), plus
-- three SECURITY DEFINER RPCs that let PARTICIPANTS submit, verify,
-- or dispute a match score without any direct write access to the
-- table. Non-participants and non-admins remain read-only via RLS.
--
-- Verification threshold for MVP:
--   Any TWO unique participants (submitter + one other) transitions
--   status from 'score_submitted' → 'verified'. Simple, works for
--   both singles (2 players total) and doubles (4). A future phase
--   can tighten to "one from each team" if needed.
--
-- Rating engine STILL not touched. rating_status remains at
-- 'not_connected' regardless of verification. league_matches don't
-- feed calculate_pulse_rating_change / recalculate_all_ratings.
-- =====================================================================


-- ---------- 1. Schema additions ----------------------------------------
ALTER TABLE public.league_matches
  ADD COLUMN IF NOT EXISTS verified_by UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS score_submitted_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS score_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispute_reason TEXT;

COMMENT ON COLUMN public.league_matches.verified_by IS
  'UUIDs of participants who have confirmed this score. The submitter '
  'is added automatically. When length >= 2 the status auto-transitions '
  'to verified.';
COMMENT ON COLUMN public.league_matches.dispute_reason IS
  'Optional free-text reason submitted alongside a dispute action.';


-- ---------- 2. Participant check ---------------------------------------
-- Membership + slot lookup consolidated. Used by every score-flow RPC
-- + by the future in-match RLS if we ever expose direct writes.
CREATE OR REPLACE FUNCTION public.player_is_in_league_match(p_match_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.league_matches lm
     WHERE lm.id = p_match_id
       AND (
         -- Direct player slot (singles/doubles individual assignment)
         auth.uid() IN (
           lm.player_a_id, lm.player_b_id, lm.player_c_id, lm.player_d_id
         )
         OR
         -- Active member of team A
         EXISTS (
           SELECT 1 FROM public.league_team_members ltm
            WHERE ltm.team_id = lm.team_a_id
              AND ltm.user_id = auth.uid()
              AND ltm.status = 'active'
         )
         OR
         -- Active member of team B
         EXISTS (
           SELECT 1 FROM public.league_team_members ltm
            WHERE ltm.team_id = lm.team_b_id
              AND ltm.user_id = auth.uid()
              AND ltm.status = 'active'
         )
       )
  );
$$;

GRANT EXECUTE ON FUNCTION public.player_is_in_league_match(UUID) TO authenticated;

COMMENT ON FUNCTION public.player_is_in_league_match IS
  'Returns true when auth.uid() is a direct player slot on the match '
  'OR an active member of team_a or team_b. Used as the participant '
  'gate in every player-authored score-flow RPC.';


-- ---------- 3. Submit score --------------------------------------------
-- Sets the two team scores, flips status to 'score_submitted', records
-- the submitter, and seeds verified_by with the submitter. Overwrites
-- a previous score submission (before verification) if the same or
-- another participant submits again — this is intentional so a typo
-- doesn't block the match.
CREATE OR REPLACE FUNCTION public.submit_league_match_score(
  p_match_id UUID,
  p_team_a_score INTEGER,
  p_team_b_score INTEGER
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
  IF p_team_a_score IS NULL OR p_team_b_score IS NULL
     OR p_team_a_score < 0 OR p_team_b_score < 0 THEN
    RAISE EXCEPTION 'Scores must be non-negative integers'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_match
    FROM public.league_matches WHERE id = p_match_id FOR UPDATE;
  IF v_match.id IS NULL THEN
    RAISE EXCEPTION 'Match not found' USING ERRCODE = '02000';
  END IF;

  IF NOT player_is_in_league_match(p_match_id) THEN
    RAISE EXCEPTION 'Only participants can submit scores'
      USING ERRCODE = '42501';
  END IF;

  IF v_match.status IN ('verified', 'canceled', 'forfeit') THEN
    RAISE EXCEPTION 'Match is already % — ask an admin to edit',
      v_match.status USING ERRCODE = '22023';
  END IF;

  UPDATE public.league_matches
     SET team_a_score       = p_team_a_score,
         team_b_score       = p_team_b_score,
         status             = 'score_submitted',
         score_submitted_by = v_user,
         score_submitted_at = NOW(),
         verified_by        = ARRAY[v_user]::UUID[],
         dispute_reason     = NULL,
         updated_at         = NOW()
   WHERE id = p_match_id;

  INSERT INTO public.league_audit_log
    (league_id, actor_user_id, action, entity_type, entity_id,
     old_value, new_value)
  VALUES (
    v_match.league_id, v_user, 'match.score_submitted', 'league_match',
    p_match_id,
    jsonb_build_object(
      'previous_status', v_match.status,
      'previous_a', v_match.team_a_score,
      'previous_b', v_match.team_b_score
    ),
    jsonb_build_object(
      'team_a_score', p_team_a_score,
      'team_b_score', p_team_b_score
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_league_match_score(UUID, INTEGER, INTEGER)
  TO authenticated;


-- ---------- 4. Verify (confirm) score ---------------------------------
-- Any participant besides the submitter can confirm. Adds them to
-- verified_by; when the array reaches 2 unique members the status
-- auto-transitions to 'verified'. Idempotent per user.
CREATE OR REPLACE FUNCTION public.verify_league_match(p_match_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user         UUID := auth.uid();
  v_match        RECORD;
  v_new_verified UUID[];
  v_new_status   TEXT;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_match
    FROM public.league_matches WHERE id = p_match_id FOR UPDATE;
  IF v_match.id IS NULL THEN
    RAISE EXCEPTION 'Match not found' USING ERRCODE = '02000';
  END IF;

  IF NOT player_is_in_league_match(p_match_id) THEN
    RAISE EXCEPTION 'Only participants can verify a match'
      USING ERRCODE = '42501';
  END IF;

  IF v_match.status <> 'score_submitted' THEN
    RAISE EXCEPTION
      'Match is not awaiting verification (current status: %)',
      v_match.status USING ERRCODE = '22023';
  END IF;

  -- Idempotent — already confirmed is a no-op.
  IF v_user = ANY(v_match.verified_by) THEN
    RETURN;
  END IF;

  v_new_verified := array_append(v_match.verified_by, v_user);
  v_new_status := CASE
    WHEN COALESCE(array_length(v_new_verified, 1), 0) >= 2 THEN 'verified'
    ELSE v_match.status
  END;

  UPDATE public.league_matches
     SET verified_by = v_new_verified,
         status      = v_new_status,
         updated_at  = NOW()
   WHERE id = p_match_id;

  INSERT INTO public.league_audit_log
    (league_id, actor_user_id, action, entity_type, entity_id, new_value)
  VALUES (
    v_match.league_id, v_user,
    CASE WHEN v_new_status = 'verified'
         THEN 'match.verified' ELSE 'match.confirmed' END,
    'league_match', p_match_id,
    jsonb_build_object(
      'verifications', COALESCE(array_length(v_new_verified, 1), 0),
      'status', v_new_status
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_league_match(UUID) TO authenticated;


-- ---------- 5. Dispute --------------------------------------------------
-- Any participant can dispute a submitted score. Sets status to
-- 'disputed' + records the reason. Admin resolves in the admin
-- MatchesTab by editing the score + flipping status back to verified.
CREATE OR REPLACE FUNCTION public.dispute_league_match(
  p_match_id UUID,
  p_reason   TEXT DEFAULT NULL
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

  SELECT * INTO v_match
    FROM public.league_matches WHERE id = p_match_id FOR UPDATE;
  IF v_match.id IS NULL THEN
    RAISE EXCEPTION 'Match not found' USING ERRCODE = '02000';
  END IF;

  IF NOT player_is_in_league_match(p_match_id) THEN
    RAISE EXCEPTION 'Only participants can dispute a match'
      USING ERRCODE = '42501';
  END IF;

  IF v_match.status NOT IN ('score_submitted', 'disputed') THEN
    RAISE EXCEPTION 'Cannot dispute a match in % status',
      v_match.status USING ERRCODE = '22023';
  END IF;

  UPDATE public.league_matches
     SET status         = 'disputed',
         dispute_reason = NULLIF(TRIM(COALESCE(p_reason, '')), ''),
         updated_at     = NOW()
   WHERE id = p_match_id;

  INSERT INTO public.league_audit_log
    (league_id, actor_user_id, action, entity_type, entity_id,
     old_value, new_value)
  VALUES (
    v_match.league_id, v_user, 'match.disputed', 'league_match',
    p_match_id,
    jsonb_build_object('previous_status', v_match.status),
    jsonb_build_object(
      'reason', COALESCE(NULLIF(TRIM(COALESCE(p_reason, '')), ''), '(none)')
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.dispute_league_match(UUID, TEXT) TO authenticated;
