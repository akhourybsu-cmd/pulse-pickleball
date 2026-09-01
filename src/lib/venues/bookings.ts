/**
 * A player's own bookings.
 *
 * Two different things belong on this list and players do not distinguish
 * between them: a court you HELD (a reservation you created) and a session you
 * SIGNED UP for (an RSVP to open play, a clinic). Both are "I am playing at
 * this time", and a My Bookings screen that shows only one of them is the
 * reason people end up double-booking themselves.
 *
 * Merging them has one trap, handled here: creating a session usually also
 * signs you up for it, so the same event arrives down both paths and would
 * appear twice.
 */

export type BookingKind = 'reservation' | 'signup';

export interface BookingSource {
  id: string;
  group_id: string;
  title: string | null;
  event_format: string | null;
  start_time: string;
  end_time: string | null;
  venue_name?: string | null;
  court_name?: string | null;
  /** RSVP status, when this arrived via a sign-up. */
  rsvp_status?: string | null;
}

export interface BookingEntry {
  id: string;
  groupId: string;
  kind: BookingKind;
  title: string;
  start: Date;
  end: Date | null;
  format: string;
  venueName: string | null;
  courtName: string | null;
  /** 'going' | 'waitlist' for sign-ups; null for reservations you hold. */
  rsvpStatus: string | null;
}

function toEntry(source: BookingSource, kind: BookingKind): BookingEntry | null {
  const start = new Date(source.start_time);
  if (Number.isNaN(start.getTime())) return null;

  const end = source.end_time ? new Date(source.end_time) : null;

  return {
    id: source.id,
    groupId: source.group_id,
    kind,
    title: source.title?.trim() || (kind === 'reservation' ? 'Court booking' : 'Session'),
    start,
    end: end && !Number.isNaN(end.getTime()) ? end : null,
    format: source.event_format ?? 'other',
    venueName: source.venue_name ?? null,
    courtName: source.court_name ?? null,
    rsvpStatus: kind === 'signup' ? (source.rsvp_status ?? 'going') : null,
  };
}

/**
 * Merge the two sources into one list.
 *
 * A court you hold outranks a sign-up to the same event: it is the stronger
 * relationship (you can cancel it outright) and it is what the player thinks
 * they did.
 */
export function mergeBookings(
  reservations: BookingSource[],
  signups: BookingSource[],
): BookingEntry[] {
  const byId = new Map<string, BookingEntry>();

  for (const s of signups) {
    const entry = toEntry(s, 'signup');
    if (entry) byId.set(entry.id, entry);
  }

  // Reservations second so they overwrite a sign-up to the same event.
  for (const r of reservations) {
    const entry = toEntry(r, 'reservation');
    if (entry) byId.set(entry.id, entry);
  }

  return [...byId.values()];
}

/**
 * Split into what's ahead and what's done.
 *
 * A session counts as upcoming until it ENDS, not until it starts — someone
 * mid-game should still see it on their list, not find it has silently moved
 * to history while they're on court. A session with no end time falls back to
 * its start.
 *
 * Upcoming reads soonest-first, because the next thing you're doing is the
 * thing you care about. History reads most-recent-first, for the same reason
 * in the other direction.
 */
export function splitBookings(
  entries: BookingEntry[],
  now: Date = new Date(),
): { upcoming: BookingEntry[]; past: BookingEntry[] } {
  const upcoming: BookingEntry[] = [];
  const past: BookingEntry[] = [];

  for (const entry of entries) {
    const finish = entry.end ?? entry.start;
    if (finish > now) upcoming.push(entry);
    else past.push(entry);
  }

  upcoming.sort((a, b) => a.start.getTime() - b.start.getTime());
  past.sort((a, b) => b.start.getTime() - a.start.getTime());

  return { upcoming, past };
}

/** Calendar-day buckets, in list order, for date headers. */
export function groupByDay(entries: BookingEntry[]): Array<{ day: Date; entries: BookingEntry[] }> {
  const groups: Array<{ day: Date; entries: BookingEntry[] }> = [];

  for (const entry of entries) {
    const day = new Date(entry.start);
    day.setHours(0, 0, 0, 0);

    const last = groups[groups.length - 1];
    if (last && last.day.getTime() === day.getTime()) {
      last.entries.push(entry);
    } else {
      groups.push({ day, entries: [entry] });
    }
  }

  return groups;
}

/** "Today" / "Tomorrow" / "Sat, Sep 12" — how people actually refer to a day. */
export function formatDayLabel(day: Date, now: Date = new Date()): string {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const diffDays = Math.round((day.getTime() - today.getTime()) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';

  return day.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(day.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}),
  });
}
