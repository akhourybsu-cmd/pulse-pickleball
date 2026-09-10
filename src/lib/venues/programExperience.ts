import type { GroupEvent, GroupRsvpStatus } from '@/hooks/useGroupEvents';

export const PROGRAM_FORMATS = ['open_play', 'clinic', 'practice', 'round_robin', 'social', 'other'] as const;
export const PROGRAM_FILTERS = [
  { value: 'all', label: 'All sessions', formats: null },
  { value: 'open_play', label: 'Open play', formats: ['open_play'] },
  { value: 'clinic', label: 'Clinics', formats: ['clinic', 'practice'] },
  { value: 'round_robin', label: 'Round robin', formats: ['round_robin'] },
  { value: 'social', label: 'Social', formats: ['social', 'other'] },
] as const;

/** Fall back immediately when a new day has no sessions for the old filter. */
export function programFilterState<T extends { event_format: string; start_time: string }>(sessions: T[], requested: string) {
  const available = PROGRAM_FILTERS.filter(filter => !filter.formats || sessions.some(s => (filter.formats as readonly string[]).includes(s.event_format)));
  const active = available.find(filter => filter.value === requested) ?? PROGRAM_FILTERS[0];
  const shown = sessions.filter(s => !active.formats || (active.formats as readonly string[]).includes(s.event_format));
  return { available, active: active.value, shown: [...shown].sort((a, b) => Date.parse(a.start_time) - Date.parse(b.start_time)) };
}

export function programPhase(event: { start_time: string; end_time?: string | null }, now = new Date()): 'upcoming' | 'live' | 'ended' {
  const start = Date.parse(event.start_time);
  const end = event.end_time ? Date.parse(event.end_time) : start;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= now.getTime()) return 'ended';
  return start <= now.getTime() ? 'live' : 'upcoming';
}

export function programDateLabel(value: string, now = new Date()): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Date unavailable';
  if (date.toDateString() === now.toDateString()) return 'Today';
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/** Adjust only this viewer's count after the server confirms the final status. */
export function withConfirmedProgramRsvp(event: GroupEvent, status: GroupRsvpStatus): GroupEvent {
  const counts = { going: 0, maybe: 0, not_going: 0, waitlist: 0, ...event.rsvps };
  if (event.user_rsvp === status) return event;
  if (event.user_rsvp) counts[event.user_rsvp] = Math.max(0, counts[event.user_rsvp] - 1);
  counts[status] += 1;
  return { ...event, user_rsvp: status, rsvps: counts };
}

export function venueWebsiteLink(value: string | null): string | null {
  if (!value?.trim()) return null;
  try {
    const raw = value.trim();
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(raw) ? raw : `https://${raw}`);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
