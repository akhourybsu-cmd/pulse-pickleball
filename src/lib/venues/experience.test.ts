import { describe, expect, it } from 'vitest';
import { availableBookingEnd, bookingDurationOptions, canUseVenueCourtSelection, isBookingRangeValid, isConfirmedVenueRsvp, venueDayOverlapFilter } from './experience';
import { buildDayGrid, slotBoundaries, type Court, type Reservation } from './availability';
import { gridOptionsFor, parseVenueHours } from './hours';

const day = new Date(2026, 8, 14);
const at = (hour: number, minutes = 0) => new Date(2026, 8, 14, hour, minutes);
const courts: Court[] = [{ id: 'court-1', name: 'Court 1', court_number: 1 }];
const occupied: Reservation = { id: 'booking-1', venue_court_id: 'court-1', start_time: at(10).toISOString(), end_time: at(11).toISOString() };
const grid = buildDayGrid(courts, [occupied], day, { openHour: 8, closeHour: 14, slotMinutes: 30, now: at(7) });

describe('venue booking safeguards', () => {
  it('requires confirmed availability before publishing a program', () => {
    expect(canUseVenueCourtSelection(['court-1'], new Set(), false)).toBe(false);
    expect(canUseVenueCourtSelection(['court-1'], new Set(), true)).toBe(true);
    expect(canUseVenueCourtSelection([], new Set(), true)).toBe(false);
    expect(canUseVenueCourtSelection(['court-1', 'court-2'], new Set(['court-2']), true)).toBe(false);
  });
  it('confirms only real server RSVP responses, never an empty or failed response', () => {
    for (const status of ['going', 'maybe', 'not_going', 'waitlist']) expect(isConfirmedVenueRsvp(status)).toBe(true);
    for (const status of [undefined, null, '', 'error', { error: 'failed' }]) expect(isConfirmedVenueRsvp(status)).toBe(false);
  });
  it('stops a booking at the next reservation, including an exact boundary', () => {
    const end = availableBookingEnd(grid, 'court-1', at(9));
    expect(end).toEqual(at(10));
    expect(isBookingRangeValid(at(9), 60, end, at(7))).toBe(true);
    expect(isBookingRangeValid(at(9), 90, end, at(7))).toBe(false);
  });
  it('uses closing time when the rest of the day is free', () => {
    expect(availableBookingEnd(grid, 'court-1', at(11))).toEqual(at(14));
  });
  it('rejects an occupied, missing, invalid or past selection', () => {
    expect(availableBookingEnd(grid, 'court-1', at(10))).toBeNull();
    expect(availableBookingEnd(grid, 'other-court', at(9))).toBeNull();
    expect(availableBookingEnd(grid, 'court-1', null)).toBeNull();
    expect(availableBookingEnd(grid, 'court-1', new Date(NaN))).toBeNull();
    expect(availableBookingEnd(buildDayGrid(courts, [], day, { openHour: 8, closeHour: 14, slotMinutes: 30, now: at(10) }), 'court-1', at(9))).toBeNull();
  });
  it('does not bridge gaps or allow inactive courts', () => {
    const brokenGrid = [{ ...grid[0], slots: grid[0].slots.filter(s => s.start.getTime() !== at(9).getTime()) }];
    expect(availableBookingEnd(brokenGrid, 'court-1', at(8))).toEqual(at(9));
    const inactive = buildDayGrid([{ ...courts[0], is_active: false }], [], day);
    expect(availableBookingEnd(inactive, 'court-1', at(9))).toBeNull();
  });
  it('includes custom slot durations without forcing choices past availability', () => {
    expect(bookingDurationOptions(45, 90)).toEqual([30, 45, 60, 90]);
    expect(bookingDurationOptions(60, 20)).toEqual([]);
    expect(bookingDurationOptions(60, 60)).toEqual([30, 60]);
    expect(bookingDurationOptions(60, 0)).toEqual([]);
  });
  it('rejects invalid ranges and rechecks the clock at submission', () => {
    for (const minutes of [0, -30, NaN, Infinity, 90]) expect(isBookingRangeValid(at(9), minutes, at(10), at(7))).toBe(false);
    expect(isBookingRangeValid(at(9), 30, null, at(7))).toBe(false);
    expect(isBookingRangeValid(at(9), 30, at(10), at(9, 1))).toBe(false);
    expect(isBookingRangeValid(new Date(NaN), 30, at(10), at(7))).toBe(false);
    expect(isBookingRangeValid(at(9), 30, new Date(NaN), at(7))).toBe(false);
  });
  it('honors saved minute-precision hours end to end', () => {
    const hours = parseVenueHours({ slotMinutes: 30, days: { '1': { open: '07:30', close: '21:30' } } });
    const options = gridOptionsFor(hours, day, at(6))!;
    const boundaries = slotBoundaries(day, options);
    expect(boundaries[0]).toEqual(at(7, 30));
    expect(boundaries.at(-1)).toEqual(at(21, 30));
    const exactGrid = buildDayGrid(courts, [], day, options);
    expect(availableBookingEnd(exactGrid, 'court-1', at(21))).toEqual(at(21, 30));
    expect(isBookingRangeValid(at(21), 60, at(21, 30), at(6))).toBe(false);
  });
  it('does not extend non-divisible slots beyond closing', () => {
    const boundaries = slotBoundaries(day, { openHour: 7.5, closeHour: 9.25, slotMinutes: 45 });
    expect(boundaries[0]).toEqual(at(7, 30));
    expect(boundaries.at(-1)).toEqual(at(9));
  });
  it('fetches overlapping overnight events as well as same-day events without an end', () => {
    const from = day.toISOString();
    expect(venueDayOverlapFilter(from)).toBe(`end_time.gt.${from},and(end_time.is.null,start_time.gte.${from})`);
    const overnight = { ...occupied, start_time: new Date(2026, 8, 13, 23).toISOString(), end_time: at(8, 30).toISOString() };
    expect(buildDayGrid(courts, [overnight], day, { openHour: 8, closeHour: 10, slotMinutes: 30, now: at(7) })[0].slots.map(s => s.bookable)).toEqual([false, true, true, true]);
  });
});
