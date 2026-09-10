export type VenueCommunityTab = 'home' | 'book' | 'play' | 'feed' | 'chat' | 'more';

const VENUE_TABS = new Set<VenueCommunityTab>(['home', 'book', 'play', 'feed', 'chat', 'more']);

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
