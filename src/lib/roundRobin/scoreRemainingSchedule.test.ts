import { describe, it, expect } from "vitest";
import {
  scoreRemainingSchedule,
  isHistoricallyLocked,
  isOperationallyProtected,
  isReoptimizable,
  computeFairness,
  type PlannerEventState,
  type PlannerParticipant,
  type PlannerScheduleRow,
  type SwapIdentityOp,
  type RewriteRoundOp,
  type PlanOp,
} from "./scoreRemainingSchedule";
import { seatsOf, type CoreMatch, type SeatId } from "./scheduleCore";

// --------------------------------------------------------------------------
// Fixture builders.
// --------------------------------------------------------------------------

let rowSeq = 0;
function row(
  roundNo: number,
  courtNo: number,
  seats: [SeatId | null, SeatId | null, SeatId | null, SeatId | null],
  extra: Partial<PlannerScheduleRow> = {},
): PlannerScheduleRow {
  return {
    id: `row-${roundNo}-${courtNo}-${rowSeq++}`,
    roundNo,
    courtNo,
    isBye: seats[1] === null && seats[2] === null && seats[3] === null,
    seats,
    ...extra,
  };
}

function participant(letter: string, status: PlannerParticipant["status"] = "active"): PlannerParticipant {
  return { id: `pp-${letter}`, seatId: `p:${letter}`, status };
}

function baseState(over: Partial<PlannerEventState>): PlannerEventState {
  return {
    eventId: "evt-1",
    currentRound: 1,
    numCourts: 1,
    gamesPerPlayer: 2,
    totalRounds: 3,
    format: "open",
    scheduleVersion: 1,
    participants: [],
    schedule: [],
    ...over,
  };
}

const swaps = (ops: PlanOp[]): SwapIdentityOp[] => ops.filter((o): o is SwapIdentityOp => o.op === "swap_identity");
const rewrites = (ops: PlanOp[]): RewriteRoundOp[] => ops.filter((o): o is RewriteRoundOp => o.op === "rewrite_round");

/** Apply the plan to a schedule to inspect the projected result. */
function applyPlan(state: PlannerEventState, ops: PlanOp[]): CoreMatch[] {
  const byId = new Map(
    state.schedule.map((r) => [
      r.id,
      { round_no: r.roundNo, court_no: r.courtNo, a1: r.seats[0], a2: r.seats[1], b1: r.seats[2], b2: r.seats[3], is_bye: r.isBye } as CoreMatch,
    ]),
  );
  for (const op of ops) {
    if (op.op === "swap_identity") {
      const m = byId.get(op.scheduleId)!;
      (["a1", "a2", "b1", "b2"] as const).forEach((s) => {
        if (m[s] === op.fromSeatId) m[s] = op.toSeatId;
      });
    }
  }
  const rewritten = new Set(rewrites(ops).map((o) => o.roundNo));
  const result = [...byId.values()].filter((m) => !rewritten.has(m.round_no));
  for (const rw of rewrites(ops)) {
    for (const m of rw.matches) {
      result.push({ round_no: rw.roundNo, court_no: m.courtNo, a1: m.seats[0], a2: m.seats[1], b1: m.seats[2], b2: m.seats[3], is_bye: m.isBye });
    }
  }
  return result;
}

function assertNoDoubleBooking(matches: CoreMatch[]) {
  const byRound = new Map<number, CoreMatch[]>();
  for (const m of matches) {
    if (!byRound.has(m.round_no)) byRound.set(m.round_no, []);
    byRound.get(m.round_no)!.push(m);
  }
  for (const [round, ms] of byRound) {
    const seen = new Set<SeatId>();
    for (const m of ms) {
      for (const s of seatsOf(m)) {
        expect(seen.has(s), `double-booked ${s} in round ${round}`).toBe(false);
        seen.add(s);
      }
      if (!m.is_bye) expect(new Set(seatsOf(m)).size).toBe(4);
    }
  }
}

// --------------------------------------------------------------------------
// Protection classification (plan.md §3).
// --------------------------------------------------------------------------

describe("protection classification", () => {
  it("treats past, scored, locked, voided, and superseded rows as historically locked", () => {
    const cur = 3;
    expect(isHistoricallyLocked(row(2, 1, ["p:A", "p:B", "p:C", "p:D"]), cur)).toBe(true); // past
    expect(isHistoricallyLocked(row(3, 1, ["p:A", "p:B", "p:C", "p:D"], { team1Score: 11, team2Score: 5 }), cur)).toBe(true);
    expect(isHistoricallyLocked(row(4, 1, ["p:A", "p:B", "p:C", "p:D"], { lockedAt: "t" }), cur)).toBe(true);
    expect(isHistoricallyLocked(row(4, 1, ["p:A", "p:B", "p:C", "p:D"], { voidedAt: "t" }), cur)).toBe(true);
    expect(isHistoricallyLocked(row(4, 1, ["p:A", "p:B", "p:C", "p:D"], { supersededByScheduleId: "x" }), cur)).toBe(true);
  });

  it("treats the active round and published/displayed rows as operationally protected", () => {
    const cur = 3;
    expect(isOperationallyProtected(row(3, 1, ["p:A", "p:B", "p:C", "p:D"]), cur)).toBe(true); // active round
    expect(isOperationallyProtected(row(4, 1, ["p:A", "p:B", "p:C", "p:D"], { publishedAt: "t" }), cur)).toBe(true);
    expect(isOperationallyProtected(row(4, 1, ["p:A", "p:B", "p:C", "p:D"], { kioskVisibleAt: "t" }), cur)).toBe(true);
  });

  it("treats later unlocked, unpublished rounds as reoptimizable", () => {
    const cur = 1;
    const r = row(3, 1, ["p:A", "p:B", "p:C", "p:D"]);
    expect(isReoptimizable(r, cur)).toBe(true);
    expect(isHistoricallyLocked(r, cur)).toBe(false);
    expect(isOperationallyProtected(r, cur)).toBe(false);
  });
});

// --------------------------------------------------------------------------
// Minimal local repair.
// --------------------------------------------------------------------------

describe("withdraw/injure/remove — minimal local repair", () => {
  function fiveByeState() {
    rowSeq = 0;
    return baseState({
      currentRound: 1,
      numCourts: 1,
      participants: ["A", "B", "C", "D", "E"].map((l) => participant(l)),
      totalRounds: 3,
      schedule: [
        row(2, 1, ["p:A", "p:B", "p:E", "p:C"]),
        row(2, 2, ["p:D", null, null, null]),
        row(3, 1, ["p:A", "p:E", "p:B", "p:D"]),
        row(3, 2, ["p:C", null, null, null]),
      ],
    });
  }

  it("pulls the idle bye player in and seats the outgoing player on the bye", () => {
    const state = fiveByeState();
    const plan = scoreRemainingSchedule(state, { action: "withdraw", participantId: "pp-E", regenMode: "minimal" });
    expect(plan.ok).toBe(true);
    expect(plan.planType).toBe("local_round_repair");
    expect(plan.modeApplied).toBe("minimal");
    expect(swaps(plan.ops).length).toBeGreaterThan(0);

    const projected = applyPlan(state, plan.ops);
    assertNoDoubleBooking(projected);
    // E no longer plays in any non-bye match.
    const ePlaying = projected.some((m) => !m.is_bye && seatsOf(m).includes("p:E"));
    expect(ePlaying).toBe(false);
  });

  it("reports minimal_regen_not_possible when no idle player exists (minimal mode)", () => {
    rowSeq = 0;
    const state = baseState({
      currentRound: 1,
      numCourts: 1,
      participants: ["A", "B", "C", "D"].map((l) => participant(l)),
      schedule: [row(2, 1, ["p:A", "p:B", "p:C", "p:D"])],
    });
    const plan = scoreRemainingSchedule(state, { action: "remove", participantId: "pp-A", regenMode: "minimal" });
    expect(plan.ok).toBe(false);
    expect(plan.code).toBe("minimal_regen_not_possible");
  });

  it("returns no_schedule_change when the player has no future matches", () => {
    rowSeq = 0;
    const state = baseState({
      currentRound: 1,
      numCourts: 1,
      participants: ["A", "B", "C", "D", "E"].map((l) => participant(l)),
      schedule: [
        row(2, 1, ["p:A", "p:B", "p:C", "p:D"]),
        row(2, 2, ["p:E", null, null, null]),
      ],
    });
    const plan = scoreRemainingSchedule(state, { action: "withdraw", participantId: "pp-E", regenMode: "minimal" });
    expect(plan.ok).toBe(true);
    expect(plan.planType).toBe("no_schedule_change");
    expect(plan.ops.length).toBe(0);
  });
});

// --------------------------------------------------------------------------
// Auto escalation / reoptimize.
// --------------------------------------------------------------------------

describe("auto & reoptimize", () => {
  function eightFullState() {
    rowSeq = 0;
    return baseState({
      eventId: "evt-8",
      currentRound: 1,
      numCourts: 2,
      gamesPerPlayer: 2,
      totalRounds: 3,
      participants: ["A", "B", "C", "D", "E", "F", "G", "H"].map((l) => participant(l)),
      schedule: [
        row(2, 1, ["p:A", "p:B", "p:C", "p:D"]),
        row(2, 2, ["p:E", "p:F", "p:G", "p:H"]),
        row(3, 1, ["p:A", "p:C", "p:B", "p:D"]),
        row(3, 2, ["p:E", "p:G", "p:F", "p:H"]),
      ],
    });
  }

  it("auto escalates to reoptimize when minimal is impossible", () => {
    const state = eightFullState();
    const plan = scoreRemainingSchedule(state, { action: "withdraw", participantId: "pp-A", regenMode: "auto" });
    expect(plan.ok).toBe(true);
    expect(plan.modeApplied).toBe("reoptimize");
    expect(plan.planType).toBe("reoptimize");
    expect(rewrites(plan.ops).length).toBeGreaterThan(0);

    const projected = applyPlan(state, plan.ops);
    assertNoDoubleBooking(projected);
    expect(projected.some((m) => !m.is_bye && seatsOf(m).includes("p:A"))).toBe(false);
  });

  it("explicit reoptimize rebuilds the reoptimizable rounds", () => {
    const state = eightFullState();
    const plan = scoreRemainingSchedule(state, { action: "withdraw", participantId: "pp-A", regenMode: "reoptimize" });
    expect(plan.ok).toBe(true);
    expect(plan.modeApplied).toBe("reoptimize");
    expect(plan.roundsTouched).toEqual([2, 3]);
  });

  it("auto prefers minimal when it is clean", () => {
    rowSeq = 0;
    const state = baseState({
      currentRound: 1,
      numCourts: 1,
      participants: ["A", "B", "C", "D", "E"].map((l) => participant(l)),
      schedule: [
        row(2, 1, ["p:A", "p:B", "p:E", "p:C"]),
        row(2, 2, ["p:D", null, null, null]),
        row(3, 1, ["p:A", "p:E", "p:B", "p:D"]),
        row(3, 2, ["p:C", null, null, null]),
      ],
    });
    const plan = scoreRemainingSchedule(state, { action: "withdraw", participantId: "pp-E", regenMode: "auto" });
    expect(plan.ok).toBe(true);
    expect(plan.modeApplied).toBe("minimal");
  });

  it("returns reoptimization_required when too few players remain", () => {
    rowSeq = 0;
    const state = baseState({
      currentRound: 1,
      numCourts: 1,
      participants: ["A", "B", "C", "D"].map((l) => participant(l)),
      schedule: [row(2, 1, ["p:A", "p:B", "p:C", "p:D"])],
    });
    const plan = scoreRemainingSchedule(state, { action: "withdraw", participantId: "pp-A", regenMode: "auto" });
    expect(plan.ok).toBe(false);
    expect(plan.code).toBe("reoptimization_required");
  });

  it("is deterministic across repeated calls", () => {
    const a = scoreRemainingSchedule(eightFullState(), { action: "withdraw", participantId: "pp-A", regenMode: "reoptimize" });
    const b = scoreRemainingSchedule(eightFullState(), { action: "withdraw", participantId: "pp-A", regenMode: "reoptimize" });
    expect(a).toEqual(b);
  });

  it("never rewrites a round that holds a scored match (repairs it locally instead)", () => {
    rowSeq = 0;
    // Round 2 is mixed: court 1 is already scored, court 2 is unplayed. It must
    // NOT be DELETE+rebuilt, or the scored match would be lost and its players
    // double-booked. Player I is on a bye and available for a local swap.
    const state = baseState({
      eventId: "evt-mixed",
      currentRound: 1,
      numCourts: 2,
      participants: ["A", "B", "C", "D", "E", "F", "G", "H", "I"].map((l) => participant(l)),
      schedule: [
        row(2, 1, ["p:A", "p:B", "p:C", "p:D"], { team1Score: 11, team2Score: 6 }),
        row(2, 2, ["p:E", "p:F", "p:G", "p:H"]),
        row(2, 3, ["p:I", null, null, null]),
      ],
    });
    const plan = scoreRemainingSchedule(state, { action: "withdraw", participantId: "pp-E", regenMode: "reoptimize" });
    expect(plan.ok).toBe(true);
    // No round was rewritten — round 2 is protected by its scored row.
    expect(rewrites(plan.ops).length).toBe(0);
    expect(swaps(plan.ops).length).toBeGreaterThan(0);

    const projected = applyPlan(state, plan.ops);
    assertNoDoubleBooking(projected);
    // The scored match is untouched.
    const scored = projected.find((m) => m.round_no === 2 && m.court_no === 1)!;
    expect(new Set(seatsOf(scored))).toEqual(new Set(["p:A", "p:B", "p:C", "p:D"]));
    // E was pulled out of the unplayed match.
    expect(projected.some((m) => !m.is_bye && seatsOf(m).includes("p:E"))).toBe(false);
  });
});

// --------------------------------------------------------------------------
// Replace.
// --------------------------------------------------------------------------

describe("replace", () => {
  function replaceState() {
    rowSeq = 0;
    return baseState({
      currentRound: 1,
      numCourts: 1,
      participants: [
        ...["A", "B", "C", "D", "E"].map((l) => participant(l)),
        participant("F"), // active alternate, not scheduled
      ],
      schedule: [
        row(2, 1, ["p:A", "p:B", "p:E", "p:C"]),
        row(2, 2, ["p:D", null, null, null]),
        row(3, 1, ["p:A", "p:E", "p:B", "p:D"]),
        row(3, 2, ["p:C", null, null, null]),
      ],
    });
  }

  it("swaps the outgoing identity for the substitute in every future row", () => {
    const state = replaceState();
    const plan = scoreRemainingSchedule(state, { action: "replace", participantId: "pp-E", substituteId: "pp-F" });
    expect(plan.ok).toBe(true);
    expect(plan.planType).toBe("replace_identity");
    const s = swaps(plan.ops);
    expect(s.length).toBe(2);
    expect(s.every((o) => o.fromSeatId === "p:E" && o.toSeatId === "p:F")).toBe(true);

    const projected = applyPlan(state, plan.ops);
    expect(projected.some((m) => !m.is_bye && seatsOf(m).includes("p:E"))).toBe(false);
    expect(projected.some((m) => !m.is_bye && seatsOf(m).includes("p:F"))).toBe(true);
  });

  it("requires a substitute", () => {
    const plan = scoreRemainingSchedule(replaceState(), { action: "replace", participantId: "pp-E" });
    expect(plan.ok).toBe(false);
    expect(plan.code).toBe("substitute_required");
  });

  it("rejects self-substitution", () => {
    const plan = scoreRemainingSchedule(replaceState(), { action: "replace", participantId: "pp-E", substituteId: "pp-E" });
    expect(plan.ok).toBe(false);
    expect(plan.code).toBe("substitute_invalid");
  });

  it("rejects an ineligible (inactive) substitute", () => {
    const state = replaceState();
    state.participants.push(participant("G", "withdrawn"));
    const plan = scoreRemainingSchedule(state, { action: "replace", participantId: "pp-E", substituteId: "pp-G" });
    expect(plan.ok).toBe(false);
    expect(plan.code).toBe("substitute_not_eligible");
  });

  it("rejects a substitute whose identity already participates", () => {
    const state = replaceState();
    // Second roster row that shares F's underlying seat identity.
    state.participants.push({ id: "pp-F2", seatId: "p:F", status: "active" });
    const plan = scoreRemainingSchedule(state, { action: "replace", participantId: "pp-E", substituteId: "pp-F" });
    expect(plan.ok).toBe(false);
    expect(plan.code).toBe("duplicate_participant_identity");
  });
});

// --------------------------------------------------------------------------
// Restore (plan.md §2 / §8).
// --------------------------------------------------------------------------

describe("restore", () => {
  it("re-folds the player into reoptimizable future rounds", () => {
    rowSeq = 0;
    const state = baseState({
      currentRound: 1,
      numCourts: 1,
      participants: [
        ...["A", "B", "C", "D"].map((l) => participant(l)),
        participant("E", "withdrawn"),
      ],
      schedule: [
        row(2, 1, ["p:A", "p:B", "p:C", "p:D"]),
        row(3, 1, ["p:A", "p:C", "p:B", "p:D"]),
      ],
    });
    const plan = scoreRemainingSchedule(state, { action: "restore", participantId: "pp-E", regenMode: "auto" });
    expect(plan.ok).toBe(true);
    expect(plan.planType).toBe("reoptimize");
    const projected = applyPlan(state, plan.ops);
    assertNoDoubleBooking(projected);
    expect(projected.some((m) => seatsOf(m).includes("p:E"))).toBe(true);
  });

  it("returns no_future_rounds when there is nothing left to schedule", () => {
    rowSeq = 0;
    const state = baseState({
      currentRound: 3,
      numCourts: 1,
      participants: [
        ...["A", "B", "C", "D"].map((l) => participant(l)),
        participant("E", "withdrawn"),
      ],
      schedule: [
        row(1, 1, ["p:A", "p:B", "p:C", "p:D"], { team1Score: 11, team2Score: 4 }),
        row(2, 1, ["p:A", "p:C", "p:B", "p:D"], { team1Score: 11, team2Score: 7 }),
      ],
    });
    const plan = scoreRemainingSchedule(state, { action: "restore", participantId: "pp-E" });
    expect(plan.ok).toBe(true);
    expect(plan.planType).toBe("restore_identity");
    expect(plan.reason).toBe("no_future_rounds");
    expect(plan.ops.length).toBe(0);
  });

  it("rejects restore of an already-active participant", () => {
    rowSeq = 0;
    const state = baseState({ participants: [participant("A")] });
    const plan = scoreRemainingSchedule(state, { action: "restore", participantId: "pp-A" });
    expect(plan.ok).toBe(false);
    expect(plan.code).toBe("invalid_state_transition");
  });

  it("rejects restore from a terminal state", () => {
    rowSeq = 0;
    const state = baseState({ participants: [participant("A", "removed")] });
    const plan = scoreRemainingSchedule(state, { action: "restore", participantId: "pp-A" });
    expect(plan.ok).toBe(false);
    expect(plan.code).toBe("invalid_state_transition");
    expect(plan.reason).toBe("terminal_state");
  });
});

// --------------------------------------------------------------------------
// Input & state-machine validation.
// --------------------------------------------------------------------------

describe("validation", () => {
  it("rejects an unknown action", () => {
    rowSeq = 0;
    const state = baseState({ participants: [participant("A")] });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const plan = scoreRemainingSchedule(state, { action: "bogus" as any, participantId: "pp-A" });
    expect(plan.ok).toBe(false);
    expect(plan.code).toBe("invalid_action");
  });

  it("rejects an unknown participant", () => {
    rowSeq = 0;
    const state = baseState({ participants: [participant("A")] });
    const plan = scoreRemainingSchedule(state, { action: "withdraw", participantId: "pp-Z" });
    expect(plan.ok).toBe(false);
    expect(plan.code).toBe("participant_not_found");
  });

  it("rejects mutating a non-active participant", () => {
    rowSeq = 0;
    const state = baseState({ participants: [participant("A", "withdrawn")] });
    const plan = scoreRemainingSchedule(state, { action: "withdraw", participantId: "pp-A" });
    expect(plan.ok).toBe(false);
    expect(plan.code).toBe("invalid_state_transition");
  });
});

// --------------------------------------------------------------------------
// Fairness evaluator.
// --------------------------------------------------------------------------

describe("computeFairness", () => {
  it("measures game/bye spread and partner repeats", () => {
    const roster: SeatId[] = ["p:A", "p:B", "p:C", "p:D"];
    const matches: CoreMatch[] = [
      { round_no: 1, court_no: 1, a1: "p:A", a2: "p:B", b1: "p:C", b2: "p:D", is_bye: false },
      { round_no: 2, court_no: 1, a1: "p:A", a2: "p:B", b1: "p:C", b2: "p:D", is_bye: false },
    ];
    const f = computeFairness({ matches, seats: roster });
    expect(f.projectedGameSpread).toBe(0);
    expect(f.projectedByeSpread).toBe(0);
    expect(f.partnerRepeatMax).toBe(2); // A-B partnered twice
  });
});
