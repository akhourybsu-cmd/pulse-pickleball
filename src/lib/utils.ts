import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format as dateFnsFormat } from "date-fns";
import { toZonedTime, formatInTimeZone } from "date-fns-tz";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Returns today's date as YYYY-MM-DD anchored in America/New_York
 * (Eastern Time — DST-aware, so it swings between EST and EDT correctly).
 * Using a TZ-aware formatter avoids `toISOString()` shifting the date
 * backwards for users whose local clock is past UTC midnight.
 */
export function todayInEasternTime(): string {
  return formatInTimeZone(new Date(), "America/New_York", "yyyy-MM-dd");
}

/** @deprecated Use `todayInEasternTime` — the helper is DST-aware, not fixed EST. */
export const todayInEST = todayInEasternTime;

/**
 * Parse a YYYY-MM-DD string into a `Date` at local noon, so calendar
 * components and date-fns helpers don't shift the day across the UTC
 * boundary.
 */
export function parseDateLocal(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

/**
 * Format a local `Date` as YYYY-MM-DD without timezone conversion.
 */
export function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Format a time string (HH:mm) to 12-hour format with AM/PM
 */
export function formatTime12Hour(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
}

/**
 * Format a date in EST timezone
 * For date-only strings (YYYY-MM-DD), parse them as local dates to avoid timezone shift
 */
export function formatDateEST(date: Date | string, formatStr: string = "MMM d, yyyy"): string {
  if (typeof date === 'string') {
    // If it's a date string without time (YYYY-MM-DD), parse it as local date
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const [year, month, day] = date.split('-').map(Number);
      const localDate = new Date(year, month - 1, day);
      return dateFnsFormat(localDate, formatStr);
    }
    // Otherwise, convert to EST timezone
    const estDate = toZonedTime(new Date(date), 'America/New_York');
    return dateFnsFormat(estDate, formatStr);
  }
  const estDate = toZonedTime(date, 'America/New_York');
  return dateFnsFormat(estDate, formatStr);
}

/**
 * Format a date to locale string in EST
 * For date-only strings (YYYY-MM-DD), parse them as local dates to avoid timezone shift
 */
export function toLocaleDateStringEST(date: Date | string): string {
  if (typeof date === 'string') {
    // If it's a date string without time (YYYY-MM-DD), parse it as local date
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const [year, month, day] = date.split('-').map(Number);
      const localDate = new Date(year, month - 1, day);
      return dateFnsFormat(localDate, "MM/dd/yyyy");
    }
    // Otherwise, convert to EST timezone
    const estDate = toZonedTime(new Date(date), 'America/New_York');
    return dateFnsFormat(estDate, "MM/dd/yyyy");
  }
  const estDate = toZonedTime(date, 'America/New_York');
  return dateFnsFormat(estDate, "MM/dd/yyyy");
}
