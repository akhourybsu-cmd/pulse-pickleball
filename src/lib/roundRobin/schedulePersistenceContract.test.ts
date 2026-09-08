import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../../..");
const generator = readFileSync(
  path.join(root, "supabase/functions/generate-round-robin-schedule/index.ts"),
  "utf8",
);
const roundRobinDetail = readFileSync(
  path.join(root, "src/pages/RoundRobinDetail.tsx"),
  "utf8",
);
const migration = readFileSync(
  path.join(root, "supabase/migrations/20260912100000_round_robin_atomic_schedule_rebuild.sql"),
  "utf8",
);

const rebuildStart = migration.indexOf(
  "CREATE OR REPLACE FUNCTION public.rr_apply_schedule_rebuild",
);
const allocationGuardStart = migration.indexOf(
  "CREATE OR REPLACE FUNCTION public.rr_guard_schedule_allocation_metadata",
);
const editStart = migration.indexOf(
  "CREATE OR REPLACE FUNCTION public.rr_edit_schedule",
);
const substituteStart = migration.indexOf(
  "CREATE OR REPLACE FUNCTION public.rr_substitute_round",
);
const rebuildSql = migration.slice(rebuildStart, editStart);
const allocationGuardSql = migration.slice(allocationGuardStart, rebuildStart);
const editSql = migration.slice(editStart, substituteStart);
const substituteSql = migration.slice(substituteStart);

describe("round-robin schedule persistence architecture", () => {
  it("delegates schedule replacement to the atomic RPC with an idempotency key", () => {
    expect(generator).toMatch(
      /\.rpc\(\s*["']rr_apply_schedule_rebuild["']\s*,\s*\{[\s\S]{0,300}?p_request_id:\s*requestId/,
    );
    expect(generator).not.toMatch(
      /\.from\(\s*["']round_robin_schedule["']\s*\)\s*\.delete\s*\(/,
    );
  });

  it("forwards one validated global-substitution handoff into allocation planning", () => {
    expect(generator).toContain("substitutions?: ScheduleSubstitution[]");
    expect(generator).toContain(
      "Only one substitution can be applied per rebuild",
    );
    expect(generator).toMatch(
      /activeSeatIds\.includes\(outgoing\)[\s\S]*?!activeSeatIds\.includes\(incoming\)/,
    );
    expect(generator).toMatch(
      /planScheduleAdjustment\(\{[\s\S]*?lateJoinCredit: "roster_median",[\s\S]*?substitutions,/,
    );
  });

  it("holds the substitution mutation guard across async validation and either scope", () => {
    const handlerStart = roundRobinDetail.indexOf("const handleSubstitute = async");
    const handlerEnd = roundRobinDetail.indexOf(
      "const handleApplyScheduleSettings = async",
      handlerStart,
    );
    const handler = roundRobinDetail.slice(handlerStart, handlerEnd);
    const guardAcquire = handler.indexOf("rrMutationInFlightRef.current = true;");
    const asyncValidation = handler.indexOf(
      "await validateRosterInputsForFormat([replacement]);",
    );
    const globalMutation = handler.indexOf("await regenerateScheduleFromRound(");
    const oneRoundMutation = handler.indexOf('.rpc("rr_substitute_round"');
    const guardRelease = handler.lastIndexOf(
      "rrMutationInFlightRef.current = false;",
    );

    expect(handlerStart).toBeGreaterThan(-1);
    expect(handlerEnd).toBeGreaterThan(handlerStart);
    expect(guardAcquire).toBeGreaterThan(-1);
    expect(guardAcquire).toBeLessThan(asyncValidation);
    expect(asyncValidation).toBeLessThan(globalMutation);
    expect(asyncValidation).toBeLessThan(oneRoundMutation);
    expect(guardRelease).toBeGreaterThan(globalMutation);
    expect(guardRelease).toBeGreaterThan(oneRoundMutation);
    expect(handler.match(/rrMutationInFlightRef\.current = true;/g)).toHaveLength(1);
    expect(handler.match(/rrMutationInFlightRef\.current = false;/g)).toHaveLength(1);
  });

  it("pages through the complete persisted schedule", () => {
    expect(generator).toMatch(/const pageSize\s*=\s*\d+/);
    expect(generator).toMatch(
      /for\s*\(\s*let offset\s*=\s*0\s*;\s*;\s*offset\s*\+=\s*pageSize\s*\)/,
    );
    expect(generator).toContain(".range(offset, offset + pageSize - 1)");
    expect(generator).toMatch(/if\s*\(rows\.length\s*<\s*pageSize\)\s*break/);
  });

  it("replaces the legacy full-slot constraint with an active-row invariant", () => {
    expect(migration).toMatch(
      /ALTER TABLE public\.round_robin_schedule\s+DROP CONSTRAINT IF EXISTS round_robin_schedule_event_id_round_no_court_no_key;/,
    );
    expect(migration).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS uq_rr_schedule_active_slot\s+ON public\.round_robin_schedule \(event_id, round_no, court_no\)\s+WHERE voided_at IS NULL\s+AND superseded_by_schedule_id IS NULL;/,
    );
  });

  it("locks every mutable active row before deleting any replacement range", () => {
    const mutableRowLock = rebuildSql.match(
      /PERFORM 1\s+FROM public\.round_robin_schedule s\s+WHERE s\.event_id = p_event_id[\s\S]*?s\.round_no >= p_regenerate_from_round[\s\S]*?ORDER BY s\.id\s+FOR UPDATE;/,
    )?.[0];
    const deleteIndex = rebuildSql.indexOf(
      "DELETE FROM public.round_robin_schedule s",
    );

    expect(mutableRowLock).toBeDefined();
    expect(deleteIndex).toBeGreaterThan(-1);
    expect(rebuildSql.indexOf(mutableRowLock!)).toBeLessThan(deleteIndex);
  });

  it("validates bye shape, court capacity, and full round assignment before deletion", () => {
    const deleteIndex = rebuildSql.indexOf(
      "DELETE FROM public.round_robin_schedule s",
    );
    const validationMarkers = [
      "OR (x.is_bye AND x.court_no <= p_num_courts)",
      "Every game must have four players and every bye must have one",
      "HAVING count(*) FILTER (WHERE NOT x.is_bye) <> v_expected_matches_per_round",
      "Every active player must be assigned once in every generated round",
    ];

    for (const marker of validationMarkers) {
      const markerIndex = rebuildSql.indexOf(marker);
      expect(markerIndex, `missing validation: ${marker}`).toBeGreaterThan(-1);
      expect(markerIndex, `validation must precede delete: ${marker}`).toBeLessThan(
        deleteIndex,
      );
    }
  });

  it("makes every schedule mutation replayable and versioned by request id", () => {
    expect(migration).toMatch(
      /CREATE TABLE IF NOT EXISTS public\.rr_schedule_mutation_requests \([\s\S]*?request_id uuid PRIMARY KEY/,
    );
    expect(migration).toMatch(
      /DROP CONSTRAINT IF EXISTS rr_schedule_mutation_requests_mutation_kind_check;[\s\S]*?ADD CONSTRAINT rr_schedule_mutation_requests_mutation_kind_check\s+CHECK \(mutation_kind IN \('rebuild', 'edit', 'substitute_round'\)\);/,
    );

    for (const [kind, sql] of [
      ["rebuild", rebuildSql],
      ["edit", editSql],
      ["substitute_round", substituteSql],
    ] as const) {
      expect(sql).toContain("p_request_id uuid");
      expect(sql).toMatch(
        /IF v_existing\.status = 'completed' THEN\s+RETURN v_existing\.response;/,
      );
      expect(sql).toContain(`'${kind}', v_input_hash, 'in_progress'`);
      expect(sql).toMatch(
        /UPDATE public\.rr_schedule_mutation_requests[\s\S]*?SET status = 'completed'[\s\S]*?WHERE request_id = p_request_id;/,
      );
      expect(sql).toMatch(
        /IF p_expected_version <> COALESCE\(v_event\.schedule_version, 0\) THEN/,
      );
    }

    expect(editSql).toContain(
      "p_action NOT IN ('rotate_partners', 'swap_opponents', 'move_court')",
    );
  });

  it("backfills legacy ad-hoc guests before enabling strict rebuild validation", () => {
    const mapIndex = migration.indexOf(
      "CREATE TEMP TABLE rr_legacy_guest_backfill_map",
    );
    const guestInsertIndex = migration.indexOf(
      "INSERT INTO public.guest_players (id, display_name, created_by, group_id)",
    );
    const rosterUpdateIndex = migration.indexOf(
      "SET guest_player_id = map.guest_player_id",
    );

    expect(mapIndex).toBeGreaterThan(-1);
    expect(migration).toContain("rp.guest_player_id IS NULL");
    expect(migration).toContain("rp.guest_name IS NOT NULL");
    expect(migration).toContain("rre.organizer_id");
    expect(guestInsertIndex).toBeGreaterThan(mapIndex);
    expect(rosterUpdateIndex).toBeGreaterThan(guestInsertIndex);
    expect(rebuildStart).toBeGreaterThan(rosterUpdateIndex);
  });

  it("stores bounded allocation state on durable roster identities", () => {
    expect(migration).toMatch(
      /ADD COLUMN IF NOT EXISTS schedule_game_credit integer NOT NULL DEFAULT 0,[\s\S]*?ADD COLUMN IF NOT EXISTS schedule_first_eligible_round integer;/,
    );
    expect(migration).toMatch(
      /ADD CONSTRAINT rr_players_schedule_game_credit_range\s+CHECK \(schedule_game_credit BETWEEN 0 AND 20\);/,
    );
    expect(migration).toMatch(
      /ADD CONSTRAINT rr_players_schedule_first_eligible_round_positive[\s\S]*?schedule_first_eligible_round IS NULL[\s\S]*?schedule_first_eligible_round >= 1/,
    );
    expect(migration).toMatch(
      /SET schedule_first_eligible_round = COALESCE\(\([\s\S]*?SELECT min\(s\.round_no\)[\s\S]*?s\.voided_at IS NULL[\s\S]*?s\.superseded_by_schedule_id IS NULL[\s\S]*?s\.a1_player_id, s\.a2_player_id, s\.b1_player_id, s\.b2_player_id[\s\S]*?s\.a1_guest_id, s\.a2_guest_id, s\.b1_guest_id, s\.b2_guest_id[\s\S]*?\), 1\)[\s\S]*?WHERE rp\.active = true/,
    );
  });

  it("keeps allocation metadata service-controlled without blocking ordinary roster upserts", () => {
    const serviceAllowance = allocationGuardSql.indexOf(
      "IF v_jwt_role = 'service_role' THEN",
    );
    const insertGuard = allocationGuardSql.indexOf("IF TG_OP = 'INSERT' THEN");
    const updateGuard = allocationGuardSql.indexOf(
      "ELSIF NEW.schedule_game_credit IS DISTINCT FROM OLD.schedule_game_credit",
    );

    expect(allocationGuardStart).toBeGreaterThan(-1);
    expect(allocationGuardSql).toMatch(
      /SECURITY DEFINER\s+SET search_path = pg_catalog, public, pg_temp/,
    );
    expect(allocationGuardSql).toContain("v_jwt_role text := auth.role();");
    expect(allocationGuardSql).not.toContain("current_user");
    expect(generator).toContain("createClient(supabaseUrl, serviceRoleKey");
    expect(serviceAllowance).toBeGreaterThan(-1);
    expect(insertGuard).toBeGreaterThan(serviceAllowance);
    expect(updateGuard).toBeGreaterThan(insertGuard);
    expect(allocationGuardSql).toMatch(
      /IF TG_OP = 'INSERT' THEN[\s\S]*?NEW\.schedule_game_credit IS DISTINCT FROM 0[\s\S]*?NEW\.schedule_first_eligible_round IS NOT NULL[\s\S]*?RR_PROTECTED_ALLOCATION_METADATA/,
    );
    expect(allocationGuardSql).toMatch(
      /ELSIF NEW\.schedule_game_credit IS DISTINCT FROM OLD\.schedule_game_credit[\s\S]*?NEW\.schedule_first_eligible_round IS DISTINCT FROM OLD\.schedule_first_eligible_round[\s\S]*?RR_PROTECTED_ALLOCATION_METADATA/,
    );
    expect(allocationGuardSql).toMatch(
      /BEFORE INSERT OR UPDATE OF schedule_game_credit, schedule_first_eligible_round\s+ON public\.round_robin_players/,
    );
    expect(allocationGuardSql).toMatch(
      /REVOKE ALL ON FUNCTION public\.rr_guard_schedule_allocation_metadata\(\)\s+FROM PUBLIC, anon, authenticated;/,
    );
    expect(allocationGuardSql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.rr_guard_schedule_allocation_metadata\(\)\s+TO service_role;/,
    );
    // Omitted insert values resolve to 0/null defaults, and unrelated UPDATEs
    // do not name either guarded column, so existing organizer upserts proceed.
    expect(migration).toContain(
      "ADD COLUMN IF NOT EXISTS schedule_game_credit integer NOT NULL DEFAULT 0",
    );
    expect(migration).toContain(
      "ADD COLUMN IF NOT EXISTS schedule_first_eligible_round integer;",
    );
  });

  it("applies one global roster replacement inside the rebuild transaction", () => {
    const eventLock = rebuildSql.indexOf(
      "FROM public.round_robin_events\n   WHERE id = p_event_id\n   FOR UPDATE;",
    );
    const rosterLock = rebuildSql.indexOf(
      "LOCK TABLE public.round_robin_players IN SHARE ROW EXCLUSIVE MODE;",
    );
    const substitutionStart = rebuildSql.indexOf(
      "IF p_substitution IS NOT NULL THEN",
    );
    const outgoingMutation = rebuildSql.indexOf(
      "SET status = 'replaced'::public.rr_participant_status",
    );
    const incomingRelink = rebuildSql.indexOf(
      "SET replaced_participant_id = v_outgoing.id",
      outgoingMutation,
    );
    const deleteIndex = rebuildSql.indexOf(
      "DELETE FROM public.round_robin_schedule s",
    );

    expect(rebuildSql).toContain("p_substitution jsonb DEFAULT NULL");
    expect(rebuildSql).toContain("'substitution', p_substitution");
    expect(rebuildSql).toContain(
      "(SELECT count(*) FROM jsonb_object_keys(p_substitution)) <> 2",
    );
    expect(rebuildSql).toContain(
      "^[pg]:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    );
    expect(rebuildSql).not.toContain("[1-5][0-9a-f]{3}");
    expect(eventLock).toBeGreaterThan(-1);
    expect(rosterLock).toBeGreaterThan(eventLock);
    expect(substitutionStart).toBeGreaterThan(rosterLock);
    expect(outgoingMutation).toBeGreaterThan(substitutionStart);
    expect(incomingRelink).toBeGreaterThan(outgoingMutation);
    expect(rebuildSql.slice(outgoingMutation, incomingRelink)).not.toContain(
      "replaced_participant_id = NULL",
    );
    expect(deleteIndex).toBeGreaterThan(outgoingMutation);
    expect(rebuildSql).toMatch(
      /v_outgoing_count <> 1[\s\S]*?outgoing identity must match exactly one active event participant/,
    );
    expect(rebuildSql).toContain(
      "The incoming identity is already active in this event",
    );
    expect(rebuildSql).toMatch(
      /PERFORM 1 FROM public\.profiles profile WHERE profile\.id = v_incoming_player_id;[\s\S]*?FROM public\.guest_players guest[\s\S]*?guest\.id = v_incoming_guest_id/,
    );
    expect(rebuildSql).toMatch(
      /v_incoming_count = 1[\s\S]*?SET status = 'active'::public\.rr_participant_status[\s\S]*?ELSE[\s\S]*?v_guest\.created_by = v_event\.organizer_id[\s\S]*?v_actor_is_admin[\s\S]*?v_guest\.group_id = v_event\.group_id[\s\S]*?INSERT INTO public\.round_robin_players/,
    );
    expect(rebuildSql).toMatch(
      /replacement_participant_id = v_incoming\.id[\s\S]*?replaced_participant_id = v_outgoing\.id[\s\S]*?effective_round = p_regenerate_from_round/,
    );
    expect(rebuildSql).toMatch(
      /IF v_incoming_guest_id IS NOT NULL THEN[\s\S]*?SET rating_eligible = false/,
    );
  });

  it("validates and persists one allocation entry per active identity", () => {
    const allocationValidation = rebuildSql.indexOf(
      "IF p_allocation IS NULL OR jsonb_typeof(p_allocation) IS DISTINCT FROM 'array' THEN",
    );
    const scheduleDelete = rebuildSql.indexOf(
      "DELETE FROM public.round_robin_schedule s",
    );
    const scheduleInsert = rebuildSql.indexOf(
      "INSERT INTO public.round_robin_schedule (",
    );
    const allocationUpdate = rebuildSql.indexOf(
      "UPDATE public.round_robin_players rp\n     SET schedule_game_credit = allocation.game_credit",
    );
    const versionAdvance = rebuildSql.indexOf(
      "v_new_version := COALESCE(v_event.schedule_version, 0) + 1;",
    );

    expect(rebuildSql).toContain("p_allocation jsonb DEFAULT '[]'::jsonb");
    expect(rebuildSql).toContain("'allocation', p_allocation");
    expect(allocationValidation).toBeGreaterThan(-1);
    expect(allocationValidation).toBeLessThan(scheduleDelete);
    expect(rebuildSql).toContain(
      "(SELECT count(*) FROM jsonb_object_keys(entry)) <> 3",
    );
    expect(rebuildSql).toContain("x.game_credit > 20");
    expect(rebuildSql).toContain(
      "allocation must contain one unique entry per active participant",
    );
    expect(rebuildSql).toContain(
      "allocation contains an identity outside the active roster",
    );
    expect(rebuildSql).toContain(
      "allocation is missing an active roster identity",
    );
    expect(scheduleInsert).toBeGreaterThan(scheduleDelete);
    expect(allocationUpdate).toBeGreaterThan(scheduleInsert);
    expect(versionAdvance).toBeGreaterThan(allocationUpdate);
    expect(rebuildSql).toContain(
      "IF v_allocation_updated <> v_active_players THEN",
    );
    expect(rebuildSql).toMatch(
      /'participant_replaced',[\s\S]*?'substitution', v_substitution_result/,
    );
    expect(rebuildSql).toMatch(
      /'schedule_rebuild',[\s\S]*?'substitution', v_substitution_result,[\s\S]*?'allocation', p_allocation/,
    );
    expect(rebuildSql).toMatch(
      /v_response := jsonb_build_object\([\s\S]*?'allocation_updated', v_allocation_updated,[\s\S]*?'substitution', v_substitution_result,[\s\S]*?'allocation', p_allocation/,
    );
  });

  it("hardens security-definer paths and authorizes saved-guest substitutes", () => {
    for (const sql of [rebuildSql, editSql, substituteSql]) {
      expect(sql).toMatch(
        /SECURITY DEFINER\s+SET search_path = pg_catalog, public, pg_temp/,
      );
    }
    expect(migration).not.toContain("SET search_path = public, pg_catalog");
    expect(substituteSql).toMatch(
      /guest\.created_by = v_actor[\s\S]*?public\.has_role\(v_actor, 'admin'::public\.app_role\)[\s\S]*?roster\.event_id = p_event_id[\s\S]*?gm\.role IN \('owner', 'moderator'\)/,
    );
  });

  it("uses linked-profile gender before saved-guest fallback in every SQL validation", () => {
    expect(migration).not.toContain("COALESCE(profile.gender, guest.gender)");
    expect(
      migration.match(
        /LEFT JOIN public\.profiles linked_profile ON linked_profile\.id = guest\.linked_user_id/g,
      ),
    ).toHaveLength(8);
    expect(rebuildSql).toMatch(
      /COALESCE\(profile\.gender, linked_profile\.gender, guest\.gender\) IS DISTINCT FROM 'male'/,
    );
    expect(rebuildSql).toMatch(
      /COALESCE\(profile\.gender, linked_profile\.gender, guest\.gender\) AS gender/,
    );
    expect(editSql).toMatch(
      /COALESCE\(profile\.gender, linked_profile\.gender, guest\.gender\) IS DISTINCT FROM v_event\.format::text/,
    );
    expect(substituteSql).toMatch(
      /SELECT COALESCE\(linked_profile\.gender, guest\.gender\) INTO v_replacement_gender/,
    );
    expect(substituteSql).toMatch(
      /COALESCE\(profile\.gender, linked_profile\.gender, guest\.gender\) AS gender/,
    );
  });

  it("publishes exact RPC signatures only to their intended roles", () => {
    const compact = migration.replace(/\s+/g, " ");

    expect(compact).toContain(
      "REVOKE ALL ON FUNCTION public.rr_apply_schedule_rebuild( uuid, uuid, uuid, integer, integer, integer, integer, integer, jsonb, jsonb, text, jsonb, jsonb ) FROM PUBLIC, anon, authenticated;",
    );
    expect(compact).toContain(
      "GRANT EXECUTE ON FUNCTION public.rr_apply_schedule_rebuild( uuid, uuid, uuid, integer, integer, integer, integer, integer, jsonb, jsonb, text, jsonb, jsonb ) TO service_role;",
    );
    expect(compact).toContain(
      "COMMENT ON FUNCTION public.rr_apply_schedule_rebuild( uuid, uuid, uuid, integer, integer, integer, integer, integer, jsonb, jsonb, text, jsonb, jsonb ) IS",
    );
    expect(compact).toContain(
      "REVOKE ALL ON FUNCTION public.rr_edit_schedule( uuid, uuid, integer, text, uuid, uuid, integer, text ) FROM PUBLIC, anon;",
    );
    expect(compact).toContain(
      "GRANT EXECUTE ON FUNCTION public.rr_edit_schedule( uuid, uuid, integer, text, uuid, uuid, integer, text ) TO authenticated, service_role;",
    );
    expect(compact).toContain(
      "REVOKE ALL ON FUNCTION public.rr_substitute_round( uuid, uuid, integer, integer, uuid, uuid, uuid, text ) FROM PUBLIC, anon;",
    );
    expect(compact).toContain(
      "GRANT EXECUTE ON FUNCTION public.rr_substitute_round( uuid, uuid, integer, integer, uuid, uuid, uuid, text ) TO authenticated, service_role;",
    );
  });

  it("locks and protects the complete target round before substituting", () => {
    const roundLock = substituteSql.indexOf("ORDER BY s.id\n   FOR UPDATE;");
    const scheduleUpdate = substituteSql.indexOf(
      "UPDATE public.round_robin_schedule s",
    );

    expect(roundLock).toBeGreaterThan(-1);
    expect(scheduleUpdate).toBeGreaterThan(roundLock);
    expect(substituteSql).toMatch(
      /s\.locked_at IS NOT NULL[\s\S]*?s\.match_id IS NOT NULL[\s\S]*?s\.team1_score IS NOT NULL[\s\S]*?s\.team2_score IS NOT NULL/,
    );
    expect(substituteSql).toContain("OR COALESCE(s.abandoned, false)");
    expect(substituteSql).toContain(
      "The original player must have exactly one playable match in that round",
    );
    expect(substituteSql).toContain(
      "The replacement is already assigned in that round",
    );
  });

  it("limits one-round substitution to the current live round", () => {
    const liveOnlyGuard = substituteSql.indexOf(
      "v_event.status::text IS DISTINCT FROM 'live'",
    );
    const pastRoundGuard = substituteSql.indexOf(
      "p_round_no < COALESCE(v_event.current_round, 1)",
    );
    const futureRoundGuard = substituteSql.indexOf(
      "p_round_no > COALESCE(v_event.current_round, 1)",
    );
    const roundLock = substituteSql.indexOf("ORDER BY s.id\n   FOR UPDATE;");

    expect(liveOnlyGuard).toBeGreaterThan(-1);
    expect(pastRoundGuard).toBeGreaterThan(liveOnlyGuard);
    expect(futureRoundGuard).toBeGreaterThan(pastRoundGuard);
    expect(roundLock).toBeGreaterThan(futureRoundGuard);
    expect(substituteSql).toContain(
      "Single-round substitutions are available only during live play; use a global substitution for draft roster changes",
    );
    expect(substituteSql).toContain(
      "Future-round substitutions can be lost during schedule changes; use a global substitution instead",
    );
  });

  it("lets verified one-round substitutes survive later safe round edits", () => {
    expect(substituteSql).toMatch(
      /v_response := jsonb_build_object\([\s\S]*?'round_no', p_round_no,[\s\S]*?'replacement_player_id', p_replacement_player_id,[\s\S]*?'replacement_guest_id', p_replacement_guest_id/,
    );
    expect(editSql).toMatch(
      /FROM public\.rr_schedule_mutation_requests request[\s\S]*?request\.mutation_kind = 'substitute_round'[\s\S]*?request\.status = 'completed'[\s\S]*?request\.response ->> 'round_no' = v_first\.round_no::text[\s\S]*?request\.response ->> 'replacement_player_id' = seat\.player_id::text[\s\S]*?request\.response ->> 'replacement_guest_id' = seat\.guest_id::text/,
    );
    expect(editSql).not.toMatch(
      /FROM public\.round_robin_audit[\s\S]*?player_substitute_round/,
    );
  });

  it("rejects scored, linked, locked, and live-round rebuilds and edits", () => {
    expect(rebuildSql).toMatch(
      /s\.locked_at IS NOT NULL[\s\S]*?s\.match_id IS NOT NULL[\s\S]*?s\.team1_score IS NOT NULL[\s\S]*?s\.team2_score IS NOT NULL[\s\S]*?v_event\.status::text = 'live'[\s\S]*?s\.round_no <= COALESCE\(v_event\.current_round, 1\)/,
    );
    expect(editSql).toMatch(
      /v_first\.locked_at IS NOT NULL[\s\S]*?v_first\.match_id IS NOT NULL[\s\S]*?v_first\.team1_score IS NOT NULL[\s\S]*?v_first\.team2_score IS NOT NULL[\s\S]*?v_event\.status::text = 'live'[\s\S]*?v_first\.round_no <= COALESCE\(v_event\.current_round, 1\)/,
    );
    expect(rebuildSql).toContain("RR_PROTECTED_ROUND");
    expect(editSql).toContain("RR_PROTECTED_ROUND");
  });

  it("protects a live current round even when no canonical row exists", () => {
    expect(generator).toContain(
      'const liveRound = event.status === "live" ? (event.current_round ?? 1) : 0;',
    );
    expect(generator).not.toMatch(
      /const liveRound = event\.status === "live"\s*&&\s*canonical\.some/,
    );

    const eventBoundaryGuard = rebuildSql.indexOf(
      "AND p_regenerate_from_round <= COALESCE(v_event.current_round, 1)",
    );
    const rosterMutation = rebuildSql.indexOf(
      "IF p_substitution IS NOT NULL THEN",
    );
    const deleteIndex = rebuildSql.indexOf(
      "DELETE FROM public.round_robin_schedule s",
    );

    expect(eventBoundaryGuard).toBeGreaterThan(-1);
    expect(rebuildSql.slice(eventBoundaryGuard, rosterMutation)).toContain(
      "RR_PROTECTED_ROUND:A live rebuild must begin after the current round",
    );
    expect(eventBoundaryGuard).toBeLessThan(rosterMutation);
    expect(eventBoundaryGuard).toBeLessThan(deleteIndex);
  });

  it("treats canonical abandoned rows as protected before and during atomic apply", () => {
    expect(generator).toMatch(
      /const protectedRows = canonical\.filter\([\s\S]*?row\.abandoned === true[\s\S]*?\);/,
    );
    const abandonedGuard = rebuildSql.indexOf("OR COALESCE(s.abandoned, false)");
    const deleteIndex = rebuildSql.indexOf(
      "DELETE FROM public.round_robin_schedule s",
    );
    expect(abandonedGuard).toBeGreaterThan(-1);
    expect(abandonedGuard).toBeLessThan(deleteIndex);
    expect(rebuildSql.slice(abandonedGuard, deleteIndex)).toContain(
      "RR_PROTECTED_ROUND",
    );
  });

  it("uses a uniqueness-safe temporary slot for occupied court moves", () => {
    const firstMove = editSql.indexOf(
      "SET court_no = v_temp_court::integer WHERE id = v_first.id",
    );
    const destinationMove = editSql.indexOf(
      "SET court_no = v_first.court_no WHERE id = v_destination.id",
    );
    const finalMove = editSql.indexOf(
      "SET court_no = p_new_court_no WHERE id = v_first.id",
    );

    expect(firstMove).toBeGreaterThan(-1);
    expect(destinationMove).toBeGreaterThan(firstMove);
    expect(finalMove).toBeGreaterThan(destinationMove);
  });

  it("ships the schema and all RPCs in one explicit transaction", () => {
    expect(migration.match(/^BEGIN;$/gm)).toHaveLength(1);
    expect(migration.match(/^COMMIT;$/gm)).toHaveLength(1);
    expect(migration.indexOf("BEGIN;")).toBeLessThan(rebuildStart);
    expect(substituteStart).toBeGreaterThan(editStart);
    expect(migration.trimEnd().endsWith("COMMIT;")).toBe(true);
  });
});
