
-- 1. guest_players (table only first, policies later)
CREATE TABLE public.guest_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  email text,
  phone text,
  skill_estimate numeric(3,2),
  linked_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  linked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT guest_players_display_name_not_blank CHECK (length(btrim(display_name)) > 0)
);

CREATE INDEX idx_guest_players_created_by ON public.guest_players(created_by);
CREATE INDEX idx_guest_players_group_id ON public.guest_players(group_id) WHERE group_id IS NOT NULL;
CREATE INDEX idx_guest_players_linked_user ON public.guest_players(linked_user_id) WHERE linked_user_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.guest_players TO authenticated;
GRANT ALL ON public.guest_players TO service_role;

ALTER TABLE public.guest_players ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER guest_players_set_updated_at
  BEFORE UPDATE ON public.guest_players
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. round_robin_players gets guest_player_id BEFORE we write policies that reference it
ALTER TABLE public.round_robin_players
  ADD COLUMN IF NOT EXISTS guest_player_id uuid REFERENCES public.guest_players(id) ON DELETE CASCADE;

ALTER TABLE public.round_robin_players
  DROP CONSTRAINT IF EXISTS round_robin_players_event_id_player_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS rrp_event_player_uniq
  ON public.round_robin_players(event_id, player_id)
  WHERE player_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS rrp_event_guest_uniq
  ON public.round_robin_players(event_id, guest_player_id)
  WHERE guest_player_id IS NOT NULL;

ALTER TABLE public.round_robin_players
  DROP CONSTRAINT IF EXISTS rrp_player_or_guest_chk;
ALTER TABLE public.round_robin_players
  ADD CONSTRAINT rrp_player_or_guest_chk CHECK (
    (player_id IS NOT NULL AND guest_player_id IS NULL)
    OR (player_id IS NULL AND guest_player_id IS NOT NULL)
    OR (player_id IS NULL AND guest_player_id IS NULL AND guest_name IS NOT NULL)
  ) NOT VALID;

CREATE INDEX IF NOT EXISTS idx_rrp_guest_player ON public.round_robin_players(guest_player_id) WHERE guest_player_id IS NOT NULL;

-- 3. guest_players policies (now safe to reference rrp.guest_player_id)
CREATE POLICY "Creators manage own guests"
  ON public.guest_players FOR ALL TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Group admins manage group guests"
  ON public.guest_players FOR ALL TO authenticated
  USING (
    group_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = guest_players.group_id
        AND gm.user_id = auth.uid()
        AND gm.role IN ('owner','moderator')
    )
  )
  WITH CHECK (
    group_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = guest_players.group_id
        AND gm.user_id = auth.uid()
        AND gm.role IN ('owner','moderator')
    )
  );

CREATE POLICY "RR participants can view guests in their events"
  ON public.guest_players FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.round_robin_players rrp
      JOIN public.round_robin_events rre ON rre.id = rrp.event_id
      WHERE rrp.guest_player_id = guest_players.id
        AND (
          rre.organizer_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.round_robin_players rrp2
            WHERE rrp2.event_id = rre.id AND rrp2.player_id = auth.uid()
          )
        )
    )
  );

-- 4. guest_claim_invites
CREATE TABLE public.guest_claim_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_player_id uuid NOT NULL REFERENCES public.guest_players(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  invited_email text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requires_approval boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','revoked','expired','awaiting_approval')),
  accepted_at timestamptz,
  accepted_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_guest_claim_invites_guest ON public.guest_claim_invites(guest_player_id);
CREATE INDEX idx_guest_claim_invites_creator ON public.guest_claim_invites(created_by);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.guest_claim_invites TO authenticated;
GRANT ALL ON public.guest_claim_invites TO service_role;

ALTER TABLE public.guest_claim_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creators manage own invites"
  ON public.guest_claim_invites FOR ALL TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE TRIGGER guest_claim_invites_set_updated_at
  BEFORE UPDATE ON public.guest_claim_invites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. round_robin_events: allow_guests + rating exclusion reason
ALTER TABLE public.round_robin_events
  ADD COLUMN IF NOT EXISTS allow_guests boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rating_exclusion_reason text;

CREATE OR REPLACE FUNCTION public.enforce_rr_guest_rating_rules()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.allow_guests = true THEN
    NEW.rating_eligible := false;
    IF NEW.rating_exclusion_reason IS NULL OR NEW.rating_exclusion_reason = '' THEN
      NEW.rating_exclusion_reason := 'Guest players enabled';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rr_enforce_guest_rating_rules ON public.round_robin_events;
CREATE TRIGGER rr_enforce_guest_rating_rules
  BEFORE INSERT OR UPDATE ON public.round_robin_events
  FOR EACH ROW EXECUTE FUNCTION public.enforce_rr_guest_rating_rules();

-- 6. RPCs
CREATE OR REPLACE FUNCTION public.get_claim_invite(_token text)
RETURNS TABLE (
  invite_id uuid,
  guest_player_id uuid,
  guest_display_name text,
  invited_email text,
  status text,
  requires_approval boolean,
  expires_at timestamptz,
  is_linked boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.id,
    i.guest_player_id,
    gp.display_name,
    i.invited_email,
    i.status,
    i.requires_approval,
    i.expires_at,
    (gp.linked_user_id IS NOT NULL) AS is_linked
  FROM public.guest_claim_invites i
  JOIN public.guest_players gp ON gp.id = i.guest_player_id
  WHERE i.token = _token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_claim_invite(text) TO anon, authenticated;

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
          linked_at = now()
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
        linked_at = now()
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

CREATE OR REPLACE FUNCTION public.merge_guest_players(_keep_id uuid, _remove_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_keep public.guest_players%ROWTYPE;
  v_rm public.guest_players%ROWTYPE;
  v_authorized boolean;
BEGIN
  IF _keep_id = _remove_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'same_id');
  END IF;
  SELECT * INTO v_keep FROM public.guest_players WHERE id = _keep_id;
  SELECT * INTO v_rm FROM public.guest_players WHERE id = _remove_id;
  IF v_keep.id IS NULL OR v_rm.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  v_authorized :=
    v_keep.created_by = auth.uid()
    AND v_rm.created_by = auth.uid();

  IF NOT v_authorized AND v_keep.group_id IS NOT NULL AND v_keep.group_id = v_rm.group_id THEN
    SELECT EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_id = v_keep.group_id AND user_id = auth.uid()
        AND role IN ('owner','moderator')
    ) INTO v_authorized;
  END IF;

  IF NOT v_authorized THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  DELETE FROM public.round_robin_players rrp_rm
    USING public.round_robin_players rrp_keep
    WHERE rrp_rm.guest_player_id = _remove_id
      AND rrp_keep.guest_player_id = _keep_id
      AND rrp_keep.event_id = rrp_rm.event_id;

  UPDATE public.round_robin_players
    SET guest_player_id = _keep_id
    WHERE guest_player_id = _remove_id;

  IF v_keep.linked_user_id IS NULL AND v_rm.linked_user_id IS NOT NULL THEN
    UPDATE public.guest_players
      SET linked_user_id = v_rm.linked_user_id, linked_at = coalesce(v_rm.linked_at, now())
      WHERE id = _keep_id;
  END IF;

  DELETE FROM public.guest_players WHERE id = _remove_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.merge_guest_players(uuid, uuid) TO authenticated;
