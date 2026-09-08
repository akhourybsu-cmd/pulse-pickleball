-- Round-robin schedule configuration must move as one unit: event settings,
-- future schedule rows, the optimistic version, and the audit record.  The
-- legacy edge function deleted rows before generation/insert completed, which
-- could leave a live event without its remaining schedule after any failure.

BEGIN;

-- The original table-level UNIQUE constraint prevents the participant
-- mutation workflow from retaining a superseded historical row beside its
-- active successor.  The partial unique index below is the intended invariant:
-- exactly one canonical row per event/round/court, while history is retained.
ALTER TABLE public.round_robin_schedule
  DROP CONSTRAINT IF EXISTS round_robin_schedule_event_id_round_no_court_no_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_rr_schedule_active_slot
  ON public.round_robin_schedule (event_id, round_no, court_no)
  WHERE voided_at IS NULL
    AND superseded_by_schedule_id IS NULL;

-- Make lifecycle status authoritative without breaking an older client that
-- still writes the legacy `active` boolean.  Status writes derive `active`;
-- active-only writes are translated to active/removed before the invariant is
-- checked.  This closes the migration-era split-brain state permanently.
CREATE OR REPLACE FUNCTION public.rr_sync_participant_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.active = false AND NEW.status = 'active'::public.rr_participant_status THEN
      NEW.status := 'removed'::public.rr_participant_status;
    END IF;
    NEW.active := (NEW.status = 'active'::public.rr_participant_status);
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.active := (NEW.status = 'active'::public.rr_participant_status);
    IF NEW.status = 'active'::public.rr_participant_status
       AND OLD.status <> 'active'::public.rr_participant_status THEN
      -- A deliberate rejoin starts a new active stint. Detach both sides of
      -- any old substitution link so terminal replacement state cannot leak
      -- into standings or a later substitution.
      IF OLD.replacement_participant_id IS NOT NULL THEN
        UPDATE public.round_robin_players
           SET replaced_participant_id = NULL
         WHERE id = OLD.replacement_participant_id
           AND replaced_participant_id = OLD.id;
      END IF;
      IF OLD.replaced_participant_id IS NOT NULL THEN
        UPDATE public.round_robin_players
           SET replacement_participant_id = NULL
         WHERE id = OLD.replaced_participant_id
           AND replacement_participant_id = OLD.id;
      END IF;
      NEW.replaced_participant_id := NULL;
      NEW.replacement_participant_id := NULL;
      NEW.effective_round := NULL;
      NEW.withdrawn_at := NULL;
      NEW.withdrawal_reason := NULL;
    END IF;
  ELSIF NEW.active IS DISTINCT FROM OLD.active THEN
    IF NEW.active THEN
      NEW.status := 'active'::public.rr_participant_status;
      IF OLD.replacement_participant_id IS NOT NULL THEN
        UPDATE public.round_robin_players
           SET replaced_participant_id = NULL
         WHERE id = OLD.replacement_participant_id
           AND replaced_participant_id = OLD.id;
      END IF;
      IF OLD.replaced_participant_id IS NOT NULL THEN
        UPDATE public.round_robin_players
           SET replacement_participant_id = NULL
         WHERE id = OLD.replaced_participant_id
           AND replacement_participant_id = OLD.id;
      END IF;
      NEW.replaced_participant_id := NULL;
      NEW.replacement_participant_id := NULL;
      NEW.effective_round := NULL;
      NEW.withdrawn_at := NULL;
      NEW.withdrawal_reason := NULL;
    ELSIF OLD.status = 'active'::public.rr_participant_status THEN
      NEW.status := 'removed'::public.rr_participant_status;
      NEW.withdrawn_at := COALESCE(NEW.withdrawn_at, now());
    END IF;
  END IF;

  NEW.active := (NEW.status = 'active'::public.rr_participant_status);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rr_sync_active_from_status ON public.round_robin_players;
DROP TRIGGER IF EXISTS trg_rr_sync_participant_lifecycle ON public.round_robin_players;
CREATE TRIGGER trg_rr_sync_participant_lifecycle
BEFORE INSERT OR UPDATE OF status, active ON public.round_robin_players
FOR EACH ROW
EXECUTE FUNCTION public.rr_sync_participant_lifecycle();

UPDATE public.round_robin_players
   SET active = (status = 'active'::public.rr_participant_status)
 WHERE active IS DISTINCT FROM (status = 'active'::public.rr_participant_status);

ALTER TABLE public.round_robin_players
  DROP CONSTRAINT IF EXISTS rr_players_active_matches_status;
ALTER TABLE public.round_robin_players
  ADD CONSTRAINT rr_players_active_matches_status
  CHECK (active = (status = 'active'::public.rr_participant_status));

-- Allocation metadata belongs to the roster identity, not a disposable
-- schedule row. This lets a later authoritative rebuild retain late-join and
-- substitution context without trusting browser memory.
ALTER TABLE public.round_robin_players
  ADD COLUMN IF NOT EXISTS schedule_game_credit integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS schedule_first_eligible_round integer;

-- Keep a rehearsal or interrupted manual application safe to rerun before
-- installing the strict constraints.
UPDATE public.round_robin_players
   SET schedule_game_credit = GREATEST(0, LEAST(20, COALESCE(schedule_game_credit, 0)));

UPDATE public.round_robin_players
   SET schedule_first_eligible_round = NULL
 WHERE schedule_first_eligible_round < 1;

ALTER TABLE public.round_robin_players
  ALTER COLUMN schedule_game_credit SET DEFAULT 0,
  ALTER COLUMN schedule_game_credit SET NOT NULL;

ALTER TABLE public.round_robin_players
  DROP CONSTRAINT IF EXISTS rr_players_schedule_game_credit_range;
ALTER TABLE public.round_robin_players
  ADD CONSTRAINT rr_players_schedule_game_credit_range
  CHECK (schedule_game_credit BETWEEN 0 AND 20);

ALTER TABLE public.round_robin_players
  DROP CONSTRAINT IF EXISTS rr_players_schedule_first_eligible_round_positive;
ALTER TABLE public.round_robin_players
  ADD CONSTRAINT rr_players_schedule_first_eligible_round_positive
  CHECK (
    schedule_first_eligible_round IS NULL
    OR schedule_first_eligible_round >= 1
  );

-- A canonical match or explicit bye both prove availability in that round.
-- Active identities with no schedule yet begin at Round 1.
UPDATE public.round_robin_players rp
   SET schedule_first_eligible_round = COALESCE((
     SELECT min(s.round_no)
       FROM public.round_robin_schedule s
      WHERE s.event_id = rp.event_id
        AND s.voided_at IS NULL
        AND s.superseded_by_schedule_id IS NULL
        AND (
          (rp.player_id IS NOT NULL AND rp.player_id IN (
            s.a1_player_id, s.a2_player_id, s.b1_player_id, s.b2_player_id
          ))
          OR (rp.guest_player_id IS NOT NULL AND rp.guest_player_id IN (
            s.a1_guest_id, s.a2_guest_id, s.b1_guest_id, s.b2_guest_id
          ))
        )
   ), 1)
 WHERE rp.active = true
   AND rp.schedule_first_eligible_round IS NULL;

-- Scheduling allocation is authoritative server state. Existing roster RLS
-- intentionally lets participants maintain their own registration row, so a
-- table trigger must prevent those writes from forging credit or availability.
-- auth.role() reads the request JWT even when the writer is the SECURITY
-- DEFINER rebuild RPC; current_user would incorrectly see the function owner.
CREATE OR REPLACE FUNCTION public.rr_guard_schedule_allocation_metadata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_jwt_role text := auth.role();
BEGIN
  IF v_jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.schedule_game_credit IS DISTINCT FROM 0
       OR NEW.schedule_first_eligible_round IS NOT NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '42501',
        MESSAGE = 'RR_PROTECTED_ALLOCATION_METADATA:Only the scheduling service can initialize allocation metadata';
    END IF;
  ELSIF NEW.schedule_game_credit IS DISTINCT FROM OLD.schedule_game_credit
        OR NEW.schedule_first_eligible_round IS DISTINCT FROM OLD.schedule_first_eligible_round THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'RR_PROTECTED_ALLOCATION_METADATA:Only the scheduling service can update allocation metadata';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.rr_guard_schedule_allocation_metadata()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rr_guard_schedule_allocation_metadata()
  TO service_role;

DROP TRIGGER IF EXISTS trg_rr_guard_schedule_allocation_metadata
  ON public.round_robin_players;
CREATE TRIGGER trg_rr_guard_schedule_allocation_metadata
BEFORE INSERT OR UPDATE OF schedule_game_credit, schedule_first_eligible_round
ON public.round_robin_players
FOR EACH ROW
EXECUTE FUNCTION public.rr_guard_schedule_allocation_metadata();

UPDATE public.round_robin_events
   SET games_per_player = CASE
         WHEN games_per_player > 20 THEN 20
         ELSE 3
       END
 WHERE games_per_player IS NULL
    OR games_per_player < 1
    OR games_per_player > 20;

ALTER TABLE public.round_robin_events
  ALTER COLUMN games_per_player SET DEFAULT 3,
  ALTER COLUMN games_per_player SET NOT NULL;

ALTER TABLE public.round_robin_events
  DROP CONSTRAINT IF EXISTS rr_events_games_per_player_positive;
ALTER TABLE public.round_robin_events
  ADD CONSTRAINT rr_events_games_per_player_positive
  CHECK (games_per_player BETWEEN 1 AND 20);

-- Saved guests need the same format metadata as registered profiles so mixed,
-- men's, and women's schedules can be validated without guessing.
ALTER TABLE public.guest_players
  ADD COLUMN IF NOT EXISTS gender text;

ALTER TABLE public.guest_players
  DROP CONSTRAINT IF EXISTS guest_players_gender_check;
ALTER TABLE public.guest_players
  ADD CONSTRAINT guest_players_gender_check
  CHECK (gender IS NULL OR gender IN ('male', 'female', 'other', 'prefer_not_to_say'));

-- The first guest implementation stored only round_robin_players.guest_name.
-- Convert each remaining ad-hoc identity to a durable saved guest before the
-- rebuild RPC starts requiring every active roster row to have an identity.
-- Keep a one-to-one mapping even when two guests share a display name.
CREATE TEMP TABLE rr_legacy_guest_backfill_map (
  roster_id uuid PRIMARY KEY,
  guest_player_id uuid NOT NULL UNIQUE
) ON COMMIT DROP;

INSERT INTO pg_temp.rr_legacy_guest_backfill_map (roster_id, guest_player_id)
SELECT rp.id, gen_random_uuid()
  FROM public.round_robin_players rp
 WHERE rp.player_id IS NULL
   AND rp.guest_player_id IS NULL
   AND rp.guest_name IS NOT NULL;

INSERT INTO public.guest_players (id, display_name, created_by, group_id)
SELECT map.guest_player_id,
       COALESCE(NULLIF(btrim(rp.guest_name), ''), 'Guest Player'),
       rre.organizer_id,
       rre.group_id
  FROM pg_temp.rr_legacy_guest_backfill_map map
  JOIN public.round_robin_players rp ON rp.id = map.roster_id
  JOIN public.round_robin_events rre ON rre.id = rp.event_id;

UPDATE public.round_robin_players rp
   SET guest_player_id = map.guest_player_id
  FROM pg_temp.rr_legacy_guest_backfill_map map
 WHERE rp.id = map.roster_id;

-- The ledger deduplicates exact RPC inputs and lets an identical concurrent or
-- repeated RPC read its committed response. It does not replay the Edge HTTP
-- workflow, which recomputes and revalidates its authoritative snapshots.
-- The ledger is private; only the SECURITY DEFINER functions below use it.
CREATE TABLE IF NOT EXISTS public.rr_schedule_mutation_requests (
  request_id uuid PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.round_robin_events(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL,
  mutation_kind text NOT NULL,
  input_hash text NOT NULL,
  status text NOT NULL CHECK (status IN ('in_progress', 'completed')),
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- CREATE TABLE IF NOT EXISTS does not update an older inline CHECK. Recreate
-- it explicitly so an earlier SQL-editor rehearsal can safely gain the new
-- one-round substitution request kind.
ALTER TABLE public.rr_schedule_mutation_requests
  DROP CONSTRAINT IF EXISTS rr_schedule_mutation_requests_mutation_kind_check;
ALTER TABLE public.rr_schedule_mutation_requests
  ADD CONSTRAINT rr_schedule_mutation_requests_mutation_kind_check
  CHECK (mutation_kind IN ('rebuild', 'edit', 'substitute_round'));

ALTER TABLE public.rr_schedule_mutation_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.rr_schedule_mutation_requests FROM PUBLIC, anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_rr_schedule_mutation_requests_event
  ON public.rr_schedule_mutation_requests(event_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.rr_apply_schedule_rebuild(
  p_request_id uuid,
  p_event_id uuid,
  p_actor_id uuid,
  p_expected_version integer,
  p_regenerate_from_round integer,
  p_num_courts integer,
  p_num_rounds integer,
  p_games_per_player integer,
  p_schedule jsonb,
  p_impact jsonb DEFAULT '{}'::jsonb,
  p_reason text DEFAULT 'Round-robin schedule rebuilt',
  p_substitution jsonb DEFAULT NULL,
  p_allocation jsonb DEFAULT '[]'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_event public.round_robin_events%ROWTYPE;
  v_existing public.rr_schedule_mutation_requests%ROWTYPE;
  v_input_hash text;
  v_response jsonb;
  v_new_version integer;
  v_deleted_rows integer := 0;
  v_inserted_rows integer := 0;
  v_active_players integer := 0;
  v_distinct_rounds integer := 0;
  v_max_round integer := 0;
  v_expected_matches_per_round integer := 0;
  v_actor_is_admin boolean := false;
  v_outgoing_seat text;
  v_incoming_seat text;
  v_outgoing_player_id uuid;
  v_outgoing_guest_id uuid;
  v_incoming_player_id uuid;
  v_incoming_guest_id uuid;
  v_outgoing_count integer := 0;
  v_incoming_count integer := 0;
  v_allocation_count integer := 0;
  v_allocation_unique_count integer := 0;
  v_allocation_updated integer := 0;
  v_outgoing public.round_robin_players%ROWTYPE;
  v_incoming public.round_robin_players%ROWTYPE;
  v_guest public.guest_players%ROWTYPE;
  v_substitution_result jsonb := NULL;
BEGIN
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'RR_INVALID_PLAN:Missing request id';
  END IF;

  IF p_actor_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RR_UNAUTHORIZED:Missing actor';
  END IF;

  IF p_expected_version IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'RR_INVALID_PLAN:An exact schedule version is required';
  END IF;

  v_input_hash := encode(extensions.digest(
    jsonb_build_object(
      'kind', 'rebuild',
      'event_id', p_event_id,
      'actor_id', p_actor_id,
      'expected_version', p_expected_version,
      'regenerate_from_round', p_regenerate_from_round,
      'num_courts', p_num_courts,
      'num_rounds', p_num_rounds,
      'games_per_player', p_games_per_player,
      'schedule', p_schedule,
      'impact', p_impact,
      'reason', p_reason,
      'substitution', p_substitution,
      'allocation', p_allocation
    )::text,
    'sha256'
  ), 'hex');

  SELECT *
    INTO v_event
    FROM public.round_robin_events
   WHERE id = p_event_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RR_EVENT_NOT_FOUND';
  END IF;

  v_actor_is_admin := public.has_role(p_actor_id, 'admin'::public.app_role);
  IF v_event.organizer_id <> p_actor_id
     AND NOT v_actor_is_admin THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RR_UNAUTHORIZED:Only the organizer or an administrator can rebuild this schedule';
  END IF;

  -- Exact duplicate RPC inputs replay before the version check so a concurrent
  -- retry can read the first committed result with its original version.
  SELECT *
    INTO v_existing
    FROM public.rr_schedule_mutation_requests
   WHERE request_id = p_request_id;

  IF FOUND THEN
    IF v_existing.input_hash <> v_input_hash
       OR v_existing.mutation_kind <> 'rebuild' THEN
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
    p_request_id, p_event_id, p_actor_id, 'rebuild', v_input_hash, 'in_progress'
  );

  IF p_expected_version <> COALESCE(v_event.schedule_version, 0) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'RR_STALE_VERSION:' || jsonb_build_object(
        'expected', p_expected_version,
        'current', COALESCE(v_event.schedule_version, 0)
      )::text;
  END IF;

  IF COALESCE(v_event.voided, false)
     OR v_event.status::text IN ('completed', 'voided') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RR_EVENT_CLOSED:The schedule can no longer be rebuilt';
  END IF;

  IF p_regenerate_from_round IS NULL OR p_regenerate_from_round < 1 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RR_INVALID_PLAN:regenerate_from_round must be at least 1';
  END IF;

  -- The live/current round is protected even if legacy drift left it with no
  -- canonical rows. Row-state checks below protect existing matches; this
  -- event-level backstop also prevents a rebuild from silently inserting or
  -- recreating the round currently displayed to players.
  IF v_event.status::text = 'live'
     AND p_regenerate_from_round <= COALESCE(v_event.current_round, 1) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RR_PROTECTED_ROUND:A live rebuild must begin after the current round';
  END IF;

  IF p_num_courts IS NULL OR p_num_courts < 1 OR p_num_courts > 20 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RR_INVALID_PLAN:num_courts must be between 1 and 20';
  END IF;
  IF p_games_per_player IS NULL OR p_games_per_player < 1 OR p_games_per_player > 20 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RR_INVALID_PLAN:games_per_player must be between 1 and 20';
  END IF;
  IF p_num_rounds IS NULL OR p_num_rounds < 1
     OR p_num_rounds < p_regenerate_from_round - 1 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RR_INVALID_PLAN:num_rounds conflicts with the protected-round boundary';
  END IF;
  IF p_schedule IS NULL OR jsonb_typeof(p_schedule) <> 'array' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RR_INVALID_PLAN:schedule must be a JSON array';
  END IF;

  BEGIN
    v_expected_matches_per_round := (p_impact #>> '{capacity,usableCourts}')::integer;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RR_INVALID_PLAN:capacity metadata is invalid';
  END;

  IF v_expected_matches_per_round IS NULL
     OR v_expected_matches_per_round < 1
     OR v_expected_matches_per_round > p_num_courts THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RR_INVALID_PLAN:capacity metadata does not match the requested courts';
  END IF;

  -- Freeze the roster for the short atomic apply window. The edge function
  -- plans before entering this RPC, while this lock ensures a registration or
  -- withdrawal cannot slip between roster validation and schedule insertion.
  LOCK TABLE public.round_robin_players IN SHARE ROW EXCLUSIVE MODE;

  -- A global replacement is a roster mutation and a future-schedule mutation,
  -- so both halves must commit under this same event/table lock. Protected
  -- schedule rows are never rewritten here; p_schedule starts at the already
  -- validated mutable boundary.
  IF p_substitution IS NOT NULL THEN
    IF jsonb_typeof(p_substitution) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'RR_INVALID_SUBSTITUTION:substitution must be a JSON object';
    END IF;

    IF (SELECT count(*) FROM jsonb_object_keys(p_substitution)) <> 2
       OR NOT (p_substitution ? 'outgoingSeatId')
       OR NOT (p_substitution ? 'incomingSeatId')
       OR jsonb_typeof(p_substitution -> 'outgoingSeatId') IS DISTINCT FROM 'string'
       OR jsonb_typeof(p_substitution -> 'incomingSeatId') IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'RR_INVALID_SUBSTITUTION:substitution requires only outgoingSeatId and incomingSeatId';
    END IF;

    v_outgoing_seat := p_substitution ->> 'outgoingSeatId';
    v_incoming_seat := p_substitution ->> 'incomingSeatId';
    IF v_outgoing_seat IS NULL
       OR v_incoming_seat IS NULL
       OR v_outgoing_seat !~* '^[pg]:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       OR v_incoming_seat !~* '^[pg]:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       OR lower(v_outgoing_seat) = lower(v_incoming_seat) THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'RR_INVALID_SUBSTITUTION:outgoingSeatId and incomingSeatId must be different p:/g: UUID identities';
    END IF;

    IF lower(left(v_outgoing_seat, 2)) = 'p:' THEN
      v_outgoing_player_id := substr(v_outgoing_seat, 3)::uuid;
      v_outgoing_guest_id := NULL;
    ELSE
      v_outgoing_player_id := NULL;
      v_outgoing_guest_id := substr(v_outgoing_seat, 3)::uuid;
    END IF;

    IF lower(left(v_incoming_seat, 2)) = 'p:' THEN
      v_incoming_player_id := substr(v_incoming_seat, 3)::uuid;
      v_incoming_guest_id := NULL;
    ELSE
      v_incoming_player_id := NULL;
      v_incoming_guest_id := substr(v_incoming_seat, 3)::uuid;
    END IF;

    SELECT count(*)
      INTO v_outgoing_count
      FROM public.round_robin_players rp
     WHERE rp.event_id = p_event_id
       AND rp.active = true
       AND (
         (v_outgoing_player_id IS NOT NULL AND rp.player_id = v_outgoing_player_id)
         OR (v_outgoing_guest_id IS NOT NULL AND rp.guest_player_id = v_outgoing_guest_id)
       );

    IF v_outgoing_count <> 1 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'RR_INVALID_SUBSTITUTION:The outgoing identity must match exactly one active event participant';
    END IF;

    SELECT *
      INTO v_outgoing
      FROM public.round_robin_players rp
     WHERE rp.event_id = p_event_id
       AND rp.active = true
       AND (
         (v_outgoing_player_id IS NOT NULL AND rp.player_id = v_outgoing_player_id)
         OR (v_outgoing_guest_id IS NOT NULL AND rp.guest_player_id = v_outgoing_guest_id)
       )
     FOR UPDATE;

    IF EXISTS (
      SELECT 1
        FROM public.round_robin_players rp
       WHERE rp.event_id = p_event_id
         AND rp.active = true
         AND (
           (v_incoming_player_id IS NOT NULL AND rp.player_id = v_incoming_player_id)
           OR (v_incoming_guest_id IS NOT NULL AND rp.guest_player_id = v_incoming_guest_id)
         )
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'RR_INVALID_SUBSTITUTION:The incoming identity is already active in this event';
    END IF;

    IF v_incoming_player_id IS NOT NULL THEN
      PERFORM 1 FROM public.profiles profile WHERE profile.id = v_incoming_player_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'RR_INVALID_SUBSTITUTION:The incoming profile was not found';
      END IF;
    ELSE
      SELECT *
        INTO v_guest
        FROM public.guest_players guest
       WHERE guest.id = v_incoming_guest_id
       FOR SHARE;
      IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'RR_INVALID_SUBSTITUTION:The incoming saved guest was not found';
      END IF;
    END IF;

    SELECT count(*)
      INTO v_incoming_count
      FROM public.round_robin_players rp
     WHERE rp.event_id = p_event_id
       AND rp.active = false
       AND (
         (v_incoming_player_id IS NOT NULL AND rp.player_id = v_incoming_player_id)
         OR (v_incoming_guest_id IS NOT NULL AND rp.guest_player_id = v_incoming_guest_id)
       );

    IF v_incoming_count > 1 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'RR_INVALID_SUBSTITUTION:The incoming identity has duplicate inactive roster rows';
    END IF;

    IF v_incoming_count = 1 THEN
      SELECT *
        INTO v_incoming
        FROM public.round_robin_players rp
       WHERE rp.event_id = p_event_id
         AND rp.active = false
         AND (
           (v_incoming_player_id IS NOT NULL AND rp.player_id = v_incoming_player_id)
           OR (v_incoming_guest_id IS NOT NULL AND rp.guest_player_id = v_incoming_guest_id)
         )
       FOR UPDATE;

      -- Reactivation intentionally precedes relinking: the lifecycle trigger
      -- clears any terminal links from an earlier active stint.
      UPDATE public.round_robin_players
         SET status = 'active'::public.rr_participant_status,
             active = true,
             registration_status = 'confirmed',
             withdrawn_at = NULL,
             withdrawal_reason = NULL,
             effective_round = NULL,
             updated_by = p_actor_id,
             updated_at = now()
       WHERE id = v_incoming.id
       RETURNING * INTO v_incoming;
    ELSE
      IF v_incoming_guest_id IS NOT NULL
         AND NOT (
           v_guest.created_by = v_event.organizer_id
           OR v_actor_is_admin
           OR (
             v_event.group_id IS NOT NULL
             AND v_guest.group_id = v_event.group_id
           )
         ) THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'RR_UNAUTHORIZED:The saved guest must belong to the organizer or this event group';
      END IF;

      INSERT INTO public.round_robin_players (
        event_id,
        player_id,
        guest_player_id,
        active,
        status,
        registration_status,
        effective_round,
        updated_by
      ) VALUES (
        p_event_id,
        v_incoming_player_id,
        v_incoming_guest_id,
        true,
        'active'::public.rr_participant_status,
        'confirmed',
        p_regenerate_from_round,
        p_actor_id
      )
      RETURNING * INTO v_incoming;
    END IF;

    UPDATE public.round_robin_players
       SET status = 'replaced'::public.rr_participant_status,
           active = false,
           withdrawn_at = now(),
           withdrawal_reason = COALESCE(NULLIF(btrim(p_reason), ''), 'Global round-robin substitution'),
           effective_round = p_regenerate_from_round,
           replacement_participant_id = v_incoming.id,
           updated_by = p_actor_id,
           updated_at = now()
     WHERE id = v_outgoing.id
     RETURNING * INTO v_outgoing;

    UPDATE public.round_robin_players
       SET replaced_participant_id = v_outgoing.id,
           replacement_participant_id = NULL,
           effective_round = p_regenerate_from_round,
           updated_by = p_actor_id,
           updated_at = now()
     WHERE id = v_incoming.id
     RETURNING * INTO v_incoming;

    IF v_incoming_guest_id IS NOT NULL THEN
      UPDATE public.round_robin_events
         SET rating_eligible = false,
             rating_exclusion_reason = COALESCE(
               rating_exclusion_reason,
               'Guest substitute introduced during event'
             ),
             updated_at = now()
       WHERE id = p_event_id;
    END IF;

    v_substitution_result := jsonb_build_object(
      'outgoingSeatId', CASE
        WHEN v_outgoing.player_id IS NOT NULL THEN 'p:' || v_outgoing.player_id::text
        ELSE 'g:' || v_outgoing.guest_player_id::text
      END,
      'incomingSeatId', CASE
        WHEN v_incoming.player_id IS NOT NULL THEN 'p:' || v_incoming.player_id::text
        ELSE 'g:' || v_incoming.guest_player_id::text
      END,
      'outgoing_roster_id', v_outgoing.id,
      'incoming_roster_id', v_incoming.id,
      'effective_round', p_regenerate_from_round
    );
  END IF;

  SELECT count(*)
    INTO v_active_players
    FROM public.round_robin_players rp
   WHERE rp.event_id = p_event_id
     AND rp.active = true
     AND (rp.player_id IS NOT NULL OR rp.guest_player_id IS NOT NULL);

  IF EXISTS (
    SELECT 1
      FROM public.round_robin_players rp
     WHERE rp.event_id = p_event_id
       AND rp.active = true
       AND rp.player_id IS NULL
       AND rp.guest_player_id IS NULL
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RR_INVALID_ROSTER:An active roster row has no linked player or saved guest';
  END IF;

  IF v_active_players < 4 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RR_INSUFFICIENT_PLAYERS:At least four active players are required';
  END IF;

  IF v_event.format::text = 'male' AND EXISTS (
    SELECT 1
      FROM public.round_robin_players rp
      LEFT JOIN public.profiles profile ON profile.id = rp.player_id
      LEFT JOIN public.guest_players guest ON guest.id = rp.guest_player_id
      LEFT JOIN public.profiles linked_profile ON linked_profile.id = guest.linked_user_id
     WHERE rp.event_id = p_event_id
       AND rp.active = true
       AND COALESCE(profile.gender, linked_profile.gender, guest.gender) IS DISTINCT FROM 'male'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RR_INVALID_ROSTER:Every player in a men''s event must be marked male';
  END IF;

  IF v_event.format::text = 'female' AND EXISTS (
    SELECT 1
      FROM public.round_robin_players rp
      LEFT JOIN public.profiles profile ON profile.id = rp.player_id
      LEFT JOIN public.guest_players guest ON guest.id = rp.guest_player_id
      LEFT JOIN public.profiles linked_profile ON linked_profile.id = guest.linked_user_id
     WHERE rp.event_id = p_event_id
       AND rp.active = true
       AND COALESCE(profile.gender, linked_profile.gender, guest.gender) IS DISTINCT FROM 'female'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RR_INVALID_ROSTER:Every player in a women''s event must be marked female';
  END IF;

  IF v_event.format::text = 'mixed' AND EXISTS (
    SELECT 1
      FROM public.round_robin_players rp
      LEFT JOIN public.profiles profile ON profile.id = rp.player_id
      LEFT JOIN public.guest_players guest ON guest.id = rp.guest_player_id
      LEFT JOIN public.profiles linked_profile ON linked_profile.id = guest.linked_user_id
     WHERE rp.event_id = p_event_id
       AND rp.active = true
       AND (
         COALESCE(profile.gender, linked_profile.gender, guest.gender) IS NULL
         OR COALESCE(profile.gender, linked_profile.gender, guest.gender) NOT IN ('male', 'female')
       )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RR_INVALID_ROSTER:Every mixed-doubles player needs a male or female designation';
  END IF;

  -- Persisted allocation state must describe the complete post-mutation
  -- active roster exactly once. Validate its raw JSON shape before typed casts
  -- so malformed or overflowing values fail cleanly before any schedule row is
  -- deleted.
  IF p_allocation IS NULL OR jsonb_typeof(p_allocation) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'RR_INVALID_ALLOCATION:allocation must be a JSON array';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(p_allocation) entry
     WHERE jsonb_typeof(entry) IS DISTINCT FROM 'object'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'RR_INVALID_ALLOCATION:every allocation entry must be an object';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(p_allocation) entry
     WHERE (SELECT count(*) FROM jsonb_object_keys(entry)) <> 3
        OR NOT (entry ? 'seat_id')
        OR NOT (entry ? 'game_credit')
        OR NOT (entry ? 'first_eligible_round')
        OR jsonb_typeof(entry -> 'seat_id') IS DISTINCT FROM 'string'
        OR jsonb_typeof(entry -> 'game_credit') IS DISTINCT FROM 'number'
        OR jsonb_typeof(entry -> 'first_eligible_round') IS DISTINCT FROM 'number'
        OR (entry ->> 'seat_id') !~* '^[pg]:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        OR (entry ->> 'game_credit') !~ '^(0|[1-9][0-9]*)$'
        OR (entry ->> 'first_eligible_round') !~ '^[1-9][0-9]*$'
        OR length(entry ->> 'game_credit') > 2
        OR length(entry ->> 'first_eligible_round') > 10
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'RR_INVALID_ALLOCATION:entries require only seat_id, integer game_credit, and integer first_eligible_round';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM jsonb_to_recordset(p_allocation) AS x(
        seat_id text,
        game_credit bigint,
        first_eligible_round bigint
      )
     WHERE x.game_credit < 0
        OR x.game_credit > 20
        OR x.first_eligible_round < 1
        OR x.first_eligible_round > LEAST(
          p_num_rounds::bigint + 1,
          2147483647::bigint
        )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'RR_INVALID_ALLOCATION:allocation values fall outside the event bounds';
  END IF;

  SELECT count(*), count(DISTINCT lower(x.seat_id))
    INTO v_allocation_count, v_allocation_unique_count
    FROM jsonb_to_recordset(p_allocation) AS x(seat_id text);

  IF v_allocation_count <> v_active_players
     OR v_allocation_unique_count <> v_active_players THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'RR_INVALID_ALLOCATION:allocation must contain one unique entry per active participant';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM jsonb_to_recordset(p_allocation) AS x(seat_id text)
     WHERE NOT EXISTS (
       SELECT 1
         FROM public.round_robin_players rp
        WHERE rp.event_id = p_event_id
          AND rp.active = true
          AND (
            (
              lower(left(x.seat_id, 2)) = 'p:'
              AND rp.player_id = substr(x.seat_id, 3)::uuid
            )
            OR (
              lower(left(x.seat_id, 2)) = 'g:'
              AND rp.guest_player_id = substr(x.seat_id, 3)::uuid
            )
          )
     )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'RR_INVALID_ALLOCATION:allocation contains an identity outside the active roster';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.round_robin_players rp
     WHERE rp.event_id = p_event_id
       AND rp.active = true
       AND NOT EXISTS (
         SELECT 1
           FROM jsonb_to_recordset(p_allocation) AS x(seat_id text)
          WHERE (
            rp.player_id IS NOT NULL
            AND lower(left(x.seat_id, 2)) = 'p:'
            AND rp.player_id = substr(x.seat_id, 3)::uuid
          ) OR (
            rp.guest_player_id IS NOT NULL
            AND lower(left(x.seat_id, 2)) = 'g:'
            AND rp.guest_player_id = substr(x.seat_id, 3)::uuid
          )
       )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'RR_INVALID_ALLOCATION:allocation is missing an active roster identity';
  END IF;

  -- Scoring locks a schedule row too. Taking row locks before re-checking its
  -- state closes the race where a score could commit between validation and
  -- deletion of the mutable schedule.
  PERFORM 1
    FROM public.round_robin_schedule s
   WHERE s.event_id = p_event_id
     AND s.round_no >= p_regenerate_from_round
     AND s.voided_at IS NULL
     AND s.superseded_by_schedule_id IS NULL
   ORDER BY s.id
   FOR UPDATE;

  -- A live/displayed, abandoned, locked, scored, or match-linked row is
  -- immutable. The edge planner must move its boundary after every such round.
  IF EXISTS (
    SELECT 1
      FROM public.round_robin_schedule s
     WHERE s.event_id = p_event_id
       AND s.round_no >= p_regenerate_from_round
       AND s.voided_at IS NULL
       AND s.superseded_by_schedule_id IS NULL
       AND (
         s.locked_at IS NOT NULL
         OR s.match_id IS NOT NULL
         OR s.team1_score IS NOT NULL
         OR s.team2_score IS NOT NULL
         OR COALESCE(s.abandoned, false)
         OR (
           v_event.status::text = 'live'
           AND s.round_no <= COALESCE(v_event.current_round, 1)
         )
       )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RR_PROTECTED_ROUND:The rebuild boundary includes live or completed play';
  END IF;

  -- Parse and validate every generated row before deleting anything.
  IF EXISTS (
    SELECT 1
      FROM jsonb_to_recordset(p_schedule) AS x(
        round_no integer,
        court_no integer,
        is_bye boolean,
        a1_player_id uuid, a1_guest_id uuid,
        a2_player_id uuid, a2_guest_id uuid,
        b1_player_id uuid, b1_guest_id uuid,
        b2_player_id uuid, b2_guest_id uuid
      )
     WHERE x.round_no IS NULL
        OR x.court_no IS NULL
        OR x.is_bye IS NULL
        OR x.round_no < p_regenerate_from_round
        OR x.round_no > p_num_rounds
        OR x.court_no < 1
        OR (NOT x.is_bye AND x.court_no > p_num_courts)
        OR (x.is_bye AND x.court_no <= p_num_courts)
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RR_INVALID_PLAN:A row falls outside the requested round or court range';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM jsonb_to_recordset(p_schedule) AS x(round_no integer, court_no integer)
     GROUP BY x.round_no, x.court_no
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RR_INVALID_PLAN:Duplicate round/court slots';
  END IF;

  -- A normal match has four XOR-filled seats. A bye's only identity must be
  -- A1 because player/kiosk consumers resolve that canonical seat directly.
  IF EXISTS (
    SELECT 1
      FROM jsonb_to_recordset(p_schedule) AS x(
        is_bye boolean,
        a1_player_id uuid, a1_guest_id uuid,
        a2_player_id uuid, a2_guest_id uuid,
        b1_player_id uuid, b1_guest_id uuid,
        b2_player_id uuid, b2_guest_id uuid
      )
     WHERE CASE WHEN x.is_bye THEN
       ((x.a1_player_id IS NOT NULL)::integer + (x.a1_guest_id IS NOT NULL)::integer) <> 1
       OR x.a2_player_id IS NOT NULL OR x.a2_guest_id IS NOT NULL
       OR x.b1_player_id IS NOT NULL OR x.b1_guest_id IS NOT NULL
       OR x.b2_player_id IS NOT NULL OR x.b2_guest_id IS NOT NULL
     ELSE
       ((x.a1_player_id IS NOT NULL)::integer + (x.a1_guest_id IS NOT NULL)::integer) <> 1
       OR ((x.a2_player_id IS NOT NULL)::integer + (x.a2_guest_id IS NOT NULL)::integer) <> 1
       OR ((x.b1_player_id IS NOT NULL)::integer + (x.b1_guest_id IS NOT NULL)::integer) <> 1
       OR ((x.b2_player_id IS NOT NULL)::integer + (x.b2_guest_id IS NOT NULL)::integer) <> 1
     END
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RR_INVALID_PLAN:Every game must have four players and every bye must have one';
  END IF;

  -- Capacity is computed by the shared planner (including mixed eligibility)
  -- and carried in the service-only impact payload. Enforce it per round so a
  -- malformed all-bye or under-filled plan can never be committed.
  IF EXISTS (
    SELECT 1
      FROM jsonb_to_recordset(p_schedule) AS x(round_no integer, is_bye boolean)
     GROUP BY x.round_no
    HAVING count(*) FILTER (WHERE NOT x.is_bye) <> v_expected_matches_per_round
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RR_INVALID_PLAN:Playable matches do not match the calculated court capacity';
  END IF;

  -- Every scheduled identity must be on the event's active roster.
  IF EXISTS (
    WITH rows AS (
      SELECT *
        FROM jsonb_to_recordset(p_schedule) AS x(
          round_no integer,
          a1_player_id uuid, a1_guest_id uuid,
          a2_player_id uuid, a2_guest_id uuid,
          b1_player_id uuid, b1_guest_id uuid,
          b2_player_id uuid, b2_guest_id uuid
        )
    ), seats AS (
      SELECT r.round_no, v.player_id, v.guest_id
        FROM rows r
        CROSS JOIN LATERAL (VALUES
          (r.a1_player_id, r.a1_guest_id),
          (r.a2_player_id, r.a2_guest_id),
          (r.b1_player_id, r.b1_guest_id),
          (r.b2_player_id, r.b2_guest_id)
        ) AS v(player_id, guest_id)
       WHERE v.player_id IS NOT NULL OR v.guest_id IS NOT NULL
    )
    SELECT 1
      FROM seats seat
     WHERE NOT EXISTS (
       SELECT 1
         FROM public.round_robin_players rp
        WHERE rp.event_id = p_event_id
          AND rp.active = true
          AND (
            (seat.player_id IS NOT NULL AND rp.player_id = seat.player_id)
            OR (seat.guest_id IS NOT NULL AND rp.guest_player_id = seat.guest_id)
          )
     )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RR_INVALID_ROSTER:The plan contains a player who is not active in this event';
  END IF;

  IF v_event.format::text = 'mixed' AND EXISTS (
    WITH rows AS (
      SELECT *
        FROM jsonb_to_recordset(p_schedule) AS x(
          round_no integer,
          court_no integer,
          is_bye boolean,
          a1_player_id uuid, a1_guest_id uuid,
          a2_player_id uuid, a2_guest_id uuid,
          b1_player_id uuid, b1_guest_id uuid,
          b2_player_id uuid, b2_guest_id uuid
        )
    ), seats AS (
      SELECT r.round_no, r.court_no, v.team, v.player_id, v.guest_id
        FROM rows r
        CROSS JOIN LATERAL (VALUES
          ('A', r.a1_player_id, r.a1_guest_id),
          ('A', r.a2_player_id, r.a2_guest_id),
          ('B', r.b1_player_id, r.b1_guest_id),
          ('B', r.b2_player_id, r.b2_guest_id)
        ) AS v(team, player_id, guest_id)
       WHERE r.is_bye = false
    ), gendered AS (
      SELECT seat.round_no,
             seat.court_no,
             seat.team,
             COALESCE(profile.gender, linked_profile.gender, guest.gender) AS gender
        FROM seats seat
        LEFT JOIN public.profiles profile ON profile.id = seat.player_id
        LEFT JOIN public.guest_players guest ON guest.id = seat.guest_id
        LEFT JOIN public.profiles linked_profile ON linked_profile.id = guest.linked_user_id
    )
    SELECT 1
      FROM gendered
     GROUP BY round_no, court_no, team
    HAVING count(*) FILTER (WHERE gender = 'male') <> 1
        OR count(*) FILTER (WHERE gender = 'female') <> 1
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RR_INVALID_PLAN:Every mixed-doubles team must contain one man and one woman';
  END IF;

  -- No identity may play or rest twice in one round, including across courts.
  IF EXISTS (
    WITH rows AS (
      SELECT *
        FROM jsonb_to_recordset(p_schedule) AS x(
          round_no integer,
          a1_player_id uuid, a1_guest_id uuid,
          a2_player_id uuid, a2_guest_id uuid,
          b1_player_id uuid, b1_guest_id uuid,
          b2_player_id uuid, b2_guest_id uuid
        )
    ), seats AS (
      SELECT r.round_no,
             CASE WHEN v.player_id IS NOT NULL
                  THEN 'p:' || v.player_id::text
                  ELSE 'g:' || v.guest_id::text END AS seat_key
        FROM rows r
        CROSS JOIN LATERAL (VALUES
          (r.a1_player_id, r.a1_guest_id),
          (r.a2_player_id, r.a2_guest_id),
          (r.b1_player_id, r.b1_guest_id),
          (r.b2_player_id, r.b2_guest_id)
        ) AS v(player_id, guest_id)
       WHERE v.player_id IS NOT NULL OR v.guest_id IS NOT NULL
    )
    SELECT 1
      FROM seats
     GROUP BY round_no, seat_key
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RR_INVALID_PLAN:A player appears more than once in a round';
  END IF;

  -- The scheduler emits either a match seat or an explicit bye for every
  -- active participant in every generated round.  Counting after the
  -- duplicate/membership checks proves nobody silently disappears.
  IF EXISTS (
    WITH rows AS (
      SELECT *
        FROM jsonb_to_recordset(p_schedule) AS x(
          round_no integer,
          a1_player_id uuid, a1_guest_id uuid,
          a2_player_id uuid, a2_guest_id uuid,
          b1_player_id uuid, b1_guest_id uuid,
          b2_player_id uuid, b2_guest_id uuid
        )
    ), seats AS (
      SELECT r.round_no
        FROM rows r
        CROSS JOIN LATERAL (VALUES
          (r.a1_player_id, r.a1_guest_id),
          (r.a2_player_id, r.a2_guest_id),
          (r.b1_player_id, r.b1_guest_id),
          (r.b2_player_id, r.b2_guest_id)
        ) AS v(player_id, guest_id)
       WHERE v.player_id IS NOT NULL OR v.guest_id IS NOT NULL
    )
    SELECT 1
      FROM seats
     GROUP BY round_no
    HAVING count(*) <> v_active_players
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RR_INVALID_PLAN:Every active player must be assigned once in every generated round';
  END IF;

  SELECT count(DISTINCT x.round_no), COALESCE(max(x.round_no), 0)
    INTO v_distinct_rounds, v_max_round
    FROM jsonb_to_recordset(p_schedule) AS x(round_no integer);

  IF p_num_rounds >= p_regenerate_from_round AND (
    v_distinct_rounds <> p_num_rounds - p_regenerate_from_round + 1
    OR v_max_round <> p_num_rounds
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RR_INVALID_PLAN:The replacement schedule has a missing round';
  END IF;

  IF p_num_rounds < p_regenerate_from_round AND jsonb_array_length(p_schedule) <> 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RR_INVALID_PLAN:Unexpected rows after the final protected round';
  END IF;

  DELETE FROM public.round_robin_schedule s
   WHERE s.event_id = p_event_id
     AND s.round_no >= p_regenerate_from_round
     AND s.voided_at IS NULL
     AND s.superseded_by_schedule_id IS NULL;
  GET DIAGNOSTICS v_deleted_rows = ROW_COUNT;

  INSERT INTO public.round_robin_schedule (
    event_id, round_no, court_no, is_bye,
    a1_player_id, a1_guest_id,
    a2_player_id, a2_guest_id,
    b1_player_id, b1_guest_id,
    b2_player_id, b2_guest_id
  )
  SELECT
    p_event_id, x.round_no, x.court_no, x.is_bye,
    x.a1_player_id, x.a1_guest_id,
    x.a2_player_id, x.a2_guest_id,
    x.b1_player_id, x.b1_guest_id,
    x.b2_player_id, x.b2_guest_id
  FROM jsonb_to_recordset(p_schedule) AS x(
    round_no integer,
    court_no integer,
    is_bye boolean,
    a1_player_id uuid, a1_guest_id uuid,
    a2_player_id uuid, a2_guest_id uuid,
    b1_player_id uuid, b1_guest_id uuid,
    b2_player_id uuid, b2_guest_id uuid
  );
  GET DIAGNOSTICS v_inserted_rows = ROW_COUNT;

  UPDATE public.round_robin_players rp
     SET schedule_game_credit = allocation.game_credit,
         schedule_first_eligible_round = allocation.first_eligible_round,
         updated_by = p_actor_id,
         updated_at = now()
    FROM jsonb_to_recordset(p_allocation) AS allocation(
      seat_id text,
      game_credit integer,
      first_eligible_round integer
    )
   WHERE rp.event_id = p_event_id
     AND rp.active = true
     AND (
       (
         lower(left(allocation.seat_id, 2)) = 'p:'
         AND rp.player_id = substr(allocation.seat_id, 3)::uuid
       )
       OR (
         lower(left(allocation.seat_id, 2)) = 'g:'
         AND rp.guest_player_id = substr(allocation.seat_id, 3)::uuid
       )
     );
  GET DIAGNOSTICS v_allocation_updated = ROW_COUNT;

  IF v_allocation_updated <> v_active_players THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RR_INVALID_ALLOCATION:allocation metadata was not persisted for every active participant';
  END IF;

  v_new_version := COALESCE(v_event.schedule_version, 0) + 1;

  UPDATE public.round_robin_events
     SET num_courts = p_num_courts,
         num_rounds = p_num_rounds,
         games_per_player = p_games_per_player,
         schedule_version = v_new_version,
         updated_at = now()
   WHERE id = p_event_id;

  IF v_substitution_result IS NOT NULL THEN
    INSERT INTO public.round_robin_audit (
      event_id, editor_id, change_type, changes, reason
    ) VALUES (
      p_event_id,
      p_actor_id,
      'participant_replaced',
      jsonb_build_object(
        'request_id', p_request_id,
        'substitution', v_substitution_result,
        'schedule_version_before', COALESCE(v_event.schedule_version, 0),
        'schedule_version_after', v_new_version,
        'rating_eligible_before', v_event.rating_eligible,
        'rating_eligible_after', CASE
          WHEN v_incoming_guest_id IS NOT NULL THEN false
          ELSE v_event.rating_eligible
        END
      ),
      COALESCE(NULLIF(btrim(p_reason), ''), 'Global round-robin substitution')
    );
  END IF;

  INSERT INTO public.round_robin_audit (
    event_id, editor_id, change_type, changes, reason
  ) VALUES (
    p_event_id,
    p_actor_id,
    'schedule_rebuild',
    jsonb_build_object(
      'before', jsonb_build_object(
        'num_courts', v_event.num_courts,
        'num_rounds', v_event.num_rounds,
        'games_per_player', v_event.games_per_player,
        'schedule_version', COALESCE(v_event.schedule_version, 0)
      ),
      'after', jsonb_build_object(
        'num_courts', p_num_courts,
        'num_rounds', p_num_rounds,
        'games_per_player', p_games_per_player,
        'schedule_version', v_new_version
      ),
      'regenerate_from_round', p_regenerate_from_round,
      'deleted_rows', v_deleted_rows,
      'inserted_rows', v_inserted_rows,
      'impact', COALESCE(p_impact, '{}'::jsonb),
      'substitution', v_substitution_result,
      'allocation', p_allocation
    ),
    COALESCE(NULLIF(btrim(p_reason), ''), 'Round-robin schedule rebuilt')
  );

  v_response := jsonb_build_object(
    'ok', true,
    'request_id', p_request_id,
    'schedule_version', v_new_version,
    'num_courts', p_num_courts,
    'num_rounds', p_num_rounds,
    'games_per_player', p_games_per_player,
    'regenerate_from_round', p_regenerate_from_round,
    'deleted_rows', v_deleted_rows,
    'inserted_rows', v_inserted_rows,
    'allocation_updated', v_allocation_updated,
    'substitution', v_substitution_result,
    'allocation', p_allocation
  );

  UPDATE public.rr_schedule_mutation_requests
     SET status = 'completed',
         response = v_response,
         completed_at = now()
   WHERE request_id = p_request_id;

  RETURN v_response;
END;
$$;

REVOKE ALL ON FUNCTION public.rr_apply_schedule_rebuild(
  uuid, uuid, uuid, integer, integer, integer, integer, integer, jsonb, jsonb, text, jsonb, jsonb
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.rr_apply_schedule_rebuild(
  uuid, uuid, uuid, integer, integer, integer, integer, integer, jsonb, jsonb, text, jsonb, jsonb
) TO service_role;

COMMENT ON FUNCTION public.rr_apply_schedule_rebuild(
  uuid, uuid, uuid, integer, integer, integer, integer, integer, jsonb, jsonb, text, jsonb, jsonb
) IS 'Atomically validates a future schedule rebuild, applies any roster replacement, persists allocation metadata, replaces only mutable rounds, updates schedule settings/version, and records audits. Edge-function/service-role only.';

-- Manual host edits use the same optimistic schedule version as full rebuilds.
-- Keeping these operations in one RPC prevents half-applied opponent swaps and
-- ensures a court move either swaps both occupied slots or changes nothing.
CREATE OR REPLACE FUNCTION public.rr_edit_schedule(
  p_request_id uuid,
  p_event_id uuid,
  p_expected_version integer,
  p_action text,
  p_match_id uuid,
  p_second_match_id uuid DEFAULT NULL,
  p_new_court_no integer DEFAULT NULL,
  p_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_event public.round_robin_events%ROWTYPE;
  v_existing public.rr_schedule_mutation_requests%ROWTYPE;
  v_first public.round_robin_schedule%ROWTYPE;
  v_second public.round_robin_schedule%ROWTYPE;
  v_destination public.round_robin_schedule%ROWTYPE;
  v_new_version integer;
  v_temp_court bigint;
  v_input_hash text;
  v_changes jsonb;
  v_reason text;
  v_response jsonb;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'RR_UNAUTHORIZED:Authentication required';
  END IF;

  IF p_request_id IS NULL OR p_event_id IS NULL OR p_match_id IS NULL OR p_action IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'RR_INVALID_EDIT:request, event, action, and match are required';
  END IF;

  IF p_action NOT IN ('rotate_partners', 'swap_opponents', 'move_court') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'RR_INVALID_EDIT:Unsupported schedule action';
  END IF;

  IF p_expected_version IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'RR_INVALID_EDIT:An exact schedule version is required';
  END IF;

  v_input_hash := encode(extensions.digest(
    jsonb_build_object(
      'kind', 'edit',
      'event_id', p_event_id,
      'actor_id', v_actor,
      'expected_version', p_expected_version,
      'action', p_action,
      'match_id', p_match_id,
      'second_match_id', p_second_match_id,
      'new_court_no', p_new_court_no,
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

  IF v_event.organizer_id <> v_actor
     AND NOT public.has_role(v_actor, 'admin'::public.app_role) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'RR_UNAUTHORIZED:Only the organizer or an administrator can edit this schedule';
  END IF;

  IF COALESCE(v_event.voided, false)
     OR v_event.status::text IN ('completed', 'voided') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'RR_EVENT_CLOSED:The schedule can no longer be edited';
  END IF;

  SELECT *
    INTO v_existing
    FROM public.rr_schedule_mutation_requests
   WHERE request_id = p_request_id;

  IF FOUND THEN
    IF v_existing.input_hash <> v_input_hash
       OR v_existing.mutation_kind <> 'edit' THEN
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
    p_request_id, p_event_id, v_actor, 'edit', v_input_hash, 'in_progress'
  );

  IF p_expected_version <> COALESCE(v_event.schedule_version, 0) THEN
    RAISE EXCEPTION USING
      ERRCODE = '40001',
      MESSAGE = 'RR_STALE_VERSION:' || jsonb_build_object(
        'expected', p_expected_version,
        'current', COALESCE(v_event.schedule_version, 0)
      )::text;
  END IF;

  SELECT *
    INTO v_first
    FROM public.round_robin_schedule
   WHERE id = p_match_id
     AND event_id = p_event_id
     AND voided_at IS NULL
     AND superseded_by_schedule_id IS NULL
     AND is_bye = false
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'RR_MATCH_NOT_FOUND:The selected active match was not found';
  END IF;

  IF v_first.locked_at IS NOT NULL
     OR v_first.match_id IS NOT NULL
     OR v_first.team1_score IS NOT NULL
     OR v_first.team2_score IS NOT NULL
     OR COALESCE(v_first.abandoned, false)
     OR (
       v_event.status::text = 'live'
       AND v_first.round_no <= COALESCE(v_event.current_round, 1)
     ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'RR_PROTECTED_ROUND:Current, scored, linked, or locked play cannot be edited';
  END IF;

  IF p_action = 'rotate_partners' THEN
    -- Open/men's/women's A1/A2 vs B1/B2 becomes A1/B1 vs A2/B2.
    -- Mixed schedules keep one man and one woman together by using the other
    -- cross-pairing: A1/B2 vs B1/A2. Either path creates real new partners.
    IF v_event.format::text = 'mixed' THEN
      UPDATE public.round_robin_schedule
         SET a2_player_id = v_first.b2_player_id,
             a2_guest_id = v_first.b2_guest_id,
             b2_player_id = v_first.a2_player_id,
             b2_guest_id = v_first.a2_guest_id
       WHERE id = v_first.id;
    ELSE
      UPDATE public.round_robin_schedule
         SET a2_player_id = v_first.b1_player_id,
             a2_guest_id = v_first.b1_guest_id,
             b1_player_id = v_first.a2_player_id,
             b1_guest_id = v_first.a2_guest_id
       WHERE id = v_first.id;
    END IF;

    v_changes := jsonb_build_object(
      'action', p_action,
      'match_id', v_first.id,
      'round_no', v_first.round_no,
      'court_no', v_first.court_no,
      'before', jsonb_build_object(
        'a1', COALESCE(v_first.a1_player_id::text, 'g:' || v_first.a1_guest_id::text),
        'a2', COALESCE(v_first.a2_player_id::text, 'g:' || v_first.a2_guest_id::text),
        'b1', COALESCE(v_first.b1_player_id::text, 'g:' || v_first.b1_guest_id::text),
        'b2', COALESCE(v_first.b2_player_id::text, 'g:' || v_first.b2_guest_id::text)
      ),
      'after', jsonb_build_object(
        'team_a', jsonb_build_array(
          COALESCE(v_first.a1_player_id::text, 'g:' || v_first.a1_guest_id::text),
          CASE WHEN v_event.format::text = 'mixed'
            THEN COALESCE(v_first.b2_player_id::text, 'g:' || v_first.b2_guest_id::text)
            ELSE COALESCE(v_first.b1_player_id::text, 'g:' || v_first.b1_guest_id::text)
          END
        ),
        'team_b', jsonb_build_array(
          COALESCE(v_first.a2_player_id::text, 'g:' || v_first.a2_guest_id::text),
          CASE WHEN v_event.format::text = 'mixed'
            THEN COALESCE(v_first.b1_player_id::text, 'g:' || v_first.b1_guest_id::text)
            ELSE COALESCE(v_first.b2_player_id::text, 'g:' || v_first.b2_guest_id::text)
          END
        )
      )
    );
    v_reason := format('Rotated partners in Round %s, Court %s', v_first.round_no, v_first.court_no);

  ELSIF p_action = 'swap_opponents' THEN
    IF p_second_match_id IS NULL OR p_second_match_id = p_match_id THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'RR_INVALID_EDIT:Choose two different matches';
    END IF;

    -- Lock the second row while the event lock serializes all schedule edits.
    SELECT *
      INTO v_second
      FROM public.round_robin_schedule
     WHERE id = p_second_match_id
       AND event_id = p_event_id
       AND voided_at IS NULL
       AND superseded_by_schedule_id IS NULL
       AND is_bye = false
     FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'RR_MATCH_NOT_FOUND:The second active match was not found';
    END IF;

    IF v_second.round_no <> v_first.round_no THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'RR_INVALID_EDIT:Opponent swaps must stay within one round';
    END IF;

    IF v_second.locked_at IS NOT NULL
       OR v_second.match_id IS NOT NULL
       OR v_second.team1_score IS NOT NULL
       OR v_second.team2_score IS NOT NULL
       OR COALESCE(v_second.abandoned, false) THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'RR_PROTECTED_ROUND:Current, scored, linked, or locked play cannot be edited';
    END IF;

    -- Exchange Match 1 Team B with Match 2 Team A as one transaction.
    UPDATE public.round_robin_schedule
       SET b1_player_id = v_second.a1_player_id,
           b1_guest_id = v_second.a1_guest_id,
           b2_player_id = v_second.a2_player_id,
           b2_guest_id = v_second.a2_guest_id
     WHERE id = v_first.id;

    UPDATE public.round_robin_schedule
       SET a1_player_id = v_first.b1_player_id,
           a1_guest_id = v_first.b1_guest_id,
           a2_player_id = v_first.b2_player_id,
           a2_guest_id = v_first.b2_guest_id
     WHERE id = v_second.id;

    v_changes := jsonb_build_object(
      'action', p_action,
      'round_no', v_first.round_no,
      'first_match_id', v_first.id,
      'first_court_no', v_first.court_no,
      'second_match_id', v_second.id,
      'second_court_no', v_second.court_no,
      'moved_to_first_team_b', jsonb_build_array(
        COALESCE(v_second.a1_player_id::text, 'g:' || v_second.a1_guest_id::text),
        COALESCE(v_second.a2_player_id::text, 'g:' || v_second.a2_guest_id::text)
      ),
      'moved_to_second_team_a', jsonb_build_array(
        COALESCE(v_first.b1_player_id::text, 'g:' || v_first.b1_guest_id::text),
        COALESCE(v_first.b2_player_id::text, 'g:' || v_first.b2_guest_id::text)
      )
    );
    v_reason := format(
      'Swapped opponents between Round %s Courts %s and %s',
      v_first.round_no,
      v_first.court_no,
      v_second.court_no
    );

  ELSE
    IF p_new_court_no IS NULL
       OR p_new_court_no < 1
       OR p_new_court_no > v_event.num_courts THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'RR_INVALID_EDIT:The destination court is outside this event''s court range';
    END IF;

    IF p_new_court_no = v_first.court_no THEN
      v_response := jsonb_build_object(
        'ok', true,
        'request_id', p_request_id,
        'action', p_action,
        'schedule_version', COALESCE(v_event.schedule_version, 0),
        'round_no', v_first.round_no,
        'no_op', true
      );
      UPDATE public.rr_schedule_mutation_requests
         SET status = 'completed', response = v_response, completed_at = now()
       WHERE request_id = p_request_id;
      RETURN v_response;
    END IF;

    SELECT *
      INTO v_destination
      FROM public.round_robin_schedule
     WHERE event_id = p_event_id
       AND round_no = v_first.round_no
       AND court_no = p_new_court_no
       AND voided_at IS NULL
       AND superseded_by_schedule_id IS NULL
       AND id <> v_first.id
     FOR UPDATE;

    IF FOUND THEN
      IF v_destination.is_bye
         OR v_destination.locked_at IS NOT NULL
         OR v_destination.match_id IS NOT NULL
         OR v_destination.team1_score IS NOT NULL
         OR v_destination.team2_score IS NOT NULL
         OR COALESCE(v_destination.abandoned, false) THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'RR_PROTECTED_ROUND:The destination slot cannot be moved';
      END IF;

      SELECT COALESCE(max(s.court_no::bigint), 0) + 1
        INTO v_temp_court
        FROM public.round_robin_schedule s
       WHERE s.event_id = p_event_id
         AND s.round_no = v_first.round_no
         AND s.voided_at IS NULL
         AND s.superseded_by_schedule_id IS NULL;

      IF v_temp_court > 2147483647 THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'RR_INVALID_EDIT:No temporary court slot is available';
      END IF;

      -- The active-slot index is intentionally immediate. A temporary slot
      -- makes the occupied-court exchange uniqueness-safe inside this RPC.
      UPDATE public.round_robin_schedule SET court_no = v_temp_court::integer WHERE id = v_first.id;
      UPDATE public.round_robin_schedule SET court_no = v_first.court_no WHERE id = v_destination.id;
      UPDATE public.round_robin_schedule SET court_no = p_new_court_no WHERE id = v_first.id;
    ELSE
      UPDATE public.round_robin_schedule
         SET court_no = p_new_court_no
       WHERE id = v_first.id;
    END IF;

    v_changes := jsonb_build_object(
      'action', p_action,
      'match_id', v_first.id,
      'round_no', v_first.round_no,
      'from_court_no', v_first.court_no,
      'to_court_no', p_new_court_no,
      'swapped_with_match_id', CASE WHEN v_destination.id IS NULL THEN NULL ELSE to_jsonb(v_destination.id) END
    );
    v_reason := CASE WHEN v_destination.id IS NULL
      THEN format('Moved Round %s from Court %s to Court %s', v_first.round_no, v_first.court_no, p_new_court_no)
      ELSE format('Swapped court assignments in Round %s between Courts %s and %s', v_first.round_no, v_first.court_no, p_new_court_no)
    END;
  END IF;

  -- Revalidate the complete affected round after the edit. Moving whole seat
  -- pairs preserves normal schedules, while these checks prevent an existing
  -- malformed or stale round from being silently carried forward.
  IF EXISTS (
    SELECT 1
      FROM public.round_robin_schedule s
     WHERE s.event_id = p_event_id
       AND s.round_no = v_first.round_no
       AND s.voided_at IS NULL
       AND s.superseded_by_schedule_id IS NULL
       AND s.is_bye = false
       AND (
         ((s.a1_player_id IS NOT NULL)::integer + (s.a1_guest_id IS NOT NULL)::integer) <> 1
         OR ((s.a2_player_id IS NOT NULL)::integer + (s.a2_guest_id IS NOT NULL)::integer) <> 1
         OR ((s.b1_player_id IS NOT NULL)::integer + (s.b1_guest_id IS NOT NULL)::integer) <> 1
         OR ((s.b2_player_id IS NOT NULL)::integer + (s.b2_guest_id IS NOT NULL)::integer) <> 1
       )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'RR_INVALID_EDIT:The affected round contains an incomplete match';
  END IF;

  IF EXISTS (
    WITH seats AS (
      SELECT CASE WHEN v.player_id IS NOT NULL
                  THEN 'p:' || v.player_id::text
                  ELSE 'g:' || v.guest_id::text END AS seat_key,
             v.player_id,
             v.guest_id
        FROM public.round_robin_schedule s
        CROSS JOIN LATERAL (VALUES
          (s.a1_player_id, s.a1_guest_id),
          (s.a2_player_id, s.a2_guest_id),
          (s.b1_player_id, s.b1_guest_id),
          (s.b2_player_id, s.b2_guest_id)
        ) AS v(player_id, guest_id)
       WHERE s.event_id = p_event_id
         AND s.round_no = v_first.round_no
         AND s.voided_at IS NULL
         AND s.superseded_by_schedule_id IS NULL
         AND (v.player_id IS NOT NULL OR v.guest_id IS NOT NULL)
    )
    SELECT 1
      FROM seats seat
     GROUP BY seat.seat_key
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'RR_INVALID_EDIT:A player appears more than once in the affected round';
  END IF;

  -- A one-round substitute is deliberately schedule-scoped and may not be an
  -- active roster member. The private completed-request ledger is the
  -- authoritative proof that such an identity entered this exact round via
  -- rr_substitute_round. Do not trust round_robin_audit here: authenticated
  -- clients can create their own audit rows under the legacy insert policy.
  IF EXISTS (
    WITH seats AS (
      SELECT v.player_id, v.guest_id
        FROM public.round_robin_schedule s
        CROSS JOIN LATERAL (VALUES
          (s.a1_player_id, s.a1_guest_id),
          (s.a2_player_id, s.a2_guest_id),
          (s.b1_player_id, s.b1_guest_id),
          (s.b2_player_id, s.b2_guest_id)
        ) AS v(player_id, guest_id)
       WHERE s.event_id = p_event_id
         AND s.round_no = v_first.round_no
         AND s.voided_at IS NULL
         AND s.superseded_by_schedule_id IS NULL
         AND (v.player_id IS NOT NULL OR v.guest_id IS NOT NULL)
    )
    SELECT 1
      FROM seats seat
     WHERE NOT EXISTS (
       SELECT 1
         FROM public.round_robin_players rp
        WHERE rp.event_id = p_event_id
          AND rp.active = true
          AND (
            (seat.player_id IS NOT NULL AND rp.player_id = seat.player_id)
            OR (seat.guest_id IS NOT NULL AND rp.guest_player_id = seat.guest_id)
          )
     )
       AND NOT EXISTS (
         SELECT 1
           FROM public.rr_schedule_mutation_requests request
          WHERE request.event_id = p_event_id
            AND request.mutation_kind = 'substitute_round'
            AND request.status = 'completed'
            AND request.response ->> 'round_no' = v_first.round_no::text
            AND (
              (
                seat.player_id IS NOT NULL
                AND request.response ->> 'replacement_player_id' = seat.player_id::text
              )
              OR (
                seat.guest_id IS NOT NULL
                AND request.response ->> 'replacement_guest_id' = seat.guest_id::text
              )
            )
       )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'RR_INVALID_EDIT:An assigned player is neither active nor a verified one-round substitute';
  END IF;

  IF v_event.format::text IN ('male', 'female') AND EXISTS (
    WITH seats AS (
      SELECT v.player_id, v.guest_id
        FROM public.round_robin_schedule s
        CROSS JOIN LATERAL (VALUES
          (s.a1_player_id, s.a1_guest_id),
          (s.a2_player_id, s.a2_guest_id),
          (s.b1_player_id, s.b1_guest_id),
          (s.b2_player_id, s.b2_guest_id)
        ) AS v(player_id, guest_id)
       WHERE s.event_id = p_event_id
         AND s.round_no = v_first.round_no
         AND s.voided_at IS NULL
         AND s.superseded_by_schedule_id IS NULL
         AND s.is_bye = false
    )
    SELECT 1
      FROM seats seat
      LEFT JOIN public.profiles profile ON profile.id = seat.player_id
      LEFT JOIN public.guest_players guest ON guest.id = seat.guest_id
      LEFT JOIN public.profiles linked_profile ON linked_profile.id = guest.linked_user_id
     WHERE COALESCE(profile.gender, linked_profile.gender, guest.gender) IS DISTINCT FROM v_event.format::text
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'RR_INVALID_EDIT:The edit conflicts with this event''s gender format';
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
         AND s.round_no = v_first.round_no
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
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'RR_INVALID_EDIT:Every mixed-doubles team must keep one man and one woman';
  END IF;

  v_new_version := COALESCE(v_event.schedule_version, 0) + 1;

  UPDATE public.round_robin_events
     SET schedule_version = v_new_version,
         updated_at = now()
   WHERE id = p_event_id;

  INSERT INTO public.round_robin_audit (
    event_id, editor_id, change_type, changes, reason
  ) VALUES (
    p_event_id,
    v_actor,
    'schedule_edit',
    v_changes || jsonb_build_object(
      'schedule_version_before', COALESCE(v_event.schedule_version, 0),
      'schedule_version_after', v_new_version
    ),
    COALESCE(NULLIF(btrim(p_reason), ''), v_reason)
  );

  v_response := jsonb_build_object(
    'ok', true,
    'request_id', p_request_id,
    'action', p_action,
    'schedule_version', v_new_version,
    'round_no', v_first.round_no,
    'no_op', false,
    'changes', v_changes
  );

  UPDATE public.rr_schedule_mutation_requests
     SET status = 'completed', response = v_response, completed_at = now()
   WHERE request_id = p_request_id;

  RETURN v_response;
END;
$$;

REVOKE ALL ON FUNCTION public.rr_edit_schedule(
  uuid, uuid, integer, text, uuid, uuid, integer, text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.rr_edit_schedule(
  uuid, uuid, integer, text, uuid, uuid, integer, text
) TO authenticated, service_role;

COMMENT ON FUNCTION public.rr_edit_schedule(
  uuid, uuid, integer, text, uuid, uuid, integer, text
) IS 'Atomically applies protected, versioned host schedule edits and records one audit entry.';

-- A one-round substitute is intentionally limited to the current live round.
-- Future schedule rows remain mutable and can be regenerated, so draft and
-- future-round replacements must use the durable global-substitution path.
-- The complete current round is locked and validated so the substitute cannot
-- also be assigned elsewhere that round.
CREATE OR REPLACE FUNCTION public.rr_substitute_round(
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
  v_actor uuid := auth.uid();
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

  IF v_event.organizer_id <> v_actor
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

REVOKE ALL ON FUNCTION public.rr_substitute_round(
  uuid, uuid, integer, integer, uuid, uuid, uuid, text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.rr_substitute_round(
  uuid, uuid, integer, integer, uuid, uuid, uuid, text
) TO authenticated, service_role;

COMMENT ON FUNCTION public.rr_substitute_round(
  uuid, uuid, integer, integer, uuid, uuid, uuid, text
) IS 'Atomically replaces one active player in the current unscored, unlocked live round, validates format and duplicate assignments, bumps schedule_version, and audits the change.';

COMMIT;
