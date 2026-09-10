import { closingTimeMinutes, parseTime, timeInputValue } from './hours';
import { venueCalendarNow, venueWallTime } from './timezone';

function atTime(day: Date, value: string, closing: boolean, timeZone?: string | null): Date | null {
  const minutes = closing ? closingTimeMinutes(value) : parseTime(value);
  if (minutes === null || (!closing && minutes === 1440)) return null;
  const date = venueWallTime(venueCalendarNow(timeZone, day), minutes, timeZone);
  const local = venueCalendarNow(timeZone, date);
  // Reject wall-clock times skipped by daylight saving instead of moving them.
  if (local.getHours() * 60 + local.getMinutes() !== minutes % 1440) return null;
  return date;
}

export function defaultClosureTimes(dayStart: Date | null, dayEnd: Date | null, now: Date, timeZone?: string | null) {
  if (!dayStart || !dayEnd || dayEnd <= now || dayEnd <= dayStart) return null;
  const start = new Date(Math.ceil(Math.max(dayStart.getTime(), now.getTime()) / 60_000) * 60_000);
  if (start >= dayEnd) return null;
  const localStart = venueCalendarNow(timeZone, start);
  const localEnd = venueCalendarNow(timeZone, dayEnd);
  return {
    from: timeInputValue(localStart.getHours() * 60 + localStart.getMinutes()),
    to: timeInputValue(localEnd.getHours() * 60 + localEnd.getMinutes()),
  };
}

export function closureWindow(dayStart: Date | null, dayEnd: Date | null, from: string, to: string, now: Date, timeZone?: string | null): { start: Date; end: Date; error?: never } | { error: string; start?: never; end?: never } {
  if (!dayStart || !dayEnd || dayEnd <= now) return { error: 'No opening hours remain on this date. Choose an open day in the schedule.' };
  const start = atTime(dayStart, from, false, timeZone);
  const end = atTime(dayStart, to, true, timeZone);
  if (!start || !end || end <= start) return { error: 'Choose valid times with the end after the start. Midnight means the end of this day.' };
  if (start < dayStart || end > dayEnd) return { error: 'Keep the closure within this day’s opening hours.' };
  if (start < now) return { error: 'The start time has passed. Choose a time still ahead.' };
  return { start, end };
}
