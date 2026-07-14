
-- Slice 2a hotfix: planner + RPC operate on identity (profile_id OR guest_id)
-- instead of round_robin_players.id, matching the actual schedule schema.

CREATE OR REPLACE FUNCTION public.rr_plan_participant_change(
  p_event_id        uuid,
  p_participant_id  uuid,          -- round_robin_players.id (lifecycle row)
  p_action          text,
  p_substitute_id   uuid,          -- round_robin_players.id
  p_effective_round integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_current_round integer;
  v_from_profile  uuid;
  v_from_guest    uuid;
  v_to_profile    uuid;
  v_to_guest      uuid;
  v_plan          jsonb := '[]'::jsonb;
  v_triggers      text[] := ARRAY[]::text[];
  r               record;
  v_bye_row       record;
BEGIN
  SELECT COALESCE(current_round, 1) INTO v_current_round
    FROM public.round_robin_events WHERE id = p_event_id;

  SELECT player_id, guest_player_id INTO v_from_profile, v_from_guest
    FROM public.round_robin_players WHERE id = p_participant_id;

  IF p_substitute_id IS NOT NULL THEN
    SELECT player_id, guest_player_id INTO v_to_profile, v_to_guest
      FROM public.round_robin_players WHERE id = p_substitute_id;
  END IF;

  IF p_action = 'replace' THEN
    IF p_substitute_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'code', 'substitute_required',
        'message', 'p_substitute is required for action=replace');
    END IF;

    FOR r IN
      SELECT id, round_no, court_no
        FROM public.round_robin_schedule
       WHERE event_id = p_event_id
         AND round_no >= COALESCE(p_effective_round, v_current_round)
         AND locked_at IS NULL
         AND voided_at IS NULL
         AND superseded_by_schedule_id IS NULL
         AND is_bye = false
         AND (
              (v_from_profile IS NOT NULL AND (a1_player_id = v_from_profile OR a2_player_id = v_from_profile
                                            OR b1_player_id = v_from_profile OR b2_player_id = v_from_profile))
           OR (v_from_guest IS NOT NULL AND (a1_guest_id = v_from_guest OR a2_guest_id = v_from_guest
                                            OR b1_guest_id = v_from_guest OR b2_guest_id = v_from_guest))
         )
       ORDER BY round_no, court_no
    LOOP
      v_plan := v_plan || jsonb_build_object(
        'schedule_id', r.id, 'round_no', r.round_no, 'court_no', r.court_no,
        'op', 'swap_identity',
        'from_profile_id', v_from_profile, 'from_guest_id', v_from_guest,
        'to_profile_id', v_to_profile,     'to_guest_id',   v_to_guest
      );
    END LOOP;

    RETURN jsonb_build_object('ok', true, 'plan', v_plan, 'fairness_triggers', to_jsonb(v_triggers));
  END IF;

  IF p_action IN ('withdraw','injure','remove') THEN
    FOR r IN
      SELECT id, round_no, court_no,
             a1_player_id, a2_player_id, b1_player_id, b2_player_id,
             a1_guest_id,  a2_guest_id,  b1_guest_id,  b2_guest_id
        FROM public.round_robin_schedule
       WHERE event_id = p_event_id
         AND round_no >= COALESCE(p_effective_round, v_current_round)
         AND locked_at IS NULL
         AND voided_at IS NULL
         AND superseded_by_schedule_id IS NULL
         AND is_bye = false
         AND (
              (v_from_profile IS NOT NULL AND (a1_player_id = v_from_profile OR a2_player_id = v_from_profile
                                            OR b1_player_id = v_from_profile OR b2_player_id = v_from_profile))
           OR (v_from_guest IS NOT NULL AND (a1_guest_id = v_from_guest OR a2_guest_id = v_from_guest
                                            OR b1_guest_id = v_from_guest OR b2_guest_id = v_from_guest))
         )
       ORDER BY round_no, court_no
    LOOP
      SELECT rp.id AS participant_id, rp.player_id AS to_profile, rp.guest_player_id AS to_guest
        INTO v_bye_row
        FROM public.round_robin_players rp
       WHERE rp.event_id = p_event_id
         AND rp.status = 'active'
         AND rp.id <> p_participant_id
         AND COALESCE(rp.player_id, rp.guest_player_id) NOT IN (
             COALESCE(r.a1_player_id, r.a1_guest_id, '00000000-0000-0000-0000-000000000000'::uuid),
             COALESCE(r.a2_player_id, r.a2_guest_id, '00000000-0000-0000-0000-000000000000'::uuid),
             COALESCE(r.b1_player_id, r.b1_guest_id, '00000000-0000-0000-0000-000000000000'::uuid),
             COALESCE(r.b2_player_id, r.b2_guest_id, '00000000-0000-0000-0000-000000000000'::uuid)
         )
         AND NOT EXISTS (
             SELECT 1 FROM public.round_robin_schedule s2
              WHERE s2.event_id = p_event_id
                AND s2.round_no = r.round_no
                AND s2.voided_at IS NULL
                AND s2.superseded_by_schedule_id IS NULL
                AND s2.is_bye = false
                AND (
                     (rp.player_id IS NOT NULL AND (s2.a1_player_id = rp.player_id OR s2.a2_player_id = rp.player_id
                                                 OR s2.b1_player_id = rp.player_id OR s2.b2_player_id = rp.player_id))
                  OR (rp.guest_player_id IS NOT NULL AND (s2.a1_guest_id = rp.guest_player_id OR s2.a2_guest_id = rp.guest_player_id
                                                 OR s2.b1_guest_id = rp.guest_player_id OR s2.b2_guest_id = rp.guest_player_id))
                )
         )
       ORDER BY rp.id
       LIMIT 1;

      IF v_bye_row.participant_id IS NULL THEN
        v_triggers := v_triggers || 'no_local_substitute_available';
        RETURN jsonb_build_object(
          'ok', false, 'code', 'reoptimization_required',
          'message', 'A valid local repair is not sufficient. Full remaining-schedule optimization is required.',
          'retryable', false, 'fairness_triggers', to_jsonb(v_triggers)
        );
      END IF;

      v_plan := v_plan || jsonb_build_object(
        'schedule_id', r.id, 'round_no', r.round_no, 'court_no', r.court_no,
        'op', 'swap_identity',
        'from_profile_id', v_from_profile, 'from_guest_id', v_from_guest,
        'to_profile_id', v_bye_row.to_profile, 'to_guest_id', v_bye_row.to_guest
      );
    END LOOP;

    RETURN jsonb_build_object('ok', true, 'plan', v_plan, 'fairness_triggers', to_jsonb(v_triggers));
  END IF;

  IF p_action = 'restore' THEN
    RETURN jsonb_build_object('ok', true, 'plan', '[]'::jsonb, 'fairness_triggers', to_jsonb(v_triggers));
  END IF;

  RETURN jsonb_build_object('ok', false, 'code', 'invalid_action', 'message', 'Unknown action: ' || p_action);
END;
$$;

REVOKE ALL ON FUNCTION public.rr_plan_participant_change(uuid, uuid, text, uuid, integer) FROM PUBLIC;

-- Replace the RPC's swap loop to use swap_identity ops and rewrite active-match restart.
CREATE OR REPLACE FUNCTION public.rr_manage_participant(
  p_request_id               uuid,
  p_event_id                 uuid,
  p_player_id                uuid,
  p_action                   text,
  p_reason                   text DEFAULT NULL,
  p_expected_version         integer DEFAULT NULL,
  p_regen_mode               text DEFAULT 'auto',
  p_preview_only             boolean DEFAULT false,
  p_substitute               jsonb DEFAULT NULL,
  p_active_match_resolution  jsonb DEFAULT NULL,
  p_effective_round          integer DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_actor          uuid := auth.uid();
  v_event          public.round_robin_events%ROWTYPE;
  v_participant    public.round_robin_players%ROWTYPE;
  v_input_hash     text;
  v_existing       public.rr_participant_mutation_requests%ROWTYPE;
  v_plan_result    jsonb;
  v_plan_ops       jsonb;
  v_op             jsonb;
  v_substitute_id  uuid;
  v_sub_profile    uuid;
  v_sub_guest      uuid;
  v_active_match   public.round_robin_schedule%ROWTYPE;
  v_resolution     text;
  v_response       jsonb;
  v_new_version    integer;
  v_is_organizer   boolean;
  v_from_profile   uuid;
  v_from_guest     uuid;
  v_new_row_id     uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501',
      DETAIL = jsonb_build_object('code', 'not_authenticated')::text;
  END IF;

  IF p_request_id IS NULL OR p_event_id IS NULL OR p_player_id IS NULL OR p_action IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023',
      DETAIL = jsonb_build_object('code', 'invalid_input')::text;
  END IF;

  IF p_action NOT IN ('withdraw','injure','remove','replace','restore') THEN
    RAISE EXCEPTION 'invalid_action' USING ERRCODE = '22023',
      DETAIL = jsonb_build_object('code', 'invalid_action', 'message', 'Unknown action: ' || p_action)::text;
  END IF;

  IF p_regen_mode NOT IN ('minimal','reoptimize','auto') THEN
    RAISE EXCEPTION 'invalid_regen_mode' USING ERRCODE = '22023',
      DETAIL = jsonb_build_object('code', 'invalid_regen_mode')::text;
  END IF;

  v_input_hash := encode(public.digest(
    jsonb_build_object('event', p_event_id, 'player', p_player_id, 'action', p_action,
      'reason', p_reason, 'expected', p_expected_version, 'regen', p_regen_mode,
      'preview', p_preview_only, 'sub', p_substitute, 'active', p_active_match_resolution,
      'eff', p_effective_round)::text, 'sha256'), 'hex');

  SELECT * INTO v_existing FROM public.rr_participant_mutation_requests WHERE request_id = p_request_id;
  IF FOUND THEN
    IF v_existing.input_hash <> v_input_hash THEN
      RAISE EXCEPTION 'idempotency_conflict' USING ERRCODE = '22023',
        DETAIL = jsonb_build_object('code', 'idempotency_conflict')::text;
    END IF;
    IF v_existing.status IN ('completed', 'preview_completed') THEN
      RETURN v_existing.response;
    END IF;
    IF v_existing.status = 'in_progress' THEN
      RAISE EXCEPTION 'request_in_progress' USING ERRCODE = '55P03',
        DETAIL = jsonb_build_object('code', 'request_in_progress')::text;
    END IF;
  ELSE
    INSERT INTO public.rr_participant_mutation_requests(request_id, event_id, actor_id, action, input_hash, status)
      VALUES (p_request_id, p_event_id, v_actor, p_action, v_input_hash, 'in_progress');
  END IF;

  SELECT * INTO v_event FROM public.round_robin_events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'event_not_found' USING ERRCODE = 'P0002',
      DETAIL = jsonb_build_object('code', 'event_not_found')::text;
  END IF;

  IF v_event.status = 'completed' OR v_event.voided = true THEN
    RAISE EXCEPTION 'event_not_mutable' USING ERRCODE = '22023',
      DETAIL = jsonb_build_object('code', 'event_not_mutable')::text;
  END IF;

  v_is_organizer := (v_event.organizer_id = v_actor) OR public.has_role(v_actor, 'admin');
  IF NOT v_is_organizer THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501',
      DETAIL = jsonb_build_object('code', 'not_authorized')::text;
  END IF;

  IF p_expected_version IS NOT NULL AND p_expected_version <> v_event.schedule_version THEN
    RAISE EXCEPTION 'stale_version' USING ERRCODE = '40001',
      DETAIL = jsonb_build_object('code', 'stale_version',
        'expected', p_expected_version, 'current', v_event.schedule_version)::text;
  END IF;

  SELECT * INTO v_participant FROM public.round_robin_players
   WHERE id = p_player_id AND event_id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'participant_not_found' USING ERRCODE = 'P0002',
      DETAIL = jsonb_build_object('code', 'participant_not_found')::text;
  END IF;

  v_from_profile := v_participant.player_id;
  v_from_guest   := v_participant.guest_player_id;

  IF p_action = 'restore' THEN
    IF v_participant.status = 'active' THEN
      RAISE EXCEPTION 'invalid_state_transition' USING ERRCODE = '22023',
        DETAIL = jsonb_build_object('code', 'invalid_state_transition')::text;
    END IF;
  ELSIF v_participant.status <> 'active' THEN
    RAISE EXCEPTION 'invalid_state_transition' USING ERRCODE = '22023',
      DETAIL = jsonb_build_object('code', 'invalid_state_transition',
        'current_status', v_participant.status)::text;
  END IF;

  IF p_action = 'replace' THEN
    v_substitute_id := NULLIF(p_substitute ->> 'participant_id', '')::uuid;
    IF v_substitute_id IS NULL THEN
      RAISE EXCEPTION 'substitute_required' USING ERRCODE = '22023',
        DETAIL = jsonb_build_object('code', 'substitute_required')::text;
    END IF;
    IF v_substitute_id = p_player_id THEN
      RAISE EXCEPTION 'substitute_invalid' USING ERRCODE = '22023',
        DETAIL = jsonb_build_object('code', 'substitute_invalid')::text;
    END IF;
    SELECT player_id, guest_player_id INTO v_sub_profile, v_sub_guest
      FROM public.round_robin_players
     WHERE id = v_substitute_id AND event_id = p_event_id AND status = 'active';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'substitute_not_eligible' USING ERRCODE = '22023',
        DETAIL = jsonb_build_object('code', 'substitute_not_eligible')::text;
    END IF;
  END IF;

  SELECT * INTO v_active_match FROM public.round_robin_schedule
   WHERE event_id = p_event_id
     AND round_no = COALESCE(v_event.current_round, 1)
     AND voided_at IS NULL AND superseded_by_schedule_id IS NULL AND is_bye = false
     AND (
          (v_from_profile IS NOT NULL AND (a1_player_id = v_from_profile OR a2_player_id = v_from_profile
                                        OR b1_player_id = v_from_profile OR b2_player_id = v_from_profile))
       OR (v_from_guest IS NOT NULL AND (a1_guest_id = v_from_guest OR a2_guest_id = v_from_guest
                                        OR b1_guest_id = v_from_guest OR b2_guest_id = v_from_guest))
     )
   LIMIT 1;

  IF FOUND AND p_action IN ('withdraw','injure','remove') THEN
    v_resolution := NULLIF(p_active_match_resolution ->> 'kind', '');
    IF v_resolution IS NULL THEN
      RAISE EXCEPTION 'active_match_resolution_required' USING ERRCODE = '22023',
        DETAIL = jsonb_build_object('code', 'active_match_resolution_required',
          'active_match_id', v_active_match.id)::text;
    END IF;
    IF v_resolution NOT IN ('finish_and_record','restart_with_substitute','abandon') THEN
      RAISE EXCEPTION 'invalid_active_match_resolution' USING ERRCODE = '22023',
        DETAIL = jsonb_build_object('code', 'invalid_active_match_resolution')::text;
    END IF;
    IF v_resolution = 'finish_and_record'
       AND (v_active_match.team1_score IS NULL OR v_active_match.team2_score IS NULL) THEN
      RAISE EXCEPTION 'final_score_required' USING ERRCODE = '22023',
        DETAIL = jsonb_build_object('code', 'final_score_required')::text;
    END IF;
    IF v_resolution = 'restart_with_substitute' AND v_sub_profile IS NULL AND v_sub_guest IS NULL THEN
      RAISE EXCEPTION 'substitute_required' USING ERRCODE = '22023',
        DETAIL = jsonb_build_object('code', 'substitute_required',
          'message', 'restart_with_substitute requires p_substitute')::text;
    END IF;
  END IF;

  IF p_regen_mode = 'reoptimize' THEN
    v_plan_result := jsonb_build_object('ok', false, 'code', 'reoptimization_required',
      'message', 'A valid local repair is not sufficient. Full remaining-schedule optimization is required.',
      'retryable', false, 'fairness_triggers', jsonb_build_array());
  ELSE
    v_plan_result := public.rr_plan_participant_change(
      p_event_id, p_player_id, p_action, v_substitute_id, p_effective_round);
    IF (v_plan_result ->> 'ok')::boolean = false
       AND p_regen_mode = 'minimal'
       AND (v_plan_result ->> 'code') = 'reoptimization_required' THEN
      v_plan_result := jsonb_set(v_plan_result, '{code}', '"minimal_regen_not_possible"'::jsonb);
    END IF;
  END IF;

  IF p_preview_only THEN
    v_response := jsonb_build_object('preview', true,
      'schedule_version', v_event.schedule_version, 'plan', v_plan_result,
      'active_match_id', v_active_match.id);
    UPDATE public.rr_participant_mutation_requests
       SET status = 'preview_completed', response = v_response,
           schedule_version_before = v_event.schedule_version, completed_at = now()
     WHERE request_id = p_request_id;
    RETURN v_response;
  END IF;

  IF (v_plan_result ->> 'ok')::boolean = false THEN
    UPDATE public.rr_participant_mutation_requests
       SET status = 'failed', response = v_plan_result,
           error_code = v_plan_result ->> 'code', completed_at = now()
     WHERE request_id = p_request_id;
    RAISE EXCEPTION 'planner_failed' USING ERRCODE = '22023', DETAIL = v_plan_result::text;
  END IF;

  -- Active-match resolution
  IF v_active_match.id IS NOT NULL AND p_action IN ('withdraw','injure','remove') THEN
    IF v_resolution = 'finish_and_record' THEN
      UPDATE public.round_robin_schedule SET locked_at = COALESCE(locked_at, now())
       WHERE id = v_active_match.id;
    ELSIF v_resolution = 'abandon' THEN
      UPDATE public.round_robin_schedule
         SET voided_at = now(), voided_reason = COALESCE(p_reason, 'participant_' || p_action),
             abandoned = true, abandoned_at = now(), abandoned_reason = COALESCE(p_reason, 'participant_' || p_action)
       WHERE id = v_active_match.id;
    ELSIF v_resolution = 'restart_with_substitute' THEN
      UPDATE public.round_robin_schedule
         SET voided_at = now(), voided_reason = COALESCE(p_reason, 'restart_with_substitute'),
             abandoned = true, abandoned_at = now()
       WHERE id = v_active_match.id;

      INSERT INTO public.round_robin_schedule (
        event_id, round_no, court_no, is_bye,
        a1_player_id, a2_player_id, b1_player_id, b2_player_id,
        a1_guest_id,  a2_guest_id,  b1_guest_id,  b2_guest_id,
        supersedes_schedule_id
      ) VALUES (
        v_active_match.event_id, v_active_match.round_no, v_active_match.court_no, false,
        CASE WHEN v_active_match.a1_player_id = v_from_profile THEN v_sub_profile ELSE v_active_match.a1_player_id END,
        CASE WHEN v_active_match.a2_player_id = v_from_profile THEN v_sub_profile ELSE v_active_match.a2_player_id END,
        CASE WHEN v_active_match.b1_player_id = v_from_profile THEN v_sub_profile ELSE v_active_match.b1_player_id END,
        CASE WHEN v_active_match.b2_player_id = v_from_profile THEN v_sub_profile ELSE v_active_match.b2_player_id END,
        CASE WHEN v_active_match.a1_guest_id  = v_from_guest   THEN v_sub_guest   ELSE v_active_match.a1_guest_id   END,
        CASE WHEN v_active_match.a2_guest_id  = v_from_guest   THEN v_sub_guest   ELSE v_active_match.a2_guest_id   END,
        CASE WHEN v_active_match.b1_guest_id  = v_from_guest   THEN v_sub_guest   ELSE v_active_match.b1_guest_id   END,
        CASE WHEN v_active_match.b2_guest_id  = v_from_guest   THEN v_sub_guest   ELSE v_active_match.b2_guest_id   END,
        v_active_match.id
      ) RETURNING id INTO v_new_row_id;

      UPDATE public.round_robin_schedule
         SET superseded_by_schedule_id = v_new_row_id
       WHERE id = v_active_match.id;
    END IF;
  END IF;

  -- Apply planned swap_identity ops
  v_plan_ops := v_plan_result -> 'plan';
  IF v_plan_ops IS NOT NULL THEN
    FOR v_op IN SELECT * FROM jsonb_array_elements(v_plan_ops)
    LOOP
      IF (v_op ->> 'op') = 'swap_identity' THEN
        UPDATE public.round_robin_schedule
           SET a1_player_id = CASE WHEN (v_op ->> 'from_profile_id') IS NOT NULL
                                    AND a1_player_id = (v_op ->> 'from_profile_id')::uuid
                                   THEN NULLIF(v_op ->> 'to_profile_id','')::uuid ELSE a1_player_id END,
               a2_player_id = CASE WHEN (v_op ->> 'from_profile_id') IS NOT NULL
                                    AND a2_player_id = (v_op ->> 'from_profile_id')::uuid
                                   THEN NULLIF(v_op ->> 'to_profile_id','')::uuid ELSE a2_player_id END,
               b1_player_id = CASE WHEN (v_op ->> 'from_profile_id') IS NOT NULL
                                    AND b1_player_id = (v_op ->> 'from_profile_id')::uuid
                                   THEN NULLIF(v_op ->> 'to_profile_id','')::uuid ELSE b1_player_id END,
               b2_player_id = CASE WHEN (v_op ->> 'from_profile_id') IS NOT NULL
                                    AND b2_player_id = (v_op ->> 'from_profile_id')::uuid
                                   THEN NULLIF(v_op ->> 'to_profile_id','')::uuid ELSE b2_player_id END,
               a1_guest_id  = CASE WHEN (v_op ->> 'from_guest_id') IS NOT NULL
                                    AND a1_guest_id  = (v_op ->> 'from_guest_id')::uuid
                                   THEN NULLIF(v_op ->> 'to_guest_id','')::uuid ELSE a1_guest_id END,
               a2_guest_id  = CASE WHEN (v_op ->> 'from_guest_id') IS NOT NULL
                                    AND a2_guest_id  = (v_op ->> 'from_guest_id')::uuid
                                   THEN NULLIF(v_op ->> 'to_guest_id','')::uuid ELSE a2_guest_id END,
               b1_guest_id  = CASE WHEN (v_op ->> 'from_guest_id') IS NOT NULL
                                    AND b1_guest_id  = (v_op ->> 'from_guest_id')::uuid
                                   THEN NULLIF(v_op ->> 'to_guest_id','')::uuid ELSE b1_guest_id END,
               b2_guest_id  = CASE WHEN (v_op ->> 'from_guest_id') IS NOT NULL
                                    AND b2_guest_id  = (v_op ->> 'from_guest_id')::uuid
                                   THEN NULLIF(v_op ->> 'to_guest_id','')::uuid ELSE b2_guest_id END
         WHERE id = (v_op ->> 'schedule_id')::uuid
           AND locked_at IS NULL AND voided_at IS NULL AND superseded_by_schedule_id IS NULL;
      END IF;
    END LOOP;
  END IF;

  -- Update participant lifecycle state
  IF p_action IN ('withdraw','injure','remove') THEN
    UPDATE public.round_robin_players
       SET status = CASE p_action WHEN 'withdraw' THEN 'withdrawn'::rr_participant_status
                                  WHEN 'injure'   THEN 'injured'::rr_participant_status
                                  WHEN 'remove'   THEN 'removed'::rr_participant_status END,
           withdrawn_at = now(), withdrawal_reason = p_reason,
           effective_round = COALESCE(p_effective_round, v_event.current_round),
           updated_by = v_actor, updated_at = now()
     WHERE id = p_player_id;
  ELSIF p_action = 'replace' THEN
    UPDATE public.round_robin_players
       SET status = 'replaced', withdrawn_at = now(), withdrawal_reason = p_reason,
           effective_round = COALESCE(p_effective_round, v_event.current_round),
           replacement_participant_id = v_substitute_id,
           updated_by = v_actor, updated_at = now()
     WHERE id = p_player_id;
    UPDATE public.round_robin_players
       SET replaced_participant_id = p_player_id, updated_by = v_actor, updated_at = now()
     WHERE id = v_substitute_id;
  ELSIF p_action = 'restore' THEN
    UPDATE public.round_robin_players
       SET status = 'active', withdrawn_at = NULL, withdrawal_reason = NULL,
           effective_round = NULL, updated_by = v_actor, updated_at = now()
     WHERE id = p_player_id;
  END IF;

  v_new_version := v_event.schedule_version + 1;
  UPDATE public.round_robin_events SET schedule_version = v_new_version, updated_at = now()
   WHERE id = p_event_id;

  INSERT INTO public.round_robin_audit (event_id, actor_id, change_type, target_player_id, notes, metadata)
  VALUES (p_event_id, v_actor, 'participant_' || p_action, p_player_id, p_reason,
    jsonb_build_object('request_id', p_request_id,
      'schedule_version_before', v_event.schedule_version,
      'schedule_version_after', v_new_version,
      'plan', v_plan_result, 'active_match_id', v_active_match.id,
      'active_match_resolution', v_resolution,
      'substitute_participant_id', v_substitute_id,
      'effective_round', COALESCE(p_effective_round, v_event.current_round)));

  v_response := jsonb_build_object('preview', false,
    'schedule_version', v_new_version, 'plan', v_plan_result,
    'active_match_id', v_active_match.id, 'active_match_resolution', v_resolution);

  UPDATE public.rr_participant_mutation_requests
     SET status = 'completed', response = v_response,
         schedule_version_before = v_event.schedule_version,
         schedule_version_after  = v_new_version, completed_at = now()
   WHERE request_id = p_request_id;

  RETURN v_response;

EXCEPTION WHEN OTHERS THEN
  UPDATE public.rr_participant_mutation_requests
     SET status = 'failed', error_code = SQLERRM, completed_at = now()
   WHERE request_id = p_request_id AND status = 'in_progress';
  RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.rr_manage_participant(uuid, uuid, uuid, text, text, integer, text, boolean, jsonb, jsonb, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rr_manage_participant(uuid, uuid, uuid, text, text, integer, text, boolean, jsonb, jsonb, integer) TO authenticated;
