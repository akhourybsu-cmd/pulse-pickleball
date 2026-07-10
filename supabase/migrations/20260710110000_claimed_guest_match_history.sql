-- =====================================================================
-- Claimed guests: surface their guest matches on the linked profile.
--
-- Match history / profile surfaces query match_participants by
-- player_id. Guest rows have player_id NULL (only guest_player_id), so
-- even after a guest profile is claimed, none of their matches appear
-- on the linked account.
--
-- Fix: when a guest links (claim_guest_profile auto-link path or
-- approve_guest_claim), stamp match_participants.player_id with the
-- linked user on every row carrying that guest_player_id. The
-- guest_player_id column is kept for provenance. A one-time backfill
-- covers guests linked before this migration.
--
-- Rating safety: round robin matches with a guest seat are written
-- with count_for_rating = false, and recalculate_all_ratings filters
-- on count_for_rating first — so stamping player_id here surfaces the
-- matches in history WITHOUT retroactively pulling them into rating
-- calculations. Profile win/loss/match counts will include them, which
-- is correct: the person really played those matches.
--
-- Builds on 20260709120000 (display-name sync) — both function bodies
-- below retain that behavior.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Shared helper: link a guest to a user (name sync + history stamp).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_guest_link(_guest_id uuid, _user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.guest_players
    SET linked_user_id = _user_id,
        linked_at = now(),
        display_name = COALESCE(public.resolved_profile_name(_user_id), display_name)
    WHERE id = _guest_id;

  -- Surface their guest matches on the linked profile. Guard against a
  -- row already carrying a player_id (shouldn't happen, but never
  -- overwrite one) and against creating a duplicate participant if the
  -- user somehow also played the same match under their real account.
  UPDATE public.match_participants mp
    SET player_id = _user_id
    WHERE mp.guest_player_id = _guest_id
      AND mp.player_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.match_participants mp2
        WHERE mp2.match_id = mp.match_id
          AND mp2.player_id = _user_id
      );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_guest_link(uuid, uuid) FROM PUBLIC;

-- ---------------------------------------------------------------------
-- Auto-link path
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_guest_profile(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.guest_claim_invites%ROWTYPE;
  v_guest public.guest_players%ROWTYPE;
  v_user_email text;
  v_auto_link boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO v_invite FROM public.guest_claim_invites WHERE token = _token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  IF v_invite.status NOT IN ('pending','awaiting_approval') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invite_'|| v_invite.status);
  END IF;

  IF v_invite.expires_at < now() THEN
    UPDATE public.guest_claim_invites SET status = 'expired' WHERE id = v_invite.id;
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;

  SELECT * INTO v_guest FROM public.guest_players WHERE id = v_invite.guest_player_id;
  IF v_guest.linked_user_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_linked');
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();

  IF v_invite.invited_email IS NOT NULL
     AND lower(v_invite.invited_email) = lower(coalesce(v_user_email, '')) THEN
    v_auto_link := true;
  ELSIF v_invite.requires_approval = false THEN
    v_auto_link := true;
  END IF;

  IF v_auto_link THEN
    PERFORM public.apply_guest_link(v_guest.id, auth.uid());

    UPDATE public.guest_claim_invites
      SET status = 'accepted',
          accepted_at = now(),
          accepted_by_user_id = auth.uid()
      WHERE id = v_invite.id;

    RETURN jsonb_build_object('ok', true, 'status', 'linked');
  ELSE
    UPDATE public.guest_claim_invites
      SET status = 'awaiting_approval',
          accepted_by_user_id = auth.uid()
      WHERE id = v_invite.id;

    RETURN jsonb_build_object('ok', true, 'status', 'awaiting_approval');
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_guest_profile(text) TO authenticated;

-- ---------------------------------------------------------------------
-- Organizer-approval path
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_guest_claim(_invite_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.guest_claim_invites%ROWTYPE;
  v_guest public.guest_players%ROWTYPE;
BEGIN
  SELECT * INTO v_invite FROM public.guest_claim_invites WHERE id = _invite_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_invite');
  END IF;
  IF v_invite.created_by <> auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;
  IF v_invite.status <> 'awaiting_approval' OR v_invite.accepted_by_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_pending');
  END IF;

  SELECT * INTO v_guest FROM public.guest_players WHERE id = v_invite.guest_player_id;
  IF v_guest.linked_user_id IS NULL THEN
    PERFORM public.apply_guest_link(v_invite.guest_player_id, v_invite.accepted_by_user_id);
  END IF;

  UPDATE public.guest_claim_invites
    SET status = 'accepted',
        accepted_at = now()
    WHERE id = v_invite.id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_guest_claim(uuid) TO authenticated;

-- ---------------------------------------------------------------------
-- Backfill: guests linked before this migration (e.g. Bonnie).
-- ---------------------------------------------------------------------
UPDATE public.match_participants mp
  SET player_id = gp.linked_user_id
  FROM public.guest_players gp
  WHERE mp.guest_player_id = gp.id
    AND gp.linked_user_id IS NOT NULL
    AND mp.player_id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.match_participants mp2
      WHERE mp2.match_id = mp.match_id
        AND mp2.player_id = gp.linked_user_id
    );
