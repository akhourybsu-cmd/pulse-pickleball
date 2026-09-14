/** Visual categories only: never use these to decide access, availability or billing. */
export type VenueService = 'booking' | 'programs' | 'coaching' | 'competition' | 'community' | 'operations';

export function programService(format: string): VenueService {
  if (format === 'clinic' || format === 'practice') return 'coaching';
  if (format === 'round_robin') return 'competition';
  if (format === 'social') return 'community';
  return 'programs';
}

export function venueTabService(tab: string): VenueService {
  if (tab === 'book') return 'booking';
  if (tab === 'play') return 'programs';
  return 'community';
}
