/**
 * Slice 3 — pure TypeScript fairness planner for participant changes.
 *
 *   scoreRemainingSchedule(state, requestedChange): ParticipantChangePlan
 *
 * STRICTLY PURE: no DB, no network, no React/UI, no global mutable state, and
 * no Date/Math.random (determinism comes from the seeded engine keyed on
 * eventId). Identical input → identical output.
 *
 * Division of authority (see .lovable/plan_slice_2a_amendments.md #4): this
 * planner decides which schedule is *preferable*; the database RPC remains the
 * sole authority on whether a mutation is *safe to commit*. Nothing here is
 * trusted by the DB without server-side revalidation + plan-hash check.
 *
 * It reuses the existing deterministic engine (roundRobinScheduler /
 * roundRobinFairness) rather than duplicating pairing logic:
 *   - locked/historical rounds are passed through verbatim as `completedMatches`
 *   - only eligible future rounds are recomputed
 *   - player stats are initialised from completed history so a reoptimize never
 *     erases past imbalance by rewriting the past.
 */

import {
  generateRoundRobinSchedule,
  type ScheduleMatch,
} from "@/lib/roundRobinScheduler";
import { initializePlayerStats } from "@/lib/roundRobinFairness";

export type PlannerAction = "withdraw" | "injure" | "remove" | "replace" | "restore";
export type RegenMode = "minimal" | "reoptimize" | "auto";

export type PlanType =
  | "no_schedule_change"
  | "local_round_repair"
  | "replace_identity"
  | "restore_identity"
  | "full_reoptimize";

export interface RemainingScheduleState {
  eventId: string;
  numCourts: number;
  numRounds: number;
  /** First not-yet-played round. Rounds < this are historical (locked). */
  currentRound: number;
  /** Active participant ids BEFORE applying the requested change. */
  activePlayerIds: string[];
  /** Full schedule including completed rounds. Seat ids are player ids. */
  schedule: ScheduleMatch[];
  /** Rounds whose matches must never change (played/scored). Defaults to all < currentRound. */
  lockedRounds?: number[];
  /** Published / operationally protected rounds — change only if unavoidable. */
  protectedRounds?: number[];
  format?: "open" | "mixed" | "male" | "female";
  /** Serializable (plain object, not Map) so the input stays hashable/pure. */
  playerGenders?: Record<string, string>;
}

export interface ParticipantChangeRequest {
  action: PlannerAction;
  participantId: string;
  substituteId?: string | null;
  regenMode: RegenMode;
}

export interface FairnessMetrics {
  /** max−min games played among active players across the full proposed schedule. */
  gameCountSpread: number;
  /** max−min byes among active players. */
  byeCountSpread: number;
  /** count of partner pairs that occur more than once. */
  repeatedPartnerPairs: number;
  /** count of opponent pairs that occur more than once. */
  repeatedOpponentPairs: number;
  /** worst run of consecutive byes for any player. */
  maxConsecutiveByes: number;
}

export interface ParticipantChangePlan {
  ok: boolean;
  /** Set when ok=false: 'reoptimization_required' | 'minimal_regen_not_possible' | 'insufficient_players' | 'invalid_request'. */
  code?: string;
  planType: PlanType;
  /** First round the change affects. */
  effectiveRound: number;
  /** Complete proposed schedule (history preserved verbatim). Empty when ok=false. */
  proposedSchedule: ScheduleMatch[];
  roundsTouched: number[];
  matchesChanged: number;
  fairnessMetrics: FairnessMetrics;
  fairnessTriggers: string[];
  reason: string;
  /** Explicit statements of unavoidable imperfection. */
  limitations: string[];
  /** Canonical string a caller hashes to bind the plan to this exact input. */
  planHashInput: string;
}

const MIN_DOUBLES = 4;

/* ------------------------------- helpers -------------------------------- */

function seatIds(m: ScheduleMatch): (string | null)[] {
  return [m.a1_player_id, m.a2_player_id, m.b1_player_id, m.b2_player_id];
}

function playableSeatIds(m: ScheduleMatch): string[] {
  return seatIds(m).filter((x): x is string => x !== null);
}

function matchHasPlayer(m: ScheduleMatch, pid: string): boolean {
  return !m.is_bye && seatIds(m).includes(pid);
}

/** Deterministic key-sorted stringify for the plan hash input. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

function sortSchedule(s: ScheduleMatch[]): ScheduleMatch[] {
  return [...s].sort((a, b) =>
    a.round_no !== b.round_no
      ? a.round_no - b.round_no
      : a.court_no - b.court_no,
  );
}

/**
 * Structural validity of a proposed schedule. Throws on any violation so a
 * malformed plan can never escape the planner. Exported for tests.
 */
export function assertValidSchedule(schedule: ScheduleMatch[]): void {
  const byRound = new Map<number, ScheduleMatch[]>();
  for (const m of schedule) {
    if (!byRound.has(m.round_no)) byRound.set(m.round_no, []);
    byRound.get(m.round_no)!.push(m);
  }
  for (const [round, matches] of byRound) {
    const seen = new Set<string>();
    const activeSlots = new Set<string>(); // `${court}` for non-bye
    for (const m of matches) {
      if (m.is_bye) {
        const p = m.a1_player_id;
        if (!p) throw new Error(`round ${round}: bye row with no player`);
        if (seen.has(p)) throw new Error(`round ${round}: player ${p} appears twice`);
        seen.add(p);
        continue;
      }
      const ids = playableSeatIds(m);
      if (ids.length !== MIN_DOUBLES) {
        throw new Error(`round ${round} court ${m.court_no}: playable match must have exactly 4 players, got ${ids.length}`);
      }
      if (new Set(ids).size !== MIN_DOUBLES) {
        throw new Error(`round ${round} court ${m.court_no}: duplicate player within a match`);
      }
      const slot = `${m.court_no}`;
      if (activeSlots.has(slot)) throw new Error(`round ${round}: duplicate active court ${m.court_no}`);
      activeSlots.add(slot);
      for (const id of ids) {
        if (seen.has(id)) throw new Error(`round ${round}: player ${id} on two courts`);
        seen.add(id);
      }
    }
  }
}

/** Fairness metrics across the full proposed schedule for the given roster. */
export function computeFairnessMetrics(
  schedule: ScheduleMatch[],
  activeIds: string[],
): FairnessMetrics {
  const stats = initializePlayerStats(activeIds, schedule);
  const games = activeIds.map((id) => stats.get(id)!.gamesPlayed);
  const byes = activeIds.map((id) => stats.get(id)!.byesReceived);
  const spread = (xs: number[]) => (xs.length ? Math.max(...xs) - Math.min(...xs) : 0);

  let repeatedPartnerPairs = 0;
  let repeatedOpponentPairs = 0;
  for (const id of activeIds) {
    const st = stats.get(id)!;
    for (const [, c] of st.partnerCounts) if (c > 1) repeatedPartnerPairs++;
    for (const [, c] of st.opponentCounts) if (c > 1) repeatedOpponentPairs++;
  }
  // Each pair counted from both sides → halve.
  repeatedPartnerPairs = Math.floor(repeatedPartnerPairs / 2);
  repeatedOpponentPairs = Math.floor(repeatedOpponentPairs / 2);

  // Consecutive byes per player across rounds present in the schedule.
  const rounds = Array.from(new Set(schedule.map((m) => m.round_no))).sort((a, b) => a - b);
  const byeInRound = new Map<string, Set<number>>();
  for (const m of schedule) {
    if (m.is_bye && m.a1_player_id) {
      if (!byeInRound.has(m.a1_player_id)) byeInRound.set(m.a1_player_id, new Set());
      byeInRound.get(m.a1_player_id)!.add(m.round_no);
    }
  }
  let maxConsecutiveByes = 0;
  for (const id of activeIds) {
    const set = byeInRound.get(id) ?? new Set<number>();
    let run = 0;
    for (const r of rounds) {
      run = set.has(r) ? run + 1 : 0;
      if (run > maxConsecutiveByes) maxConsecutiveByes = run;
    }
  }

  return {
    gameCountSpread: spread(games),
    byeCountSpread: spread(byes),
    repeatedPartnerPairs,
    repeatedOpponentPairs,
    maxConsecutiveByes,
  };
}

function triggersFromMetrics(m: FairnessMetrics): string[] {
  const t: string[] = [];
  if (m.gameCountSpread > 1) t.push("projected_game_spread_exceeds_one");
  if (m.byeCountSpread > 1) t.push("bye_count_imbalance");
  if (m.maxConsecutiveByes > 1) t.push("consecutive_byes");
  if (m.repeatedPartnerPairs > 0) t.push("repeated_partners");
  if (m.repeatedOpponentPairs > 0) t.push("repeated_opponents");
  return t;
}

/* --------------------------------- core --------------------------------- */

export function scoreRemainingSchedule(
  state: RemainingScheduleState,
  change: ParticipantChangeRequest,
): ParticipantChangePlan {
  const effectiveRound = state.currentRound;
  const lockedRounds = new Set(
    state.lockedRounds ??
      state.schedule.filter((m) => m.round_no < effectiveRound).map((m) => m.round_no),
  );
  const isLocked = (r: number) => r < effectiveRound || lockedRounds.has(r);

  const locked = sortSchedule(state.schedule.filter((m) => isLocked(m.round_no)));
  const future = sortSchedule(state.schedule.filter((m) => !isLocked(m.round_no)));
  const futureRoundNos = Array.from(new Set(future.map((m) => m.round_no))).sort((a, b) => a - b);

  const baseHashInput = stableStringify({ state, change });
  const fail = (code: string, reason: string): ParticipantChangePlan => ({
    ok: false,
    code,
    planType: "no_schedule_change",
    effectiveRound,
    proposedSchedule: [],
    roundsTouched: [],
    matchesChanged: 0,
    fairnessMetrics: computeFairnessMetrics(state.schedule, state.activePlayerIds),
    fairnessTriggers: [],
    reason,
    limitations: [],
    planHashInput: baseHashInput,
  });

  const finish = (
    planType: PlanType,
    proposed: ScheduleMatch[],
    activeAfter: string[],
    roundsTouched: number[],
    matchesChanged: number,
    reason: string,
    limitations: string[] = [],
  ): ParticipantChangePlan => {
    const sorted = sortSchedule(proposed);
    assertValidSchedule(sorted);
    const metrics = computeFairnessMetrics(sorted, activeAfter);
    return {
      ok: true,
      planType,
      effectiveRound,
      proposedSchedule: sorted,
      roundsTouched: [...new Set(roundsTouched)].sort((a, b) => a - b),
      matchesChanged,
      fairnessMetrics: metrics,
      fairnessTriggers: triggersFromMetrics(metrics),
      reason,
      limitations,
      planHashInput: stableStringify({ input: baseHashInput, planType, proposed: sorted }),
    };
  };

  if (!["withdraw", "injure", "remove", "replace", "restore"].includes(change.action)) {
    return fail("invalid_request", `unknown action ${change.action}`);
  }
  if (!["minimal", "reoptimize", "auto"].includes(change.regenMode)) {
    return fail("invalid_request", `unknown regen mode ${change.regenMode}`);
  }

  /* ---- REPLACE: pure identity swap in future, non-locked rounds ---- */
  if (change.action === "replace") {
    if (!change.substituteId) return fail("invalid_request", "replace requires substituteId");
    if (change.substituteId === change.participantId)
      return fail("invalid_request", "self substitution");

    let matchesChanged = 0;
    const touched: number[] = [];
    const swap = (id: string | null) =>
      id === change.participantId ? change.substituteId! : id;
    const proposedFuture = future.map((m) => {
      if (!matchHasPlayer(m, change.participantId) && m.a1_player_id !== change.participantId) return m;
      touched.push(m.round_no);
      matchesChanged++;
      return {
        ...m,
        a1_player_id: swap(m.a1_player_id),
        a2_player_id: swap(m.a2_player_id),
        b1_player_id: swap(m.b1_player_id),
        b2_player_id: swap(m.b2_player_id),
      };
    });
    const activeAfter = state.activePlayerIds
      .filter((id) => id !== change.participantId)
      .concat(change.substituteId);
    if (matchesChanged === 0) {
      return finish("no_schedule_change", [...locked, ...proposedFuture], activeAfter, [], 0,
        "substitute has no remaining seats to fill; no future schedule change");
    }
    return finish("replace_identity", [...locked, ...proposedFuture], activeAfter, touched, matchesChanged,
      "identity swap in remaining rounds; schedule structure unchanged");
  }

  /* ---- RESTORE ---- */
  if (change.action === "restore") {
    if (futureRoundNos.length === 0) {
      return finish("restore_identity", [...locked], state.activePlayerIds.concat(change.participantId), [], 0,
        "no future rounds remain; restore records status only");
    }
    // Reintroducing a player changes seat counts → needs reoptimization of the
    // future. Only reoptimize/auto may do that in this planner.
    if (change.regenMode === "minimal") {
      return fail("minimal_regen_not_possible", "restore into remaining rounds requires reoptimization");
    }
    const activeAfter = [...state.activePlayerIds];
    if (!activeAfter.includes(change.participantId)) activeAfter.push(change.participantId);
    return reoptimizeFuture(state, activeAfter, effectiveRound, locked, futureRoundNos, finish, fail,
      "restore_identity", "restored player reintroduced; remaining rounds reoptimized (history preserved)");
  }

  /* ---- WITHDRAW / INJURE / REMOVE ---- */
  const activeAfter = state.activePlayerIds.filter((id) => id !== change.participantId);
  if (futureRoundNos.length === 0) {
    return finish("no_schedule_change", [...locked], activeAfter, [], 0,
      "no future rounds remain; participant status change only");
  }

  // Attempt LOCAL repair: for each future round the player is seated in, back-fill
  // the vacated seat from a player resting (on bye) that round.
  const localResult = tryLocalRepair(future, change.participantId, activeAfter);

  if (change.regenMode === "minimal") {
    if (!localResult.ok) return fail("minimal_regen_not_possible", localResult.reason);
    return finish("local_round_repair", [...locked, ...localResult.matches], activeAfter,
      localResult.roundsTouched, localResult.matchesChanged,
      "vacated seats back-filled from resting players; other rounds untouched");
  }

  if (change.regenMode === "auto" && localResult.ok) {
    const proposed = [...locked, ...localResult.matches];
    const metrics = computeFairnessMetrics(sortSchedule(proposed), activeAfter);
    // Guardrail: accept local repair only if it keeps game/bye spread within one.
    if (metrics.gameCountSpread <= 1 && metrics.byeCountSpread <= 1) {
      return finish("local_round_repair", proposed, activeAfter,
        localResult.roundsTouched, localResult.matchesChanged,
        "auto: valid local repair within fairness guardrails");
    }
    // else fall through to reoptimize
  }

  // reoptimize (explicit) or auto-escalation.
  if (activeAfter.length < MIN_DOUBLES) {
    return fail("insufficient_players", `only ${activeAfter.length} active players remain; cannot form a doubles match`);
  }
  return reoptimizeFuture(state, activeAfter, effectiveRound, locked, futureRoundNos, finish, fail,
    "full_reoptimize", "remaining rounds reoptimized for the reduced roster (history preserved)");
}

/* ---- local repair ---- */

interface LocalRepair {
  ok: boolean;
  reason: string;
  matches: ScheduleMatch[];
  roundsTouched: number[];
  matchesChanged: number;
}

function tryLocalRepair(
  future: ScheduleMatch[],
  removedId: string,
  activeAfter: string[],
): LocalRepair {
  const activeSet = new Set(activeAfter);
  const roundsTouched: number[] = [];
  let matchesChanged = 0;
  const out: ScheduleMatch[] = [];

  const byRound = new Map<number, ScheduleMatch[]>();
  for (const m of future) {
    if (!byRound.has(m.round_no)) byRound.set(m.round_no, []);
    byRound.get(m.round_no)!.push(m);
  }

  for (const [round, matches] of byRound) {
    const seatedMatch = matches.find((m) => matchHasPlayer(m, removedId));
    const removedByeRow = matches.find((m) => m.is_bye && m.a1_player_id === removedId);

    if (!seatedMatch) {
      // Player not playing this round. Drop their bye row (now inactive); keep rest.
      for (const m of matches) {
        if (m.is_bye && m.a1_player_id === removedId) {
          matchesChanged++;
          roundsTouched.push(round);
          continue; // drop
        }
        out.push(m);
      }
      continue;
    }

    // Find a resting player (on a bye this round) still active to back-fill.
    const byeCandidate = matches.find(
      (m) => m.is_bye && m.a1_player_id && m.a1_player_id !== removedId && activeSet.has(m.a1_player_id),
    );
    if (!byeCandidate || !byeCandidate.a1_player_id) {
      return {
        ok: false,
        reason: `round ${round}: no resting player to back-fill ${removedId}'s seat; a local repair would create a 3-player match`,
        matches: [],
        roundsTouched: [],
        matchesChanged: 0,
      };
    }
    const sub = byeCandidate.a1_player_id;
    roundsTouched.push(round);
    for (const m of matches) {
      if (m === byeCandidate) {
        matchesChanged++;
        continue; // resting player now plays → drop their bye row
      }
      if (m === seatedMatch) {
        matchesChanged++;
        const rep = (id: string | null) => (id === removedId ? sub : id);
        out.push({
          ...m,
          a1_player_id: rep(m.a1_player_id),
          a2_player_id: rep(m.a2_player_id),
          b1_player_id: rep(m.b1_player_id),
          b2_player_id: rep(m.b2_player_id),
        });
        continue;
      }
      if (m.is_bye && m.a1_player_id === removedId) {
        matchesChanged++;
        continue; // (shouldn't happen: seated AND bye) — drop defensively
      }
      out.push(m);
    }
    void removedByeRow;
  }

  return { ok: true, reason: "local repair valid", matches: out, roundsTouched, matchesChanged };
}

/* ---- reoptimize via the existing deterministic engine ---- */

function reoptimizeFuture(
  state: RemainingScheduleState,
  activeAfter: string[],
  effectiveRound: number,
  locked: ScheduleMatch[],
  futureRoundNos: number[],
  finish: (
    planType: PlanType, proposed: ScheduleMatch[], activeAfter: string[],
    roundsTouched: number[], matchesChanged: number, reason: string, limitations?: string[],
  ) => ParticipantChangePlan,
  fail: (code: string, reason: string) => ParticipantChangePlan,
  planType: PlanType,
  reason: string,
): ParticipantChangePlan {
  if (activeAfter.length < MIN_DOUBLES) {
    return fail("insufficient_players", `only ${activeAfter.length} active players remain`);
  }
  const limitations: string[] = [];
  const protectedTouched = (state.protectedRounds ?? []).filter((r) => r >= effectiveRound);
  if (protectedTouched.length) {
    limitations.push(`reoptimization changed protected round(s): ${protectedTouched.sort((a, b) => a - b).join(", ")}`);
  }

  const regenerated = generateRoundRobinSchedule({
    eventId: state.eventId,
    playerIds: activeAfter,
    numCourts: state.numCourts,
    numRounds: state.numRounds,
    completedMatches: locked,
    startFromRound: effectiveRound,
    format: state.format ?? "open",
    playerGenders: new Map(Object.entries(state.playerGenders ?? {})),
  });

  return finish(planType, regenerated, activeAfter, futureRoundNos, regenerated.length - locked.length,
    reason, limitations);
}
