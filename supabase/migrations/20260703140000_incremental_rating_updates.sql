-- =====================================================================
-- Incremental rating updates on match approval — perf fix
--
-- The current handle_match_approval_recalc trigger calls
-- recalculate_all_ratings() on every approved-boundary transition.
-- That resets EVERY profile to their starting rating and replays
-- EVERY approved match in chronological order — O(all-time-matches)
-- work on every single approval. Cumulative cost across N approvals
-- is O(N²), which locks the profiles table at scale.
--
-- Fix: split the trigger into two paths.
--   • Forward path (new approval, chronologically most recent for its
--     participants): apply the match's delta INCREMENTALLY using each
--     player's current cached rating. O(1) work per approval.
--   • Retroactive path (voided flag flipped, count_for_rating flipped,
--     status leaving approved, score edited, or the match is out-of-
--     order for any participant): delegate to the existing full recalc.
--
-- Correctness hinges on one guarantee: the incremental path only runs
-- when the current rating chain already reflects everything up to
-- (but not including) this match. If a participant has any LATER
-- approved match already in their history, this match is out-of-order
-- and we fall back to full replay so the chain rebuilds correctly.
--
-- The math is delegated to calculate_pulse_rating_change (unchanged),
-- so the incremental output matches full recalc bit-for-bit.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.apply_match_rating_incremental(p_match_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_match       RECORD;
  v_params      RECORD;
  v_participant_count INT;
  v_has_null_player   BOOLEAN;
  v_has_later_match   BOOLEAN;
  p_ids         UUID[];
  p_teams       INT[];
  p_ratings     NUMERIC[] := ARRAY[NULL, NULL, NULL, NULL]::NUMERIC[];
  p_matches     INT[]     := ARRAY[0, 0, 0, 0];
  i             INT;
  j             INT;
  v_my_team     INT;
  v_won         BOOLEAN;
  v_my_score    INT;
  v_opp_score   INT;
  v_my_partner  NUMERIC;
  v_my_opps     NUMERIC[];
  v_delta       NUMERIC;
  v_new_rating  NUMERIC;
  v_snap_rating NUMERIC;
  v_snap_count  INT;
BEGIN
  SELECT * INTO v_match FROM matches WHERE id = p_match_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Same eligibility gates as the full recalc.
  IF v_match.status <> 'approved'
     OR COALESCE(v_match.voided, false) = true
     OR COALESCE(v_match.count_for_rating, true) = false THEN
    RETURN;
  END IF;

  -- Guard: doubles matches only (singles unrated for now — same as recalc).
  SELECT COUNT(*), bool_or(player_id IS NULL)
    INTO v_participant_count, v_has_null_player
    FROM match_participants
   WHERE match_id = p_match_id;
  IF v_participant_count <> 4 OR v_has_null_player THEN RETURN; END IF;

  -- Snapshot participants ordered the same way the full recalc orders
  -- them (team then id) so p_ids/p_teams are deterministic and align
  -- across both paths.
  SELECT array_agg(player_id ORDER BY team, id),
         array_agg(team      ORDER BY team, id)
    INTO p_ids, p_teams
    FROM match_participants
   WHERE match_id = p_match_id;

  -- Retroactive check: if ANY participant already has a strictly-later
  -- approved match on their record, this match is out-of-order and the
  -- current cached ratings do NOT correspond to "just before this
  -- match" — they already include future events. Delegate to full
  -- replay for correctness.
  SELECT EXISTS (
    SELECT 1
      FROM match_participants mp2
      JOIN matches m2 ON mp2.match_id = m2.id
     WHERE mp2.player_id = ANY(p_ids)
       AND m2.id <> p_match_id
       AND m2.status = 'approved'
       AND COALESCE(m2.voided, false) = false
       AND COALESCE(m2.count_for_rating, true) = true
       AND (m2.match_date >  v_match.match_date
         OR (m2.match_date = v_match.match_date AND m2.created_at >  v_match.created_at)
         OR (m2.match_date = v_match.match_date AND m2.created_at = v_match.created_at AND m2.id > p_match_id))
  ) INTO v_has_later_match;

  IF v_has_later_match THEN
    PERFORM recalculate_all_ratings();
    RETURN;
  END IF;

  SELECT * INTO v_params
    FROM rating_parameters
   WHERE id = '00000000-0000-0000-0000-000000000001';

  -- Load each player's rating (their current cached value — which is
  -- correct because we verified no later approved matches exist above)
  -- and their pre-this-match count.
  FOR i IN 1..4 LOOP
    SELECT current_rating INTO v_snap_rating
      FROM profiles WHERE id = p_ids[i];
    p_ratings[i] := v_snap_rating;

    SELECT COUNT(*)::INT
      INTO v_snap_count
      FROM match_participants mp_sub
      JOIN matches m_sub ON mp_sub.match_id = m_sub.id
     WHERE mp_sub.player_id = p_ids[i]
       AND m_sub.id <> p_match_id
       AND m_sub.status = 'approved'
       AND COALESCE(m_sub.voided, false) = false
       AND COALESCE(m_sub.count_for_rating, true) = true;
    p_matches[i] := v_snap_count;
  END LOOP;

  -- Per-player delta. Same math as recalc — delegates to
  -- calculate_pulse_rating_change so any future tweak to the algorithm
  -- lives in one place.
  FOR i IN 1..4 LOOP
    v_my_team := p_teams[i];
    v_won := (v_my_team = 1 AND v_match.team1_score > v_match.team2_score)
          OR (v_my_team = 2 AND v_match.team2_score > v_match.team1_score);
    v_my_score  := CASE v_my_team WHEN 1 THEN v_match.team1_score ELSE v_match.team2_score END;
    v_opp_score := CASE v_my_team WHEN 1 THEN v_match.team2_score ELSE v_match.team1_score END;

    v_my_partner := NULL;
    v_my_opps    := ARRAY[]::NUMERIC[];
    FOR j IN 1..4 LOOP
      IF j = i THEN CONTINUE; END IF;
      IF p_teams[j] = v_my_team THEN
        v_my_partner := p_ratings[j];
      ELSE
        v_my_opps := array_append(v_my_opps, p_ratings[j]);
      END IF;
    END LOOP;

    v_delta := calculate_pulse_rating_change(
      p_ratings[i],
      COALESCE(v_my_partner, p_ratings[i]),
      v_my_opps[1],
      v_my_opps[2],
      v_my_score, v_opp_score, v_won,
      v_match.match_type,
      p_matches[i]
    );

    v_new_rating := LEAST(v_params.clamp_max,
                      GREATEST(v_params.clamp_min, p_ratings[i] + v_delta));
    v_delta := v_new_rating - p_ratings[i];

    UPDATE match_participants
       SET rating_before = p_ratings[i],
           rating_after  = v_new_rating,
           rating_change = v_delta
     WHERE match_id = p_match_id
       AND player_id = p_ids[i];

    UPDATE profiles
       SET current_rating = v_new_rating
     WHERE id = p_ids[i];
  END LOOP;

  -- Refresh aggregate stats (wins/losses/streak) for these 4 players.
  -- Cheap: one call per player, not a full-population sweep.
  FOR i IN 1..4 LOOP
    PERFORM recalculate_player_stats(p_ids[i]);
  END LOOP;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.apply_match_rating_incremental(UUID) TO authenticated;


-- Rewire the trigger. Forward paths hit the O(1) incremental function;
-- retroactive paths (voided flip, count_for_rating flip, status
-- leaving approved, score edits on approved matches) still take the
-- full O(N) recalc so the chain rebuilds correctly.
CREATE OR REPLACE FUNCTION public.handle_match_approval_recalc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Fresh row created directly in approved status → incremental.
    IF NEW.status = 'approved' AND COALESCE(NEW.voided, false) = false THEN
      PERFORM apply_match_rating_incremental(NEW.id);
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Retroactive triggers: any change that could invalidate the
    -- existing rating chain. Full replay is the safe answer.
    IF (
         -- Status LEAVING approved (e.g., admin rejects an approved
         -- match). Also catches approved → cancelled etc.
         OLD.status IS DISTINCT FROM NEW.status
         AND OLD.status = 'approved'
         AND NEW.status <> 'approved'
       )
       OR (
         -- Voided flag flipped on an approved match.
         OLD.voided IS DISTINCT FROM NEW.voided
         AND NEW.status = 'approved'
       )
       OR (
         -- count_for_rating flipped on an approved match.
         OLD.count_for_rating IS DISTINCT FROM NEW.count_for_rating
         AND NEW.status = 'approved'
       )
       OR (
         -- Score edited on a still-approved match. Previously silently
         -- left the rating chain stale; now correctly triggers replay.
         NEW.status = 'approved'
         AND OLD.status = 'approved'
         AND COALESCE(NEW.voided, false) = false
         AND (OLD.team1_score IS DISTINCT FROM NEW.team1_score
           OR OLD.team2_score IS DISTINCT FROM NEW.team2_score)
       )
    THEN
      PERFORM recalculate_all_ratings();
      RETURN NEW;
    END IF;

    -- Forward path: status just entered approved (pending → approved).
    -- Incremental handles this in O(1); if the match turns out to be
    -- out-of-order for any participant, apply_match_rating_incremental
    -- detects that internally and delegates to full replay itself.
    IF OLD.status IS DISTINCT FROM NEW.status
       AND NEW.status = 'approved'
       AND COALESCE(NEW.voided, false) = false THEN
      PERFORM apply_match_rating_incremental(NEW.id);
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.apply_match_rating_incremental(UUID) IS
  'O(1) incremental rating update for a single match approval. '
  'Delegates to recalculate_all_ratings() if the match is out-of-order '
  'for any participant. Called from handle_match_approval_recalc.';

COMMENT ON TRIGGER on_match_approval_recalc ON public.matches IS
  'Incremental on forward approval, full recalc on retroactive edits. '
  'Retroactive cases: voided flip, count_for_rating flip, status '
  'leaving approved, score edited on approved match, or out-of-order '
  'match (detected inside apply_match_rating_incremental).';
