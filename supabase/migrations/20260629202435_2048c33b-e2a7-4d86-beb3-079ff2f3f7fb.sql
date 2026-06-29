-- ============= Migration 1: RR invite codes =============
ALTER TABLE public.round_robin_events
  ADD COLUMN IF NOT EXISTS invite_code VARCHAR(9) UNIQUE;

CREATE OR REPLACE FUNCTION public.generate_rr_invite_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_alphabet   TEXT    := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_alpha_len  INTEGER := length(v_alphabet);
  v_code       TEXT;
  v_i          INTEGER;
  v_attempts   INTEGER := 0;
BEGIN
  LOOP
    v_code := '';
    FOR v_i IN 1..3 LOOP
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * v_alpha_len)::INT, 1);
    END LOOP;
    v_code := v_code || '-';
    FOR v_i IN 1..4 LOOP
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * v_alpha_len)::INT, 1);
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM public.round_robin_events WHERE invite_code = v_code) THEN
      RETURN v_code;
    END IF;
    v_attempts := v_attempts + 1;
    IF v_attempts > 50 THEN
      RAISE EXCEPTION 'Could not generate unique invite code after 50 attempts';
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_rr_invite_code() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rr_events_set_invite_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.registration_mode = 'invite_only' AND NEW.invite_code IS NULL THEN
    NEW.invite_code := public.generate_rr_invite_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rr_events_invite_code_trigger ON public.round_robin_events;
CREATE TRIGGER rr_events_invite_code_trigger
  BEFORE INSERT OR UPDATE OF registration_mode
  ON public.round_robin_events
  FOR EACH ROW
  EXECUTE FUNCTION public.rr_events_set_invite_code();

CREATE OR REPLACE FUNCTION public.preview_round_robin_by_code(p_code TEXT)
RETURNS TABLE(
  event_id              UUID,
  event_name            TEXT,
  event_date            DATE,
  event_start_time      TEXT,
  event_status          public.round_robin_status,
  num_courts            INT,
  num_rounds            INT,
  current_players       INT,
  max_players           INT,
  registration_deadline TIMESTAMPTZ,
  organizer_name        TEXT,
  organizer_avatar_url  TEXT,
  already_joined        BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event   RECORD;
  v_count   INT;
  v_user_id UUID := auth.uid();
  v_joined  BOOLEAN := false;
BEGIN
  p_code := upper(trim(p_code));
  SELECT * INTO v_event FROM public.round_robin_events WHERE invite_code = p_code LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid invite code' USING ERRCODE = '02000';
  END IF;
  SELECT count(*)::INT INTO v_count FROM public.round_robin_players rrp WHERE rrp.event_id = v_event.id AND rrp.active = true;
  IF v_user_id IS NOT NULL THEN
    SELECT EXISTS (SELECT 1 FROM public.round_robin_players rrp WHERE rrp.event_id = v_event.id AND rrp.player_id = v_user_id AND rrp.active = true) INTO v_joined;
  END IF;
  RETURN QUERY
    SELECT v_event.id, v_event.name, v_event.date, v_event.start_time::TEXT, v_event.status,
      v_event.num_courts, v_event.num_rounds, v_count, v_event.max_players, v_event.registration_deadline,
      (SELECT COALESCE(p.display_name, p.full_name, 'Organizer') FROM public.profiles p WHERE p.id = v_event.organizer_id)::TEXT,
      (SELECT p.avatar_url FROM public.profiles p WHERE p.id = v_event.organizer_id)::TEXT,
      v_joined;
END;
$$;

GRANT EXECUTE ON FUNCTION public.preview_round_robin_by_code(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.join_round_robin_by_code(p_code TEXT)
RETURNS TABLE(event_id UUID, registration_status TEXT, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event           RECORD;
  v_user_id         UUID := auth.uid();
  v_confirmed_count INT;
  v_max_players     INT;
  v_status          TEXT;
  v_existing        RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to join' USING ERRCODE = '42501';
  END IF;
  p_code := upper(trim(p_code));
  SELECT id, status, max_players, registration_deadline, registration_mode, name
    INTO v_event FROM public.round_robin_events WHERE invite_code = p_code LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid invite code' USING ERRCODE = '02000';
  END IF;
  IF v_event.status = 'completed' THEN
    RAISE EXCEPTION 'This event has already completed' USING ERRCODE = '22023';
  END IF;
  IF v_event.registration_deadline IS NOT NULL AND now() > v_event.registration_deadline THEN
    RAISE EXCEPTION 'Registration has closed for this event' USING ERRCODE = '22023';
  END IF;
  SELECT id, active, registration_status INTO v_existing
    FROM public.round_robin_players
    WHERE round_robin_players.event_id = v_event.id AND round_robin_players.player_id = v_user_id LIMIT 1;
  IF FOUND AND v_existing.active = true THEN
    RETURN QUERY SELECT v_event.id, COALESCE(v_existing.registration_status, 'confirmed'),
      'You''re already registered for this event'::TEXT;
    RETURN;
  END IF;
  v_max_players := v_event.max_players;
  IF v_max_players IS NOT NULL THEN
    SELECT count(*)::INT INTO v_confirmed_count FROM public.round_robin_players
      WHERE round_robin_players.event_id = v_event.id AND round_robin_players.active = true
        AND COALESCE(registration_status, 'confirmed') = 'confirmed';
    IF v_confirmed_count >= v_max_players THEN v_status := 'waitlisted'; ELSE v_status := 'confirmed'; END IF;
  ELSE
    v_status := 'confirmed';
  END IF;
  IF FOUND THEN
    UPDATE public.round_robin_players SET active = true, registration_status = v_status, joined_at = now() WHERE id = v_existing.id;
  ELSE
    INSERT INTO public.round_robin_players (event_id, player_id, active, registration_status, joined_at)
    VALUES (v_event.id, v_user_id, true, v_status, now());
  END IF;
  RETURN QUERY SELECT v_event.id, v_status,
    CASE WHEN v_status = 'waitlisted' THEN 'Event is full — you''re on the waitlist'
         ELSE 'You''re in. See you on the court.' END::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_round_robin_by_code(TEXT) TO authenticated;

-- ============= Migration 2: RR score pipeline =============
-- Inlining file contents from 20260616120100_rr_score_pipeline.sql,
-- 20260616180000_rr_voided_status.sql,
-- 20260628000000_backfill_rr_num_rounds_drift.sql,
-- 20260629000000_regenerate_group_invite_code_rpc.sql,
-- 20260630000000_group_members_role_escalation_guard.sql
-- via \i-style inclusion is not possible; using DO block to source files is not possible either.
-- The remaining migrations are applied by separate migration calls to keep payload size manageable.
