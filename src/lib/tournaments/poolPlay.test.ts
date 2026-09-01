import { describe, expect, it } from 'vitest';
import {
  assignPools,
  bracketSeedsFromPools,
  generatePoolPlay,
  suggestedPoolCount,
  type PoolResult,
} from './poolPlay';
import { roundRobinMatchCount } from './roundRobin';
import { bracketSizeFor, seedIsBye, seedOrder } from './seeding';
import type { Standing } from './standings';

const ids = (n: number) => Array.from({ length: n }, (_, i) => `t${i + 1}`);

/** A standing good enough for seeding: only the sort keys matter. */
function standing(teamId: string, winPct: number, pointDiff = 0): Standing {
  return {
    teamId,
    teamName: teamId,
    pool: null,
    wins: 0,
    losses: 0,
    played: 0,
    winPct,
    pointsFor: 0,
    pointsAgainst: 0,
    pointDiff,
    rank: 0,
  };
}

describe('assignPools', () => {
  it('deals seeds serpentine so pools get a comparable spread', () => {
    const pools = assignPools(ids(8), 2);
    // Straight dealing would give A: 1,3,5,7. The snake gives A: 1,4,5,8.
    expect(pools.map((p) => p.teamIds)).toEqual([
      ['t1', 't4', 't5', 't8'],
      ['t2', 't3', 't6', 't7'],
    ]);
  });

  it('keeps pool sizes within one of each other for uneven fields', () => {
    for (const n of [5, 7, 9, 10, 11, 13, 14]) {
      for (const k of [2, 3, 4]) {
        const sizes = assignPools(ids(n), k).map((p) => p.teamIds.length);
        expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('places every team exactly once', () => {
    const pools = assignPools(ids(11), 3);
    const placed = pools.flatMap((p) => p.teamIds);
    expect(placed.sort()).toEqual(ids(11).sort());
  });

  it('never returns more pools than teams', () => {
    expect(assignPools(ids(2), 5)).toHaveLength(2);
  });

  it('gives the top seeds different pools', () => {
    const pools = assignPools(ids(16), 4);
    const poolOf = (id: string) => pools.findIndex((p) => p.teamIds.includes(id));
    expect(new Set(['t1', 't2', 't3', 't4'].map(poolOf)).size).toBe(4);
  });
});

describe('suggestedPoolCount', () => {
  it('targets pools of about four', () => {
    expect(suggestedPoolCount(8)).toBe(2);
    expect(suggestedPoolCount(12)).toBe(3);
    expect(suggestedPoolCount(16)).toBe(4);
  });

  it('keeps a small field in one pool', () => {
    expect(suggestedPoolCount(5)).toBe(1);
  });
});

describe('generatePoolPlay', () => {
  it('plays a full round robin inside each pool and never across pools', () => {
    const { pools, matches } = generatePoolPlay(ids(12), 3);
    const poolOf = new Map<string, string>();
    for (const p of pools) for (const t of p.teamIds) poolOf.set(t, p.label);

    for (const m of matches) {
      expect(poolOf.get(m.teamA)).toBe(m.pool);
      expect(poolOf.get(m.teamB)).toBe(m.pool);
    }

    const expected = pools.reduce((n, p) => n + roundRobinMatchCount(p.teamIds.length), 0);
    expect(matches).toHaveLength(expected);
  });

  it('pairs every team in a pool exactly once', () => {
    const { pools, matches } = generatePoolPlay(ids(8), 2);
    for (const pool of pools) {
      const seen = new Set<string>();
      for (const m of matches.filter((x) => x.pool === pool.label)) {
        seen.add([m.teamA, m.teamB].sort().join('|'));
      }
      expect(seen.size).toBe(roundRobinMatchCount(pool.teamIds.length));
    }
  });

  it('numbers matches uniquely within a round across pools', () => {
    const { matches } = generatePoolPlay(ids(12), 3);
    const byRound = new Map<number, number[]>();
    for (const m of matches) {
      byRound.set(m.round, [...(byRound.get(m.round) ?? []), m.matchNumber]);
    }
    for (const nums of byRound.values()) {
      expect(new Set(nums).size).toBe(nums.length);
    }
  });

  it('lets no team play twice in the same round', () => {
    const { matches } = generatePoolPlay(ids(16), 4);
    const byRound = new Map<number, string[]>();
    for (const m of matches) {
      byRound.set(m.round, [...(byRound.get(m.round) ?? []), m.teamA, m.teamB]);
    }
    for (const teams of byRound.values()) {
      expect(new Set(teams).size).toBe(teams.length);
    }
  });
});

describe('bracketSeedsFromPools', () => {
  /** Which seed indices meet in round one, byes excluded. */
  function firstRoundPairs(teamCount: number): Array<[number, number]> {
    const order = seedOrder(bracketSizeFor(teamCount));
    const pairs: Array<[number, number]> = [];
    for (let i = 0; i < order.length; i += 2) {
      const [a, b] = [order[i], order[i + 1]];
      if (seedIsBye(a, teamCount) || seedIsBye(b, teamCount)) continue;
      pairs.push([a - 1, b - 1]);
    }
    return pairs;
  }

  function poolsOf(count: number, perPool: number): PoolResult[] {
    return Array.from({ length: count }, (_, p) => ({
      label: String.fromCharCode(65 + p),
      ordered: Array.from({ length: perPool }, (_, i) =>
        // Decreasing strength within a pool, and pool A strongest overall.
        standing(`${String.fromCharCode(65 + p)}${i + 1}`, 1 - i * 0.1 - p * 0.01),
      ),
    }));
  }

  it('ranks every pool winner above every runner-up', () => {
    const seeds = bracketSeedsFromPools(poolsOf(4, 2), 2);
    const winners = seeds.slice(0, 4);
    expect(winners.every((s) => s.endsWith('1'))).toBe(true);
    expect(seeds.slice(4).every((s) => s.endsWith('2'))).toBe(true);
  });

  it('seeds the strongest pool winner first', () => {
    const seeds = bracketSeedsFromPools(poolsOf(4, 2), 2);
    expect(seeds[0]).toBe('A1');
  });

  it('never puts pool-mates in the same first-round match', () => {
    // Three pools is the case a naive ordering always gets wrong: the middle
    // seed draws its own pool-mate.
    for (const poolCount of [2, 3, 4, 5, 6, 8]) {
      for (const perPool of [2, 3]) {
        const seeds = bracketSeedsFromPools(poolsOf(poolCount, perPool), perPool);
        const poolOf = (id: string) => id[0];

        for (const [x, y] of firstRoundPairs(seeds.length)) {
          expect(
            poolOf(seeds[x]) === poolOf(seeds[y]),
            `${poolCount} pools x${perPool}: seeds ${x + 1} and ${y + 1} ` +
              `(${seeds[x]} vs ${seeds[y]}) are pool-mates`,
          ).toBe(false);
        }
      }
    }
  });

  it('advances every qualifier exactly once', () => {
    const seeds = bracketSeedsFromPools(poolsOf(4, 3), 2);
    expect(seeds).toHaveLength(8);
    expect(new Set(seeds).size).toBe(8);
    expect(seeds.every((s) => s.endsWith('1') || s.endsWith('2'))).toBe(true);
  });

  it('tolerates a pool too short to supply its qualifiers', () => {
    const pools: PoolResult[] = [
      { label: 'A', ordered: [standing('A1', 1), standing('A2', 0.5)] },
      { label: 'B', ordered: [standing('B1', 1)] },
    ];
    expect(bracketSeedsFromPools(pools, 2)).toEqual(['A1', 'B1', 'A2']);
  });

  it('breaks equal records on point differential when ranking pool winners', () => {
    const pools: PoolResult[] = [
      { label: 'A', ordered: [standing('A1', 1, 5)] },
      { label: 'B', ordered: [standing('B1', 1, 20)] },
    ];
    expect(bracketSeedsFromPools(pools, 1)).toEqual(['B1', 'A1']);
  });
});
