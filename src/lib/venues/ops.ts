import { intervalOf, overlaps, type Court, type CourtColumn, type Reservation } from './availability';

/**
 * Venue operations.
 *
 * The metrics here are chosen to be ACTIONABLE. A dashboard that reports
 * "142 bookings this month" tells a manager nothing they can do anything
 * about at 5pm on a Tuesday. What they need, standing behind a desk or walking
 * the courts with a phone, is: which courts are live, when each frees up, where
 * the holes are, and how full the day actually is.
 *
 * Pure functions over plain data, so the same numbers can be shown on the ops
 * board, in a summary strip, or later in a report, without three
 * implementations that drift apart.
 */

export type CourtState = 'in_play' | 'open' | 'closed';

export interface OpsSession extends Reservation {
  title?: string | null;
  event_format?: string | null;
}

export interface CourtStatus {
  court: Court;
  state: CourtState;
  /** What's on the court right now. */
  current: OpsSession | null;
  /** The next thing scheduled after `now`. */
  next: OpsSession | null;
  /** 0..1 through the current session; 0 when nothing is on. */
  progress: number;
  /** Whole minutes until the current session ends. Null when the court is free. */
  minutesLeft: number | null;
  /** Whole minutes until the next session starts. Null when nothing is next. */
  minutesUntilNext: number | null;
}

export function isBlock(s: { event_format?: string | null }): boolean {
  return s.event_format === 'maintenance';
}

export function isReservationSession(s: { event_format?: string | null }): boolean {
  return s.event_format === 'reservation';
}

/** Programming is anything people can actually join. */
export function isProgramming(s: { event_format?: string | null }): boolean {
  return !isBlock(s) && !isReservationSession(s);
}

function minutesBetween(from: Date, to: Date): number {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 60000));
}

/**
 * Live state of every court.
 *
 * Inactive courts are reported as `closed` rather than dropped: a manager needs
 * to see that Court 4 is out, whereas a player booking a slot does not. This is
 * the one place the ops view deliberately shows more than the player view.
 */
export function courtStatuses(
  courts: Court[],
  sessions: OpsSession[],
  now: Date,
): CourtStatus[] {
  const ordered = courts.slice().sort((a, b) => {
    const an = a.court_number ?? Number.MAX_SAFE_INTEGER;
    const bn = b.court_number ?? Number.MAX_SAFE_INTEGER;
    if (an !== bn) return an - bn;
    return (a.name ?? '').localeCompare(b.name ?? '');
  });

  return ordered.map((court) => {
    const onCourt = sessions
      .filter((s) => s.venue_court_id === court.id)
      .map((s) => ({ session: s, interval: intervalOf(s) }))
      .filter((x): x is { session: OpsSession; interval: { start: Date; end: Date } } => !!x.interval)
      .sort((a, b) => a.interval.start.getTime() - b.interval.start.getTime());

    const live = onCourt.find((x) => overlaps(now, new Date(now.getTime() + 1), x.interval.start, x.interval.end));
    const next = onCourt.find((x) => x.interval.start > now);

    const inactive = court.is_active === false;
    const state: CourtState = inactive
      ? 'closed'
      : live
        ? isBlock(live.session)
          ? 'closed'
          : 'in_play'
        : 'open';

    const progress = live
      ? Math.min(
          1,
          Math.max(
            0,
            (now.getTime() - live.interval.start.getTime()) /
              (live.interval.end.getTime() - live.interval.start.getTime()),
          ),
        )
      : 0;

    return {
      court,
      state,
      current: live?.session ?? null,
      next: next?.session ?? null,
      progress,
      minutesLeft: live ? minutesBetween(now, live.interval.end) : null,
      minutesUntilNext: next ? minutesBetween(now, next.interval.start) : null,
    };
  });
}

export interface Utilization {
  /** Slots with something on them. */
  booked: number;
  /** Slots in the day across all courts. */
  total: number;
  /** 0..100, rounded. 0 when the day has no slots at all. */
  percent: number;
}

/**
 * How full the day is, measured in court-slots.
 *
 * Counts occupied slots against every slot the venue has, which is the number
 * a manager can compare between a Tuesday and a Saturday. Slots already in the
 * past still count as capacity — a morning nobody booked is exactly the thing
 * this number should surface, not quietly exclude.
 */
export function utilization(grid: CourtColumn[]): Utilization {
  let booked = 0;
  let total = 0;

  for (const column of grid) {
    for (const slot of column.slots) {
      total += 1;
      if (slot.reservation) booked += 1;
    }
  }

  return {
    booked,
    total,
    percent: total === 0 ? 0 : Math.round((booked / total) * 100),
  };
}

export interface Gap {
  court: Court;
  start: Date;
  end: Date;
  /** Length in minutes. */
  minutes: number;
}

/**
 * Unsold time still ahead today, longest first.
 *
 * This is the dashboard's one genuinely commercial number: it's the inventory
 * a manager can still fill this afternoon by posting an open play or messaging
 * members. Gaps already in the past are excluded — they can't be sold.
 */
export function upcomingGaps(
  grid: CourtColumn[],
  now: Date,
  minMinutes = 60,
): Gap[] {
  const gaps: Gap[] = [];

  for (const column of grid) {
    let run: { start: Date; end: Date } | null = null;

    for (const slot of column.slots) {
      const free = !slot.reservation && slot.end > now;
      if (free) {
        if (run && run.end.getTime() === slot.start.getTime()) {
          run.end = slot.end;
        } else {
          if (run) gaps.push(toGap(column.court, run));
          run = { start: slot.start < now ? now : slot.start, end: slot.end };
        }
      } else if (run) {
        gaps.push(toGap(column.court, run));
        run = null;
      }
    }
    if (run) gaps.push(toGap(column.court, run));
  }

  return gaps
    .filter((g) => g.minutes >= minMinutes)
    .sort((a, b) => b.minutes - a.minutes || a.start.getTime() - b.start.getTime());
}

function toGap(court: Court, run: { start: Date; end: Date }): Gap {
  return {
    court,
    start: run.start,
    end: run.end,
    minutes: minutesBetween(run.start, run.end),
  };
}

export interface DaySummary {
  utilization: Utilization;
  /** Courts with something live on them right now. */
  inPlay: number;
  /** Active courts with nothing on them right now. */
  open: number;
  /** Courts out of service or blocked. */
  closed: number;
  /** Sessions still to come today. */
  upcoming: number;
  /** Sellable time left, in minutes, across all courts. */
  openMinutes: number;
}

export function daySummary(
  grid: CourtColumn[],
  statuses: CourtStatus[],
  now: Date,
): DaySummary {
  const gaps = upcomingGaps(grid, now, 0);

  return {
    utilization: utilization(grid),
    inPlay: statuses.filter((s) => s.state === 'in_play').length,
    open: statuses.filter((s) => s.state === 'open').length,
    closed: statuses.filter((s) => s.state === 'closed').length,
    upcoming: statuses.filter((s) => s.next).length,
    openMinutes: gaps.reduce((sum, g) => sum + g.minutes, 0),
  };
}

/** "1h 30m" / "45m" — compact enough for a stat tile. */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
