-- =====================================================================
-- Claimed guests show the claimant's real name everywhere.
--
-- When a guest profile is claimed, claim_guest_profile / approve_guest_claim
-- set guest_players.linked_user_id but NEVER touched guest_players.display_name.
-- Every roster, schedule, standings row, kiosk seat, and match-history entry
-- resolves a guest's name from guest_players.display_name (via FK join) — or,
-- for legacy ad-hoc guests, round_robin_players.guest_name. So a claimed guest
-- kept showing the old guest name ("Bonnie (Guest)") in every activity even
-- after linking to a real account.
--
-- Fix: denormalize the claimant's profile name into guest_players.display_name
-- at link time. Because all surfaces read that single column, this propagates
-- everywhere with no client changes. Three parts:
--   1. Update both link RPCs to copy the name when they set linked_user_id.
--   2. A trigger on profiles so a later rename cascades to linked guests.
--   3. A one-time backfill for guests already linked (fixes Bonnie now).
--
-- Linked guests stay guests (guest_player_id is unchanged) — we do NOT convert
-- them to registered players, because that would retroactively pull their
-- historical guest matches into rating calculations. Only the display name
-- changes.
-- =====================================================================

-- Resolved, non-blank display name for a profile (display_name → full_name),
-- or NULL when the profile has neither. Guest display_name has a not-blank
-- CHECK, so callers COALESCE onto the existing value to stay safe.
CREATE OR REPLACE FUNCTION public.resolved_profile_name(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(NULLIF(BTRIM(p.display_name), ''), NULLIF(BTRIM(p.full_name), ''))
  FROM public.profiles p
  WHERE p.id = p_user_id;
$$;

-- ---------------------------------------------------------------------
-- 1a. Auto-link path
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
    UPDATE public.guest_players
      SET linked_user_id = auth.uid(),
          linked_at = now(),
          -- Adopt the claimant's real name so every roster/schedule/history
          -- surface (all of which read this column) shows it immediately.
          display_name = COALESCE(public.resolved_profile_name(auth.uid()), display_name)
      WHERE id = v_guest.id;

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
-- 1b. Organizer-approval path
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_guest_claim(_invite_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.guest_claim_invites%ROWTYPE;
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

  UPDATE public.guest_players
    SET linked_user_id = v_invite.accepted_by_user_id,
        linked_at = now(),
        display_name = COALESCE(
          public.resolved_profile_name(v_invite.accepted_by_user_id), display_name)
    WHERE id = v_invite.guest_player_id
      AND linked_user_id IS NULL;

  UPDATE public.guest_claim_invites
    SET status = 'accepted',
        accepted_at = now()
    WHERE id = v_invite.id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_guest_claim(uuid) TO authenticated;

-- ---------------------------------------------------------------------
-- 2. Keep linked guests in sync when the user later renames their profile.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_linked_guest_names()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  v_name := COALESCE(NULLIF(BTRIM(NEW.display_name), ''), NULLIF(BTRIM(NEW.full_name), ''));
  IF v_name IS NOT NULL THEN
    UPDATE public.guest_players
      SET display_name = v_name
      WHERE linked_user_id = NEW.id
        AND display_name IS DISTINCT FROM v_name;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_sync_linked_guest_names ON public.profiles;
CREATE TRIGGER profiles_sync_linked_guest_names
  AFTER UPDATE OF display_name, full_name ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_linked_guest_names();

-- ---------------------------------------------------------------------
-- 3. Backfill guests already linked before this migration (e.g. Bonnie).
-- ---------------------------------------------------------------------
UPDATE public.guest_players gp
  SET display_name = public.resolved_profile_name(gp.linked_user_id)
  WHERE gp.linked_user_id IS NOT NULL
    AND public.resolved_profile_name(gp.linked_user_id) IS NOT NULL
    AND gp.display_name IS DISTINCT FROM public.resolved_profile_name(gp.linked_user_id);
