import { describe, expect, it } from 'vitest';
import {
  generateOccurrenceStarts,
  suggestedPlayersPerCourt,
} from './types';

describe('venue event defaults', () => {
  it('suggests capacity from the pickleball program format', () => {
    expect(suggestedPlayersPerCourt('open_play')).toBe(8);
    expect(suggestedPlayersPerCourt('clinic')).toBe(6);
    expect(suggestedPlayersPerCourt('round_robin')).toBe(4);
  });

  it('keeps each recurring occurrence on the requested cadence', () => {
    const first = new Date('2026-09-01T18:00:00');
    const starts = generateOccurrenceStarts(first, 'weekly', 4);

    expect(starts).toHaveLength(4);
    expect(starts.map((date) => date.getDate())).toEqual([1, 8, 15, 22]);
    expect(starts.every((date) => date.getHours() === 18)).toBe(true);
  });
});
