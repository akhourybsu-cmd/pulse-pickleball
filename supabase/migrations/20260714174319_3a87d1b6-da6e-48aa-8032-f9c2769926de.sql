
-- Same body as prior migration but with correct qualification:
--   * built-ins (now, coalesce, length, lower, btrim, nullif, to_jsonb,
--     jsonb_build_object, jsonb_build_array, jsonb_array_elements,
--     jsonb_set, encode) are unqualified (they live in pg_catalog which is
--     the only entry on search_path)
--   * digest is qualified as extensions.digest (pgcrypto is in extensions)
DROP FUNCTION IF EXISTS public.rr_manage_participant(
  uuid, uuid, uuid, text, text, integer, text, boolean, jsonb, jsonb);

CREATE FUNCTION public.rr_manage_participant(
  p_request_id               uuid,
  p_event_id                 uuid,
  p_player_id                uuid,
  p_action                   text,
  p_reason                   text DEFAULT NULL,
  p_expected_version         integer DEFAULT NULL,
  p_regen_mode               text DEFAULT 'auto',
  p_preview_only             boolean DEFAULT false,
  p_substitute               jsonb DEFAULT NULL,
  p_active_match_resolution  jsonb DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_actor            uuid := auth.uid();
  v_event            public.round_robin_events%ROWTYPE;
  v_participant      public.round_robin_players%ROWTYPE;
  v_input_hash       text;
  v_existing         public.rr_participant_mutation_requests%ROWTYPE;
  v_plan_result      jsonb;
  v_plan_ops         jsonb;
  v_op               jsonb;
  v_substitute_id    uuid;
  v_sub_profile      uuid;
  v_sub_guest        uuid;
  v_sub_is_guest     boolean := false;
  v_active_match     public.round_robin_schedule%ROWTYPE;
  v_active_matches   integer;
  v_resolution       text;
  v_response         jsonb;
  v_new_version      integer;
  v_is_organizer     boolean;
  v_from_profile     uuid;
  v_from_guest       uuid;
  v_new_row_id       uuid;
  v_effective_round  integer;
  v_replacement_row  public.round_robin_players%ROWTYPE;
  v_future_rounds    integer;
  v_rating_before    boolean;
  v_rating_after     boolean;
  v_rating_flip      boolean := false;
  v_before_row       jsonb;
  v_after_row        jsonb;
  v_guest_name       text;
  v_guest_gender     text;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501',
      DETAIL = jsonb_build_object('code','not_authenticated','retryable',false)::text;
  END IF;

  IF p_request_id IS NULL OR p_event_id IS NULL OR p_player_id IS NULL OR p_action IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023',
      DETAIL = jsonb_build_object('code','invalid_input','retryable',false)::text;
  END IF;

  IF p_action NOT IN ('withdraw','injure','remove','replace','restore') THEN
    RAISE EXCEPTION 'invalid_action' USING ERRCODE = '22023',
      DETAIL = jsonb_build_object('code','invalid_action','retryable',false)::text;
  END IF;

  IF p_regen_mode NOT IN ('minimal','reoptimize','auto') THEN
    RAISE EXCEPTION 'invalid_regen_mode' USING ERRCODE = '22023',
      DETAIL = jsonb_build_object('code','invalid_regen_mode','retryable',false)::text;
  END IF;

  v_input_hash := encode(extensions.digest(
    jsonb_build_object('event',p_event_id,'player',p_player_id,'action',p_action,
      'reason',p_reason,'expected',p_expected_version,'regen',p_regen_mode,
      'preview',p_preview_only,'sub',p_substitute,'active',p_active_match_resolution
    )::text, 'sha256'), 'hex');

  IF NOT p_preview_only THEN
    SELECT * INTO v_existing FROM public.rr_participant_mutation_requests
      WHERE request_id = p_request_id;
    IF FOUND THEN
      IF v_existing.input_hash <> v_input_hash THEN
        RAISE EXCEPTION 'idempotency_conflict' USING ERRCODE = '22023',
          DETAIL = jsonb_build_object('code','idempotency_conflict','retryable',false)::text;
      END IF;
      IF v_existing.status = 'completed' THEN
        RETURN v_existing.response;
      END IF;
      IF v_existing.status = 'in_progress' THEN
        RAISE EXCEPTION 'request_in_progress' USING ERRCODE = '55P03',
          DETAIL = jsonb_build_object('code','request_in_progress','retryable',true)::text;
      END IF;
    ELSE
      INSERT INTO public.rr_participant_mutation_requests(
        request_id, event_id, actor_id, action, input_hash, status)
        VALUES (p_request_id, p_event_id, v_actor, p_action, v_input_hash, 'in_progress');
    END IF;
  END IF;

  IF p_preview_only THEN
    SELECT * INTO v_event FROM public.round_robin_events WHERE id = p_event_id;
  ELSE
    SELECT * INTO v_event FROM public.round_robin_events WHERE id = p_event_id FOR UPDATE;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'event_not_found' USING ERRCODE = 'P0002',
      DETAIL = jsonb_build_object('code','event_not_found','retryable',false)::text;
  END IF;

  IF v_event.status = 'completed' OR v_event.voided = true THEN
    RAISE EXCEPTION 'event_not_mutable' USING ERRCODE = '22023',
      DETAIL = jsonb_build_object('code','event_not_mutable','retryable',false)::text;
  END IF;

  v_is_organizer := (v_event.organizer_id = v_actor) OR public.has_role(v_actor, 'admin');
  IF NOT v_is_organizer THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501',
      DETAIL = jsonb_build_object('code','not_authorized','retryable',false)::text;
  END IF;

  IF p_expected_version IS NOT NULL AND p_expected_version <> v_event.schedule_version THEN
    RAISE EXCEPTION 'stale_version' USING ERRCODE = '40001',
      DETAIL = jsonb_build_object('code','stale_version','retryable',true,
        'expected',p_expected_version,'current',v_event.schedule_version)::text;
  END IF;

  IF p_preview_only THEN
    SELECT * INTO v_participant FROM public.round_robin_players
     WHERE id = p_player_id AND event_id = p_event_id;
  ELSE
    SELECT * INTO v_participant FROM public.round_robin_players
     WHERE id = p_player_id AND event_id = p_event_id FOR UPDATE;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'participant_not_found' USING ERRCODE = 'P0002',
      DETAIL = jsonb_build_object('code','participant_not_found','retryable',false)::text;
  END IF;

  v_from_profile := v_participant.player_id;
  v_from_guest   := v_participant.guest_player_id;

  IF p_action = 'restore' THEN
    IF v_participant.status = 'active' THEN
      RAISE EXCEPTION 'invalid_state_transition' USING ERRCODE = '22023',
        DETAIL = jsonb_build_object('code','invalid_state_transition','retryable',false,
          'reason','already_active')::text;
    END IF;
    IF v_participant.status IN ('removed','replaced') THEN
      RAISE EXCEPTION 'invalid_state_transition' USING ERRCODE = '22023',
        DETAIL = jsonb_build_object('code','invalid_state_transition','retryable',false,
          'reason','terminal_state','current_status', v_participant.status::text)::text;
    END IF;
    IF v_from_profile IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.round_robin_players
       WHERE event_id = p_event_id AND player_id = v_from_profile
         AND id <> p_player_id AND status = 'active'
    ) THEN
      RAISE EXCEPTION 'duplicate_participant_identity' USING ERRCODE = '22023',
        DETAIL = jsonb_build_object('code','duplicate_participant_identity','retryable',false,
          'reason','identity_already_active','identity_kind','profile')::text;
    END IF;
    IF v_participant.replacement_participant_id IS NOT NULL THEN
      SELECT * INTO v_replacement_row FROM public.round_robin_players
       WHERE id = v_participant.replacement_participant_id;
      IF FOUND AND v_replacement_row.status = 'active' THEN
        RAISE EXCEPTION 'restore_replacement_conflict' USING ERRCODE = '22023',
          DETAIL = jsonb_build_object('code','restore_replacement_conflict','retryable',false,
            'replacement_participant_id', v_replacement_row.id)::text;
      END IF;
    END IF;
  ELSIF v_participant.status <> 'active' THEN
    RAISE EXCEPTION 'invalid_state_transition' USING ERRCODE = '22023',
      DETAIL = jsonb_build_object('code','invalid_state_transition','retryable',false,
        'current_status', v_participant.status::text)::text;
  END IF;

  IF p_action = 'replace' THEN
    v_substitute_id := nullif(p_substitute ->> 'participant_id', '')::uuid;
    IF v_substitute_id IS NULL THEN
      RAISE EXCEPTION 'substitute_required' USING ERRCODE = '22023',
        DETAIL = jsonb_build_object('code','substitute_required','retryable',false)::text;
    END IF;
    IF v_substitute_id = p_player_id THEN
      RAISE EXCEPTION 'substitute_invalid' USING ERRCODE = '22023',
        DETAIL = jsonb_build_object('code','substitute_invalid','retryable',false,
          'reason','self_substitution')::text;
    END IF;

    IF (p_substitute ? 'guest') AND (nullif(p_substitute ->> 'user_id','') IS NOT NULL) THEN
      RAISE EXCEPTION 'substitute_payload_conflict' USING ERRCODE = '22023',
        DETAIL = jsonb_build_object('code','substitute_payload_conflict','retryable',false,
          'reason','guest_and_user_id_both_provided')::text;
    END IF;

    IF p_substitute ? 'guest' THEN
      v_guest_name := btrim(coalesce(p_substitute -> 'guest' ->> 'display_name', ''));
      IF v_guest_name = '' THEN
        RAISE EXCEPTION 'guest_name_required' USING ERRCODE = '22023',
          DETAIL = jsonb_build_object('code','guest_name_required','retryable',false)::text;
      END IF;
      IF length(v_guest_name) > 80 THEN
        RAISE EXCEPTION 'guest_name_too_long' USING ERRCODE = '22023',
          DETAIL = jsonb_build_object('code','guest_name_too_long','retryable',false,
            'max_length',80)::text;
      END IF;
      v_guest_gender := nullif(p_substitute -> 'guest' ->> 'gender','');
      IF v_guest_gender IS NOT NULL
         AND v_guest_gender NOT IN ('male','female','other','prefer_not_to_say') THEN
        RAISE EXCEPTION 'guest_gender_invalid' USING ERRCODE = '22023',
          DETAIL = jsonb_build_object('code','guest_gender_invalid','retryable',false)::text;
      END IF;
      IF coalesce((p_substitute ->> 'confirm_duplicate_guest')::boolean, false) IS NOT TRUE
         AND EXISTS (
           SELECT 1 FROM public.round_robin_players rp
             JOIN public.guest_players gp ON gp.id = rp.guest_player_id
            WHERE rp.event_id = p_event_id
              AND lower(btrim(gp.display_name)) = lower(v_guest_name)
         ) THEN
        RAISE EXCEPTION 'duplicate_guest_requires_confirmation' USING ERRCODE = '22023',
          DETAIL = jsonb_build_object('code','duplicate_guest_requires_confirmation','retryable',false,
            'normalized_name', v_guest_name)::text;
      END IF;
    END IF;

    SELECT player_id, guest_player_id INTO v_sub_profile, v_sub_guest
      FROM public.round_robin_players
     WHERE id = v_substitute_id AND event_id = p_event_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'substitute_not_eligible' USING ERRCODE = '22023',
        DETAIL = jsonb_build_object('code','substitute_not_eligible','retryable',false)::text;
    END IF;

    v_sub_is_guest := (v_sub_guest IS NOT NULL);

    IF v_sub_profile IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.round_robin_players
       WHERE event_id = p_event_id AND player_id = v_sub_profile
         AND id <> v_substitute_id
    ) THEN
      RAISE EXCEPTION 'duplicate_participant_identity' USING ERRCODE = '22023',
        DETAIL = jsonb_build_object('code','duplicate_participant_identity','retryable',false,
          'identity_kind','profile','identity_id', v_sub_profile)::text;
    END IF;
  END IF;

  SELECT count(*) INTO v_active_matches FROM public.round_robin_schedule
   WHERE event_id = p_event_id
     AND round_no = coalesce(v_event.current_round, 1)
     AND voided_at IS NULL AND superseded_by_schedule_id IS NULL AND is_bye = false
     AND (
          (v_from_profile IS NOT NULL AND (a1_player_id = v_from_profile OR a2_player_id = v_from_profile
                                        OR b1_player_id = v_from_profile OR b2_player_id = v_from_profile))
       OR (v_from_guest IS NOT NULL AND (a1_guest_id = v_from_guest OR a2_guest_id = v_from_guest
                                        OR b1_guest_id = v_from_guest OR b2_guest_id = v_from_guest))
     );

  IF v_active_matches > 1 THEN
    RAISE EXCEPTION 'multiple_active_matches' USING ERRCODE = '22023',
      DETAIL = jsonb_build_object('code','multiple_active_matches','retryable',false,
        'count', v_active_matches)::text;
  END IF;

  SELECT * INTO v_active_match FROM public.round_robin_schedule
   WHERE event_id = p_event_id
     AND round_no = coalesce(v_event.current_round, 1)
     AND voided_at IS NULL AND superseded_by_schedule_id IS NULL AND is_bye = false
     AND (
          (v_from_profile IS NOT NULL AND (a1_player_id = v_from_profile OR a2_player_id = v_from_profile
                                        OR b1_player_id = v_from_profile OR b2_player_id = v_from_profile))
       OR (v_from_guest IS NOT NULL AND (a1_guest_id = v_from_guest OR a2_guest_id = v_from_guest
                                        OR b1_guest_id = v_from_guest OR b2_guest_id = v_from_guest))
     )
   LIMIT 1;

  IF FOUND AND p_action IN ('withdraw','injure','remove') THEN
    v_resolution := nullif(p_active_match_resolution ->> 'kind', '');
    IF v_resolution IS NULL THEN
      RAISE EXCEPTION 'active_match_resolution_required' USING ERRCODE = '22023',
        DETAIL = jsonb_build_object('code','active_match_resolution_required','retryable',false,
          'active_match_id', v_active_match.id)::text;
    END IF;
    IF v_resolution NOT IN ('finish_and_record','restart_with_substitute','abandon') THEN
      RAISE EXCEPTION 'invalid_active_match_resolution' USING ERRCODE = '22023',
        DETAIL = jsonb_build_object('code','invalid_active_match_resolution','retryable',false)::text;
    END IF;
    IF v_resolution = 'finish_and_record'
       AND (v_active_match.team1_score IS NULL OR v_active_match.team2_score IS NULL) THEN
      RAISE EXCEPTION 'final_score_required' USING ERRCODE = '22023',
        DETAIL = jsonb_build_object('code','final_score_required','retryable',false)::text;
    END IF;
    IF v_resolution = 'restart_with_substitute' AND v_sub_profile IS NULL AND v_sub_guest IS NULL THEN
      RAISE EXCEPTION 'substitute_required' USING ERRCODE = '22023',
        DETAIL = jsonb_build_object('code','substitute_required','retryable',false,
          'message','restart_with_substitute requires p_substitute')::text;
    END IF;
  END IF;

  IF p_regen_mode = 'reoptimize' THEN
    v_plan_result := jsonb_build_object('ok', false, 'code','reoptimization_required',
      'retryable', false, 'fairness_triggers', jsonb_build_array());
  ELSE
    v_plan_result := public.rr_plan_participant_change(
      p_event_id, p_player_id, p_action, v_substitute_id);
    IF (v_plan_result ->> 'ok')::boolean = false
       AND p_regen_mode = 'minimal'
       AND (v_plan_result ->> 'code') = 'reoptimization_required' THEN
      v_plan_result := jsonb_set(v_plan_result, '{code}', '"minimal_regen_not_possible"'::jsonb);
    END IF;
  END IF;

  v_effective_round := coalesce(
    (v_plan_result ->> 'effective_round')::integer, v_event.current_round, 1);

  IF p_action = 'restore' THEN
    SELECT count(*) INTO v_future_rounds FROM public.round_robin_schedule
     WHERE event_id = p_event_id AND round_no >= v_effective_round
       AND voided_at IS NULL AND superseded_by_schedule_id IS NULL;
    IF v_future_rounds = 0 THEN
      v_plan_result := jsonb_set(v_plan_result, '{regen}',
        jsonb_build_object('reason','no_future_rounds',
          'rounds_touched', jsonb_build_array(),
          'matches_changed', 0));
    END IF;
  END IF;

  IF p_preview_only THEN
    RETURN jsonb_build_object(
      'preview', true,
      'schedule_version', v_event.schedule_version,
      'effective_round', v_effective_round,
      'rating_eligibility_change',
        jsonb_build_object(
          'before', v_event.rating_eligible,
          'after',  CASE WHEN p_action = 'replace' AND v_sub_is_guest AND v_event.rating_eligible = true
                         THEN false ELSE v_event.rating_eligible END),
      'plan', v_plan_result,
      'active_match_id', v_active_match.id
    );
  END IF;

  IF (v_plan_result ->> 'ok')::boolean = false THEN
    UPDATE public.rr_participant_mutation_requests
       SET status = 'failed', response = v_plan_result,
           error_code = v_plan_result ->> 'code', completed_at = now()
     WHERE request_id = p_request_id;
    RAISE EXCEPTION 'planner_failed' USING ERRCODE = '22023', DETAIL = v_plan_result::text;
  END IF;

  v_rating_before := v_event.rating_eligible;
  v_rating_after  := v_rating_before;
  IF p_action = 'replace' AND v_sub_is_guest AND v_rating_before = true THEN
    v_rating_after := false;
    v_rating_flip  := true;
  END IF;

  IF v_active_match.id IS NOT NULL AND p_action IN ('withdraw','injure','remove') THEN
    v_before_row := to_jsonb(v_active_match);
    IF v_resolution = 'finish_and_record' THEN
      UPDATE public.round_robin_schedule
         SET locked_at = coalesce(locked_at, now())
       WHERE id = v_active_match.id;
    ELSIF v_resolution = 'abandon' THEN
      UPDATE public.round_robin_schedule
         SET voided_at = now(),
             voided_reason = coalesce(p_reason, 'participant_' || p_action),
             abandoned = true, abandoned_at = now(),
             abandoned_reason = coalesce(p_reason, 'participant_' || p_action)
       WHERE id = v_active_match.id;
    ELSIF v_resolution = 'restart_with_substitute' THEN
      UPDATE public.round_robin_schedule
         SET voided_at = now(),
             voided_reason = coalesce(p_reason, 'restart_with_substitute'),
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

    SELECT to_jsonb(s) INTO v_after_row
      FROM public.round_robin_schedule s WHERE s.id = v_active_match.id;
    INSERT INTO public.round_robin_audit(event_id, editor_id, change_type, changes, reason)
    VALUES (p_event_id, v_actor, 'schedule_active_match_' || v_resolution,
      jsonb_build_object(
        'request_id', p_request_id,
        'schedule_id', v_active_match.id,
        'successor_schedule_id', v_new_row_id,
        'before', v_before_row,
        'after',  v_after_row), p_reason);
  END IF;

  v_plan_ops := v_plan_result -> 'plan';
  IF v_plan_ops IS NOT NULL THEN
    FOR v_op IN SELECT * FROM jsonb_array_elements(v_plan_ops)
    LOOP
      IF (v_op ->> 'op') = 'swap_identity' THEN
        SELECT to_jsonb(s) INTO v_before_row
          FROM public.round_robin_schedule s WHERE s.id = (v_op ->> 'schedule_id')::uuid;

        UPDATE public.round_robin_schedule
           SET a1_player_id = CASE WHEN (v_op ->> 'from_profile_id') IS NOT NULL
                                    AND a1_player_id = (v_op ->> 'from_profile_id')::uuid
                                   THEN nullif(v_op ->> 'to_profile_id','')::uuid ELSE a1_player_id END,
               a2_player_id = CASE WHEN (v_op ->> 'from_profile_id') IS NOT NULL
                                    AND a2_player_id = (v_op ->> 'from_profile_id')::uuid
                                   THEN nullif(v_op ->> 'to_profile_id','')::uuid ELSE a2_player_id END,
               b1_player_id = CASE WHEN (v_op ->> 'from_profile_id') IS NOT NULL
                                    AND b1_player_id = (v_op ->> 'from_profile_id')::uuid
                                   THEN nullif(v_op ->> 'to_profile_id','')::uuid ELSE b1_player_id END,
               b2_player_id = CASE WHEN (v_op ->> 'from_profile_id') IS NOT NULL
                                    AND b2_player_id = (v_op ->> 'from_profile_id')::uuid
                                   THEN nullif(v_op ->> 'to_profile_id','')::uuid ELSE b2_player_id END,
               a1_guest_id  = CASE WHEN (v_op ->> 'from_guest_id') IS NOT NULL
                                    AND a1_guest_id  = (v_op ->> 'from_guest_id')::uuid
                                   THEN nullif(v_op ->> 'to_guest_id','')::uuid ELSE a1_guest_id END,
               a2_guest_id  = CASE WHEN (v_op ->> 'from_guest_id') IS NOT NULL
                                    AND a2_guest_id  = (v_op ->> 'from_guest_id')::uuid
                                   THEN nullif(v_op ->> 'to_guest_id','')::uuid ELSE a2_guest_id END,
               b1_guest_id  = CASE WHEN (v_op ->> 'from_guest_id') IS NOT NULL
                                    AND b1_guest_id  = (v_op ->> 'from_guest_id')::uuid
                                   THEN nullif(v_op ->> 'to_guest_id','')::uuid ELSE b1_guest_id END,
               b2_guest_id  = CASE WHEN (v_op ->> 'from_guest_id') IS NOT NULL
                                    AND b2_guest_id  = (v_op ->> 'from_guest_id')::uuid
                                   THEN nullif(v_op ->> 'to_guest_id','')::uuid ELSE b2_guest_id END
         WHERE id = (v_op ->> 'schedule_id')::uuid
           AND locked_at IS NULL AND voided_at IS NULL AND superseded_by_schedule_id IS NULL;

        SELECT to_jsonb(s) INTO v_after_row
          FROM public.round_robin_schedule s WHERE s.id = (v_op ->> 'schedule_id')::uuid;

        INSERT INTO public.round_robin_audit(event_id, editor_id, change_type, changes, reason)
        VALUES (p_event_id, v_actor, 'schedule_swap_identity',
          jsonb_build_object(
            'request_id', p_request_id,
            'schedule_id', (v_op ->> 'schedule_id')::uuid,
            'from_profile_id', v_op ->> 'from_profile_id',
            'to_profile_id',   v_op ->> 'to_profile_id',
            'from_guest_id',   v_op ->> 'from_guest_id',
            'to_guest_id',     v_op ->> 'to_guest_id',
            'before', v_before_row,
            'after',  v_after_row), p_reason);
      END IF;
    END LOOP;
  END IF;

  IF p_action IN ('withdraw','injure','remove') THEN
    UPDATE public.round_robin_players
       SET status = CASE p_action WHEN 'withdraw' THEN 'withdrawn'::rr_participant_status
                                  WHEN 'injure'   THEN 'injured'::rr_participant_status
                                  WHEN 'remove'   THEN 'removed'::rr_participant_status END,
           withdrawn_at = now(), withdrawal_reason = p_reason,
           effective_round = v_effective_round,
           updated_by = v_actor, updated_at = now()
     WHERE id = p_player_id;
  ELSIF p_action = 'replace' THEN
    UPDATE public.round_robin_players
       SET status = 'replaced', withdrawn_at = now(), withdrawal_reason = p_reason,
           effective_round = v_effective_round,
           replacement_participant_id = v_substitute_id,
           updated_by = v_actor, updated_at = now()
     WHERE id = p_player_id;
    UPDATE public.round_robin_players
       SET replaced_participant_id = p_player_id,
           updated_by = v_actor, updated_at = now()
     WHERE id = v_substitute_id;
  ELSIF p_action = 'restore' THEN
    UPDATE public.round_robin_players
       SET status = 'active', withdrawn_at = NULL, withdrawal_reason = NULL,
           effective_round = NULL, updated_by = v_actor, updated_at = now()
     WHERE id = p_player_id;
  END IF;

  IF v_rating_flip THEN
    UPDATE public.round_robin_events
       SET rating_eligible = false,
           rating_exclusion_reason = coalesce(rating_exclusion_reason,
             'Guest substitute introduced during event'),
           updated_at = now()
     WHERE id = p_event_id;
    INSERT INTO public.round_robin_audit(event_id, editor_id, change_type, changes, reason)
    VALUES (p_event_id, v_actor, 'rating_eligibility_change',
      jsonb_build_object(
        'request_id', p_request_id,
        'before', v_rating_before,
        'after',  v_rating_after,
        'trigger','guest_substitute',
        'substitute_participant_id', v_substitute_id), p_reason);
  END IF;

  v_new_version := v_event.schedule_version + 1;
  UPDATE public.round_robin_events
     SET schedule_version = v_new_version, updated_at = now()
   WHERE id = p_event_id;

  INSERT INTO public.round_robin_audit(event_id, editor_id, change_type, changes, reason)
  VALUES (p_event_id, v_actor, 'participant_' || p_action,
    jsonb_build_object(
      'request_id', p_request_id,
      'target_participant_id', p_player_id,
      'schedule_version_before', v_event.schedule_version,
      'schedule_version_after',  v_new_version,
      'plan', v_plan_result,
      'active_match_id', v_active_match.id,
      'active_match_resolution', v_resolution,
      'substitute_participant_id', v_substitute_id,
      'effective_round', v_effective_round,
      'regen_mode_requested', p_regen_mode,
      'regen_mode_applied',   coalesce(v_plan_result ->> 'plan_type', 'n/a'),
      'rating_eligibility',
        jsonb_build_object('before', v_rating_before, 'after', v_rating_after)),
    p_reason);

  v_response := jsonb_build_object(
    'preview', false,
    'schedule_version', v_new_version,
    'effective_round', v_effective_round,
    'plan', v_plan_result,
    'active_match_id', v_active_match.id,
    'active_match_resolution', v_resolution,
    'rating_eligibility_change',
      jsonb_build_object('before', v_rating_before, 'after', v_rating_after));

  UPDATE public.rr_participant_mutation_requests
     SET status = 'completed', response = v_response,
         schedule_version_before = v_event.schedule_version,
         schedule_version_after  = v_new_version, completed_at = now()
   WHERE request_id = p_request_id;

  RETURN v_response;

EXCEPTION WHEN OTHERS THEN
  IF NOT p_preview_only THEN
    UPDATE public.rr_participant_mutation_requests
       SET status = 'failed', error_code = SQLERRM, completed_at = now()
     WHERE request_id = p_request_id AND status = 'in_progress';
  END IF;
  RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.rr_manage_participant(
  uuid, uuid, uuid, text, text, integer, text, boolean, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rr_manage_participant(
  uuid, uuid, uuid, text, text, integer, text, boolean, jsonb, jsonb) TO authenticated;
