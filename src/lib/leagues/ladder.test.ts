import { describe, it, expect } from "vitest";
import {
  groupIntoFours,
  batchMatchups,
  gamesPerPlayer,
  isBatchComplete,
  rankGroup,
  applyMovement,
  computeBatchOutcome,
  detectTieBreaks,
  validateLadderTransition,
  LadderError,
  type LadderGameResult,
} from "./ladder";

/** Set scores on a batch's matchups by index (0,1,2). */
function score(
  matchups: LadderGameResult[],
  scores: Array<[number, number]>,
): LadderGameResult[] {
  return matchups.map((m, i) => ({ ...m, scoreA: scores[i][0], scoreB: scores[i][1] }));
}

describe("groupIntoFours", () => {
  it("divides 8/12/16/20 players into groups of four in order", () => {
    for (const n of [8, 12, 16, 20]) {
      const order = Array.from({ length: n }, (_, i) => `p${i + 1}`);
      const groups = groupIntoFours(order);
      expect(groups).toHaveLength(n / 4);
      expect(groups.every((g) => g.length === 4)).toBe(true);
      // groups stay in ladder order
      expect(groups.flat()).toEqual(order);
      expect(groups[0]).toEqual(["p1", "p2", "p3", "p4"]);
    }
  });

  it("rejects counts not divisible by four", () => {
    expect(() => groupIntoFours(["a", "b"])).toThrow(LadderError);
    expect(() => groupIntoFours(["a", "b", "c", "d", "e"])).toThrow(/divisible by four/);
    expect(() => groupIntoFours([])).toThrow(LadderError);
  });

  it("rejects duplicate players", () => {
    expect(() => groupIntoFours(["a", "b", "c", "a"])).toThrow(/duplicate/);
  });
});

describe("batchMatchups — the three-game rotation", () => {
  const group = ["A", "B", "C", "D"];
  const games = batchMatchups(group);

  it("produces exactly three games", () => {
    expect(games).toHaveLength(3);
  });

  it("has every player play all three games", () => {
    for (const p of group) {
      const played = games.filter(
        (g) => [...g.sideA, ...g.sideB].includes(p),
      ).length;
      expect(played).toBe(3);
    }
  });

  it("pairs every player with each other player exactly once", () => {
    const partnerCount = new Map<string, number>();
    for (const g of games) {
      for (const side of [g.sideA, g.sideB]) {
        const key = [...side].sort().join("|");
        partnerCount.set(key, (partnerCount.get(key) ?? 0) + 1);
      }
    }
    // 6 unique pairs, each exactly once
    expect(partnerCount.size).toBe(6);
    expect([...partnerCount.values()].every((c) => c === 1)).toBe(true);
  });

  it("opposes every player against each other exactly twice", () => {
    const opp = new Map<string, number>();
    for (const g of games) {
      for (const a of g.sideA) for (const b of g.sideB) {
        const key = [a, b].sort().join("|");
        opp.set(key, (opp.get(key) ?? 0) + 1);
      }
    }
    expect(opp.size).toBe(6);
    expect([...opp.values()].every((c) => c === 2)).toBe(true);
  });

  it("throws for non-4 groups", () => {
    expect(() => batchMatchups(["A", "B", "C"])).toThrow(LadderError);
  });
});

describe("gamesPerPlayer", () => {
  it("is 3 per batch", () => {
    expect(gamesPerPlayer(1)).toBe(3);
    expect(gamesPerPlayer(2)).toBe(6);
    expect(gamesPerPlayer(3)).toBe(9);
  });
});

describe("isBatchComplete", () => {
  const m = batchMatchups(["A", "B", "C", "D"]);
  it("false while any game is unscored or tied", () => {
    expect(isBatchComplete(m)).toBe(false);
    expect(isBatchComplete(score(m, [[11, 9], [11, 9], [5, 5]]))).toBe(false);
  });
  it("true when all games have a valid non-tied score", () => {
    expect(isBatchComplete(score(m, [[11, 9], [9, 11], [11, 3]]))).toBe(true);
  });
});

describe("rankGroup", () => {
  it("ranks a clear 3-1-1-1 group: sweeper first, rest by starting position", () => {
    // p3 wins all three; p1,p2,p4 each win once (structurally forced) and,
    // with symmetric 11-9 scores, tie on differential → start position breaks it.
    const group = ["p1", "p2", "p3", "p4"];
    const m = batchMatchups(group);
    // g1 [p1,p2] vs [p3,p4] -> p3,p4 win ; g2 [p1,p3] vs [p2,p4] -> p1,p3 win
    // g3 [p1,p4] vs [p2,p3] -> p2,p3 win
    const games = score(m, [[9, 11], [11, 9], [9, 11]]);
    const ranked = rankGroup(group, games);
    expect(ranked.map((r) => r.playerId)).toEqual(["p3", "p1", "p2", "p4"]);
    expect(ranked.map((r) => r.finishPosition)).toEqual([1, 2, 3, 4]);
    expect(ranked.find((r) => r.playerId === "p3")!.wins).toBe(3);
  });

  it("breaks a win tie by point differential", () => {
    const group = ["p1", "p2", "p3", "p4"];
    const m = batchMatchups(group);
    // Make p1 and p3 both 2-1 but p1 with a bigger differential.
    // g1 [p1,p2] vs [p3,p4]: p1,p2 win 11-2
    // g2 [p1,p3] vs [p2,p4]: p1,p3 win 11-9
    // g3 [p1,p4] vs [p2,p3]: p2,p3 win 11-9
    const games = score(m, [[11, 2], [11, 9], [9, 11]]);
    const ranked = rankGroup(group, games);
    // p1: W(11-2),W(11-9),L(9-11) = 2W diff +11 ; p3: L,W,W = 2W diff smaller
    expect(ranked[0].playerId).toBe("p1");
    const p1 = ranked.find((r) => r.playerId === "p1")!;
    const p3 = ranked.find((r) => r.playerId === "p3")!;
    expect(p1.wins).toBe(2);
    expect(p3.wins).toBe(2);
    expect(p1.finishPosition).toBeLessThan(p3.finishPosition);
  });

  it("is deterministic for identical inputs", () => {
    const group = ["a", "b", "c", "d"];
    const games = score(batchMatchups(group), [[11, 9], [11, 8], [7, 11]]);
    expect(rankGroup(group, games)).toEqual(rankGroup(group, games));
  });
});

describe("applyMovement — one-up/one-down crossover", () => {
  it("matches the spec's two-group example exactly", () => {
    // Court 1 finish: Chris, Alex, Dana, Brooke
    // Court 2 finish: Hannah, Evan, George, Fran
    const groups = [
      ["Chris", "Alex", "Dana", "Brooke"],
      ["Hannah", "Evan", "George", "Fran"],
    ];
    const { order, movements } = applyMovement(groups);
    expect(order).toEqual([
      "Chris", "Alex", "Dana", "Hannah",
      "Brooke", "Evan", "George", "Fran",
    ]);
    // Winner of top group can't go higher; loser of bottom group can't go lower.
    expect(movements["Chris"]).toEqual({ playerId: "Chris", direction: "stay", capped: "top" });
    expect(movements["Fran"]).toEqual({ playerId: "Fran", direction: "stay", capped: "bottom" });
    // Bottom-group winner moves up; top-group loser moves down.
    expect(movements["Hannah"].direction).toBe("up");
    expect(movements["Brooke"].direction).toBe("down");
    // Middle finishers stay.
    expect(movements["Alex"].direction).toBe("stay");
    expect(movements["Evan"].direction).toBe("stay");
  });

  it("single group: everyone stays, order = finishing order, caps at both ends", () => {
    const { order, movements } = applyMovement([["w", "x", "y", "z"]]);
    expect(order).toEqual(["w", "x", "y", "z"]);
    expect(movements["w"]).toEqual({ playerId: "w", direction: "stay", capped: "top" });
    expect(movements["z"]).toEqual({ playerId: "z", direction: "stay", capped: "bottom" });
    expect(movements["x"].direction).toBe("stay");
  });

  it("preserves all players across four groups (invariants)", () => {
    const groups = [
      ["p1", "p2", "p3", "p4"],
      ["p5", "p6", "p7", "p8"],
      ["p9", "p10", "p11", "p12"],
      ["p13", "p14", "p15", "p16"],
    ];
    const before = groups.flat();
    const { order } = applyMovement(groups);
    expect(order).toHaveLength(before.length);
    expect(new Set(order).size).toBe(before.length);
    expect(new Set(order)).toEqual(new Set(before));
    // middle crossover: p4 (G1 4th) descends, p5 (G2 1st) ascends
    expect(order).toEqual([
      "p1", "p2", "p3", "p5",
      "p4", "p6", "p7", "p9",
      "p8", "p10", "p11", "p13",
      "p12", "p14", "p15", "p16",
    ]);
  });
});

describe("computeBatchOutcome — end to end", () => {
  it("ranks two groups and produces the crossed next ladder", () => {
    const order = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"];
    // Each group: sweeper wins all, others 1-1-1 → start-position order.
    const g1 = score(batchMatchups(["p1", "p2", "p3", "p4"]), [[9, 11], [11, 9], [9, 11]]);
    const g2 = score(batchMatchups(["p5", "p6", "p7", "p8"]), [[9, 11], [11, 9], [9, 11]]);
    const out = computeBatchOutcome(order, [g1, g2]);
    // group1 finish p3,p1,p2,p4 ; group2 finish p7,p5,p6,p8
    // movement: p4 down, p7 up
    expect(out.nextOrder).toEqual(["p3", "p1", "p2", "p7", "p4", "p5", "p6", "p8"]);
    expect(out.rankedByGroup).toHaveLength(2);
    expect(out.movements["p7"].direction).toBe("up");
    expect(out.movements["p4"].direction).toBe("down");
    // idempotent / deterministic
    expect(computeBatchOutcome(order, [g1, g2]).nextOrder).toEqual(out.nextOrder);
  });

  it("keeps the same players and count (invariant) after a batch", () => {
    const order = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"];
    const g1 = score(batchMatchups(["p1", "p2", "p3", "p4"]), [[11, 9], [11, 9], [11, 9]]);
    const g2 = score(batchMatchups(["p5", "p6", "p7", "p8"]), [[11, 9], [11, 9], [11, 9]]);
    const out = computeBatchOutcome(order, [g1, g2]);
    expect(validateLadderTransition(order, out.nextOrder)).toEqual([]);
    expect(new Set(out.nextOrder)).toEqual(new Set(order));
  });

  it("throws when results don't cover every group", () => {
    const order = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"];
    const g1 = score(batchMatchups(["p1", "p2", "p3", "p4"]), [[11, 9], [11, 9], [11, 9]]);
    expect(() => computeBatchOutcome(order, [g1])).toThrow(LadderError);
  });
});

describe("detectTieBreaks + organizer resolution", () => {
  // 8 players, two groups. Group 0 is a clean 1-2-3-4. Group 1 (the bottom
  // group) has p5 and p6 dead-even for 1st — a genuine promotion tie that
  // scores alone can't settle.
  const order = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"];
  const gamesByGroup: LadderGameResult[][] = [
    score(batchMatchups(["p1", "p2", "p3", "p4"]), [[11, 3], [11, 4], [11, 5]]),
    // p5 & p6 both finish 2-1 with identical +6 diff and 31 points; p7 is 2-1
    // but -2; p8 is 0-3. So {p5,p6} tie for the single promotion slot.
    score(batchMatchups(["p5", "p6", "p7", "p8"]), [[11, 5], [11, 9], [9, 11]]),
  ];

  it("flags the promotion tie in the bottom group and nothing else", () => {
    const needs = detectTieBreaks(order, gamesByGroup);
    expect(needs).toHaveLength(1);
    expect(needs[0].groupIndex).toBe(1);
    expect(needs[0].boundaries).toEqual(["promotion"]);
    expect([...needs[0].tiedPlayerIds].sort()).toEqual(["p5", "p6"]);
  });

  it("returns [] when every group is decided by score", () => {
    const clean: LadderGameResult[][] = [
      score(batchMatchups(["p1", "p2", "p3", "p4"]), [[11, 3], [11, 4], [11, 5]]),
      score(batchMatchups(["p5", "p6", "p7", "p8"]), [[11, 3], [11, 4], [11, 5]]),
    ];
    expect(detectTieBreaks(order, clean)).toEqual([]);
  });

  it("falls back to start position when no resolution is given", () => {
    const outcome = computeBatchOutcome(order, gamesByGroup);
    // p5 starts above p6, so with no organizer input p5 takes 1st and is promoted.
    expect(outcome.rankedByGroup[1][0].playerId).toBe("p5");
    expect(outcome.movements["p5"].direction).toBe("up");
    expect(outcome.movements["p6"].direction).toBe("stay");
  });

  it("honors an organizer resolution (skinny-singles winner advances)", () => {
    // Organizer says p6 won the tiebreaker → p6 finishes 1st and is promoted.
    const outcome = computeBatchOutcome(order, gamesByGroup, { 1: ["p6", "p5"] });
    expect(outcome.rankedByGroup[1][0].playerId).toBe("p6");
    expect(outcome.movements["p6"].direction).toBe("up");
    expect(outcome.movements["p5"].direction).toBe("stay");
  });

  it("a resolution can't move a player past someone they out-scored", () => {
    // p7 is behind p5/p6 on the tiebreak key; naming it first must NOT promote it.
    const outcome = computeBatchOutcome(order, gamesByGroup, { 1: ["p7", "p6", "p5"] });
    expect(outcome.rankedByGroup[1][0].playerId).toBe("p6"); // p7 stays 3rd
    expect(outcome.rankedByGroup[1][2].playerId).toBe("p7");
  });
});

describe("validateLadderTransition", () => {
  it("passes for a clean permutation", () => {
    expect(validateLadderTransition(["a", "b", "c"], ["c", "a", "b"])).toEqual([]);
  });
  it("flags dropped, appeared, duplicated, and count changes", () => {
    expect(validateLadderTransition(["a", "b"], ["a"]).length).toBeGreaterThan(0);
    expect(validateLadderTransition(["a", "b"], ["a", "a"]).some((p) => /duplicate/.test(p))).toBe(true);
    expect(validateLadderTransition(["a", "b"], ["a", "c"]).some((p) => /dropped/.test(p))).toBe(true);
  });
});
