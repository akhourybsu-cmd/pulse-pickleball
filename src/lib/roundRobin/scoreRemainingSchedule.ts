/**
 * Slice 3 — pure TypeScript participant-change planner.
 *
 * `scoreRemainingSchedule(state, change)` decides HOW the remaining round-robin
 * schedule should change when a participant is withdrawn, injured, removed,
 * replaced, or restored. It is:
 *
 *   - pure: no database, no network, no wall-clock, no `Math.random`
 *   - deterministic: same inputs → same `ParticipantChangePlan`
 *   - advisory: it returns a plan; the transactional DB RPC decides what is
 *     actually safe to commit (per Amendment 4 — "planner decides what is
 *     preferable; DB decides what is safe to commit").
 *
 * Slice 2b's server orchestration snapshots the event, calls this planner, and
 * feeds the resulting ops into the existing `rr_manage_participant` apply path
 * (whose op vocabulary is `swap_identity`; `rewrite_round` expands to a set of
 * row upserts). The public RPC contract does not change.
 *
 * Contract references: `.lovable/plan.md` §2 (state machine), §3 (protection
 * levels), §6 (regen modes & fairness guardrails), §8 (response shape), and
 * `.lovable/plan_slice_2a_amendments.md` Amendment 2/4.
 */

import {
  type CoreMatch,
  type EventFormat,
  type SeatId,
  regenerateRounds,
  seatsOf,
} from "./scheduleCore";

// --------------------------------------------------------------------------
// Input model (built by Slice 2b from a DB snapshot).
// --------------------------------------------------------------------------

export type ParticipantStatus =
  | "active"
  | "withdrawn"
  | "injured"
  | "removed"
  | "replaced";

export type ChangeAction = "withdraw" | "injure" | "remove" | "replace" | "restore";
export type RegenMode = "minimal" | "reoptimize" | "auto";

export interface PlannerParticipant {
  /** round_robin_players.id (the lifecycle row). */
  id: string;
  /** Synthetic seat id: "p:<profile_uuid>" or "g:<guest_uuid>". */
  seatId: SeatId;
  status: ParticipantStatus;
  gender?: string;
}

export interface PlannerScheduleRow {
  id: string;
  roundNo: number;
  courtNo: number;
  isBye: boolean;
  /** [a1, a2, b1, b2] seat ids (null for empty/bye slots). */
  seats: [SeatId | null, SeatId | null, SeatId | null, SeatId | null];
  lockedAt?: string | null;
  voidedAt?: string | null;
  supersededByScheduleId?: string | null;
  publishedAt?: string | null;
  displayedToPlayersAt?: string | null;
  kioskVisibleAt?: string | null;
  preparedForScoringAt?: string | null;
  team1Score?: number | null;
  team2Score?: number | null;
}

export interface PlannerEventState {
  eventId: string;
  /** The round currently being played (rounds below are historical). */
  currentRound: number;
  numCourts: number;
  gamesPerPlayer: number;
  totalRounds: number;
  format?: EventFormat;
  scheduleVersion: number;
  participants: PlannerParticipant[];
  schedule: PlannerScheduleRow[];
}

export interface RequestedChange {
  action: ChangeAction;
  /** round_robin_players.id of the participant being changed. */
  participantId: string;
  /** round_robin_players.id of the substitute (action=replace). */
  substituteId?: string;
  regenMode?: RegenMode;
}

// --------------------------------------------------------------------------
// Output model (mirrors plan.md §8, DB-specific fields excluded).
// --------------------------------------------------------------------------

export type PlanType =
  | "no_schedule_change"
  | "local_round_repair"
  | "replace_identity"
  | "restore_identity"
  | "reoptimize";

export interface SwapIdentityOp {
  op: "swap_identity";
  scheduleId: string;
  roundNo: number;
  courtNo: number;
  fromSeatId: SeatId;
  toSeatId: SeatId;
}

export interface RewriteRoundMatch {
  courtNo: number;
  isBye: boolean;
  seats: [SeatId | null, SeatId | null, SeatId | null, SeatId | null];
}

export interface RewriteRoundOp {
  op: "rewrite_round";
  roundNo: number;
  matches: RewriteRoundMatch[];
}

export type PlanOp = SwapIdentityOp | RewriteRoundOp;

export interface FairnessMetrics {
  projectedGameSpread: number;
  projectedByeSpread: number;
  partnerRepeatMax: number;
}

/** Deterministic fairness guardrail identifiers (subset of plan.md §6). */
export type FairnessTrigger =
  | "projected_game_spread_exceeds_one"
  | "projected_bye_spread_exceeds_one"
  | "third_partner_repeat"
  | "under_filled_match"
  | "duplicate_in_round"
  | "no_local_substitute_available";

export interface ParticipantChangePlan {
  ok: boolean;
  code?: string;
  message?: string;
  retryable?: boolean;
  action: ChangeAction;
  planType: PlanType;
  effectiveRound: number;
  modeRequested: RegenMode;
  modeApplied: "minimal" | "reoptimize" | "none";
  ops: PlanOp[];
  fairness: {
    before: FairnessMetrics;
    minimalCandidate?: FairnessMetrics;
    applied?: FairnessMetrics;
  };
  fairnessTriggers: FairnessTrigger[];
  roundsTouched: number[];
  matchesChanged: number;
  matchesPreserved: number;
  protectedRoundsTouched: number[];
  protectedMatchesTouched: number;
  reason?: string;
}

// --------------------------------------------------------------------------
// Protection classification (plan.md §3).
// --------------------------------------------------------------------------

function hasScore(row: PlannerScheduleRow): boolean {
  return row.team1Score != null && row.team2Score != null;
}

/** Completely immutable: any attempt to modify is an invariant violation. */
export function isHistoricallyLocked(row: PlannerScheduleRow, currentRound: number): boolean {
  return (
    row.roundNo < currentRound ||
    row.lockedAt != null ||
    row.voidedAt != null ||
    row.supersededByScheduleId != null ||
    hasScore(row)
  );
}

/** Narrow local repair only — never broadly re-optimized. */
export function isOperationallyProtected(row: PlannerScheduleRow, currentRound: number): boolean {
  if (isHistoricallyLocked(row, currentRound)) return false;
  return (
    row.roundNo === currentRound ||
    row.publishedAt != null ||
    row.displayedToPlayersAt != null ||
    row.kioskVisibleAt != null ||
    row.preparedForScoringAt != null
  );
}

/** Later, unlocked, unpublished rounds — fully regeneratable. */
export function isReoptimizable(row: PlannerScheduleRow, currentRound: number): boolean {
  return (
    !isHistoricallyLocked(row, currentRound) && !isOperationallyProtected(row, currentRound)
  );
}

// --------------------------------------------------------------------------
// Helpers.
// --------------------------------------------------------------------------

function toCore(row: PlannerScheduleRow): CoreMatch {
  return {
    round_no: row.roundNo,
    court_no: row.courtNo,
    a1: row.seats[0],
    a2: row.seats[1],
    b1: row.seats[2],
    b2: row.seats[3],
    is_bye: row.isBye,
  };
}

function isRepairable(row: PlannerScheduleRow, currentRound: number): boolean {
  // A row eligible for identity swapping: not immutable, not a bye placeholder
  // being edited as a match, not voided/superseded.
  return !isHistoricallyLocked(row, currentRound);
}

interface FairnessInput {
  matches: CoreMatch[];
  seats: SeatId[];
}

/** Projected fairness metrics over a set of matches for the given roster. */
export function computeFairness({ matches, seats }: FairnessInput): FairnessMetrics {
  const games = new Map<SeatId, number>();
  const byes = new Map<SeatId, number>();
  const partner = new Map<SeatId, Map<SeatId, number>>();
  seats.forEach((s) => {
    games.set(s, 0);
    byes.set(s, 0);
    partner.set(s, new Map());
  });

  const bump = (m: Map<SeatId, number>, k: SeatId) => {
    if (m.has(k)) m.set(k, m.get(k)! + 1);
  };

  for (const m of matches) {
    if (m.is_bye) {
      if (m.a1) bump(byes, m.a1);
      continue;
    }
    const occ = seatsOf(m);
    if (occ.length !== 4) continue;
    const [a1, a2, b1, b2] = occ;
    occ.forEach((s) => bump(games, s));
    const teamUp = (x: SeatId, y: SeatId) => {
      const pm = partner.get(x);
      if (pm) pm.set(y, (pm.get(y) || 0) + 1);
    };
    teamUp(a1, a2);
    teamUp(a2, a1);
    teamUp(b1, b2);
    teamUp(b2, b1);
  }

  const gameVals = seats.map((s) => games.get(s) || 0);
  const byeVals = seats.map((s) => byes.get(s) || 0);
  let partnerRepeatMax = 0;
  for (const pm of partner.values()) {
    for (const c of pm.values()) partnerRepeatMax = Math.max(partnerRepeatMax, c);
  }

  const spread = (vals: number[]) => (vals.length ? Math.max(...vals) - Math.min(...vals) : 0);
  return {
    projectedGameSpread: spread(gameVals),
    projectedByeSpread: spread(byeVals),
    partnerRepeatMax,
  };
}

function evaluateGuardrails(
  candidate: CoreMatch[],
  seats: SeatId[],
  metrics: FairnessMetrics,
): FairnessTrigger[] {
  const triggers = new Set<FairnessTrigger>();
  if (metrics.projectedGameSpread > 1) triggers.add("projected_game_spread_exceeds_one");
  if (metrics.projectedByeSpread > 1) triggers.add("projected_bye_spread_exceeds_one");
  if (metrics.partnerRepeatMax >= 3) triggers.add("third_partner_repeat");

  // Structural checks over the candidate schedule.
  const byRound = new Map<number, CoreMatch[]>();
  for (const m of candidate) {
    if (!byRound.has(m.round_no)) byRound.set(m.round_no, []);
    byRound.get(m.round_no)!.push(m);
  }
  for (const roundMatches of byRound.values()) {
    const seen = new Set<SeatId>();
    for (const m of roundMatches) {
      if (!m.is_bye) {
        const occ = seatsOf(m);
        if (occ.length !== 4 || new Set(occ).size !== 4) {
          triggers.add("under_filled_match");
        }
      }
      for (const s of seatsOf(m)) {
        if (seen.has(s)) triggers.add("duplicate_in_round");
        seen.add(s);
      }
    }
  }
  return [...triggers];
}

function err(
  action: ChangeAction,
  code: string,
  message: string,
  effectiveRound: number,
  modeRequested: RegenMode,
  extra?: Partial<ParticipantChangePlan>,
): ParticipantChangePlan {
  return {
    ok: false,
    code,
    message,
    retryable: false,
    action,
    planType: "no_schedule_change",
    effectiveRound,
    modeRequested,
    modeApplied: "none",
    ops: [],
    fairness: { before: zeroFairness() },
    fairnessTriggers: [],
    roundsTouched: [],
    matchesChanged: 0,
    matchesPreserved: 0,
    protectedRoundsTouched: [],
    protectedMatchesTouched: 0,
    ...extra,
  };
}

function zeroFairness(): FairnessMetrics {
  return { projectedGameSpread: 0, projectedByeSpread: 0, partnerRepeatMax: 0 };
}

function uniqueSorted(nums: number[]): number[] {
  return [...new Set(nums)].sort((a, b) => a - b);
}

// --------------------------------------------------------------------------
// Local repair (minimal) for withdraw / injure / remove.
// --------------------------------------------------------------------------

interface LocalRepairResult {
  ok: boolean;
  ops: SwapIdentityOp[];
  /** Rounds whose repair touched an operationally-protected row. */
  protectedRows: PlannerScheduleRow[];
}

/**
 * Repair each future non-locked non-bye match containing `outgoing` by pulling
 * an idle (bye/absent) active seat into the vacated slot. If the pulled seat
 * held a bye that round, the outgoing seat takes that bye — keeping the round
 * seat-balanced with no double-booking. `restrictTo` limits which rounds are
 * repaired (used so reoptimize only locally repairs protected rounds).
 */
function planLocalRepair(
  state: PlannerEventState,
  outgoing: SeatId,
  effectiveRound: number,
  restrictTo?: (row: PlannerScheduleRow) => boolean,
): LocalRepairResult {
  const ops: SwapIdentityOp[] = [];
  const protectedRows: PlannerScheduleRow[] = [];
  const activeSeats = new Set(
    state.participants.filter((p) => p.status === "active").map((p) => p.seatId),
  );
  activeSeats.delete(outgoing);

  const affected = state.schedule
    .filter(
      (r) =>
        r.roundNo >= effectiveRound &&
        !r.isBye &&
        isRepairable(r, state.currentRound) &&
        r.seats.includes(outgoing) &&
        (!restrictTo || restrictTo(r)),
    )
    .sort((a, b) => a.roundNo - b.roundNo || a.courtNo - b.courtNo);

  for (const row of affected) {
    // Seats already playing (non-bye) in this round.
    const roundNonBye = state.schedule.filter(
      (r) => r.roundNo === row.roundNo && !r.isBye && !isHistoricallyLocked(r, state.currentRound),
    );
    const playing = new Set<SeatId>();
    roundNonBye.forEach((r) => r.seats.forEach((s) => s && playing.add(s)));

    // Candidate idle seats: active, not the outgoing, not already playing.
    const idle = [...activeSeats].filter((s) => s !== outgoing && !playing.has(s));
    if (idle.length === 0) {
      return { ok: false, ops: [], protectedRows: [] };
    }

    // Prefer the idle seat with the fewest games so far (fairness), then id.
    const gamesSoFar = countGames(state.schedule, state.currentRound);
    idle.sort((a, b) => (gamesSoFar.get(a) || 0) - (gamesSoFar.get(b) || 0) || (a < b ? -1 : 1));
    const sub = idle[0];

    ops.push({
      op: "swap_identity",
      scheduleId: row.id,
      roundNo: row.roundNo,
      courtNo: row.courtNo,
      fromSeatId: outgoing,
      toSeatId: sub,
    });
    if (isOperationallyProtected(row, state.currentRound)) protectedRows.push(row);

    // If the pulled seat held a bye this round, give that bye to the outgoing
    // seat so the round stays balanced and `sub` is not double-booked.
    const byeRow = state.schedule.find(
      (r) =>
        r.roundNo === row.roundNo &&
        r.isBye &&
        r.seats[0] === sub &&
        isRepairable(r, state.currentRound),
    );
    if (byeRow) {
      ops.push({
        op: "swap_identity",
        scheduleId: byeRow.id,
        roundNo: byeRow.roundNo,
        courtNo: byeRow.courtNo,
        fromSeatId: sub,
        toSeatId: outgoing,
      });
    }
    // `sub` is now occupied this round; block it from further pulls.
    activeSeats.delete(sub);
  }

  return { ok: true, ops, protectedRows };
}

function countGames(schedule: PlannerScheduleRow[], currentRound: number): Map<SeatId, number> {
  const games = new Map<SeatId, number>();
  for (const r of schedule) {
    if (r.isBye || r.voidedAt || r.supersededByScheduleId) continue;
    if (isHistoricallyLocked(r, currentRound) && r.roundNo < currentRound) {
      // played rounds still count toward balance
    }
    for (const s of r.seats) {
      if (s) games.set(s, (games.get(s) || 0) + 1);
    }
  }
  return games;
}

/** Apply swap ops to a cloned CoreMatch list for fairness projection. */
function projectSchedule(
  schedule: PlannerScheduleRow[],
  swaps: SwapIdentityOp[],
): CoreMatch[] {
  const byId = new Map(schedule.map((r) => [r.id, toCore(r)]));
  for (const op of swaps) {
    const m = byId.get(op.scheduleId);
    if (!m) continue;
    const slots: (keyof Pick<CoreMatch, "a1" | "a2" | "b1" | "b2">)[] = ["a1", "a2", "b1", "b2"];
    for (const slot of slots) {
      if (m[slot] === op.fromSeatId) m[slot] = op.toSeatId;
    }
  }
  return [...byId.values()];
}

// --------------------------------------------------------------------------
// Reoptimize for the fully-regeneratable rounds.
// --------------------------------------------------------------------------

interface ReoptimizeResult {
  ok: boolean;
  code?: string;
  ops: PlanOp[];
  protectedRows: PlannerScheduleRow[];
  projected: CoreMatch[];
}

function planReoptimize(
  state: PlannerEventState,
  outgoing: SeatId,
  postChangeActiveSeats: SeatId[],
  effectiveRound: number,
  substitute?: SeatId,
): ReoptimizeResult {
  // A round may be rewritten ONLY if EVERY one of its rows is reoptimizable.
  // Any round holding a historically-locked or operationally-protected row
  // (a played/scored/active/published match) is off-limits to the DELETE +
  // rebuild path — rewriting it would double-book players who already played
  // or overwrite an official result. Such rounds get narrow local repair only.
  const nonReoptRoundNos = new Set(
    state.schedule
      .filter((r) => r.roundNo >= effectiveRound && !isReoptimizable(r, state.currentRound))
      .map((r) => r.roundNo),
  );

  // Step 1: locally repair the non-reoptimizable rounds (active/published, or
  // partially-scored) that still contain the outgoing seat — narrow repair
  // only, never a rewrite.
  const inProtectedRound = (r: PlannerScheduleRow) => nonReoptRoundNos.has(r.roundNo);
  const protectedRepair = substitute
    ? planReplaceSwaps(state, outgoing, substitute, effectiveRound, inProtectedRound)
    : planLocalRepair(state, outgoing, effectiveRound, inProtectedRound);

  if (!protectedRepair.ok) {
    return {
      ok: false,
      code: "reoptimization_required",
      ops: [],
      protectedRows: [],
      projected: [],
    };
  }

  // Step 2: rebuild the fully-reoptimizable rounds from scratch.
  const reoptRounds = uniqueSorted(
    state.schedule
      .filter(
        (r) =>
          r.roundNo >= effectiveRound &&
          isReoptimizable(r, state.currentRound) &&
          !nonReoptRoundNos.has(r.roundNo),
      )
      .map((r) => r.roundNo),
  );

  const ops: PlanOp[] = [...protectedRepair.ops];

  if (reoptRounds.length > 0 && postChangeActiveSeats.length >= 4) {
    // Frozen matches = everything NOT being rewritten (played + protected),
    // with the protected repair already applied — this seeds fairness so the
    // rewritten rounds continue the rotation sensibly.
    const rewriteSet = new Set(reoptRounds);
    const frozen = projectSchedule(state.schedule, protectedRepair.ops.filter(isSwap))
      .filter((m) => !rewriteSet.has(m.round_no));

    const genders = new Map<SeatId, string>();
    state.participants.forEach((p) => {
      if (p.gender) genders.set(p.seatId, p.gender);
    });

    const startFrom = reoptRounds[0];
    const generated = regenerateRounds({
      seed: `${state.eventId}:reopt:${state.scheduleVersion}`,
      seatIds: postChangeActiveSeats,
      numCourts: state.numCourts,
      gamesPerPlayer: state.gamesPerPlayer,
      startFromRound: startFrom,
      totalRounds: state.totalRounds,
      format: state.format ?? "open",
      frozenMatches: frozen,
      genders,
    });

    for (const round of reoptRounds) {
      const roundMatches = generated
        .filter((m) => m.round_no === round)
        .map<RewriteRoundMatch>((m) => ({
          courtNo: m.court_no,
          isBye: m.is_bye,
          seats: [m.a1, m.a2, m.b1, m.b2],
        }));
      ops.push({ op: "rewrite_round", roundNo: round, matches: roundMatches });
    }

    // Projected schedule for fairness = frozen (protected+played) + generated.
    const projected = [...frozen, ...generated.filter((m) => rewriteSet.has(m.round_no))];
    return { ok: true, ops, protectedRows: protectedRepair.protectedRows, projected };
  }

  // No reoptimizable rounds — the protected repair is the whole plan.
  const projected = projectSchedule(state.schedule, protectedRepair.ops.filter(isSwap));
  return { ok: true, ops, protectedRows: protectedRepair.protectedRows, projected };
}

function isSwap(op: PlanOp): op is SwapIdentityOp {
  return op.op === "swap_identity";
}

// --------------------------------------------------------------------------
// Replace (identity swap).
// --------------------------------------------------------------------------

interface ReplaceResult {
  ok: boolean;
  ops: SwapIdentityOp[];
  protectedRows: PlannerScheduleRow[];
}

function planReplaceSwaps(
  state: PlannerEventState,
  outgoing: SeatId,
  substitute: SeatId,
  effectiveRound: number,
  restrictTo?: (row: PlannerScheduleRow) => boolean,
): ReplaceResult {
  const ops: SwapIdentityOp[] = [];
  const protectedRows: PlannerScheduleRow[] = [];
  const affected = state.schedule
    .filter(
      (r) =>
        r.roundNo >= effectiveRound &&
        !r.isBye &&
        isRepairable(r, state.currentRound) &&
        r.seats.includes(outgoing) &&
        (!restrictTo || restrictTo(r)),
    )
    .sort((a, b) => a.roundNo - b.roundNo || a.courtNo - b.courtNo);

  for (const row of affected) {
    ops.push({
      op: "swap_identity",
      scheduleId: row.id,
      roundNo: row.roundNo,
      courtNo: row.courtNo,
      fromSeatId: outgoing,
      toSeatId: substitute,
    });
    if (isOperationallyProtected(row, state.currentRound)) protectedRows.push(row);
  }
  return { ok: true, ops, protectedRows };
}

// --------------------------------------------------------------------------
// Main entry point.
// --------------------------------------------------------------------------

export function scoreRemainingSchedule(
  state: PlannerEventState,
  change: RequestedChange,
): ParticipantChangePlan {
  const modeRequested: RegenMode = change.regenMode ?? "auto";
  const effectiveRound = Math.max(1, state.currentRound || 1);

  const validActions: ChangeAction[] = ["withdraw", "injure", "remove", "replace", "restore"];
  if (!validActions.includes(change.action)) {
    return err(change.action, "invalid_action", `Unknown action: ${change.action}`, effectiveRound, modeRequested);
  }
  if (!["minimal", "reoptimize", "auto"].includes(modeRequested)) {
    return err(change.action, "invalid_regen_mode", `Unknown regen mode: ${modeRequested}`, effectiveRound, modeRequested);
  }

  const participant = state.participants.find((p) => p.id === change.participantId);
  if (!participant) {
    return err(change.action, "participant_not_found", "Participant not in event roster", effectiveRound, modeRequested);
  }

  // State-machine validation (plan.md §2).
  if (change.action === "restore") {
    if (participant.status === "active") {
      return err(change.action, "invalid_state_transition", "Participant is already active", effectiveRound, modeRequested);
    }
    if (participant.status === "removed" || participant.status === "replaced") {
      return err(change.action, "invalid_state_transition", `Cannot restore from terminal state: ${participant.status}`, effectiveRound, modeRequested, { reason: "terminal_state" });
    }
  } else if (participant.status !== "active") {
    return err(change.action, "invalid_state_transition", `Participant is not active (status: ${participant.status})`, effectiveRound, modeRequested);
  }

  const outgoing = participant.seatId;
  const activeSeats = state.participants.filter((p) => p.status === "active").map((p) => p.seatId);
  const beforeFairness = computeFairness({
    matches: state.schedule.map(toCore),
    seats: activeSeats,
  });

  // ---------------- REPLACE ----------------
  if (change.action === "replace") {
    if (!change.substituteId) {
      return err(change.action, "substitute_required", "A substitute is required for replace", effectiveRound, modeRequested);
    }
    if (change.substituteId === change.participantId) {
      return err(change.action, "substitute_invalid", "Substitute must differ from the participant", effectiveRound, modeRequested, { reason: "self_substitution" });
    }
    const sub = state.participants.find((p) => p.id === change.substituteId);
    if (!sub || sub.status !== "active") {
      return err(change.action, "substitute_not_eligible", "Substitute must be an active roster participant", effectiveRound, modeRequested);
    }
    // Identity uniqueness: the substitute's seat must not already appear on
    // another participant row (plan.md §4, invariant #12).
    const dupIdentity = state.participants.some(
      (p) => p.id !== sub.id && p.seatId === sub.seatId,
    );
    if (dupIdentity) {
      return err(change.action, "duplicate_participant_identity", "Substitute identity already participates", effectiveRound, modeRequested);
    }

    const substitute = sub.seatId;

    if (modeRequested === "reoptimize") {
      const postActive = activeSeats.filter((s) => s !== outgoing);
      const reopt = planReoptimize(state, outgoing, postActive, effectiveRound, substitute);
      if (!reopt.ok) {
        return err(change.action, reopt.code ?? "reoptimization_required", "Full remaining-schedule optimization is required.", effectiveRound, modeRequested);
      }
      const applied = computeFairness({ matches: reopt.projected, seats: postActive });
      return finalize(change.action, "reoptimize", "reoptimize", effectiveRound, modeRequested, reopt.ops, beforeFairness, applied, [], reopt.protectedRows, state);
    }

    const rep = planReplaceSwaps(state, outgoing, substitute, effectiveRound);
    const planType: PlanType = rep.ops.length === 0 ? "no_schedule_change" : "replace_identity";
    const projected = projectSchedule(state.schedule, rep.ops);
    const applied = computeFairness({ matches: projected, seats: activeSeats.filter((s) => s !== outgoing).concat(substitute) });
    return finalize(change.action, planType, rep.ops.length ? "minimal" : "none", effectiveRound, modeRequested, rep.ops, beforeFairness, applied, [], rep.protectedRows, state);
  }

  // ---------------- RESTORE ----------------
  if (change.action === "restore") {
    const reoptRounds = state.schedule.filter(
      (r) => r.roundNo >= effectiveRound && isReoptimizable(r, state.currentRound),
    );
    const postActive = [...activeSeats, outgoing];

    if (modeRequested !== "minimal" && reoptRounds.length > 0 && postActive.length >= 4) {
      const reopt = planReoptimize(state, outgoing, postActive, effectiveRound);
      if (reopt.ok && reopt.ops.length > 0) {
        const applied = computeFairness({ matches: reopt.projected, seats: postActive });
        return finalize(change.action, "reoptimize", "reoptimize", effectiveRound, modeRequested, reopt.ops, beforeFairness, applied, [], reopt.protectedRows, state);
      }
    }
    // No future rounds to fold the player back into — lifecycle-only restore.
    return {
      ...finalize(change.action, "restore_identity", "none", effectiveRound, modeRequested, [], beforeFairness, beforeFairness, [], [], state),
      reason: reoptRounds.length === 0 ? "no_future_rounds" : undefined,
    };
  }

  // ---------------- WITHDRAW / INJURE / REMOVE ----------------
  const postActive = activeSeats.filter((s) => s !== outgoing);

  const minimal = planLocalRepair(state, outgoing, effectiveRound);
  let minimalCandidateFairness: FairnessMetrics | undefined;
  let minimalTriggers: FairnessTrigger[] = [];

  if (minimal.ok) {
    const projected = projectSchedule(state.schedule, minimal.ops);
    minimalCandidateFairness = computeFairness({ matches: projected, seats: postActive });
    minimalTriggers = evaluateGuardrails(projected, postActive, minimalCandidateFairness);
  }

  const noAffected = minimal.ok && minimal.ops.length === 0;
  if (noAffected) {
    // Player wasn't in any future non-locked match — nothing to repair.
    return finalize(change.action, "no_schedule_change", "minimal", effectiveRound, modeRequested, [], beforeFairness, beforeFairness, [], [], state);
  }

  if (modeRequested === "minimal") {
    if (!minimal.ok) {
      return err(change.action, "minimal_regen_not_possible", "No valid local repair exists for the remaining schedule.", effectiveRound, modeRequested, { fairnessTriggers: ["no_local_substitute_available"] });
    }
    const projected = projectSchedule(state.schedule, minimal.ops);
    const applied = computeFairness({ matches: projected, seats: postActive });
    return finalize(change.action, "local_round_repair", "minimal", effectiveRound, modeRequested, minimal.ops, beforeFairness, applied, minimalTriggers, minimal.protectedRows, state, minimalCandidateFairness);
  }

  if (modeRequested === "reoptimize") {
    return doReoptimize(state, change, outgoing, postActive, effectiveRound, modeRequested, beforeFairness, minimalCandidateFairness);
  }

  // auto: prefer minimal when it exists and clears guardrails; else reoptimize.
  if (minimal.ok && minimalTriggers.length === 0) {
    const projected = projectSchedule(state.schedule, minimal.ops);
    const applied = computeFairness({ matches: projected, seats: postActive });
    return finalize(change.action, "local_round_repair", "minimal", effectiveRound, modeRequested, minimal.ops, beforeFairness, applied, minimalTriggers, minimal.protectedRows, state, minimalCandidateFairness);
  }
  return doReoptimize(state, change, outgoing, postActive, effectiveRound, modeRequested, beforeFairness, minimalCandidateFairness);
}

function doReoptimize(
  state: PlannerEventState,
  change: RequestedChange,
  outgoing: SeatId,
  postActive: SeatId[],
  effectiveRound: number,
  modeRequested: RegenMode,
  beforeFairness: FairnessMetrics,
  minimalCandidateFairness?: FairnessMetrics,
): ParticipantChangePlan {
  if (postActive.length < 4) {
    return err(change.action, "reoptimization_required", "Too few active players remain to build a valid schedule.", effectiveRound, modeRequested, { fairnessTriggers: minimalCandidateFairness ? ["projected_game_spread_exceeds_one"] : [] });
  }
  const reopt = planReoptimize(state, outgoing, postActive, effectiveRound);
  if (!reopt.ok) {
    return err(change.action, reopt.code ?? "reoptimization_required", "A valid local repair is not sufficient. Full remaining-schedule optimization is required.", effectiveRound, modeRequested);
  }
  const applied = computeFairness({ matches: reopt.projected, seats: postActive });
  const triggers = evaluateGuardrails(reopt.projected, postActive, applied);
  return finalize(change.action, "reoptimize", "reoptimize", effectiveRound, modeRequested, reopt.ops, beforeFairness, applied, triggers, reopt.protectedRows, state, minimalCandidateFairness);
}

function finalize(
  action: ChangeAction,
  planType: PlanType,
  modeApplied: "minimal" | "reoptimize" | "none",
  effectiveRound: number,
  modeRequested: RegenMode,
  ops: PlanOp[],
  before: FairnessMetrics,
  applied: FairnessMetrics,
  triggers: FairnessTrigger[],
  protectedRows: PlannerScheduleRow[],
  state: PlannerEventState,
  minimalCandidate?: FairnessMetrics,
): ParticipantChangePlan {
  const roundsTouched = uniqueSorted(ops.map((o) => o.roundNo));
  const matchesChanged = ops.reduce(
    (n, o) => n + (o.op === "swap_identity" ? 1 : o.matches.filter((m) => !m.isBye).length),
    0,
  );
  const futureRepairable = state.schedule.filter(
    (r) => r.roundNo >= effectiveRound && isRepairable(r, state.currentRound) && !r.isBye,
  ).length;
  const protectedRoundsTouched = uniqueSorted(protectedRows.map((r) => r.roundNo));

  return {
    ok: true,
    action,
    planType,
    effectiveRound,
    modeRequested,
    modeApplied,
    ops,
    fairness: { before, minimalCandidate, applied },
    fairnessTriggers: triggers,
    roundsTouched,
    matchesChanged,
    matchesPreserved: Math.max(0, futureRepairable - matchesChanged),
    protectedRoundsTouched,
    protectedMatchesTouched: protectedRows.length,
  };
}
