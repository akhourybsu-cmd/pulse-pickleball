import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format as dateFnsFormat } from "date-fns";
import { toZonedTime } from "date-fns-tz";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
