/**
 * PULSE rating engine — pure, deterministic reference implementation.
 *
 * Mirrors the live SQL engine (`calculate_pulse_rating_change` +
 * `recalculate_all_ratings`) and adds the feature-flagged PLACEMENT branch
 * (Phase 1). With `placementEnabled: false` the output matches the current
 * engine exactly; with it true, each player is independently routed through
 * placement → provisional → established with the safeguards specced in the
 * design (protect established players from uncertain opponents, weight
 * evidence by participant reliability, use pre-match ratings only).
 *
 * Nothing here writes to the DB. It exists to simulate + unit-test placement
 * before any production write is enabled.
 */

import {
  type MatchType,
  type PlayerState,
  type RatingParams,
  baseK,
  clamp,
  reliabilityOf,
  stateFromCount,
} from "./params";

export interface MatchInput {
  id: string;
  /** Sortable match date (YYYY-MM-DD or ISO). */
  date: string;
  /** Tiebreak within a date (creation order). */
  createdAt: string;
  type: MatchType;
  team1: [string, string];
  team2: [string, string];
  team1Score: number;
  team2Score: number;
}

export interface PlayerInit {
  id: string;
  /** initial_self_rating; null/undefined falls back to 3.00. */
  selfRating?: number | null;
  /**
   * SIMULATION ONLY — pre-seed an existing player's committed match count so
   * an "anchor" opponent can start already-established without replaying their
   * history. Production always starts everyone at 0; leave unset there.
   */
  seedCount?: number;
  /** SIMULATION ONLY — pre-seed the starting rating (defaults to selfRating). */
  seedRating?: number;
}

export interface MatchResultRow {
  matchId: string;
  playerId: string;
  /** 1-based: this is the player's Nth rating-eligible match. */
  matchIndexForPlayer: number;
  /** Pre-match lifecycle state. */
  state: PlayerState;
  ratingBefore: number;
  ratingAfter: number;
  delta: number;
  /** True when this row was scored by the placement estimator (not ELO). */
  isPlacementObs: boolean;
}

export interface PlayerOutput {
  rating: number;
  count: number;
  placedRating: number | null;
  placedAt: string | null;
  placementModelVersion: number | null;
}

export interface ReplayResult {
  rows: MatchResultRow[];
  players: Record<string, PlayerOutput>;
}

interface PState {
  id: string;
  prior: number;
  rating: number;
  count: number;
  accW: number;
  accA: number;
  placedRating: number | null;
  placedAt: string | null;
}

const START_DEFAULT = 3.0;

/** Expected score via the logistic curve (SQL parity). */
export function expectedScore(teamAvg: number, oppAvg: number, tau: number): number {
  return 1.0 / (1.0 + Math.pow(10, (oppAvg - teamAvg) / tau));
}

/** Margin-of-victory multiplier (SQL parity). */
export function movMultiplier(myScore: number, oppScore: number, p: RatingParams): number {
  const mov = Math.min(Math.abs(myScore - oppScore) / p.pointsPerGame, p.movCap);
  return 1.0 + mov;
}

/** Steady-state ELO delta for one player in one match. */
export function eloDelta(args: {
  teamAvg: number;
  oppAvg: number;
  myScore: number;
  oppScore: number;
  won: boolean;
  type: MatchType;
  provisionalBonus: boolean;
  kMult: number;
  p: RatingParams;
}): number {
  const { teamAvg, oppAvg, myScore, oppScore, won, type, provisionalBonus, kMult, p } = args;
  const E = expectedScore(teamAvg, oppAvg, p.tau);
  let k = baseK(type, p);
  if (provisionalBonus) k *= 1 + p.provisionalBonus;
  k *= kMult;
  const mov = movMultiplier(myScore, oppScore, p);
  const actual = won ? 1.0 : 0.0;
  return k * mov * (actual - E);
}

/**
 * Placement estimator: the individual rating this single match implies for a
 * placing player, from the OPPONENT average, the result, and the score margin.
 * Note the team→individual conversion doubles the team-level offset:
 *   playerEstimate = 2 * impliedTeam − partner.
 */
export function impliedIndividualRating(args: {
  oppAvg: number;
  partnerRating: number;
  myScore: number;
  oppScore: number;
  won: boolean;
  p: RatingParams;
}): number {
  const { oppAvg, partnerRating, myScore, oppScore, won, p } = args;
  // 0..1 evidence strength from margin (full at the MoV cap).
  const marginFactor = Math.min(Math.abs(myScore - oppScore) / p.pointsPerGame, p.movCap) / p.movCap;
  const g = (won ? 1 : -1) * p.placementTeamResultConstant * marginFactor;
  const impliedTeam = oppAvg + g;
  return clamp(2 * impliedTeam - partnerRating, p.clampMin, p.clampMax);
}

function teammateAndOpps(i: number): { partner: number; opps: [number, number] } {
  // ids order is [t1a, t1b, t2a, t2b]
  switch (i) {
    case 0:
      return { partner: 1, opps: [2, 3] };
    case 1:
      return { partner: 0, opps: [2, 3] };
    case 2:
      return { partner: 3, opps: [0, 1] };
    default:
      return { partner: 2, opps: [0, 1] };
  }
}

/**
 * Deterministically replay a match history and produce per-match rating rows
 * and final per-player outputs. Sequential, pre-match ratings only — the exact
 * contract the SQL replay honors.
 */
export function replayRatings(
  matchesIn: MatchInput[],
  playersIn: PlayerInit[],
  p: RatingParams,
): ReplayResult {
  const st = new Map<string, PState>();
  for (const pl of playersIn) {
    const prior = clamp(pl.selfRating ?? START_DEFAULT, p.clampMin, p.clampMax);
    const startRating = clamp(pl.seedRating ?? prior, p.clampMin, p.clampMax);
    st.set(pl.id, {
      id: pl.id,
      prior,
      rating: startRating,
      count: pl.seedCount ?? 0,
      accW: p.placementPriorWeight,
      accA: p.placementPriorWeight * prior,
      placedRating: null,
      placedAt: null,
    });
  }
  const ensure = (id: string): PState => {
    let s = st.get(id);
    if (!s) {
      s = {
        id,
        prior: START_DEFAULT,
        rating: START_DEFAULT,
        count: 0,
        accW: p.placementPriorWeight,
        accA: p.placementPriorWeight * START_DEFAULT,
        placedRating: null,
        placedAt: null,
      };
      st.set(id, s);
    }
    return s;
  };

  const matches = [...matchesIn].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.id.localeCompare(b.id),
  );

  const rows: MatchResultRow[] = [];

  for (const m of matches) {
    const ids = [m.team1[0], m.team1[1], m.team2[0], m.team2[1]];
    const teams = [1, 1, 2, 2] as const;
    const S = ids.map((id) => ensure(id));

    // Snapshot pre-match state for all four (no future information).
    const pre = S.map((s) => ({
      rating: s.rating,
      count: s.count,
      state: stateFromCount(s.count, p),
    }));

    const staged: { ratingAfter: number; delta: number; isPlacementObs: boolean }[] = [];

    for (let i = 0; i < 4; i++) {
      const myTeam = teams[i];
      const { partner, opps } = teammateAndOpps(i);
      const teamAvg = (pre[i].rating + pre[partner].rating) / 2;
      const oppAvg = (pre[opps[0]].rating + pre[opps[1]].rating) / 2;
      const myScore = myTeam === 1 ? m.team1Score : m.team2Score;
      const oppScore = myTeam === 1 ? m.team2Score : m.team1Score;
      const won = myScore > oppScore;
      const me = S[i];

      if (p.placementEnabled && pre[i].state === "placing") {
        // Placement observation — no ELO update; running weighted estimate.
        const implied = impliedIndividualRating({
          oppAvg,
          partnerRating: pre[partner].rating,
          myScore,
          oppScore,
          won,
          p,
        });
        const wObs =
          (reliabilityOf(pre[partner].state, p) +
            reliabilityOf(pre[opps[0]].state, p) +
            reliabilityOf(pre[opps[1]].state, p)) /
          3;
        me.accW += wObs;
        me.accA += wObs * implied;
        const running = clamp(me.accA / me.accW, p.clampMin, p.clampMax);
        staged.push({ ratingAfter: running, delta: running - pre[i].rating, isPlacementObs: true });

        // The Nth match where pre-count hits placementMatches-1 completes placement.
        if (pre[i].count + 1 === p.placementMatches) {
          me.placedRating = running;
          me.placedAt = m.date;
        }
      } else {
        // Steady-state ELO. Provisional bonus while under the provisional
        // threshold; protect this player if any opponent is still placing.
        const provisionalBonus = pre[i].count < p.provisionalMatches;
        const oppPlacing =
          p.placementEnabled &&
          (pre[opps[0]].state === "placing" || pre[opps[1]].state === "placing");
        const kMult = oppPlacing ? p.placingOpponentEloMultiplier : 1;
        const rawDelta = eloDelta({
          teamAvg,
          oppAvg,
          myScore,
          oppScore,
          won,
          type: m.type,
          provisionalBonus,
          kMult,
          p,
        });
        const after = clamp(pre[i].rating + rawDelta, p.clampMin, p.clampMax);
        staged.push({ ratingAfter: after, delta: after - pre[i].rating, isPlacementObs: false });
      }
    }

    // Commit atomically after all four are computed from pre-match state.
    for (let i = 0; i < 4; i++) {
      const me = S[i];
      rows.push({
        matchId: m.id,
        playerId: me.id,
        matchIndexForPlayer: pre[i].count + 1,
        state: pre[i].state,
        ratingBefore: pre[i].rating,
        ratingAfter: staged[i].ratingAfter,
        delta: staged[i].delta,
        isPlacementObs: staged[i].isPlacementObs,
      });
      me.rating = staged[i].ratingAfter;
      me.count += 1;
    }
  }

  const players: Record<string, PlayerOutput> = {};
  for (const [id, s] of st) {
    players[id] = {
      rating: s.rating,
      count: s.count,
      placedRating: s.placedRating,
      placedAt: s.placedAt,
      placementModelVersion: s.placedRating != null ? p.placementModelVersion : null,
    };
  }

  return { rows, players };
}

/** Ratings for a focal player after each of their 1-based match indices. */
export function focalRatingAtIndices(
  res: ReplayResult,
  playerId: string,
  indices: number[],
): Record<number, number | null> {
  const mine = res.rows
    .filter((r) => r.playerId === playerId)
    .sort((a, b) => a.matchIndexForPlayer - b.matchIndexForPlayer);
  const out: Record<number, number | null> = {};
  for (const idx of indices) {
    const row = mine.find((r) => r.matchIndexForPlayer === idx);
    out[idx] = row ? row.ratingAfter : null;
  }
  return out;
}
