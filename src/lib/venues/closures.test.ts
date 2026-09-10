import { describe, expect, it } from 'vitest';
import { closureWindow, defaultClosureTimes } from './closures';
import { closingTimeMinutes, defaultVenueHours, parseVenueHours, serializeVenueHours, timeInputValue, validateVenueHours, venueOperatingBounds } from './hours';

const at = (hour: number, minute = 0) => new Date(2026, 8, 15, hour, minute);

describe('venue closing times', () => {
  it('round-trips midnight through a valid native time input', () => {
    expect(timeInputValue(1440)).toBe('00:00');
    expect(closingTimeMinutes('00:00')).toBe(1440);
    const hours = defaultVenueHours();
    hours.days[2] = { openMinutes: 450, closeMinutes: closingTimeMinutes('00:00')! };
    expect(parseVenueHours(serializeVenueHours(hours))).toEqual(hours);
    expect(venueOperatingBounds(hours, at(0))).toEqual({ start: at(7, 30), end: at(24) });
  });
  it('supports a fully closed week without inventing hours', () => {
    const hours = { slotMinutes: 60, days: Array(7).fill(null) };
    expect(validateVenueHours(hours)).toBeNull();
    expect(venueOperatingBounds(hours, at(0))).toBeNull();
  });
  it('rejects a window too short for even one block', () => {
    const hours = defaultVenueHours();
    hours.days[2] = { openMinutes: 450, closeMinutes: 480 };
    expect(validateVenueHours(hours)).toContain('Tue');
    hours.slotMinutes = 30;
    expect(validateVenueHours(hours)).toBeNull();
  });
  it.each([NaN, 1500, -2])('rejects invalid closing minute %s', closeMinutes => {
    const hours = defaultVenueHours(); hours.days[2] = { openMinutes: 450, closeMinutes };
    expect(validateVenueHours(hours)).not.toBeNull();
  });
});

describe('court closure windows', () => {
  it('preserves a future fractional opening time instead of rounding before opening', () => {
    expect(defaultClosureTimes(at(7, 30), at(24), at(0))).toEqual({ from: '07:30', to: '00:00' });
  });
  it('rounds a current start forward to the next minute', () => {
    const now = at(9, 15); now.setSeconds(20);
    expect(defaultClosureTimes(at(7, 30), at(22), now)).toEqual({ from: '09:16', to: '22:00' });
  });
  it('allows closing until midnight at the end of the viewed day', () => {
    expect(closureWindow(at(7, 30), at(24), '21:00', '00:00', at(8))).toEqual({ start: at(21), end: at(24) });
  });
  it.each([['07:00', '09:00'], ['22:00', '23:00'], ['21:00', '00:00']])('rejects %s–%s outside opening hours', (from, to) => {
    expect(closureWindow(at(7, 30), at(22), from, to, at(0)).error).toContain('opening hours');
  });
  it.each([['24:20', '24:59'], ['12:60', '15:00'], ['12:00', '11:00'], ['', '15:00']])('rejects invalid/reversed %s–%s', (from, to) => {
    expect(closureWindow(at(7, 30), at(24), from, to, at(0)).error).toBeTruthy();
  });
  it('rejects past starts even when the original draft was valid', () => {
    expect(closureWindow(at(7, 30), at(22), '09:00', '10:00', at(9, 1)).error).toContain('passed');
  });
  it('does not create an unusable default after closing or on a closed day', () => {
    expect(defaultClosureTimes(at(7), at(22), at(23))).toBeNull();
    expect(defaultClosureTimes(null, null, at(9))).toBeNull();
    expect(closureWindow(null, null, '09:00', '10:00', at(0)).error).toBeTruthy();
  });
});
