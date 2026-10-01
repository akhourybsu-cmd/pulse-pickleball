import { describe, expect, it } from "vitest";
import { planScheduleAdjustment } from "./scheduleAdjustment";
import { seatsOf, type CoreMatch } from "./scheduleCore";

const roster = (n: number) => Array.from({ length: n }, (_, i) => `p:${i}`);
function plan(n: number, courts: number, games: number, seed = "equal", history: CoreMatch[] = []) {
  return planScheduleAdjustment({ seed, currentMatches: history, currentSeatIds: roster(n), nextSeatIds: roster(n),
    currentTotalRounds: 0, firstMutableRound: history.length ? 2 : 1,
    numCourts: courts, gamesPerPlayer: games, equalGames: true });
}
function assertExact(result: ReturnType<typeof plan>, players: number, courts: number) {
  expect(result.ok, JSON.stringify(result.warnings)).toBe(true);
  expect(result.fairness.gameRange.spread).toBe(0);
  expect(result.fairness.playersAtTarget).toBe(players);
  expect(result.fairness.playersAboveTarget).toBe(0);
  expect(result.fairness.playersBelowTarget).toBe(0);
  expect(result.fairness.duplicateSeatAssignments).toBe(0);
  expect(result.fairness.unaccountedSeatRounds).toBe(0);
  for (const round of new Set(result.generatedMatches.map(m => m.round_no))) {
    const rows = result.generatedMatches.filter(m => m.round_no === round);
    const games = rows.filter(m => !m.is_bye);
    expect(games.length).toBeGreaterThan(0);
    expect(games.length).toBeLessThanOrEqual(courts);
    expect(new Set(games.map(m => m.court_no)).size).toBe(games.length);
    expect(rows.flatMap(seatsOf).sort()).toEqual(roster(players).sort());
    expect(games.every(m => seatsOf(m).length === 4)).toBe(true);
  }
}

describe("equal-game round robins", () => {
  it.each([2, 4, 6, 8, 10])("gives all 18 players exactly %i games on four courts", games => {
    for (let seed = 0; seed < 6; seed++) {
      const result = plan(18, 4, games, `example-${seed}`);
      assertExact(result, 18, 4);
      expect(result.fairness.gameRange.min).toBe(games);
      if (games <= 6) expect(result.fairness.partnerRepeatMax).toBe(1);
      expect(result.generatedMatches.filter(m => !m.is_bye)).toHaveLength(18 * games / 4);
    }
  });

  it("uses variable rest counts instead of overshooting a four-game target", () => {
    const result = plan(18, 4, 4);
    expect(result.capacity.recommendedTotalRounds).toBe(5);
    const rests = Array.from({ length: 5 }, (_, i) => result.schedule.filter(m => m.round_no === i + 1 && m.is_bye).length);
    expect(new Set(rests).size).toBeGreaterThan(1);
    expect(rests.reduce((a, b) => a + b, 0)).toBe(18);
  });

  it("clearly raises impossible targets uniformly, without allocating individual extras", () => {
    const result = plan(18, 4, 5);
    assertExact(result, 18, 4);
    expect(result.capacity.gamesPerPlayerTarget).toBe(6);
    expect(result.warnings.some(w => w.code === "equal_target_adjusted")).toBe(true);
    expect(plan(17, 4, 5).capacity.gamesPerPlayerTarget).toBe(8);
  });

  it("preserves completed results and catches up players who rested", () => {
    const history = plan(18, 4, 4).schedule.filter(m => m.round_no === 1);
    const result = plan(18, 3, 4, "rebuild", history);
    assertExact(result, 18, 3);
    expect(result.preservedMatches).toEqual(history);
  });

  it("uses actual games, never virtual late-arrival credits", () => {
    const seats = roster(8);
    const result = planScheduleAdjustment({ seed: "credits", currentMatches: [], currentSeatIds: seats,
      nextSeatIds: seats, currentTotalRounds: 0, firstMutableRound: 1, numCourts: 2,
      gamesPerPlayer: 4, equalGames: true, existingGameCredits: new Map([[seats[0], 3]]) });
    assertExact(result, 8, 2);
    expect(result.fairness.perPlayer.every(p => p.games === 4 && p.gameCredit === 0)).toBe(true);
  });

  it.each([[9, 9, true], [5, 5, true], [5, 3, false]])("handles mixed rosters %i/%i honestly", (men, women, ok) => {
    const seats = roster(Number(men) + Number(women));
    const result = planScheduleAdjustment({ seed: "mixed-equal", currentMatches: [], currentSeatIds: seats,
      nextSeatIds: seats, currentTotalRounds: 0, firstMutableRound: 1, numCourts: 4,
      gamesPerPlayer: 3, equalGames: true, format: "mixed",
      genders: new Map(seats.map((id, i) => [id, i < Number(men) ? "male" : "female"])) });
    expect(result.ok).toBe(ok);
    if (ok) {
      assertExact(result, seats.length, 4);
      for (const match of result.generatedMatches.filter(m => !m.is_bye)) {
        for (const team of [[match.a1, match.a2], [match.b1, match.b2]]) {
          expect(team.filter(id => seats.indexOf(id!) < Number(men))).toHaveLength(1);
        }
      }
    } else expect(result.code).toBe("equal_games_unavailable");
  });

  it("is deterministic across a matrix of awkward player and court counts", () => {
    for (const n of [4, 5, 6, 7, 9, 10, 13, 17, 18, 19, 22, 25, 33, 48, 81]) {
      for (const courts of [1, 2, 4, 7]) {
        for (const games of [1, 3, 4, 7, 12, 20]) assertExact(plan(n, courts, games), n, courts);
      }
    }
    expect(plan(18, 4, 6).schedule).toEqual(plan(18, 4, 6).schedule);
  }, 60_000);
});
