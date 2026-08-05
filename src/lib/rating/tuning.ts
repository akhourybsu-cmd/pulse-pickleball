/**
 * Placement calibration harness (Phase 1 tuning).
 *
 * Sweeps the placement constants across a broad scenario matrix — every
 * combination of true skill level, self-rating error, and result noise — and
 * scores each parameter set by how quickly and accurately a player converges
 * to their TRUE level, while keeping correctly-rated players stable and
 * protecting established opponents. Pure + deterministic (seeded RNG) so the
 * recommendation is reproducible in CI.
 *
 * Outcomes are generated from players' TRUE ratings (which the engine cannot
 * see — it only sees displayed ratings); a good parameter set recovers the
 * truth from results alone.
 */

import { DEFAULT_PARAMS, type RatingParams, clamp } from "./params";
import {
  type MatchInput,
  type PlayerInit,
  focalRatingAtIndices,
  replayRatings,
} from "./engine";
import { FOCAL } from "./sim";

// ---- deterministic RNG (LCG) ---------------------------------------------
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

// Outcomes use a softer curve than the rating tau so realistic upsets happen.
const OUTCOME_TAU = 0.9;

function playMatch(
  teamTrue: number,
  oppTrue: number,
  rng: () => number,
): { fScore: number; oScore: number } {
  const pWin = 1 / (1 + Math.pow(10, (oppTrue - teamTrue) / OUTCOME_TAU));
  const won = rng() < pWin;
  const gap = Math.abs(teamTrue - oppTrue);
  const jitter = Math.round((rng() - 0.5) * 4); // ±2
  const loser = clamp(Math.round(9 - 8 * gap) + jitter, 0, 9);
  return won ? { fScore: 11, oScore: loser } : { fScore: loser, oScore: 11 };
}

export interface Scenario {
  key: string;
  trueLevel: number;
  self: number | null;
  players: PlayerInit[];
  matches: MatchInput[];
}

/** One focal player (true = trueLevel, self-rated = self) across 15 matches
 *  vs accurate, established opponents/partners spread around the true level. */
function makeScenario(trueLevel: number, self: number | null, seed: number): Scenario {
  const rng = lcg(seed);
  const players: PlayerInit[] = [{ id: FOCAL, selfRating: self }];
  const matches: MatchInput[] = [];
  const spread = [-0.5, 0, 0.5, 0.25, -0.25];

  for (let i = 0; i < 15; i++) {
    const partnerTrue = clamp(trueLevel + spread[i % spread.length], 2.0, 4.5);
    const oppTrue = clamp(trueLevel + spread[(i + 2) % spread.length], 2.0, 4.5);
    const pId = `p${i}`, o1 = `o1_${i}`, o2 = `o2_${i}`;
    players.push(
      { id: pId, seedRating: partnerTrue, seedCount: 20 },
      { id: o1, seedRating: oppTrue, seedCount: 20 },
      { id: o2, seedRating: oppTrue, seedCount: 20 },
    );
    const teamTrue = (trueLevel + partnerTrue) / 2;
    const { fScore, oScore } = playMatch(teamTrue, oppTrue, rng);
    const day = String(i + 1).padStart(2, "0");
    matches.push({
      id: `m${day}`, date: `2026-01-${day}`, createdAt: `2026-01-${day}T00:00:00Z`,
      type: "casual", team1: [FOCAL, pId], team2: [o1, o2], team1Score: fScore, team2Score: oScore,
    });
  }
  return { key: `t${trueLevel}_s${self ?? "none"}`, trueLevel, self, players, matches };
}

export function buildMatrix(): Scenario[] {
  const trueLevels = [2.25, 2.75, 3.25, 3.75, 4.25];
  const selfErrors = [-1.0, -0.5, 0, 0.5, 1.0];
  const out: Scenario[] = [];
  let seed = 12345;
  for (const t of trueLevels) {
    for (const e of selfErrors) {
      const self = clamp(t + e, 2.0, 4.5);
      out.push(makeScenario(t, self, seed));
      seed += 7919;
    }
  }
  return out;
}

export interface EvalResult {
  maeCurrent: Record<number, number>;
  maePlacement: Record<number, number>;
  correctlyRatedDrift: number; // placement engine, |rating−true| for self==true scenarios
}

const IDX = [5, 8, 15];

/** Mean-absolute-error to true level at each index, both engines. */
export function evaluate(params: RatingParams, matrix: Scenario[]): EvalResult {
  const cur: Record<number, number[]> = { 5: [], 8: [], 15: [] };
  const plc: Record<number, number[]> = { 5: [], 8: [], 15: [] };
  const correct: number[] = [];

  for (const sc of matrix) {
    const c = replayRatings(sc.matches, sc.players, { ...params, placementEnabled: false });
    const p = replayRatings(sc.matches, sc.players, { ...params, placementEnabled: true });
    const cAt = focalRatingAtIndices(c, FOCAL, IDX);
    const pAt = focalRatingAtIndices(p, FOCAL, IDX);
    for (const i of IDX) {
      if (cAt[i] != null) cur[i].push(Math.abs(cAt[i]! - sc.trueLevel));
      if (pAt[i] != null) plc[i].push(Math.abs(pAt[i]! - sc.trueLevel));
    }
    if (sc.self != null && Math.abs(sc.self - sc.trueLevel) < 1e-9 && pAt[5] != null) {
      correct.push(Math.abs(pAt[5]! - sc.trueLevel));
    }
  }
  const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  return {
    maeCurrent: { 5: mean(cur[5]), 8: mean(cur[8]), 15: mean(cur[15]) },
    maePlacement: { 5: mean(plc[5]), 8: mean(plc[8]), 15: mean(plc[15]) },
    correctlyRatedDrift: mean(correct),
  };
}

export interface SweepRow {
  teamResultConstant: number;
  priorWeight: number;
  mae5: number;
  mae15: number;
  correctDrift: number;
  score: number;
}

/** Grid search over the two accuracy-critical knobs. Objective: minimize
 *  MAE@5 (convergence speed/accuracy), with a small penalty for disrupting
 *  correctly-rated players. */
export function sweep(matrix: Scenario[]): { best: SweepRow; rows: SweepRow[] } {
  const Cs = [0.15, 0.18, 0.2, 0.22, 0.25, 0.28, 0.3];
  const Ws = [0.5, 1.0, 1.5, 2.0];
  const rows: SweepRow[] = [];
  for (const C of Cs) {
    for (const W of Ws) {
      const r = evaluate(
        { ...DEFAULT_PARAMS, placementTeamResultConstant: C, placementPriorWeight: W },
        matrix,
      );
      const score = r.maePlacement[5] + 0.5 * r.correctlyRatedDrift;
      rows.push({
        teamResultConstant: C, priorWeight: W,
        mae5: r.maePlacement[5], mae15: r.maePlacement[15],
        correctDrift: r.correctlyRatedDrift, score,
      });
    }
  }
  rows.sort((a, b) => a.score - b.score);
  return { best: rows[0], rows };
}

// ---- Established-opponent protection sweep --------------------------------

/** A secretly-strong newcomer (true 4.3, self 3.0 → "placing") repeatedly beats
 *  an established 4.0 player. Measure the total unfair damage to the established
 *  player's rating across a handful of such matches, per protection multiplier. */
export function establishedDamage(multiplier: number): number {
  const rng = lcg(999);
  const players: PlayerInit[] = [
    { id: "E", seedRating: 4.0, seedCount: 30 },
    { id: "Ep", seedRating: 4.0, seedCount: 30 },
    { id: FOCAL, selfRating: 3.0 }, // placing, but truly ~4.3
    { id: "Fp", seedRating: 4.0, seedCount: 30 },
  ];
  const matches: MatchInput[] = [];
  for (let i = 0; i < 4; i++) {
    const { fScore, oScore } = playMatch(4.15, 4.0, rng); // focal team (true) slightly better
    const day = String(i + 1).padStart(2, "0");
    matches.push({
      id: `d${day}`, date: `2026-02-${day}`, createdAt: `2026-02-${day}T00:00:00Z`,
      type: "casual", team1: ["E", "Ep"], team2: [FOCAL, "Fp"], team1Score: oScore, team2Score: fScore,
    });
  }
  const res = replayRatings(matches, players, {
    ...DEFAULT_PARAMS, placementEnabled: true, placingOpponentEloMultiplier: multiplier,
  });
  const eStart = 4.0;
  const eEnd = res.players["E"].rating;
  return Math.abs(eEnd - eStart);
}
