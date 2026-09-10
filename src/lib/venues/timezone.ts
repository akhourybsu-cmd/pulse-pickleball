import { fromZonedTime, toZonedTime } from 'date-fns-tz';

/** Calendar dates are local Date containers for year/month/day, not instants. */
export function venueCalendarNow(timeZone?: string | null, now = new Date()): Date {
  return timeZone ? toZonedTime(now, timeZone) : new Date(now);
}
export function venueWallTime(day: Date, minutes: number, timeZone?: string | null): Date {
  // Use a string so the viewer's own DST gap cannot normalize the venue's time.
  const date = new Date(day.getFullYear(), day.getMonth(), day.getDate() + Math.floor(minutes / 1440), 12);
  const minute = minutes % 1440;
  const label = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}:00`;
  return timeZone ? fromZonedTime(label, timeZone) : new Date(label);
}
export function venueCalendarBounds(day: Date, timeZone?: string | null) {
  return { from: venueWallTime(day, 0, timeZone).toISOString(), to: venueWallTime(day, 1440, timeZone).toISOString() };
}
