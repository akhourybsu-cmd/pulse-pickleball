import { describe, expect, it } from 'vitest';
import { venueCalendarBounds, venueCalendarNow, venueWallTime } from '../../src/lib/venues/timezone';
import { buildDayGrid, formatSlotTime, slotBoundaries } from '../../src/lib/venues/availability';
import { defaultVenueHours, venueOperatingBounds } from '../../src/lib/venues/hours';
import { closureWindow, defaultClosureTimes } from '../../src/lib/venues/closures';

describe('venue payment and calendar time alignment', () => {
  it('uses venue opening time regardless of the viewer time zone', () => {
    const day = new Date(2026, 8, 12, 12);
    expect(venueWallTime(day, 9 * 60, 'America/New_York').toISOString()).toBe('2026-09-12T13:00:00.000Z');
    expect(venueWallTime(day, 9 * 60, 'America/Los_Angeles').toISOString()).toBe('2026-09-12T16:00:00.000Z');
    expect(venueWallTime(day, 9 * 60, 'Asia/Kolkata').toISOString()).toBe('2026-09-12T03:30:00.000Z');
  });
  it('queries 23/25 hour venue days across daylight saving changes', () => {
    for (const [month, date, hours] of [[2, 8, 23], [10, 1, 25]]) {
      const bounds = venueCalendarBounds(new Date(2026, month, date, 12), 'America/New_York');
      expect((Date.parse(bounds.to) - Date.parse(bounds.from)) / 3600000).toBe(hours);
    }
  });
  it('does not create duplicate, reversed or zero-length boundaries at a DST transition', () => {
    for (const [month, date] of [[2, 8], [10, 1]]) {
      const boundaries = slotBoundaries(new Date(2026, month, date, 12), { openHour: 0, closeHour: 5, slotMinutes: 30, timeZone: 'America/New_York' });
      expect(boundaries.length).toBeGreaterThan(5);
      for (let index = 1; index < boundaries.length; index++) expect(boundaries[index].getTime()).toBeGreaterThan(boundaries[index - 1].getTime());
    }
  });
  it('marks a paid booking occupied at the venue hour rather than the viewer hour', () => {
    const grid = buildDayGrid([{ id: 'court-a', name: 'Court 1', court_number: 1, is_active: true }], [{ id: 'paid', venue_court_id: 'court-a', start_time: '2026-09-12T13:00:00Z', end_time: '2026-09-12T14:00:00Z' }], new Date(2026, 8, 12, 12), { openHour: 9, closeHour: 11, slotMinutes: 60, timeZone: 'America/New_York', now: new Date('2026-09-01T00:00:00Z') });
    expect(grid[0].slots[0].reservation?.id).toBe('paid');
    expect(grid[0].slots[0].bookable).toBe(false);
    expect(grid[0].slots[1].bookable).toBe(true);
    expect(formatSlotTime(grid[0].slots[0].start, 'America/New_York')).toMatch(/9:00/);
  });
  it('keeps staff operating bounds and the venue Today label aligned', () => {
    const bounds = venueOperatingBounds(defaultVenueHours(), new Date(2026, 8, 12, 12), 'America/New_York');
    expect(bounds?.start.toISOString()).toBe('2026-09-12T10:00:00.000Z');
    const today = venueCalendarNow('America/Los_Angeles', new Date('2026-09-12T02:00:00Z'));
    expect(today.getDate()).toBe(11);
    expect(today.getHours()).toBe(19);
  });
  it('uses the same venue clock for staff closures, including midnight', () => {
    const dayStart = new Date('2026-09-12T10:00:00Z');
    const dayEnd = new Date('2026-09-13T04:00:00Z');
    const now = new Date('2026-09-01T00:00:00Z');
    expect(defaultClosureTimes(dayStart, dayEnd, now, 'America/New_York')).toEqual({ from: '06:00', to: '00:00' });
    const result = closureWindow(dayStart, dayEnd, '23:00', '00:00', now, 'America/New_York');
    expect(result.error).toBeUndefined();
    expect(result.start?.toISOString()).toBe('2026-09-13T03:00:00.000Z');
    expect(result.end?.toISOString()).toBe('2026-09-13T04:00:00.000Z');
  });
});
