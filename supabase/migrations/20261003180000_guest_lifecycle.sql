BEGIN;

-- A saved guest is an identity used by rosters and scored matches. Removing
-- that identity from a picker must never cascade into those records.
ALTER TABLE public.guest_players ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.guest_claim_invites ADD COLUMN IF NOT EXISTS email_attempted_at timestamptz;
ALTER TABLE public.guest_claim_invites ADD COLUMN IF NOT EXISTS email_queued_at timestamptz;
REVOKE INSERT, UPDATE, DELETE ON public.guest_players FROM PUBLIC, anon, authenticated;
GRANT INSERT (id, display_name, created_by, group_id, email, phone, skill_estimate, gender)
  ON public.guest_players TO authenticated;
GRANT UPDATE (display_name, email, phone, skill_estimate, gender)
  ON public.guest_players TO authenticated;

CREATE OR REPLACE FUNCTION public.archive_guest_player(_guest_id uuid, _archived boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.pulse_has_required_mfa()
     OR NOT public.can_manage_guest_player(_guest_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;
  UPDATE guest_players SET archived_at = CASE WHEN _archived THEN now() ELSE NULL END WHERE id = _guest_id;
  IF _archived THEN
    UPDATE guest_claim_invites SET status = 'revoked'
      WHERE guest_player_id = _guest_id AND status IN ('pending', 'awaiting_approval');
  END IF;
  RETURN jsonb_build_object('ok', true);
END $$;

-- Invitation creation and transitions are server-owned, including the target
-- guest, email, expiry and token. Knowing a guest UUID grants no claim rights.
REVOKE INSERT, UPDATE, DELETE ON public.guest_claim_invites FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS "Creators manage own invites" ON public.guest_claim_invites;
DROP POLICY IF EXISTS "Guest managers can read invites" ON public.guest_claim_invites;
CREATE POLICY "Guest managers can read invites" ON public.guest_claim_invites
  FOR SELECT TO authenticated USING (public.can_manage_guest_player(guest_player_id));

CREATE OR REPLACE FUNCTION public.create_guest_claim_invite(_guest_id uuid, _email text, _request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE g guest_players; i guest_claim_invites; email_address text := nullif(lower(btrim(_email)), '');
BEGIN
  IF auth.uid() IS NULL OR NOT public.pulse_has_required_mfa()
     OR NOT public.can_manage_guest_player(_guest_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;
  SELECT * INTO g FROM guest_players WHERE id = _guest_id FOR UPDATE;
  IF g.linked_user_id IS NOT NULL OR g.archived_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'guest_unavailable');
  END IF;
  IF _request_id IS NULL OR (email_address IS NOT NULL AND
     (length(email_address) > 254 OR email_address !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_email');
  END IF;
  SELECT * INTO i FROM guest_claim_invites WHERE id = _request_id;
  IF FOUND THEN
    IF i.created_by IS DISTINCT FROM auth.uid() OR i.guest_player_id <> _guest_id
       OR i.invited_email IS DISTINCT FROM email_address THEN
      RETURN jsonb_build_object('ok', false, 'error', 'request_conflict');
    END IF;
  ELSE
    -- Bound accidental repeated clicks and automated email abuse per organizer.
    PERFORM pg_advisory_xact_lock(hashtextextended('guest-invites:' || auth.uid()::text, 0));
    IF (SELECT count(*) FROM guest_claim_invites WHERE created_by = auth.uid()
        AND created_at > now() - interval '1 hour') >= 30 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'invite_limit');
    END IF;
    INSERT INTO guest_claim_invites(id, guest_player_id, token, invited_email, created_by, requires_approval)
    VALUES (_request_id, _guest_id, replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
            email_address, auth.uid(), true) RETURNING * INTO i;
  END IF;
  RETURN jsonb_build_object('ok', true, 'invite_id', i.id, 'token', i.token, 'expires_at', i.expires_at);
END $$;

CREATE OR REPLACE FUNCTION public.revoke_guest_claim_invite(_invite_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE guest_id uuid;
BEGIN
  SELECT guest_player_id INTO guest_id FROM guest_claim_invites WHERE id = _invite_id;
  IF auth.uid() IS NULL OR NOT public.pulse_has_required_mfa()
     OR NOT coalesce(public.can_manage_guest_player(guest_id), false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;
  PERFORM id FROM guest_players WHERE id = guest_id FOR UPDATE;
  UPDATE guest_claim_invites SET status = 'revoked'
    WHERE id = _invite_id AND status IN ('pending', 'awaiting_approval');
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'not_pending'); END IF;
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.apply_guest_link(_guest_id uuid, _user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE g guest_players;
BEGIN
  SELECT * INTO g FROM guest_players WHERE id = _guest_id FOR UPDATE;
  IF NOT FOUND OR _user_id IS NULL THEN RAISE EXCEPTION 'guest_unavailable'; END IF;
  -- Serialize claims of different guest records to the same account, including
  -- standalone match history without a parent round-robin event to lock.
  PERFORM id FROM profiles WHERE id = _user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'guest_unavailable'; END IF;
  IF g.linked_user_id IS NOT NULL AND g.linked_user_id <> _user_id THEN RAISE EXCEPTION 'already_linked'; END IF;
  -- A person cannot acquire a second seat in a match or event by claiming it.
  IF EXISTS (SELECT 1 FROM match_participants a JOIN match_participants b ON a.match_id = b.match_id
      LEFT JOIN guest_players bg ON bg.id = b.guest_player_id
      WHERE a.guest_player_id = _guest_id AND b.id <> a.id
        AND (b.player_id = _user_id OR bg.linked_user_id = _user_id))
     OR EXISTS (SELECT 1 FROM round_robin_players a JOIN round_robin_players b ON a.event_id = b.event_id
      LEFT JOIN guest_players bg ON bg.id = b.guest_player_id
      WHERE a.guest_player_id = _guest_id AND b.id <> a.id
        AND (b.player_id = _user_id OR bg.linked_user_id = _user_id)) THEN
    RAISE EXCEPTION 'duplicate_participation';
  END IF;
  UPDATE guest_players SET linked_user_id = _user_id, linked_at = coalesce(linked_at, now()) WHERE id = _guest_id;
  UPDATE match_participants SET player_id = _user_id WHERE guest_player_id = _guest_id AND player_id IS NULL;
  -- Guest games stay unranked; the existing stats function preserves rating.
  PERFORM public.recalculate_player_stats(_user_id);
END $$;

CREATE OR REPLACE FUNCTION public.claim_guest_profile(_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE i guest_claim_invites; g guest_players; email_address text; confirmed_at timestamptz;
BEGIN
  IF auth.uid() IS NULL OR NOT public.pulse_has_required_mfa() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;
  SELECT * INTO i FROM guest_claim_invites WHERE token = _token;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid_token'); END IF;
  PERFORM id FROM round_robin_events WHERE id IN (SELECT event_id FROM round_robin_players
    WHERE guest_player_id = i.guest_player_id) ORDER BY id FOR UPDATE;
  -- All claim mutations take the guest lock before the invite lock. Different
  -- tokens for one guest cannot race to attach different accounts.
  SELECT * INTO g FROM guest_players WHERE id = i.guest_player_id FOR UPDATE;
  SELECT * INTO i FROM guest_claim_invites WHERE token = _token FOR UPDATE;
  IF i.status = 'accepted' AND i.accepted_by_user_id = auth.uid() AND g.linked_user_id = auth.uid() THEN
    RETURN jsonb_build_object('ok', true, 'status', 'linked');
  END IF;
  IF i.status NOT IN ('pending', 'awaiting_approval') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invite_' || i.status);
  END IF;
  IF i.expires_at <= now() THEN
    UPDATE guest_claim_invites SET status = 'expired' WHERE id = i.id;
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;
  IF g.linked_user_id IS NOT NULL OR g.archived_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_linked');
  END IF;
  IF i.accepted_by_user_id IS NOT NULL AND i.accepted_by_user_id <> auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'claim_in_review');
  END IF;
  SELECT email, email_confirmed_at INTO email_address, confirmed_at FROM auth.users WHERE id = auth.uid();
  IF i.invited_email IS NOT NULL AND confirmed_at IS NOT NULL
      AND lower(i.invited_email) = lower(email_address) THEN
    PERFORM public.apply_guest_link(g.id, auth.uid());
    UPDATE guest_claim_invites SET status = 'accepted', accepted_at = now(), accepted_by_user_id = auth.uid() WHERE id = i.id;
    UPDATE guest_claim_invites SET status = 'revoked' WHERE guest_player_id = g.id AND id <> i.id AND status IN ('pending', 'awaiting_approval');
    RETURN jsonb_build_object('ok', true, 'status', 'linked');
  END IF;
  UPDATE guest_claim_invites SET status = 'awaiting_approval', accepted_by_user_id = auth.uid() WHERE id = i.id;
  RETURN jsonb_build_object('ok', true, 'status', 'awaiting_approval');
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM IN ('duplicate_participation', 'already_linked', 'guest_unavailable') THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
  END IF;
  RAISE;
END $$;

CREATE OR REPLACE FUNCTION public.approve_guest_claim(_invite_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE i guest_claim_invites; g guest_players;
BEGIN
  SELECT * INTO i FROM guest_claim_invites WHERE id = _invite_id;
  IF auth.uid() IS NULL OR NOT public.pulse_has_required_mfa()
     OR NOT coalesce(public.can_manage_guest_player(i.guest_player_id), false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;
  PERFORM id FROM round_robin_events WHERE id IN (SELECT event_id FROM round_robin_players
    WHERE guest_player_id = i.guest_player_id) ORDER BY id FOR UPDATE;
  SELECT * INTO g FROM guest_players WHERE id = i.guest_player_id FOR UPDATE;
  SELECT * INTO i FROM guest_claim_invites WHERE id = _invite_id FOR UPDATE;
  IF i.status = 'accepted' AND g.linked_user_id = i.accepted_by_user_id THEN RETURN jsonb_build_object('ok', true); END IF;
  IF i.status <> 'awaiting_approval' OR i.accepted_by_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_pending');
  END IF;
  IF i.expires_at <= now() THEN
    UPDATE guest_claim_invites SET status = 'expired' WHERE id = i.id;
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;
  IF g.archived_at IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'guest_unavailable'); END IF;
  PERFORM public.apply_guest_link(g.id, i.accepted_by_user_id);
  UPDATE guest_claim_invites SET status = 'accepted', accepted_at = now() WHERE id = i.id;
  UPDATE guest_claim_invites SET status = 'revoked' WHERE guest_player_id = g.id AND id <> i.id AND status IN ('pending', 'awaiting_approval');
  RETURN jsonb_build_object('ok', true);
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM IN ('duplicate_participation', 'already_linked', 'guest_unavailable') THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
  END IF;
  RAISE;
END $$;

-- Preserve guest seat IDs in existing schedules while exposing participation
-- to the claimed account. This also avoids changing any saved pairings.
CREATE OR REPLACE FUNCTION public.is_event_participant(_event_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM round_robin_players p LEFT JOIN guest_players g ON g.id = p.guest_player_id
    WHERE p.event_id = _event_id AND p.active AND (p.player_id = _user_id OR g.linked_user_id = _user_id));
$$;
DROP POLICY IF EXISTS "Claimed guests can read their identity" ON public.guest_players;
CREATE POLICY "Claimed guests can read their identity" ON public.guest_players
  FOR SELECT TO authenticated USING (linked_user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.rr_can_read_participant_guest(_guest_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT auth.uid() IS NOT NULL AND public.pulse_has_required_mfa() AND EXISTS (
    SELECT 1 FROM round_robin_players p WHERE p.guest_player_id = _guest_id
      AND public.is_event_participant(p.event_id, auth.uid()));
$$;
DROP POLICY IF EXISTS "Participants can read fellow guest identities" ON public.guest_players;
CREATE POLICY "Participants can read fellow guest identities" ON public.guest_players
  FOR SELECT TO authenticated USING (public.rr_can_read_participant_guest(id));

CREATE OR REPLACE FUNCTION public.guard_guest_roster_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE g guest_players; account_id uuid;
BEGIN
  -- Serializes with scoring, substitutions and account claiming for this event.
  PERFORM id FROM round_robin_events WHERE id = NEW.event_id FOR UPDATE;
  IF TG_OP = 'UPDATE' AND NEW.player_id IS NOT DISTINCT FROM OLD.player_id
      AND NEW.guest_player_id IS NOT DISTINCT FROM OLD.guest_player_id
      AND (NOT NEW.active OR OLD.active) THEN RETURN NEW; END IF;
  IF NEW.guest_player_id IS NOT NULL THEN
    SELECT * INTO g FROM guest_players WHERE id = NEW.guest_player_id FOR KEY SHARE;
    IF g.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Restore this archived guest before adding them to an event.'; END IF;
  END IF;
  account_id := coalesce(NEW.player_id, g.linked_user_id);
  IF account_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM round_robin_players p LEFT JOIN guest_players gp ON gp.id = p.guest_player_id
      WHERE p.event_id = NEW.event_id AND p.id <> NEW.id
        AND (p.player_id = account_id OR gp.linked_user_id = account_id)) THEN
    RAISE EXCEPTION 'This player already has a guest or account registration in this event.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_guest_roster_identity ON public.round_robin_players;
CREATE TRIGGER guard_guest_roster_identity BEFORE INSERT OR UPDATE OF player_id, guest_player_id, active
  ON public.round_robin_players FOR EACH ROW EXECUTE FUNCTION public.guard_guest_roster_identity();

CREATE OR REPLACE FUNCTION public.my_round_robin_registrations(_include_inactive boolean DEFAULT false)
RETURNS TABLE (event_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT p.event_id FROM round_robin_players p
    WHERE auth.uid() IS NOT NULL AND public.pulse_has_required_mfa()
      AND p.player_id = auth.uid() AND (_include_inactive OR p.active)
  UNION
  SELECT p.event_id FROM guest_players g JOIN round_robin_players p ON p.guest_player_id = g.id
    WHERE auth.uid() IS NOT NULL AND public.pulse_has_required_mfa()
      AND g.linked_user_id = auth.uid() AND (_include_inactive OR p.active);
$$;

CREATE OR REPLACE FUNCTION public.link_claimed_guest_match_participant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE linked_id uuid;
BEGIN
  IF NEW.guest_player_id IS NOT NULL THEN
    SELECT linked_user_id INTO linked_id FROM guest_players WHERE id = NEW.guest_player_id;
    IF linked_id IS NOT NULL THEN
      IF NEW.player_id IS NOT NULL AND NEW.player_id <> linked_id THEN RAISE EXCEPTION 'Guest account does not match participant'; END IF;
      IF EXISTS (SELECT 1 FROM match_participants WHERE match_id = NEW.match_id AND player_id = linked_id AND id <> NEW.id) THEN
        RAISE EXCEPTION 'duplicate_participation';
      END IF;
      NEW.player_id := linked_id;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS link_claimed_guest_match_participant ON public.match_participants;
CREATE TRIGGER link_claimed_guest_match_participant BEFORE INSERT OR UPDATE OF guest_player_id, player_id
  ON public.match_participants FOR EACH ROW EXECUTE FUNCTION public.link_claimed_guest_match_participant();

-- Scoring formerly refreshed only the four profile IDs on the schedule. A
-- claimed guest deliberately retains a guest seat there; refresh the actual
-- saved participants, which now include that linked account.
DO $$
DECLARE definition text;
BEGIN
  SELECT pg_get_functiondef('public.submit_rr_match_score(uuid,integer,integer)'::regprocedure) INTO definition;
  IF position('FROM unnest(v_participant_ids) AS pid;' IN definition) > 0 THEN
    EXECUTE replace(definition,
      'PERFORM public.recalculate_player_stats(pid) FROM unnest(v_participant_ids) AS pid;',
      'PERFORM public.recalculate_player_stats(mp.player_id) FROM public.match_participants mp WHERE mp.match_id = v_match_id AND mp.player_id IS NOT NULL;');
  ELSIF position('mp.match_id = v_match_id AND mp.player_id IS NOT NULL' IN definition) = 0 THEN
    RAISE EXCEPTION 'Unrecognized round robin score totals implementation';
  END IF;
END $$;

-- Repair unambiguous history for accounts claimed before this migration.
DO $$
DECLARE account_id uuid;
BEGIN
  UPDATE match_participants mp SET player_id = g.linked_user_id FROM guest_players g
    WHERE mp.guest_player_id = g.id AND mp.player_id IS NULL AND g.linked_user_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM match_participants other WHERE other.match_id = mp.match_id
        AND other.id <> mp.id AND (other.player_id = g.linked_user_id OR EXISTS (
          SELECT 1 FROM guest_players og WHERE og.id = other.guest_player_id AND og.linked_user_id = g.linked_user_id)));
  FOR account_id IN SELECT DISTINCT linked_user_id FROM guest_players WHERE linked_user_id IS NOT NULL LOOP
    PERFORM public.recalculate_player_stats(account_id);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.merge_guest_players(_keep_id uuid, _remove_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE k guest_players; r guest_players;
BEGIN
  IF auth.uid() IS NULL OR NOT public.pulse_has_required_mfa()
     OR NOT public.can_manage_guest_player(_keep_id) OR NOT public.can_manage_guest_player(_remove_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;
  IF _keep_id = _remove_id THEN RETURN jsonb_build_object('ok', false, 'error', 'same_id'); END IF;
  -- Follow the event -> guest lock order used when editing a roster.
  PERFORM id FROM round_robin_events WHERE id IN (SELECT event_id FROM round_robin_players
    WHERE guest_player_id IN (_keep_id, _remove_id)) ORDER BY id FOR UPDATE;
  PERFORM id FROM guest_players WHERE id IN (_keep_id, _remove_id) ORDER BY id FOR UPDATE;
  SELECT * INTO k FROM guest_players WHERE id = _keep_id;
  SELECT * INTO r FROM guest_players WHERE id = _remove_id;
  IF k.id IS NULL OR r.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  IF k.linked_user_id IS NOT NULL OR r.linked_user_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'linked_guest_merge');
  END IF;
  IF EXISTS (SELECT 1 FROM round_robin_players p JOIN round_robin_events e ON e.id = p.event_id
      WHERE p.guest_player_id IN (_keep_id, _remove_id) AND e.status IN ('draft', 'live')) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'active_event_merge');
  END IF;
  IF EXISTS (SELECT 1 FROM round_robin_players a JOIN round_robin_players b ON a.event_id = b.event_id
      WHERE a.guest_player_id = _keep_id AND b.guest_player_id = _remove_id)
     OR EXISTS (SELECT 1 FROM match_participants a JOIN match_participants b ON a.match_id = b.match_id
      WHERE a.guest_player_id = _keep_id AND b.guest_player_id = _remove_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'duplicate_participation');
  END IF;
  IF (SELECT count(*) FROM venue_customers WHERE competition_guest_id IN (_keep_id, _remove_id)) > 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'venue_customer_conflict');
  END IF;
  UPDATE guest_players SET email = coalesce(email, r.email), phone = coalesce(phone, r.phone),
    gender = coalesce(gender, r.gender), archived_at = NULL WHERE id = _keep_id;
  UPDATE venue_customers SET competition_guest_id = _keep_id WHERE competition_guest_id = _remove_id;
  UPDATE round_robin_players SET guest_player_id = _keep_id WHERE guest_player_id = _remove_id;
  UPDATE round_robin_schedule SET
    a1_guest_id = CASE WHEN a1_guest_id = _remove_id THEN _keep_id ELSE a1_guest_id END,
    a2_guest_id = CASE WHEN a2_guest_id = _remove_id THEN _keep_id ELSE a2_guest_id END,
    b1_guest_id = CASE WHEN b1_guest_id = _remove_id THEN _keep_id ELSE b1_guest_id END,
    b2_guest_id = CASE WHEN b2_guest_id = _remove_id THEN _keep_id ELSE b2_guest_id END
    WHERE _remove_id IN (a1_guest_id, a2_guest_id, b1_guest_id, b2_guest_id);
  UPDATE match_participants SET guest_player_id = _keep_id WHERE guest_player_id = _remove_id;
  UPDATE guest_claim_invites SET guest_player_id = _keep_id WHERE guest_player_id = _remove_id;
  DELETE FROM guest_players WHERE id = _remove_id;
  RETURN jsonb_build_object('ok', true);
END $$;

REVOKE ALL ON FUNCTION public.apply_guest_link(uuid, uuid), public.link_claimed_guest_match_participant(), public.guard_guest_roster_identity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rr_can_read_participant_guest(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rr_can_read_participant_guest(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.archive_guest_player(uuid, boolean), public.create_guest_claim_invite(uuid, text, uuid),
  public.revoke_guest_claim_invite(uuid), public.claim_guest_profile(text), public.approve_guest_claim(uuid),
  public.merge_guest_players(uuid, uuid), public.my_round_robin_registrations(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_guest_player(uuid, boolean), public.create_guest_claim_invite(uuid, text, uuid),
  public.revoke_guest_claim_invite(uuid), public.claim_guest_profile(text), public.approve_guest_claim(uuid),
  public.merge_guest_players(uuid, uuid), public.my_round_robin_registrations(boolean) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
