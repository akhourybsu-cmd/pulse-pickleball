/**
 * Golden fixture — the validation oracle for the SQL placement port.
 *
 * A tiny, fully-specified match history whose expected per-match results come
 * from the tested TS engine with the LOCKED production constants. The go-live
 * runbook recreates this exact fixture in staging, enables placement, runs
 * recalculate_all_ratings(), and diffs match_participants.rating_after against
 * these numbers. If the SQL port matches, it's safe to enable in production.
 */

import { DEFAULT_PARAMS, type RatingParams } from "./params";
import { type MatchInput, type PlayerInit, replayRatings } from "./engine";

/** Locked production constants (robust set; see tuning sweep). */
export const LOCKED_PARAMS: RatingParams = {
  ...DEFAULT_PARAMS,
  placementEnabled: true,
  placementMatches: 5,
  provisionalMatches: 8,
  placementPriorWeight: 1.0,
  placementTeamResultConstant: 0.2,
  placingOpponentEloMultiplier: 0.35,
  reliabilityPlacing: 0.5,
  reliabilityProvisional: 0.75,
  reliabilityEstablished: 1.0,
  placementModelVersion: 1,
};

export const GOLDEN_FOCAL = "F";

/** Focal player self-rated 3.00; established anchors at fixed ratings. */
export function goldenPlayers(): PlayerInit[] {
  return [
    { id: GOLDEN_FOCAL, selfRating: 3.0 },
    // Distinct established anchors so each match's evidence is independent.
    ...["p1", "p2", "p3", "p4", "p5"].map((id) => ({ id, seedRating: 3.5, seedCount: 20 })),
    ...["a1", "b1", "a2", "b2", "a3", "b3", "a4", "b4", "a5", "b5"].map((id) => ({
      id, seedRating: 3.5, seedCount: 20,
    })),
  ];
}

/** Five placement matches with fixed scores (one loss in the middle). */
export function goldenMatches(): MatchInput[] {
  const rows: [string, string, string, number, number][] = [
    ["p1", "a1", "b1", 11, 4],
    ["p2", "a2", "b2", 11, 6],
    ["p3", "a3", "b3", 11, 2],
    ["p4", "a4", "b4", 9, 11],
    ["p5", "a5", "b5", 11, 5],
  ];
  return rows.map(([partner, o1, o2, s1, s2], i) => {
    const day = String(i + 1).padStart(2, "0");
    return {
      id: `gm${day}`, date: `2026-03-${day}`, createdAt: `2026-03-${day}T00:00:00Z`,
      type: "casual" as const,
      team1: [GOLDEN_FOCAL, partner] as [string, string],
      team2: [o1, o2] as [string, string],
      team1Score: s1, team2Score: s2,
    };
  });
}

export interface GoldenExpectation {
  matchIndex: number;
  ratingAfter: number;
  placedRating: number | null;
}

/** Focal player's expected rating_after per match + final placed_rating. */
export function computeGolden(): { rows: GoldenExpectation[]; placedRating: number } {
  const res = replayRatings(goldenMatches(), goldenPlayers(), LOCKED_PARAMS);
  const mine = res.rows
    .filter((r) => r.playerId === GOLDEN_FOCAL)
    .sort((a, b) => a.matchIndexForPlayer - b.matchIndexForPlayer);
  const round = (n: number) => Math.round(n * 10000) / 10000;
  return {
    rows: mine.map((r) => ({
      matchIndex: r.matchIndexForPlayer,
      ratingAfter: round(r.ratingAfter),
      placedRating: null,
    })),
    placedRating: round(res.players[GOLDEN_FOCAL].placedRating!),
  };
}
