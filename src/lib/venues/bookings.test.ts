import { describe, expect, it } from 'vitest';
import {
  formatDayLabel,
  groupByDay,
  mergeBookings,
  splitBookings,
  type BookingSource,
} from './bookings';

const DAY = new Date(2026, 8, 15);

function at(hour: number, minute = 0, dayOffset = 0): Date {
  const d = new Date(DAY);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function source(
  id: string,
  from: number,
  to: number | null,
  extra: Partial<BookingSource> = {},
): BookingSource {
  return {
    id,
    group_id: 'g1',
    title: `Session ${id}`,
    event_format: 'reservation',
    start_time: at(from).toISOString(),
    end_time: to === null ? null : at(to).toISOString(),
    ...extra,
  };
}

describe('mergeBookings', () => {
  it('keeps both a held court and a signed-up session', () => {
    const merged = mergeBookings([source('a', 9, 10)], [source('b', 11, 12)]);
    expect(merged).toHaveLength(2);
    expect(merged.find((e) => e.id === 'a')!.kind).toBe('reservation');
    expect(merged.find((e) => e.id === 'b')!.kind).toBe('signup');
  });

  /**
   * Creating a session usually also signs you up for it, so the same event
   * arrives down both paths. Without deduping it appears twice on the list.
   */
  it('shows an event once when it arrives as both a reservation and a sign-up', () => {
    const merged = mergeBookings([source('a', 9, 10)], [source('a', 9, 10)]);
    expect(merged).toHaveLength(1);
    // The reservation wins: it is the stronger relationship and what the
    // player thinks they did.
    expect(merged[0].kind).toBe('reservation');
  });

  it('carries the RSVP status on a sign-up and leaves it null on a reservation', () => {
    const merged = mergeBookings(
      [source('a', 9, 10)],
      [source('b', 11, 12, { rsvp_status: 'waitlist' })],
    );
    expect(merged.find((e) => e.id === 'b')!.rsvpStatus).toBe('waitlist');
    expect(merged.find((e) => e.id === 'a')!.rsvpStatus).toBeNull();
  });

  it('defaults a sign-up with no status to going', () => {
    expect(mergeBookings([], [source('b', 9, 10)])[0].rsvpStatus).toBe('going');
  });

  it('falls back to a readable title rather than showing an empty row', () => {
    const merged = mergeBookings([source('a', 9, 10, { title: '   ' })], []);
    expect(merged[0].title).toBe('Court booking');
  });

  it('drops rows whose start cannot be parsed', () => {
    const bad: BookingSource = { ...source('x', 9, 10), start_time: 'nonsense' };
    expect(mergeBookings([bad], [])).toEqual([]);
  });

  it('treats an unparseable end as no end rather than an invalid date', () => {
    const bad: BookingSource = { ...source('x', 9, 10), end_time: 'nonsense' };
    expect(mergeBookings([bad], [])[0].end).toBeNull();
  });
});

describe('splitBookings', () => {
  const entries = mergeBookings(
    [source('past', 8, 9), source('soon', 14, 15), source('later', 16, 17)],
    [],
  );

  it('puts finished sessions in history and future ones in upcoming', () => {
    const { upcoming, past } = splitBookings(entries, at(12));
    expect(upcoming.map((e) => e.id)).toEqual(['soon', 'later']);
    expect(past.map((e) => e.id)).toEqual(['past']);
  });

  /**
   * Someone mid-game should still see the session on their list, not find it
   * has silently moved to history while they are standing on the court.
   */
  it('keeps a session upcoming while it is still running', () => {
    const { upcoming } = splitBookings(entries, at(14, 30));
    expect(upcoming.map((e) => e.id)).toEqual(['soon', 'later']);
  });

  it('moves a session to history the moment it ends', () => {
    const { upcoming, past } = splitBookings(entries, at(15));
    expect(upcoming.map((e) => e.id)).toEqual(['later']);
    expect(past.map((e) => e.id)).toContain('soon');
  });

  it('falls back to the start time when a session has no end', () => {
    const open = mergeBookings([source('open', 14, null)], []);
    expect(splitBookings(open, at(14, 30)).past.map((e) => e.id)).toEqual(['open']);
    expect(splitBookings(open, at(13)).upcoming.map((e) => e.id)).toEqual(['open']);
  });

  it('reads upcoming soonest-first and history most-recent-first', () => {
    const many = mergeBookings(
      [source('p1', 8, 9), source('p2', 10, 11), source('u1', 14, 15), source('u2', 16, 17)],
      [],
    );
    const { upcoming, past } = splitBookings(many, at(12));
    expect(upcoming.map((e) => e.id)).toEqual(['u1', 'u2']);
    expect(past.map((e) => e.id)).toEqual(['p2', 'p1']);
  });

  it('handles an empty list', () => {
    expect(splitBookings([], at(12))).toEqual({ upcoming: [], past: [] });
  });
});

describe('groupByDay', () => {
  it('buckets consecutive entries that share a calendar day', () => {
    const entries = mergeBookings(
      [
        { ...source('a', 9, 10) },
        { ...source('b', 14, 15) },
        {
          ...source('c', 9, 10),
          start_time: at(9, 0, 1).toISOString(),
          end_time: at(10, 0, 1).toISOString(),
        },
      ],
      [],
    );
    const groups = groupByDay(splitBookings(entries, at(0)).upcoming);

    expect(groups).toHaveLength(2);
    expect(groups[0].entries.map((e) => e.id)).toEqual(['a', 'b']);
    expect(groups[1].entries.map((e) => e.id)).toEqual(['c']);
  });

  it('returns nothing for an empty list', () => {
    expect(groupByDay([])).toEqual([]);
  });
});

describe('formatDayLabel', () => {
  it('names the days people name', () => {
    const today = new Date(DAY);
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    expect(formatDayLabel(today, today)).toBe('Today');
    expect(formatDayLabel(tomorrow, today)).toBe('Tomorrow');
    expect(formatDayLabel(yesterday, today)).toBe('Yesterday');
  });

  it('dates anything further out', () => {
    const today = new Date(DAY);
    today.setHours(0, 0, 0, 0);
    const later = new Date(today);
    later.setDate(later.getDate() + 5);
    expect(formatDayLabel(later, today)).not.toMatch(/Today|Tomorrow/);
  });
});
