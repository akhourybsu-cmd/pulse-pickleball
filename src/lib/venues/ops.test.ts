import { describe, expect, it } from 'vitest';
import { buildDayGrid, type Court } from './availability';
import {
  courtStatuses,
  daySummary,
  formatDuration,
  isBlock,
  isProgramming,
  isReservationSession,
  upcomingGaps,
  utilization,
  type OpsSession,
} from './ops';

const DAY = new Date(2026, 8, 15);

function at(hour: number, minute = 0): Date {
  const d = new Date(DAY);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function court(id: string, n: number, extra: Partial<Court> = {}): Court {
  return { id, name: `Court ${n}`, court_number: n, is_active: true, ...extra };
}

function session(
  id: string,
  courtId: string,
  from: number,
  to: number,
  format = 'reservation',
  title = 'Doubles',
): OpsSession {
  return {
    id,
    venue_court_id: courtId,
    start_time: at(from).toISOString(),
    end_time: at(to).toISOString(),
    event_format: format,
    title,
  };
}

const GRID = { openHour: 8, closeHour: 12, slotMinutes: 60, now: at(0) };

describe('session classification', () => {
  it('separates the three surfaces a venue has', () => {
    const res = { event_format: 'reservation' };
    const block = { event_format: 'maintenance' };
    const play = { event_format: 'open_play' };

    expect(isReservationSession(res)).toBe(true);
    expect(isBlock(block)).toBe(true);
    expect(isProgramming(play)).toBe(true);

    // A closure must never be advertised as something to join.
    expect(isProgramming(block)).toBe(false);
    // Nor must a private court hold.
    expect(isProgramming(res)).toBe(false);
  });
});

describe('courtStatuses', () => {
  const courts = [court('c2', 2), court('c1', 1)];

  it('orders courts by number regardless of input order', () => {
    expect(courtStatuses(courts, [], at(9)).map((s) => s.court.id)).toEqual(['c1', 'c2']);
  });

  it('reports a court with a live session as in play', () => {
    const [c1] = courtStatuses(courts, [session('s1', 'c1', 9, 10)], at(9, 30));
    expect(c1.state).toBe('in_play');
    expect(c1.current?.id).toBe('s1');
    expect(c1.minutesLeft).toBe(30);
  });

  it('reports progress through the current session', () => {
    const [c1] = courtStatuses(courts, [session('s1', 'c1', 9, 10)], at(9, 45));
    expect(c1.progress).toBeCloseTo(0.75, 5);
  });

  it('frees the court the instant a session ends', () => {
    const [c1] = courtStatuses(courts, [session('s1', 'c1', 9, 10)], at(10));
    expect(c1.state).toBe('open');
    expect(c1.current).toBeNull();
    expect(c1.minutesLeft).toBeNull();
  });

  it('surfaces what is next and how long until it starts', () => {
    const [c1] = courtStatuses(courts, [session('s1', 'c1', 11, 12)], at(10, 30));
    expect(c1.state).toBe('open');
    expect(c1.next?.id).toBe('s1');
    expect(c1.minutesUntilNext).toBe(30);
  });

  it('treats a maintenance block as closed, not in play', () => {
    const [c1] = courtStatuses(courts, [session('s1', 'c1', 9, 10, 'maintenance', 'Resurfacing')], at(9, 30));
    expect(c1.state).toBe('closed');
    expect(c1.current?.title).toBe('Resurfacing');
  });

  /**
   * The one place ops deliberately shows more than the player view: a manager
   * has to see that a court is out of service, where a booking grid should
   * simply not offer it.
   */
  it('reports an inactive court rather than hiding it', () => {
    const statuses = courtStatuses([court('c3', 3, { is_active: false })], [], at(9));
    expect(statuses).toHaveLength(1);
    expect(statuses[0].state).toBe('closed');
  });

  it('ignores sessions with no end time instead of pinning a court in play', () => {
    const open: OpsSession = {
      id: 'x',
      venue_court_id: 'c1',
      start_time: at(8).toISOString(),
      end_time: null,
    };
    const [c1] = courtStatuses(courts, [open], at(9));
    expect(c1.state).toBe('open');
  });

  it('picks the session actually running when a court has several', () => {
    const sessions = [session('a', 'c1', 8, 9), session('b', 'c1', 9, 10), session('c', 'c1', 11, 12)];
    const [c1] = courtStatuses(courts, sessions, at(9, 15));
    expect(c1.current?.id).toBe('b');
    expect(c1.next?.id).toBe('c');
  });
});

describe('utilization', () => {
  it('is zero for an empty day', () => {
    const grid = buildDayGrid([court('c1', 1)], [], DAY, GRID);
    expect(utilization(grid)).toMatchObject({ booked: 0, total: 4, percent: 0 });
  });

  it('counts occupied slots across every court', () => {
    const grid = buildDayGrid(
      [court('c1', 1), court('c2', 2)],
      [session('a', 'c1', 8, 10)],
      DAY,
      GRID,
    );
    // 2 of 8 court-slots.
    expect(utilization(grid)).toMatchObject({ booked: 2, total: 8, percent: 25 });
  });

  /**
   * A morning nobody booked is exactly what this number should surface. If past
   * slots were excluded from capacity, an empty morning would silently improve
   * the figure as the day went on.
   */
  it('still counts past slots as capacity', () => {
    const grid = buildDayGrid([court('c1', 1)], [], DAY, { ...GRID, now: at(11) });
    expect(utilization(grid).total).toBe(4);
    expect(utilization(grid).percent).toBe(0);
  });

  it('does not divide by zero when there are no courts', () => {
    expect(utilization([])).toMatchObject({ booked: 0, total: 0, percent: 0 });
  });
});

describe('upcomingGaps', () => {
  it('finds sellable time and sorts longest first', () => {
    const grid = buildDayGrid(
      [court('c1', 1), court('c2', 2)],
      [session('a', 'c2', 8, 11)],
      DAY,
      { ...GRID, now: at(0) },
    );
    const gaps = upcomingGaps(grid, at(0), 60);

    expect(gaps[0].court.id).toBe('c1');
    expect(gaps[0].minutes).toBe(240);
    expect(gaps[1].court.id).toBe('c2');
    expect(gaps[1].minutes).toBe(60);
  });

  it('excludes time already gone — it cannot be sold', () => {
    const grid = buildDayGrid([court('c1', 1)], [], DAY, { ...GRID, now: at(10) });
    const gaps = upcomingGaps(grid, at(10), 30);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].minutes).toBe(120); // 10-12 only
  });

  it('splits a run around a booking', () => {
    const grid = buildDayGrid([court('c1', 1)], [session('a', 'c1', 9, 10)], DAY, GRID);
    const gaps = upcomingGaps(grid, at(0), 30);
    expect(gaps.map((g) => g.minutes).sort((a, b) => a - b)).toEqual([60, 120]);
  });

  it('honours the minimum length so unsellable slivers are not reported', () => {
    const grid = buildDayGrid([court('c1', 1)], [session('a', 'c1', 9, 12)], DAY, GRID);
    expect(upcomingGaps(grid, at(0), 120)).toEqual([]);
    expect(upcomingGaps(grid, at(0), 60)).toHaveLength(1);
  });
});

describe('daySummary', () => {
  it('counts live, open and closed courts together with the day total', () => {
    const courts = [court('c1', 1), court('c2', 2), court('c3', 3, { is_active: false })];
    const sessions = [session('a', 'c1', 9, 10)];
    const grid = buildDayGrid(courts, sessions, DAY, GRID);
    const statuses = courtStatuses(courts, sessions, at(9, 30));
    const summary = daySummary(grid, statuses, at(9, 30));

    expect(summary.inPlay).toBe(1);
    expect(summary.open).toBe(1);
    expect(summary.closed).toBe(1);
    // c3 is inactive so buildDayGrid drops it: 2 courts x 4 slots, 1 booked.
    expect(summary.utilization.total).toBe(8);
    expect(summary.utilization.booked).toBe(1);
  });
});

describe('formatDuration', () => {
  it('reads naturally at every scale', () => {
    expect(formatDuration(45)).toBe('45m');
    expect(formatDuration(60)).toBe('1h');
    expect(formatDuration(90)).toBe('1h 30m');
    expect(formatDuration(240)).toBe('4h');
    expect(formatDuration(0)).toBe('0m');
  });
});
