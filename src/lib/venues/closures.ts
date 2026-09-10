import { closingTimeMinutes, parseTime, timeInputValue } from './hours';

function atTime(day: Date, value: string, closing: boolean): Date | null {
  const minutes = closing ? closingTimeMinutes(value) : parseTime(value);
  if (minutes === null || (!closing && minutes === 1440)) return null;
  const date = new Date(day);
  date.setHours(0, 0, 0, 0);
  date.setMinutes(minutes);
  // Reject wall-clock times skipped by daylight saving instead of moving them.
  if (date.getHours() * 60 + date.getMinutes() !== minutes % 1440) return null;
  return date;
}

export function defaultClosureTimes(dayStart: Date | null, dayEnd: Date | null, now: Date) {
  if (!dayStart || !dayEnd || dayEnd <= now || dayEnd <= dayStart) return null;
  const start = new Date(Math.ceil(Math.max(dayStart.getTime(), now.getTime()) / 60_000) * 60_000);
  if (start >= dayEnd) return null;
  return {
    from: timeInputValue(start.getHours() * 60 + start.getMinutes()),
    to: timeInputValue(dayEnd.getHours() * 60 + dayEnd.getMinutes()),
  };
}

export function closureWindow(dayStart: Date | null, dayEnd: Date | null, from: string, to: string, now: Date): { start: Date; end: Date; error?: never } | { error: string; start?: never; end?: never } {
  if (!dayStart || !dayEnd || dayEnd <= now) return { error: 'No opening hours remain on this date. Choose an open day in the schedule.' };
  const start = atTime(dayStart, from, false);
  const end = atTime(dayStart, to, true);
  if (!start || !end || end <= start) return { error: 'Choose valid times with the end after the start. Midnight means the end of this day.' };
  if (start < dayStart || end > dayEnd) return { error: 'Keep the closure within this day’s opening hours.' };
  if (start < now) return { error: 'The start time has passed. Choose a time still ahead.' };
  return { start, end };
}
