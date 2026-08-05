import { describe, it, expect } from "vitest";
import { DEFAULT_PARAMS, type RatingParams } from "./params";
import { eloDelta, replayRatings, type MatchInput, type PlayerInit } from "./engine";
import { buildFocalHistory, trueLevelScript, runComparison, formatComparison, FOCAL } from "./sim";

const P = (o: Partial<RatingParams> = {}): RatingParams => ({ ...DEFAULT_PARAMS, ...o });
const ON = (o: Partial<RatingParams> = {}) => P({ placementEnabled: true, ...o });
const OFF = (o: Partial<RatingParams> = {}) => P({ placementEnabled: false, ...o });

// A single doubles match with explicit participants.
function oneMatch(
  team1: [string, string],
  team2: [string, string],
  s1: number,
  s2: number,
): MatchInput {
  return {
    id: "m1", date: "2026-01-01", createdAt: "2026-01-01T00:00:00Z",
    type: "casual", team1, team2, team1Score: s1, team2Score: s2,
  };
}
const focalRows = (res: ReturnType<typeof replayRatings>) =>
  res.rows.filter((r) => r.playerId === FOCAL).sort((a, b) => a.matchIndexForPlayer - b.matchIndexForPlayer);

describe("PULSE engine — steady-state parity", () => {
  it("matches the hand-computed ELO delta (FAQ formula)", () => {
    // Two 3.0 teams, casual, established, win 11–9.
    // E = 0.5; K = 0.0275; MoV = 1 + 2/11; Δ = K·MoV·(1−0.5).
    const d = eloDelta({
      teamAvg: 3.0, oppAvg: 3.0, myScore: 11, oppScore: 9, won: true,
      type: "casual", provisionalBonus: false, kMult: 1, p: DEFAULT_PARAMS,
    });
    expect(d).toBeCloseTo(0.0275 * (1 + 2 / 11) * 0.5, 6);
  });

  it("placementEnabled:false leaves a new player on the ELO path (provisional bonus)", () => {
    const players: PlayerInit[] = [
      { id: FOCAL, selfRating: 3.0 },
      { id: "p", seedRating: 3.0, seedCount: 20 },
      { id: "o1", seedRating: 3.0, seedCount: 20 },
      { id: "o2", seedRating: 3.0, seedCount: 20 },
    ];
    const res = replayRatings([oneMatch([FOCAL, "p"], ["o1", "o2"], 11, 9)], players, OFF());
    const row = focalRows(res)[0];
    expect(row.isPlacementObs).toBe(false);
    expect(row.state).toBe("provisional");
    expect(row.ratingAfter).toBeGreaterThan(3.0);
  });
});

describe("PULSE engine — placement lifecycle", () => {
  it("completes placement on the 5th match and sets materialized outputs", () => {
    const { players, matches } = buildFocalHistory(3.0, trueLevelScript(4.0, 3.7, 3.7).slice(0, 6));
    const res = replayRatings(matches, players, ON());
    const rows = focalRows(res);
    // Matches 1–5 are placement observations; 6 is provisional ELO.
    expect(rows.slice(0, 5).every((r) => r.isPlacementObs)).toBe(true);
    expect(rows[0].state).toBe("placing");
    expect(rows[4].state).toBe("placing");
    expect(rows[5].isPlacementObs).toBe(false);
    expect(rows[5].state).toBe("provisional");
    const out = res.players[FOCAL];
    expect(out.placedRating).not.toBeNull();
    expect(out.placedAt).toBe(matches[4].date); // the 5th match's date
    expect(out.placementModelVersion).toBe(DEFAULT_PARAMS.placementModelVersion);
    // rating_after of match 5 IS the placed rating (no extra ELO update).
    expect(rows[4].ratingAfter).toBeCloseTo(out.placedRating!, 9);
  });

  it("underrated player converges faster under placement than current ELO", () => {
    const { players, matches } = buildFocalHistory(3.0, trueLevelScript(4.0, 3.7, 3.7));
    const cur = replayRatings(matches, players, OFF());
    const plc = replayRatings(matches, players, ON());
    const at = (res: ReturnType<typeof replayRatings>, i: number) =>
      focalRows(res).find((r) => r.matchIndexForPlayer === i)!.ratingAfter;
    // By match 5 placement should be materially higher (closer to true 4.0).
    expect(at(plc, 5)).toBeGreaterThan(at(cur, 5) + 0.2);
    expect(at(plc, 5)).toBeGreaterThan(3.4);
  });

  it("overrated player drops faster under placement than current ELO", () => {
    const { players, matches } = buildFocalHistory(4.0, trueLevelScript(3.0, 3.3, 3.3));
    const cur = replayRatings(matches, players, OFF());
    const plc = replayRatings(matches, players, ON());
    const at = (res: ReturnType<typeof replayRatings>, i: number) =>
      focalRows(res).find((r) => r.matchIndexForPlayer === i)!.ratingAfter;
    expect(at(plc, 5)).toBeLessThan(at(cur, 5) - 0.2);
    expect(at(plc, 5)).toBeLessThan(3.7);
  });
});

describe("PULSE engine — safeguards", () => {
  it("protects an established player facing a placing opponent (reduced K)", () => {
    const players: PlayerInit[] = [
      { id: "E", seedRating: 4.0, seedCount: 20 },
      { id: "Ep", seedRating: 4.0, seedCount: 20 },
      { id: FOCAL, selfRating: 3.0 }, // placing when enabled
      { id: "Fp", selfRating: 3.0 },  // placing when enabled
    ];
    const match = oneMatch(["E", "Ep"], [FOCAL, "Fp"], 11, 6);
    const eDelta = (p: RatingParams) =>
      replayRatings([match], players, p).rows.find((r) => r.playerId === "E")!.delta;
    // Same pre-match ratings in both, so only kMult differs → exact ratio.
    const withProt = eDelta(ON());
    const noProt = eDelta(OFF());
    expect(Math.abs(withProt)).toBeLessThan(Math.abs(noProt));
    expect(withProt / noProt).toBeCloseTo(DEFAULT_PARAMS.placingOpponentEloMultiplier, 6);
  });

  it("weights evidence by opponent reliability (established > placing)", () => {
    const script = Array.from({ length: 5 }, () => ({
      partner: 3.5, opp1: 3.5, opp2: 3.5, fScore: 11, oScore: 4,
    }));
    // A: opponents established. B: opponents placing (same ratings, weaker evidence).
    const A = buildFocalHistory(3.0, script);
    const B = buildFocalHistory(3.0, script);
    // Downgrade B's anchors to placing (seedCount 0) at the same rating.
    for (const pl of B.players) if (pl.id !== FOCAL) { pl.seedCount = 0; pl.selfRating = 3.5; delete pl.seedRating; }
    const placedA = replayRatings(A.matches, A.players, ON()).players[FOCAL].placedRating!;
    const placedB = replayRatings(B.matches, B.players, ON()).players[FOCAL].placedRating!;
    // Both above the 3.0 prior (they won), but strong evidence (A) moves further.
    expect(placedA).toBeGreaterThan(placedB);
    expect(placedB).toBeGreaterThan(3.0);
  });

  it("routes each participant independently in a mixed-state match", () => {
    const players: PlayerInit[] = [
      { id: FOCAL, selfRating: 3.0 },              // placing
      { id: "prov", seedRating: 3.5, seedCount: 6 }, // provisional
      { id: "est", seedRating: 3.8, seedCount: 20 }, // established
      { id: "plc", selfRating: 3.2 },               // placing
    ];
    // team1 = [FOCAL(placing), prov(provisional)] vs team2 = [est, plc(placing)]
    const res = replayRatings([oneMatch([FOCAL, "prov"], ["est", "plc"], 11, 7)], players, ON());
    const byId = (id: string) => res.rows.find((r) => r.playerId === id)!;
    expect(byId(FOCAL).isPlacementObs).toBe(true);
    expect(byId("plc").isPlacementObs).toBe(true);
    expect(byId("prov").isPlacementObs).toBe(false); // ELO
    expect(byId("est").isPlacementObs).toBe(false); // ELO
    // est faces a placing opponent (FOCAL) → protected (delta smaller than unprotected).
    const unprot = replayRatings([oneMatch([FOCAL, "prov"], ["est", "plc"], 11, 7)], players, ON({ placingOpponentEloMultiplier: 1 }));
    expect(Math.abs(byId("est").delta)).toBeLessThan(Math.abs(unprot.rows.find((r) => r.playerId === "est")!.delta));
  });
});

describe("PULSE engine — determinism & replay integrity", () => {
  it("is idempotent (same history → identical rows)", () => {
    const { players, matches } = buildFocalHistory(3.0, trueLevelScript(4.0, 3.7, 3.7));
    const a = replayRatings(matches, players, ON());
    const b = replayRatings([...matches].reverse(), players, ON()); // order-independent via internal sort
    expect(JSON.stringify(a.rows)).toBe(JSON.stringify(b.rows));
  });

  it("deleting the 5th match returns the player to placement (outputs clear)", () => {
    const { players, matches } = buildFocalHistory(3.0, trueLevelScript(4.0, 3.7, 3.7).slice(0, 5));
    const full = replayRatings(matches, players, ON());
    expect(full.players[FOCAL].placedRating).not.toBeNull();
    const minusLast = replayRatings(matches.slice(0, 4), players, ON());
    expect(minusLast.players[FOCAL].placedRating).toBeNull();
    expect(minusLast.players[FOCAL].count).toBe(4);
  });

  it("backdating an earlier match shifts which match completes placement", () => {
    const { players, matches } = buildFocalHistory(3.0, trueLevelScript(4.0, 3.7, 3.7).slice(0, 5));
    const base = replayRatings(matches, players, ON());
    // Insert an even earlier match (new anchors) before all others.
    const players2: PlayerInit[] = [
      ...players,
      { id: "bp", seedRating: 3.5, seedCount: 20 },
      { id: "bo1", seedRating: 3.5, seedCount: 20 },
      { id: "bo2", seedRating: 3.5, seedCount: 20 },
    ];
    const earlier: MatchInput = {
      id: "m00", date: "2025-12-31", createdAt: "2025-12-31T00:00:00Z",
      type: "casual", team1: [FOCAL, "bp"], team2: ["bo1", "bo2"], team1Score: 11, team2Score: 5,
    };
    const shifted = replayRatings([...matches, earlier], players2, ON());
    // Placement now completes on what used to be the 4th match's date.
    expect(shifted.players[FOCAL].placedAt).not.toBe(base.players[FOCAL].placedAt);
    expect(shifted.players[FOCAL].placedAt).toBe(matches[3].date);
  });

  it("never violates the 2.0–4.5 clamp (ceiling and floor)", () => {
    const ceil = buildFocalHistory(3.0, Array.from({ length: 15 }, () => ({ partner: 4.5, opp1: 4.5, opp2: 4.5, fScore: 11, oScore: 0 })));
    const floor = buildFocalHistory(4.5, Array.from({ length: 15 }, () => ({ partner: 2.0, opp1: 2.0, opp2: 2.0, fScore: 0, oScore: 11 })));
    for (const res of [replayRatings(ceil.matches, ceil.players, ON()), replayRatings(floor.matches, floor.players, ON())]) {
      for (const row of res.rows) {
        expect(row.ratingAfter).toBeGreaterThanOrEqual(2.0);
        expect(row.ratingAfter).toBeLessThanOrEqual(4.5);
      }
    }
  });
});

describe("PULSE engine — current vs placement comparison", () => {
  it("prints the trajectory comparison (M1/M3/M5/M8/M15)", () => {
    const rows = runComparison();
    console.log("\n=== Current engine vs Placement engine — focal rating after N matches ===\n" + formatComparison(rows));
    // Placement resolves a badly-mis-rated player by M5; current ELO still hasn't.
    const under = rows.find((r) => r.name.includes("Underrated"))!;
    expect(under.placedRating).toBeGreaterThan(under.current[5]! + 0.2);
    expect(rows.every((r) => r.placedRating != null)).toBe(true);
  });
});
