import { describe, expect, it } from 'vitest';
import { canScoreCommandMatch, commandSchedule, type CommandMatch } from '../../src/lib/roundRobin/commandCenter';

function match(overrides: Partial<CommandMatch> = {}): CommandMatch {
  return { id: 'match', round_no: 2, court_no: 1, is_bye: false, team1_score: null, team2_score: null, team1: ['Alex', 'Sam'], team2: ['Casey', 'Drew'], ...overrides };
}

describe('organizer command center', () => {
  it('browses only saved canonical rounds in order without mutating the schedule', () => {
    const rows = [match({ id: 'later', round_no: 5 }), match(), match({ id: 'old', round_no: 3, superseded_by_schedule_id: 'later' }), match({ id: 'void', round_no: 4, voided_at: 'now' })];
    const snapshot = JSON.stringify(rows);
    const navigation = commandSchedule(rows, 2);
    expect(navigation.rounds).toEqual([2, 5]);
    expect(navigation.nextRound).toBe(5);
    expect(navigation.matches.map(row => row.id)).toEqual(['later', 'match']);
    expect(JSON.stringify(rows)).toBe(snapshot);
  });

  it('has no invented next assignment after the final saved round', () => {
    expect(commandSchedule([match()], 2).nextRound).toBeNull();
    expect(commandSchedule([], 1)).toMatchObject({ rounds: [], nextRound: null, progress: { canClose: false } });
  });

  it('counts a zero score and abandoned matches as resolved, excluding byes and history', () => {
    const rows = [match({ team1_score: 11, team2_score: 0 }), match({ id: 'abandoned', abandoned: true }), match({ id: 'rest', is_bye: true }), match({ id: 'void', voided_at: 'now' })];
    expect(commandSchedule(rows, 2).progress).toEqual({ total: 2, resolved: 2, pending: 0, canClose: true });
  });

  it('only permits a new score on a live, current, unresolved court', () => {
    expect(canScoreCommandMatch(match(), 'live', 2, false)).toBe(true);
    for (const status of ['draft', 'completed', 'voided']) expect(canScoreCommandMatch(match(), status, 2, false)).toBe(false);
    expect(canScoreCommandMatch(match(), 'live', 1, false)).toBe(false);
    expect(canScoreCommandMatch(match(), 'live', 3, false)).toBe(false);
    expect(canScoreCommandMatch(match(), 'live', 2, true)).toBe(false);
    for (const overrides of [{ abandoned: true }, { is_bye: true }, { voided_at: 'now' }, { superseded_by_schedule_id: 'new' }, { team1_score: 0 }, { team2_score: 11 }]) {
      expect(canScoreCommandMatch(match(overrides), 'live', 2, false)).toBe(false);
    }
  });
});
