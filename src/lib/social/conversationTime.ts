import { format, isToday, isYesterday, isThisYear } from 'date-fns';

export function conversationTime(value: string): { short: string; full?: string; iso?: string } {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return { short: '' };
  return {
    short: isToday(date) ? format(date, 'p') : isYesterday(date) ? 'Yesterday' : isThisYear(date) ? format(date, 'MMM d') : format(date, 'MMM d, yy'),
    full: format(date, 'PPpp'), iso: date.toISOString(),
  };
}
