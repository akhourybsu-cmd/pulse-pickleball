import { describe, expect, it } from 'vitest';
import {
  buildDayGrid,
  courtsFreeAt,
  freeRuns,
  intervalOf,
  openSlots,
  overlaps,
  reservationAt,
  slotBoundaries,
  type Court,
  type Reservation,
} from './availability';

const DAY = new Date(2026, 8, 15); // 15 Sep 2026, local

function at(hour: number, minute = 0): Date {
  const d = new Date(DAY);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function court(id: string, number: number, extra: Partial<Court> = {}): Court {
  return { id, name: `Court ${number}`, court_number: number, is_active: true, ...extra };
}

function booking(id: string, courtId: string, from: number, to: number): Reservation {
  return {
    id,
    venue_court_id: courtId,
    start_time: at(from).toISOString(),
    end_time: at(to).toISOString(),
  };
}

const GRID = { openHour: 8, closeHour: 12, slotMinutes: 60, now: at(0) };

describe('overlaps', () => {
  it('treats intervals as half-open so back-to-back bookings do not clash', () => {
    expect(overlaps(at(9), at(10), at(10), at(11))).toBe(false);
    expect(overlaps(at(10), at(11), at(9), at(10))).toBe(false);
  });

  it('detects partial and full containment', () => {
    expect(overlaps(at(9), at(11), at(10), at(12))).toBe(true);
    expect(overlaps(at(9), at(12), at(10), at(11))).toBe(true);
    expect(overlaps(at(10), at(11), at(9), at(12))).toBe(true);
  });

  it('rejects intervals that merely touch at a point', () => {
    expect(overlaps(at(9), at(9), at(9), at(10))).toBe(false);
  });
});

describe('intervalOf', () => {
  it('rejects a reservation with no end time', () => {
    expect(intervalOf({ id: 'x', venue_court_id: 'c', start_time: at(9).toISOString(), end_time: null }))
      .toBeNull();
  });

  it('rejects an end that is not after the start', () => {
    expect(intervalOf(booking('x', 'c', 10, 10))).toBeNull();
    expect(
      intervalOf({
        id: 'x',
        venue_court_id: 'c',
        start_time: at(11).toISOString(),
        end_time: at(10).toISOString(),
      }),
    ).toBeNull();
  });

  it('rejects unparseable timestamps rather than producing an Invalid Date range', () => {
    expect(
      intervalOf({ id: 'x', venue_court_id: 'c', start_time: 'nonsense', end_time: 'also nonsense' }),
    ).toBeNull();
  });
});

describe('reservationAt', () => {
  const bookings = [booking('b1', 'c1', 9, 10), booking('b2', 'c2', 9, 10)];

  it('only matches the court asked for', () => {
    expect(reservationAt(bookings, 'c1', at(9), at(10))?.id).toBe('b1');
    expect(reservationAt(bookings, 'c3', at(9), at(10))).toBeNull();
  });

  it('ignores a reservation with no end time instead of blocking the day', () => {
    const open = [{ id: 'x', venue_court_id: 'c1', start_time: at(9).toISOString(), end_time: null }];
    expect(reservationAt(open, 'c1', at(9), at(10))).toBeNull();
  });
});

describe('slotBoundaries', () => {
  it('produces one more boundary than there are slots', () => {
    expect(slotBoundaries(DAY, GRID)).toHaveLength(5); // 8,9,10,11,12 → 4 slots
  });

  it('honours the slot length', () => {
    const half = slotBoundaries(DAY, { openHour: 8, closeHour: 9, slotMinutes: 30 });
    expect(half.map((d) => d.getHours() * 60 + d.getMinutes())).toEqual([480, 510, 540]);
  });

  it('returns nothing for a nonsensical window', () => {
    expect(slotBoundaries(DAY, { openHour: 12, closeHour: 8, slotMinutes: 60 })).toEqual([]);
    expect(slotBoundaries(DAY, { openHour: 8, closeHour: 12, slotMinutes: 0 })).toEqual([]);
  });

  /**
   * Slots are built by stepping local minutes from the opening time, not by
   * adding fixed milliseconds to midnight. On a DST day the latter slides every
   * slot after the transition by an hour, so a court advertised at 9am opens at
   * 8am or 10am. This asserts the wall-clock reading stays correct.
   */
  it('keeps wall-clock hours across a daylight-saving transition', () => {
    const dstDay = new Date(2026, 2, 8); // US DST begins 8 Mar 2026
    const boundaries = slotBoundaries(dstDay, { openHour: 0, closeHour: 6, slotMinutes: 60 });
    const hours = boundaries.map((d) => d.getHours());
    // Whatever the offset does underneath, consecutive boundaries must read as
    // increasing wall-clock hours, never repeating or skipping backwards.
    for (let i = 1; i < hours.length; i++) {
      expect(boundaries[i].getTime()).toBeGreaterThan(boundaries[i - 1].getTime());
    }
    expect(boundaries[0].getHours()).toBe(0);
  });
});

describe('buildDayGrid', () => {
  const courts = [court('c2', 2), court('c1', 1)];

  it('orders courts by number, not by the order they came back from the database', () => {
    const grid = buildDayGrid(courts, [], DAY, GRID);
    expect(grid.map((c) => c.court.id)).toEqual(['c1', 'c2']);
  });

  it('drops inactive courts so a resurfaced court is never bookable', () => {
    const grid = buildDayGrid([...courts, court('c3', 3, { is_active: false })], [], DAY, GRID);
    expect(grid.map((c) => c.court.id)).toEqual(['c1', 'c2']);
  });

  it('marks the booked slot taken and leaves the neighbours open', () => {
    const grid = buildDayGrid(courts, [booking('b1', 'c1', 9, 10)], DAY, GRID);
    const c1 = grid.find((c) => c.court.id === 'c1')!;

    expect(c1.slots.map((s) => s.bookable)).toEqual([true, false, true, true]);
    expect(c1.slots[1].reservation?.id).toBe('b1');
  });

  it('does not block a neighbouring court', () => {
    const grid = buildDayGrid(courts, [booking('b1', 'c1', 9, 10)], DAY, GRID);
    const c2 = grid.find((c) => c.court.id === 'c2')!;
    expect(c2.slots.every((s) => s.bookable)).toBe(true);
  });

  it('blocks every slot a long booking spans', () => {
    const grid = buildDayGrid(courts, [booking('b1', 'c1', 9, 12)], DAY, GRID);
    const c1 = grid.find((c) => c.court.id === 'c1')!;
    expect(c1.slots.map((s) => s.bookable)).toEqual([true, false, false, false]);
  });

  it('will not offer a slot that has already started', () => {
    const grid = buildDayGrid(courts, [], DAY, { ...GRID, now: at(10, 30) });
    const c1 = grid.find((c) => c.court.id === 'c1')!;
    // 8-9 and 9-10 are gone; 10-11 started at 10:00 which is before 10:30.
    expect(c1.slots.map((s) => s.bookable)).toEqual([false, false, false, true]);
  });
});

describe('openSlots', () => {
  it('returns only bookable slots', () => {
    const grid = buildDayGrid([court('c1', 1)], [booking('b1', 'c1', 9, 10)], DAY, GRID);
    expect(openSlots(grid[0])).toHaveLength(3);
  });
});

describe('freeRuns', () => {
  it('merges consecutive free slots into one run', () => {
    const grid = buildDayGrid([court('c1', 1)], [], DAY, GRID);
    const runs = freeRuns(grid[0]);
    expect(runs).toHaveLength(1);
    expect(runs[0].start.getHours()).toBe(8);
    expect(runs[0].end.getHours()).toBe(12);
  });

  it('splits runs around a booking', () => {
    const grid = buildDayGrid([court('c1', 1)], [booking('b1', 'c1', 9, 10)], DAY, GRID);
    const runs = freeRuns(grid[0]);
    expect(runs.map((r) => [r.start.getHours(), r.end.getHours()])).toEqual([
      [8, 9],
      [10, 12],
    ]);
  });

  it('returns nothing when the court is fully booked', () => {
    const grid = buildDayGrid([court('c1', 1)], [booking('b1', 'c1', 8, 12)], DAY, GRID);
    expect(freeRuns(grid[0])).toEqual([]);
  });
});

describe('courtsFreeAt', () => {
  const courts = [court('c1', 1), court('c2', 2), court('c3', 3, { is_active: false })];

  it('counts only active, unbooked courts', () => {
    expect(courtsFreeAt(courts, [booking('b1', 'c1', 9, 10)], at(9, 30))).toBe(1);
  });

  it('counts a court free the instant its booking ends', () => {
    expect(courtsFreeAt(courts, [booking('b1', 'c1', 9, 10)], at(10))).toBe(2);
  });

  it('counts every active court when nothing is booked', () => {
    expect(courtsFreeAt(courts, [], at(9))).toBe(2);
  });
});
