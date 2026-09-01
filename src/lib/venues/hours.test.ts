import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CLOSE_MINUTES,
  DEFAULT_OPEN_MINUTES,
  defaultVenueHours,
  describeDay,
  formatTime,
  gridOptionsFor,
  isOpenOn,
  parseTime,
  parseVenueHours,
  serializeVenueHours,
} from './hours';

/** 2026-09-13 is a Sunday, so index 0. */
const SUNDAY = new Date(2026, 8, 13);
const MONDAY = new Date(2026, 8, 14);

describe('parseTime', () => {
  it('reads HH:MM', () => {
    expect(parseTime('06:00')).toBe(360);
    expect(parseTime('6:30')).toBe(390);
    expect(parseTime(' 22:15 ')).toBe(1335);
  });

  it('accepts 24:00 as midnight, since a venue can close at it', () => {
    expect(parseTime('24:00')).toBe(1440);
  });

  it('rejects anything that is not a real time', () => {
    for (const bad of ['', '25:00', '12:60', '24:01', 'noon', '1200', null, undefined, 6]) {
      expect(parseTime(bad)).toBeNull();
    }
  });
});

describe('formatTime', () => {
  it('pads to HH:MM', () => {
    expect(formatTime(360)).toBe('06:00');
    expect(formatTime(1335)).toBe('22:15');
  });

  it('clamps out-of-range values instead of producing nonsense', () => {
    expect(formatTime(-60)).toBe('00:00');
    expect(formatTime(99999)).toBe('24:00');
  });
});

describe('parseVenueHours', () => {
  it('falls back cleanly for anything that is not an object', () => {
    for (const raw of [null, undefined, 'hours', 42, []]) {
      const parsed = parseVenueHours(raw);
      expect(parsed.slotMinutes).toBe(60);
      expect(parsed.days.every((d) => d?.openMinutes === DEFAULT_OPEN_MINUTES)).toBe(true);
    }
  });

  it('reads a full definition', () => {
    const parsed = parseVenueHours({
      slotMinutes: 30,
      days: { '0': { open: '08:00', close: '20:00' }, '1': null },
    });
    expect(parsed.slotMinutes).toBe(30);
    expect(parsed.days[0]).toEqual({ openMinutes: 480, closeMinutes: 1200 });
    expect(parsed.days[1]).toBeNull();
    // Days that were not mentioned keep the default window.
    expect(parsed.days[2]).toEqual({
      openMinutes: DEFAULT_OPEN_MINUTES,
      closeMinutes: DEFAULT_CLOSE_MINUTES,
    });
  });

  it('only treats an explicit null as closed', () => {
    expect(parseVenueHours({ days: { '1': null } }).days[1]).toBeNull();
    expect(parseVenueHours({ days: {} }).days[1]).not.toBeNull();
  });

  /**
   * This column is free-form JSON that nothing has ever validated. Refusing
   * every booking because of a typo would be far worse than showing slightly
   * wrong hours, so a malformed day falls back rather than closing the venue.
   */
  it('falls back to the default window for a malformed day', () => {
    const parsed = parseVenueHours({
      days: {
        '0': { open: 'morning', close: '20:00' },
        '1': { open: '20:00', close: '08:00' }, // ends before it starts
        '2': { open: '10:00', close: '10:00' }, // zero length
        '3': 'open',
      },
    });
    for (const i of [0, 1, 2, 3]) {
      expect(parsed.days[i]).toEqual({
        openMinutes: DEFAULT_OPEN_MINUTES,
        closeMinutes: DEFAULT_CLOSE_MINUTES,
      });
    }
  });

  it('rejects a slot length that is not one of the offered choices', () => {
    expect(parseVenueHours({ slotMinutes: 37 }).slotMinutes).toBe(60);
    expect(parseVenueHours({ slotMinutes: 0 }).slotMinutes).toBe(60);
    expect(parseVenueHours({ slotMinutes: '30' }).slotMinutes).toBe(30);
  });

  it('round-trips through serialize', () => {
    const hours = parseVenueHours({
      slotMinutes: 90,
      days: { '0': { open: '07:30', close: '23:00' }, '3': null },
    });
    expect(parseVenueHours(serializeVenueHours(hours))).toEqual(hours);
  });
});

describe('gridOptionsFor', () => {
  it('uses the hours for that weekday', () => {
    const hours = parseVenueHours({
      slotMinutes: 30,
      days: { '0': { open: '08:00', close: '20:00' } },
    });
    expect(gridOptionsFor(hours, SUNDAY)).toMatchObject({
      openHour: 8,
      closeHour: 20,
      slotMinutes: 30,
    });
  });

  it('returns null on a day the venue is closed', () => {
    const hours = parseVenueHours({ days: { '1': null } });
    expect(gridOptionsFor(hours, MONDAY)).toBeNull();
    expect(gridOptionsFor(hours, SUNDAY)).not.toBeNull();
  });

  /**
   * The grid works in whole hours. Widening outward keeps the half hour
   * visible; rounding inward would silently delete sellable time.
   */
  it('widens a part-hour window outward to whole hours', () => {
    const hours = parseVenueHours({ days: { '0': { open: '07:30', close: '21:30' } } });
    expect(gridOptionsFor(hours, SUNDAY)).toMatchObject({ openHour: 7, closeHour: 22 });
  });

  it('passes a supplied clock through, so past slots can be excluded', () => {
    const now = new Date(2026, 8, 13, 10, 0, 0);
    expect(gridOptionsFor(defaultVenueHours(), SUNDAY, now)?.now).toBe(now);
  });
});

describe('isOpenOn', () => {
  it('reports the venue closed only on days set to null', () => {
    const hours = parseVenueHours({ days: { '1': null } });
    expect(isOpenOn(hours, MONDAY)).toBe(false);
    expect(isOpenOn(hours, SUNDAY)).toBe(true);
  });
});

describe('describeDay', () => {
  it('says Closed for a null day', () => {
    expect(describeDay(null)).toBe('Closed');
  });

  it('renders a range for an open day', () => {
    const text = describeDay({ openMinutes: 360, closeMinutes: 1320 });
    expect(text).toContain('–');
    expect(text).not.toBe('Closed');
  });
});
