-- =====================================================================
-- Track C/7: player notifications for league match state changes
--
-- Fires on the UPDATE of league_matches.status and inserts a row into
-- user_notifications for every affected participant via the existing
-- create_notification() helper. Category = 'leagues' so players can
-- mute the whole feature from notification preferences.
--
-- Covered transitions (from → to):
--   * → score_submitted   Non-submitter participants need to confirm.
--                         Actor = the submitter.
--   * → verified          All participants: "Match locked in".
--   score_submitted → disputed
--                         All participants (submitter included):
--                         "Score disputed — admin will review".
--   disputed → verified   All participants: "Admin resolved dispute".
--   * → forfeit           All participants: "Match forfeited".
--
-- Design choices:
--  • One trigger per state, not one per column — cheaper than N triggers.
--  • Notify by team roster + direct player slots so both team-league
--    and singles/doubles work with the same code.
--  • Deep link points to /player/leagues/:league_id — the detail page
--    already loads the specific match into context. Deep-link to a
--    specific match tab can layer on later.
--  • Actor set to the acting user (submitter / disputer / admin) so
--    the notification renders "$name confirmed …" if desired later.
-- =====================================================================


-- ---------- 1. Recipient enumeration helper ----------------------------
-- Consolidates "who cares about this match?" into one function used by
-- the trigger. Returns each unique user id AT MOST once, excluding
-- an optional actor (so we don't self-notify).
CREATE OR REPLACE FUNCTION public.league_match_participant_user_ids(
  p_match_id      UUID,
  p_exclude_user  UUID DEFAULT NULL
) RETURNS TABLE(user_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH direct AS (
    SELECT UNNEST(ARRAY[
      lm.player_a_id, lm.player_b_id, lm.player_c_id, lm.player_d_id
    ]) AS uid
    FROM public.league_matches lm
    WHERE lm.id = p_match_id
  ),
  team_a AS (
    SELECT ltm.user_id AS uid
    FROM public.league_matches lm
    JOIN public.league_team_members ltm ON ltm.team_id = lm.team_a_id
    WHERE lm.id = p_match_id AND ltm.status = 'active'
  ),
  team_b AS (
    SELECT ltm.user_id AS uid
    FROM public.league_matches lm
    JOIN public.league_team_members ltm ON ltm.team_id = lm.team_b_id
    WHERE lm.id = p_match_id AND ltm.status = 'active'
  )
  SELECT DISTINCT uid
    FROM (SELECT uid FROM direct
          UNION ALL SELECT uid FROM team_a
          UNION ALL SELECT uid FROM team_b) all_participants
   WHERE uid IS NOT NULL
     AND (p_exclude_user IS NULL OR uid <> p_exclude_user);
$$;

GRANT EXECUTE ON FUNCTION public.league_match_participant_user_ids(UUID, UUID)
  TO authenticated;


-- ---------- 2. State-change trigger ------------------------------------
CREATE OR REPLACE FUNCTION public.notify_league_match_state_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipient RECORD;
  v_league_name TEXT;
  v_actor_name TEXT;
  v_link TEXT;
  v_team_a_name TEXT;
  v_team_b_name TEXT;
  v_score TEXT;
  v_winner_team_name TEXT;
BEGIN
  -- Nothing to notify on if status didn't change.
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_league_name FROM public.leagues WHERE id = NEW.league_id;
  IF v_league_name IS NULL THEN
    -- League vanished mid-transaction — nothing sensible to notify.
    RETURN NEW;
  END IF;

  v_link := '/player/leagues/' || NEW.league_id;

  SELECT name INTO v_team_a_name FROM public.league_teams WHERE id = NEW.team_a_id;
  SELECT name INTO v_team_b_name FROM public.league_teams WHERE id = NEW.team_b_id;

  -- ================= score_submitted =================
  IF NEW.status = 'score_submitted' THEN
    IF NEW.score_submitted_by IS NOT NULL THEN
      SELECT display_name INTO v_actor_name
        FROM public.profiles WHERE id = NEW.score_submitted_by;
    END IF;
    v_score := COALESCE(NEW.team_a_score::TEXT, '?') || '–'
            || COALESCE(NEW.team_b_score::TEXT, '?');

    FOR v_recipient IN
      SELECT * FROM public.league_match_participant_user_ids(
        NEW.id, NEW.score_submitted_by
      )
    LOOP
      PERFORM public.create_notification(
        v_recipient.user_id,
        'league_score_submitted',
        'leagues',
        'Confirm league score',
        COALESCE(v_actor_name, 'A teammate') || ' submitted ' || v_score
          || ' in ' || v_league_name || '. Tap to confirm.',
        v_link,
        'normal',
        jsonb_build_object(
          'league_id', NEW.league_id, 'match_id', NEW.id,
          'season_id', NEW.season_id
        ),
        NEW.score_submitted_by,
        NULL
      );
    END LOOP;
    RETURN NEW;
  END IF;

  -- ================= verified =================
  IF NEW.status = 'verified' THEN
    v_score := COALESCE(NEW.team_a_score::TEXT, '?') || '–'
            || COALESCE(NEW.team_b_score::TEXT, '?');

    -- Different copy when the previous state was 'disputed' (admin
    -- override) vs. the normal player-confirmation path.
    FOR v_recipient IN
      SELECT * FROM public.league_match_participant_user_ids(NEW.id, NULL)
    LOOP
      IF OLD.status = 'disputed' THEN
        PERFORM public.create_notification(
          v_recipient.user_id,
          'league_dispute_resolved',
          'leagues',
          'Dispute resolved',
          'An admin resolved the disputed match in ' || v_league_name
            || '. Final: ' || v_score || '.',
          v_link, 'normal',
          jsonb_build_object(
            'league_id', NEW.league_id, 'match_id', NEW.id,
            'season_id', NEW.season_id
          ), NULL, NULL
        );
      ELSE
        PERFORM public.create_notification(
          v_recipient.user_id,
          'league_match_verified',
          'leagues',
          'Match verified',
          'Your ' || v_league_name || ' match is locked in — '
            || v_score || '.',
          v_link, 'low',
          jsonb_build_object(
            'league_id', NEW.league_id, 'match_id', NEW.id,
            'season_id', NEW.season_id
          ), NULL, NULL
        );
      END IF;
    END LOOP;
    RETURN NEW;
  END IF;

  -- ================= disputed =================
  IF NEW.status = 'disputed' THEN
    FOR v_recipient IN
      SELECT * FROM public.league_match_participant_user_ids(NEW.id, NULL)
    LOOP
      PERFORM public.create_notification(
        v_recipient.user_id,
        'league_match_disputed',
        'leagues',
        'Score disputed',
        'A ' || v_league_name || ' match score was disputed. '
          || 'An admin will review shortly.',
        v_link, 'high',
        jsonb_build_object(
          'league_id', NEW.league_id, 'match_id', NEW.id,
          'season_id', NEW.season_id
        ), NULL, NULL
      );
    END LOOP;
    RETURN NEW;
  END IF;

  -- ================= forfeit =================
  IF NEW.status = 'forfeit' THEN
    v_winner_team_name := NULL;
    IF NEW.forfeit_winner_team_id IS NOT NULL THEN
      SELECT name INTO v_winner_team_name
        FROM public.league_teams WHERE id = NEW.forfeit_winner_team_id;
    END IF;

    FOR v_recipient IN
      SELECT * FROM public.league_match_participant_user_ids(NEW.id, NULL)
    LOOP
      PERFORM public.create_notification(
        v_recipient.user_id,
        'league_match_forfeited',
        'leagues',
        'Match forfeited',
        'Your ' || v_league_name || ' match was recorded as a forfeit'
          || COALESCE(' — ' || v_winner_team_name || ' wins.', '.'),
        v_link, 'normal',
        jsonb_build_object(
          'league_id', NEW.league_id, 'match_id', NEW.id,
          'season_id', NEW.season_id
        ), NULL, NULL
      );
    END LOOP;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;


DROP TRIGGER IF EXISTS trg_notify_league_match_state_change
  ON public.league_matches;
CREATE TRIGGER trg_notify_league_match_state_change
  AFTER UPDATE OF status ON public.league_matches
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_league_match_state_change();

COMMENT ON FUNCTION public.notify_league_match_state_change IS
  'Fires after any league_matches.status transition. Enumerates '
  'participants via league_match_participant_user_ids and inserts '
  'notifications through create_notification() so per-category user '
  'preferences are respected.';
