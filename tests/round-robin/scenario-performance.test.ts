import { mkdirSync, writeFileSync } from 'node:fs';
import { afterAll, expect, it } from 'vitest';
import { planScheduleAdjustment } from '../../src/lib/roundRobin/scheduleAdjustment';
import { seatsOf } from '../../src/lib/roundRobin/scheduleCore';

// Run alone for timings: RR_BENCHMARK_REPORT=.qa-cache/rr-after.json npx vitest run tests/round-robin/scenario-performance.test.ts
// These are local CPU timings, not browser/network/service latency measurements.
const measurements: Record<string, unknown>[] = [];
const cases = [
  [4, 1, 4, 'open'], [5, 4, 7, 'open'], [18, 4, 6, 'open'],
  [22, 5, 6, 'open'], [32, 8, 20, 'open'], [81, 16, 12, 'open'],
  [10, 2, 6, 'mixed'], [18, 4, 6, 'mixed'], [32, 8, 20, 'mixed'],
  [40, 10, 12, 'mixed'], [64, 16, 12, 'mixed'],
  [6, 8, 2, 'open'], [7, 1, 3, 'open'], [9, 2, 5, 'open'],
  [13, 3, 7, 'open'], [17, 1, 8, 'open'], [12, 3, 11, 'open'],
  [24, 6, 5, 'male'], [24, 6, 5, 'female'], [12, 8, 3, 'mixed'],
  [128, 16, 8, 'open'],
] as const;

it.each(cases)('%i players / %i courts / %i games / %s: valid, deterministic, timed schedules', (count, courts, games, format) => {
  const seats = Array.from({ length: count }, (_, i) => `p:${i}`);
  const genders = new Map(seats.map((s, i) => [s, format === 'male' || format === 'female' ? format : i % 2 ? 'female' : 'male']));
  const samples: number[] = [];
  let repeats = 0;
  for (let seed = 0; seed < 3; seed++) {
    const input = { seed: `scenario-${seed}`, currentMatches: [], currentSeatIds: seats, nextSeatIds: seats,
      currentTotalRounds: 1, firstMutableRound: 1, numCourts: courts, gamesPerPlayer: games,
      equalGames: true, format, genders };
    const start = performance.now();
    const plan = planScheduleAdjustment(input);
    samples.push(performance.now() - start);
    expect(plan.ok, JSON.stringify(plan.warnings)).toBe(true);
    expect(plan.fairness.gameRange.spread).toBe(0);
    expect(plan.fairness.duplicateSeatAssignments).toBe(0);
    expect(plan.fairness.underfilledMatches).toBe(0);
    expect(plan.fairness.unaccountedSeatRounds).toBe(0);
    expect(plan.fairness.playersBelowTarget).toBe(0);
    for (const round of new Set(plan.schedule.map(m => m.round_no))) {
      const matches = plan.schedule.filter(m => m.round_no === round);
      const assigned = matches.flatMap(seatsOf);
      expect(new Set(assigned).size).toBe(count);
      expect(assigned).toHaveLength(count);
      expect(matches.filter(m => !m.is_bye).length).toBeLessThanOrEqual(courts);
      if (format === 'mixed') for (const m of matches.filter(m => !m.is_bye)) {
        expect(genders.get(m.a1!)).not.toBe(genders.get(m.a2!));
        expect(genders.get(m.b1!)).not.toBe(genders.get(m.b2!));
      }
    }
    repeats = Math.max(repeats, plan.fairness.partnerRepeatMax);
    if (seed === 0) expect(planScheduleAdjustment(input).schedule).toEqual(plan.schedule);
  }
  samples.sort((a,b) => a-b);
  const row = { players: count, courts, games, format, samples: 3, medianMs: +samples[1].toFixed(2), maxMs: +samples[2].toFixed(2), partnerRepeatMax: repeats };
  measurements.push(row);
  console.info('RR_BENCHMARK', JSON.stringify(row));
}, 120_000);

afterAll(() => {
  if (process.env.RR_BENCHMARK_REPORT) {
    mkdirSync('.qa-cache', { recursive: true });
    writeFileSync(process.env.RR_BENCHMARK_REPORT, JSON.stringify({ environment: 'Local Node / deterministic isolated planner, three seeds per case', measurements }, null, 2));
  }
});
