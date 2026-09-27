/** Daily play and scheduled occasions have distinct destinations. */
export const VENUE_OCCASION_FORMATS = ['round_robin', 'social', 'other'] as const;
export type VenueEventFilter = 'upcoming' | 'competition' | 'leagues' | 'social';
export interface VenueOccasion {
  id: string; title: string; description: string | null;
  kind: 'competition' | 'leagues' | 'social' | 'special';
  start: string | null; end: string | null;
  programId?: string; leagueId?: string;
}
export function filterVenueOccasions(events: VenueOccasion[], filter: VenueEventFilter) {
  return events.filter(event => filter === 'upcoming' || event.kind === filter)
    .sort((a, b) => (a.start ? Date.parse(a.start) : Infinity) - (b.start ? Date.parse(b.start) : Infinity) || a.title.localeCompare(b.title));
}
