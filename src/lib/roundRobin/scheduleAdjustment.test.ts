import { describe, expect, it } from "vitest";
import {
  analyzeScheduleFairness,
  planScheduleAdjustment,
  type ScheduleAdjustmentInput,
} from "./scheduleAdjustment";
import {
  regenerateRounds,
  seatsOf,
  type CoreMatch,
  type SeatId,
} from "./scheduleCore";

const seats = (count: number): SeatId[] =>
  Array.from(
    { length: count },
    (_, index) => `p:${String.fromCharCode(65 + index)}`
  );

function input(
  overrides: Partial<ScheduleAdjustmentInput> = {}
): ScheduleAdjustmentInput {
  const roster = seats(8);
  return {
    seed: "event-1",
    currentMatches: [],
    currentSeatIds: roster,
    nextSeatIds: roster,
    currentNumCourts: 1,
    currentGamesPerPlayer: 4,
    currentTotalRounds: 8,
    firstMutableRound: 1,
    numCourts: 2,
    gamesPerPlayer: 4,
    ...overrides,
  };
}

function expectEverySeatAccountedFor(matches: CoreMatch[], roster: SeatId[]) {
  const rounds = [...new Set(matches.map((match) => match.round_no))];
  for (const roundNo of rounds) {
    const inRound = matches.filter((match) => match.round_no === roundNo);
    const occupied = inRound.flatMap(seatsOf);
    expect(new Set(occupied).size).toBe(roster.length);
    expect(occupied).toHaveLength(roster.length);
  }
}

describe("planScheduleAdjustment", () => {
  it("compresses the schedule when added courts provide real capacity", () => {
    const plan = planScheduleAdjustment(input());

    expect(plan.ok).toBe(true);
    expect(plan.capacity).toMatchObject({
      requestedCourts: 2,
      usableCourts: 2,
      futureRounds: 4,
      recommendedTotalRounds: 4,
    });
    expect(plan.impact.roundsRemoved).toBe(4);
    expect(plan.impact.reasons).toContain("rounds_compressed");
    expect(plan.generatedMatches.filter((match) => !match.is_bye)).toHaveLength(
      8
    );
    expect(plan.fairness.partnerRepeatMax).toBe(1);
    expectEverySeatAccountedFor(plan.schedule, seats(8));
  });

  it("compresses a 12-player prestart schedule from two courts to three", () => {
    const roster = seats(12);
    const plan = planScheduleAdjustment(
      input({
        currentSeatIds: roster,
        nextSeatIds: roster,
        currentNumCourts: 2,
        currentTotalRounds: 6,
        numCourts: 3,
      }),
    );

    expect(plan.ok).toBe(true);
    expect(plan.capacity).toMatchObject({
      usableCourts: 3,
      futureRounds: 4,
      recommendedTotalRounds: 4,
      remainingTargetPlayerGames: 48,
    });
    expect(plan.impact.roundsRemoved).toBe(2);
    expect(plan.fairness.gameRange).toMatchObject({ min: 4, max: 4, spread: 0 });
  });

  it("extends after a frozen two-court round so every obligation remains reachable", () => {
    const roster = seats(12);
    const frozen = regenerateRounds({
      seed: "partly-played",
      seatIds: roster,
      numCourts: 2,
      gamesPerPlayer: 1,
      startFromRound: 1,
      totalRounds: 1,
    });
    const plan = planScheduleAdjustment(
      input({
        currentMatches: frozen,
        currentSeatIds: roster,
        nextSeatIds: roster,
        currentNumCourts: 2,
        currentTotalRounds: 4,
        firstMutableRound: 2,
        numCourts: 3,
      }),
    );

    expect(plan.ok).toBe(true);
    // A naive from-scratch calculation says four total rounds. Four players
    // sat out Round 1, so they need four *future* opportunities: total five.
    expect(plan.capacity).toMatchObject({
      protectedThroughRound: 1,
      futureRounds: 4,
      recommendedTotalRounds: 5,
      remainingTargetPlayerGames: 40,
    });
    expect(plan.impact.roundsAdded).toBe(1);
    expect(plan.fairness.gameRange.spread).toBeLessThanOrEqual(1);
    expect(plan.fairness.playersBelowTarget).toBe(0);
  });

  it("extends rounds when court capacity decreases", () => {
    const roster = seats(12);
    const plan = planScheduleAdjustment(
      input({
        currentSeatIds: roster,
        nextSeatIds: roster,
        currentNumCourts: 3,
        currentTotalRounds: 4,
        numCourts: 1,
      }),
    );

    expect(plan.ok).toBe(true);
    expect(plan.capacity).toMatchObject({
      usableCourts: 1,
      playersOnCourtPerRound: 4,
      restsPerRound: 8,
      futureRounds: 12,
      recommendedTotalRounds: 12,
    });
    expect(plan.impact.roundsAdded).toBe(8);
    expect(plan.fairness.gameRange.spread).toBeLessThanOrEqual(1);
  });

  it("explains when another court cannot change capacity", () => {
    const roster = seats(6);
    const plan = planScheduleAdjustment(
      input({
        currentSeatIds: roster,
        nextSeatIds: roster,
        currentTotalRounds: 5,
        currentNumCourts: 1,
        numCourts: 2,
        gamesPerPlayer: 3,
        currentGamesPerPlayer: 3,
      })
    );

    expect(plan.ok).toBe(true);
    expect(plan.capacity.usableCourts).toBe(1);
    expect(plan.capacity.unusedCourts).toBe(1);
    expect(plan.capacity.playersNeededForAnotherCourt).toBe(2);
    expect(plan.capacity.recommendedTotalRounds).toBe(5);
    expect(plan.impact.reasons).toContain("no_effective_capacity_change");
    expect(
      plan.warnings.find((warning) => warning.code === "unused_courts")?.message
    ).toContain("2 more eligible players");
    expect(plan.warnings.map((warning) => warning.code)).toContain(
      "target_games_not_exact"
    );
    expect(plan.fairness).toMatchObject({
      duplicateSeatAssignments: 0,
      underfilledMatches: 0,
      unaccountedSeatRounds: 0,
    });
  });

  it("preserves completed rounds and rebuilds only the safe future", () => {
    const roster = seats(8);
    const completed = regenerateRounds({
      seed: "completed",
      seatIds: roster,
      numCourts: 2,
      gamesPerPlayer: 2,
      startFromRound: 1,
      totalRounds: 2,
    });
    const staleFuture = regenerateRounds({
      seed: "old-future",
      seatIds: roster,
      numCourts: 1,
      gamesPerPlayer: 4,
      startFromRound: 3,
      totalRounds: 8,
      frozenMatches: completed,
    });
    const plan = planScheduleAdjustment(
      input({
        currentMatches: [...completed, ...staleFuture],
        firstMutableRound: 3,
        protectedRounds: [2],
      })
    );

    expect(plan.ok).toBe(true);
    expect(plan.preservedMatches).toEqual(completed);
    expect(plan.capacity.recommendedTotalRounds).toBe(4);
    expect(
      plan.generatedMatches.every(
        (match) => match.round_no >= 3 && match.round_no <= 4
      )
    ).toBe(true);
    expect(plan.impact.rebuiltRows).toBe(staleFuture.length);
    expect(plan.fairness.availabilityAdjustedGameRange).toMatchObject({
      min: 4,
      max: 4,
      spread: 0,
    });
  });

  it("balances a late join from arrival rather than extending solely for missed history", () => {
    const original = seats(8);
    const next = [...original, "p:I"];
    const completed = regenerateRounds({
      seed: "completed",
      seatIds: original,
      numCourts: 2,
      gamesPerPlayer: 2,
      startFromRound: 1,
      totalRounds: 2,
    });
    const plan = planScheduleAdjustment(
      input({
        currentMatches: completed,
        currentSeatIds: original,
        nextSeatIds: next,
        currentTotalRounds: 4,
        firstMutableRound: 3,
        numCourts: 2,
      })
    );

    expect(plan.ok).toBe(true);
    expect(plan.gameCredits.get("p:I")).toBe(2);
    expect(plan.warnings.map((warning) => warning.code)).toContain(
      "late_join_credit_applied"
    );
    expect(
      plan.fairness.availabilityAdjustedGameRange.spread
    ).toBeLessThanOrEqual(1);
    expect(plan.fairness.gameRange.min).toBeLessThan(
      plan.fairness.gameRange.max
    );
    expectEverySeatAccountedFor(plan.generatedMatches, next);
  });

  it("preserves late-join allocation metadata across an ordinary court change", () => {
    const original = seats(8);
    const joinedRoster = [...original, "p:I"];
    const protectedMatches = regenerateRounds({
      seed: "late-join-persistence",
      seatIds: original,
      numCourts: 2,
      gamesPerPlayer: 2,
      startFromRound: 1,
      totalRounds: 2,
    });
    const joinPlan = planScheduleAdjustment(
      input({
        currentMatches: protectedMatches,
        currentSeatIds: original,
        nextSeatIds: joinedRoster,
        currentTotalRounds: 4,
        firstMutableRound: 3,
        numCourts: 2,
      }),
    );

    expect(joinPlan.ok).toBe(true);
    expect(joinPlan.gameCredits.get("p:I")).toBe(2);
    expect(joinPlan.firstEligibleRounds.get("p:I")).toBe(3);

    const courtChangePlan = planScheduleAdjustment(
      input({
        currentMatches: joinPlan.schedule,
        currentSeatIds: joinedRoster,
        nextSeatIds: joinedRoster,
        currentNumCourts: 2,
        currentTotalRounds: joinPlan.capacity.recommendedTotalRounds,
        firstMutableRound: 3,
        numCourts: 1,
        existingGameCredits: joinPlan.gameCredits,
        existingFirstEligibleRounds: joinPlan.firstEligibleRounds,
      }),
    );

    expect(courtChangePlan.ok).toBe(true);
    expect(courtChangePlan.impact.addedSeats).toEqual([]);
    expect(courtChangePlan.gameCredits.get("p:I")).toBe(2);
    expect(courtChangePlan.firstEligibleRounds.get("p:I")).toBe(3);
    expect(
      courtChangePlan.fairness.perPlayer.find(
        (player) => player.seatId === "p:I",
      ),
    ).toMatchObject({
      gameCredit: 2,
      firstEligibleRound: 3,
    });
    expect(courtChangePlan.fairness.unaccountedSeatRounds).toBe(0);
  });

  it("restores durable credit after the game target is lowered and raised", () => {
    const original = seats(8);
    const lateJoiner: SeatId = "p:I";
    const roster = [...original, lateJoiner];
    const protectedMatches = regenerateRounds({
      seed: "target-credit-restoration",
      seatIds: original,
      numCourts: 2,
      gamesPerPlayer: 8,
      startFromRound: 1,
      totalRounds: 8,
    });
    const durableCredits = new Map<SeatId, number>([[lateJoiner, 8]]);
    const eligibility = new Map<SeatId, number>([[lateJoiner, 9]]);

    const loweredPlan = planScheduleAdjustment(
      input({
        currentMatches: protectedMatches,
        currentSeatIds: roster,
        nextSeatIds: roster,
        currentNumCourts: 2,
        currentGamesPerPlayer: 8,
        currentTotalRounds: 8,
        firstMutableRound: 9,
        numCourts: 2,
        gamesPerPlayer: 3,
        existingGameCredits: durableCredits,
        existingFirstEligibleRounds: eligibility,
      }),
    );

    expect(loweredPlan.ok).toBe(true);
    expect(loweredPlan.gameCredits.get(lateJoiner)).toBe(8);
    expect(loweredPlan.appliedGameCredits.get(lateJoiner)).toBe(3);
    expect(
      loweredPlan.fairness.perPlayer.find(
        (player) => player.seatId === lateJoiner,
      ),
    ).toMatchObject({ gameCredit: 3, availabilityAdjustedGames: 3 });

    const restoredPlan = planScheduleAdjustment(
      input({
        currentMatches: loweredPlan.schedule,
        currentSeatIds: roster,
        nextSeatIds: roster,
        currentNumCourts: 2,
        currentGamesPerPlayer: 3,
        currentTotalRounds: loweredPlan.capacity.recommendedTotalRounds,
        firstMutableRound: 9,
        numCourts: 2,
        gamesPerPlayer: 8,
        existingGameCredits: loweredPlan.gameCredits,
        existingFirstEligibleRounds: loweredPlan.firstEligibleRounds,
      }),
    );

    expect(restoredPlan.ok).toBe(true);
    expect(restoredPlan.gameCredits.get(lateJoiner)).toBe(8);
    expect(restoredPlan.appliedGameCredits.get(lateJoiner)).toBe(8);
    expect(
      restoredPlan.fairness.perPlayer.find(
        (player) => player.seatId === lateJoiner,
      ),
    ).toMatchObject({ gameCredit: 8, availabilityAdjustedGames: 8 });
    expect(restoredPlan.fairness.playersBelowTarget).toBe(0);
  });

  it("inherits prior-game allocation for a substitute without rewriting results", () => {
    const original = seats(8);
    const completed = regenerateRounds({
      seed: "completed",
      seatIds: original,
      numCourts: 2,
      gamesPerPlayer: 2,
      startFromRound: 1,
      totalRounds: 2,
    });
    const next = original.filter((seatId) => seatId !== "p:A").concat("p:I");
    const plan = planScheduleAdjustment(
      input({
        currentMatches: completed,
        currentSeatIds: original,
        nextSeatIds: next,
        currentTotalRounds: 4,
        firstMutableRound: 3,
        substitutions: [{ outgoingSeatId: "p:A", incomingSeatId: "p:I" }],
      })
    );

    expect(plan.ok).toBe(true);
    expect(plan.preservedMatches.flatMap(seatsOf)).toContain("p:A");
    expect(plan.generatedMatches.flatMap(seatsOf)).not.toContain("p:A");
    expect(plan.generatedMatches.flatMap(seatsOf)).toContain("p:I");
    expect(plan.gameCredits.get("p:I")).toBe(2);
    expect(plan.impact.reasons).toContain("substitution");
  });

  it("uses the outgoing allocation rather than unrelated late-join median for a replacement", () => {
    const original = seats(9);
    const completed = regenerateRounds({
      seed: "lower-allocation-outgoing",
      seatIds: original,
      numCourts: 2,
      gamesPerPlayer: 2,
      startFromRound: 1,
      totalRounds: 2,
    });
    const protectedGames = new Map<SeatId, number>();
    completed
      .filter((match) => !match.is_bye)
      .flatMap(seatsOf)
      .forEach((seatId) =>
        protectedGames.set(seatId, (protectedGames.get(seatId) || 0) + 1),
      );
    const outgoing = original.find(
      (seatId) => protectedGames.get(seatId) === 1,
    )!;
    const incoming: SeatId = "p:J";
    const next = original
      .filter((seatId) => seatId !== outgoing)
      .concat(incoming);

    const plan = planScheduleAdjustment(
      input({
        currentMatches: completed,
        currentSeatIds: original,
        nextSeatIds: next,
        currentTotalRounds: 4,
        firstMutableRound: 3,
        gamesPerPlayer: 4,
        substitutions: [{ outgoingSeatId: outgoing, incomingSeatId: incoming }],
      }),
    );

    expect(plan.ok).toBe(true);
    const sortedProtectedGames = [...protectedGames.values()].sort(
      (left, right) => left - right,
    );
    expect(sortedProtectedGames[Math.floor(sortedProtectedGames.length / 2)]).toBe(
      2,
    );
    expect(plan.gameCredits.get(incoming)).toBe(1);
  });

  it("inherits raw replacement history above a temporarily lower target", () => {
    const original = seats(8);
    const incoming: SeatId = "p:I";
    const completed = regenerateRounds({
      seed: "raw-replacement-history",
      seatIds: original,
      numCourts: 2,
      gamesPerPlayer: 2,
      startFromRound: 1,
      totalRounds: 2,
    });
    const next = original.slice(1).concat(incoming);
    const plan = planScheduleAdjustment(
      input({
        currentMatches: completed,
        currentSeatIds: original,
        nextSeatIds: next,
        currentTotalRounds: 3,
        firstMutableRound: 3,
        gamesPerPlayer: 3,
        substitutions: [{ outgoingSeatId: "p:A", incomingSeatId: incoming }],
        existingGameCredits: new Map<SeatId, number>([
          ["p:A", 8],
          [incoming, 4],
        ]),
      }),
    );

    expect(plan.ok).toBe(true);
    // A owns 2 real games + 8 durable credit. I's own credit is 4, so the
    // solved replacement credit is 10—not 4 + 10—and only 3 applies now.
    expect(plan.gameCredits.get(incoming)).toBe(10);
    expect(plan.appliedGameCredits.get(incoming)).toBe(3);
    expect(
      plan.fairness.perPlayer.find((player) => player.seatId === incoming)
        ?.gameCredit,
    ).toBe(3);
  });

  it("credits only the protected-play gap when a substitute already exists in the snapshot", () => {
    const roster = seats(9);
    const protectedMatches = regenerateRounds({
      seed: "reactivated-substitute",
      seatIds: roster,
      numCourts: 2,
      gamesPerPlayer: 2,
      startFromRound: 1,
      totalRounds: 2,
    });
    const protectedGames = new Map<SeatId, number>();
    protectedMatches
      .filter((match) => !match.is_bye)
      .flatMap(seatsOf)
      .forEach((seatId) => {
        protectedGames.set(seatId, (protectedGames.get(seatId) ?? 0) + 1);
      });
    const outgoing = roster.find((seatId) => protectedGames.get(seatId) === 2)!;
    const incoming = roster.find((seatId) => protectedGames.get(seatId) === 1)!;
    const next = roster.filter((seatId) => seatId !== outgoing);

    const gapPlan = planScheduleAdjustment(
      input({
        currentMatches: protectedMatches,
        currentSeatIds: roster,
        nextSeatIds: next,
        currentTotalRounds: 4,
        firstMutableRound: 3,
        substitutions: [{ outgoingSeatId: outgoing, incomingSeatId: incoming }],
      }),
    );

    expect(gapPlan.ok).toBe(true);
    expect(gapPlan.gameCredits.get(incoming)).toBe(1);
    expect(gapPlan.warnings.map((warning) => warning.code)).toContain(
      "late_join_credit_applied",
    );

    const noDoubleCreditPlan = planScheduleAdjustment(
      input({
        currentMatches: protectedMatches,
        currentSeatIds: roster,
        nextSeatIds: roster.filter((seatId) => seatId !== incoming),
        currentTotalRounds: 4,
        firstMutableRound: 3,
        substitutions: [{ outgoingSeatId: incoming, incomingSeatId: outgoing }],
      }),
    );

    expect(noDoubleCreditPlan.ok).toBe(true);
    expect(noDoubleCreditPlan.gameCredits.get(outgoing)).toBe(0);
  });

  it("starts substitute fairness when the handoff begins if they exist only in mutable rows", () => {
    const original = seats(8);
    const incoming: SeatId = "p:I";
    const protectedMatches = regenerateRounds({
      seed: "protected-before-handoff",
      seatIds: original,
      numCourts: 2,
      gamesPerPlayer: 1,
      startFromRound: 1,
      totalRounds: 1,
    });
    const staleMutableMatches = regenerateRounds({
      seed: "stale-after-handoff",
      seatIds: original.slice(1).concat(incoming),
      numCourts: 2,
      gamesPerPlayer: 1,
      startFromRound: 2,
      totalRounds: 2,
    });
    const currentSeatIds = [
      ...new Set([...protectedMatches, ...staleMutableMatches].flatMap(seatsOf)),
    ];
    const nextSeatIds = original.slice(1).concat(incoming);

    const plan = planScheduleAdjustment(
      input({
        currentMatches: [...protectedMatches, ...staleMutableMatches],
        currentSeatIds,
        nextSeatIds,
        currentTotalRounds: 3,
        firstMutableRound: 2,
        substitutions: [{ outgoingSeatId: "p:A", incomingSeatId: incoming }],
      }),
    );

    expect(plan.ok).toBe(true);
    expect(plan.impact.addedSeats).not.toContain(incoming);
    expect(plan.gameCredits.get(incoming)).toBe(1);
    expect(
      plan.fairness.perPlayer.find((player) => player.seatId === incoming)
        ?.firstEligibleRound,
    ).toBe(2);
    expect(plan.fairness.unaccountedSeatRounds).toBe(0);
  });

  it("starts substitute fairness at their earliest protected appearance", () => {
    const original = seats(8);
    const incoming: SeatId = "p:I";
    const protectedMatches = regenerateRounds({
      seed: "protected-live-handoff",
      seatIds: original,
      numCourts: 2,
      gamesPerPlayer: 2,
      startFromRound: 1,
      totalRounds: 2,
    }).map((match) => {
      if (match.round_no !== 2) return match;
      return {
        ...match,
        a1: match.a1 === "p:A" ? incoming : match.a1,
        a2: match.a2 === "p:A" ? incoming : match.a2,
        b1: match.b1 === "p:A" ? incoming : match.b1,
        b2: match.b2 === "p:A" ? incoming : match.b2,
      };
    });
    const currentSeatIds = [
      ...new Set(protectedMatches.flatMap(seatsOf)),
    ];
    const nextSeatIds = original.slice(1).concat(incoming);

    const plan = planScheduleAdjustment(
      input({
        currentMatches: protectedMatches,
        currentSeatIds,
        nextSeatIds,
        currentTotalRounds: 4,
        firstMutableRound: 3,
        protectedRounds: [2],
        substitutions: [{ outgoingSeatId: "p:A", incomingSeatId: incoming }],
      }),
    );

    expect(plan.ok).toBe(true);
    expect(plan.impact.addedSeats).not.toContain(incoming);
    expect(
      plan.fairness.perPlayer.find((player) => player.seatId === incoming)
        ?.firstEligibleRound,
    ).toBe(2);
    expect(plan.fairness.unaccountedSeatRounds).toBe(0);
  });

  it("carries adjusted allocation through chained replacements without double credit", () => {
    const original = seats(8);
    const firstIncoming: SeatId = "p:I";
    const secondIncoming: SeatId = "p:J";
    const firstProtected = regenerateRounds({
      seed: "chained-replacement",
      seatIds: original,
      numCourts: 2,
      gamesPerPlayer: 2,
      startFromRound: 1,
      totalRounds: 2,
    });
    const firstRoster = original.slice(1).concat(firstIncoming);
    const firstPlan = planScheduleAdjustment(
      input({
        currentMatches: firstProtected,
        currentSeatIds: original,
        nextSeatIds: firstRoster,
        currentTotalRounds: 4,
        firstMutableRound: 3,
        gamesPerPlayer: 5,
        substitutions: [
          { outgoingSeatId: "p:A", incomingSeatId: firstIncoming },
        ],
      }),
    );

    expect(firstPlan.ok).toBe(true);
    expect(firstPlan.gameCredits.get(firstIncoming)).toBe(2);

    const protectedThroughRoundThree = firstPlan.schedule.filter(
      (match) => match.round_no <= 3,
    );
    const secondRoster = firstRoster
      .filter((seatId) => seatId !== firstIncoming)
      .concat(secondIncoming);
    const secondPlan = planScheduleAdjustment(
      input({
        currentMatches: protectedThroughRoundThree,
        currentSeatIds: firstRoster,
        nextSeatIds: secondRoster,
        currentTotalRounds: firstPlan.capacity.recommendedTotalRounds,
        firstMutableRound: 4,
        gamesPerPlayer: 5,
        lateJoinCredit: "none",
        substitutions: [
          {
            outgoingSeatId: firstIncoming,
            incomingSeatId: secondIncoming,
          },
        ],
        existingGameCredits: new Map([
          ...firstPlan.gameCredits,
          [secondIncoming, 1] as const,
        ]),
        existingFirstEligibleRounds: firstPlan.firstEligibleRounds,
      }),
    );

    expect(secondPlan.ok).toBe(true);
    // I has one real protected game plus two credits. J already owns one
    // credit, so its final credit is three—not 1 + 3 and not the raw gap.
    expect(secondPlan.gameCredits.get(secondIncoming)).toBe(3);
    expect(secondPlan.firstEligibleRounds.get(secondIncoming)).toBe(4);
    expect(
      secondPlan.fairness.perPlayer.find(
        (player) => player.seatId === secondIncoming,
      )?.availabilityAdjustedGames,
    ).toBeGreaterThanOrEqual(5);

    const higherOwnAllocation = planScheduleAdjustment(
      input({
        currentMatches: protectedThroughRoundThree,
        currentSeatIds: firstRoster,
        nextSeatIds: secondRoster,
        currentTotalRounds: firstPlan.capacity.recommendedTotalRounds,
        firstMutableRound: 4,
        gamesPerPlayer: 5,
        lateJoinCredit: "none",
        substitutions: [
          {
            outgoingSeatId: firstIncoming,
            incomingSeatId: secondIncoming,
          },
        ],
        existingGameCredits: new Map([
          ...firstPlan.gameCredits,
          [secondIncoming, 40] as const,
        ]),
      }),
    );

    expect(higherOwnAllocation.ok).toBe(true);
    expect(higherOwnAllocation.gameCredits.get(secondIncoming)).toBe(20);
    expect(higherOwnAllocation.appliedGameCredits.get(secondIncoming)).toBe(5);
  });

  it("rebalances after a removal with valid matches and balanced rests", () => {
    const original = seats(8);
    const next = original.slice(0, 7);
    const completed = regenerateRounds({
      seed: "completed",
      seatIds: original,
      numCourts: 2,
      gamesPerPlayer: 1,
      startFromRound: 1,
      totalRounds: 1,
    });
    const plan = planScheduleAdjustment(
      input({
        currentMatches: completed,
        currentSeatIds: original,
        nextSeatIds: next,
        currentTotalRounds: 4,
        firstMutableRound: 2,
        numCourts: 2,
        gamesPerPlayer: 3,
      })
    );

    expect(plan.ok).toBe(true);
    expect(plan.capacity.usableCourts).toBe(1);
    expect(plan.capacity.restsPerRound).toBe(3);
    expect(plan.impact.removedSeats).toEqual(["p:H"]);
    expect(
      plan.fairness.availabilityAdjustedGameRange.spread
    ).toBeLessThanOrEqual(1);
    expectEverySeatAccountedFor(plan.generatedMatches, next);
  });

  it("rejects impossible capacity instead of returning an empty-looking success", () => {
    const tooSmall = seats(3);
    const noPlayers = planScheduleAdjustment(
      input({
        currentSeatIds: tooSmall,
        nextSeatIds: tooSmall,
      })
    );
    const noCourts = planScheduleAdjustment(input({ numCourts: 0 }));

    expect(noPlayers).toMatchObject({
      ok: false,
      code: "insufficient_players",
    });
    expect(noCourts).toMatchObject({ ok: false, code: "no_courts" });
  });

  it("accounts for every player in an uneven mixed roster", () => {
    const roster = seats(8);
    const genders = new Map<SeatId, string>(
      roster.map((seatId, index) => [seatId, index < 5 ? "male" : "female"])
    );
    const plan = planScheduleAdjustment(
      input({
        currentSeatIds: roster,
        nextSeatIds: roster,
        currentNumCourts: 2,
        currentTotalRounds: 8,
        numCourts: 2,
        gamesPerPlayer: 3,
        currentGamesPerPlayer: 3,
        format: "mixed",
        genders,
      })
    );

    expect(plan.ok).toBe(true);
    expect(plan.capacity.usableCourts).toBe(1);
    expect(plan.capacity.restsPerRound).toBe(4);
    // Five men need 15 player-games, but a mixed court supplies only two male
    // seats per round. Eight rounds are therefore required even though six
    // rounds would satisfy the aggregate 24 / 4 player-slot calculation.
    expect(plan.capacity).toMatchObject({
      futureRounds: 8,
      recommendedTotalRounds: 8,
      remainingTargetPlayerGames: 24,
      scheduledFuturePlayerGames: 32,
      unavoidableExtraPlayerGames: 8,
      exactTargetPossible: false,
    });
    expect(plan.fairness.playersBelowTarget).toBe(0);
    expect(
      plan.warnings.find((warning) => warning.code === "target_games_not_exact")
        ?.message
    ).toContain("two men and two women");
    expect(
      plan.fairness.perPlayer.every(
        (player) => player.availabilityAdjustedGames >= 3
      )
    ).toBe(true);
    expectEverySeatAccountedFor(plan.generatedMatches, roster);
    for (const match of plan.generatedMatches.filter((row) => !row.is_bye)) {
      const matchGenders = seatsOf(match).map((seatId) => genders.get(seatId));
      expect(matchGenders.filter((gender) => gender === "male")).toHaveLength(
        2
      );
      expect(matchGenders.filter((gender) => gender === "female")).toHaveLength(
        2
      );
    }
  });

  it("honors protected mixed play and late-join credit while keeping every eligible player on target", () => {
    const roster = seats(8);
    const originalRoster = roster.filter((seatId) => seatId !== "p:E");
    const genders = new Map<SeatId, string>(
      roster.map((seatId, index) => [seatId, index < 5 ? "male" : "female"])
    );
    const protectedRound = regenerateRounds({
      seed: "mixed-protected",
      seatIds: originalRoster,
      numCourts: 1,
      gamesPerPlayer: 1,
      startFromRound: 1,
      totalRounds: 1,
      format: "mixed",
      genders,
    });

    const plan = planScheduleAdjustment(
      input({
        seed: "mixed-protected",
        currentMatches: protectedRound,
        currentSeatIds: originalRoster,
        nextSeatIds: roster,
        currentNumCourts: 1,
        currentGamesPerPlayer: 3,
        currentTotalRounds: 6,
        firstMutableRound: 2,
        protectedRounds: [1],
        numCourts: 1,
        gamesPerPlayer: 3,
        format: "mixed",
        genders,
      })
    );

    expect(plan.ok).toBe(true);
    expect(plan.preservedMatches).toEqual(protectedRound);
    expect(plan.gameCredits.get("p:E")).toBe(1);
    // After protected play and the late joiner's median credit, the men still
    // have 12 adjusted games left. Two male seats per round require six future
    // rounds; the previous aggregate calculation incorrectly chose five.
    expect(plan.capacity).toMatchObject({
      protectedThroughRound: 1,
      futureRounds: 6,
      recommendedTotalRounds: 7,
      remainingTargetPlayerGames: 19,
      scheduledFuturePlayerGames: 24,
      unavoidableExtraPlayerGames: 5,
      exactTargetPossible: false,
    });
    expect(plan.fairness.playersBelowTarget).toBe(0);
    expect(
      plan.fairness.perPlayer.every(
        (player) => player.availabilityAdjustedGames >= 3
      )
    ).toBe(true);
    expectEverySeatAccountedFor(plan.generatedMatches, roster);
  });

  it("rejects a mixed roster that cannot form one court", () => {
    const roster = seats(6);
    const genders = new Map<SeatId, string>(
      roster.map((seatId, index) => [seatId, index < 5 ? "male" : "female"])
    );
    const plan = planScheduleAdjustment(
      input({
        currentSeatIds: roster,
        nextSeatIds: roster,
        format: "mixed",
        genders,
      })
    );

    expect(plan).toMatchObject({ ok: false, code: "mixed_roster_unplayable" });
  });

  it("rejects mixed scheduling until every active player has an eligible gender", () => {
    const roster = seats(6);
    const genders = new Map<SeatId, string>([
      ["p:A", "male"],
      ["p:B", "male"],
      ["p:C", "female"],
      ["p:D", "female"],
      ["p:E", "nonbinary"],
    ]);
    const plan = planScheduleAdjustment(
      input({
        currentSeatIds: roster,
        nextSeatIds: roster,
        format: "mixed",
        genders,
      })
    );

    expect(plan).toMatchObject({
      ok: false,
      code: "mixed_roster_gender_missing",
    });
    expect(plan.warnings[0].message).toContain("2 active players need");
  });

  it.each([
    ["male", "male"],
    ["female", "female"],
  ] as const)(
    "builds a valid %s-format schedule when every player is eligible",
    (format, gender) => {
      const roster = seats(8);
      const genders = new Map<SeatId, string>(
        roster.map((seatId) => [seatId, gender])
      );
      const plan = planScheduleAdjustment(
        input({
          currentSeatIds: roster,
          nextSeatIds: roster,
          currentTotalRounds: 4,
          firstMutableRound: 1,
          numCourts: 2,
          gamesPerPlayer: 4,
          format,
          genders,
        })
      );

      expect(plan.ok).toBe(true);
      expect(plan.capacity.usableCourts).toBe(2);
      expect(plan.warnings.map((warning) => warning.code)).not.toContain(
        "gender_format_mismatch"
      );
      expectEverySeatAccountedFor(plan.schedule, roster);
    }
  );

  it.each([
    ["male", "male", "female", "Men's"],
    ["female", "female", "male", "Women's"],
  ] as const)(
    "blocks a %s-format schedule when an active player is ineligible",
    (format, eligibleGender, ineligibleGender, label) => {
      const roster = seats(8);
      const genders = new Map<SeatId, string>(
        roster.map((seatId) => [seatId, eligibleGender])
      );
      genders.set(roster[7], ineligibleGender);
      const plan = planScheduleAdjustment(
        input({
          currentSeatIds: roster,
          nextSeatIds: roster,
          format,
          genders,
        })
      );

      expect(plan).toMatchObject({
        ok: false,
        code: "gender_format_mismatch",
      });
      expect(plan.warnings[0].message).toContain(label);
      expect(plan.warnings[0].message).toContain("1 player is");
    }
  );

  it("satisfies schedule invariants across a bounded open and mixed matrix", () => {
    const openPlayerCounts = [4, 5, 8, 11, 16, 20];
    const requestedCourts = [1, 2, 5];
    const gameTargets = [1, 3, 5];

    for (const playerCount of openPlayerCounts) {
      const roster = seats(playerCount);
      for (const numCourts of requestedCourts) {
        for (const gamesPerPlayer of gameTargets) {
          const label = `open ${playerCount}p/${numCourts}c/${gamesPerPlayer}g`;
          const plan = planScheduleAdjustment(
            input({
              seed: label,
              currentMatches: [],
              currentSeatIds: roster,
              nextSeatIds: roster,
              currentTotalRounds: 1,
              firstMutableRound: 1,
              numCourts,
              gamesPerPlayer,
              format: "open",
            })
          );

          expect(plan.ok, label).toBe(true);
          expect(plan.fairness.playersBelowTarget, label).toBe(0);
          const rounds = [
            ...new Set(plan.generatedMatches.map((match) => match.round_no)),
          ];
          expect(rounds, label).toHaveLength(plan.capacity.futureRounds);
          for (const roundNo of rounds) {
            const rows = plan.generatedMatches.filter(
              (match) => match.round_no === roundNo
            );
            const occupied = rows.flatMap(seatsOf);
            expect(occupied, `${label}, round ${roundNo}`).toHaveLength(
              roster.length
            );
            expect(
              new Set(occupied).size,
              `${label}, round ${roundNo}`
            ).toBe(roster.length);
            expect(
              rows.filter((match) => !match.is_bye),
              `${label}, round ${roundNo}`
            ).toHaveLength(plan.capacity.usableCourts);
          }
        }
      }
    }

    const mixedRosters = [
      { playerCount: 4, maleCount: 2 },
      { playerCount: 6, maleCount: 3 },
      { playerCount: 8, maleCount: 5 },
      { playerCount: 12, maleCount: 7 },
      { playerCount: 16, maleCount: 8 },
      { playerCount: 20, maleCount: 11 },
    ];
    for (const { playerCount, maleCount } of mixedRosters) {
      const roster = seats(playerCount);
      const genders = new Map<SeatId, string>(
        roster.map((seatId, index) => [
          seatId,
          index < maleCount ? "male" : "female",
        ])
      );
      for (const numCourts of requestedCourts) {
        for (const gamesPerPlayer of gameTargets) {
          const label = `mixed ${maleCount}m/${
            playerCount - maleCount
          }f/${numCourts}c/${gamesPerPlayer}g`;
          const plan = planScheduleAdjustment(
            input({
              seed: label,
              currentMatches: [],
              currentSeatIds: roster,
              nextSeatIds: roster,
              currentTotalRounds: 1,
              firstMutableRound: 1,
              numCourts,
              gamesPerPlayer,
              format: "mixed",
              genders,
            })
          );

          expect(plan.ok, label).toBe(true);
          expect(plan.fairness.playersBelowTarget, label).toBe(0);
          const rounds = [
            ...new Set(plan.generatedMatches.map((match) => match.round_no)),
          ];
          expect(rounds, label).toHaveLength(plan.capacity.futureRounds);
          for (const roundNo of rounds) {
            const rows = plan.generatedMatches.filter(
              (match) => match.round_no === roundNo
            );
            const occupied = rows.flatMap(seatsOf);
            expect(occupied, `${label}, round ${roundNo}`).toHaveLength(
              roster.length
            );
            expect(
              new Set(occupied).size,
              `${label}, round ${roundNo}`
            ).toBe(roster.length);
            const playableRows = rows.filter((match) => !match.is_bye);
            expect(playableRows, `${label}, round ${roundNo}`).toHaveLength(
              plan.capacity.usableCourts
            );
            for (const match of playableRows) {
              const matchGenders = seatsOf(match).map((seatId) =>
                genders.get(seatId)
              );
              expect(
                matchGenders.filter((gender) => gender === "male"),
                `${label}, round ${roundNo}`
              ).toHaveLength(2);
              expect(
                matchGenders.filter((gender) => gender === "female"),
                `${label}, round ${roundNo}`
              ).toHaveLength(2);
            }
          }
        }
      }
    }
  });

  it("is deterministic even when the caller's roster order changes", () => {
    const a = planScheduleAdjustment(input());
    const b = planScheduleAdjustment(
      input({
        currentSeatIds: [...seats(8)].reverse(),
        nextSeatIds: [...seats(8)].reverse(),
      })
    );
    expect(a.schedule).toEqual(b.schedule);
    expect(a.fairness).toEqual(b.fairness);
  });
});

describe("analyzeScheduleFairness", () => {
  it("reports game, rest, partner, and opponent implications", () => {
    const roster = seats(4);
    const repeated: CoreMatch[] = [1, 2, 3].map((roundNo) => ({
      round_no: roundNo,
      court_no: 1,
      a1: "p:A",
      a2: "p:B",
      b1: "p:C",
      b2: "p:D",
      is_bye: false,
    }));

    const fairness = analyzeScheduleFairness(repeated, roster, 3);
    expect(fairness.gameRange).toMatchObject({ min: 3, max: 3, spread: 0 });
    expect(fairness.restRange).toMatchObject({ min: 0, max: 0, spread: 0 });
    expect(fairness.partnerRepeatMax).toBe(3);
    expect(fairness.opponentRepeatMax).toBe(3);
    expect(
      fairness.perPlayer.find((player) => player.seatId === "p:A")
    ).toMatchObject({
      uniquePartners: 1,
      repeatedPartnerGames: 2,
      uniqueOpponents: 2,
      repeatedOpponentMeetings: 4,
    });
  });
});
