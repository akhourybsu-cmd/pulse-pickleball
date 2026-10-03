-- Atomic departures and substitutions, including resting roster members.
BEGIN;
CREATE OR REPLACE FUNCTION public.rr_substitute_round_as_actor(
  p_actor_id uuid,
  p_request_id uuid,
  p_event_id uuid,
  p_expected_version integer,
  p_round_no integer,
  p_original_roster_id uuid,
  p_replacement_player_id uuid DEFAULT NULL,
  p_replacement_guest_id uuid DEFAULT NULL,
  p_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_actor uuid := p_actor_id;
  v_event public.round_robin_events%ROWTYPE;
  v_original public.round_robin_players%ROWTYPE;
  v_existing public.rr_schedule_mutation_requests%ROWTYPE;
  v_input_hash text;
  v_original_occurrences integer := 0;
  v_affected_rows integer := 0;
  v_replacement_gender text;
  v_new_version integer;
  v_response jsonb;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'RR_UNAUTHORIZED:Authentication required';
  END IF;

  IF p_request_id IS NULL OR p_event_id IS NULL OR p_original_roster_id IS NULL
     OR p_round_no IS NULL OR p_expected_version IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'RR_INVALID_SUBSTITUTE:request, event, version, round, and original player are required';
  END IF;

  IF ((p_replacement_player_id IS NOT NULL)::integer
      + (p_replacement_guest_id IS NOT NULL)::integer) <> 1 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'RR_INVALID_SUBSTITUTE:Choose exactly one registered player or saved guest';
  END IF;

  v_input_hash := encode(extensions.digest(
    jsonb_build_object(
      'kind', 'substitute_round',
      'event_id', p_event_id,
      'actor_id', v_actor,
      'expected_version', p_expected_version,
      'round_no', p_round_no,
      'original_roster_id', p_original_roster_id,
      'replacement_player_id', p_replacement_player_id,
      'replacement_guest_id', p_replacement_guest_id,
      'reason', p_reason
    )::text,
    'sha256'
  ), 'hex');

  SELECT *
    INTO v_event
    FROM public.round_robin_events
   WHERE id = p_event_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'RR_EVENT_NOT_FOUND';
  END IF;

  IF NOT public.can_manage_round_robin(p_event_id, v_actor)
     AND NOT public.has_role(v_actor, 'admin'::public.app_role) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'RR_UNAUTHORIZED:Only the organizer or an administrator can substitute a player';
  END IF;

  SELECT *
    INTO v_existing
    FROM public.rr_schedule_mutation_requests
   WHERE request_id = p_request_id;

  IF FOUND THEN
    IF v_existing.input_hash <> v_input_hash
       OR v_existing.mutation_kind <> 'substitute_round' THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'RR_IDEMPOTENCY_CONFLICT:That request id was already used for different inputs';
    END IF;
    IF v_existing.status = 'completed' THEN
      RETURN v_existing.response;
    END IF;
    RAISE EXCEPTION USING ERRCODE = '55P03', MESSAGE = 'RR_REQUEST_IN_PROGRESS:Retry this request shortly';
  END IF;

  INSERT INTO public.rr_schedule_mutation_requests (
    request_id, event_id, actor_id, mutation_kind, input_hash, status
  ) VALUES (
    p_request_id, p_event_id, v_actor, 'substitute_round', v_input_hash, 'in_progress'
  );

  IF p_expected_version <> COALESCE(v_event.schedule_version, 0) THEN
    RAISE EXCEPTION USING
      ERRCODE = '40001',
      MESSAGE = 'RR_STALE_VERSION:' || jsonb_build_object(
        'expected', p_expected_version,
        'current', COALESCE(v_event.schedule_version, 0)
      )::text;
  END IF;

  IF COALESCE(v_event.voided, false)
     OR v_event.status::text IN ('completed', 'voided') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'RR_EVENT_CLOSED:The schedule can no longer be changed';
  END IF;

  IF p_round_no < 1 OR p_round_no > v_event.num_rounds THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'RR_INVALID_SUBSTITUTE:The selected round is outside this event';
  END IF;

  IF v_event.status::text IS DISTINCT FROM 'live' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'RR_INVALID_SUBSTITUTE:Single-round substitutions are available only during live play; use a global substitution for draft roster changes';
  END IF;

  IF p_round_no < COALESCE(v_event.current_round, 1) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'RR_PROTECTED_ROUND:Completed rounds cannot be changed; only the current live round supports a one-round substitution';
  END IF;

  IF p_round_no > COALESCE(v_event.current_round, 1) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'RR_INVALID_SUBSTITUTE:Future-round substitutions can be lost during schedule changes; use a global substitution instead';
  END IF;

  SELECT *
    INTO v_original
    FROM public.round_robin_players
   WHERE id = p_original_roster_id
     AND event_id = p_event_id
     AND active = true
   FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'RR_INVALID_SUBSTITUTE:The original player is not active in this event';
  END IF;

  IF (v_original.player_id IS NOT NULL AND v_original.player_id = p_replacement_player_id)
     OR (v_original.guest_player_id IS NOT NULL AND v_original.guest_player_id = p_replacement_guest_id) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'RR_INVALID_SUBSTITUTE:Choose someone other than the original player';
  END IF;

  IF p_replacement_player_id IS NOT NULL THEN
    SELECT gender INTO v_replacement_gender
      FROM public.profiles
     WHERE id = p_replacement_player_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'RR_INVALID_SUBSTITUTE:The replacement profile was not found';
    END IF;
  ELSE
    -- SECURITY DEFINER must not turn a guessed guest UUID into cross-owner
    -- access. Accept guests the host owns, administers through a group, or
    -- already has on this event's roster; administrators retain support access.
    SELECT COALESCE(linked_profile.gender, guest.gender) INTO v_replacement_gender
      FROM public.guest_players guest
      LEFT JOIN public.profiles linked_profile ON linked_profile.id = guest.linked_user_id
     WHERE guest.id = p_replacement_guest_id
       AND (
         guest.created_by = v_actor
         OR public.has_role(v_actor, 'admin'::public.app_role)
         OR EXISTS (
           SELECT 1
             FROM public.round_robin_players roster
            WHERE roster.event_id = p_event_id
              AND roster.guest_player_id = guest.id
         )
         OR EXISTS (
           SELECT 1
             FROM public.group_members gm
            WHERE gm.group_id = guest.group_id
              AND gm.user_id = v_actor
              AND gm.role IN ('owner', 'moderator')
              AND gm.status = 'active'
         )
       );
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'RR_INVALID_SUBSTITUTE:The saved guest was not found';
    END IF;
  END IF;

  IF v_event.format::text = 'male' AND v_replacement_gender IS DISTINCT FROM 'male' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'RR_INVALID_SUBSTITUTE:A men''s event requires a male replacement';
  END IF;
  IF v_event.format::text = 'female' AND v_replacement_gender IS DISTINCT FROM 'female' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'RR_INVALID_SUBSTITUTE:A women''s event requires a female replacement';
  END IF;
  IF v_event.format::text = 'mixed'
     AND (v_replacement_gender IS NULL OR v_replacement_gender NOT IN ('male', 'female')) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'RR_INVALID_SUBSTITUTE:A mixed-doubles replacement needs a male or female designation';
  END IF;

  PERFORM 1
    FROM public.round_robin_schedule s
   WHERE s.event_id = p_event_id
     AND s.round_no = p_round_no
     AND s.voided_at IS NULL
     AND s.superseded_by_schedule_id IS NULL
   ORDER BY s.id
   FOR UPDATE;

  IF EXISTS (
    SELECT 1
      FROM public.round_robin_schedule s
     WHERE s.event_id = p_event_id
       AND s.round_no = p_round_no
       AND s.voided_at IS NULL
       AND s.superseded_by_schedule_id IS NULL
       AND s.is_bye = false
       AND (
         s.locked_at IS NOT NULL
         OR s.match_id IS NOT NULL
         OR s.team1_score IS NOT NULL
         OR s.team2_score IS NOT NULL
         OR COALESCE(s.abandoned, false)
       )
       AND (
         (v_original.player_id IS NOT NULL AND v_original.player_id IN (
           s.a1_player_id, s.a2_player_id, s.b1_player_id, s.b2_player_id
         ))
         OR (v_original.guest_player_id IS NOT NULL AND v_original.guest_player_id IN (
           s.a1_guest_id, s.a2_guest_id, s.b1_guest_id, s.b2_guest_id
         ))
       )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'RR_PROTECTED_ROUND:The original player''s match is already started, scored, or locked';
  END IF;

  SELECT count(*)
    INTO v_original_occurrences
    FROM public.round_robin_schedule s
   WHERE s.event_id = p_event_id
     AND s.round_no = p_round_no
     AND s.voided_at IS NULL
     AND s.superseded_by_schedule_id IS NULL
     AND s.is_bye = false
     AND (
       (v_original.player_id IS NOT NULL AND v_original.player_id IN (
         s.a1_player_id, s.a2_player_id, s.b1_player_id, s.b2_player_id
       ))
       OR (v_original.guest_player_id IS NOT NULL AND v_original.guest_player_id IN (
         s.a1_guest_id, s.a2_guest_id, s.b1_guest_id, s.b2_guest_id
       ))
     );

  IF v_original_occurrences <> 1 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'RR_INVALID_SUBSTITUTE:The original player must have exactly one playable match in that round';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.round_robin_schedule s
     WHERE s.event_id = p_event_id
       AND s.round_no = p_round_no
       AND s.voided_at IS NULL
       AND s.superseded_by_schedule_id IS NULL
       AND s.is_bye = false
       AND (
         (p_replacement_player_id IS NOT NULL AND p_replacement_player_id IN (
           s.a1_player_id, s.a2_player_id, s.b1_player_id, s.b2_player_id
         ))
         OR (p_replacement_guest_id IS NOT NULL AND p_replacement_guest_id IN (
           s.a1_guest_id, s.a2_guest_id, s.b1_guest_id, s.b2_guest_id
         ))
       )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'RR_INVALID_SUBSTITUTE:The replacement is already assigned in that round';
  END IF;

  -- Transfer the resting assignment as well, without creating duplicate seats.
  UPDATE public.round_robin_schedule s
     SET a1_player_id = v_original.player_id, a1_guest_id = v_original.guest_player_id
   WHERE s.event_id = p_event_id AND s.round_no = p_round_no
     AND s.is_bye = true AND s.voided_at IS NULL AND s.superseded_by_schedule_id IS NULL
     AND ((p_replacement_player_id IS NOT NULL AND s.a1_player_id = p_replacement_player_id)
       OR (p_replacement_guest_id IS NOT NULL AND s.a1_guest_id = p_replacement_guest_id));

  UPDATE public.round_robin_schedule s
     SET a1_player_id = CASE WHEN
           (v_original.player_id IS NOT NULL AND s.a1_player_id = v_original.player_id)
           OR (v_original.guest_player_id IS NOT NULL AND s.a1_guest_id = v_original.guest_player_id)
         THEN p_replacement_player_id ELSE s.a1_player_id END,
         a1_guest_id = CASE WHEN
           (v_original.player_id IS NOT NULL AND s.a1_player_id = v_original.player_id)
           OR (v_original.guest_player_id IS NOT NULL AND s.a1_guest_id = v_original.guest_player_id)
         THEN p_replacement_guest_id ELSE s.a1_guest_id END,
         a2_player_id = CASE WHEN
           (v_original.player_id IS NOT NULL AND s.a2_player_id = v_original.player_id)
           OR (v_original.guest_player_id IS NOT NULL AND s.a2_guest_id = v_original.guest_player_id)
         THEN p_replacement_player_id ELSE s.a2_player_id END,
         a2_guest_id = CASE WHEN
           (v_original.player_id IS NOT NULL AND s.a2_player_id = v_original.player_id)
           OR (v_original.guest_player_id IS NOT NULL AND s.a2_guest_id = v_original.guest_player_id)
         THEN p_replacement_guest_id ELSE s.a2_guest_id END,
         b1_player_id = CASE WHEN
           (v_original.player_id IS NOT NULL AND s.b1_player_id = v_original.player_id)
           OR (v_original.guest_player_id IS NOT NULL AND s.b1_guest_id = v_original.guest_player_id)
         THEN p_replacement_player_id ELSE s.b1_player_id END,
         b1_guest_id = CASE WHEN
           (v_original.player_id IS NOT NULL AND s.b1_player_id = v_original.player_id)
           OR (v_original.guest_player_id IS NOT NULL AND s.b1_guest_id = v_original.guest_player_id)
         THEN p_replacement_guest_id ELSE s.b1_guest_id END,
         b2_player_id = CASE WHEN
           (v_original.player_id IS NOT NULL AND s.b2_player_id = v_original.player_id)
           OR (v_original.guest_player_id IS NOT NULL AND s.b2_guest_id = v_original.guest_player_id)
         THEN p_replacement_player_id ELSE s.b2_player_id END,
         b2_guest_id = CASE WHEN
           (v_original.player_id IS NOT NULL AND s.b2_player_id = v_original.player_id)
           OR (v_original.guest_player_id IS NOT NULL AND s.b2_guest_id = v_original.guest_player_id)
         THEN p_replacement_guest_id ELSE s.b2_guest_id END
   WHERE s.event_id = p_event_id
     AND s.round_no = p_round_no
     AND s.voided_at IS NULL
     AND s.superseded_by_schedule_id IS NULL
     AND s.is_bye = false
     AND (
       (v_original.player_id IS NOT NULL AND v_original.player_id IN (
         s.a1_player_id, s.a2_player_id, s.b1_player_id, s.b2_player_id
       ))
       OR (v_original.guest_player_id IS NOT NULL AND v_original.guest_player_id IN (
         s.a1_guest_id, s.a2_guest_id, s.b1_guest_id, s.b2_guest_id
       ))
     );
  GET DIAGNOSTICS v_affected_rows = ROW_COUNT;

  IF v_affected_rows <> 1 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'RR_INVALID_SUBSTITUTE:The substitution did not affect exactly one match';
  END IF;

  IF v_event.format::text = 'mixed' AND EXISTS (
    WITH seats AS (
      SELECT s.id, v.team, v.player_id, v.guest_id
        FROM public.round_robin_schedule s
        CROSS JOIN LATERAL (VALUES
          ('A', s.a1_player_id, s.a1_guest_id),
          ('A', s.a2_player_id, s.a2_guest_id),
          ('B', s.b1_player_id, s.b1_guest_id),
          ('B', s.b2_player_id, s.b2_guest_id)
        ) AS v(team, player_id, guest_id)
       WHERE s.event_id = p_event_id
         AND s.round_no = p_round_no
         AND s.voided_at IS NULL
         AND s.superseded_by_schedule_id IS NULL
         AND s.is_bye = false
    ), gendered AS (
      SELECT seat.id,
             seat.team,
             COALESCE(profile.gender, linked_profile.gender, guest.gender) AS gender
        FROM seats seat
        LEFT JOIN public.profiles profile ON profile.id = seat.player_id
        LEFT JOIN public.guest_players guest ON guest.id = seat.guest_id
        LEFT JOIN public.profiles linked_profile ON linked_profile.id = guest.linked_user_id
    )
    SELECT 1
      FROM gendered
     GROUP BY id, team
    HAVING count(*) FILTER (WHERE gender = 'male') <> 1
        OR count(*) FILTER (WHERE gender = 'female') <> 1
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'RR_INVALID_SUBSTITUTE:The replacement would break a mixed-doubles team';
  END IF;

  v_new_version := COALESCE(v_event.schedule_version, 0) + 1;
  UPDATE public.round_robin_events
     SET schedule_version = v_new_version,
         rating_eligible = CASE
           WHEN p_replacement_guest_id IS NOT NULL THEN false
           ELSE rating_eligible
         END,
         rating_exclusion_reason = CASE
           WHEN p_replacement_guest_id IS NOT NULL THEN COALESCE(
             rating_exclusion_reason,
             'Guest substitute introduced during event'
           )
           ELSE rating_exclusion_reason
         END,
         updated_at = now()
   WHERE id = p_event_id;

  INSERT INTO public.round_robin_audit (
    event_id, editor_id, change_type, changes, reason
  ) VALUES (
    p_event_id,
    v_actor,
    'player_substitute_round',
    jsonb_build_object(
      'request_id', p_request_id,
      'round_no', p_round_no,
      'original_roster_id', p_original_roster_id,
      'original_player_id', v_original.player_id,
      'original_guest_id', v_original.guest_player_id,
      'replacement_player_id', p_replacement_player_id,
      'replacement_guest_id', p_replacement_guest_id,
      'rating_eligible_before', v_event.rating_eligible,
      'rating_eligible_after', CASE
        WHEN p_replacement_guest_id IS NOT NULL THEN false
        ELSE v_event.rating_eligible
      END,
      'schedule_version_before', COALESCE(v_event.schedule_version, 0),
      'schedule_version_after', v_new_version
    ),
    COALESCE(NULLIF(btrim(p_reason), ''), format('One-round substitution for Round %s', p_round_no))
  );

  v_response := jsonb_build_object(
    'ok', true,
    'request_id', p_request_id,
    'round_no', p_round_no,
    'replacement_player_id', p_replacement_player_id,
    'replacement_guest_id', p_replacement_guest_id,
    'affected_matches', v_affected_rows,
    'schedule_version', v_new_version
  );

  UPDATE public.rr_schedule_mutation_requests
     SET status = 'completed', response = v_response, completed_at = now()
   WHERE request_id = p_request_id;

  RETURN v_response;
END;
$$;

REVOKE ALL ON FUNCTION public.rr_substitute_round_as_actor(uuid,uuid,uuid,integer,integer,uuid,uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rr_substitute_round_as_actor(uuid,uuid,uuid,integer,integer,uuid,uuid,uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.rr_substitute_round(
  p_request_id uuid, p_event_id uuid, p_expected_version integer, p_round_no integer,
  p_original_roster_id uuid, p_replacement_player_id uuid DEFAULT NULL,
  p_replacement_guest_id uuid DEFAULT NULL, p_reason text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.pulse_has_required_mfa() THEN
    RAISE EXCEPTION 'RR_UNAUTHORIZED:Authentication required';
  END IF;
  RETURN public.rr_substitute_round_as_actor(auth.uid(),p_request_id,p_event_id,
    p_expected_version,p_round_no,p_original_roster_id,p_replacement_player_id,p_replacement_guest_id,p_reason);
END; $$;
REVOKE ALL ON FUNCTION public.rr_substitute_round(uuid,uuid,integer,integer,uuid,uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.rr_substitute_round(uuid,uuid,integer,integer,uuid,uuid,uuid,text) TO authenticated,service_role;

-- The service plans against a snapshot. The roster and strict rebuild commit
-- in one transaction; any stale or invalid plan rolls back the entire change.
CREATE OR REPLACE FUNCTION public.rr_apply_roster_adjustment(
  p_request_id uuid, p_event_id uuid, p_actor_id uuid, p_expected_version integer,
  p_regenerate_from_round integer, p_num_courts integer, p_num_rounds integer,
  p_games_per_player integer, p_schedule jsonb, p_impact jsonb, p_reason text,
  p_substitution jsonb, p_allocation jsonb, p_change jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_event public.round_robin_events%ROWTYPE;
  v_out public.round_robin_players%ROWTYPE;
  v_match public.round_robin_schedule%ROWTYPE;
  v_out_seat text := p_change->>'outgoingSeatId';
  v_in_seat text := p_change->>'incomingSeatId';
  v_current boolean := COALESCE((p_change->>'includeCurrent')::boolean,false);
  v_version integer := p_expected_version + CASE WHEN v_current THEN 1 ELSE 0 END;
  v_impact jsonb := COALESCE(p_impact,'{}'::jsonb) || jsonb_build_object('roster_change',p_change);
  v_result jsonb;
BEGIN
  SELECT * INTO v_event FROM public.round_robin_events WHERE id=p_event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'RR_EVENT_NOT_FOUND'; END IF;
  IF p_actor_id IS NULL OR NOT public.can_manage_round_robin(p_event_id,p_actor_id) THEN
    RAISE EXCEPTION 'RR_UNAUTHORIZED';
  END IF;
  -- The rebuild hash includes the full command and rejects conflicting reuse.
  IF EXISTS (SELECT 1 FROM public.rr_schedule_mutation_requests WHERE request_id=p_request_id) THEN
    RETURN public.rr_apply_schedule_rebuild(p_request_id,p_event_id,p_actor_id,v_version,
      p_regenerate_from_round,p_num_courts,p_num_rounds,p_games_per_player,p_schedule,
      v_impact,p_reason,p_substitution,p_allocation);
  END IF;
  IF p_expected_version IS NULL OR p_expected_version<>COALESCE(v_event.schedule_version,0) THEN
    RAISE EXCEPTION 'RR_STALE_VERSION';
  END IF;
  IF COALESCE(v_event.voided,false) OR v_event.status::text IN ('completed','voided') THEN
    RAISE EXCEPTION 'RR_EVENT_CLOSED';
  END IF;
  IF jsonb_typeof(p_change) IS DISTINCT FROM 'object' OR v_out_seat IS NULL
     OR v_out_seat !~ '^[pg]:[0-9a-f-]{36}$'
     OR (v_in_seat IS NOT NULL AND (v_in_seat !~ '^[pg]:[0-9a-f-]{36}$' OR v_in_seat=v_out_seat))
     OR (p_change->>'resolution' IS NOT NULL AND p_change->>'resolution' NOT IN ('keep_current','abandon')) THEN
    RAISE EXCEPTION 'RR_INVALID_ROSTER:Invalid roster command';
  END IF;
  LOCK TABLE public.round_robin_players IN SHARE ROW EXCLUSIVE MODE;
  SELECT * INTO v_out FROM public.round_robin_players
    WHERE event_id=p_event_id AND active=true
      AND CASE WHEN player_id IS NOT NULL THEN 'p:'||player_id::text ELSE 'g:'||guest_player_id::text END=v_out_seat FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'RR_INVALID_ROSTER:Outgoing player is no longer active'; END IF;
  IF p_substitution IS NOT NULL THEN
    IF p_substitution IS DISTINCT FROM jsonb_build_object('outgoingSeatId',v_out_seat,'incomingSeatId',v_in_seat) THEN
      RAISE EXCEPTION 'RR_INVALID_ROSTER:Substitution command mismatch';
    END IF;
  ELSIF v_in_seat IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.round_robin_players WHERE event_id=p_event_id AND active=true
      AND CASE WHEN player_id IS NOT NULL THEN 'p:'||player_id::text ELSE 'g:'||guest_player_id::text END=v_in_seat
  ) THEN RAISE EXCEPTION 'RR_INVALID_ROSTER:The replacement is no longer active'; END IF;

  IF v_current THEN
    IF v_in_seat IS NULL THEN RAISE EXCEPTION 'RR_INVALID_SUBSTITUTE:Choose a replacement'; END IF;
    PERFORM public.rr_substitute_round_as_actor(p_actor_id,gen_random_uuid(),p_event_id,p_expected_version,
      COALESCE(v_event.current_round,1),v_out.id,
      CASE WHEN left(v_in_seat,2)='p:' THEN substr(v_in_seat,3)::uuid END,
      CASE WHEN left(v_in_seat,2)='g:' THEN substr(v_in_seat,3)::uuid END,p_reason);
  ELSIF v_in_seat IS NULL AND p_change->>'resolution'='abandon' THEN
    SELECT * INTO v_match FROM public.round_robin_schedule s
      WHERE s.event_id=p_event_id AND s.round_no=COALESCE(v_event.current_round,1)
        AND NOT s.is_bye AND s.voided_at IS NULL AND s.superseded_by_schedule_id IS NULL
        AND ((v_out.player_id IS NOT NULL AND v_out.player_id IN (s.a1_player_id,s.a2_player_id,s.b1_player_id,s.b2_player_id))
          OR (v_out.guest_player_id IS NOT NULL AND v_out.guest_player_id IN (s.a1_guest_id,s.a2_guest_id,s.b1_guest_id,s.b2_guest_id))) FOR UPDATE;
    IF FOUND THEN
      IF v_match.locked_at IS NOT NULL OR v_match.match_id IS NOT NULL OR v_match.team1_score IS NOT NULL OR v_match.team2_score IS NOT NULL THEN
        RAISE EXCEPTION 'RR_PROTECTED_ROUND:Keep the saved or locked result';
      END IF;
      UPDATE public.round_robin_schedule SET abandoned=true,abandoned_at=now(),abandoned_reason=p_reason WHERE id=v_match.id;
    END IF;
  END IF;
  -- New/inactive replacements use the rebuild's lifecycle handoff. Existing
  -- active substitutes keep their own history and allocation credit.
  IF p_substitution IS NULL THEN
    UPDATE public.round_robin_players SET status='removed',active=false,withdrawn_at=now(),
      withdrawal_reason=p_reason,effective_round=CASE WHEN v_current THEN COALESCE(v_event.current_round,1) ELSE p_regenerate_from_round END,
      updated_by=p_actor_id,updated_at=now() WHERE id=v_out.id;
  END IF;
  v_result := public.rr_apply_schedule_rebuild(p_request_id,p_event_id,p_actor_id,v_version,
    p_regenerate_from_round,p_num_courts,p_num_rounds,p_games_per_player,p_schedule,
    v_impact,p_reason,p_substitution,p_allocation);
  IF v_current AND p_substitution IS NOT NULL THEN
    UPDATE public.round_robin_players SET effective_round=COALESCE(v_event.current_round,1)
      WHERE event_id=p_event_id AND
        (id=v_out.id OR CASE WHEN player_id IS NOT NULL THEN 'p:'||player_id::text ELSE 'g:'||guest_player_id::text END=v_in_seat);
  END IF;
  INSERT INTO public.round_robin_audit(event_id,editor_id,change_type,changes,reason)
    VALUES(p_event_id,p_actor_id,'roster_adjusted',jsonb_build_object('request_id',p_request_id,'command',p_change),p_reason);
  RETURN v_result;
END; $$;
REVOKE ALL ON FUNCTION public.rr_apply_roster_adjustment(uuid,uuid,uuid,integer,integer,integer,integer,integer,jsonb,jsonb,text,jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rr_apply_roster_adjustment(uuid,uuid,uuid,integer,integer,integer,integer,integer,jsonb,jsonb,text,jsonb,jsonb,jsonb) TO service_role;
COMMIT;
