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
 */
export function formatDateEST(date: Date | string, formatStr: string = "MMM d, yyyy"): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const estDate = toZonedTime(dateObj, 'America/New_York');
  return dateFnsFormat(estDate, formatStr);
}

/**
 * Format a date to locale string in EST
 */
export function toLocaleDateStringEST(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const estDate = toZonedTime(dateObj, 'America/New_York');
  return dateFnsFormat(estDate, "MM/dd/yyyy");
}
