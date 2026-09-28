import { clubTime } from './clubPresentation';

export const EVENT_LABELS: Record<string, string> = {
  open_play: 'Open Play', clinic: 'Clinic', practice: 'Practice', round_robin: 'Round Robin',
  social: 'Social', other: 'Venue Event', league: 'League',
};

/** Use one venue-local date/time treatment across home, listings and details. */
export function eventSchedule(startValue: string | null, endValue?: string | null, timeZone?: string | null) {
  const start = new Date(startValue ?? '');
  if (!Number.isFinite(start.getTime())) return null;
  const opts = { timeZone: timeZone || undefined };
  const part = (options: Intl.DateTimeFormatOptions, date = start) => new Intl.DateTimeFormat('en-US', { ...opts, ...options }).format(date);
  const label = part({ weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const end = endValue ? new Date(endValue) : null;
  const dayKey = (date: Date) => part({ year: 'numeric', month: 'numeric', day: 'numeric' }, date);
  const zone = timeZone ? new Intl.DateTimeFormat('en-US', { ...opts, timeZoneName: 'short' }).formatToParts(start).find(p => p.type === 'timeZoneName')?.value : null;
  const endLabel = end && Number.isFinite(end.getTime())
    ? `${dayKey(start) !== dayKey(end) ? part({ weekday: 'short', month: 'short', day: 'numeric' }, end) + ', ' : ''}${clubTime(end.toISOString(), timeZone)}` : null;
  return { label, weekday: part({ weekday: 'short' }), day: part({ day: '2-digit' }), month: part({ month: 'short' }), year: part({ year: 'numeric' }),
    time: `${clubTime(startValue!, timeZone)}${endLabel ? ` – ${endLabel}` : ''}`, zone };
}
