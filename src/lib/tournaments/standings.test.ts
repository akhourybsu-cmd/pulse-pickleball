import { describe, expect, it } from 'vitest';
import { computeStandings, type StandingsMatch, type StandingsTeam } from './standings';

function team(id: string, pool?: string): StandingsTeam {
  return { id, team_name: id.toUpperCase(), pool };
}

function played(a: string, b: string, sa: number, sb: number): StandingsMatch {
  return { team1_id: a, team2_id: b, team1_score: sa, team2_score: sb, status: 'completed' };
}

describe('computeStandings', () => {
  it('counts wins, losses and points from both sides of a match', () => {
    const s = computeStandings([team('a'), team('b')], [played('a', 'b', 11, 6)]);
    const a = s.find((x) => x.teamId === 'a')!;
    const b = s.find((x) => x.teamId === 'b')!;

    expect(a).toMatchObject({ wins: 1, losses: 0, pointsFor: 11, pointsAgainst: 6, pointDiff: 5 });
    expect(b).toMatchObject({ wins: 0, losses: 1, pointsFor: 6, pointsAgainst: 11, pointDiff: -5 });
    expect(a.rank).toBe(1);
  });

  it('ignores matches that are not completed or have no score', () => {
    const matches: StandingsMatch[] = [
      { team1_id: 'a', team2_id: 'b', team1_score: null, team2_score: null, status: 'scheduled' },
      { team1_id: 'a', team2_id: 'b', team1_score: 11, team2_score: 4, status: 'in_progress' },
    ];
    const s = computeStandings([team('a'), team('b')], matches);
    expect(s.every((x) => x.played === 0)).toBe(true);
  });

  it('ranks on win percentage, not raw wins, so uneven pools are fair', () => {
    // `a` wins 2 of 2; `b` wins 3 of 5. More wins, worse team.
    const matches = [
      played('a', 'x', 11, 3),
      played('a', 'y', 11, 4),
      played('b', 'x', 11, 9),
      played('b', 'y', 11, 9),
      played('b', 'z', 11, 9),
      played('x', 'b', 11, 9),
      played('y', 'b', 11, 9),
    ];
    const s = computeStandings(
      [team('a'), team('b'), team('x'), team('y'), team('z')],
      matches,
    );
    expect(s[0].teamId).toBe('a');
    expect(s.find((x) => x.teamId === 'b')!.wins).toBe(3);
    expect(s.find((x) => x.teamId === 'a')!.wins).toBe(2);
  });

  it('breaks a two-way tie on head-to-head, over point differential', () => {
    // Both finish 2-1. `b` has a far better differential, but `c` beat `b`.
    const matches = [
      played('b', 'x', 11, 2),
      played('b', 'y', 11, 1),
      played('c', 'b', 11, 9),
      played('c', 'x', 11, 9),
      played('y', 'c', 11, 9),
    ];
    const s = computeStandings([team('b'), team('c'), team('x'), team('y')], matches);
    const b = s.find((x) => x.teamId === 'b')!;
    const c = s.find((x) => x.teamId === 'c')!;

    expect(b.wins).toBe(c.wins);
    expect(b.pointDiff).toBeGreaterThan(c.pointDiff);
    expect(c.rank).toBeLessThan(b.rank);
    expect(c.tiebreak).toBe('Head-to-head');
  });

  /**
   * The bug the old comparator had. A beats B, B beats C, C beats A: head-to-head
   * cannot order these three, so feeding it to Array.sort gives an answer that
   * depends on comparison order. The result must be decided by point
   * differential instead, and must not depend on input order.
   */
  it('resolves a non-transitive three-way tie deterministically', () => {
    const teams = [team('a'), team('b'), team('c')];
    const matches = [
      played('a', 'b', 11, 5), // a +6
      played('b', 'c', 11, 7), // b +4
      played('c', 'a', 11, 9), // c +2
    ];

    const forward = computeStandings(teams, matches).map((s) => s.teamId);
    const reversed = computeStandings([...teams].reverse(), matches).map((s) => s.teamId);
    const shuffled = computeStandings([teams[1], teams[2], teams[0]], matches).map((s) => s.teamId);

    expect(forward).toEqual(['a', 'b', 'c']);
    expect(reversed).toEqual(forward);
    expect(shuffled).toEqual(forward);
  });

  it('re-applies head-to-head once a three-way tie collapses to two', () => {
    // a, b, c are all 1-1 in a cycle, so record among the tied teams says
    // nothing. Point differential among them is b +2, c +2, a -4 — which
    // separates `a` but leaves b and c level. Those two are then re-judged on
    // their own meeting rather than on the three-way numbers.
    const matches = [
      played('a', 'b', 11, 9), // a +2
      played('b', 'c', 11, 7), // b +4
      played('c', 'a', 11, 5), // c +6
    ];
    const s = computeStandings([team('a'), team('b'), team('c')], matches);

    expect(s.map((x) => x.teamId)).toEqual(['b', 'c', 'a']);
    expect(s[0].tiebreak).toBe('Head-to-head');
    expect(s[2].tiebreak).toBe('Point diff vs tied teams');
  });

  it('falls back to a stable name order when teams are truly identical', () => {
    const s = computeStandings([team('zeta'), team('alpha')], []);
    expect(s.map((x) => x.teamId)).toEqual(['alpha', 'zeta']);
    expect(computeStandings([team('alpha'), team('zeta')], []).map((x) => x.teamId)).toEqual([
      'alpha',
      'zeta',
    ]);
  });

  it('does not award a win for an equal score', () => {
    const s = computeStandings([team('a'), team('b')], [played('a', 'b', 11, 11)]);
    expect(s.every((x) => x.wins === 0 && x.losses === 0)).toBe(true);
    expect(s.every((x) => x.played === 1)).toBe(true);
  });

  it('marks no tiebreak when record alone decides', () => {
    const s = computeStandings([team('a'), team('b')], [played('a', 'b', 11, 6)]);
    expect(s[0].tiebreak).toBeUndefined();
    expect(s[1].tiebreak).toBeUndefined();
  });
});
