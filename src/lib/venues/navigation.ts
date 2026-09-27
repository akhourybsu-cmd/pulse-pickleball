export type VenueCommunityTab = 'home' | 'book' | 'play' | 'feed' | 'chat' | 'more' | 'events';

const VENUE_TABS = new Set<VenueCommunityTab>(['home', 'book', 'play', 'feed', 'chat', 'more', 'events']);

export function venueDayKey(day: Date): string {
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
}

/** Calendar dates are wall dates, never UTC timestamps. Reject rolled-over dates. */
export function parseVenueDay(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const result = new Date(year, month - 1, day);
  return venueDayKey(result) === value ? result : null;
}

export function venueDayOptions(value: Date, today: Date, count = 14): Date[] {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const last = new Date(start); last.setDate(last.getDate() + count - 1);
  if (value < start || value > last) start.setFullYear(value.getFullYear(), value.getMonth(), value.getDate());
  return Array.from({ length: count }, (_, i) => {
    const day = new Date(start); day.setDate(day.getDate() + i); return day;
  });
}

/** Resolve the venue's initial destination from a Social/deep-link URL. */
export function initialVenueCommunityTab(searchParams: URLSearchParams): VenueCommunityTab {
  const tab = searchParams.get('tab') as VenueCommunityTab | null;
  return tab && VENUE_TABS.has(tab) ? tab : 'home';
}

export function venueTabParams(params: URLSearchParams, tab: VenueCommunityTab): URLSearchParams {
  const next = new URLSearchParams(params);
  if (tab === 'home') next.delete('tab');
  else next.set('tab', tab);
  return next;
}

export function resolveVenueAdminTab(requested: string | null, facility: boolean, community: boolean, modules: boolean): string {
  const allowed = [
    ...(facility ? ['overview', 'profile', 'modules', 'staff', ...(modules ? ['facility'] : [])] : []),
    ...(community ? ['general', 'permissions', 'privacy', 'roles', 'danger'] : []),
  ];
  return requested && allowed.includes(requested) ? requested : allowed[0] ?? 'general';
}
