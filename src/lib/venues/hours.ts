import type { DayGridOptions } from './availability';

/**
 * Opening hours.
 *
 * The booking grid was hardcoded to 06:00–22:00 with one-hour slots, which is a
 * guess that is wrong for almost every real facility: an indoor club runs to
 * 11pm, a park closes at dusk, a club shuts on Mondays, and plenty of venues
 * book in half hours. None of that could be expressed.
 *
 * `venues.hours_of_operation` has existed as an unused JSON column since the
 * table was created. This gives it a shape, and — importantly — parses it
 * defensively: it is free-form JSON that nothing has ever validated, so every
 * field is treated as untrusted and anything unusable falls back to a sane
 * default rather than producing an empty or nonsensical grid.
 *
 * Stored shape:
 *   {
 *     "slotMinutes": 60,
 *     "days": {
 *       "0": { "open": "08:00", "close": "20:00" },   // Sunday
 *       "1": null,                                     // closed Mondays
 *       ...
 *     }
 *   }
 */

export interface DayHours {
  /** Minutes from midnight. */
  openMinutes: number;
  closeMinutes: number;
}

export interface VenueHours {
  slotMinutes: number;
  /** Index 0 = Sunday … 6 = Saturday. null means closed that day. */
  days: Array<DayHours | null>;
}

export const DEFAULT_SLOT_MINUTES = 60;
export const DEFAULT_OPEN_MINUTES = 6 * 60;
export const DEFAULT_CLOSE_MINUTES = 22 * 60;

/** Slot lengths a venue can choose. Anything else is snapped to the nearest. */
export const SLOT_CHOICES = [30, 60, 90, 120] as const;

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export function defaultVenueHours(): VenueHours {
  return {
    slotMinutes: DEFAULT_SLOT_MINUTES,
    days: Array.from({ length: 7 }, () => ({
      openMinutes: DEFAULT_OPEN_MINUTES,
      closeMinutes: DEFAULT_CLOSE_MINUTES,
    })),
  };
}

/** "HH:MM" → minutes from midnight, or null if it isn't a real time. */
export function parseTime(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  // 24:00 is a legitimate closing time — it means midnight.
  if (hours > 24 || minutes > 59) return null;
  const total = hours * 60 + minutes;
  return total > 24 * 60 ? null : total;
}

/** minutes from midnight → "HH:MM", for the editor's time inputs. */
export function formatTime(minutes: number): string {
  const clamped = Math.max(0, Math.min(24 * 60, Math.round(minutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Read stored hours, tolerating anything.
 *
 * A day is only closed when it is explicitly null. A malformed day falls back
 * to the default window rather than closing the venue — silently refusing every
 * booking because of a typo in a JSON blob is far worse than showing slightly
 * wrong hours.
 */
export function parseVenueHours(raw: unknown): VenueHours {
  const fallback = defaultVenueHours();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fallback;

  const source = raw as Record<string, unknown>;

  const rawSlot = Number(source.slotMinutes);
  const slotMinutes =
    Number.isFinite(rawSlot) && SLOT_CHOICES.includes(rawSlot as never)
      ? rawSlot
      : DEFAULT_SLOT_MINUTES;

  const daysSource =
    source.days && typeof source.days === 'object' && !Array.isArray(source.days)
      ? (source.days as Record<string, unknown>)
      : null;

  if (!daysSource) return { ...fallback, slotMinutes };

  const days = Array.from({ length: 7 }, (_, i): DayHours | null => {
    if (!(String(i) in daysSource)) return fallback.days[i];

    const entry = daysSource[String(i)];
    if (entry === null) return null; // deliberately closed

    if (!entry || typeof entry !== 'object') return fallback.days[i];

    const record = entry as Record<string, unknown>;
    const openMinutes = parseTime(record.open);
    const closeMinutes = parseTime(record.close);

    // A window that doesn't move forward can't hold a slot.
    if (openMinutes === null || closeMinutes === null || closeMinutes <= openMinutes) {
      return fallback.days[i];
    }

    return { openMinutes, closeMinutes };
  });

  return { slotMinutes, days };
}

/** Back to the stored shape. */
export function serializeVenueHours(hours: VenueHours): Record<string, unknown> {
  return {
    slotMinutes: hours.slotMinutes,
    days: Object.fromEntries(
      hours.days.map((day, i) => [
        String(i),
        day === null ? null : { open: formatTime(day.openMinutes), close: formatTime(day.closeMinutes) },
      ]),
    ),
  };
}

/**
 * Grid options for one calendar day, or null when the venue is closed.
 *
 * The grid works in whole hours, so a window that doesn't start and end on an
 * hour boundary is widened outward to the hours containing it — better to show
 * a 07:00 row for a venue opening at 07:30 than to lose the half hour entirely.
 */
export function gridOptionsFor(
  hours: VenueHours,
  day: Date,
  now?: Date,
): DayGridOptions | null {
  const dayHours = hours.days[day.getDay()];
  if (!dayHours) return null;

  const openHour = Math.floor(dayHours.openMinutes / 60);
  const closeHour = Math.ceil(dayHours.closeMinutes / 60);
  if (closeHour <= openHour) return null;

  return { openHour, closeHour, slotMinutes: hours.slotMinutes, now };
}

/** Whether the venue opens at all on this date. */
export function isOpenOn(hours: VenueHours, day: Date): boolean {
  return hours.days[day.getDay()] !== null;
}

/** "6:00 AM – 10:00 PM" / "Closed", for the About panel. */
export function describeDay(day: DayHours | null): string {
  if (!day) return 'Closed';

  const label = (minutes: number) => {
    const d = new Date(2000, 0, 1);
    d.setMinutes(minutes);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  return `${label(day.openMinutes)} – ${label(day.closeMinutes)}`;
}
