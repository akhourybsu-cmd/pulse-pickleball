import { describe, it, expect } from 'vitest';
import { bracketSizeFor, seedOrder, byeCountFor } from './seeding';
import { generateSingleElimination, nextSlot } from './singleElimination';

const teams = (n: number) => Array.from({ length: n }, (_, i) => `t${i + 1}`);

describe('seeding', () => {
  it('rounds up to the next power of two', () => {
    expect(bracketSizeFor(2)).toBe(2);
    expect(bracketSizeFor(5)).toBe(8);
    expect(bracketSizeFor(8)).toBe(8);
    expect(bracketSizeFor(9)).toBe(16);
  });

  it('produces the standard fold order', () => {
    expect(seedOrder(2)).toEqual([1, 2]);
    expect(seedOrder(4)).toEqual([1, 4, 2, 3]);
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });

  it('pairs 1-vs-N, not 1-vs-2 (the bug in the old generator)', () => {
    const order = seedOrder(8);
    const firstMatch = [order[0], order[1]];
    expect(firstMatch).toEqual([1, 8]);
    // 1 and 2 must be in opposite halves so they can only meet in the final.
    expect(order.indexOf(1)).toBeLessThan(4);
    expect(order.indexOf(2)).toBeGreaterThanOrEqual(4);
  });

  it('keeps every seed exactly once', () => {
    const order = seedOrder(16);
    expect(new Set(order).size).toBe(16);
    expect([...order].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 16 }, (_, i) => i + 1),
    );
  });

  it('counts byes', () => {
    expect(byeCountFor(8)).toBe(0);
    expect(byeCountFor(5)).toBe(3);
  });
});

describe('single elimination — power-of-two draw', () => {
  const draw = generateSingleElimination(teams(8));

  it('creates every round, not just round one', () => {
    expect(draw.rounds).toBe(3);
    const byRound = (r: number) => draw.matches.filter((m) => m.round === r);
    expect(byRound(1)).toHaveLength(4);
    expect(byRound(2)).toHaveLength(2);
    expect(byRound(3)).toHaveLength(1);
  });

  it('seeds round one as 1v8, 4v5, 2v7, 3v6', () => {
    const r1 = draw.matches.filter((m) => m.round === 1).sort((a, b) => a.matchNumber - b.matchNumber);
    expect(r1.map((m) => [m.teamA, m.teamB])).toEqual([
      ['t1', 't8'],
      ['t4', 't5'],
      ['t2', 't7'],
      ['t3', 't6'],
    ]);
  });

  it('leaves later rounds empty until winners advance', () => {
    const later = draw.matches.filter((m) => m.round > 1);
    expect(later.every((m) => m.teamA === null && m.teamB === null)).toBe(true);
  });

  it('includes every team exactly once in round one', () => {
    const present = draw.matches
      .filter((m) => m.round === 1)
      .flatMap((m) => [m.teamA, m.teamB]);
    expect(new Set(present).size).toBe(8);
  });
});

describe('single elimination — byes', () => {
  it('does NOT drop bye teams (the old generator silently lost them)', () => {
    const draw = generateSingleElimination(teams(5));
    const everyone = draw.matches.flatMap((m) => [m.teamA, m.teamB]).filter(Boolean);
    // All 5 teams must appear somewhere in the draw.
    for (const t of teams(5)) expect(everyone).toContain(t);
  });

  it('gives byes to the top seeds and places them in round two', () => {
    const draw = generateSingleElimination(teams(5));
    expect(draw.bracketSize).toBe(8);
    expect(draw.byes).toBe(3);

    // With 5 teams, seeds 6/7/8 are empty, so seeds 1, 2 and 3 get byes.
    const r1 = draw.matches.filter((m) => m.round === 1);
    const r1Teams = r1.flatMap((m) => [m.teamA, m.teamB]);
    expect(r1Teams).not.toContain('t1');
    expect(r1Teams).not.toContain('t2');
    expect(r1Teams).not.toContain('t3');

    // …and they're already sitting in their round-two slots.
    const r2Teams = draw.matches.filter((m) => m.round === 2).flatMap((m) => [m.teamA, m.teamB]);
    expect(r2Teams).toContain('t1');
    expect(r2Teams).toContain('t2');
    expect(r2Teams).toContain('t3');
  });

  it('never emits a match with an empty side in round one', () => {
    for (const n of [3, 5, 6, 7, 9, 11, 13]) {
      const draw = generateSingleElimination(teams(n));
      const r1 = draw.matches.filter((m) => m.round === 1);
      expect(r1.every((m) => m.teamA !== null && m.teamB !== null)).toBe(true);
    }
  });

  it('produces a playable draw for every size from 2..32', () => {
    for (let n = 2; n <= 32; n++) {
      const draw = generateSingleElimination(teams(n));
      const everyone = draw.matches.flatMap((m) => [m.teamA, m.teamB]).filter(Boolean);
      // every team present, none duplicated
      expect(new Set(everyone).size).toBe(n);
      // exactly one final
      expect(draw.matches.filter((m) => m.round === draw.rounds)).toHaveLength(1);
    }
  });
});

describe('advancement', () => {
  it('feeds winners into ceil(m/2), odd->A and even->B', () => {
    expect(nextSlot(1, 1, 3)).toEqual({ round: 2, matchNumber: 1, side: 'A' });
    expect(nextSlot(1, 2, 3)).toEqual({ round: 2, matchNumber: 1, side: 'B' });
    expect(nextSlot(1, 3, 3)).toEqual({ round: 2, matchNumber: 2, side: 'A' });
    expect(nextSlot(2, 2, 3)).toEqual({ round: 3, matchNumber: 1, side: 'B' });
  });

  it('returns null for the final', () => {
    expect(nextSlot(3, 1, 3)).toBeNull();
  });

  it('routes an 8-team draw down to a single champion', () => {
    const draw = generateSingleElimination(teams(8));
    // Simulate: lower-numbered team always wins.
    const slots = new Map<string, { teamA: string | null; teamB: string | null }>();
    for (const m of draw.matches) slots.set(`${m.round}:${m.matchNumber}`, { teamA: m.teamA, teamB: m.teamB });

    for (let r = 1; r <= draw.rounds; r++) {
      const inRound = draw.matches.filter((m) => m.round === r);
      for (const m of inRound) {
        const cur = slots.get(`${r}:${m.matchNumber}`)!;
        const winner = [cur.teamA, cur.teamB]
          .filter(Boolean)
          .sort((a, b) => Number(a!.slice(1)) - Number(b!.slice(1)))[0]!;
        const target = nextSlot(r, m.matchNumber, draw.rounds);
        if (target) {
          const next = slots.get(`${target.round}:${target.matchNumber}`)!;
          if (target.side === 'A') next.teamA = winner;
          else next.teamB = winner;
        } else {
          expect(winner).toBe('t1');
        }
      }
    }

    const final = slots.get(`${draw.rounds}:1`)!;
    // Seed 1 vs seed 2 in the final is the signature of correct seeding.
    expect([final.teamA, final.teamB].sort()).toEqual(['t1', 't2']);
  });
});
