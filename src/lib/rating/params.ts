/**
 * PULSE rating parameters — the single source of the constants that drive the
 * rating math, mirroring the DB `rating_parameters` row plus the new,
 * feature-flagged placement knobs (Phase 1).
 *
 * This TS engine is a faithful reference implementation of the SQL engine
 * (`calculate_pulse_rating_change` / `recalculate_all_ratings`) so we can
 * simulate and unit-test placement deterministically BEFORE any production
 * write is enabled. Defaults below match the live DB defaults exactly; the
 * placement defaults are starting points the simulator is meant to tune.
 */

export type MatchType = "casual" | "ladder" | "league" | "playoffs";

/** A player's rating lifecycle state, derived from their pre-match count. */
export type PlayerState = "placing" | "provisional" | "established";

export interface RatingParams {
  // ---- Steady-state ELO (live DB defaults) ----
  tau: number; // logistic spread; DB default 0.4
  clampMin: number; // DB default 2.0
  clampMax: number; // DB default 4.5
  kLadder: number; // 0.055 (casual = kLadder * 0.5)
  kLeague: number; // 0.075
  kPlayoffs: number; // 0.095
  movCap: number; // 0.4
  pointsPerGame: number; // 11
  provisionalMatches: number; // 8
  provisionalBonus: number; // 0.07

  // ---- Placement (Phase 1, feature-flagged OFF by default) ----
  placementEnabled: boolean; // master flag; false = current behavior exactly
  placementMatches: number; // 5 — matches 0..4 are placement; completes on the 5th
  placementPriorWeight: number; // 1.0 — weight of the self-rating prior (≈ one match)
  placementTeamResultConstant: number; // team-level result offset per unit margin (sim: 0.18–0.25)
  placingOpponentEloMultiplier: number; // K reduction for est/prov players facing a placing opp (sim: 0.25–0.50)
  reliabilityPlacing: number; // evidence weight of a placing participant (0.50)
  reliabilityProvisional: number; // (0.75)
  reliabilityEstablished: number; // (1.00)
  placementModelVersion: number; // bump when the formula changes (audit)
}

export const DEFAULT_PARAMS: RatingParams = {
  tau: 0.4,
  clampMin: 2.0,
  clampMax: 4.5,
  kLadder: 0.055,
  kLeague: 0.075,
  kPlayoffs: 0.095,
  movCap: 0.4,
  pointsPerGame: 11,
  provisionalMatches: 8,
  provisionalBonus: 0.07,

  placementEnabled: false,
  placementMatches: 5,
  placementPriorWeight: 1.0,
  placementTeamResultConstant: 0.2, // mid of the 0.18–0.25 sim range
  placingOpponentEloMultiplier: 0.35, // mid of the 0.25–0.50 sim range
  reliabilityPlacing: 0.5,
  reliabilityProvisional: 0.75,
  reliabilityEstablished: 1.0,
  placementModelVersion: 1,
};

/** Base K-factor for a match type (casual is a discount on ladder, per SQL). */
export function baseK(type: MatchType, p: RatingParams): number {
  switch (type) {
    case "ladder":
      return p.kLadder;
    case "playoffs":
      return p.kPlayoffs;
    case "casual":
      return p.kLadder * 0.5;
    case "league":
    default:
      return p.kLeague;
  }
}

/** Lifecycle state from a player's PRE-match count of rating-eligible matches. */
export function stateFromCount(count: number, p: RatingParams): PlayerState {
  if (p.placementEnabled && count < p.placementMatches) return "placing";
  if (count < p.provisionalMatches) return "provisional";
  return "established";
}

export function reliabilityOf(state: PlayerState, p: RatingParams): number {
  switch (state) {
    case "placing":
      return p.reliabilityPlacing;
    case "provisional":
      return p.reliabilityProvisional;
    case "established":
      return p.reliabilityEstablished;
  }
}

export const clamp = (x: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, x));
