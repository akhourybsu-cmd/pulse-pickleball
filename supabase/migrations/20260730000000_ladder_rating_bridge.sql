-- =====================================================================
-- #15  Feed finalized LADDER games into the PULSE rating engine.
--
-- The rating engine runs only off the `matches` table (its approval trigger
-- calls apply_match_rating_incremental). Ladder scoring only ever touches
-- `league_matches`, so ladder games produced zero rating movement.
--
-- This adds a trigger on `league_matches` that mirrors the Round Robin
-- pattern (submit_rr_match_score): when a LADDER game is verified with a
-- decisive doubles score, it emits a `matches` row + 4 `match_participants`
-- and links it via league_matches.linked_match_id.
--
-- Ordering matters: apply_match_rating_incremental reads match_participants,
-- and the matches trigger fires the instant a row becomes 'approved'. So we
-- insert the matches row as 'pending', add participants, THEN flip it to
-- 'approved' — the participants are present when rating runs.
--
-- Rating uses the ACTUAL players in the game's slots (a substituted-in sub,
-- not the ladder ranking stand-in) — exactly the people who played.
--
-- Idempotent via linked_match_id: re-scoring updates the same matches row
-- (firing the engine's retroactive replay); reopening a game (status leaves
-- 'verified') voids the linked row so its rating effect is backed out.
-- Gated on leagues.rating_eligible.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.bridge_ladder_match_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rated      BOOLEAN;
  v_eligible   BOOLEAN;
  v_created_by UUID;
  v_date       DATE;
  v_ids        UUID[];
  v_match_id   UUID;
BEGIN
  -- Ladder games only (a ladder game belongs to a batch group).
  IF NEW.ladder_batch_group_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Ignore updates that change nothing rating-relevant. This also stops the
  -- recursion from our own linked_match_id write below (it changes neither
  -- the score nor the status).
  IF TG_OP = 'UPDATE'
     AND NEW.team_a_score IS NOT DISTINCT FROM OLD.team_a_score
     AND NEW.team_b_score IS NOT DISTINCT FROM OLD.team_b_score
     AND NEW.status       IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- A ladder game rates when it's verified with a decisive doubles score and
  -- all four slots are filled.
  v_rated := (NEW.status = 'verified'
    AND NEW.team_a_score IS NOT NULL AND NEW.team_b_score IS NOT NULL
    AND NEW.team_a_score <> NEW.team_b_score
    AND NEW.player_a_id IS NOT NULL AND NEW.player_b_id IS NOT NULL
    AND NEW.player_c_id IS NOT NULL AND NEW.player_d_id IS NOT NULL);

  SELECT COALESCE(rating_eligible, false) INTO v_eligible
    FROM public.leagues WHERE id = NEW.league_id;

  -- Nothing to do: not rated and never linked.
  IF NOT v_rated AND NEW.linked_match_id IS NULL THEN
    RETURN NEW;
  END IF;
  -- Rated but the league doesn't rate, and no prior link → skip.
  IF v_rated AND NOT v_eligible AND NEW.linked_match_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_ids := ARRAY[NEW.player_a_id, NEW.player_b_id, NEW.player_c_id, NEW.player_d_id];
  v_created_by := COALESCE(NEW.score_submitted_by, NEW.player_a_id);
  SELECT scheduled_date INTO v_date FROM public.league_sessions WHERE id = NEW.session_id;
  v_date := COALESCE(v_date, CURRENT_DATE);

  IF NEW.linked_match_id IS NULL THEN
    -- First time this game is rated → create the bridge match.
    -- Insert as 'pending' so the approval trigger doesn't rate before the
    -- participants exist; flip to 'approved' after they're inserted.
    INSERT INTO public.matches
      (match_date, team1_score, team2_score, created_by, source,
       court_no, match_type, status, verified_by, count_for_rating)
    VALUES
      (v_date, NEW.team_a_score, NEW.team_b_score, v_created_by, 'ladder',
       NEW.court_number, 'ladder', 'pending', v_ids, v_eligible)
    RETURNING id INTO v_match_id;

    INSERT INTO public.match_participants (match_id, player_id, team) VALUES
      (v_match_id, NEW.player_a_id, 1),
      (v_match_id, NEW.player_b_id, 1),
      (v_match_id, NEW.player_c_id, 2),
      (v_match_id, NEW.player_d_id, 2);

    -- Participants are in place → approving now rates the match.
    UPDATE public.matches SET status = 'approved' WHERE id = v_match_id;

    -- Link back (guarded above so this write doesn't re-enter).
    UPDATE public.league_matches
       SET linked_match_id = v_match_id
     WHERE id = NEW.id;

  ELSIF v_rated THEN
    -- Already linked and still rated → keep the bridge match in sync. Resync
    -- participants FIRST (players may have changed via a sub swap) so the
    -- retroactive replay fired by the score/eligibility update sees them.
    DELETE FROM public.match_participants WHERE match_id = NEW.linked_match_id;
    INSERT INTO public.match_participants (match_id, player_id, team) VALUES
      (NEW.linked_match_id, NEW.player_a_id, 1),
      (NEW.linked_match_id, NEW.player_b_id, 1),
      (NEW.linked_match_id, NEW.player_c_id, 2),
      (NEW.linked_match_id, NEW.player_d_id, 2);

    UPDATE public.matches
       SET team1_score      = NEW.team_a_score,
           team2_score      = NEW.team_b_score,
           verified_by      = v_ids,
           count_for_rating = v_eligible,
           voided           = false,
           void_reason      = NULL,
           status           = 'approved'
     WHERE id = NEW.linked_match_id;

  ELSE
    -- Linked but the game left the rated state (disputed / canceled / score
    -- cleared) → void the bridge match so the engine backs its effect out.
    UPDATE public.matches
       SET voided = true, void_reason = 'ladder game reopened'
     WHERE id = NEW.linked_match_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bridge_ladder_match_rating ON public.league_matches;
CREATE TRIGGER trg_bridge_ladder_match_rating
  AFTER INSERT OR UPDATE ON public.league_matches
  FOR EACH ROW
  EXECUTE FUNCTION public.bridge_ladder_match_rating();
