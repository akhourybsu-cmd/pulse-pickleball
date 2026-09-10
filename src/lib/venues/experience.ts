import type { CourtColumn } from './availability';
import type { GroupRsvpStatus } from '@/hooks/useGroupEvents';

/** Events that occupy courts but are not player-facing programs. */
export const INTERNAL_VENUE_EVENT_FORMATS = ['reservation', 'maintenance', 'program_hold'] as const;

/** Half-open overlap, including programs without an explicit end on their start day. */
export function venueDayOverlapFilter(from: string): string {
  return `end_time.gt.${from},and(end_time.is.null,start_time.gte.${from})`;
}

/** Stop duration choices at the next occupied slot, not merely at closing time. */
export function availableBookingEnd(grid: CourtColumn[], courtId: string | null, start: Date | null): Date | null {
  if (!courtId || !start || !Number.isFinite(start.getTime())) return null;
  const slots = grid.find(column => column.court.id === courtId)?.slots ?? [];
  const index = slots.findIndex(slot => slot.start.getTime() === start.getTime());
  if (index < 0 || !slots[index].bookable) return null;
  let end = slots[index].end;
  for (let i = index + 1; i < slots.length && slots[i].bookable && slots[i].start.getTime() === end.getTime(); i++) end = slots[i].end;
  return end;
}

export function bookingDurationOptions(slotMinutes: number, maxMinutes: number): number[] {
  return [...new Set([30, 60, 90, 120, 180, slotMinutes])]
    .filter(minutes => Number.isFinite(minutes) && minutes > 0 && minutes <= maxMinutes)
    .sort((a, b) => a - b);
}

export function isBookingRangeValid(start: Date | null, minutes: number, availableEnd: Date | null, now = new Date()): boolean {
  return !!start && !!availableEnd && Number.isFinite(start.getTime()) && Number.isFinite(availableEnd.getTime())
    && Number.isFinite(minutes) && minutes > 0 && start >= now
    && start.getTime() + minutes * 60_000 <= availableEnd.getTime();
}

/** Failed RSVP calls return no status; never turn them into a success locally. */
export function isConfirmedVenueRsvp(status: unknown): status is GroupRsvpStatus {
  return status === 'going' || status === 'maybe' || status === 'not_going' || status === 'waitlist';
}

export function canUseVenueCourtSelection(selected: string[], busy: ReadonlySet<string>, availabilityConfirmed: boolean): boolean {
  return availabilityConfirmed && selected.length > 0 && selected.every(id => !busy.has(id));
}
