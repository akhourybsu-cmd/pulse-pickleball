/**
 * Slice 3 — pure fairness-planner tests. NO database, NO env: these execute
 * for real in Node and must stay green independently of the (still-unverified)
 * Slice 2a integration suite. Determinism + structural invariants are the
 * backbone; the DB is never consulted.
 */
import { describe, it, expect } from "vitest";
import {
  scoreRemainingSchedule,
  assertValidSchedule,
  computeFairnessMetrics,
  type RemainingScheduleState,
  type ParticipantChangeRequest,
} from "@/lib/rr/participantPlanner";
import {
  generateRoundRobinSchedule,
  type ScheduleMatch,
} from "@/lib/roundRobinScheduler";

const P = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);

function buildState(
  players: string[],
  numCourts: number,
  numRounds: number,
  currentRound: number,
  overrides: Partial<RemainingScheduleState> = {},
): RemainingScheduleState {
  const schedule = generateRoundRobinSchedule({
    eventId: "evt-fixed-seed",
    playerIds: players,
    numCourts,
    numRounds,
  });
  return {
    eventId: "evt-fixed-seed",
    numCourts,
    numRounds,
    currentRound,
    activePlayerIds: players,
    schedule,
    ...overrides,
  };
}

const futureMatches = (s: RemainingScheduleState) =>
  s.schedule.filter((m) => m.round_no >= s.currentRound && !m.is_bye);

const seatedFuturePlayer = (s: RemainingScheduleState): string =>
  futureMatches(s)[0].a1_player_id!;

const lockedPart = (s: RemainingScheduleState) =>
  s.schedule.filter((m) => m.round_no < s.currentRound);

describe("scoreRemainingSchedule — invariants + determinism", () => {
  it("is deterministic: identical input → byte-identical output", () => {
    const state = buildState(P(6), 1, 4, 2);
    const req: ParticipantChangeRequest = {
      action: "withdraw",
      participantId: seatedFuturePlayer(state),
      regenMode: "reoptimize",
    };
    const a = scoreRemainingSchedule(state, req);
    const b = scoreRemainingSchedule(state, req);
    expect(a).toEqual(b);
    expect(a.planHashInput).toEqual(b.planHashInput);
  });

  it("every ok plan yields a structurally valid schedule", () => {
    const scenarios: Array<[RemainingScheduleState, ParticipantChangeRequest]> = [
      [buildState(P(6), 1, 4, 2), { action: "withdraw", participantId: "p1", regenMode: "auto" }],
      [buildState(P(8), 2, 5, 3), { action: "remove", participantId: "p3", regenMode: "reoptimize" }],
      [buildState(P(7), 1, 4, 2), { action: "injure", participantId: "p2", regenMode: "auto" }],
    ];
    for (const [state, req] of scenarios) {
      const plan = scoreRemainingSchedule(state, req);
      if (plan.ok) expect(() => assertValidSchedule(plan.proposedSchedule)).not.toThrow();
    }
  });

  it("preserves locked/historical rounds verbatim on reoptimize", () => {
    const state = buildState(P(6), 1, 4, 3); // rounds 1-2 locked
    const before = lockedPart(state);
    const plan = scoreRemainingSchedule(state, {
      action: "withdraw",
      participantId: seatedFuturePlayer(state),
      regenMode: "reoptimize",
    });
    expect(plan.ok).toBe(true);
    const after = plan.proposedSchedule.filter((m) => m.round_no < state.currentRound);
    expect(after).toEqual(before);
  });

  it("never seats a removed player in any future round", () => {
    const state = buildState(P(8), 2, 5, 2);
    const victim = seatedFuturePlayer(state);
    const plan = scoreRemainingSchedule(state, {
      action: "remove",
      participantId: victim,
      regenMode: "reoptimize",
    });
    expect(plan.ok).toBe(true);
    const futureSeats = plan.proposedSchedule
      .filter((m) => m.round_no >= state.currentRound)
      .flatMap((m) => [m.a1_player_id, m.a2_player_id, m.b1_player_id, m.b2_player_id]);
    expect(futureSeats).not.toContain(victim);
  });
});

describe("replace → identity swap", () => {
  it("classifies replace_identity and swaps the substitute into remaining seats", () => {
    const state = buildState(P(6), 1, 4, 2);
    const victim = seatedFuturePlayer(state);
    const plan = scoreRemainingSchedule(state, {
      action: "replace",
      participantId: victim,
      substituteId: "sub-X",
      regenMode: "auto",
    });
    expect(plan.ok).toBe(true);
    expect(plan.planType).toBe("replace_identity");
    expect(plan.matchesChanged).toBeGreaterThan(0);
    const futureSeats = plan.proposedSchedule
      .filter((m) => m.round_no >= state.currentRound)
      .flatMap((m) => [m.a1_player_id, m.a2_player_id, m.b1_player_id, m.b2_player_id]);
    expect(futureSeats).toContain("sub-X");
    expect(futureSeats).not.toContain(victim);
  });

  it("rejects self-substitution and missing substitute", () => {
    const state = buildState(P(6), 1, 4, 2);
    expect(scoreRemainingSchedule(state, { action: "replace", participantId: "p1", substituteId: "p1", regenMode: "auto" }).ok).toBe(false);
    expect(scoreRemainingSchedule(state, { action: "replace", participantId: "p1", regenMode: "auto" }).ok).toBe(false);
  });
});

describe("withdraw / injure / remove — local repair vs escalation", () => {
  it("back-fills a vacated seat from a resting player (local_round_repair)", () => {
    // 6 players / 1 court → 2 byes per round, so a resting player exists.
    const state = buildState(P(6), 1, 4, 2);
    const victim = seatedFuturePlayer(state);
    const plan = scoreRemainingSchedule(state, { action: "withdraw", participantId: victim, regenMode: "minimal" });
    expect(plan.ok).toBe(true);
    expect(plan.planType).toBe("local_round_repair");
    expect(() => assertValidSchedule(plan.proposedSchedule)).not.toThrow();
  });

  it("minimal returns minimal_regen_not_possible when no resting player can back-fill", () => {
    // Exactly 4 players / 1 court → 0 byes. Removing one breaks the match.
    const state = buildState(P(4), 1, 3, 2);
    const victim = seatedFuturePlayer(state);
    const plan = scoreRemainingSchedule(state, { action: "withdraw", participantId: victim, regenMode: "minimal" });
    expect(plan.ok).toBe(false);
    expect(plan.code).toBe("minimal_regen_not_possible");
  });

  it("reoptimize with fewer than 4 remaining players → insufficient_players", () => {
    const state = buildState(P(4), 1, 3, 2);
    const plan = scoreRemainingSchedule(state, { action: "remove", participantId: "p1", regenMode: "reoptimize" });
    expect(plan.ok).toBe(false);
    expect(plan.code).toBe("insufficient_players");
  });

  it("auto escalates to full_reoptimize when local repair is impossible and roster still supports play", () => {
    // 8 players / 2 courts → 0 byes (all 8 seated). Removing one leaves 7 active,
    // which can't be locally repaired (no resting sub) but 7 >= 4 so reoptimize runs.
    const state = buildState(P(8), 2, 4, 2);
    const victim = seatedFuturePlayer(state);
    const plan = scoreRemainingSchedule(state, { action: "withdraw", participantId: victim, regenMode: "auto" });
    expect(plan.ok).toBe(true);
    expect(plan.planType).toBe("full_reoptimize");
  });

  it("no future rounds → no_schedule_change", () => {
    const state = buildState(P(6), 1, 3, 4); // currentRound past the last round
    const plan = scoreRemainingSchedule(state, { action: "withdraw", participantId: "p1", regenMode: "auto" });
    expect(plan.ok).toBe(true);
    expect(plan.planType).toBe("no_schedule_change");
    expect(plan.matchesChanged).toBe(0);
  });
});

describe("restore", () => {
  it("no future rounds → restore_identity no-op", () => {
    const state = buildState(P(6), 1, 3, 4);
    const plan = scoreRemainingSchedule(state, { action: "restore", participantId: "pX", regenMode: "auto" });
    expect(plan.ok).toBe(true);
    expect(plan.planType).toBe("restore_identity");
    expect(plan.matchesChanged).toBe(0);
  });

  it("minimal restore into remaining rounds → minimal_regen_not_possible", () => {
    const state = buildState(P(6), 1, 4, 2);
    const plan = scoreRemainingSchedule(state, { action: "restore", participantId: "pX", regenMode: "minimal" });
    expect(plan.ok).toBe(false);
    expect(plan.code).toBe("minimal_regen_not_possible");
  });

  it("reoptimize restore reintroduces the player into future rounds", () => {
    const base = buildState(P(6), 1, 4, 2);
    // Simulate a previously-withdrawn player 'pR' being restored: active set adds pR.
    const state: RemainingScheduleState = { ...base, activePlayerIds: P(6) };
    const plan = scoreRemainingSchedule(state, { action: "restore", participantId: "pR", regenMode: "reoptimize" });
    expect(plan.ok).toBe(true);
    expect(plan.planType).toBe("restore_identity");
    const futureSeats = plan.proposedSchedule
      .filter((m) => m.round_no >= state.currentRound)
      .flatMap((m) => [m.a1_player_id, m.a2_player_id, m.b1_player_id, m.b2_player_id, m.is_bye ? m.a1_player_id : null]);
    expect(futureSeats).toContain("pR");
  });
});

describe("player-count parity, courts, and unavoidable limits", () => {
  it("odd→even: 7 players, remove one → valid 6-player remainder", () => {
    const state = buildState(P(7), 1, 4, 2);
    const plan = scoreRemainingSchedule(state, { action: "remove", participantId: seatedFuturePlayer(state), regenMode: "reoptimize" });
    expect(plan.ok).toBe(true);
    expect(() => assertValidSchedule(plan.proposedSchedule)).not.toThrow();
  });

  it("more courts than possible matches never creates a 3-player match", () => {
    // 5 players, 3 courts → at most 1 match/round; the rest are byes.
    const state = buildState(P(5), 3, 4, 1);
    expect(() => assertValidSchedule(state.schedule)).not.toThrow();
    const plan = scoreRemainingSchedule(state, { action: "replace", participantId: "p1", substituteId: "sub", regenMode: "auto" });
    expect(plan.ok).toBe(true);
    expect(() => assertValidSchedule(plan.proposedSchedule)).not.toThrow();
  });

  it("emits a limitation when reoptimization touches a protected round", () => {
    const state = buildState(P(8), 2, 5, 2, { protectedRounds: [3] });
    const plan = scoreRemainingSchedule(state, { action: "remove", participantId: seatedFuturePlayer(state), regenMode: "reoptimize" });
    expect(plan.ok).toBe(true);
    expect(plan.limitations.some((l) => l.includes("protected round"))).toBe(true);
  });

  it("reports fairness metrics + triggers", () => {
    const state = buildState(P(6), 1, 4, 2);
    const plan = scoreRemainingSchedule(state, { action: "withdraw", participantId: seatedFuturePlayer(state), regenMode: "reoptimize" });
    expect(plan.ok).toBe(true);
    expect(plan.fairnessMetrics).toHaveProperty("gameCountSpread");
    expect(Array.isArray(plan.fairnessTriggers)).toBe(true);
  });
});

describe("computeFairnessMetrics / assertValidSchedule (unit)", () => {
  it("flags a 3-player playable match as invalid", () => {
    const bad: ScheduleMatch[] = [
      { round_no: 1, court_no: 1, a1_player_id: "a", a2_player_id: "b", b1_player_id: "c", b2_player_id: null, is_bye: false },
    ];
    expect(() => assertValidSchedule(bad)).toThrow();
  });

  it("flags a player appearing on two courts in one round", () => {
    const bad: ScheduleMatch[] = [
      { round_no: 1, court_no: 1, a1_player_id: "a", a2_player_id: "b", b1_player_id: "c", b2_player_id: "d", is_bye: false },
      { round_no: 1, court_no: 2, a1_player_id: "a", a2_player_id: "e", b1_player_id: "f", b2_player_id: "g", is_bye: false },
    ];
    expect(() => assertValidSchedule(bad)).toThrow();
  });

  it("computes zero spread for a balanced single round", () => {
    const sched: ScheduleMatch[] = [
      { round_no: 1, court_no: 1, a1_player_id: "a", a2_player_id: "b", b1_player_id: "c", b2_player_id: "d", is_bye: false },
    ];
    const m = computeFairnessMetrics(sched, ["a", "b", "c", "d"]);
    expect(m.gameCountSpread).toBe(0);
  });
});
