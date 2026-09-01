/**
 * Court availability.
 *
 * The booking grid is the product in every court-reservation tool worth
 * copying, and the arithmetic underneath it is where they get subtly wrong:
 * a slot that looks free but isn't, a booking that ends exactly when the next
 * begins and is reported as a clash, a day that silently loses an hour when
 * the clocks change.
 *
 * All of it lives here as pure functions over real Date objects so it can be
 * tested without a database or a rendered grid. The database still has the
 * final say — `group_events_no_court_double_booking` rejects an overlap that
 * slips past this — but the UI should never offer a slot it will then refuse.
 */

export interface Court {
  id: string;
  name: string | null;
  court_number: number | null;
  is_active?: boolean | null;
  is_premium?: boolean | null;
  surface_type?: string | null;
}

export interface Reservation {
  id: string;
  venue_court_id: string | null;
  start_time: string;
  end_time: string | null;
  title?: string | null;
  event_format?: string | null;
  capacity?: number | null;
}

export interface Slot {
  start: Date;
  end: Date;
  /** The session occupying this slot, if any. */
  reservation: Reservation | null;
  /** False when taken, in the past, or outside opening hours. */
  bookable: boolean;
}

export interface CourtColumn {
  court: Court;
  slots: Slot[];
}

export interface DayGridOptions {
  /** Local hour the venue opens, 0-23. */
  openHour: number;
  /** Local hour it closes, 1-24. 24 means midnight. */
  closeHour: number;
  /** Slot length in minutes. */
  slotMinutes: number;
  /** Anything starting before this is not bookable. Defaults to now. */
  now?: Date;
}

export const DEFAULT_GRID: DayGridOptions = {
  openHour: 6,
  closeHour: 22,
  slotMinutes: 60,
};

/** Half-open overlap: a booking ending at 10:00 does not clash with one starting at 10:00. */
export function overlaps(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** Parse a reservation into a concrete interval, or null if it has no end. */
export function intervalOf(r: Reservation): { start: Date; end: Date } | null {
  if (!r.end_time) return null;
  const start = new Date(r.start_time);
  const end = new Date(r.end_time);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  if (end <= start) return null;
  return { start, end };
}

/**
 * The reservation occupying [start, end) on a court, if any.
 *
 * Returns the FIRST overlapping one. The database forbids two, so a second
 * would mean data written before that constraint existed.
 */
export function reservationAt(
  reservations: Reservation[],
  courtId: string,
  start: Date,
  end: Date,
): Reservation | null {
  for (const r of reservations) {
    if (r.venue_court_id !== courtId) continue;
    const interval = intervalOf(r);
    if (!interval) continue;
    if (overlaps(start, end, interval.start, interval.end)) return r;
  }
  return null;
}

/**
 * The slot boundaries for one day, in the viewer's local time.
 *
 * Built by stepping from the opening time rather than by adding a fixed number
 * of milliseconds to midnight: on a daylight-saving day the local hour is what
 * a player reads on the sign outside, and a fixed-millisecond walk would slide
 * every slot after the transition by an hour.
 */
export function slotBoundaries(day: Date, options: DayGridOptions): Date[] {
  const { openHour, closeHour, slotMinutes } = options;
  if (slotMinutes <= 0 || closeHour <= openHour) return [];

  const boundaries: Date[] = [];
  const total = ((closeHour - openHour) * 60) / slotMinutes;

  for (let i = 0; i <= total; i++) {
    const minutesFromOpen = i * slotMinutes;
    const d = new Date(day);
    d.setHours(openHour, 0, 0, 0);
    d.setMinutes(d.getMinutes() + minutesFromOpen);
    boundaries.push(d);
  }

  return boundaries;
}

/**
 * The full day view: one column per court, one slot per interval.
 *
 * Courts marked inactive are dropped — a court out for resurfacing shouldn't
 * appear bookable — and the rest are ordered by court number so the grid reads
 * the way the signs on the fence do.
 */
export function buildDayGrid(
  courts: Court[],
  reservations: Reservation[],
  day: Date,
  options: DayGridOptions = DEFAULT_GRID,
): CourtColumn[] {
  const now = options.now ?? new Date();
  const boundaries = slotBoundaries(day, options);

  const ordered = courts
    .filter((c) => c.is_active !== false)
    .slice()
    .sort((a, b) => {
      const an = a.court_number ?? Number.MAX_SAFE_INTEGER;
      const bn = b.court_number ?? Number.MAX_SAFE_INTEGER;
      if (an !== bn) return an - bn;
      return (a.name ?? '').localeCompare(b.name ?? '');
    });

  return ordered.map((court) => ({
    court,
    slots: boundaries.slice(0, -1).map((start, i) => {
      const end = boundaries[i + 1];
      const reservation = reservationAt(reservations, court.id, start, end);
      return {
        start,
        end,
        reservation,
        bookable: !reservation && start >= now,
      };
    }),
  }));
}

/** Every slot on a court that a player could actually book. */
export function openSlots(column: CourtColumn): Slot[] {
  return column.slots.filter((s) => s.bookable);
}

/**
 * Merge a court's consecutive free slots into runs.
 *
 * The mobile view lists availability rather than drawing a grid, and "9:00 –
 * 11:00 free" is far more useful on a phone than three separate hour rows.
 */
export function freeRuns(column: CourtColumn): Array<{ start: Date; end: Date }> {
  const runs: Array<{ start: Date; end: Date }> = [];

  for (const slot of column.slots) {
    if (!slot.bookable) continue;
    const last = runs[runs.length - 1];
    // Contiguous only if the previous run ends exactly where this slot starts.
    if (last && last.end.getTime() === slot.start.getTime()) {
      last.end = slot.end;
    } else {
      runs.push({ start: slot.start, end: slot.end });
    }
  }

  return runs;
}

/** How many courts are free right now, for the venue's home screen. */
export function courtsFreeAt(
  courts: Court[],
  reservations: Reservation[],
  at: Date,
): number {
  const end = new Date(at.getTime() + 1);
  return courts.filter(
    (c) => c.is_active !== false && !reservationAt(reservations, c.id, at, end),
  ).length;
}

/** hh:mm in the viewer's locale, for slot labels. */
export function formatSlotTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
