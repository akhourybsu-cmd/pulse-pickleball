import {
  calculateMetrics,
  regenerateRounds,
  seatsOf,
  type CoreMatch,
  type EventFormat,
  type SeatId,
} from "./scheduleCore.ts";

export type ScheduleWarningCode =
  | "insufficient_players"
  | "duplicate_player_identity"
  | "no_courts"
  | "mixed_roster_unplayable"
  | "mixed_roster_gender_missing"
  | "mixed_roster_imbalance"
  | "gender_format_mismatch"
  | "unused_courts"
  | "target_games_not_exact"
  | "target_already_exceeded"
  | "late_join_credit_applied"
  | "protected_rounds_preserved";

export interface ScheduleWarning {
  code: ScheduleWarningCode;
  severity: "info" | "warning" | "error";
  message: string;
}

export interface ScheduleSubstitution {
  outgoingSeatId: SeatId;
  incomingSeatId: SeatId;
  /** Default true: the substitute inherits the outgoing seat's prior-game credit. */
  inheritPriorGames?: boolean;
}

export interface ScheduleAdjustmentInput {
  seed: string;
  /** The currently persisted schedule, including completed rows and byes. */
  currentMatches: CoreMatch[];
  /** Roster before the proposed change. */
  currentSeatIds: SeatId[];
  /** Active roster after the proposed change. */
  nextSeatIds: SeatId[];
  currentNumCourts?: number;
  currentGamesPerPlayer?: number;
  currentTotalRounds: number;
  /** First round the host says may be rebuilt. Earlier rounds are preserved. */
  firstMutableRound: number;
  /**
   * Any operationally protected round (live, published, displayed, or scored).
   * For safety, all rounds through the highest protected round are preserved.
   */
  protectedRounds?: number[];
  numCourts: number;
  gamesPerPlayer: number;
  format?: EventFormat;
  genders?: Map<SeatId, string>;
  substitutions?: ScheduleSubstitution[];
  /** Durable allocation credits persisted by an earlier adjustment (0–20). */
  existingGameCredits?: ReadonlyMap<SeatId, number>;
  /** Earliest fair-play round persisted by an earlier adjustment. */
  existingFirstEligibleRounds?: ReadonlyMap<SeatId, number>;
  /**
   * Late joiners are credited with the retained roster's median completed-game
   * count by default. This balances future opportunity without extending an
   * event solely to make up games that happened before they arrived.
   */
  lateJoinCredit?: "roster_median" | "none";
}

export interface PlayerScheduleProjection {
  seatId: SeatId;
  games: number;
  /** Actual games plus availability credit used to allocate future rounds. */
  availabilityAdjustedGames: number;
  /** Credit applied for this target; durable raw credit lives on the plan. */
  gameCredit: number;
  gamesRemainingToTarget: number;
  rests: number;
  uniquePartners: number;
  repeatedPartnerGames: number;
  uniqueOpponents: number;
  repeatedOpponentMeetings: number;
  longestRestStreak: number;
  /** First round included in rest/fairness calculations for this player. */
  firstEligibleRound: number;
}

export type FairnessBand =
  | "excellent"
  | "balanced"
  | "acceptable"
  | "needs_attention";

export interface ScheduleFairness {
  score: number;
  band: FairnessBand;
  gameRange: { min: number; max: number; spread: number; average: number };
  availabilityAdjustedGameRange: {
    min: number;
    max: number;
    spread: number;
    average: number;
  };
  restRange: { min: number; max: number; spread: number; average: number };
  partnerRepeatMax: number;
  opponentRepeatMax: number;
  duplicateSeatAssignments: number;
  underfilledMatches: number;
  unaccountedSeatRounds: number;
  playersAtTarget: number;
  playersBelowTarget: number;
  playersAboveTarget: number;
  perPlayer: PlayerScheduleProjection[];
}

export interface ScheduleCapacity {
  playerCount: number;
  requestedCourts: number;
  usableCourts: number;
  unusedCourts: number;
  matchesPerRound: number;
  playersOnCourtPerRound: number;
  restsPerRound: number;
  gamesPerPlayerTarget: number;
  protectedThroughRound: number;
  futureRounds: number;
  recommendedTotalRounds: number;
  scheduledFuturePlayerGames: number;
  remainingTargetPlayerGames: number;
  unavoidableExtraPlayerGames: number;
  exactTargetPossible: boolean;
  playersNeededForAnotherCourt: number | null;
}

export type ScheduleImpactReason =
  | "courts_changed"
  | "games_target_changed"
  | "players_added"
  | "players_removed"
  | "substitution"
  | "rounds_compressed"
  | "rounds_extended"
  | "schedule_rebalanced"
  | "no_effective_capacity_change";

export interface ScheduleImpact {
  reasons: ScheduleImpactReason[];
  oldCourts: number;
  newCourts: number;
  oldRounds: number;
  newRounds: number;
  roundsAdded: number;
  roundsRemoved: number;
  preservedRows: number;
  rebuiltRows: number;
  generatedRows: number;
  preservedPlayableMatches: number;
  generatedPlayableMatches: number;
  addedSeats: SeatId[];
  removedSeats: SeatId[];
  substitutions: ScheduleSubstitution[];
  summary: string;
}

export interface ScheduleAdjustmentPlan {
  ok: boolean;
  code?: ScheduleWarningCode | "invalid_input";
  schedule: CoreMatch[];
  preservedMatches: CoreMatch[];
  generatedMatches: CoreMatch[];
  capacity: ScheduleCapacity;
  impact: ScheduleImpact;
  fairness: ScheduleFairness;
  warnings: ScheduleWarning[];
  /** Raw durable allocation credits. Persist these values across rebuilds. */
  gameCredits: Map<SeatId, number>;
  /** Credits capped to this plan's game target and used by its calculations. */
  appliedGameCredits: Map<SeatId, number>;
  /** Earliest round included in each seat's availability/rest analysis. */
  firstEligibleRounds: Map<SeatId, number>;
}

interface CapacityShape {
  usableCourts: number;
  playersOnCourt: number;
  rests: number;
  playersNeededForAnotherCourt: number | null;
  error?: ScheduleWarning;
}

const round = (value: number, digits = 2) => Number(value.toFixed(digits));
const MAX_DURABLE_GAME_CREDIT = 20;

function creditsAppliedToTarget(
  durableCredits: ReadonlyMap<SeatId, number>,
  targetGames: number
): Map<SeatId, number> {
  return new Map(
    [...durableCredits].map(([seatId, credit]) => [
      seatId,
      Math.min(targetGames, credit),
    ])
  );
}

function normalizedUnique(ids: SeatId[]): SeatId[] {
  return [...new Set(ids)].sort((a, b) => a.localeCompare(b));
}

function playable(matches: CoreMatch[]): CoreMatch[] {
  return matches.filter(
    (match) => !match.is_bye && seatsOf(match).length === 4
  );
}

function gamesBySeat(matches: CoreMatch[]): Map<SeatId, number> {
  const counts = new Map<SeatId, number>();
  playable(matches).forEach((match) => {
    seatsOf(match).forEach((seatId) =>
      counts.set(seatId, (counts.get(seatId) || 0) + 1)
    );
  });
  return counts;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : Math.floor((sorted[middle - 1] + sorted[middle]) / 2);
}

function capacityFor(
  seatIds: SeatId[],
  courts: number,
  format: EventFormat,
  genders: Map<SeatId, string>
): CapacityShape {
  const courtCount = Math.max(0, Math.floor(courts));
  if (seatIds.length < 4) {
    return {
      usableCourts: 0,
      playersOnCourt: 0,
      rests: seatIds.length,
      playersNeededForAnotherCourt: 4 - seatIds.length,
      error: {
        code: "insufficient_players",
        severity: "error",
        message: `At least 4 active players are required; ${seatIds.length} ${
          seatIds.length === 1 ? "is" : "are"
        } available.`,
      },
    };
  }
  if (courtCount < 1) {
    return {
      usableCourts: 0,
      playersOnCourt: 0,
      rests: seatIds.length,
      playersNeededForAnotherCourt: null,
      error: {
        code: "no_courts",
        severity: "error",
        message: "At least one court is required to build a schedule.",
      },
    };
  }

  if (format === "male" || format === "female") {
    const mismatches = seatIds.filter(
      (seatId) => genders.get(seatId)?.trim().toLowerCase() !== format
    ).length;
    if (mismatches > 0) {
      const label = format === "male" ? "Men's" : "Women's";
      return {
        usableCourts: 0,
        playersOnCourt: 0,
        rests: seatIds.length,
        playersNeededForAnotherCourt: null,
        error: {
          code: "gender_format_mismatch",
          severity: "error",
          message: `${label} play requires every active player to be marked ${format}; ${mismatches} ${
            mismatches === 1 ? "player is" : "players are"
          } missing that eligible designation.`,
        },
      };
    }
  }

  if (format === "mixed") {
    const males = seatIds.filter(
      (seatId) => genders.get(seatId)?.toLowerCase() === "male"
    ).length;
    const females = seatIds.filter(
      (seatId) => genders.get(seatId)?.toLowerCase() === "female"
    ).length;
    const missingOrUnsupported = seatIds.length - males - females;
    if (missingOrUnsupported > 0) {
      return {
        usableCourts: 0,
        playersOnCourt: 0,
        rests: seatIds.length,
        playersNeededForAnotherCourt: null,
        error: {
          code: "mixed_roster_gender_missing",
          severity: "error",
          message: `${missingOrUnsupported} active ${
            missingOrUnsupported === 1 ? "player needs" : "players need"
          } a male or female designation before a mixed-doubles schedule can be built.`,
        },
      };
    }
    const usableCourts = Math.min(
      courtCount,
      Math.floor(males / 2),
      Math.floor(females / 2)
    );
    if (usableCourts === 0) {
      return {
        usableCourts: 0,
        playersOnCourt: 0,
        rests: seatIds.length,
        playersNeededForAnotherCourt: null,
        error: {
          code: "mixed_roster_unplayable",
          severity: "error",
          message: `Mixed doubles needs at least 2 men and 2 women; this roster has ${males} men and ${females} women.`,
        },
      };
    }
    const nextCourt = usableCourts + 1;
    const genderShortfall =
      Math.max(0, nextCourt * 2 - males) + Math.max(0, nextCourt * 2 - females);
    return {
      usableCourts,
      playersOnCourt: usableCourts * 4,
      rests: seatIds.length - usableCourts * 4,
      playersNeededForAnotherCourt:
        usableCourts < courtCount ? genderShortfall : null,
    };
  }

  const metrics = calculateMetrics(seatIds.length, courtCount, 1);
  return {
    usableCourts: metrics.usableCourts,
    playersOnCourt: metrics.onCourtPerRound,
    rests: metrics.byesPerRound,
    playersNeededForAnotherCourt:
      metrics.unusedCourts > 0
        ? Math.max(0, (metrics.usableCourts + 1) * 4 - seatIds.length)
        : null,
  };
}

function emptyRange() {
  return { min: 0, max: 0, spread: 0, average: 0 };
}

function numericRange(values: number[]) {
  if (values.length === 0) return emptyRange();
  const min = Math.min(...values);
  const max = Math.max(...values);
  return {
    min,
    max,
    spread: max - min,
    average: round(values.reduce((a, b) => a + b, 0) / values.length),
  };
}

export function analyzeScheduleFairness(
  matches: CoreMatch[],
  seatIds: SeatId[],
  gamesPerPlayerTarget: number,
  gameCredits: Map<SeatId, number> = new Map(),
  firstEligibleRoundBySeat: Map<SeatId, number> = new Map()
): ScheduleFairness {
  const seats = normalizedUnique(seatIds);
  const seatSet = new Set(seats);
  const gameCounts = new Map(seats.map((seatId) => [seatId, 0]));
  const partnerCounts = new Map(
    seats.map((seatId) => [seatId, new Map<SeatId, number>()])
  );
  const opponentCounts = new Map(
    seats.map((seatId) => [seatId, new Map<SeatId, number>()])
  );
  const playersByRound = new Map<number, Set<SeatId>>();
  const accountedByRound = new Map<number, Set<SeatId>>();
  let duplicateSeatAssignments = 0;
  let underfilledMatches = 0;

  for (const match of matches) {
    if (!accountedByRound.has(match.round_no)) {
      accountedByRound.set(match.round_no, new Set());
    }
    const occupied = seatsOf(match);
    if (
      !match.is_bye &&
      (occupied.length !== 4 || new Set(occupied).size !== 4)
    ) {
      underfilledMatches += 1;
    }
    for (const seatId of occupied) {
      if (!seatSet.has(seatId)) continue;
      const accounted = accountedByRound.get(match.round_no)!;
      if (accounted.has(seatId)) duplicateSeatAssignments += 1;
      accounted.add(seatId);
    }
  }

  for (const match of playable(matches)) {
    const occupied = seatsOf(match);
    const [a1, a2, b1, b2] = occupied;
    if (!playersByRound.has(match.round_no))
      playersByRound.set(match.round_no, new Set());
    occupied.forEach((seatId) => {
      if (seatSet.has(seatId)) {
        gameCounts.set(seatId, (gameCounts.get(seatId) || 0) + 1);
        playersByRound.get(match.round_no)!.add(seatId);
      }
    });
    const recordPair = (
      store: Map<SeatId, Map<SeatId, number>>,
      x: SeatId,
      y: SeatId
    ) => {
      const counts = store.get(x);
      if (counts) counts.set(y, (counts.get(y) || 0) + 1);
    };
    recordPair(partnerCounts, a1, a2);
    recordPair(partnerCounts, a2, a1);
    recordPair(partnerCounts, b1, b2);
    recordPair(partnerCounts, b2, b1);
    [a1, a2].forEach((left) =>
      [b1, b2].forEach((right) => {
        recordPair(opponentCounts, left, right);
        recordPair(opponentCounts, right, left);
      })
    );
  }

  const roundNumbers = [
    ...new Set(matches.map((match) => match.round_no)),
  ].sort((a, b) => a - b);
  let partnerRepeatMax = 0;
  let opponentRepeatMax = 0;
  let unaccountedSeatRounds = 0;
  const perPlayer = seats.map<PlayerScheduleProjection>((seatId) => {
    const partners = partnerCounts.get(seatId)!;
    const opponents = opponentCounts.get(seatId)!;
    const games = gameCounts.get(seatId) || 0;
    const gameCredit = Math.max(0, Math.floor(gameCredits.get(seatId) || 0));
    const firstEligibleRound = Math.max(
      1,
      firstEligibleRoundBySeat.get(seatId) || 1
    );
    const eligibleRounds = roundNumbers.filter(
      (roundNo) => roundNo >= firstEligibleRound
    );
    let longestRestStreak = 0;
    let currentRestStreak = 0;
    let eligibleGames = 0;
    for (const roundNo of eligibleRounds) {
      if (playersByRound.get(roundNo)?.has(seatId)) {
        eligibleGames += 1;
        currentRestStreak = 0;
      } else {
        currentRestStreak += 1;
        longestRestStreak = Math.max(longestRestStreak, currentRestStreak);
      }
      if (!accountedByRound.get(roundNo)?.has(seatId)) {
        unaccountedSeatRounds += 1;
      }
    }
    for (const count of partners.values())
      partnerRepeatMax = Math.max(partnerRepeatMax, count);
    for (const count of opponents.values())
      opponentRepeatMax = Math.max(opponentRepeatMax, count);
    const availabilityAdjustedGames = games + gameCredit;
    return {
      seatId,
      games,
      availabilityAdjustedGames,
      gameCredit,
      gamesRemainingToTarget: Math.max(
        0,
        gamesPerPlayerTarget - availabilityAdjustedGames
      ),
      rests: eligibleRounds.length - eligibleGames,
      uniquePartners: partners.size,
      repeatedPartnerGames: [...partners.values()].reduce(
        (sum, count) => sum + Math.max(0, count - 1),
        0
      ),
      uniqueOpponents: opponents.size,
      repeatedOpponentMeetings: [...opponents.values()].reduce(
        (sum, count) => sum + Math.max(0, count - 1),
        0
      ),
      longestRestStreak,
      firstEligibleRound,
    };
  });

  const gameRange = numericRange(perPlayer.map((player) => player.games));
  const adjustedRange = numericRange(
    perPlayer.map((player) => player.availabilityAdjustedGames)
  );
  const restRange = numericRange(perPlayer.map((player) => player.rests));
  const totalPartnerRepeats =
    perPlayer.reduce((sum, player) => sum + player.repeatedPartnerGames, 0) / 2;
  const totalOpponentRepeats =
    perPlayer.reduce(
      (sum, player) => sum + player.repeatedOpponentMeetings,
      0
    ) / 2;
  const longestRestStreak = perPlayer.reduce(
    (max, player) => Math.max(max, player.longestRestStreak),
    0
  );
  const deductions =
    Math.max(0, adjustedRange.spread - 1) * 20 +
    Math.max(0, restRange.spread - 1) * 10 +
    Math.max(0, partnerRepeatMax - 1) * 5 +
    Math.max(0, opponentRepeatMax - 2) * 2 +
    Math.max(0, longestRestStreak - 1) * 5 +
    duplicateSeatAssignments * 30 +
    underfilledMatches * 30 +
    unaccountedSeatRounds * 8 +
    Math.min(10, totalPartnerRepeats * 0.75) +
    Math.min(6, totalOpponentRepeats * 0.25);
  const score = Math.max(0, Math.min(100, Math.round(100 - deductions)));
  const band: FairnessBand =
    score >= 90
      ? "excellent"
      : score >= 75
      ? "balanced"
      : score >= 60
      ? "acceptable"
      : "needs_attention";

  return {
    score,
    band,
    gameRange,
    availabilityAdjustedGameRange: adjustedRange,
    restRange,
    partnerRepeatMax,
    opponentRepeatMax,
    duplicateSeatAssignments,
    underfilledMatches,
    unaccountedSeatRounds,
    playersAtTarget: perPlayer.filter(
      (player) => player.availabilityAdjustedGames === gamesPerPlayerTarget
    ).length,
    playersBelowTarget: perPlayer.filter(
      (player) => player.availabilityAdjustedGames < gamesPerPlayerTarget
    ).length,
    playersAboveTarget: perPlayer.filter(
      (player) => player.availabilityAdjustedGames > gamesPerPlayerTarget
    ).length,
    perPlayer,
  };
}

function emptyCapacity(
  input: ScheduleAdjustmentInput,
  protectedThroughRound: number
): ScheduleCapacity {
  return {
    playerCount: normalizedUnique(input.nextSeatIds).length,
    requestedCourts: Math.max(0, Math.floor(input.numCourts)),
    usableCourts: 0,
    unusedCourts: Math.max(0, Math.floor(input.numCourts)),
    matchesPerRound: 0,
    playersOnCourtPerRound: 0,
    restsPerRound: normalizedUnique(input.nextSeatIds).length,
    gamesPerPlayerTarget: Math.max(0, Math.floor(input.gamesPerPlayer)),
    protectedThroughRound,
    futureRounds: 0,
    recommendedTotalRounds: protectedThroughRound,
    scheduledFuturePlayerGames: 0,
    remainingTargetPlayerGames: 0,
    unavoidableExtraPlayerGames: 0,
    exactTargetPossible: false,
    playersNeededForAnotherCourt: null,
  };
}

function emptyImpact(
  input: ScheduleAdjustmentInput,
  preserved: CoreMatch[]
): ScheduleImpact {
  const currentSeats = new Set(normalizedUnique(input.currentSeatIds));
  const nextSeats = new Set(normalizedUnique(input.nextSeatIds));
  return {
    reasons: [],
    oldCourts: input.currentNumCourts ?? 0,
    newCourts: input.numCourts,
    oldRounds: input.currentTotalRounds,
    newRounds: input.currentTotalRounds,
    roundsAdded: 0,
    roundsRemoved: 0,
    preservedRows: preserved.length,
    rebuiltRows: 0,
    generatedRows: 0,
    preservedPlayableMatches: playable(preserved).length,
    generatedPlayableMatches: 0,
    addedSeats: [...nextSeats].filter((seatId) => !currentSeats.has(seatId)),
    removedSeats: [...currentSeats].filter((seatId) => !nextSeats.has(seatId)),
    substitutions: input.substitutions ?? [],
    summary: "No schedule could be generated.",
  };
}

/**
 * Plan a court, roster, game-target, late-join, removal, or substitution change.
 * The function never mutates the input and never performs I/O. Completed/live
 * rounds remain byte-for-byte intact; only safe future rounds are regenerated.
 */
export function planScheduleAdjustment(
  input: ScheduleAdjustmentInput
): ScheduleAdjustmentPlan {
  const nextSeatIds = normalizedUnique(input.nextSeatIds);
  const currentSeatIds = normalizedUnique(input.currentSeatIds);
  const firstMutableRound = Math.max(1, Math.floor(input.firstMutableRound));
  const explicitProtected = (input.protectedRounds ?? []).map((value) =>
    Math.max(0, Math.floor(value))
  );
  const protectedThroughRound = Math.max(
    firstMutableRound - 1,
    0,
    ...explicitProtected
  );
  const preservedMatches = input.currentMatches.filter(
    (match) => match.round_no <= protectedThroughRound
  );
  const warnings: ScheduleWarning[] = [];
  const format = input.format ?? "open";
  const genders = input.genders ?? new Map<SeatId, string>();
  const targetGames = Math.max(0, Math.floor(input.gamesPerPlayer));
  const gameCredits = new Map<SeatId, number>();
  const firstEligibleRounds = new Map<SeatId, number>();
  const relevantSeats = new Set([...currentSeatIds, ...nextSeatIds]);
  for (const seatId of relevantSeats) {
    const existingCredit = input.existingGameCredits?.get(seatId);
    if (existingCredit != null && Number.isFinite(existingCredit)) {
      gameCredits.set(
        seatId,
        Math.min(
          MAX_DURABLE_GAME_CREDIT,
          Math.max(0, Math.floor(existingCredit))
        )
      );
    }
    const existingFirstEligible =
      input.existingFirstEligibleRounds?.get(seatId);
    if (
      existingFirstEligible != null &&
      Number.isFinite(existingFirstEligible)
    ) {
      firstEligibleRounds.set(
        seatId,
        Math.max(1, Math.floor(existingFirstEligible))
      );
    }
  }
  // Keep the persisted baseline separate from credits assigned to brand-new
  // joiners below. A substitution inherits prior adjusted allocation, not the
  // roster-median credit that an unrelated late join would receive.
  const persistedGameCredits = new Map(gameCredits);
  let appliedGameCredits = creditsAppliedToTarget(gameCredits, targetGames);
  const firstPreservedRoundBySeat = new Map<SeatId, number>();
  for (const match of preservedMatches) {
    for (const seatId of seatsOf(match)) {
      const existing = firstPreservedRoundBySeat.get(seatId);
      if (existing == null || match.round_no < existing) {
        firstPreservedRoundBySeat.set(seatId, match.round_no);
      }
    }
  }

  if (nextSeatIds.length !== input.nextSeatIds.length) {
    const warning: ScheduleWarning = {
      code: "duplicate_player_identity",
      severity: "error",
      message: "The active roster contains duplicate player identities.",
    };
    return {
      ok: false,
      code: "duplicate_player_identity",
      schedule: preservedMatches,
      preservedMatches,
      generatedMatches: [],
      capacity: emptyCapacity(input, protectedThroughRound),
      impact: emptyImpact(input, preservedMatches),
      fairness: analyzeScheduleFairness(
        preservedMatches,
        nextSeatIds,
        targetGames,
        appliedGameCredits,
        firstEligibleRounds
      ),
      warnings: [warning],
      gameCredits,
      appliedGameCredits,
      firstEligibleRounds,
    };
  }

  const capacityShape = capacityFor(
    nextSeatIds,
    input.numCourts,
    format,
    genders
  );
  if (capacityShape.error) {
    warnings.push(capacityShape.error);
    return {
      ok: false,
      code: capacityShape.error.code,
      schedule: preservedMatches,
      preservedMatches,
      generatedMatches: [],
      capacity: {
        ...emptyCapacity(input, protectedThroughRound),
        playersNeededForAnotherCourt:
          capacityShape.playersNeededForAnotherCourt,
      },
      impact: emptyImpact(input, preservedMatches),
      fairness: analyzeScheduleFairness(
        preservedMatches,
        nextSeatIds,
        targetGames,
        appliedGameCredits,
        firstEligibleRounds
      ),
      warnings,
      gameCredits,
      appliedGameCredits,
      firstEligibleRounds,
    };
  }

  const currentSet = new Set(currentSeatIds);
  const nextSet = new Set(nextSeatIds);
  const addedSeats = nextSeatIds.filter((seatId) => !currentSet.has(seatId));
  const removedSeats = currentSeatIds.filter((seatId) => !nextSet.has(seatId));
  const priorGames = gamesBySeat(preservedMatches);
  const retainedPriorAllocations = nextSeatIds
    .filter((seatId) => currentSet.has(seatId))
    .map(
      (seatId) =>
        (priorGames.get(seatId) || 0) + (gameCredits.get(seatId) || 0)
    );
  const lateJoinCredit = input.lateJoinCredit ?? "roster_median";
  const defaultJoinCredit =
    lateJoinCredit === "roster_median"
      ? median(retainedPriorAllocations)
      : 0;
  addedSeats.forEach((seatId) => {
    gameCredits.set(
      seatId,
      Math.min(
        MAX_DURABLE_GAME_CREDIT,
        Math.max(gameCredits.get(seatId) || 0, defaultJoinCredit)
      )
    );
    firstEligibleRounds.set(
      seatId,
      firstPreservedRoundBySeat.get(seatId) ?? protectedThroughRound + 1
    );
  });

  for (const substitution of input.substitutions ?? []) {
    const validSubstitution =
      nextSet.has(substitution.incomingSeatId) &&
      !nextSet.has(substitution.outgoingSeatId) &&
      currentSet.has(substitution.outgoingSeatId) &&
      substitution.incomingSeatId !== substitution.outgoingSeatId;
    if (!validSubstitution) continue;

    if (substitution.inheritPriorGames !== false) {
      // The replacement may already occur in the post-RPC schedule snapshot
      // (or be a reactivated former roster member), so current-set membership
      // cannot identify a new substitute. Compare availability-adjusted
      // allocations, then solve for the incoming credit. This preserves a
      // replacement's own history and supports chained replacements without
      // adding an inherited credit twice.
      const incomingPriorGames =
        priorGames.get(substitution.incomingSeatId) || 0;
      const incomingAdjustedAllocation =
        incomingPriorGames +
        (persistedGameCredits.get(substitution.incomingSeatId) || 0);
      const outgoingAdjustedAllocation =
        (priorGames.get(substitution.outgoingSeatId) || 0) +
        (persistedGameCredits.get(substitution.outgoingSeatId) || 0);
      const inheritedAllocation = Math.max(
        incomingAdjustedAllocation,
        outgoingAdjustedAllocation
      );
      gameCredits.set(
        substitution.incomingSeatId,
        Math.min(
          MAX_DURABLE_GAME_CREDIT,
          Math.max(0, inheritedAllocation - incomingPriorGames)
        )
      );
    }

    firstEligibleRounds.set(
      substitution.incomingSeatId,
      firstPreservedRoundBySeat.get(substitution.incomingSeatId) ??
        protectedThroughRound + 1
    );
  }

  appliedGameCredits = creditsAppliedToTarget(gameCredits, targetGames);

  if (
    nextSeatIds.some(
      (seatId) => (appliedGameCredits.get(seatId) || 0) > 0
    )
  ) {
    warnings.push({
      code: "late_join_credit_applied",
      severity: "info",
      message:
        "Late arrivals and substitutes receive schedule-balancing credit for protected play they missed; the credit does not count in standings.",
    });
  }
  if (protectedThroughRound > 0) {
    warnings.push({
      code: "protected_rounds_preserved",
      severity: "info",
      message: `Rounds 1–${protectedThroughRound} are preserved; changes begin in Round ${
        protectedThroughRound + 1
      }.`,
    });
  }
  if (capacityShape.usableCourts < Math.floor(input.numCourts)) {
    const need = capacityShape.playersNeededForAnotherCourt;
    warnings.push({
      code: "unused_courts",
      severity: "info",
      message:
        need && need > 0
          ? `Only ${capacityShape.usableCourts} of ${Math.floor(
              input.numCourts
            )} courts can be filled; ${need} more eligible ${
              need === 1 ? "player is" : "players are"
            } needed for another court.`
          : `Only ${capacityShape.usableCourts} of ${Math.floor(
              input.numCourts
            )} courts can be filled by this roster.`,
    });
  }
  if (format === "mixed") {
    const males = nextSeatIds.filter(
      (seatId) => genders.get(seatId)?.toLowerCase() === "male"
    ).length;
    const females = nextSeatIds.length - males;
    if (males !== females) {
      const smaller = Math.min(males, females);
      const larger = Math.max(males, females);
      warnings.push({
        code: "mixed_roster_imbalance",
        severity: "info",
        message: `The mixed roster is ${males} men / ${females} women. The ${larger - smaller} extra ${
          larger - smaller === 1 ? "player" : "players"
        } in the larger group will receive more rests because each match requires two of each.`,
      });
    }
  }

  const effectiveGames = nextSeatIds.map(
    (seatId) =>
      (priorGames.get(seatId) || 0) +
      (appliedGameCredits.get(seatId) || 0)
  );
  const deficits = effectiveGames.map((games) =>
    Math.max(0, targetGames - games)
  );
  const remainingTargetPlayerGames = deficits.reduce(
    (sum, value) => sum + value,
    0
  );
  const maxDeficit = deficits.length ? Math.max(...deficits) : 0;
  const roundsForSlots =
    capacityShape.playersOnCourt > 0
      ? Math.ceil(remainingTargetPlayerGames / capacityShape.playersOnCourt)
      : 0;
  // Mixed doubles has an additional capacity constraint that the aggregate
  // four-player slot count cannot express: every playable court consumes
  // exactly two male and two female seats. With an uneven roster, the larger
  // gender group can still have outstanding obligations after the aggregate
  // slot calculation says the target is reachable. Size the future schedule
  // against each gender's remaining deficit independently so every eligible
  // player can reach the target (including protected-play history and virtual
  // late-join/substitution credit already represented in `deficits`).
  let roundsForGenderCapacity = 0;
  if (format === "mixed" && capacityShape.usableCourts > 0) {
    const playerGamesPerGenderPerRound = capacityShape.usableCourts * 2;
    let maleRemainingTargetGames = 0;
    let femaleRemainingTargetGames = 0;
    nextSeatIds.forEach((seatId, index) => {
      const gender = genders.get(seatId)?.trim().toLowerCase();
      if (gender === "male") maleRemainingTargetGames += deficits[index];
      if (gender === "female") femaleRemainingTargetGames += deficits[index];
    });
    roundsForGenderCapacity = Math.max(
      Math.ceil(maleRemainingTargetGames / playerGamesPerGenderPerRound),
      Math.ceil(femaleRemainingTargetGames / playerGamesPerGenderPerRound)
    );
  }
  const futureRounds = Math.max(
    maxDeficit,
    roundsForSlots,
    roundsForGenderCapacity
  );
  const recommendedTotalRounds = protectedThroughRound + futureRounds;
  const scheduledFuturePlayerGames =
    futureRounds * capacityShape.playersOnCourt;
  const unavoidableExtraPlayerGames = Math.max(
    0,
    scheduledFuturePlayerGames - remainingTargetPlayerGames
  );
  const exactTargetPossible = unavoidableExtraPlayerGames === 0;

  if (effectiveGames.some((games) => games > targetGames)) {
    warnings.push({
      code: "target_already_exceeded",
      severity: "warning",
      message:
        "At least one player has already exceeded the new game target; completed play remains intact.",
    });
  }
  if (!exactTargetPossible && futureRounds > 0) {
    warnings.push({
      code: "target_games_not_exact",
      severity: "info",
      message: `${unavoidableExtraPlayerGames} extra player-game ${
        unavoidableExtraPlayerGames === 1 ? "slot is" : "slots are"
      } unavoidable because ${
        format === "mixed"
          ? "each mixed-doubles court must use two men and two women"
          : "doubles matches use four players"
      }. Games will remain within the fairest possible spread.`,
    });
  }

  let generatedMatches: CoreMatch[] = [];
  if (futureRounds > 0) {
    generatedMatches = regenerateRounds({
      seed: `${input.seed}:adjust:${protectedThroughRound + 1}`,
      seatIds: nextSeatIds,
      numCourts: Math.floor(input.numCourts),
      gamesPerPlayer: targetGames,
      startFromRound: protectedThroughRound + 1,
      totalRounds: recommendedTotalRounds,
      format,
      frozenMatches: preservedMatches,
      genders,
      initialGameCredits: appliedGameCredits,
    });
  }
  const schedule = [...preservedMatches, ...generatedMatches].sort(
    (a, b) =>
      a.round_no - b.round_no ||
      a.court_no - b.court_no ||
      Number(a.is_bye) - Number(b.is_bye)
  );
  const fairness = analyzeScheduleFairness(
    schedule,
    nextSeatIds,
    targetGames,
    appliedGameCredits,
    firstEligibleRounds
  );

  const oldCourts =
    input.currentNumCourts ??
    Math.max(
      0,
      ...input.currentMatches
        .filter((match) => !match.is_bye)
        .map((match) => match.court_no)
    );
  const reasons: ScheduleImpactReason[] = [];
  if (oldCourts !== Math.floor(input.numCourts)) reasons.push("courts_changed");
  if ((input.currentGamesPerPlayer ?? targetGames) !== targetGames)
    reasons.push("games_target_changed");
  if (addedSeats.length > 0) reasons.push("players_added");
  if (removedSeats.length > 0) reasons.push("players_removed");
  if ((input.substitutions?.length ?? 0) > 0) reasons.push("substitution");
  if (recommendedTotalRounds < input.currentTotalRounds)
    reasons.push("rounds_compressed");
  if (recommendedTotalRounds > input.currentTotalRounds)
    reasons.push("rounds_extended");
  const existingMutable = input.currentMatches.filter(
    (match) => match.round_no > protectedThroughRound
  );
  if (existingMutable.length > 0 || generatedMatches.length > 0)
    reasons.push("schedule_rebalanced");
  if (
    oldCourts !== Math.floor(input.numCourts) &&
    capacityShape.usableCourts ===
      Math.min(oldCourts, Math.floor(nextSeatIds.length / 4))
  )
    reasons.push("no_effective_capacity_change");

  const delta = recommendedTotalRounds - input.currentTotalRounds;
  const summary =
    delta < 0
      ? `The remaining schedule is rebalanced and ${Math.abs(delta)} ${
          Math.abs(delta) === 1 ? "round" : "rounds"
        } shorter; protected play is unchanged.`
      : delta > 0
      ? `The schedule adds ${delta} ${
          delta === 1 ? "round" : "rounds"
        } so the updated roster can receive a fair share of games.`
      : capacityShape.unusedCourts > 0
      ? `The schedule is rebalanced, but the extra ${
          capacityShape.unusedCourts === 1 ? "court does" : "courts do"
        } not reduce rounds because the roster cannot fill ${Math.floor(
          input.numCourts
        )} courts.`
      : "The schedule is rebalanced within the same number of rounds; protected play is unchanged.";

  const capacity: ScheduleCapacity = {
    playerCount: nextSeatIds.length,
    requestedCourts: Math.floor(input.numCourts),
    usableCourts: capacityShape.usableCourts,
    unusedCourts: Math.max(
      0,
      Math.floor(input.numCourts) - capacityShape.usableCourts
    ),
    matchesPerRound: capacityShape.usableCourts,
    playersOnCourtPerRound: capacityShape.playersOnCourt,
    restsPerRound: capacityShape.rests,
    gamesPerPlayerTarget: targetGames,
    protectedThroughRound,
    futureRounds,
    recommendedTotalRounds,
    scheduledFuturePlayerGames,
    remainingTargetPlayerGames,
    unavoidableExtraPlayerGames,
    exactTargetPossible,
    playersNeededForAnotherCourt: capacityShape.playersNeededForAnotherCourt,
  };
  const impact: ScheduleImpact = {
    reasons,
    oldCourts,
    newCourts: Math.floor(input.numCourts),
    oldRounds: input.currentTotalRounds,
    newRounds: recommendedTotalRounds,
    roundsAdded: Math.max(0, delta),
    roundsRemoved: Math.max(0, -delta),
    preservedRows: preservedMatches.length,
    rebuiltRows: existingMutable.length,
    generatedRows: generatedMatches.length,
    preservedPlayableMatches: playable(preservedMatches).length,
    generatedPlayableMatches: playable(generatedMatches).length,
    addedSeats,
    removedSeats,
    substitutions: input.substitutions ?? [],
    summary,
  };

  return {
    ok: true,
    schedule,
    preservedMatches,
    generatedMatches,
    capacity,
    impact,
    fairness,
    warnings,
    gameCredits,
    appliedGameCredits,
    firstEligibleRounds,
  };
}
