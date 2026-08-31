import { describe, it, expect } from 'vitest';
import {
  generateDoubleElimination,
  routeWinner,
  routeLoser,
  losersRoundSize,
  losersRoundCount,
  winnersRoundSize,
  type BracketSide,
} from './doubleElimination';

const teams = (n: number) => Array.from({ length: n }, (_, i) => `t${i + 1}`);

describe('double elimination — shape', () => {
  it('sizes the losers bracket as 2(n-1) rounds', () => {
    expect(losersRoundCount(2)).toBe(2); // 4-team
    expect(losersRoundCount(3)).toBe(4); // 8-team
    expect(losersRoundCount(4)).toBe(6); // 16-team
  });

  it('alternates minor (halving) and major (absorbing) losers rounds', () => {
    // 8-team: LB1=2, LB2=2, LB3=1, LB4=1
    expect(losersRoundSize(8, 1)).toBe(2);
    expect(losersRoundSize(8, 2)).toBe(2);
    expect(losersRoundSize(8, 3)).toBe(1);
    expect(losersRoundSize(8, 4)).toBe(1);
  });

  it('produces 2N-2 matches for a full draw', () => {
    for (const n of [4, 8, 16]) {
      const draw = generateDoubleElimination(teams(n));
      expect(draw.matches).toHaveLength(2 * n - 2);
    }
  });

  it('creates exactly one grand final', () => {
    const draw = generateDoubleElimination(teams(8));
    expect(draw.matches.filter((m) => m.bracket === 'grand_final')).toHaveLength(1);
  });

  it('seeds the winners bracket 1vN like single elimination', () => {
    const draw = generateDoubleElimination(teams(8));
    const wb1 = draw.matches
      .filter((m) => m.bracket === 'winners' && m.round === 1)
      .sort((a, b) => a.matchNumber - b.matchNumber);
    expect(wb1.map((m) => [m.teamA, m.teamB])).toEqual([
      ['t1', 't8'],
      ['t4', 't5'],
      ['t2', 't7'],
      ['t3', 't6'],
    ]);
  });
});

describe('double elimination — routing', () => {
  it('sends winners-bracket round-1 losers into losers round 1 in pairs', () => {
    expect(routeLoser(8, 'winners', 1, 1)).toEqual({ bracket: 'losers', round: 1, matchNumber: 1, side: 'A' });
    expect(routeLoser(8, 'winners', 1, 2)).toEqual({ bracket: 'losers', round: 1, matchNumber: 1, side: 'B' });
    expect(routeLoser(8, 'winners', 1, 3)).toEqual({ bracket: 'losers', round: 1, matchNumber: 2, side: 'A' });
  });

  it('drops later winners-bracket losers into the waiting major round', () => {
    // WB R2 losers -> LB round 2 (major), same index, side B
    expect(routeLoser(8, 'winners', 2, 1)).toEqual({ bracket: 'losers', round: 2, matchNumber: 1, side: 'B' });
    expect(routeLoser(8, 'winners', 2, 2)).toEqual({ bracket: 'losers', round: 2, matchNumber: 2, side: 'B' });
    // WB final loser -> LB round 4, side B
    expect(routeLoser(8, 'winners', 3, 1)).toEqual({ bracket: 'losers', round: 4, matchNumber: 1, side: 'B' });
  });

  it('eliminates losers-bracket losers (no onward route)', () => {
    expect(routeLoser(8, 'losers', 1, 1)).toBeNull();
    expect(routeLoser(8, 'grand_final', 1, 1)).toBeNull();
  });

  it('moves minor-round winners across without halving, major-round winners with halving', () => {
    // LB1 (minor) -> LB2 same index, side A
    expect(routeWinner(8, 'losers', 1, 2)).toEqual({ bracket: 'losers', round: 2, matchNumber: 2, side: 'A' });
    // LB2 (major) -> LB3 halved
    expect(routeWinner(8, 'losers', 2, 1)).toEqual({ bracket: 'losers', round: 3, matchNumber: 1, side: 'A' });
    expect(routeWinner(8, 'losers', 2, 2)).toEqual({ bracket: 'losers', round: 3, matchNumber: 1, side: 'B' });
  });

  it('feeds both champions into the grand final on opposite sides', () => {
    expect(routeWinner(8, 'winners', 3, 1)).toEqual({ bracket: 'grand_final', round: 1, matchNumber: 1, side: 'A' });
    expect(routeWinner(8, 'losers', 4, 1)).toEqual({ bracket: 'grand_final', round: 1, matchNumber: 1, side: 'B' });
  });

  it('ends at the grand final', () => {
    expect(routeWinner(8, 'grand_final', 1, 1)).toBeNull();
  });
});

/**
 * The real proof: play a whole tournament and check the invariants that define
 * double elimination — nobody leaves before two losses, and the champion has at
 * most one.
 */
function simulate(teamCount: number, favouredWins = true) {
  const draw = generateDoubleElimination(teams(teamCount));
  const slots = new Map(
    draw.matches.map((m) => [`${m.bracket}:${m.round}:${m.matchNumber}`, { ...m }]),
  );
  const losses = new Map<string, number>();

  const put = (d: ReturnType<typeof routeWinner>, team: string) => {
    if (!d) return;
    const s = slots.get(`${d.bracket}:${d.round}:${d.matchNumber}`);
    if (!s) return;
    if (d.side === 'A') s.teamA = team;
    else s.teamB = team;
  };

  // Deterministic play order: winners bracket round by round, interleaved with
  // the losers rounds that become playable.
  const order: { bracket: BracketSide; round: number }[] = [];
  for (let r = 1; r <= draw.winnersRounds; r++) {
    order.push({ bracket: 'winners', round: r });
    if (r === 1) {
      if (draw.losersRounds >= 1) order.push({ bracket: 'losers', round: 1 });
    } else {
      const major = 2 * (r - 1);
      if (major <= draw.losersRounds) order.push({ bracket: 'losers', round: major });
      if (major + 1 <= draw.losersRounds) order.push({ bracket: 'losers', round: major + 1 });
    }
  }
  order.push({ bracket: 'grand_final', round: 1 });

  for (const step of order) {
    const inRound = [...slots.values()].filter(
      (s) => s.bracket === step.bracket && s.round === step.round,
    );
    for (const s of inRound) {
      const a = s.teamA;
      const b = s.teamB;
      if (!a && !b) continue;
      if (a && !b) {
        put(routeWinner(draw.bracketSize, s.bracket, s.round, s.matchNumber), a);
        continue;
      }
      if (!a && b) {
        put(routeWinner(draw.bracketSize, s.bracket, s.round, s.matchNumber), b);
        continue;
      }
      const num = (t: string) => Number(t.slice(1));
      const winner = favouredWins
        ? (num(a!) < num(b!) ? a! : b!)
        : (num(a!) > num(b!) ? a! : b!);
      const loser = winner === a ? b! : a!;
      losses.set(loser, (losses.get(loser) ?? 0) + 1);
      put(routeWinner(draw.bracketSize, s.bracket, s.round, s.matchNumber), winner);
      const drop = routeLoser(draw.bracketSize, s.bracket, s.round, s.matchNumber);
      if (drop) put(drop, loser);
    }
  }

  const gf = slots.get('grand_final:1:1')!;
  // The grand final has been played by the loop above, so its winner is the
  // champion and its loser has just picked up their second loss.
  const num = (t: string) => Number(t.slice(1));
  const champion =
    gf.teamA && gf.teamB
      ? favouredWins
        ? (num(gf.teamA) < num(gf.teamB) ? gf.teamA : gf.teamB)
        : (num(gf.teamA) > num(gf.teamB) ? gf.teamA : gf.teamB)
      : (gf.teamA ?? gf.teamB);
  return { draw, slots, losses, gf, champion };
}

describe('double elimination — full simulation', () => {
  it('fills the grand final from both brackets (8 teams)', () => {
    const { gf } = simulate(8);
    expect(gf.teamA).toBeTruthy();
    expect(gf.teamB).toBeTruthy();
    expect(gf.teamA).not.toBe(gf.teamB);
  });

  it('top seed reaches the grand final when the favourite always wins', () => {
    const { gf } = simulate(8);
    expect([gf.teamA, gf.teamB]).toContain('t1');
  });

  it('nobody is eliminated with fewer than two losses', () => {
    for (const n of [4, 8, 16]) {
      const { draw, losses, champion } = simulate(n);
      for (const t of teams(n)) {
        if (t === champion) {
          // The champion survives on at most one loss.
          expect(losses.get(t) ?? 0).toBeLessThanOrEqual(1);
        } else {
          // Everyone else is out, which in double elimination means exactly two.
          expect(losses.get(t) ?? 0).toBe(2);
        }
      }
      expect(draw.matches).toHaveLength(2 * n - 2);
    }
  });

  it('accounts for every loss — one per match played', () => {
    for (const n of [4, 8, 16]) {
      const { losses } = simulate(n);
      const total = [...losses.values()].reduce((a, b) => a + b, 0);
      expect(total).toBe(2 * n - 2);
    }
  });

  it('holds when the underdog always wins too', () => {
    const { losses, champion } = simulate(8, false);
    expect(champion).toBeTruthy();
    for (const t of teams(8)) {
      if (t !== champion) expect(losses.get(t)).toBe(2);
    }
  });
});
