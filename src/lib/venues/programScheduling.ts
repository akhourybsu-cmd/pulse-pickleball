import { generateOccurrenceStarts, type RecurringFrequency, type VenueEventCourt } from '@/components/community/event-wizard/types';
import { venueWallTime } from './timezone';

export function clockMinutes(time: string): number {
  if (!/^\d{2}:\d{2}$/.test(time)) return NaN;
  const [hours, minutes] = time.split(':').map(Number);
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : NaN;
}

export function endAfterDuration(start: string, minutes: number): string {
  const end = clockMinutes(start) + minutes;
  if (!Number.isInteger(minutes) || minutes <= 0 || !Number.isFinite(end) || end >= 1440) return '';
  return `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
}

export function programWindows(date: string, startTime: string, endTime: string, frequency: RecurringFrequency, count: number, timeZone?: string | null) {
  const start = clockMinutes(startTime), end = clockMinutes(endTime);
  const day = new Date(`${date}T12:00:00`);
  if (!date || Number.isNaN(day.getTime()) || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
  // Repeat calendar dates in venue wall time, including across DST changes.
  return generateOccurrenceStarts(day, frequency, count).map(day => ({
    start: venueWallTime(day, start, timeZone), end: venueWallTime(day, end, timeZone),
  }));
}

export function allocateAvailableCourts(courts: VenueEventCourt[], busy: ReadonlySet<string>, count: number, selected: string[] = []): string[] {
  const available = courts.filter(c => c.is_active !== false && !busy.has(c.id))
    .sort((a, b) => (a.court_number ?? 0) - (b.court_number ?? 0) || a.id.localeCompare(b.id));
  const preferred = selected.filter(id => available.some(c => c.id === id));
  return [...new Set([...preferred, ...available.map(c => c.id)])].slice(0, Math.max(0, count));
}
