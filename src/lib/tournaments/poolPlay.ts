import { generateRoundRobin } from './roundRobin';
import { bracketSizeFor, seedOrder, seedIsBye } from './seeding';
import type { Standing } from './standings';

/**
 * Pool play — round robin pools feeding an elimination bracket.
 *
 * This is the format the overwhelming majority of pickleball tournaments
 * actually run, and it was offered in both division dialogs while having no
 * implementation whatsoever: choosing "Pool Play" produced a division whose
 * generate button opened the elimination dialog and built a plain single-elim
 * bracket. Every team got one match and went home.
 *
 * Two stages:
 *   • POOL stage — teams are split into pools and play a full round robin
 *     inside their own pool. Matches carry a `pool` label and no `bracket`.
 *   • BRACKET stage — the top N of each pool cross over into a single
 *     elimination draw. Those matches carry `bracket` and no `pool`.
 *
 * Everything is pure so the seeding rules can be tested without a database.
 */

export const POOL_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export interface Pool {
  label: string;
  teamIds: string[];
}

export interface PoolMatch {
  pool: string;
  round: number;
  matchNumber: number;
  teamA: string;
  teamB: string;
}

export interface PoolPlayDraw {
  pools: Pool[];
  matches: PoolMatch[];
}

/**
 * How many pools a field should use, when the organizer doesn't say.
 *
 * Pools of four are the pickleball default: three matches guarantees everyone
 * a real morning, and four-team pools finish predictably on one court. Fives
 * are the usual fallback for fields that don't divide evenly.
 */
export function suggestedPoolCount(teamCount: number): number {
  if (teamCount < 6) return 1;
  return Math.max(2, Math.round(teamCount / 4));
}

/**
 * Split seeded teams across pools serpentine ("snake") style: seeds run
 * 1,2,3…k across the pools, then k,…,3,2,1 back, and so on.
 *
 * Straight dealing would stack the top seeds' pools unevenly — with 8 teams in
 * 2 pools it would put seeds 1 and 3 together against seeds 2 and 4. The snake
 * gives every pool a comparable spread of seeds, which is the whole point of
 * seeding a field before you split it.
 *
 * `seededTeamIds` must already be in seed order, best first.
 */
export function assignPools(seededTeamIds: string[], poolCount: number): Pool[] {
  const count = Math.max(1, Math.min(poolCount, seededTeamIds.length || 1));
  const pools: Pool[] = Array.from({ length: count }, (_, i) => ({
    label: POOL_LABELS[i] ?? `P${i + 1}`,
    teamIds: [],
  }));

  seededTeamIds.forEach((teamId, i) => {
    const row = Math.floor(i / count);
    const pos = i % count;
    const index = row % 2 === 0 ? pos : count - 1 - pos;
    pools[index].teamIds.push(teamId);
  });

  return pools.filter((p) => p.teamIds.length > 0);
}

/**
 * Build the pool stage: a full round robin inside every pool.
 *
 * Match numbers are global within a round rather than per-pool, so two pools
 * playing simultaneously don't both show a "Match 1" in the same round.
 */
export function generatePoolPlay(
  seededTeamIds: string[],
  poolCount: number,
): PoolPlayDraw {
  const pools = assignPools(seededTeamIds, poolCount);
  const byRound = new Map<number, PoolMatch[]>();

  for (const pool of pools) {
    for (const m of generateRoundRobin(pool.teamIds).matches) {
      // Round robin only ever pairs real teams, so the sides are non-null here.
      const match: PoolMatch = {
        pool: pool.label,
        round: m.round,
        matchNumber: 0,
        teamA: m.teamA as string,
        teamB: m.teamB as string,
      };
      const list = byRound.get(m.round);
      if (list) list.push(match);
      else byRound.set(m.round, [match]);
    }
  }

  const matches: PoolMatch[] = [];
  for (const round of [...byRound.keys()].sort((a, b) => a - b)) {
    byRound.get(round)!.forEach((m, i) => {
      matches.push({ ...m, matchNumber: i + 1 });
    });
  }

  return { pools, matches };
}

export interface PoolResult {
  label: string;
  /** Final pool order, best first — the output of computeStandings for a pool. */
  ordered: Standing[];
}

/**
 * Seed order for the playoff bracket, given each pool's finishing order.
 *
 * Two rules, in this order:
 *
 *  1. Teams are grouped by finishing PLACE — every pool winner outranks every
 *     runner-up. Within a place, pools are ranked against each other on record,
 *     so the strongest pool winner takes the top seed. Ranking by place first
 *     is what stops a strong pool's second-place team from displacing a weaker
 *     pool's winner, which is the convention players expect.
 *
 *  2. Pool-mates are then pulled apart so they can't meet again in round one.
 *     Whether the naive order collides depends on the pool count — with three
 *     pools, the middle seed always draws its own pool-mate — so rather than
 *     rely on a closed form that holds for some field sizes and not others,
 *     the pairing is checked and repaired directly. Repairs only ever swap two
 *     teams that finished in the same place, so seeding strength is preserved.
 *
 * A rematch is still possible later in the bracket. That's expected and
 * unavoidable; the guarantee is only about round one.
 */
export function bracketSeedsFromPools(
  pools: PoolResult[],
  advancersPerPool: number,
): string[] {
  const seeds: string[] = [];
  /** Parallel to `seeds`: which pool each seed came from, for collision repair. */
  const origin: string[] = [];
  /** Parallel to `seeds`: finishing place, so swaps stay within a place. */
  const place: number[] = [];

  for (let p = 0; p < advancersPerPool; p++) {
    const atPlace = pools
      .map((pool) => ({ pool: pool.label, standing: pool.ordered[p] }))
      .filter((x) => !!x.standing)
      .sort(
        (a, b) =>
          b.standing.winPct - a.standing.winPct ||
          b.standing.pointDiff - a.standing.pointDiff ||
          b.standing.pointsFor - a.standing.pointsFor ||
          a.pool.localeCompare(b.pool),
      );

    for (const entry of atPlace) {
      seeds.push(entry.standing.teamId);
      origin.push(entry.pool);
      place.push(p);
    }
  }

  separatePoolMates(seeds, origin, place);
  return seeds;
}

/**
 * Swap same-place seeds until no first-round match is a pool rematch.
 *
 * `seeds` is mutated in place. Positions are seed numbers; the draw pairs them
 * according to the standard fold order, so the pairing has to be read off
 * `seedOrder` rather than assumed.
 */
function separatePoolMates(seeds: string[], origin: string[], place: number[]): void {
  const pairs = firstRoundSeedPairs(seeds.length);

  for (const [x, y] of pairs) {
    if (origin[x] !== origin[y]) continue;

    // Find another team that finished in the same place as y, whose own pairing
    // stays clean after the swap and whose partner isn't from y's pool either.
    const candidate = seeds.findIndex((_, i) => {
      if (i === x || i === y) return false;
      if (place[i] !== place[y]) return false;
      const partner = partnerOf(i, pairs);
      if (partner === undefined) return false;
      // After swapping i and y: x faces origin[i], and partner faces origin[y].
      return origin[i] !== origin[x] && origin[partner] !== origin[y];
    });

    if (candidate === -1) continue; // nothing legal to swap with; leave it be

    [seeds[y], seeds[candidate]] = [seeds[candidate], seeds[y]];
    [origin[y], origin[candidate]] = [origin[candidate], origin[y]];
  }
}

/** Index pairs into a seed array that meet in round one, byes excluded. */
function firstRoundSeedPairs(teamCount: number): Array<[number, number]> {
  const size = bracketSizeFor(teamCount);
  const order = seedOrder(size);
  const pairs: Array<[number, number]> = [];

  for (let i = 0; i < order.length; i += 2) {
    const a = order[i];
    const b = order[i + 1];
    // A seed beyond the field is an empty slot; its opponent has a bye.
    if (seedIsBye(a, teamCount) || seedIsBye(b, teamCount)) continue;
    pairs.push([a - 1, b - 1]);
  }

  return pairs;
}

function partnerOf(index: number, pairs: Array<[number, number]>): number | undefined {
  for (const [a, b] of pairs) {
    if (a === index) return b;
    if (b === index) return a;
  }
  return undefined; // has a bye
}
