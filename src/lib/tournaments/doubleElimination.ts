import { bracketSizeFor, seedOrder, seedIsBye } from './seeding';

/**
 * Double elimination: winners bracket + losers bracket + grand final.
 *
 * The previous implementation had no losers bracket at all — it emitted one
 * round of adjacent-seed pairings and called it double elimination. This builds
 * the real structure.
 *
 * Shape, for a bracket of size N = 2^n:
 *   • Winners bracket (WB): n rounds, standard single-elim layout.
 *   • Losers bracket (LB): 2(n-1) rounds, alternating
 *       - MINOR rounds (odd j): LB survivors play each other; the field halves.
 *       - MAJOR rounds (even j): LB survivors meet the WB losers who just
 *         dropped down; the field stays the same size.
 *   • Grand final: WB champion vs LB champion.
 *
 * Total matches = 2N - 2 (plus a bracket reset if the LB champion wins the GF).
 *
 * Unlike single elimination, routing here is NOT derivable from
 * (round, matchNumber) alone, because winners and losers are separate brackets.
 * It is still fully deterministic given the bracket size, so it lives in
 * routeWinner/routeLoser rather than in feeder columns — the only new thing the
 * database needs is a `bracket` discriminator on the match.
 */

export type BracketSide = 'winners' | 'losers' | 'grand_final';

export interface DoubleElimMatch {
  bracket: BracketSide;
  /** 1-indexed round WITHIN its own bracket. */
  round: number;
  matchNumber: number;
  teamA: string | null;
  teamB: string | null;
}

export interface Destination {
  bracket: BracketSide;
  round: number;
  matchNumber: number;
  side: 'A' | 'B';
}

export interface DoubleEliminationDraw {
  bracketSize: number;
  winnersRounds: number;
  losersRounds: number;
  byes: number;
  matches: DoubleElimMatch[];
}

/** Matches in winners-bracket round r. */
export function winnersRoundSize(bracketSize: number, round: number): number {
  return bracketSize / 2 ** round;
}

/**
 * Matches in losers-bracket round j.
 *
 * Odd (minor) rounds halve the field; even (major) rounds absorb the WB
 * dropdown and keep it the same size. Both collapse to the same expression
 * with a different exponent.
 */
export function losersRoundSize(bracketSize: number, j: number): number {
  const exp = j % 2 === 1 ? (j + 1) / 2 + 1 : j / 2 + 1;
  return bracketSize / 2 ** exp;
}

/** Total losers-bracket rounds for an n-round winners bracket. */
export function losersRoundCount(winnersRounds: number): number {
  return Math.max(0, 2 * (winnersRounds - 1));
}

/** Where the WINNER of a match goes. Null means the tournament is decided. */
export function routeWinner(
  bracketSize: number,
  bracket: BracketSide,
  round: number,
  matchNumber: number,
): Destination | null {
  const n = Math.log2(bracketSize);
  const lbRounds = losersRoundCount(n);

  if (bracket === 'grand_final') return null;

  if (bracket === 'winners') {
    if (round < n) {
      return {
        bracket: 'winners',
        round: round + 1,
        matchNumber: Math.ceil(matchNumber / 2),
        side: matchNumber % 2 === 1 ? 'A' : 'B',
      };
    }
    // WB champion takes the top line of the grand final.
    return { bracket: 'grand_final', round: 1, matchNumber: 1, side: 'A' };
  }

  // Losers bracket
  if (round >= lbRounds) {
    return { bracket: 'grand_final', round: 1, matchNumber: 1, side: 'B' };
  }
  if (round % 2 === 1) {
    // Minor -> major: same match index; side B is reserved for the WB dropdown.
    return { bracket: 'losers', round: round + 1, matchNumber, side: 'A' };
  }
  // Major -> minor: the field halves.
  return {
    bracket: 'losers',
    round: round + 1,
    matchNumber: Math.ceil(matchNumber / 2),
    side: matchNumber % 2 === 1 ? 'A' : 'B',
  };
}

/**
 * Where the LOSER of a winners-bracket match drops to. Losers of losers-bracket
 * matches are eliminated, and the grand final has no drop.
 */
export function routeLoser(
  bracketSize: number,
  bracket: BracketSide,
  round: number,
  matchNumber: number,
): Destination | null {
  if (bracket !== 'winners') return null;
  const n = Math.log2(bracketSize);
  if (losersRoundCount(n) === 0) return null;

  if (round === 1) {
    // Two WB round-1 losers pair up in LB round 1.
    return {
      bracket: 'losers',
      round: 1,
      matchNumber: Math.ceil(matchNumber / 2),
      side: matchNumber % 2 === 1 ? 'A' : 'B',
    };
  }
  // Later WB losers drop into the major round that waits for them, on side B.
  return { bracket: 'losers', round: 2 * (round - 1), matchNumber, side: 'B' };
}

/**
 * Build the full double-elimination skeleton from seed-ordered teams.
 *
 * Winners round 1 is populated from the seeding; every other slot starts empty
 * and is filled by routeWinner/routeLoser as results come in. Byes are handled
 * exactly as in single elimination — the seeded team is placed straight into
 * its winners round-two slot and no unplayable match is emitted.
 */
export function generateDoubleElimination(seededTeamIds: string[]): DoubleEliminationDraw {
  const teamCount = seededTeamIds.length;
  const bracketSize = bracketSizeFor(teamCount);
  const n = Math.log2(bracketSize);
  const lbRounds = losersRoundCount(n);

  if (teamCount < 4) {
    // Below 4 teams there is no meaningful losers bracket.
    return { bracketSize, winnersRounds: n, losersRounds: 0, byes: bracketSize - teamCount, matches: [] };
  }

  const order = seedOrder(bracketSize);
  const teamForSeed = (seed: number): string | null =>
    seedIsBye(seed, teamCount) ? null : seededTeamIds[seed - 1];

  const matches: DoubleElimMatch[] = [];
  const index = new Map<string, DoubleElimMatch>();

  const add = (m: DoubleElimMatch) => {
    matches.push(m);
    index.set(`${m.bracket}:${m.round}:${m.matchNumber}`, m);
  };

  // Winners bracket — all rounds, empty beyond round 1.
  for (let r = 1; r <= n; r++) {
    for (let m = 1; m <= winnersRoundSize(bracketSize, r); m++) {
      add({ bracket: 'winners', round: r, matchNumber: m, teamA: null, teamB: null });
    }
  }
  // Losers bracket.
  for (let j = 1; j <= lbRounds; j++) {
    for (let m = 1; m <= losersRoundSize(bracketSize, j); m++) {
      add({ bracket: 'losers', round: j, matchNumber: m, teamA: null, teamB: null });
    }
  }
  add({ bracket: 'grand_final', round: 1, matchNumber: 1, teamA: null, teamB: null });

  // Seed winners round 1, promoting bye teams straight into round 2.
  for (let i = 0; i < bracketSize; i += 2) {
    const matchNumber = i / 2 + 1;
    const a = teamForSeed(order[i]);
    const b = teamForSeed(order[i + 1]);
    const slot = index.get(`winners:1:${matchNumber}`)!;

    if (a && b) {
      slot.teamA = a;
      slot.teamB = b;
      continue;
    }
    const advancing = a ?? b;
    if (!advancing) continue;
    const dest = routeWinner(bracketSize, 'winners', 1, matchNumber);
    if (dest) {
      const target = index.get(`${dest.bracket}:${dest.round}:${dest.matchNumber}`);
      if (target) {
        if (dest.side === 'A') target.teamA = advancing;
        else target.teamB = advancing;
      }
    }
  }

  // Drop the now-unplayable winners round-1 matches (both sides empty because
  // the pairing was a bye).
  const played = matches.filter(
    (m) => !(m.bracket === 'winners' && m.round === 1 && !m.teamA && !m.teamB),
  );

  return { bracketSize, winnersRounds: n, losersRounds: lbRounds, byes: bracketSize - teamCount, matches: played };
}

/**
 * True double elimination needs a second grand final when the LB champion wins
 * the first — at that point both finalists have exactly one loss. Callers
 * create the reset match on demand rather than showing a phantom fixture.
 */
export function needsBracketReset(grandFinalWonByLosersChampion: boolean): boolean {
  return grandFinalWonByLosersChampion;
}
