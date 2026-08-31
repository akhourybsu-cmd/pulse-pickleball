import { describe, it, expect } from 'vitest';
import { generateRoundRobin, roundRobinMatchCount } from './roundRobin';

const teams = (n: number) => Array.from({ length: n }, (_, i) => `t${i + 1}`);
const pairKey = (a: string, b: string) => [a, b].sort().join('|');

describe('round robin', () => {
  it('is empty below two teams', () => {
    expect(generateRoundRobin([]).matches).toHaveLength(0);
    expect(generateRoundRobin(['t1']).matches).toHaveLength(0);
  });

  it('schedules n-1 rounds for an even count', () => {
    const s = generateRoundRobin(teams(6));
    expect(s.rounds).toBe(5);
    expect(s.hasByes).toBe(false);
  });

  it('every pair meets exactly once', () => {
    for (const n of [2, 3, 4, 5, 6, 7, 8, 9, 12]) {
      const s = generateRoundRobin(teams(n));
      const seen = s.matches.map((m) => pairKey(m.teamA!, m.teamB!));
      expect(new Set(seen).size).toBe(seen.length); // no repeats
      expect(seen).toHaveLength(roundRobinMatchCount(n)); // n choose 2
    }
  });

  it('no team plays twice in the same round — the check the fork deleted', () => {
    for (const n of [4, 5, 6, 7, 8, 9, 11]) {
      const s = generateRoundRobin(teams(n));
      for (let r = 1; r <= s.rounds; r++) {
        const inRound = s.matches.filter((m) => m.round === r);
        const players = inRound.flatMap((m) => [m.teamA, m.teamB]);
        expect(new Set(players).size).toBe(players.length);
      }
    }
  });

  it('handles odd counts by sitting exactly one team out per round', () => {
    const n = 7;
    const s = generateRoundRobin(teams(n));
    expect(s.hasByes).toBe(true);
    expect(s.rounds).toBe(7);
    for (let r = 1; r <= s.rounds; r++) {
      const inRound = s.matches.filter((m) => m.round === r);
      expect(inRound).toHaveLength(3); // (7-1)/2 — one team rests
    }
  });

  it('gives every team the same number of matches', () => {
    for (const n of [4, 5, 6, 8]) {
      const s = generateRoundRobin(teams(n));
      const counts = new Map<string, number>();
      for (const m of s.matches) {
        counts.set(m.teamA!, (counts.get(m.teamA!) ?? 0) + 1);
        counts.set(m.teamB!, (counts.get(m.teamB!) ?? 0) + 1);
      }
      expect([...counts.values()].every((c) => c === n - 1)).toBe(true);
    }
  });

  it('never leaves an empty side', () => {
    const s = generateRoundRobin(teams(9));
    expect(s.matches.every((m) => m.teamA && m.teamB)).toBe(true);
  });

  it('alternates sides so one team is not always team 1', () => {
    const s = generateRoundRobin(teams(4));
    const asA = s.matches.filter((m) => m.teamA === 't1').length;
    const asB = s.matches.filter((m) => m.teamB === 't1').length;
    expect(asA).toBeGreaterThan(0);
    expect(asB).toBeGreaterThan(0);
  });
});
