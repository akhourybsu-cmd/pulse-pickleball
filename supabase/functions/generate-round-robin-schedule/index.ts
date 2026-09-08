import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  planScheduleAdjustment,
  type ScheduleAdjustmentPlan,
  type ScheduleSubstitution,
} from "../_shared/roundRobin/scheduleAdjustment.ts";
import {
  seatsOf,
  type CoreMatch,
  type EventFormat,
  type SeatId,
} from "../_shared/roundRobin/scheduleCore.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Participant {
  player_id?: string | null;
  guest_id?: string | null;
}

interface ScheduleRequest {
  request_id?: string;
  event_id: string;
  // Retained for older clients. The active database roster is authoritative.
  player_ids?: string[];
  participants?: Participant[];
  num_courts: number;
  num_rounds?: number;
  games_per_player: number;
  regenerate_from_round?: number;
  expected_version?: number;
  format?: EventFormat;
  reason?: string;
  /** Optional host-authorized identity handoff committed atomically with the
   * future-only schedule rebuild. It affects allocation credit, never standings. */
  substitutions?: ScheduleSubstitution[];
}

interface EventSnapshot {
  id: string;
  organizer_id: string;
  format: string | null;
  status: string;
  current_round: number | null;
  num_courts: number;
  num_rounds: number;
  games_per_player: number | null;
  schedule_version: number | null;
  voided: boolean | null;
}

interface RosterRow {
  id: string;
  player_id: string | null;
  guest_player_id: string | null;
  active: boolean;
  status: string;
  replacement_participant_id: string | null;
  replaced_participant_id: string | null;
  effective_round: number | null;
  schedule_game_credit: number | null;
  schedule_first_eligible_round: number | null;
}

interface PersistedScheduleRow {
  id: string;
  round_no: number;
  court_no: number;
  is_bye: boolean;
  a1_player_id: string | null;
  a1_guest_id: string | null;
  a2_player_id: string | null;
  a2_guest_id: string | null;
  b1_player_id: string | null;
  b1_guest_id: string | null;
  b2_player_id: string | null;
  b2_guest_id: string | null;
  team1_score: number | null;
  team2_score: number | null;
  match_id: string | null;
  locked_at: string | null;
  voided_at: string | null;
  superseded_by_schedule_id: string | null;
  abandoned: boolean | null;
}

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

function respond(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function seatId(playerId: string | null, guestId: string | null): SeatId | null {
  if (playerId) return `p:${playerId}`;
  if (guestId) return `g:${guestId}`;
  return null;
}

function coreMatch(row: PersistedScheduleRow): CoreMatch {
  return {
    round_no: row.round_no,
    court_no: row.court_no,
    is_bye: row.is_bye,
    a1: seatId(row.a1_player_id, row.a1_guest_id),
    a2: seatId(row.a2_player_id, row.a2_guest_id),
    b1: seatId(row.b1_player_id, row.b1_guest_id),
    b2: seatId(row.b2_player_id, row.b2_guest_id),
  };
}

function splitSeat(value: SeatId | null): { player_id: string | null; guest_id: string | null } {
  if (!value) return { player_id: null, guest_id: null };
  if (value.startsWith("p:")) return { player_id: value.slice(2), guest_id: null };
  if (value.startsWith("g:")) return { player_id: null, guest_id: value.slice(2) };
  throw new Error(`Unsupported schedule identity: ${value}`);
}

function insertableMatch(match: CoreMatch) {
  const a1 = splitSeat(match.a1);
  const a2 = splitSeat(match.a2);
  const b1 = splitSeat(match.b1);
  const b2 = splitSeat(match.b2);
  return {
    round_no: match.round_no,
    court_no: match.court_no,
    is_bye: match.is_bye,
    a1_player_id: a1.player_id,
    a1_guest_id: a1.guest_id,
    a2_player_id: a2.player_id,
    a2_guest_id: a2.guest_id,
    b1_player_id: b1.player_id,
    b1_guest_id: b1.guest_id,
    b2_player_id: b2.player_id,
    b2_guest_id: b2.guest_id,
  };
}

function publicPlan(plan: ScheduleAdjustmentPlan) {
  return {
    capacity: plan.capacity,
    impact: plan.impact,
    fairness: plan.fairness,
    warnings: plan.warnings,
  };
}

function errorStatus(message: string): number {
  if (message.includes("RR_UNAUTHORIZED")) return 403;
  if (message.includes("RR_EVENT_NOT_FOUND")) return 404;
  if (
    message.includes("RR_STALE_VERSION") ||
    message.includes("RR_PROTECTED_ROUND") ||
    message.includes("RR_IDEMPOTENCY_CONFLICT") ||
    message.includes("RR_REQUEST_IN_PROGRESS")
  ) return 409;
  if (
    message.includes("RR_INVALID_PLAN") ||
    message.includes("RR_INVALID_ROSTER") ||
    message.includes("RR_INVALID_SUBSTITUTION") ||
    message.includes("RR_INVALID_ALLOCATION") ||
    message.includes("RR_INSUFFICIENT_PLAYERS") ||
    message.includes("RR_EVENT_CLOSED")
  ) return 422;
  return 500;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return respond(405, { error: "Method not allowed" });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return respond(401, { error: "Missing Authorization header" });
    }

    const token = authHeader.slice("Bearer ".length);
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) {
      return respond(401, { error: "Unauthorized" });
    }

    const body = (await req.json()) as ScheduleRequest;
    const eventId = body.event_id;
    const requestedCourts = Math.floor(Number(body.num_courts));
    const requestedGames = Math.floor(Number(body.games_per_player));
    if (!eventId || !Number.isFinite(requestedCourts) || !Number.isFinite(requestedGames)) {
      return respond(400, { error: "event_id, num_courts, and games_per_player are required" });
    }
    if (requestedCourts < 1 || requestedCourts > 20 || requestedGames < 1 || requestedGames > 20) {
      return respond(422, { error: "Courts and games per player must be between 1 and 20" });
    }

    // Authorize before loading any roster or schedule details. The database RPC
    // repeats this check under the event row lock.
    const { data: rawEvent, error: eventError } = await supabase
      .from("round_robin_events")
      .select("id, organizer_id, format, status, current_round, num_courts, num_rounds, games_per_player, schedule_version, voided")
      .eq("id", eventId)
      .single();
    if (eventError || !rawEvent) {
      return respond(404, { error: "Round robin not found" });
    }
    const event = rawEvent as EventSnapshot;
    let canManage = event.organizer_id === authData.user.id;
    if (!canManage) {
      const { data: hasAdminRole, error: roleError } = await supabase.rpc("has_role", {
        _user_id: authData.user.id,
        _role: "admin",
      });
      if (roleError) throw roleError;
      canManage = hasAdminRole === true;
    }
    if (!canManage) {
      return respond(403, { error: "Only the organizer or an administrator can rebuild this schedule" });
    }
    if (event.voided || event.status === "completed" || event.status === "voided") {
      return respond(422, { error: "This event is closed and its schedule is locked" });
    }
    if (
      body.expected_version != null &&
      body.expected_version !== (event.schedule_version ?? 0)
    ) {
      return respond(409, {
        error: "The schedule changed in another session. Refresh and review the latest version.",
        code: "RR_STALE_VERSION",
        current_version: event.schedule_version ?? 0,
      });
    }

    const rosterResult = await supabase
      .from("round_robin_players")
      .select("id, player_id, guest_player_id, active, status, replacement_participant_id, replaced_participant_id, effective_round, schedule_game_credit, schedule_first_eligible_round")
      .eq("event_id", eventId);
    if (rosterResult.error) throw rosterResult.error;

    // PostgREST caps a response at the project's max_rows setting. Explicit
    // bye rows can push a legal long rotation past that cap, so page until the
    // authoritative snapshot is complete rather than planning from a silently
    // truncated schedule.
    const persisted: PersistedScheduleRow[] = [];
    const pageSize = 1000;
    for (let offset = 0; ; offset += pageSize) {
      const { data: page, error: scheduleError } = await supabase
        .from("round_robin_schedule")
        .select("id, round_no, court_no, is_bye, a1_player_id, a1_guest_id, a2_player_id, a2_guest_id, b1_player_id, b1_guest_id, b2_player_id, b2_guest_id, team1_score, team2_score, match_id, locked_at, voided_at, superseded_by_schedule_id, abandoned")
        .eq("event_id", eventId)
        .order("round_no")
        .order("court_no")
        .order("id")
        .range(offset, offset + pageSize - 1);
      if (scheduleError) throw scheduleError;
      const rows = (page ?? []) as PersistedScheduleRow[];
      persisted.push(...rows);
      if (rows.length < pageSize) break;
    }

    const roster = (rosterResult.data ?? []) as RosterRow[];
    const activeRoster = roster.filter((row) => row.active);
    const unresolved = activeRoster.filter((row) => !row.player_id && !row.guest_player_id);
    if (unresolved.length > 0) {
      return respond(422, {
        error: `${unresolved.length} active roster slot${unresolved.length === 1 ? " is" : "s are"} not linked to a player or saved guest`,
        code: "RR_INVALID_ROSTER",
      });
    }
    const activeSeatIds = [...new Set(
      activeRoster
        .map((row) => seatId(row.player_id, row.guest_player_id))
        .filter((value): value is SeatId => value !== null),
    )].sort((left, right) => left.localeCompare(right));
    if (activeSeatIds.length !== activeRoster.length) {
      return respond(422, {
        error: "The active roster contains a duplicate player identity",
        code: "duplicate_player_identity",
      });
    }

    if (body.substitutions != null && !Array.isArray(body.substitutions)) {
      return respond(400, { error: "substitutions must be an array" });
    }
    if ((body.substitutions?.length ?? 0) > 1) {
      return respond(400, { error: "Only one substitution can be applied per rebuild" });
    }
    const seatPattern = /^[pg]:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const substitutions = (body.substitutions ?? []).filter((substitution) => {
      const outgoing = substitution?.outgoingSeatId;
      const incoming = substitution?.incomingSeatId;
      return typeof outgoing === "string" && seatPattern.test(outgoing) &&
        typeof incoming === "string" && seatPattern.test(incoming) &&
        outgoing !== incoming && activeSeatIds.includes(outgoing) &&
        !activeSeatIds.includes(incoming);
    });
    if (substitutions.length !== (body.substitutions?.length ?? 0)) {
      return respond(422, {
        error: "The replacement must identify one active outgoing player and one player who is not already active in this event",
        code: "RR_INVALID_ROSTER",
      });
    }
    // The planner may accept optional allocation behavior, but the persistence
    // RPC receives a deliberately narrow identity-only command surface.
    const requestedSubstitution = substitutions[0]
      ? {
          outgoingSeatId: substitutions[0].outgoingSeatId,
          incomingSeatId: substitutions[0].incomingSeatId,
        }
      : null;
    const nextSeatIds = requestedSubstitution
      ? activeSeatIds
          .filter((seat) => seat !== requestedSubstitution.outgoingSeatId)
          .concat(requestedSubstitution.incomingSeatId)
          .sort((left, right) => left.localeCompare(right))
      : activeSeatIds;

    const canonical = persisted.filter(
      (row) => row.voided_at == null && row.superseded_by_schedule_id == null,
    );
    const fairnessRows = canonical.filter((row) => !row.abandoned).map(coreMatch);

    const requestedFromRound = Math.max(1, Math.floor(body.regenerate_from_round ?? 1));
    const protectedRows = canonical.filter((row) =>
      row.locked_at != null ||
      row.match_id != null ||
      row.team1_score != null ||
      row.team2_score != null ||
      row.abandoned === true
    );
    const explicitlyProtectedThrough = protectedRows.reduce(
      (highest, row) => Math.max(highest, row.round_no),
      0,
    );
    // The displayed round is an operational boundary even when its canonical
    // rows are missing because of legacy drift. A general rebuild must never
    // fill or rewrite that live round implicitly; the dedicated repair/current-
    // round workflows must make any such intervention explicit.
    const liveRound = event.status === "live" ? (event.current_round ?? 1) : 0;
    const protectedThrough = Math.max(
      requestedFromRound - 1,
      explicitlyProtectedThrough,
      liveRound,
    );
    const firstMutableRound = protectedThrough + 1;

    // Detect players who existed in the previous rotation even if a roster
    // mutation has just marked them inactive. This lets the planner explain
    // adds/removals and prevents a departed identity from leaking into future rounds.
    const scheduledSeatIds = [...new Set(
      fairnessRows.flatMap(seatsOf),
    )].sort((left, right) => left.localeCompare(right));
    // During an explicit handoff, the authoritative pre-mutation roster must
    // define `currentSeatIds` even when the outgoing seat has only abandoned
    // history or no generated row. Otherwise the pure planner would reject
    // the inheritance relationship and silently drop durable fairness credit.
    const currentSeatIds = requestedSubstitution
      ? activeSeatIds
      : scheduledSeatIds.length > 0
        ? scheduledSeatIds
        : nextSeatIds;

    const registeredIds = nextSeatIds
      .filter((value) => value.startsWith("p:"))
      .map((value) => value.slice(2));
    const guestIds = nextSeatIds
      .filter((value) => value.startsWith("g:"))
      .map((value) => value.slice(2));
    const guestLinks = new Map<string, string>();
    const guestGenders = new Map<string, string>();
    if (guestIds.length > 0) {
      const { data: guests, error: guestError } = await supabase
        .from("guest_players")
        .select("id, linked_user_id, gender")
        .in("id", guestIds);
      if (guestError) throw guestError;
      if ((guests ?? []).length !== guestIds.length) {
        return respond(422, {
          error: "A selected guest no longer exists",
          code: "RR_INVALID_ROSTER",
        });
      }
      for (const guest of guests ?? []) {
        if (guest.linked_user_id) guestLinks.set(guest.id, guest.linked_user_id);
        if (guest.gender) guestGenders.set(guest.id, guest.gender);
      }
    }

    const profileIds = [...new Set([...registeredIds, ...guestLinks.values()])];
    const genders = new Map<SeatId, string>();
    if (profileIds.length > 0) {
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, gender")
        .in("id", profileIds);
      if (profileError) throw profileError;
      const genderByProfile = new Map<string, string>();
      const existingProfileIds = new Set<string>();
      for (const profile of profiles ?? []) {
        existingProfileIds.add(profile.id);
        if (profile.gender) genderByProfile.set(profile.id, profile.gender);
      }
      if (registeredIds.some((profileId) => !existingProfileIds.has(profileId))) {
        return respond(422, {
          error: "A selected player profile no longer exists",
          code: "RR_INVALID_ROSTER",
        });
      }
      registeredIds.forEach((profileId) => {
        const gender = genderByProfile.get(profileId);
        if (gender) genders.set(`p:${profileId}`, gender);
      });
      guestLinks.forEach((profileId, guestId) => {
        const gender = genderByProfile.get(profileId) ?? guestGenders.get(guestId);
        if (gender) genders.set(`g:${guestId}`, gender);
      });
    }
    guestGenders.forEach((gender, guestId) => {
      if (!genders.has(`g:${guestId}`)) genders.set(`g:${guestId}`, gender);
    });

    // Scheduling credits and availability boundaries are durable roster
    // metadata, not standings. Carry them into every later court/game change
    // so a fair late-join or substitution allocation is never forgotten.
    const existingGameCredits = new Map<SeatId, number>();
    const existingFirstEligibleRounds = new Map<SeatId, number>();
    for (const row of roster) {
      const seat = seatId(row.player_id, row.guest_player_id);
      if (!seat) continue;
      const credit = Math.max(0, Math.floor(row.schedule_game_credit ?? 0));
      if (credit > 0) existingGameCredits.set(seat, credit);
      if (
        row.schedule_first_eligible_round != null &&
        row.schedule_first_eligible_round >= 1
      ) {
        existingFirstEligibleRounds.set(
          seat,
          Math.floor(row.schedule_first_eligible_round),
        );
      }
    }

    const plan = planScheduleAdjustment({
      seed: eventId,
      currentMatches: fairnessRows,
      currentSeatIds,
      nextSeatIds,
      currentNumCourts: event.num_courts,
      currentGamesPerPlayer: event.games_per_player ?? 3,
      currentTotalRounds: event.num_rounds,
      firstMutableRound,
      protectedRounds: protectedThrough > 0 ? [protectedThrough] : [],
      numCourts: requestedCourts,
      gamesPerPlayer: requestedGames,
      // Event format is persisted configuration; never let a request body
      // silently bypass mixed/gender scheduling requirements.
      format: (event.format ?? "open") as EventFormat,
      genders,
      lateJoinCredit: "roster_median",
      substitutions,
      existingGameCredits,
      existingFirstEligibleRounds,
    });

    if (!plan.ok) {
      return respond(422, {
        error: plan.warnings.find((warning) => warning.severity === "error")?.message ?? "The schedule cannot be rebuilt with these settings",
        code: plan.code ?? "RR_INVALID_PLAN",
        ...publicPlan(plan),
      });
    }

    const replacementRows = plan.generatedMatches.map(insertableMatch);
    const serializedPlan = publicPlan(plan);
    const reason = body.reason?.trim() || plan.impact.summary;
    const requestId = body.request_id?.trim() || crypto.randomUUID();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
      return respond(400, { error: "request_id must be a UUID" });
    }
    const allocation = plan.fairness.perPlayer.map((player) => ({
      seat_id: player.seatId,
      // Persist the full durable credit. Fairness exposes only the portion
      // applied to this target, so an 8→3→8 game-target change can recover the
      // original missed-play context instead of permanently truncating it.
      game_credit: plan.gameCredits.get(player.seatId) ?? player.gameCredit,
      first_eligible_round:
        plan.firstEligibleRounds.get(player.seatId) ?? player.firstEligibleRound,
    }));
    const { data: applyResult, error: applyError } = await supabase.rpc(
      "rr_apply_schedule_rebuild",
      {
        p_request_id: requestId,
        p_event_id: eventId,
        p_actor_id: authData.user.id,
        p_expected_version: event.schedule_version ?? 0,
        p_regenerate_from_round: firstMutableRound,
        p_num_courts: requestedCourts,
        p_num_rounds: plan.capacity.recommendedTotalRounds,
        p_games_per_player: requestedGames,
        p_schedule: replacementRows,
        p_impact: serializedPlan,
        p_reason: reason,
        p_substitution: requestedSubstitution,
        p_allocation: allocation,
      },
    );
    if (applyError) {
      const message = applyError.message || "Schedule update failed";
      console.error("[generate-rr] atomic apply failed", {
        eventId,
        message,
        code: applyError.code,
      });
      return respond(errorStatus(message), {
        error: message.includes("RR_STALE_VERSION")
          ? "The schedule changed in another session. Refresh and try again."
          : message.includes("RR_PROTECTED_ROUND")
            ? "A match became active while the schedule was rebuilding. Nothing changed; refresh and try again."
            : "The schedule could not be safely updated. Nothing was changed.",
        code: message.split(":", 1)[0],
      });
    }

    console.log("[generate-rr] schedule applied", JSON.stringify({
      eventId,
      playerCount: nextSeatIds.length,
      requestedCourts,
      usableCourts: plan.capacity.usableCourts,
      protectedThrough,
      totalRounds: plan.capacity.recommendedTotalRounds,
      generatedRows: replacementRows.length,
      fairnessScore: plan.fairness.score,
    }));

    return respond(200, {
      success: true,
      request_id: requestId,
      matches_created: replacementRows.filter((row) => !row.is_bye).length,
      schedule_rows_created: replacementRows.length,
      num_rounds: plan.capacity.recommendedTotalRounds,
      schedule_version: (applyResult as { schedule_version?: number } | null)?.schedule_version,
      regenerate_from_round: firstMutableRound,
      ...serializedPlan,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate schedule";
    console.error("[generate-rr] schedule generation failed", message);
    return respond(500, { error: message });
  }
});
